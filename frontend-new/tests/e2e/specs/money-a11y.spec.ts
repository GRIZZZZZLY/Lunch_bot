/* Регрессия доступности денежного контура: закупка → расчёт → долги.
   Статусные чипы здесь стоят на собственном тинте, и базовые токены
   --success/--warning когда-то давали 3.7–3.99:1 при пороге 4.5 (аудит
   2026-08-01). Текст на тинте обязан брать *-on-tint. Проверяем обе темы:
   в тёмной тинт затемняет фон, в светлой осветляет, и провал в одной теме
   не виден в другой. */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';
import type { E2ERole, ScenarioName } from '../scenarios/data';

interface MoneyScreen {
  title: string;
  scenario: ScenarioName;
  role: E2ERole;
  path: string;
  /** Признак того, что экран загрузился и чипы на месте. */
  ready: (page: Page) => Locator;
  smoke?: boolean;
}

const SCREENS: MoneyScreen[] = [
  {
    title: 'долги: должник',
    scenario: 'budget-debtor',
    role: 'debtor',
    path: '/budget',
    ready: (page) => page.getByRole('button', { name: /^Отметить/ }),
    smoke: true,
  },
  {
    title: 'закупка: чипы «Куплено» и «В магазине»',
    scenario: 'store-shopping',
    role: 'storeInitiator',
    path: '/store-run/601',
    ready: (page) => page.getByRole('button', { name: 'Рассчитать' }),
    smoke: true,
  },
];

for (const screen of SCREENS) {
  test.describe(`Доступность: ${screen.title}`, () => {
    test.use({ scenario: screen.scenario, role: screen.role });

    for (const theme of ['light', 'dark'] as const) {
      const tag = screen.smoke && theme === 'light' ? '@smoke ' : '';
      test(`${tag}${theme === 'light' ? 'светлая' : 'тёмная'} тема без serious-нарушений`, async ({
        appPage,
        telegram,
      }) => {
        await appPage.goto(screen.path);
        await expect(screen.ready(appPage)).toBeVisible();
        if (theme === 'dark') await telegram.setTheme('dark');
        await expect(appPage.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoSeriousViolations(appPage);
      });
    }
  });
}
