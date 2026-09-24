import { createHmac } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { installTelegramMock } from '../mocks/telegram';

const integrationEnabled = process.env.E2E_INTEGRATION === '1';
const botToken = process.env.E2E_BOT_TOKEN || '777000:test_e2e_bot_token';

/** Люди из `backend/src/scripts/e2e-seed.ts`. */
const ANNA = { id: 700000101, first_name: 'Анна', last_name: 'Тестова', username: 'anna_e2e' };
const BORIS = { id: 700000102, first_name: 'Борис', last_name: 'Сборов', username: 'boris_e2e' };
type SeedUser = typeof ANNA;

function signedInitData(user: SeedUser = ANNA): string {
  const params = new URLSearchParams({
    query_id: 'e2e-real-server',
    user: JSON.stringify({ ...user, language_code: 'ru' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

/** Плашка текущей команды в шапке вкладок. */
const teamTrigger = (page: Page, title: string) =>
  page.getByRole('button', { name: `Команда: ${title}. Сменить` });

/** Смена команды из шторки «Команды»; выбор оставляет человека в меню. */
async function switchTeamOnMenu(page: Page, from: string, to: string) {
  await teamTrigger(page, from).click();
  await page.getByRole('radio', { name: to }).click();
  await expect(page).toHaveURL(/\/menu$/);
}

test.describe('Настоящий сервер и тестовая PostgreSQL', () => {
  test.skip(!integrationEnabled, 'Запускается только с E2E_INTEGRATION=1 после безопасного seed');

  test.beforeEach(async ({ context }) => {
    await installTelegramMock(context, { initData: signedInitData(), userId: 700000101 });
  });

  test('@integration health/readiness и договор ошибки авторизации', async ({ request }) => {
    const health = await request.get('/health/ready');
    expect(health.ok()).toBe(true);
    const payload = await health.json();
    expect(payload).toEqual({ ready: true });

    const unauthorized = await request.get('/api/user/groups');
    expect(unauthorized.status()).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      success: false,
      code: expect.any(String),
    });
  });

  /**
   * Тестовый пользователь состоит в двух командах (см. `backend/src/scripts/
   * e2e-seed.ts`), поэтому в шапке появляется плашка команды, и название
   * команды встречается дважды — в подписи шапки и на плашке.
   *
   * Проверяем плашку ТЕКУЩЕЙ команды, а не просто наличие текста: так
   * утверждение говорит не «название где-то есть», а «открыта именно эта
   * команда».
   */
  test('@integration входит через подписанный initData и читает seeded menu', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/menu');
    await expect(teamTrigger(page, 'Команда E2E')).toBeVisible();
    await expect(page.getByText('Борщ E2E')).toBeVisible();
    await expect(page.getByText('Паста E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить блюдо' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  /**
   * Переключение команды: меню обязано смениться вместе с ней.
   *
   * Запрос меню долго шёл под общим ключом `['menu']` со сроком свежести
   * 30 секунд. После переключения команды экран показывал прежнее меню, а на
   * Главной это стоило дороже всего: у нового опроса пропадали варианты
   * ответа, потому что их блюда не находились в чужом меню.
   */
  test('@integration главная A → переключение на B → меню команды B', async ({ page }) => {
    await page.goto('/menu');
    await expect(teamTrigger(page, 'Команда E2E')).toBeVisible();
    await expect(page.getByText('Борщ E2E')).toBeVisible();

    await switchTeamOnMenu(page, 'Команда E2E', 'Команда Б E2E');

    await expect(teamTrigger(page, 'Команда Б E2E')).toBeVisible();
    // Блюдо команды Б появилось, блюда команды А ушли.
    await expect(page.getByText('Плов Б E2E')).toBeVisible();
    await expect(page.getByText('Борщ E2E')).toHaveCount(0);
    await expect(page.getByText('Паста E2E')).toHaveCount(0);

    /* Обратно — тоже без остатков: кэш обеих команд должен быть свой.
       Возврат отдельным шагом, потому что именно на нём проявлялся общий
       ключ: данные уже лежали в кэше и отдавались как актуальные. */
    await switchTeamOnMenu(page, 'Команда Б E2E', 'Команда E2E');
    await expect(page.getByText('Борщ E2E')).toBeVisible();
    await expect(page.getByText('Плов Б E2E')).toHaveCount(0);
  });

  /**
   * Групповая изоляция на живом экране: меню соседней команды не должно
   * просачиваться в открытую. `PRODUCT.md` называет такое смешение
   * критической ошибкой, а не косметикой.
   */
  test('@integration меню чужой команды не видно в открытой', async ({ page }) => {
    await page.goto('/menu');
    await expect(teamTrigger(page, 'Команда E2E')).toBeVisible();
    await expect(page.getByText('Борщ E2E')).toBeVisible();
    await expect(page.getByText('Плов Б E2E')).toHaveCount(0);

    // Соседняя команда предлагается в шторке, а её блюдо на экране не показано.
    await teamTrigger(page, 'Команда E2E').click();
    await expect(page.getByRole('radio', { name: 'Команда Б E2E' })).toBeVisible();
    await expect(page.getByText('Плов Б E2E')).toHaveCount(0);

    // Команда, в которой пользователя нет, не предлагается вовсе.
    await expect(page.getByRole('radio', { name: 'Команда В E2E' })).toHaveCount(0);
  });
});

/**
 * Второй человек — свой браузерный контекст со своей подписью initData.
 *
 * `browser.newContext()` не наследует настройки проекта, поэтому адрес и
 * размер экрана передаются явно.
 */
async function openAs(browser: Browser, user: SeedUser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
  });
  await installTelegramMock(context, { initData: signedInitData(user), userId: user.id });
  return context.newPage();
}

/** Сделать команду А текущей через ссылку «Открыть меню группы». */
async function openTeamA(page: Page): Promise<void> {
  await page.goto('/?groupId=-100000000001');
  await expect(page).toHaveURL(/\/menu$/);
}

/**
 * Целые сценарии двух людей на настоящем сервере: каждый видит последствия
 * действий другого, и состояние проверяется новым чтением, а не тостом.
 */
test.describe('Два человека на настоящем сервере', () => {
  test.skip(!integrationEnabled, 'Запускается только с E2E_INTEGRATION=1 после безопасного seed');
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ context }) => {
    await installTelegramMock(context, { initData: signedInitData(ANNA), userId: ANNA.id });
  });

  test('@integration долг: Анна отмечает оплату, Борис подтверждает', async ({ page, browser }) => {
    await page.goto('/budget');
    await page.getByRole('button', { name: /^Отметить/ }).click();
    await expect(page.getByText('Отмечено как оплачено. Ждём подтверждения.')).toBeVisible();

    const boris = await openAs(browser, BORIS);
    await openTeamA(boris);
    await boris.goto('/budget');
    await boris.getByRole('button', { name: /^Подтвердить/ }).click();
    await boris.getByRole('alertdialog').getByRole('button', { name: 'Подтвердить' }).click();
    await expect(boris.getByText('Все рассчитались')).toBeVisible();
    /* Подтверждение сохранено: после перечитывания его можно отменить. */
    await boris.reload();
    await expect(boris.getByRole('heading', { name: 'Подтверждено сегодня' })).toBeVisible();

    /* Анна узнаёт о подтверждении новым чтением с сервера. */
    await page.reload();
    await expect(page.getByText('Долг закрыт')).toBeVisible();
    await expect(page.getByText('оплата подтверждена сборщиком')).toBeVisible();
    await boris.context().close();
  });

  /* Опрос заведён сценарием данных: создание из приложения требует бота,
     которого у сервера в роли api нет (объявление опроса в группе). */
  test('@integration опрос: голоса двоих, завершение, итог', async ({ page, browser }) => {
    await page.goto('/');
    await expect(page.getByRole('radiogroup')).toBeVisible();

    const boris = await openAs(browser, BORIS);
    await openTeamA(boris);
    await boris.goto('/');
    await boris.getByRole('radio', { name: /Паста E2E/ }).click();
    await expect(boris.getByText('Голос учтён')).toBeVisible();

    /* Голос Анны — последний из ожидаемых: опрос закрывается сам. Анна
       видит победителя без перезагрузки — раньше строка победителя
       показывала прошлый опрос, пока экран не перечитают. */
    await page.getByRole('radio', { name: /Паста E2E/ }).click();
    await expect(page.getByText(/Победил.*Паста E2E/)).toBeVisible();

    /* Итог видит и Борис. */
    await boris.reload();
    await expect(boris.getByText(/Победил.*Паста E2E/)).toBeVisible();
    await boris.context().close();
  });

  test('@integration закупка: сбор, покупка с ценой, расчёт, долг участника', async ({ page, browser }) => {
    /* Сбор открыт Борисом в команде Б (сценарий данных: открыть его из
       приложения требует бота). Анна находит его на главной команды Б. */
    await page.goto('/?groupId=-100000000002');
    await expect(page).toHaveURL(/\/menu$/);
    await page.goto('/');
    await page.getByText('Лента сбор E2E').click();
    await expect(page).toHaveURL(/\/store-run\/\d+$/);
    const runId = new URL(page.url()).pathname.split('/').pop();

    await page.getByRole('button', { name: 'Добавить позицию' }).first().click();
    const add = page.getByRole('dialog');
    const newTab = add.getByRole('tab', { name: 'Новая' });
    if (await newTab.count()) await newTab.click();
    await add.getByRole('textbox', { name: 'Что купить' }).fill('Молоко E2E');
    await add.getByRole('textbox', { name: 'Количество' }).fill('2');
    await add.getByRole('button', { name: 'Добавить' }).click();
    await expect(page.getByText('Молоко E2E')).toBeVisible();

    /* Борис приходит по кнопке «Заказать» из чата, закрывает сбор, покупает,
       ставит цену и рассчитывает. */
    const boris = await openAs(browser, BORIS);
    await boris.goto(`/?storeRunId=${runId}`);
    await expect(boris).toHaveURL(new RegExp(`/store-run/${runId}$`));
    await boris.getByRole('button', { name: 'Закрыть сбор' }).click();
    await boris.getByRole('alertdialog').getByRole('button', { name: 'Закрыть сбор' }).click();
    await boris.getByRole('button', { name: 'Куплено: Молоко E2E' }).click();
    await boris.getByRole('button', { name: 'Указать цену: Молоко E2E' }).click();
    await boris.getByRole('textbox', { name: /Цена за всё/ }).fill('199,90');
    await boris.getByRole('button', { name: 'Сохранить' }).click();
    await boris.getByRole('button', { name: 'Рассчитать' }).click();
    await expect(boris.getByText(/Итого закупки/)).toBeVisible();

    /* У Анны — долг ровно на цену позиции, в команде Б. */
    await page.goto('/budget');
    await expect(page.getByText(/199,90\s?₽/).first()).toBeVisible();
    await boris.context().close();
  });
});
