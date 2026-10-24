import { expect, test } from '../fixtures/test';

test.describe('Голосование участника', () => {
  test.use({ scenario: 'active-poll-unvoted', role: 'member' });

  test('@smoke участник голосует одним касанием по строке блюда', async ({ appPage, api }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('radiogroup')).toBeVisible();
    // строка и есть голос: отдельной кнопки подтверждения больше нет
    const dish = appPage.getByRole('radio', { name: /Борщ со сметаной/ });
    await dish.click();

    await expect.poll(() => api.lastRequest('POST', '/polls/501/vote')?.body).toEqual({ menuItemId: 11 });
    await expect(dish).toHaveAttribute('aria-checked', 'true');
  });

  test('участник не видит административные действия', async ({ appPage }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('button', { name: 'Завершить сейчас' })).toHaveCount(0);
    await expect(appPage.getByRole('button', { name: 'Отменить', exact: true })).toHaveCount(0);
  });
});

test.describe('Изменение голоса', () => {
  test.use({ scenario: 'active-poll-voted', role: 'member' });

  test('переголосовывает и отзывает голос', async ({ appPage, api }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('button', { name: 'Отозвать голос' })).toBeVisible();

    await appPage.getByRole('radio', { name: /Паста карбонара/ }).click();
    expect(api.lastRequest('POST', '/polls/501/vote')?.body).toEqual({ menuItemId: 12 });

    await appPage.getByRole('button', { name: 'Отозвать голос' }).click();
    await expect.poll(() => api.requests('DELETE', '/polls/501/vote').length).toBe(1);
  });
});

test.describe('Управление голосованием', () => {
  test.use({ scenario: 'active-poll-unvoted', role: 'admin' });

  test('администратор завершает активное голосование через подтверждение', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Завершить сейчас' }).click();
    await expect(appPage.getByRole('alertdialog')).toBeVisible();
    expect(api.requests('PATCH', '/polls/501/complete')).toHaveLength(0);
    await appPage.getByRole('button', { name: 'Завершить', exact: true }).click();
    await expect.poll(() => api.requests('PATCH', '/polls/501/complete').length).toBe(1);
    await expect(appPage.getByRole('button', { name: 'Завершить сейчас' })).toHaveCount(0);
  });

  test('отмена голосования требует подтверждения', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(appPage.getByRole('alertdialog')).toBeVisible();
    // отказ от подтверждения ничего не рушит
    await appPage.getByRole('button', { name: 'Оставить' }).click();
    expect(api.requests('PATCH', '/polls/501/cancel')).toHaveLength(0);

    await appPage.getByRole('button', { name: 'Отменить', exact: true }).click();
    await appPage.getByRole('button', { name: 'Отменить голосование' }).click();
    await expect.poll(() => api.requests('PATCH', '/polls/501/cancel').length).toBe(1);
  });
});

test.describe('Создание голосования', () => {
  test.use({ role: 'admin' });

  test('@smoke создаёт опрос только после выбора двух блюд', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Запустить голосование' }).click();
    await expect(appPage.getByRole('heading', { name: 'Создать опрос' })).toBeVisible();
    const createSheet = appPage.getByRole('dialog', { name: 'Создать опрос' });
    const submit = appPage.getByRole('button', { name: 'Запустить опрос' });
    await expect(submit).toBeDisabled();

    await createSheet.getByRole('checkbox', { name: /Борщ со сметаной/ }).click();
    await createSheet.getByRole('checkbox', { name: /Паста карбонара/ }).click();
    await expect(submit).toBeEnabled();
    await submit.click();

    const request = api.lastRequest('POST', '/polls/create-from-webapp');
    expect(request?.body).toMatchObject({
      groupId: '1',
      duration: 30,
      selectedMenuItems: [11, 12],
      isMultiSelect: false,
    });
    await expect(appPage.getByRole('button', { name: 'Завершить сейчас' })).toBeVisible();
  });

  test('создаёт повторяющееся голосование', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Запустить голосование' }).click();
    const createSheet = appPage.getByRole('dialog', { name: 'Создать опрос' });
    await appPage.getByRole('switch', { name: 'Повторяющийся опрос' }).click();
    await createSheet.getByRole('checkbox', { name: /Борщ со сметаной/ }).click();
    await createSheet.getByRole('checkbox', { name: /Паста карбонара/ }).click();
    // в режиме расписания кнопка называется иначе (см. CreatePollSheet.submitLabel)
    await appPage.getByRole('button', { name: 'Создать расписание' }).click();

    const request = api.lastRequest('POST', '/recurring');
    expect(request?.body).toMatchObject({
      groupId: 1,
      daysOfWeek: [1, 2, 3, 4, 5],
      timeOfDay: '12:00',
      selectedMenuItemIds: [11, 12],
    });
  });
});

test.describe('Права и состояния главной', () => {
  test('обычный участник не видит кнопки запуска', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.waitForLoadState('networkidle');
    await expect(appPage.getByRole('button', { name: 'Запустить голосование' })).toHaveCount(0);
  });

  test.describe('ошибка API', () => {
    test.use({ scenario: 'api-error' });

    test('показывает повтор и восстанавливается после успешного ответа', async ({ appPage, api }) => {
      await appPage.goto('/');
      await expect(appPage.getByRole('heading', { name: 'Не удалось загрузить' })).toBeVisible();
      api.clearFailure('GET', '/polls/active');
      await appPage.getByRole('button', { name: 'Повторить' }).click();
      await expect(appPage.getByText('Сегодня ещё не решали')).toBeVisible();
    });
  });

  test.describe('прямая ссылка', () => {
    test.use({ scenario: 'completed-poll' });

    test('переводит завершённый опрос на страницу результатов', async ({ appPage }) => {
      await appPage.goto('/?pollId=401');
      await expect(appPage).toHaveURL('/poll/401/results');
      await expect(appPage.getByText('Команда выбрала')).toBeVisible();
    });

    test('показывает всех победителей при одинаковом числе голосов', async ({ appPage, api }) => {
      const poll = api.state.history[0];
      if (poll.menuItems?.[1]?._count) poll.menuItems[1]._count.votes = 3;
      await appPage.goto('/poll/401/results');
      await expect(appPage.getByRole('heading', { name: 'Борщ со сметаной и Паста карбонара' })).toBeVisible();
      await expect(appPage.getByText('победитель')).toHaveCount(2);
    });
  });
});
