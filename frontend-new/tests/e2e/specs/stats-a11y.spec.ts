/* Регрессия доступности статистики. Экран целиком читаемый: ни одной кнопки,
   зато полосы-диаграммы, которые легко оставить без текстовой альтернативы —
   тогда весь смысл страницы существует только в пикселях. */
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

test.describe('Доступность: статистика', () => {
  test('@smoke светлая тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/stats');
    await expect(appPage.getByRole('region', { name: 'Ваше участие' })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });

  test('тёмная тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/profile');
    const appearance = appPage.getByRole('region', { name: 'Оформление' });
    await appearance.getByRole('button', { name: 'Тёмная тема' }).click();
    await appPage.goto('/stats');
    await expect(appPage.getByRole('region', { name: 'Ваше участие' })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });
});
