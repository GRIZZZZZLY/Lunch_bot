import { expect, test } from '../fixtures/test';

/* useRouteFocus ставит фокус на <main> при каждой навигации — ради
   скринридера и клавиатуры: после перехода чтение и Tab начинаются с нового
   экрана, а не со ссылки, которая осталась в навигации. Других проверок хука
   нет. */
test.describe('Фокус при смене маршрута', () => {
  test('после перехода с клавиатуры фокус стоит на области контента', async ({ appPage }) => {
    await appPage.goto('/');

    const menuTab = appPage.getByRole('link', { name: /Меню/ });
    await menuTab.focus();
    await appPage.keyboard.press('Enter');

    await expect(menuTab).toHaveAttribute('aria-current', 'page');
    await expect(appPage.locator('main')).toBeFocused();
  });
});
