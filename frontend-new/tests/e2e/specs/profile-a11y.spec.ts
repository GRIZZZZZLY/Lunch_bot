/* Регрессия доступности профиля. Экран весь состоит из строк-кнопок со
   вложенными <span>, и его легко сломать в сторону «кнопка без имени» или
   «текст поверх тинта ниже порога». Проверяем обе темы: тинт в тёмной
   затемняет фон, в светлой осветляет, и провалы воспроизводятся порознь. */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/* Экран входит анимацией: пока она играет, axe читает блёклые промежуточные
   цвета и тест падает не на палитре, а на гонке. Ждём конечные анимации;
   бесконечные (шиммер, спиннер) пропускаем — иначе ожидание не кончится. */
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

test.describe('Доступность: профиль', () => {
  test('@smoke светлая тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/profile');
    await expect(appPage.getByRole('button', { name: /Написать отзыв/ })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });

  test('тёмная тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/profile');
    const appearance = appPage.getByRole('region', { name: 'Оформление' });
    await appearance.getByRole('button', { name: 'Тёмная тема' }).click();
    await expect(appPage.getByRole('button', { name: /Написать отзыв/ })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });

  test('лист реквизитов без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: /СБП/ }).click();
    await expect(appPage.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });
});
