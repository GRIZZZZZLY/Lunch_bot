/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
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
    sourcemap: mode !== 'production',
  },
  test: {
    exclude: ['tests/e2e/**', 'tests/production/**', 'tests/tour/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Битый deps-optimizer кэш в node_modules/.vite ронял все suites
    // («Vitest failed to find the current suite») — cache:false его не покрывал:
    // Vitest 4 держит optimizer-кэш отдельно (node_modules/.vite/vitest) и
    // переиспользует его после dev/build. Отключаем оптимизер в тестах целиком —
    // детерминированность важнее долей секунды на старте.
    // Симптом «Vitest failed to find the current suite»/«no tests» на Windows
    // имел ТРИ слоя: битый optimizer-кэш (deps.optimizer off), гонка воркеров
    // (fileParallelism off) и баг tinypool с worker_threads (воспроизводился
    // после vite build даже без кэша). Финальный фикс — процессный пул:
    // forks + один форк = полная изоляция, детерминированно на всех прогонах.
    // TODO(infra): перепроверить после обновления Vitest > 4.1.x.
    // Проверено 2026-08-22: в package-lock.json ровно 4.1.10, условие TODO НЕ
    // наступило, настройку не трогали. Диапазон в package.json — ^4.1.10, то
    // есть следующий npm install может подтянуть 4.2.x и условие наступит само;
    // сверяйте lock, а не package.json.
    // Когда наступит: включать параллелизм ТОЛЬКО целиком (fileParallelism
    // при сохранённом pool: 'forks' даст «иногда падает» — симптом составной)
    // и прогонять не менее 5 раз подряд: сбой был плавающим, один зелёный
    // прогон ничего не доказывает.
    cache: false,
    fileParallelism: false,
    pool: 'forks',
    deps: {
      optimizer: {
        web: { enabled: false },
        ssr: { enabled: false },
      },
    },
  },
}));
