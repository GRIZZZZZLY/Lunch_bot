import { expect, test } from '../fixtures/test';

/* useRouteFocus ставит фокус на <main> при каждой навигации — ради
   скринридера и клавиатуры. Браузер в ответ рисует вокруг него своё кольцо, а
   так как бокс <main> выше экрана, от кольца видна одна верхняя грань: полоса
   во всю ширину под шапкой. Гасит её правило в styles/motion.css. */
test.describe('Фокус при смене маршрута', () => {
  test('не оставляет кольцо фокуса вокруг области контента', async ({ appPage }) => {
    await appPage.goto('/');

    const menuTab = appPage.getByRole('link', { name: /Меню/ });

    /* Переход именно клавишей, а не касанием, и это не придирка к сценарию:
       после касания Chromium программный фокус «видимым» не считает и кольца
       не рисует вовсе — такой тест не смог бы упасть и без правки. Клавиша
       переводит эвристику :focus-visible в состояние, где кольцо появляется. */
    await menuTab.focus();
    await appPage.keyboard.press('Enter');

    await expect(menuTab).toHaveAttribute('aria-current', 'page');

    const state = await appPage.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      return {
        focused: document.activeElement === main,
        focusVisible: main.matches(':focus-visible'),
        outlineStyle: getComputedStyle(main).outlineStyle,
      };
    });

    /* Сначала убеждаемся, что состояние вообще то самое: main сфокусирован и
       браузер считает фокус видимым. Без этих двух проверок тест зеленел бы
       просто потому, что кольцу неоткуда взяться. */
    expect(state).not.toBeNull();
    expect(state?.focused).toBe(true);
    expect(state?.focusVisible).toBe(true);

    expect(state?.outlineStyle).toBe('none');
  });
});
