import { expect, shot, test } from './fixture';

/**
 * Снимает интерфейс от точек входа до крайних состояний компонентов.
 * Каждый тест независим: падение одного кадра не обрывает остальной тур.
 */

test.describe('01 Точки входа', () => {
  test.describe('без initData', () => {
    test.use({ scenario: 'auth-missing-init-data' });
    test('приложение открыто вне Telegram', async ({ app }) => {
      await app.goto('/');
      await shot(app, '01-entry/01-no-init-data');
    });
  });

  test.describe('авторизация отклонена', () => {
    test.use({ scenario: 'auth-error' });
    test('подпись не прошла проверку', async ({ app }) => {
      await app.goto('/');
      await shot(app, '01-entry/02-auth-rejected');
    });
  });

  test.describe('нет групп', () => {
    test.use({ scenario: 'groups-none', role: 'admin' });
    test('бот не добавлен ни в одну группу', async ({ app }) => {
      await app.goto('/');
      await shot(app, '01-entry/03-no-groups');
    });
  });

  test('обычный вход участника на главную', async ({ app }) => {
    await app.goto('/');
    await shot(app, '01-entry/04-member-home');
  });

  test.describe('несколько групп', () => {
    test.use({ scenario: 'groups-multiple', role: 'admin' });
    test('переключатель групп на главной и в меню', async ({ app }) => {
      await app.goto('/');
      await shot(app, '01-entry/05-group-tabs-home');
      // Табы групп живут на экранах со списками; на главной их нет.
      await app.goto('/menu');
      await shot(app, '01-entry/06-group-tabs-menu');
      await app.getByRole('tab', { name: 'Команда Спутник' }).click();
      await shot(app, '01-entry/07-group-switched');
    });
  });

  test('нижняя навигация: четыре вкладки', async ({ app }) => {
    await app.goto('/menu');
    await shot(app, '01-entry/10-nav-menu');
    await app.goto('/stats');
    await shot(app, '01-entry/11-nav-stats');
    await app.goto('/profile');
    await shot(app, '01-entry/12-nav-profile');
  });
});

test.describe('02 Главная', () => {
  test('участник ждёт запуска голосования', async ({ app }) => {
    await app.goto('/');
    await shot(app, '02-home/01-idle-member');
  });

  test.describe('администратор', () => {
    test.use({ role: 'admin' });

    test('пустой день с административными действиями', async ({ app }) => {
      await app.goto('/');
      await shot(app, '02-home/02-idle-admin');
    });

    test('лист создания опроса', async ({ app }) => {
      await app.goto('/');
      await app.getByRole('button', { name: 'Запустить голосование' }).click();
      const sheet = app.getByRole('dialog', { name: 'Создать опрос' });
      await expect(sheet).toBeVisible();
      await shot(app, '02-home/03-create-poll-empty');

      await sheet.getByRole('button', { name: /Борщ со сметаной/ }).click();
      await sheet.getByRole('button', { name: /Паста карбонара/ }).click();
      await shot(app, '02-home/04-create-poll-filled');

      await app.getByRole('switch', { name: 'Повторяющийся опрос' }).click();
      await shot(app, '02-home/05-create-poll-recurring');
    });

    test('опрос запущен и закрыт', async ({ app }) => {
      await app.goto('/');
      await app.getByRole('button', { name: 'Запустить голосование' }).click();
      const sheet = app.getByRole('dialog', { name: 'Создать опрос' });
      await sheet.getByRole('button', { name: /Борщ со сметаной/ }).click();
      await sheet.getByRole('button', { name: /Паста карбонара/ }).click();
      await app.getByRole('button', { name: 'Запустить опрос' }).click();
      await shot(app, '02-home/06-poll-created-toast', 200);
      await app.getByRole('button', { name: 'Завершить сейчас' }).click();
      await shot(app, '02-home/07-poll-closed');
    });
  });

  test.describe('активный опрос, участник не голосовал', () => {
    test.use({ scenario: 'active-poll-unvoted', role: 'member' });

    test('карточка голосования, выбор и отправка', async ({ app }) => {
      await app.goto('/');
      await shot(app, '02-home/10-poll-active-unvoted');
      await app.getByRole('radio', { name: /Борщ со сметаной/ }).click();
      await shot(app, '02-home/11-poll-option-selected');
      await app.getByRole('button', { name: 'Голосовать' }).click();
      await shot(app, '02-home/12-poll-vote-toast', 200);
      await shot(app, '02-home/13-poll-after-vote', 2_500);
    });
  });

  test.describe('активный опрос, голос отдан', () => {
    test.use({ scenario: 'active-poll-voted', role: 'member' });

    test('переголосовать и отозвать', async ({ app }) => {
      await app.goto('/');
      await shot(app, '02-home/14-poll-voted');
      await app.getByRole('radio', { name: /Паста карбонара/ }).click();
      await shot(app, '02-home/15-poll-revote-ready');
      await app.getByRole('button', { name: 'Отозвать голос' }).click();
      await shot(app, '02-home/16-poll-vote-withdrawn', 200);
    });
  });

  test.describe('активный опрос глазами администратора', () => {
    test.use({ scenario: 'active-poll-unvoted', role: 'admin' });

    test('управление активным опросом', async ({ app }) => {
      await app.goto('/');
      await shot(app, '02-home/17-poll-active-admin');
      await app.getByRole('button', { name: 'Отменить', exact: true }).click();
      await shot(app, '02-home/18-poll-cancelled', 200);
    });
  });

  test('диалог новой закупки', async ({ app }) => {
    await app.goto('/');
    await app.getByRole('button', { name: /Закупка в магазине/ }).click();
    const dialog = app.getByRole('dialog', { name: 'Новая закупка' });
    await expect(dialog).toBeVisible();
    await shot(app, '02-home/20-store-run-create-empty');
    await dialog.getByRole('textbox', { name: 'Откуда заказываем' }).fill('Лента у метро');
    await dialog.getByRole('button', { name: '15 мин' }).click();
    await shot(app, '02-home/21-store-run-create-filled');
  });

  test.describe('ошибка загрузки', () => {
    test.use({ scenario: 'api-error' });
    test('экран ошибки с повтором', async ({ app }) => {
      await app.goto('/');
      await shot(app, '02-home/30-error-state');
    });
  });

  test.describe('медленный ответ', () => {
    test('скелетон загрузки', async ({ app, api }) => {
      api.state.delays['GET /polls/active'] = 4_000;
      await app.goto('/');
      await app.waitForTimeout(600);
      await app.screenshot({ path: 'ui-tour/02-home/31-loading-skeleton.png' });
    });
  });
});

test.describe('03 Меню', () => {
  test('участник: список, фильтр и поиск', async ({ app }) => {
    await app.goto('/menu');
    await shot(app, '03-menu/01-member-list');
    await app.getByRole('button', { name: /Супы/ }).click();
    await shot(app, '03-menu/02-member-category');
    await app.getByRole('button', { name: /Все/ }).click();
    await app.getByRole('textbox', { name: 'Поиск блюд' }).fill('несуществующее');
    await shot(app, '03-menu/03-member-no-results');
  });

  test.describe('пустое меню', () => {
    test.use({ scenario: 'menu-empty' });
    test('участник видит объяснение', async ({ app }) => {
      await app.goto('/menu');
      await shot(app, '03-menu/04-empty-member');
    });
  });

  test.describe('пустое меню у администратора', () => {
    test.use({ scenario: 'menu-empty', role: 'admin' });
    test('администратору предлагают добавить блюдо', async ({ app }) => {
      await app.goto('/menu');
      await shot(app, '03-menu/05-empty-admin');
    });
  });

  test.describe('ошибка меню', () => {
    test.use({ scenario: 'menu-error' });
    test('экран ошибки', async ({ app }) => {
      await app.goto('/menu');
      await shot(app, '03-menu/06-error');
    });
  });

  test.describe('администратор', () => {
    test.use({ role: 'admin' });

    test('список с управлением', async ({ app }) => {
      await app.goto('/menu');
      await shot(app, '03-menu/10-admin-list');
    });

    test('лист добавления блюда', async ({ app }) => {
      await app.goto('/menu');
      await app.getByRole('button', { name: 'Добавить блюдо' }).click();
      const sheet = app.getByRole('dialog', { name: 'Добавить блюдо' });
      await shot(app, '03-menu/11-add-empty');
      await sheet.getByRole('textbox', { name: 'Название' }).fill('Поке с лососем');
      await sheet.getByRole('textbox', { name: 'Цена, ₽' }).fill('610');
      await sheet.getByRole('textbox', { name: 'Категория' }).fill('Поке');
      await shot(app, '03-menu/12-add-filled');
      await sheet.getByRole('button', { name: 'Сохранить' }).click();
      await shot(app, '03-menu/13-add-saved');
    });

    test('лист изменения и подтверждение удаления', async ({ app }) => {
      await app.goto('/menu');
      await app.getByLabel('Изменить «Паста карбонара»').click();
      await shot(app, '03-menu/14-edit-sheet');
      await app.getByRole('button', { name: 'Удалить блюдо' }).click();
      await shot(app, '03-menu/15-delete-confirm');
    });

    test('скрытое блюдо', async ({ app }) => {
      await app.goto('/menu');
      await app.getByLabel('Скрыть «Борщ со сметаной»').click();
      await shot(app, '03-menu/16-item-hidden');
    });

    test('ошибка сохранения', async ({ app, api }) => {
      api.state.failures['POST /menu'] = {
        status: 500,
        error: 'Не удалось сохранить блюдо',
        code: 'INTERNAL_ERROR',
      };
      await app.goto('/menu');
      await app.getByRole('button', { name: 'Добавить блюдо' }).click();
      const sheet = app.getByRole('dialog', { name: 'Добавить блюдо' });
      await sheet.getByRole('textbox', { name: 'Название' }).fill('Ризотто');
      await sheet.getByRole('textbox', { name: 'Цена, ₽' }).fill('550');
      await sheet.getByRole('button', { name: 'Сохранить' }).click();
      await shot(app, '03-menu/17-save-error', 200);
    });
  });
});

test.describe('04 Статистика', () => {
  test('заполненная статистика', async ({ app }) => {
    await app.goto('/stats');
    await shot(app, '04-stats/01-filled');
    await app.mouse.wheel(0, 900);
    await shot(app, '04-stats/02-filled-scrolled');
  });

  test.describe('нет истории', () => {
    test.use({ scenario: 'empty' });
    test('пустая статистика', async ({ app }) => {
      await app.goto('/stats');
      await shot(app, '04-stats/03-empty');
    });
  });
});

test.describe('05 Профиль', () => {
  test('карточка участника', async ({ app }) => {
    await app.goto('/profile');
    await shot(app, '05-profile/01-member');
    await app.mouse.wheel(0, 900);
    await shot(app, '05-profile/02-member-scrolled');
  });

  test('реквизиты СБП', async ({ app }) => {
    await app.goto('/profile');
    await app.getByRole('button', { name: /СБП/ }).click();
    await shot(app, '05-profile/03-payment-dialog');
  });

  test('отзыв и поддержка', async ({ app }) => {
    await app.goto('/profile');
    await app.getByRole('button', { name: 'Написать отзыв' }).click();
    const feedback = app.getByRole('dialog', { name: 'Оставьте отзыв' });
    await shot(app, '05-profile/04-feedback-empty');
    await feedback.getByRole('button', { name: '5 звёзд' }).click();
    await feedback.getByRole('textbox', { name: 'Текст отзыва' }).fill('Очень удобно, спасибо');
    await shot(app, '05-profile/05-feedback-filled');
    await feedback.getByRole('button', { name: 'Отправить' }).click();
    await shot(app, '05-profile/06-feedback-sent', 200);

    await app.getByRole('button', { name: 'Поддержать проект' }).click();
    await shot(app, '05-profile/07-donation-dialog');
  });

  test('переключение темы вручную', async ({ app }) => {
    await app.goto('/profile');
    const appearance = app.getByRole('region', { name: 'Оформление' });
    await appearance.getByRole('button', { name: 'Тёмная тема' }).click();
    await shot(app, '05-profile/08-theme-switched-dark');
  });

  test.describe('администратор группы', () => {
    test.use({ role: 'admin' });
    test('в профиле появляется вход в управление', async ({ app }) => {
      await app.goto('/profile');
      await app.mouse.wheel(0, 900);
      await shot(app, '05-profile/09-admin-entry');
    });
  });
});

test.describe('06 Админ-панель', () => {
  test.describe('администратор группы', () => {
    test.use({ role: 'admin' });

    test('вкладки панели', async ({ app, api }) => {
      api.state.debts = [
        {
          id: 801,
          pollId: 401,
          fromUserId: 101,
          toUserId: 202,
          amount: 600,
          status: 'PENDING',
          createdAt: '2026-07-14T09:00:00.000Z',
          fromUser: api.state.user,
          toUser: { ...api.state.user, id: 202, firstName: 'Игорь' },
        },
      ];
      await app.goto('/admin');
      await shot(app, '06-admin/01-overview');

      await app.getByRole('tab', { name: 'Люди' }).click();
      await shot(app, '06-admin/02-people');

      await app.getByRole('tab', { name: 'Долги' }).click();
      await shot(app, '06-admin/03-debts');
      await app.getByRole('button', { name: /^Списать этот долг/ }).click();
      await shot(app, '06-admin/04-debts-forgive-confirm');
      await app.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();

      await app.getByRole('tab', { name: 'Очистка' }).click();
      await shot(app, '06-admin/05-cleanup');
      await app.getByRole('button', { name: 'Удалить' }).first().click();
      await shot(app, '06-admin/06-cleanup-confirm');
      await app.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();

      await app.getByRole('tab', { name: 'Напоминания' }).click();
      await shot(app, '06-admin/07-reminders');
    });
  });

  test.describe('администратор группы', () => {
    test.use({ role: 'admin' });
    test('панель без глобальных прав', async ({ app }) => {
      await app.goto('/admin');
      await shot(app, '06-admin/08-group-admin');
    });
  });

  test('участник: прямой переход запрещён', async ({ app }) => {
    await app.goto('/admin');
    await shot(app, '06-admin/09-member-forbidden');
  });
});

test.describe('07 Бюджет', () => {
  test('нет расчётов', async ({ app }) => {
    await app.goto('/budget');
    await shot(app, '07-budget/01-empty');
  });

  test.describe('должник', () => {
    test.use({ scenario: 'budget-debtor', role: 'debtor' });
    test('долги и отметка об оплате', async ({ app }) => {
      await app.goto('/budget');
      await shot(app, '07-budget/02-debtor');
      await app.getByRole('button', { name: /^Отметить/ }).click();
      await shot(app, '07-budget/03-debtor-marked-paid', 200);
    });

    test('ошибка отметки оплаты', async ({ app, api }) => {
      api.state.failures['POST /budget/mark-paid'] = {
        status: 403,
        error: 'Операция запрещена',
        code: 'FORBIDDEN',
      };
      await app.goto('/budget');
      await app.getByRole('button', { name: /^Отметить/ }).click();
      await shot(app, '07-budget/04-debtor-error', 200);
    });

    /* Аудит: что видит должник, когда СПИСОК не загрузился. Страница читает
       только isLoading, поэтому отказ чтения падает в `debts = []`. */
    test('долги не загрузились', async ({ app, api }) => {
      api.state.failures['GET /budget/debts'] = {
        status: 503,
        error: 'Сеть недоступна',
        code: 'NETWORK',
        abort: true,
      };
      await app.goto('/budget');
      await shot(app, '07-budget/07-debts-load-failed');
      // после исчерпания retry (queryClient: retry 1) состояние меняется
      await shot(app, '07-budget/07b-debts-load-failed-settled', 3_000);
    });
  });

  test.describe('ответственный', () => {
    test.use({ scenario: 'budget-responsible', role: 'responsible' });
    test('подтверждение оплаты', async ({ app }) => {
      await app.goto('/budget');
      await shot(app, '07-budget/05-responsible');
      await app.getByRole('button', { name: 'Подтвердить' }).click();
      await shot(app, '07-budget/06-responsible-settled', 200);
    });
  });
});

test.describe('08 Предложения', () => {
  test.describe('участник', () => {
    test.use({ scenario: 'suggestions', role: 'member' });

    test('список, фильтр и форма', async ({ app }) => {
      await app.goto('/suggestions');
      await shot(app, '08-suggestions/01-list-all');
      await app.getByRole('button', { name: 'Мои' }).click();
      await shot(app, '08-suggestions/02-list-mine');
      await app.getByRole('button', { name: 'Предложить блюдо' }).last().click();
      const dialog = app.getByRole('dialog', { name: 'Предложить блюдо' });
      await shot(app, '08-suggestions/03-create-empty');
      await dialog.getByRole('textbox', { name: 'Название' }).fill('Рамен с мисо');
      await dialog.getByRole('textbox', { name: /Примерная цена/ }).fill('-1');
      await shot(app, '08-suggestions/04-create-invalid-price');
      await dialog.getByRole('textbox', { name: /Примерная цена/ }).fill('490,50');
      await shot(app, '08-suggestions/05-create-valid');
    });

    test('подтверждение удаления', async ({ app }) => {
      await app.goto('/suggestions');
      await app.getByRole('button', { name: 'Мои' }).click();
      await app.getByRole('button', { name: 'Удалить' }).click();
      await shot(app, '08-suggestions/06-delete-confirm');
    });

    test('ошибка загрузки', async ({ app, api }) => {
      api.state.failures['GET /suggestions'] = {
        status: 500,
        error: 'Сервис недоступен',
        code: 'INTERNAL_ERROR',
      };
      await app.goto('/suggestions');
      await shot(app, '08-suggestions/07-error');
    });
  });

  test('свои предложения пусты', async ({ app }) => {
    await app.goto('/suggestions/mine');
    await shot(app, '08-suggestions/08-mine-empty');
  });

  test.describe('модерация', () => {
    test.use({ scenario: 'suggestions', role: 'admin' });
    test('одобрение и отклонение', async ({ app, api }) => {
      api.state.suggestions[1].status = 'PENDING';
      await app.goto('/suggestions');
      await shot(app, '08-suggestions/10-moderation');
      await app.getByRole('button', { name: 'Отклонить' }).first().click();
      const dialog = app.getByRole('alertdialog');
      await shot(app, '08-suggestions/11-reject-dialog');
      await dialog.getByRole('textbox', { name: /Причина/ }).fill('Уже есть похожее блюдо');
      await shot(app, '08-suggestions/12-reject-reason');
    });
  });
});

test.describe('09 Закупка', () => {
  test.describe('сбор позиций, участник', () => {
    test.use({ scenario: 'store-collecting', role: 'storeParticipant' });

    test('свои и чужие позиции', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/01-collecting-participant');
      await app.getByRole('button', { name: 'Добавить позицию' }).click();
      await shot(app, '09-store-run/02-add-item-empty');
      const add = app.getByRole('dialog');
      await add.getByRole('button', { name: 'Добавить' }).click();
      await shot(app, '09-store-run/03-add-item-validation', 200);
      await add.getByRole('textbox', { name: 'Что купить' }).fill('Яблоки');
      await add.getByRole('textbox', { name: 'Количество' }).fill('3');
      await shot(app, '09-store-run/04-add-item-filled');
    });

    test('изменение и удаление своей позиции', async ({ app }) => {
      await app.goto('/store-run/601');
      await app.getByLabel('Изменить «Молоко 3,2%»').click();
      await shot(app, '09-store-run/05-edit-item');
      await app.keyboard.press('Escape');
      await app.getByLabel('Удалить «Молоко 3,2%»').click();
      await shot(app, '09-store-run/06-delete-item-confirm');
    });
  });

  test.describe('сбор позиций, инициатор', () => {
    test.use({ scenario: 'store-collecting', role: 'storeInitiator' });

    test('действия инициатора', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/10-collecting-initiator');
      await app.getByRole('button', { name: 'Закрыть сбор' }).click();
      await shot(app, '09-store-run/11-close-confirm');
      await app.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();
      await app.getByRole('button', { name: 'Отменить закупку' }).click();
      await shot(app, '09-store-run/12-cancel-confirm');
    });

    test('последняя минута сбора', async ({ app, api }) => {
      // состояние опознаётся не только красным — справа встаёт слово
      api.state.storeRuns[0].collectUntil = '2026-07-20T09:05:40.000Z';
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/14-collecting-last-minute');
    });

    test('пустой сбор', async ({ app, api }) => {
      api.state.storeRuns[0].items = [];
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/13-collecting-empty');
    });
  });

  test.describe('в магазине, инициатор', () => {
    test.use({ scenario: 'store-shopping', role: 'storeInitiator' });

    test('отметка одним касанием, цена отдельным шагом, расчёт', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/20-shopping-initiator');

      // одно касание: позиция уже куплена, цены ещё нет — расчёт заблокирован
      await app.getByRole('button', { name: 'Куплено: Молоко 3,2%' }).click();
      await shot(app, '09-store-run/21-bought-without-price');

      await app.getByRole('button', { name: 'Указать цену: Молоко 3,2%' }).click();
      await shot(app, '09-store-run/21b-price-editor');
      await app.getByRole('textbox', { name: /Цена за всё/ }).fill('249,50');
      await shot(app, '09-store-run/21c-price-filled');
      await app.getByRole('button', { name: 'Сохранить' }).click();
      await shot(app, '09-store-run/21d-price-saved');

      // сброс уже введённой цены спрашивает подтверждение
      await app.getByRole('button', { name: 'Не нашли: Молоко 3,2%' }).click();
      await shot(app, '09-store-run/21e-reset-price-confirm');
      await app.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click();
    });

    /* Отдельный сценарий: диалог расчёта появляется, только пока осталась
       необработанная позиция. В предыдущем тесте их уже не остаётся. */
    test('расчёт с необработанной позицией', async ({ app }) => {
      await app.goto('/store-run/601');
      await app.getByRole('button', { name: 'Рассчитать' }).click();
      await shot(app, '09-store-run/22-settle-confirm');
      await app.getByRole('alertdialog').getByRole('button', { name: 'Рассчитать без них' }).click();
      await shot(app, '09-store-run/23-settled-result');
    });
  });

  test.describe('в магазине, участник', () => {
    test.use({ scenario: 'store-shopping', role: 'storeParticipant' });
    test('только чтение и личная сумма', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/24-shopping-participant');
    });
  });

  test.describe('рассчитано', () => {
    test.use({ scenario: 'store-settled', role: 'storeParticipant' });
    test('итог закупки', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/30-settled');
    });
  });

  /* Нотис «осталось проставить цены» — единственный интерактив внутри нотиса и
     самая правленая часть поверхности: цвет, состояния, тап-зона. */
  test.describe('в магазине: цены не проставлены', () => {
    test.use({ scenario: 'store-shopping', role: 'storeInitiator' });
    test('нотис и заблокированный расчёт', async ({ app, api }) => {
      api.state.storeRuns[0].items.forEach((item) => {
        if (item.status === 'BOUGHT') item.price = null;
      });
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/25-unpriced-notice');
    });
  });

  test.describe('отменено', () => {
    test.use({ scenario: 'store-cancelled', role: 'storeParticipant' });
    test('причина отмены', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/31-cancelled');
    });
  });

  test.describe('нет доступа', () => {
    test.use({ scenario: 'store-forbidden' });
    test('403', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '09-store-run/40-forbidden');
    });
  });

  test.describe('не найдено', () => {
    test.use({ scenario: 'store-not-found' });
    test('404', async ({ app }) => {
      await app.goto('/store-run/999');
      await shot(app, '09-store-run/41-not-found');
    });
  });
});

test.describe('10 История и результаты', () => {
  test('история голосований', async ({ app }) => {
    await app.goto('/poll/history');
    await shot(app, '10-poll/01-history');
  });

  test('результаты завершённого опроса', async ({ app }) => {
    await app.goto('/poll/401/results');
    await shot(app, '10-poll/02-results');
    await app.mouse.wheel(0, 900);
    await shot(app, '10-poll/03-results-scrolled');
  });

  test('ничья: несколько победителей', async ({ app, api }) => {
    const poll = api.state.history[0];
    if (poll.menuItems?.[1]?._count) poll.menuItems[1]._count.votes = 3;
    await app.goto('/poll/401/results');
    await shot(app, '10-poll/04-results-tie');
  });

  test('нет доступа к результатам', async ({ app, api }) => {
    api.state.failures['GET /polls/401'] = { status: 403, error: 'Нет доступа', code: 'FORBIDDEN' };
    await app.goto('/poll/401/results');
    await shot(app, '10-poll/05-results-forbidden');
  });
});

test.describe('11 Прочее', () => {
  test('неизвестный маршрут', async ({ app }) => {
    await app.goto('/no-such-page');
    await shot(app, '11-misc/01-not-found');
  });

  test.describe('истёкшая сессия', () => {
    test.use({ scenario: 'expired-session' });
    test('молчаливое обновление токена', async ({ app }) => {
      await app.goto('/');
      await shot(app, '11-misc/02-session-refreshed');
    });
  });
});

test.describe('12 Тёмная тема', () => {
  test.use({ theme: 'dark' });

  test.describe('главная с активным опросом', () => {
    test.use({ scenario: 'active-poll-unvoted', role: 'member' });
    test('голосование', async ({ app }) => {
      await app.goto('/');
      await shot(app, '12-dark/01-home-poll');
    });
  });

  test.describe('меню администратора', () => {
    test.use({ role: 'admin' });
    test('список и лист добавления', async ({ app }) => {
      await app.goto('/menu');
      await shot(app, '12-dark/02-menu-admin');
      await app.getByRole('button', { name: 'Добавить блюдо' }).click();
      await shot(app, '12-dark/03-menu-add-sheet');
    });
  });

  test('профиль', async ({ app }) => {
    await app.goto('/profile');
    await shot(app, '12-dark/04-profile');
  });

  test('статистика', async ({ app }) => {
    await app.goto('/stats');
    await shot(app, '12-dark/05-stats');
  });

  test.describe('админ-панель', () => {
    test.use({ role: 'admin' });
    test('обзор', async ({ app }) => {
      await app.goto('/admin');
      await shot(app, '12-dark/06-admin');
    });
  });

  test.describe('закупка в магазине', () => {
    test.use({ scenario: 'store-shopping', role: 'storeInitiator' });
    test('покупки', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '12-dark/07-store-run');
    });

    /* В тёмной теме .noticeLink и раньше падал по контрасту (3.80) — тёмный
       кадр этого нотиса нужен отдельно. */
    test('нотис о непроставленных ценах', async ({ app, api }) => {
      api.state.storeRuns[0].items.forEach((item) => {
        if (item.status === 'BOUGHT') item.price = null;
      });
      await app.goto('/store-run/601');
      await shot(app, '12-dark/07b-store-run-unpriced');
    });
  });

  test.describe('бюджет', () => {
    test.use({ scenario: 'budget-debtor', role: 'debtor' });
    test('мои долги', async ({ app }) => {
      await app.goto('/budget');
      await shot(app, '12-dark/09-budget-debtor');
    });
  });

  test.describe('бюджет, сборщик', () => {
    test.use({ scenario: 'budget-responsible', role: 'responsible' });
    test('вам должны', async ({ app }) => {
      await app.goto('/budget');
      await shot(app, '12-dark/09b-budget-responsible');
    });
  });

  test.describe('закупка рассчитана, должник', () => {
    test.use({ scenario: 'store-settled', role: 'storeParticipant' });
    test('выход к оплате', async ({ app }) => {
      await app.goto('/store-run/601');
      await shot(app, '12-dark/07c-store-run-settled');
    });
  });

  test.describe('предложения', () => {
    test.use({ scenario: 'suggestions', role: 'member' });
    test('список', async ({ app }) => {
      await app.goto('/suggestions');
      await shot(app, '12-dark/08-suggestions');
    });
  });
});
