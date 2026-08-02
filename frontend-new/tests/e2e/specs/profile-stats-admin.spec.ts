import { expect, test } from '../fixtures/test';

test.describe('Профиль и настройки', () => {
  test('@smoke показывает пользователя, меняет реквизиты и тему', async ({ appPage, api }) => {
    await appPage.goto('/profile');
    await expect(appPage.getByText('Анна Тестова')).toBeVisible();
    await expect(appPage.getByText('@anna_e2e')).toBeVisible();

    await appPage.getByRole('button', { name: /СБП/ }).click();
    const payment = appPage.getByRole('dialog', { name: 'Реквизиты СБП' });
    await payment.getByRole('textbox', { name: 'Телефон СБП' }).fill('+7 999 000-11-22');
    await payment.getByRole('textbox', { name: 'Банк' }).fill('Альфа-Банк');
    await payment.getByRole('button', { name: 'Сохранить' }).click();
    expect(api.lastRequest('PUT', '/user/payment-info')?.body).toMatchObject({
      paymentPhone: '+7 999 000-11-22',
      paymentDetails: 'Альфа-Банк',
    });
    await expect(appPage.getByText('Альфа-Банк')).toBeVisible();

    /* Круг «сохранил → перечитал». Раньше форма слала sbpPhone/bankName, а API
       читает paymentPhone/paymentDetails: PUT отвечал 200, не записывая ничего.
       Проверки только на тело запроса это не ловили, потому что мок возвращал
       эхом присланное. Перезагрузка спрашивает у сервера заново — если имена
       снова разойдутся, номер отсюда исчезнет. */
    await appPage.reload();
    await expect(appPage.getByText('СБП +7 999 000-11-22')).toBeVisible();
    await expect(appPage.getByText('Альфа-Банк')).toBeVisible();

    const appearance = appPage.getByRole('region', { name: 'Оформление' });
    await appearance.getByRole('button', { name: 'Тёмная тема' }).click();
    await expect(appPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(appearance.getByRole('button', { name: 'Светлая тема' })).toBeVisible();
    expect(await appPage.evaluate(() => localStorage.getItem('rl-theme'))).toBe('dark');
  });

  test('отправляет отзыв и открывает внешнюю оплату без настоящего платежа', async ({ appPage, api, telegram }) => {
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: 'Написать отзыв' }).click();
    const feedback = appPage.getByRole('dialog', { name: 'Оставьте отзыв' });
    await feedback.getByRole('button', { name: '5 звёзд' }).click();
    await feedback.getByRole('textbox', { name: 'Текст отзыва' }).fill('Очень удобно');
    await feedback.getByRole('button', { name: 'Отправить' }).click();
    expect(api.lastRequest('POST', '/feedback')?.body).toMatchObject({ message: '[5★] Очень удобно' });
    await expect(appPage.getByText('Отзыв отправлен')).toBeVisible();

    await appPage.getByRole('button', { name: 'Поддержать проект' }).click();
    const donation = appPage.getByRole('dialog', { name: 'Поддержать проект' });
    await donation.getByRole('textbox', { name: 'Своя сумма' }).fill('777');
    await donation.getByRole('button', { name: 'Оплатить 777 ₽ через СБП' }).click();
    const calls = await telegram.calls();
    expect(calls.some((call) => call.method === 'window.open' && String(call.args[0]).includes('sum=77700'))).toBe(true);
  });

  test('переходит в историю, предложения и статистику', async ({ appPage }) => {
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: /Мои предложения/ }).click();
    await expect(appPage).toHaveURL('/suggestions/mine');
    await expect(appPage.getByText('У вас пока нет предложений')).toBeVisible();
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: /История голосований/ }).click();
    await expect(appPage).toHaveURL('/poll/history');
    await expect(appPage.getByText('Опрос #401')).toBeVisible();
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: /Статистика команды/ }).click();
    await expect(appPage).toHaveURL('/stats');
    await expect(appPage.getByRole('heading', { name: 'Статистика' })).toBeVisible();
  });

  test('обычный участник не видит административную точку входа', async ({ appPage }) => {
    await appPage.goto('/profile');
    await expect(appPage.getByRole('button', { name: /Управление/ })).toHaveCount(0);
  });
});

test.describe('Статистика', () => {
  test('строит статистику из истории без несуществующих фильтров', async ({ appPage }) => {
    await appPage.goto('/stats');
    await expect(appPage.getByRole('heading', { name: 'Статистика' })).toBeVisible();
    await expect(appPage.getByRole('region', { name: 'Ваше участие' })).toBeVisible();
    await expect(appPage.getByRole('region', { name: 'Команда' })).toBeVisible();
    await expect(appPage.locator('select')).toHaveCount(0);
  });

  test.describe('пустая история', () => {
    test.use({ scenario: 'empty' });
    test('показывает пустую статистику', async ({ appPage }) => {
      await appPage.goto('/stats');
      await expect(appPage.getByText('Пока нет данных')).toBeVisible();
    });
  });

  test('обрабатывает ошибку истории без падения страницы', async ({ appPage, api }) => {
    api.fail('GET', '/polls', { status: 500, error: 'История недоступна', code: 'INTERNAL_ERROR' });
    await appPage.goto('/stats');
    await expect(appPage.locator('#root')).not.toBeEmpty();
    await expect(appPage.getByText('Пока нет данных')).toBeVisible();
  });
});

for (const role of ['creator', 'admin'] as const) {
  test.describe(`Административный раздел: ${role}`, () => {
    test.use({ role });
    test('групповая роль открывает защищённый адрес и точку входа профиля', async ({ appPage }) => {
      await appPage.goto('/profile');
      await expect(appPage.getByRole('button', { name: /Управление/ })).toBeVisible();
      await appPage.getByRole('button', { name: /Управление/ }).click();
      await expect(appPage.getByRole('tab', { name: 'Обзор' })).toBeVisible();
      await expect(appPage.getByRole('button', { name: /Создать опрос/ })).toBeVisible();
    });
  });
}

test.describe('Глобальный администратор', () => {
  test.use({ role: 'globalAdmin' });

  test('@smoke открывает все вкладки панели и их основные действия', async ({ appPage, api }) => {
    api.state.debts = [{
      id: 801,
      pollId: 401,
      fromUserId: 101,
      toUserId: 202,
      amount: 600,
      status: 'PENDING',
      createdAt: '2026-07-14T09:00:00.000Z',
      fromUser: api.state.user,
      toUser: { ...api.state.user, id: 202, firstName: 'Игорь' },
    }];
    await appPage.goto('/admin');
    await expect(appPage.getByRole('tab', { name: 'Обзор' })).toBeVisible();

    await appPage.getByRole('tab', { name: 'Люди' }).click();
    await expect(appPage.getByText(/Пользователи/)).toBeVisible();
    await appPage.getByRole('textbox', { name: 'Поиск участника' }).fill('Анна');
    await appPage.getByRole('button', { name: /^Снять админа/ }).click();
    expect(api.lastRequest('PUT', '/admin/users/101/admin')?.body).toEqual({ isAdmin: false });
    await appPage.getByRole('button', { name: /^Заблокировать/ }).click();
    expect(api.lastRequest('PUT', '/admin/users/101/active')?.body).toEqual({ isActive: false });

    await appPage.getByRole('tab', { name: 'Долги' }).click();
    await expect(appPage.getByText('Должников')).toBeVisible();
    await appPage.getByRole('button', { name: 'Напомнить всем' }).click();
    expect(api.requests('POST', '/admin/debts/remind-all')).toHaveLength(1);
    await appPage.getByRole('button', { name: /^Напомнить об этом долге/ }).click();
    expect(api.requests('POST', '/admin/debts/801/remind')).toHaveLength(1);
    await appPage.getByRole('button', { name: /^Списать этот долг/ }).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Списать' }).click();
    expect(api.requests('POST', '/admin/debts/801/forgive')).toHaveLength(1);

    await appPage.getByRole('tab', { name: 'Очистка' }).click();
    await expect(appPage.getByText('Очистка данных')).toBeVisible();
    await appPage.getByRole('spinbutton', { name: 'Срок для старых голосований' }).fill('60');
    await appPage.getByRole('button', { name: 'Удалить' }).first().click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();
    await appPage.getByRole('button', { name: 'Удалить' }).nth(1).click();
    await appPage.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
    expect(api.lastRequest('DELETE', '/admin/cleanup/old-transactions')?.query.daysOld).toBe('90');

    await appPage.getByRole('tab', { name: 'Напоминания' }).click();
    await expect(appPage.getByText('Авто-напоминания о долгах')).toBeVisible();
    await appPage.getByRole('switch', { name: 'Включены' }).click();
    await appPage.getByRole('button', { name: 'Сохранить' }).click();
    await expect.poll(() => api.requests('PUT').some((request) => request.path.startsWith('/admin/reminder-settings/'))).toBe(true);
    await appPage.getByRole('switch', { name: 'Новый пользователь' }).click();
    await expect.poll(() => api.requests('PUT').some((request) => request.path.startsWith('/admin/notification-settings/'))).toBe(true);
  });
});

test.describe('Защита административного адреса', () => {
  test.use({ role: 'member' });
  test('прямой переход не даёт участнику управляющих кнопок', async ({ appPage }) => {
    await appPage.goto('/admin');
    await expect(appPage.getByText('Раздел доступен только администраторам группы.')).toBeVisible();
    await expect(appPage.getByRole('button', { name: /Создать голосование|Удалить|Списать/ })).toHaveCount(0);
  });
});
