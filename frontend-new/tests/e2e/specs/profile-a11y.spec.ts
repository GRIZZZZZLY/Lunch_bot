/* Регрессия доступности профиля. Экран весь состоит из строк-кнопок со
   вложенными <span>, и его легко сломать в сторону «кнопка без имени» или
   «текст поверх тинта ниже порога». Проверяем обе темы: тинт в тёмной
   затемняет фон, в светлой осветляет, и провалы воспроизводятся порознь. */
import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';

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
