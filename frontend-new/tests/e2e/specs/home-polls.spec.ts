import { expect, test } from '../fixtures/test';

test.describe('Голосование участника', () => {
  test.use({ scenario: 'active-poll-unvoted', role: 'member' });

  test('@smoke участник голосует одним касанием по строке блюда', async ({ appPage, api }) => {
    await appPage.goto('/');
    await expect(appPage.getByRole('radiogroup')).toBeVisible();
    // строка и есть голос: отдельной кнопки подтверждения больше нет
    await appPage.getByRole('radio', { name: /Борщ со сметаной/ }).click();

    await expect(appPage.getByText('Голос учтён')).toBeVisible();
    const request = api.lastRequest('POST', '/polls/501/vote');
    expect(request?.body).toEqual({ menuItemId: 11 });
    await expect(appPage.getByText('ваш голос', { exact: false })).toBeVisible();
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
    await expect(appPage.getByText('Голос снят')).toBeVisible();
    expect(api.requests('DELETE', '/polls/501/vote')).toHaveLength(1);
  });
});

test.describe('Управление голосованием', () => {
  test.use({ scenario: 'active-poll-unvoted', role: 'admin' });

  test('администратор завершает активное голосование через подтверждение', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Завершить сейчас' }).click();
    await expect(appPage.getByText('Завершить голосование?')).toBeVisible();
    await appPage.getByRole('button', { name: 'Завершить', exact: true }).click();
    await expect(appPage.getByText('Голосование закрыто')).toBeVisible();
    expect(api.requests('PATCH', '/polls/501/complete')).toHaveLength(1);
    await expect(appPage.getByText('Сегодня ещё не решали')).toBeVisible();
  });

  test('отмена голосования требует подтверждения и предупреждает о потере голосов', async ({ appPage, api }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(appPage.getByText(/Голоса участников будут удалены/)).toBeVisible();
    // отказ от подтверждения ничего не рушит
    await appPage.getByRole('button', { name: 'Оставить' }).click();
    expect(api.requests('PATCH', '/polls/501/cancel')).toHaveLength(0);

    await appPage.getByRole('button', { name: 'Отменить', exact: true }).click();
    await appPage.getByRole('button', { name: 'Отменить голосование' }).click();
    await expect(appPage.getByText('Голосование отменено')).toBeVisible();
    expect(api.requests('PATCH', '/polls/501/cancel')).toHaveLength(1);
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
    await expect(appPage.getByText('Голосование отправлено в группу')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Завершить сейчас' })).toBeVisible();
    await appPage.getByRole('button', { name: 'Завершить сейчас' }).click();
    await appPage.getByRole('button', { name: 'Завершить', exact: true }).click();
    await expect(appPage.getByText('Голосование закрыто')).toBeVisible();
    await appPage.waitForLoadState('networkidle');
    await appPage.goto('/poll/502/results');
    await expect(appPage.getByText('Команда выбрала')).toBeVisible();
    await appPage.waitForLoadState('networkidle');
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

  test('чипы дней ловят палец за пределами видимой пилюли (хитбокс 44)', async ({ appPage }) => {
    await appPage.goto('/');
    await appPage.getByRole('button', { name: 'Запустить голосование' }).click();
    await appPage.getByRole('switch', { name: 'Повторяющийся опрос' }).click();

    const chip = appPage.getByRole('button', { name: 'Сб', exact: true });
    const box = (await chip.boundingBox())!;
    expect(box.height).toBeLessThan(44); // вид намеренно компактный

    // тап на 4 px выше верхней кромки пилюли: попасть должен всё равно чип
    await appPage.mouse.click(box.x + box.width / 2, box.y - 4);
    await expect(chip).toHaveClass(/\bon\b/);
  });
});

test.describe('Права и состояния главной', () => {
  test('обычный участник видит ожидание администратора без кнопки запуска', async ({ appPage }) => {
    await appPage.goto('/');
    await expect(appPage.getByText('Дождитесь, пока админ запустит голосование')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Запустить голосование' })).toHaveCount(0);
  });

  test.describe('нет групп', () => {
    test.use({ scenario: 'groups-none', role: 'admin' });

    test('не предлагает создать голосование без активной группы', async ({ appPage }) => {
      await appPage.goto('/');
      await expect(appPage.getByRole('button', { name: 'Запустить голосование' })).toHaveCount(0);
    });
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

    test('восстанавливается после отсутствия сети', async ({ appPage, api }) => {
      api.fail('GET', '/polls/active', {
        status: 0,
        error: 'Нет сети',
        code: 'NETWORK_ERROR',
        abort: true,
      });
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

    test('не маскирует 403 под пустой экран', async ({ appPage, api }) => {
      api.fail('GET', '/polls/401', { status: 403, error: 'Нет доступа', code: 'FORBIDDEN' });
      await appPage.goto('/poll/401/results');
      await expect(appPage.getByText('Нет доступа')).toBeVisible();
      await expect(appPage.getByRole('button', { name: 'Повторить' })).toHaveCount(0);
    });

    test('повторяет загрузку результатов после 500', async ({ appPage, api }) => {
      api.fail('GET', '/polls/401/results', { status: 500, error: 'Ошибка результатов', code: 'INTERNAL_ERROR' });
      await appPage.goto('/poll/401/results');
      await expect(appPage.getByText('Не удалось загрузить')).toBeVisible();
      api.clearFailure('GET', '/polls/401/results');
      await appPage.getByRole('button', { name: 'Повторить' }).click();
      await expect(appPage.getByText('Команда выбрала')).toBeVisible();
    });
  });
});
