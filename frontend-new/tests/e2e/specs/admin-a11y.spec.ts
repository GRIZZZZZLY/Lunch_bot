/* Регрессия доступности админки. Экран управляет людьми, долгами и удалением
   данных, а собран был целиком на инлайн-стилях — то есть без состояний и без
   единой поверхности, где такие вещи проверяются. Проходим по всем вкладкам:
   каждая тянет свою карточку со своими полями и кнопками. */
import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';

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
