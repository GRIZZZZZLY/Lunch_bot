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
      await appPage.getByRole('button', { name: /^Отметить/ }).click();
      expect(api.lastRequest('POST', '/budget/mark-paid')?.body).toEqual({ transactionId: 801 });
      await expect(appPage.getByText('Отмечено как оплачено. Ждём подтверждения.')).toBeVisible();
      const markedDebt = appPage.getByText('420 ₽', { exact: true }).locator('../..');
      await markedDebt.getByRole('button', { name: 'Отменить отметку' }).click();
      expect(api.lastRequest('POST', '/budget/cancel-mark')?.body).toEqual({ transactionId: 801 });
      await expect(appPage.getByText('Отметка снята')).toBeVisible();
    });

    test('сохраняет состояние и сообщает об ошибке оплаты', async ({ appPage, api }) => {
      api.fail('POST', '/budget/mark-paid', { status: 403, error: 'Операция запрещена', code: 'FORBIDDEN' });
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: /^Отметить/ }).click();
      // apiError.ts переводит код в человеческий текст; запасной текст вызова
      // виден только на неизвестном коде (см. 9b08db1e)
      await expect(appPage.getByText('Недостаточно прав для этого действия.')).toBeVisible();
      await expect(appPage.getByRole('button', { name: /^Отметить/ })).toBeVisible();
    });
  });

  test.describe('ответственный', () => {
    test.use({ scenario: 'budget-responsible', role: 'responsible' });

    /* Подтверждение закрывает долг, поэтому между касанием и мутацией стоит
       диалог. Отменить можно, но только в течение суток — окно проверяет сервер. */
    test('подтверждает оплату через диалог и завершает расчёт', async ({ appPage, api }) => {
      await appPage.goto('/budget');
      await appPage.getByRole('button', { name: /^Подтвердить/ }).click();
      expect(api.requests('POST', '/budget/confirm-payment')).toHaveLength(0);

      const dialog = appPage.getByRole('alertdialog');
      await expect(dialog).toContainText('Передумать можно в течение суток');
      await dialog.getByRole('button', { name: 'Подтвердить' }).click();
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

  /* Участнику сервер отдаёт только его собственные предложения — «Фалафель»
     чужой, и его не видно ни на одной вкладке. Раньше мок отдавал всем всё, и
     тест закреплял поведение мока, а не сервера. */
  test('видит только свои статусы и отзывает ожидающее с подтверждением', async ({ appPage, api }) => {
    await appPage.goto('/suggestions');
    await expect(appPage.getByText('Отклонено')).toBeVisible();
    await expect(appPage.getByText('Фалафель')).toHaveCount(0);
    await appPage.getByRole('tab', { name: 'Мои' }).click();
    await expect(appPage.getByText('Том-ям')).toBeVisible();

    await appPage.getByRole('button', { name: 'Отозвать' }).click();
    const confirm = appPage.getByRole('alertdialog');
    await expect(confirm).toContainText('Том-ям');
    await confirm.getByRole('button', { name: 'Отозвать' }).click();
    expect(api.requests('DELETE', '/suggestions/901')).toHaveLength(1);
    await expect(appPage.getByText('Том-ям')).toHaveCount(0);
  });

  /* Регрессия сквозь весь стек. Маршрут удаления был закрыт админской
     мидлварой, а кнопка показывалась участнику — сработать она не могла ни
     разу и молчала при отказе. Здесь проверяется вторая половина: что отказ
     виден, если он всё-таки придёт. */
  test('отказ сервера на отзыв виден, а не проглочен', async ({ appPage, api }) => {
    api.fail('DELETE', '/suggestions/901', {
      status: 403,
      error: 'Group admin access required',
      code: 'ACCESS_DENIED',
    });
    await appPage.goto('/suggestions');
    await appPage.getByRole('button', { name: 'Отозвать' }).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Отозвать' }).click();

    await expect(appPage.getByRole('alert')).toContainText('нужны права администратора группы');
    await expect(appPage.getByRole('alertdialog')).toHaveCount(0);
    await expect(appPage.getByText('Том-ям')).toBeVisible();
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
    // Одобрение необратимо создаёт блюдо в меню, поэтому спрашивает подтверждение.
    await appPage.getByRole('button', { name: 'Одобрить' }).first().click();
    const approve = appPage.getByRole('alertdialog');
    await expect(approve).toContainText('Добавить блюдо в меню?');
    await approve.getByRole('button', { name: 'Одобрить' }).click();
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
