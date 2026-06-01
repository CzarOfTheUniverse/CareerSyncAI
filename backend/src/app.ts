/**
 * Builds the Express app (HTTP proxy + config/health endpoints) and the
 * WebSocket upgrade bridge. Kept separate from the runnable entry point
 * (index.ts) so it can be exercised by integration tests.
 */
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import fetch from 'node-fetch';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

import { logger } from './logger.js';

import type { AppConfig } from './config.js';
import { toPublicConfig } from './config.js';
import { matchApiClient } from './proxyMap.js';
import {
  getAccessToken,
  getRequestHeaders,
  verifyUserAccessToken,
  isAllowed,
} from './auth.js';

const WS_TARGET =
  'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';

/**
 * Enforces the end-user allow-list when configured. The browser sends its
 * Google access token in the `x-user-access-token` header. Returns true when
 * the request may proceed; otherwise writes a 403 and returns false.
 */
async function authorizeUser(
  config: AppConfig,
  token: string,
  res: Response,
): Promise<boolean> {
  if (!config.authEnforced) return true;
  const info = await verifyUserAccessToken(token);
  if (!info || !isAllowed(info, config.allowedEmails, config.allowedHostedDomain)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your Google account is not authorized to use this instance.',
    });
    return false;
  }
  return true;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.use(express.json({ limit: config.payloadMaxSize }));
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));

  // --- Public runtime config for the frontend ---
  app.get('/config', (_req: Request, res: Response) => {
    res.json(toPublicConfig(config));
  });

  // --- Health / readiness probes ---
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/readyz', async (_req: Request, res: Response) => {
    const token = await getAccessToken();
    if (!token) {
      res.status(503).json({ status: 'unavailable', reason: 'credentials' });
      return;
    }
    res.json({ status: 'ready' });
  });

  // --- Rate limiting protects against abuse / runaway cost ---
  const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'You have exceeded the request limit, please try again later.',
    },
  });
  app.use('/api-proxy', proxyLimiter);

  // --- The proxy endpoint ---
  app.post('/api-proxy', async (req: Request, res: Response) => {
    if (req.headers['x-app-proxy'] !== config.proxyHeader) {
      res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
      return;
    }

    const userToken = (req.headers['x-user-access-token'] as string) || '';
    if (!(await authorizeUser(config, userToken, res))) return;

    const { originalUrl, method, headers, body } = req.body ?? {};
    if (!originalUrl) {
      res.status(400).send('Bad Request: originalUrl is required.');
      return;
    }

    const matched = matchApiClient(originalUrl);
    if (!matched) {
      console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
      res.status(404).json({ error: 'No proxy handler found for the requested URL.' });
      return;
    }
    const { client: apiClient, params } = matched;
    console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        res.status(401).json({
          error: 'Authentication Required',
          message:
            'Google Cloud credentials not found or invalid. Configure a service account or run "gcloud auth application-default login".',
        });
        return;
      }

      const context = { projectId: config.googleCloudProject, region: config.googleCloudLocation };
      const apiUrl = apiClient.getApiEndpoint(context, params);
      console.log(`[Node Proxy] Forwarding to Vertex API for ${apiClient.name}`);

      const apiHeaders = getRequestHeaders(accessToken, config.googleCloudProject);
      const apiResponse = await fetch(apiUrl, {
        method: method || 'POST',
        headers: { ...apiHeaders, ...(headers ?? {}) },
        body: body ? body : undefined,
      });

      if (apiClient.isStreaming) {
        res.writeHead(apiResponse.status, {
          'Content-Type': 'text/event-stream',
          'Transfer-Encoding': 'chunked',
          Connection: 'keep-alive',
        });
        res.flushHeaders();

        if (!apiResponse.body) {
          res.end(JSON.stringify({ error: 'Streaming response body is null' }));
          return;
        }

        const decoder = new TextDecoder();
        let deltaChunk = '';
        const transformFn = apiClient.transformFn;

        apiResponse.body.on('data', (encodedChunk: Buffer) => {
          if (res.writableEnded) return;
          try {
            if (!transformFn) {
              res.write(new Uint8Array(encodedChunk));
            } else {
              deltaChunk += decoder.decode(encodedChunk, { stream: true });
              const { result, inProgress } = transformFn(deltaChunk);
              if (result && !inProgress) {
                deltaChunk = '';
                res.write(new TextEncoder().encode(result));
              }
            }
          } catch (error) {
            console.error(`[Node Proxy] Error processing stream for ${apiClient.name}`, error);
          }
        });

        apiResponse.body.on('end', () => {
          deltaChunk = '';
          res.end();
        });

        apiResponse.body.on('error', (streamError: Error) => {
          console.error('[Node Proxy] Error from Vertex stream:', streamError);
          if (!res.writableEnded) {
            res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI' }));
          }
        });

        res.on('error', (resError: Error) => {
          console.error('[Node Proxy] Error writing to client response:', resError);
          const body = apiResponse.body as unknown as { destroy?: (err?: Error) => void } | null;
          if (body && typeof body.destroy === 'function') {
            body.destroy(resError);
          }
        });
      } else {
        const data = await apiResponse.json();
        console.log(`[Node Proxy] Vertex response status=${apiResponse.status} for ${apiClient.name}`);
        res.status(apiResponse.status).json(data);
      }
    } catch (error) {
      console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`, error);
      res.status(500).json({ error: 'Internal proxy error' });
    }
  });

  return app;
}

/**
 * Bridges the browser's BidiGenerateContent WebSocket to the regional Vertex
 * endpoint. The browser cannot set headers on a WS handshake, so when auth is
 * enforced the access token arrives as the `access_token` query parameter.
 */
export function setupWebSocket(server: Server, config: AppConfig): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`);
    if (url.pathname !== '/ws-proxy') {
      socket.destroy();
      return;
    }

    if (config.authEnforced) {
      const token = url.searchParams.get('access_token') ?? '';
      const info = await verifyUserAccessToken(token);
      if (!info || !isAllowed(info, config.allowedEmails, config.allowedHostedDomain)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    const requestedTarget = url.searchParams.get('target');
    if (requestedTarget !== WS_TARGET) {
      console.log('[Node Proxy] Invalid WS target');
      socket.destroy();
      return;
    }
    const location =
      config.googleCloudLocation === 'global' ? 'us-central1' : config.googleCloudLocation;
    const targetUrl = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const upstreamWs = new WebSocket(targetUrl, {
      headers: getRequestHeaders(accessToken, config.googleCloudProject),
    });

    const initialErrorHandler = (error: Error) => {
      console.error('[Node Proxy] Upstream connection failed:', error);
      upstreamWs.removeListener('open', onUpstreamOpen);
      if (socket.writable) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      }
    };
    upstreamWs.once('error', initialErrorHandler);

    const onUpstreamOpen = () => {
      upstreamWs.removeListener('error', initialErrorHandler);
      wss.handleUpgrade(request, socket, head, (ws) => {
        upstreamWs.on('message', (data, isBinary) => {
          // Do not log message contents — they carry model output / user data.
          if (ws.readyState === WebSocket.OPEN && data != null) {
            ws.send(data, { binary: isBinary });
          }
        });

        ws.on('message', (data) => {
          let dataJson: Record<string, unknown> = {};
          try {
            dataJson = JSON.parse(data.toString());
          } catch (error) {
            console.error('[Node Proxy] Failed to parse message from client:', error);
            ws.close(1011, 'Failed to parse message');
            return;
          }
          const setup = dataJson['setup'] as { model?: string } | undefined;
          if (setup) {
            setup.model = `projects/${config.googleCloudProject}/locations/${config.googleCloudLocation}/${setup.model}`;
          }
          if (upstreamWs.readyState === WebSocket.OPEN) {
            upstreamWs.send(JSON.stringify(dataJson), { binary: false });
          }
        });

        upstreamWs.on('error', (error) => {
          console.error('[Node Proxy] Upstream error:', error);
          ws.close(1011, error.message);
        });
        upstreamWs.on('close', (code, reason) => {
          if (ws.readyState === WebSocket.OPEN) ws.close(code, reason);
        });
        ws.on('error', (error) => {
          console.error('[Node Proxy] Client error:', error);
          upstreamWs.close(1011, error.message);
        });
        ws.on('close', (_code, reason) => {
          if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.close(1000, reason);
        });

        wss.emit('connection', ws, request);
      });
    };

    upstreamWs.once('open', onUpstreamOpen);
  });

  return wss;
}
