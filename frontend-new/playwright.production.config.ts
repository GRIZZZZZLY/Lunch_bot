import { defineConfig, devices } from '@playwright/test';

function productionBaseUrl(): string {
  if (process.env.E2E_ALLOW_PRODUCTION !== '1') {
    throw new Error(
      'Продакшен-проверка заблокирована. Установите E2E_ALLOW_PRODUCTION=1 осознанно.',
    );
  }

  const raw = process.env.E2E_PRODUCTION_BASE_URL;
  if (!raw) {
    throw new Error('Не задан E2E_PRODUCTION_BASE_URL.');
  }

  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error('E2E_PRODUCTION_BASE_URL должен использовать HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Боевой адрес не должен содержать логин, пароль, query или hash.');
  }

  return url.toString().replace(/\/$/, '');
}

export default defineConfig({
  testDir: './tests/production',
  outputDir:
    process.env.E2E_PRODUCTION_RESULTS_DIR || './production-test-results',
  fullyParallel: false,
  forbidOnly: true,
  /* Стенд ходит по сети раз в десять минут, и одиночный затык браузера не
     является поломкой продакшена: 31.08.2026 прогон упал на ожидании заголовка
     при том, что nginx и API ответили 200 за миллисекунды, а следующий прогон
     прошёл за 8.6 с. Ретрай отделяет такой шум от настоящей поломки — она
     переживёт вторую попытку и разбудит OnFailure. */
  retries: 1,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI
    ? [
        ['line'],
        [
          'html',
          {
            open: 'never',
            outputFolder:
              process.env.E2E_PRODUCTION_REPORT_DIR ||
              'production-playwright-report',
          },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder:
              process.env.E2E_PRODUCTION_REPORT_DIR ||
              'production-playwright-report',
          },
        ],
      ],
  use: {
    ...devices['Pixel 5'],
    baseURL: productionBaseUrl(),
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    serviceWorkers: 'block',
    ignoreHTTPSErrors: false,
    /* Трасса пишет сетевые запросы и снимки DOM по шагам — именно её не хватило
       при разборе 31.08.2026, когда по логам сервера всё было зелёным. Только
       на упавших прогонах: на зелёных это лишний вес в artifacts/. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'production-smoke', use: { ...devices['Pixel 5'] } }],
});
