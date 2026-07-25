import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_MODE': JSON.stringify('static'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
    maxWorkers: 1,
  },
});
