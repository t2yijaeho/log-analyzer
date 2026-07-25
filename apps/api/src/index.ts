import { createApp } from './app.js';
import { assertRuntimeConfig, config } from './config.js';
import { startSessionSweep } from './session/sessionStore.js';

assertRuntimeConfig();
const app = createApp();
startSessionSweep();

const server = app.listen(config.port, () => {
  console.log(`log-analyzer-agent server listening on port ${config.port}`);
});

function shutdown(signal: string): void {
  console.log(`received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
