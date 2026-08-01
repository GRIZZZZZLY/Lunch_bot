import { defineConfig, devices } from '@playwright/test';

/**
 * Тур по интерфейсу: снимает состояния экранов в галерею `ui-tour/`.
 * Отдельная конфигурация, чтобы не смешиваться со сквозными проверками
 * (`playwright.config.ts`) и не занимать их порт.
 */

const previewUrl = 'http://127.0.0.1:4175';

export default defineConfig({
  testDir: './tests/tour',
  outputDir: './test-results-tour',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  globalTeardown: './tests/tour/build-index.ts',
  use: {
    baseURL: previewUrl,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    serviceWorkers: 'block',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'tour',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4175',
    url: previewUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
