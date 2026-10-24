import { expect, test } from '../fixtures/test';
import { USERS } from '../scenarios/data';

test.describe('Создание закупки', () => {
  test('@smoke создаёт закупку с главной и открывает её', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: /Закупка в магазине/ }).click();
    const dialog = appPage.getByRole('dialog', { name: 'Новая закупка' });
    await expect(dialog.getByRole('button', { name: 'Открыть сбор' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Откуда заказываем' }).fill('Лента у метро');
    await dialog.getByRole('button', { name: '15 мин' }).click();
    await dialog.getByRole('button', { name: 'Открыть сбор' }).click();
    expect(api.lastRequest('POST', '/store-runs')?.body).toEqual({
      groupId: 1,
      storeName: 'Лента у метро',
      collectMinutes: 15,
    });
    await expect(appPage).toHaveURL('/store-run/602');
    await expect(appPage.getByText('Лента у метро')).toBeVisible();
  });

  test('выбор магазина из подсказок уходит идентификатором', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: /Закупка в магазине/ }).click();
    const dialog = appPage.getByRole('dialog', { name: 'Новая закупка' });

    await dialog.getByRole('button', { name: 'Магнит на Ленина' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Откуда заказываем' })).toHaveValue(
      'Магнит на Ленина',
    );
    await dialog.getByRole('button', { name: 'Открыть сбор' }).click();

    /* Имя не дублируется в теле: источник истины — запись справочника, и
       сервер подставляет её название сам. */
    expect(api.lastRequest('POST', '/store-runs')?.body).toEqual({
      groupId: 1,
      storeId: 902,
      collectMinutes: 30,
    });
    await expect(appPage.getByText('Магнит на Ленина')).toBeVisible();
  });
});

test.describe('Закупка: сбор позиций', () => {
  test.use({ scenario: 'store-collecting', role: 'storeParticipant' });

  test('участник добавляет, изменяет и удаляет только свою позицию', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await expect(appPage.getByText('Мои позиции')).toBeVisible();
    await expect(appPage.getByLabel('Изменить «Молоко 3,2%»')).toBeVisible();
    await expect(appPage.getByLabel('Изменить «Хлеб бородинский»')).toHaveCount(0);
    await expect(appPage.getByRole('button', { name: 'Закрыть сбор' })).toHaveCount(0);

    await appPage.getByLabel('Изменить «Молоко 3,2%»').click();
    const edit = appPage.getByRole('dialog');
    await edit.getByRole('textbox', { name: 'Что купить' }).fill('Кефир 2,5%');
    await edit.getByRole('button', { name: 'Сохранить' }).click();
    await expect(appPage.getByText('Кефир 2,5%')).toBeVisible();
    expect(api.lastRequest('PATCH', '/store-runs/601/items/701')?.body).toMatchObject({
      name: 'Кефир 2,5%',
      quantity: 2,
    });

    await appPage.getByRole('button', { name: 'Добавить позицию' }).click();
    const add = appPage.getByRole('dialog');
    /* Шторка открывается на личном списке товаров: ручной ввод переехал на
       вторую вкладку. */
    await add.getByRole('tab', { name: 'Новая' }).click();
    await add.getByRole('button', { name: 'Добавить' }).click();
    await expect(add.getByRole('textbox', { name: 'Что купить' })).toHaveAttribute('aria-invalid', 'true');
    expect(api.requests('POST', '/store-runs/601/items')).toHaveLength(0);
    await add.getByRole('textbox', { name: 'Что купить' }).fill('Яблоки');
    await add.getByRole('textbox', { name: 'Количество' }).fill('3');
    await add.getByRole('button', { name: 'Добавить' }).click();
    await expect(appPage.getByText('Яблоки')).toBeVisible();
    expect(api.lastRequest('POST', '/store-runs/601/items')?.body).toEqual({
      items: [{ name: 'Яблоки', quantity: 3 }],
    });

    await appPage.getByLabel('Удалить «Кефир 2,5%»').click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
    await expect(appPage.getByText('Кефир 2,5%')).toHaveCount(0);
  });

  test('добавляет сохранённые товары одним запросом', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Добавить позицию' }).click();
    const add = appPage.getByRole('dialog');

    /* Уже заказанное молоко помечено и выбору не подлежит: повторный выбор дал
       бы молчаливый дубль в списке. */
    await expect(add.getByText('уже в списке')).toBeVisible();
    await expect(add.getByRole('checkbox', { name: 'Выбрать Молоко 3,2%' })).toHaveCount(0);

    await add.getByRole('checkbox', { name: 'Выбрать Кофе в зёрнах' }).click();
    await add.getByRole('button', { name: 'Добавить 1' }).click();

    expect(api.lastRequest('POST', '/store-runs/601/items')?.body).toEqual({
      items: [{ name: 'Кофе в зёрнах', quantity: 1 }],
    });
    await expect(appPage.getByText('Кофе в зёрнах')).toBeVisible();
  });
});

test.describe('Закупка: действия инициатора', () => {
  test.use({ scenario: 'store-collecting', role: 'storeInitiator' });

  test('закрывает сбор только после подтверждения', async ({ appPage, api }) => {
    api.state.storeRuns[0].items[1] = {
      ...api.state.storeRuns[0].items[1],
      userId: USERS.initiator.id,
      user: USERS.initiator,
    };
    await appPage.goto('/store-run/601');
    await expect(appPage.getByLabel('Изменить «Хлеб бородинский»')).toHaveCount(0);
    await appPage.getByRole('button', { name: 'Закрыть сбор' }).click();
    const dialog = appPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    expect(api.requests('POST', '/store-runs/601/start-shopping')).toHaveLength(0);
    await appPage.getByRole('button', { name: 'Закрыть сбор' }).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Закрыть сбор' }).click();
    await expect(appPage.getByText('В магазине')).toBeVisible();
  });

  test('отменяет закупку после подтверждения', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Отменить закупку' }).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Отменить закупку' }).click();
    await expect.poll(() => api.requests('POST', '/store-runs/601/cancel').length).toBe(1);
    await expect(appPage.getByRole('button', { name: /Отменить закупку|Закрыть сбор/ })).toHaveCount(0);
  });
});

test.describe('Закупка: покупки инициатора', () => {
  test.use({ scenario: 'store-shopping', role: 'storeInitiator' });

  test('отмечает покупку одним касанием, затем принимает нулевую цену и отсутствие', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');

    // одно касание — позиция уже куплена, цена ещё не нужна
    await appPage.getByRole('button', { name: 'Куплено: Молоко 3,2%' }).click();
    expect(api.lastRequest('POST', '/store-runs/601/items/701/price')?.body).toEqual({
      price: null,
      status: 'BOUGHT',
    });
    await expect(appPage.getByText('цена не указана')).toBeVisible();

    await appPage.getByRole('button', { name: 'Указать цену: Молоко 3,2%' }).click();
    const price = appPage.getByRole('textbox', { name: 'Цена за всё (×2), ₽' });
    await price.fill('0');
    await appPage.getByRole('button', { name: 'Сохранить' }).click();
    expect(api.lastRequest('POST', '/store-runs/601/items/701/price')?.body).toEqual({
      price: 0,
      status: 'BOUGHT',
    });
    await expect(appPage.getByText(/0\s?₽/).first()).toBeVisible();

    // у купленной позиции цена уже введена — сброс идёт через подтверждение
    await appPage.getByRole('button', { name: 'Не нашли: Молоко 3,2%' }).click();
    const resetPrice = appPage.getByRole('alertdialog');
    await expect(resetPrice).toContainText('Молоко 3,2%');
    expect(api.requests('POST', '/store-runs/601/items/701/price')).toHaveLength(2);
    await resetPrice.getByRole('button', { name: 'Не нашли' }).click();
    expect(api.requests('POST', '/store-runs/601/items/701/price')).toHaveLength(3);
    await expect(appPage.getByText('Не нашли').first()).toBeVisible();
  });

  test('предупреждает о необработанных позициях перед расчётом', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Рассчитать' }).click();
    const dialog = appPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    expect(api.requests('POST', '/store-runs/601/settle')).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Рассчитать без них' }).click();
    await expect(appPage.getByText(/Итого закупки/)).toBeVisible();
    expect(api.requests('POST', '/store-runs/601/settle')).toHaveLength(1);
  });

  /* Кнопка не гаснет, а ведёт к незакрытому шагу: заблокированная primary была
     тупиком, из которого не видно, чем она занята. */
  test('вместо расчёта открывает цену у купленной позиции без цены', async ({ appPage, api }) => {
    api.state.storeRuns[0].items[1].price = null;
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Рассчитать' }).click();

    await expect(appPage.getByRole('textbox', { name: /Цена за всё/ })).toBeVisible();
    expect(api.requests('POST', '/store-runs/601/settle')).toHaveLength(0);
  });
});

test.describe('Закупка: чтение участником и конечные состояния', () => {
  test.describe('в магазине', () => {
    test.use({ scenario: 'store-shopping', role: 'storeParticipant' });
    test('участник видит сумму, но не может менять покупки', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByText(/Ваша текущая сумма/)).toBeVisible();
      await expect(appPage.getByRole('button', { name: 'Куплено' })).toHaveCount(0);
      await expect(appPage.getByRole('button', { name: 'Рассчитать' })).toHaveCount(0);
    });
  });

  test.describe('рассчитано', () => {
    test.use({ scenario: 'store-settled', role: 'storeParticipant' });
    test('показывает итог без управляющих действий и возвращает на главную', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByText(/Ваша часть/)).toBeVisible();
      await expect(appPage.getByRole('button', { name: /Куплено|Рассчитать|Добавить позицию/ })).toHaveCount(0);
      await appPage.getByRole('button', { name: 'На главную' }).click();
      await expect(appPage).toHaveURL(/\/$/);
    });
  });
});

test.describe('Закупка: ошибки маршрута', () => {
  test.describe('нет доступа', () => {
    test.use({ scenario: 'store-forbidden' });
    test('различает 403 и не предлагает повтор', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByText('Нет доступа')).toBeVisible();
      await expect(appPage.getByRole('button', { name: 'Повторить' })).toHaveCount(0);
    });
  });
});
