import { pino } from 'pino';

/**
 * Structured logger. Auth-bearing headers are redacted so tokens never reach
 * the logs.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-user-access-token"]',
      'req.headers["x-app-proxy"]',
    ],
    remove: true,
  },
});
