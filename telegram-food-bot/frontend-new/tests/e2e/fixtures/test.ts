import { expect, test as base, type Page } from '@playwright/test';
import { installApiMock } from '../mocks/api';
import {
  clickTelegramBack,
  installTelegramMock,
  setTelegramTheme,
  telegramCalls,
  type TelegramCall,
} from '../mocks/telegram';
import {
  createScenario,
  type E2ERole,
  type E2EState,
  type FailureRule,
  type RequestRecord,
  type ScenarioName,
} from '../scenarios/data';

export interface ApiController {
  state: E2EState;
  requests: (method?: string, path?: string) => RequestRecord[];
  lastRequest: (method: string, path: string) => RequestRecord | undefined;
  fail: (method: string, path: string, rule: FailureRule) => void;
  clearFailure: (method: string, path: string) => void;
  delay: (method: string, path: string, milliseconds: number) => void;
  clearDelay: (method: string, path: string) => void;
}

export interface TelegramController {
  calls: () => Promise<TelegramCall[]>;
  clickBack: () => Promise<void>;
  setTheme: (scheme: 'light' | 'dark') => Promise<void>;
}

interface TestFixtures {
  role: E2ERole;
  scenario: ScenarioName;
  api: ApiController;
  telegram: TelegramController;
  appPage: Page;
  diagnostics: void;
}

const IGNORED_CONSOLE_ERRORS = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of/i,
  /Failed to load resource: net::ERR_FAILED/i,
];

function isWebKitMockRoutingArtifact(browserName: string, message: string): boolean {
  return (
    browserName === 'webkit' &&
    /127\.0\.0\.1:4174\/api\/.+due to access control checks\.?$/i.test(message)
  );
}

export const test = base.extend<TestFixtures>({
  role: ['member', { option: true }],
  scenario: ['default', { option: true }],

  api: async ({ context, role, scenario }, use) => {
    const state = createScenario(scenario, role);
    await installTelegramMock(context, {
      initData: state.initData,
      userId: Number(state.user.telegramId),
    });
    await installApiMock(context, state);
    const controller: ApiController = {
      state,
      requests: (method, path) =>
        state.requests.filter(
          (entry) => (!method || entry.method === method) && (!path || entry.path === path),
        ),
      lastRequest: (method, path) =>
        [...state.requests]
          .reverse()
          .find((entry) => entry.method === method && entry.path === path),
      fail: (method, path, rule) => {
        state.failures[`${method} ${path}`] = rule;
      },
      clearFailure: (method, path) => {
        delete state.failures[`${method} ${path}`];
      },
      delay: (method, path, milliseconds) => {
        state.delays[`${method} ${path}`] = milliseconds;
      },
      clearDelay: (method, path) => {
        delete state.delays[`${method} ${path}`];
      },
    };
    await use(controller);
  },

  telegram: async ({ page, api: _api }, use) => {
    await use({
      calls: () => telegramCalls(page),
      clickBack: () => clickTelegramBack(page),
      setTheme: (scheme) => setTelegramTheme(page, scheme),
    });
  },

  appPage: async ({ page, api: _api }, use) => {
    await page.clock.install({ time: new Date('2026-07-20T09:05:00.000Z') });
    await use(page);
  },

  diagnostics: [
    async ({ page, api, browserName }, use, testInfo) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];

      page.on('pageerror', (error) => {
        // WebKit изредка помечает успешно перехваченный ответ Playwright как ошибку
        // проверки доступа во время смены экрана. Конечное состояние интерфейса и
        // журнал запросов всё равно проверяются ниже, поэтому исключаем только этот
        // узкий случай для локального адреса тестового сервера.
        if (!isWebKitMockRoutingArtifact(browserName, error.message)) {
          pageErrors.push(error.message);
        }
      });
      page.on('console', (message) => {
        if (
          message.type() === 'error' &&
          !IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(message.text()))
        ) {
          consoleErrors.push(message.text());
        }
      });
      page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        const requestKey = `${request.method()} ${url.pathname}`;
        const errorText = request.failure()?.errorText ?? 'unknown';
        // Переход на другой маршрут штатно отменяет незавершённый запрос старого экрана.
        if (errorText === 'net::ERR_ABORTED' || errorText === 'Load request cancelled') return;
        const expected = api.state.expectedNetworkFailures.includes(requestKey);
        if (!expected && (!url.pathname.includes('/api/polls/') || !url.pathname.endsWith('/stream'))) {
          failedRequests.push(`${request.method()} ${url.pathname}: ${errorText}`);
        }
      });

      await use();

      // Даём фоновым обновлениям React Query завершиться, пока перехват API ещё
      // действует. Иначе WebKit может отправить уже начатый запрос в Vite при
      // закрытии контекста и создать ложную сетевую ошибку между тестами.
      if (!page.isClosed()) {
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      }

      if (testInfo.status === testInfo.expectedStatus) {
        expect(pageErrors, 'Необработанные ошибки страницы').toEqual([]);
        expect(consoleErrors, 'Ошибки console.error').toEqual([]);
        expect(failedRequests, 'Неожиданно оборванные сетевые запросы').toEqual([]);
        expect(api.state.unexpectedRequests, 'Запросы без сценарного ответа').toEqual([]);
        await page.close({ runBeforeUnload: false });
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
