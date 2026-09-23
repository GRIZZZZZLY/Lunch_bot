/**
 * Перед каждым замером убедиться, что экран — рабочий, а не вход или ошибка.
 *
 * Без этой проверки Lighthouse честно отмерил бы экран авторизации или
 * «Не удалось загрузить» и выдал бы отличные цифры для пустой страницы.
 * Ожидаемое берётся из `backend/src/scripts/e2e-seed.ts`: у Анны в команде А
 * идёт голосование, в меню есть «Борщ E2E», в бюджете — долг Борису.
 *
 * Сигнатура — puppeteerScript из @lhci/cli: браузер тот же, что будет мерить.
 */
const EXPECTED = {
  '/': { selector: '[role="radiogroup"]', what: 'бюллетень идущего голосования' },
  '/menu': { text: 'Борщ E2E', what: 'блюдо из меню команды' },
  '/budget': { text: 'Бюджет команды', what: 'заголовок бюджета' },
};

module.exports = async (browser, context) => {
  const url = new URL(context.url);
  const expected = EXPECTED[url.pathname];
  if (!expected) throw new Error(`Для ${url.pathname} не задан ожидаемый контент`);

  const page = await browser.newPage();
  try {
    /* Не networkidle: поток событий опроса держит соединение открытым. */
    await page.goto(context.url, { waitUntil: 'domcontentloaded' });
    if (expected.selector) {
      await page.waitForSelector(expected.selector, { timeout: 15_000 });
    } else {
      await page.waitForFunction(
        (text) => document.body.innerText.includes(text),
        { timeout: 15_000 },
        expected.text,
      );
    }
  } catch (error) {
    throw new Error(
      `${url.pathname}: не найден ${expected.what} — замер отменён, иначе он мерил бы не тот экран. ${error.message}`,
    );
  } finally {
    await page.close();
  }
};
