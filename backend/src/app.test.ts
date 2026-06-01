import { describe, it, expect, vi } from 'vitest';

// Mock the credential/verification layer so tests never hit Google.
vi.mock('./auth.js', () => ({
  getAccessToken: vi.fn(async () => 'fake-access-token'),
  getRequestHeaders: vi.fn(() => ({})),
  verifyUserAccessToken: vi.fn(async () => null),
  isAllowed: vi.fn(() => false),
}));

import request from 'supertest';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const baseEnv = {
  GOOGLE_CLOUD_PROJECT: 'proj',
  GOOGLE_CLOUD_LOCATION: 'global',
  PROXY_HEADER: 'secret',
} as NodeJS.ProcessEnv;

const openConfig = loadConfig({ ...baseEnv, GOOGLE_OAUTH_CLIENT_ID: 'cid' });
const enforcedConfig = loadConfig({ ...baseEnv, ALLOWED_EMAILS: 'allowed@x.com' });

describe('GET /config', () => {
  it('returns the public config', async () => {
    const res = await request(createApp(openConfig)).get('/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      googleClientId: 'cid',
      geminiModel: 'gemini-2.5-flash',
      lookbackDaysDefault: 90,
      authRequired: false,
    });
  });
});

describe('GET /healthz', () => {
  it('reports ok', async () => {
    const res = await request(createApp(openConfig)).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('reports ready when credentials resolve', async () => {
    const res = await request(createApp(openConfig)).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('POST /api-proxy', () => {
  it('rejects requests without the proxy header', async () => {
    const res = await request(createApp(openConfig))
      .post('/api-proxy')
      .send({ originalUrl: 'x' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthorised user when an allow-list is configured', async () => {
    const res = await request(createApp(enforcedConfig))
      .post('/api-proxy')
      .set('x-app-proxy', 'secret')
      .set('x-user-access-token', 'sometoken')
      .send({ originalUrl: 'https://aiplatform.googleapis.com/v1/publishers/google/models/m:generateContent' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('returns 400 when originalUrl is missing (auth not enforced)', async () => {
    const res = await request(createApp(openConfig))
      .post('/api-proxy')
      .set('x-app-proxy', 'secret')
      .send({});
    expect(res.status).toBe(400);
  });
});
