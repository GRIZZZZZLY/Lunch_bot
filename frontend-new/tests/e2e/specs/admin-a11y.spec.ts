/* Регрессия доступности админки. Экран управляет людьми, долгами и удалением
   данных, а собран был целиком на инлайн-стилях — то есть без состояний и без
   единой поверхности, где такие вещи проверяются. Проходим по всем вкладкам:
   каждая тянет свою карточку со своими полями и кнопками. */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function expectNoSeriousViolations(page: Page) {
  await settleAnimations(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target.join(' '),
        summary: node.failureSummary,
      })),
    }));
  expect(blocking, 'serious/critical нарушения WCAG').toEqual([]);
}

test.describe('Доступность: админка', () => {
  test.use({ role: 'admin' });

  for (const tab of ['Обзор', 'Люди', 'Долги', 'Очистка', 'Напоминания'] as const) {
    test(`вкладка «${tab}» без serious-нарушений`, async ({ appPage }) => {
      await appPage.goto('/admin');
      await appPage.getByRole('tab', { name: tab }).click();
      await expect(appPage.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
      await expectNoSeriousViolations(appPage);
    });
  }
});
