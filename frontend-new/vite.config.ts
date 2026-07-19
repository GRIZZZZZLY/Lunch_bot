/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.app',
      '.ngrok.io',
      '.ngrok.app',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Битый deps-optimizer кэш в node_modules/.vite ронял все suites
    // («Vitest failed to find the current suite») — cache:false его не покрывал:
    // Vitest 4 держит optimizer-кэш отдельно (node_modules/.vite/vitest) и
    // переиспользует его после dev/build. Отключаем оптимизер в тестах целиком —
    // детерминированность важнее долей секунды на старте.
    // TODO(infra): перепроверить после обновления Vitest > 4.1.x.
    cache: false,
    deps: {
      optimizer: {
        web: { enabled: false },
        ssr: { enabled: false },
      },
    },
  },
});
