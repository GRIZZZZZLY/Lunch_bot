import { expect, test as base, type Page } from '@playwright/test';
import { installTelegramMock } from '../e2e/mocks/telegram';
import { isAllowedProductionApiRequest } from './support/read-only';
import { productionIdentity, type ProductionIdentity } from './support/telegram-auth';

interface ProductionFixtures {
  appPage: Page;
  diagnostics: void;
  identity: ProductionIdentity;
  readOnlyGuard: string[];
}

const IGNORED_CONSOLE_ERRORS = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of/i,
];

export const test = base.extend<ProductionFixtures>({
  identity: async ({}, use) => {
    await use(productionIdentity());
  },

  readOnlyGuard: async ({ context }, use) => {
    const blocked: string[] = [];
    await context.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (isAllowedProductionApiRequest(method, url.pathname)) {
        await route.continue();
        return;
      }

      blocked.push(`${method} ${url.pathname}`);
      await route.abort('blockedbyclient');
    });
    await use(blocked);
  },

  appPage: async ({ context, identity, page, readOnlyGuard: _guard }, use) => {
    await installTelegramMock(context, {
      initData: identity.initData,
      userId: identity.userId,
    });
    await use(page);
  },

  diagnostics: [
    async ({ page, readOnlyGuard }, use, testInfo) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const failedApiRequests: string[] = [];
      const apiResponseErrors: string[] = [];

      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('console', message => {
        if (
          message.type() === 'error' &&
          !IGNORED_CONSOLE_ERRORS.some(pattern => pattern.test(message.text()))
        ) {
          consoleErrors.push(message.text());
        }
      });
      page.on('requestfailed', request => {
        const url = new URL(request.url());
        const error = request.failure()?.errorText ?? 'unknown';
        if (
          url.pathname.startsWith('/api/') &&
          error !== 'net::ERR_ABORTED' &&
          error !== 'Load request cancelled' &&
          error !== 'net::ERR_BLOCKED_BY_CLIENT'
        ) {
          failedApiRequests.push(`${request.method()} ${url.pathname}: ${error}`);
        }
      });
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/') && response.status() >= 400) {
          const request = response.request();
          apiResponseErrors.push(`${response.status()} ${request.method()} ${url.pathname}`);
        }
      });

      await use();

      if (testInfo.status === testInfo.expectedStatus) {
        expect(pageErrors, 'Необработанные ошибки страницы').toEqual([]);
        expect(consoleErrors, 'Ошибки console.error').toEqual([]);
        expect(failedApiRequests, 'Оборванные запросы к боевому API').toEqual([]);
        expect(apiResponseErrors, 'Ошибочные ответы боевого API').toEqual([]);
        expect(readOnlyGuard, 'Попытки изменить данные продакшена').toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
