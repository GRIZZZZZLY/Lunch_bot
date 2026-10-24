import { expect, test, toasts } from '../fixtures/test';

test.describe('Меню участника', () => {
  test('ищет блюда, фильтрует категории и не видит управление', async ({ appPage }) => {
    await appPage.goto('/menu');
    await expect(appPage.getByText('Борщ со сметаной')).toBeVisible();
    await expect(appPage.getByLabel('Изменить «Борщ со сметаной»')).toHaveCount(0);

    await appPage.getByRole('button', { name: /Супы/ }).click();
    await expect(appPage.getByText('Борщ со сметаной')).toBeVisible();
    await expect(appPage.getByText('Паста карбонара')).toHaveCount(0);

    await appPage.getByRole('button', { name: /Все/ }).click();
    await expect(appPage.getByText('Паста карбонара')).toBeVisible();
    await appPage.getByRole('textbox', { name: 'Поиск блюд' }).fill('несуществующее');
    await expect(appPage.getByText('Борщ со сметаной')).toHaveCount(0);
    await expect(appPage.getByText('Паста карбонара')).toHaveCount(0);
  });
});

test.describe('Управление меню', () => {
  test.use({ role: 'admin' });

  test('@smoke добавляет блюдо и проверяет тело запроса', async ({ appPage, api }) => {
    await appPage.goto('/menu');
    await appPage.getByRole('button', { name: 'Добавить блюдо' }).click();
    const sheet = appPage.getByRole('dialog', { name: 'Добавить блюдо' });
    await expect(sheet.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    await sheet.getByRole('textbox', { name: 'Название' }).fill('Поке с лососем');
    await sheet.getByRole('textbox', { name: 'Цена, ₽' }).fill('610');
    await sheet.getByRole('textbox', { name: 'Категория' }).fill('Поке');
    await sheet.getByRole('button', { name: 'Сохранить' }).click();

    // exact: иначе локатор ловит и строку списка, и текст тоста «Блюдо «…»
    // добавлено» — совпадение зависело от того, успел ли тост погаснуть.
    await expect(appPage.getByText('Поке с лососем', { exact: true })).toBeVisible();
    expect(api.lastRequest('POST', '/menu')?.body).toMatchObject({
      name: 'Поке с лососем',
      price: 610,
      category: 'Поке',
      groupIds: [1],
    });
  });

  test('скрывает и изменяет блюдо', async ({ appPage, api }) => {
    await appPage.goto('/menu');
    await appPage.getByLabel('Скрыть «Борщ со сметаной»').click();
    expect(api.requests('PATCH', '/menu/11/toggle')).toHaveLength(1);
    await expect(appPage.getByText('Скрыто').first()).toBeVisible();

    await appPage.getByLabel('Изменить «Борщ со сметаной»').click();
    const sheet = appPage.getByRole('dialog', { name: 'Изменить блюдо' });
    await sheet.getByRole('textbox', { name: 'Название' }).fill('Борщ домашний');
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(appPage.getByText('Борщ домашний')).toBeVisible();
    expect(api.lastRequest('PUT', '/menu/11')?.body).toMatchObject({ name: 'Борщ домашний' });
  });

  test('отменяет удаление, затем подтверждает его', async ({ appPage, api }) => {
    await appPage.goto('/menu');
    await appPage.getByLabel('Изменить «Паста карбонара»').click();
    await appPage.getByRole('button', { name: 'Удалить блюдо' }).click();
    const confirm = appPage.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Отмена' }).click();
    expect(api.requests('DELETE', '/menu/12')).toHaveLength(0);

    await appPage.getByRole('button', { name: 'Удалить блюдо' }).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
    await expect(appPage.getByText('Паста карбонара')).toHaveCount(0);
    expect(api.requests('DELETE', '/menu/12')).toHaveLength(1);
  });

  test('при ошибке сохранения сообщает о ней, сохраняет введённые данные и не повторяет запрос сам', async ({ appPage, api }) => {
    api.fail('POST', '/menu', {
      status: 500,
      error: 'Не удалось сохранить блюдо',
      code: 'INTERNAL_ERROR',
    });
    await appPage.goto('/menu');
    await appPage.getByRole('button', { name: 'Добавить блюдо' }).click();
    const sheet = appPage.getByRole('dialog', { name: 'Добавить блюдо' });
    await sheet.getByRole('textbox', { name: 'Название' }).fill('Ризотто');
    await sheet.getByRole('textbox', { name: 'Цена, ₽' }).fill('550');
    await sheet.getByRole('button', { name: 'Сохранить' }).click();
    await expect(toasts(appPage)).toHaveCount(1);
    await expect(sheet.getByRole('textbox', { name: 'Название' })).toHaveValue('Ризотто');
    expect(api.requests('POST', '/menu')).toHaveLength(1);
  });
});

