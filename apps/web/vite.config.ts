import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend origin for the dev proxy. Override with VITE_BACKEND_ORIGIN if the
// server ever runs on a different port/host during local development.
const backendOrigin = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:3001';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      // Proxies both plain JSON endpoints and the POST /api/chat SSE stream --
      // Vite's dev proxy (http-proxy) pipes the upstream response through as-is,
      // so text/event-stream works transparently with no extra config.
      '/api': {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
});
