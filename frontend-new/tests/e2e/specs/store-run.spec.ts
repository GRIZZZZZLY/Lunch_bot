import { expect, test } from '../fixtures/test';
import { USERS } from '../scenarios/data';

test.describe('Создание закупки', () => {
  test('@smoke создаёт закупку с главной и открывает её', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: /Новая закупка в магазине/ }).click();
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
    await add.getByRole('button', { name: 'Добавить' }).click();
    await expect(add.getByText('Укажите название')).toBeVisible();
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
    await expect(dialog.getByText('Закрыть сбор досрочно?')).toBeVisible();
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
    await expect(appPage.getByText('Закупка отменена инициатором.')).toBeVisible();
    expect(api.requests('POST', '/store-runs/601/cancel')).toHaveLength(1);
  });

  test('не позволяет закрыть пустой сбор', async ({ appPage, api }) => {
    api.state.storeRuns[0].items = [];
    await appPage.goto('/store-run/601');
    await expect(appPage.getByText('Пока пусто')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Закрыть сбор' })).toBeDisabled();
    await expect(appPage.getByRole('button', { name: 'Отменить закупку' })).toBeEnabled();
  });

  test('истёкший сбор показывает переходное состояние и запрашивает свежий статус', async ({ appPage, api }) => {
    api.state.storeRuns[0].collectUntil = '2026-07-20T09:04:00.000Z';
    await appPage.goto('/store-run/601');
    await expect(appPage.getByText('Сбор закрывается…')).toBeVisible();
    await expect.poll(() => api.requests('GET', '/store-runs/601').length).toBeGreaterThan(1);
  });
});

test.describe('Закупка: покупки инициатора', () => {
  test.use({ scenario: 'store-shopping', role: 'storeInitiator' });

  test('принимает нулевую цену, показывает количество и отмечает отсутствие', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Куплено' }).click();
    const price = appPage.getByRole('textbox', { name: 'Цена за всё (×2), ₽' });
    await price.fill('0');
    await appPage.getByRole('button', { name: 'Сохранить' }).click();
    expect(api.lastRequest('POST', '/store-runs/601/items/701/price')?.body).toEqual({
      price: 0,
      status: 'BOUGHT',
    });
    await expect(appPage.getByText(/0\s?₽/).first()).toBeVisible();

    await appPage.getByRole('button', { name: 'Не нашли' }).first().click();
    expect(api.requests('POST', '/store-runs/601/items/701/price')).toHaveLength(2);
    await expect(appPage.getByText('Не нашли').first()).toBeVisible();
  });

  test('предупреждает о необработанных позициях перед расчётом', async ({ appPage, api }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Рассчитать' }).click();
    const dialog = appPage.getByRole('alertdialog');
    await expect(dialog).toContainText('позиция не обработана');
    await dialog.getByRole('button', { name: 'Рассчитать без них' }).click();
    await expect(appPage.getByText(/Итого закупки/)).toBeVisible();
    expect(api.requests('POST', '/store-runs/601/settle')).toHaveLength(1);
  });

  test('не разрешает расчёт купленной позиции без цены', async ({ appPage, api }) => {
    api.state.storeRuns[0].items[1].price = null;
    await appPage.goto('/store-run/601');
    await expect(appPage.getByText(/не указана цена/)).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });

  test('не принимает отрицательную или пустую цену', async ({ appPage }) => {
    await appPage.goto('/store-run/601');
    await appPage.getByRole('button', { name: 'Куплено' }).click();
    const price = appPage.getByRole('textbox', { name: 'Цена за всё (×2), ₽' });
    await price.fill('-1');
    await appPage.getByRole('button', { name: 'Сохранить' }).click();
    await expect(appPage.getByText('Введите цену (0 и больше)')).toBeVisible();
    await expect(price).toHaveValue('-1');
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

  test.describe('отменено', () => {
    test.use({ scenario: 'store-cancelled', role: 'storeParticipant' });
    test('показывает причину и только историю', async ({ appPage }) => {
      await appPage.goto('/store-run/601');
      await expect(appPage.getByText('Закупка отменена инициатором.')).toBeVisible();
      await expect(appPage.getByRole('button', { name: /Изменить|Удалить|Добавить позицию/ })).toHaveCount(0);
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

  test.describe('не найдено', () => {
    test.use({ scenario: 'store-not-found' });
    test('различает 404 и неверный идентификатор', async ({ appPage }) => {
      await appPage.goto('/store-run/999');
      await expect(appPage.getByText('Не найдено')).toBeVisible();
      await appPage.goto('/store-run/not-a-number');
      await expect(appPage.getByText('Не найдено')).toBeVisible();
    });
  });

  test.describe('сетевая ошибка', () => {
    test.use({ scenario: 'store-collecting' });
    test('повторяет сетевой запрос', async ({ appPage, api }) => {
      api.fail('GET', '/store-runs/601', {
        status: 500,
        error: 'Сеть недоступна',
        code: 'NETWORK_ERROR',
      });
      await appPage.goto('/store-run/601');
      await expect(appPage.getByText('Не удалось загрузить')).toBeVisible();
      api.clearFailure('GET', '/store-runs/601');
      await appPage.getByRole('button', { name: 'Повторить' }).click();
      await expect(appPage.getByText('Пятёрочка у офиса')).toBeVisible();
    });
  });
});
