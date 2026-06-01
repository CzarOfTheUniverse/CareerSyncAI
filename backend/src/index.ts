/**
 * Runnable entry point: load config, start the HTTP server, attach the
 * WebSocket bridge. Kept thin so the app logic stays testable in app.ts.
 */
import 'dotenv/config';
import { loadConfig } from './config.js';
import { createApp, setupWebSocket } from './app.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`[Config] ${(error as Error).message}`);
  process.exit(1);
}

const app = createApp(config);
const server = app.listen(config.port, config.host, () => {
  console.log(`Vertex AI backend listening at http://${config.host}:${config.port}`);
});
setupWebSocket(server, config);
