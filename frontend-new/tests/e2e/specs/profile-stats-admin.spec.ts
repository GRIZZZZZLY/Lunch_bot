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
    // Выбранная вручную тема переживает перезагрузку.
    await appPage.reload();
    await expect(appPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('отправляет отзыв и открывает внешнюю оплату без настоящего платежа', async ({ appPage, api, telegram }) => {
    await appPage.goto('/profile');
    await appPage.getByRole('button', { name: 'Написать отзыв' }).click();
    const feedback = appPage.getByRole('dialog', { name: 'Оставьте отзыв' });
    await feedback.getByRole('button', { name: '5 звёзд' }).click();
    // оценка озвучивается, а не только красится
    await expect(feedback.getByRole('button', { name: '5 звёзд' })).toHaveAttribute('aria-pressed', 'true');
    await feedback.getByRole('textbox', { name: 'Текст отзыва' }).fill('Очень удобно');
    await feedback.getByRole('button', { name: 'Отправить' }).click();
    expect(api.lastRequest('POST', '/feedback')?.body).toMatchObject({ message: '[5★] Очень удобно' });

    await appPage.getByRole('button', { name: 'Поддержать проект' }).click();
    const donation = appPage.getByRole('dialog', { name: 'Поддержать проект' });
    await donation.getByRole('textbox', { name: 'Своя сумма' }).fill('777');
    await donation.getByRole('button', { name: 'Оплатить 777 ₽ через СБП' }).click();
    const calls = await telegram.calls();
    expect(calls.some((call) => call.method === 'window.open' && String(call.args[0]).includes('sum=77700'))).toBe(true);
  });

  test('обычный участник не видит административную точку входа', async ({ appPage }) => {
    await appPage.goto('/profile');
    await expect(appPage.getByRole('button', { name: /Управление/ })).toHaveCount(0);
  });
});

test.describe('Статистика', () => {
  /* Тест закреплял баг: отказ чтения истории показывался как «Пока нет
     данных… после первых голосований команды», то есть как факт о команде.
     Проверяем противоположное — что экран говорит про несостоявшийся запрос
     и даёт повторить. */
  test('ошибка истории показывается ошибкой, а не отсутствием данных', async ({ appPage, api }) => {
    api.fail('GET', '/polls', { status: 500, error: 'История недоступна', code: 'INTERNAL_ERROR' });
    await appPage.goto('/stats');
    await expect(appPage.getByRole('button', { name: 'Повторить' })).toBeVisible();
    await expect(appPage.getByText('Пока нет данных')).toHaveCount(0);

    /* Профиль читает ту же историю. Отказ давал там три уверенных нуля
       («0 голосований, 0 завершено, 0 дней») вместо «не смог прочитать». */
    await appPage.goto('/profile');
    await expect(appPage.getByRole('button', { name: 'Повторить' })).toBeVisible();
  });
});

/* Администратор группы проходит панель ниже; здесь — вторая групповая роль. */
for (const role of ['creator'] as const) {
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

/* Раньше этот набор шёл под ролью globalAdmin и держался на users.is_admin.
   Панель теперь открывает только роль в группе, поэтому проход по вкладкам
   выполняет администратор группы — тот, кому эти действия и принадлежат. */
test.describe('Администратор группы: все вкладки панели', () => {
  test.use({ role: 'admin' });

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
    /* Действия направлены на Игоря, а не на саму себя: панель существует ради
       управления другими, и флаг users.is_admin в фикстуре стоит именно у него.
       Раньше здесь искали Анну — она была «глобальным администратором», и тест
       снимал админа сам с себя. */
    await appPage.getByRole('textbox', { name: 'Поиск участника' }).fill('Игорь');
    await appPage.getByRole('button', { name: /^Снять админа/ }).click();
    expect(api.lastRequest('PUT', '/admin/users/202/admin')?.body).toEqual({ isAdmin: false });
    await appPage.getByRole('button', { name: /^Заблокировать/ }).click();
    expect(api.lastRequest('PUT', '/admin/users/202/active')?.body).toEqual({ isActive: false });

    await appPage.getByRole('tab', { name: 'Долги' }).click();
    await expect(appPage.getByText('старейший')).toBeVisible();
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
    await expect(appPage.getByText('Автонапоминания о долгах')).toBeVisible();
    await appPage.getByRole('switch', { name: 'Включены' }).click();
    await appPage.getByRole('button', { name: 'Сохранить' }).click();
    await expect.poll(() => api.requests('PUT').some((request) => request.path.startsWith('/admin/reminder-settings/'))).toBe(true);
    await appPage.getByRole('switch', { name: 'Новый пользователь' }).click();
    await expect.poll(() => api.requests('PUT').some((request) => request.path.startsWith('/admin/notification-settings/'))).toBe(true);
  });

  /* Необратимое действие: диалог называет число до удаления, итог — после, и
     оба говорят о голосованиях, которые удержали непогашенные долги. */
  test('удаляет старые голосования и называет удержанные долгами', async ({ appPage, api }) => {
    await appPage.goto('/admin');
    await appPage.getByRole('tab', { name: 'Очистка' }).click();
    await appPage.getByRole('spinbutton', { name: 'Срок для старых голосований' }).fill('60');
    await appPage.getByRole('button', { name: 'Удалить' }).first().click();

    // Сверяем числа (3 удалится, 1 удержан долгом), а не формулировку.
    const counts = /\b3\b\D+\b1\b/;
    const dialog = appPage.getByRole('alertdialog');
    await expect(dialog).toContainText(counts);
    await dialog.getByRole('button', { name: 'Удалить' }).click();

    await expect(appPage.getByRole('status').filter({ hasText: counts })).toBeVisible();
    expect(api.lastRequest('DELETE', '/admin/cleanup/old-polls')?.query).toEqual({
      daysOld: '60',
      groupId: '1',
    });
    expect(api.requests('DELETE', '/admin/cleanup/old-transactions')).toHaveLength(0);
  });
});

test.describe('Защита административного адреса', () => {
  test.use({ role: 'member' });
  test('прямой переход не даёт участнику управляющих кнопок', async ({ appPage }) => {
    await appPage.goto('/admin');
    await appPage.waitForLoadState('networkidle');
    await expect(appPage.getByRole('tab', { name: 'Обзор' })).toHaveCount(0);
    await expect(appPage.getByRole('button', { name: /Создать голосование|Удалить|Списать/ })).toHaveCount(0);
  });
});
