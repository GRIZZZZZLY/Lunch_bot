/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
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
    /**
     * Измерение покрытия (задача 11).
     *
     * До этого фронтенд был единственным слоем без обратной связи по
     * регрессиям: тесты есть, но сколько кода они трогают — не знал никто, и
     * покрытие могло уехать в любую сторону незамеченным.
     *
     * Провайдер `v8`, а не `istanbul`, и менять его нельзя: цифры у них
     * расходятся на 1–3 п.п., и смена провайдера сдвинет порог без единой
     * правки кода.
     *
     * Пороги — ПОЛ, равный измеренному факту (тот же приём, что в
     * `backend/jest.config.js`), а не «хорошее число»: недостижимый порог
     * приучает пролистывать красный CI. По ветвям взято на 3 п.п. ниже факта —
     * на фронте много условного рендеринга, и один новый `if` не должен ронять
     * гейт на человеке, который его не вносил.
     *
     * Первый в истории проекта замер, 2026-08-23, 512 тестов в 46 файлах:
     * 56.69% statements, 59.22% branches, 49.55% functions, 56.15% lines.
     * После пяти приоритетных файлов задачи 11 (565 тестов в 49 файлах):
     * 59.77% / 60.91% / 52.87% / 59.49% — пороги подняты по этому замеру.
     * Прогон с покрытием — около минуты против ~25 секунд без него; это цена
     * одного форка без параллелизма, и трогать `pool` нельзя (см. TODO выше).
     */
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/__tests__/**',
        'src/main.tsx',
        'tests/**',
      ],
      thresholds: {
        statements: 59,
        branches: 57,
        functions: 52,
        lines: 59,
      },
    },
  },
}));
