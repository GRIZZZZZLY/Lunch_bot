import { test as base, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installApiMock } from '../e2e/mocks/api';
import { installTelegramMock } from '../e2e/mocks/telegram';
import {
  createScenario,
  type E2ERole,
  type E2EState,
  type ScenarioName,
} from '../e2e/scenarios/data';

/**
 * Тур по интерфейсу: те же моки Telegram и API, что в сквозных тестах, но без
 * диагностических утверждений — задача снять состояние экрана, а не проверить его.
 */

/* Привязка к самому файлу, а не к cwd: тур запускают и из корня репозитория
   (`--config frontend-new/playwright.tour.config.ts`), и оттуда галерея легла бы
   рядом с репозиторием, где её не покрывает `frontend-new/.gitignore` — три
   мегабайта снимков просились в коммит. Через import.meta, а не `__dirname`:
   Playwright грузит эти файлы как ES-модули. */
export const TOUR_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../ui-tour',
);

interface TourFixtures {
  role: E2ERole;
  scenario: ScenarioName;
  theme: 'light' | 'dark';
  api: { state: E2EState };
  app: Page;
}

export const test = base.extend<TourFixtures>({
  role: ['member', { option: true }],
  scenario: ['default', { option: true }],
  theme: ['light', { option: true }],

  api: async ({ context, role, scenario, theme }, use) => {
    const state = createScenario(scenario, role);
    await installTelegramMock(context, {
      initData: state.initData,
      userId: Number(state.user.telegramId),
      colorScheme: theme,
    });
    await installApiMock(context, state);
    if (theme === 'dark') {
      await context.addInitScript(() => window.localStorage.setItem('rl-theme', 'dark'));
    }
    await use({ state });
  },

  app: async ({ page, api: _api }, use) => {
    await page.clock.install({ time: new Date('2026-07-20T09:05:00.000Z') });
    await use(page);
  },
});

/** Даём React Query и анимациям осесть, иначе в кадр попадают скелетоны. */
export async function settle(page: Page, extraMs = 350): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined);
  await page.waitForTimeout(extraMs);
}

/**
 * `name` — путь вида `02-home/03-vote-cast`; каталоги создаются на лету,
 * чтобы галерея группировалась по разделам интерфейса.
 */
export async function shot(page: Page, name: string, extraMs = 350): Promise<void> {
  await settle(page, extraMs);
  const file = path.join(TOUR_DIR, `${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
}

export { expect } from '@playwright/test';
