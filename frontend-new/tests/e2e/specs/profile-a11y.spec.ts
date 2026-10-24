/* Регрессия доступности профиля. Экран весь состоит из строк-кнопок со
   вложенными <span>, и его легко сломать в сторону «кнопка без имени» или
   «текст поверх тинта ниже порога». Контраст тинта в тёмной теме проверяет
   money-a11y.spec.ts на денежных экранах. */
import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';

test.describe('Доступность: профиль', () => {
  test('@smoke светлая тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/profile');
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
