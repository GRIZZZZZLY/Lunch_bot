import { defineConfig, devices } from '@playwright/test';

const previewUrl = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: previewUrl,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
      },
      grepInvert: /@chromium-only|@integration/,
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@desktop|@smoke/,
      grepInvert: /@integration/,
    },
    {
      name: 'integration',
      testMatch: /integration\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        baseURL: process.env.E2E_INTEGRATION_BASE_URL || previewUrl,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174',
    url: previewUrl,
    /* Адресат «Поддержать проект» задаётся явно: без него кнопка отключена,
       а зависеть от локального .env, которого нет в репозитории, тесты не должны. */
    env: { VITE_DONATION_SBP_PHONE: '+7 900 000-00-00' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
