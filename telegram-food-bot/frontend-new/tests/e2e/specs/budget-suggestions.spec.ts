import { expect, test } from '../fixtures/test';

test.describe('Бюджет и долги', () => {
  test('@smoke показывает пустое состояние без ложных действий', async ({ appPage }) => {
    await appPage.goto('/budget');
    await expect(appPage.getByText('Нет активных расчётов')).toBeVisible();
    await expect(appPage.getByRole('button')).toHaveCount(0);
  });

  test.describe('должник', () => {
    test.use({ scenario: 'budget-debtor', role: 'debtor' });

    test('отмечает оплату и может отменить отметку', async ({ appPage, api }) => {
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: 'Оплатил' }).click();
      expect(api.lastRequest('POST', '/budget/mark-paid')?.body).toEqual({ transactionId: 801 });
      await expect(appPage.getByText('Отмечено как оплачено. Ждём подтверждения.')).toBeVisible();
      const markedDebt = appPage
        .getByText('420 ₽ · ждёт подтверждения', { exact: true })
        .locator('../..');
      await markedDebt.getByRole('button', { name: 'Отменить' }).click();
      expect(api.lastRequest('POST', '/budget/cancel-mark')?.body).toEqual({ transactionId: 801 });
      await expect(appPage.getByText('Отметка снята')).toBeVisible();
    });

    test('сохраняет состояние и сообщает об ошибке оплаты', async ({ appPage, api }) => {
      api.fail('POST', '/budget/mark-paid', { status: 403, error: 'Операция запрещена', code: 'FORBIDDEN' });
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: 'Оплатил' }).click();
      await expect(appPage.getByText('Не удалось отметить оплату')).toBeVisible();
      await expect(appPage.getByRole('button', { name: 'Оплатил' })).toBeVisible();
    });
  });

  test.describe('ответственный', () => {
    test.use({ scenario: 'budget-responsible', role: 'responsible' });

    test('подтверждает оплату и завершает расчёт', async ({ appPage, api }) => {
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: 'Подтвердить' }).click();
      expect(api.lastRequest('POST', '/budget/confirm-payment')?.body).toEqual({ transactionId: 803 });
      await expect(appPage.getByText('Все рассчитались')).toBeVisible();
    });

    test('отправляет напоминание ожидающему должнику', async ({ appPage, api }) => {
      api.state.credits[0].status = 'PENDING';
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: 'Напомнить' }).click();
      expect(api.lastRequest('POST', '/budget/send-reminder')?.body).toEqual({ transactionId: 803 });
      await expect(appPage.getByText('Напоминание отправлено')).toBeVisible();
    });
  });
});

test.describe('Предложения участника', () => {
  test.use({ scenario: 'suggestions', role: 'member' });

  test('@smoke создаёт предложение с проверкой формы', async ({ appPage, api }) => {
    await appPage.goto('/suggestions');
    await appPage.getByRole('button', { name: 'Предложить блюдо' }).last().click();
    const dialog = appPage.getByRole('dialog', { name: 'Предложить блюдо' });
    await expect(dialog.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Название' }).fill('Рамен с мисо');
    await dialog.getByRole('textbox', { name: /Примерная цена/ }).fill('-1');
    await expect(dialog.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: /Примерная цена/ }).fill('490,50');
    await dialog.getByRole('button', { name: 'Отправить' }).click();
    await expect(appPage.getByText('Рамен с мисо')).toBeVisible();
    expect(api.lastRequest('POST', '/suggestions')?.body).toMatchObject({
      name: 'Рамен с мисо',
      price: 490.5,
      groupId: '1',
    });
  });

  test('фильтрует свои статусы и удаляет ожидающее предложение с подтверждением', async ({ appPage, api }) => {
    await appPage.goto('/suggestions');
    await expect(appPage.getByText('Одобрено')).toBeVisible();
    await expect(appPage.getByText('Отклонено')).toBeVisible();
    await appPage.getByRole('button', { name: 'Мои' }).click();
    await expect(appPage.getByText('Фалафель')).toHaveCount(0);
    await appPage.getByRole('button', { name: 'Удалить' }).click();
    const confirm = appPage.getByRole('alertdialog');
    await expect(confirm).toContainText('Том-ям');
    await confirm.getByRole('button', { name: 'Удалить' }).click();
    expect(api.requests('DELETE', '/suggestions/901')).toHaveLength(1);
    await expect(appPage.getByText('Том-ям')).toHaveCount(0);
  });

  test('показывает ошибку загрузки и повторяет запрос', async ({ appPage, api }) => {
    api.fail('GET', '/suggestions', { status: 500, error: 'Сервис недоступен', code: 'INTERNAL_ERROR' });
    await appPage.goto('/suggestions');
    await expect(appPage.getByText('Не удалось загрузить')).toBeVisible();
    api.clearFailure('GET', '/suggestions');
    await appPage.getByRole('button', { name: 'Повторить' }).click();
    await expect(appPage.getByText('Том-ям')).toBeVisible();
  });
});

test.describe('Модерация предложений', () => {
  test.use({ scenario: 'suggestions', role: 'admin' });

  test('групповой администратор принимает и отклоняет предложения', async ({ appPage, api }) => {
    api.state.suggestions[1].status = 'PENDING';
    await appPage.goto('/suggestions');
    await appPage.getByRole('button', { name: 'Одобрить' }).first().click();
    expect(api.lastRequest('POST', '/suggestions/901/approve')?.body).toEqual({ groupId: '1' });
    await expect(appPage.getByText('Одобрено').first()).toBeVisible();

    await appPage.getByRole('button', { name: 'Отклонить' }).click();
    const dialog = appPage.getByRole('alertdialog');
    await dialog.getByRole('textbox', { name: /Причина/ }).fill('Уже есть похожее блюдо');
    await dialog.getByRole('button', { name: 'Отклонить' }).click();
    expect(api.lastRequest('POST', '/suggestions/902/reject')?.body).toEqual({
      reason: 'Уже есть похожее блюдо',
      groupId: '1',
    });
    await expect(appPage.getByText('Причина: Уже есть похожее блюдо')).toBeVisible();
  });
});
