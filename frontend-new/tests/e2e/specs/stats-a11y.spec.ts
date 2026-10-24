/* Регрессия доступности статистики. Экран целиком читаемый: ни одной кнопки,
   зато полосы-диаграммы, которые легко оставить без текстовой альтернативы —
   тогда весь смысл страницы существует только в пикселях. */
import { expect, test } from '../fixtures/test';
import { expectNoSeriousViolations } from '../fixtures/a11y';

test.describe('Доступность: статистика', () => {
  test('@smoke светлая тема без serious-нарушений', async ({ appPage }) => {
    await appPage.goto('/stats');
    await expect(appPage.getByRole('region', { name: 'Ваше участие' })).toBeVisible();
    await expectNoSeriousViolations(appPage);
  });
});
