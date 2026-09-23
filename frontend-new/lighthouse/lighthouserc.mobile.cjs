/**
 * Производительность заполненных экранов на мобильном профиле.
 *
 * Прежняя проверка (`.lighthouserc.json`) мерила статическую сборку без
 * Telegram, то есть экран авторизации, и в настольном профиле — о скорости
 * рабочих экранов Mini App она не говорила ничего. Здесь Lighthouse открывает
 * приложение так, как его открывает Telegram (`telegram-url.cjs`), на сервере
 * с данными `e2e-seed`, а `expect-content.cjs` отменяет замер, если на экране
 * не тот контент. Настольная проверка остаётся как была.
 *
 * Запуск — в интеграционном задании CI после пересева данных:
 *   LIGHTHOUSE_BASE_URL=http://127.0.0.1:3001 npm run lighthouse:mobile
 *
 * Пороги — от исходного замера (см. комментарий у assertions), с запасом на
 * разницу машин. Метрики сравниваются по медиане трёх прогонов.
 */
const { chromium } = require('@playwright/test');
const { telegramUrl } = require('./telegram-url.cjs');

const baseUrl = process.env.LIGHTHOUSE_BASE_URL || 'http://127.0.0.1:3001';
const botToken = process.env.E2E_BOT_TOKEN || '777000:test_e2e_bot_token';

module.exports = {
  ci: {
    collect: {
      url: ['/', '/menu', '/budget'].map((path) => telegramUrl(baseUrl, path, botToken)),
      numberOfRuns: 3,
      puppeteerScript: './lighthouse/expect-content.cjs',
      /* У @lhci/cli нет своего Chrome: берём тот, что ставит Playwright. */
      chromePath: process.env.CHROME_PATH || chromium.executablePath(),
      puppeteerLaunchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
      settings: {
        /* Профиль по умолчанию — мобильный: эмуляция телефона, медленная сеть и
           замедленный процессор. Ключ повторяется явно, чтобы его не спутали с
           настольной проверкой. */
        formFactor: 'mobile',
        onlyCategories: ['performance'],
        /* Каждый запуск — с чистой памятью: иначе второй прогон мерил бы
           приложение из кэша. */
        disableStorageReset: false,
      },
    },
    assert: {
      /* Исходный замер 2026-09-24, мобильный профиль, медиана трёх прогонов:
           Главная  0,89 · LCP 3,48 с · TBT 8 мс · CLS 0
           Бюджет   0,92 · LCP 3,17 с · TBT 0    · CLS 0,034
           Меню     0,93 · LCP 3,03 с · TBT 0    · CLS 0
         Пороги ловят заметное ухудшение, а не разницу между машинами: у CI
         процессор слабее, а TBT от него зависит сильнее всего. CLS 0,1 —
         граница «хорошо» по Web Vitals. */
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci-mobile',
    },
  },
};
