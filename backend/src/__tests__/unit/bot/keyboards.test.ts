/**
 * Сообщения и клавиатуры для группового чата. Это единственный текст, который
 * видят все участники сразу, и здесь нет типов, которые ловили бы ошибку:
 * пропавшая кнопка или «1 голоса» вместо «1 голос» выглядят как рабочий код.
 *
 * Отдельно закреплено, что кнопка голосования — Direct Link (t.me/.../?startapp),
 * а не web_app: web_app-кнопки в группах не работают вообще.
 */
import {
  createPollStartedMessage,
  createCompactPollKeyboard,
  createCompactPollMessage,
  formatMultiWinnerResults,
  createResultsMessage,
} from '../../../bot/keyboards/poll.keyboard';
import {
  createWebAppButton,
  createDirectLinkMiniAppUrl,
  createGroupWelcomeKeyboard,
  createVoteWebAppKeyboard,
  createMenuWebAppKeyboard,
  createPollWebAppKeyboard,
  createResultsWebAppKeyboard,
  createPollActionsKeyboard,
  createResponsibleKeyboard,
} from '../../../bot/keyboards/webapp.keyboard';

const NOW = new Date('2026-08-03T09:00:00.000Z');

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createPollStartedMessage', () => {
  it('показывает дедлайн по Москве', () => {
    const message = createPollStartedMessage(
      new Date('2026-08-03T09:30:00.000Z')
    );

    // 09:30 UTC = 12:30 в Москве.
    expect(message).toContain('До 12:30');
    expect(message).toContain('Голосование за обед запущено!');
  });

  it('своё название голосования выносится в заголовок', () => {
    const message = createPollStartedMessage(NOW, 'Пятничный обед');

    expect(message).toContain('**Пятничный обед** — голосование запущено!');
  });

  it('название по умолчанию не дублируется в заголовке', () => {
    const message = createPollStartedMessage(NOW, 'Голосование за обед');

    expect(message).toContain('**Голосование за обед запущено!**');
  });

  it('пустое название не ломает заголовок', () => {
    expect(createPollStartedMessage(NOW, null)).toContain(
      'Голосование за обед запущено!'
    );
  });
});

describe('createCompactPollKeyboard', () => {
  it('активное голосование получает кнопку Direct Link', () => {
    const keyboard = createCompactPollKeyboard(7);

    expect(keyboard.inline_keyboard[0][0]).toMatchObject({
      text: '🗳️ Проголосовать',
      url: expect.stringContaining('startapp=vote_7'),
    });
  });

  it('кнопка — ссылка, а не web_app (в группах web_app не работает)', () => {
    const keyboard = createCompactPollKeyboard(7);

    expect(keyboard.inline_keyboard[0][0]).not.toHaveProperty('web_app');
    expect(keyboard.inline_keyboard[0][0].url).toMatch(/^https:\/\/t\.me\//);
  });

  it.each(['completed', 'with_responsible'] as const)(
    'состояние %s кнопок не показывает',
    status => {
      expect(createCompactPollKeyboard(7, status).inline_keyboard).toEqual([]);
    }
  );

  it('неизвестное состояние тоже даёт пустую клавиатуру', () => {
    const keyboard = createCompactPollKeyboard(
      7,
      'что-то' as unknown as 'active'
    );

    expect(keyboard.inline_keyboard).toEqual([]);
  });
});

describe('createCompactPollMessage — активное голосование', () => {
  const poll = {
    duration: 30,
    startedAt: new Date('2026-08-03T08:50:00.000Z'),
    title: null,
  };

  it('считает остаток времени от начала голосования', () => {
    const message = createCompactPollMessage(poll, 5, 2, 8);

    // Прошло 10 минут из 30.
    expect(message).toContain('Осталось: 20 мин');
    expect(message).toContain('Блюд в меню: 5');
    expect(message).toContain('Участвуют: 2 из 8');
  });

  it('без известного числа участников показывает только проголосовавших', () => {
    const message = createCompactPollMessage(poll, 5, 2);

    expect(message).toContain('Проголосовало: 2');
    expect(message).not.toContain('из');
  });

  it('без startedAt берётся полная длительность', () => {
    const message = createCompactPollMessage({ duration: 15 }, 3);

    expect(message).toContain('Осталось: 15 мин');
  });

  it('остаток не уходит в минус', () => {
    const message = createCompactPollMessage(
      { duration: 5, startedAt: new Date('2026-08-03T08:00:00.000Z') },
      3
    );

    expect(message).toContain('Осталось: 0 мин');
  });

  // Голосование на 30 минут, «сейчас» — 09:00. Значок зависит от ОСТАТКА:
  // старт в 08:35 — прошло 25, осталось 5; старт в 08:32 — осталось 2.
  it.each([
    ['больше пяти минут', '2026-08-03T08:50:00.000Z', '⏰'],
    ['пять минут и меньше', '2026-08-03T08:35:00.000Z', '⚠️'],
    ['две минуты и меньше', '2026-08-03T08:32:00.000Z', '🔥'],
  ])('срочность %s помечается своим значком', (_label, startedAt, emoji) => {
    const message = createCompactPollMessage(
      { duration: 30, startedAt: new Date(startedAt) },
      3
    );

    expect(message).toContain(`${emoji} Осталось`);
  });

  it('своё название выводится строкой', () => {
    const message = createCompactPollMessage(
      { ...poll, title: 'Пятничный обед' },
      3
    );

    expect(message).toContain('📋 Пятничный обед');
  });

  it('название по умолчанию не дублируется', () => {
    const message = createCompactPollMessage(
      { ...poll, title: 'Голосование за обед' },
      3
    );

    expect(message).not.toContain('📋');
  });
});

describe('createCompactPollMessage — завершённое голосование', () => {
  const poll = { duration: 30, title: null };
  const breakdown = [
    { menuItemName: 'Плов', votes: 1, percentage: 50 },
    { menuItemName: 'Шурпа', votes: 2, percentage: 33 },
    { menuItemName: 'Лагман', votes: 5, percentage: 17 },
    { menuItemName: 'Манты', votes: 1, percentage: 0 },
  ];

  it('показывает топ-3 с медалями и правильным падежом', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'completed',
      breakdown,
    });

    expect(message).toContain('🥇 Плов — 1 голос ');
    expect(message).toContain('🥈 Шурпа — 2 голоса ');
    expect(message).toContain('🥉 Лагман — 5 голосов ');
    // Четвёртое блюдо в группу не выводится.
    expect(message).not.toContain('Манты');
  });

  it('после результатов обещает выбор ответственного', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'completed',
      breakdown,
    });

    expect(message).toContain('Выбираем ответственного');
  });

  it('обещание можно подавить (когда ответственный уже известен)', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'completed',
      breakdown,
      suppressResponsiblePrompt: true,
    });

    expect(message).not.toContain('Выбираем ответственного');
  });

  it('без голосов сообщение честно об этом говорит', () => {
    const message = createCompactPollMessage(poll, 4, 0, 10, {
      status: 'completed',
      breakdown: [],
    });

    expect(message).toContain('Никто не проголосовал');
  });

  it('без известного числа участников формулировка короче', () => {
    const message = createCompactPollMessage(poll, 4, 3, 0, {
      status: 'completed',
      breakdown: [],
    });

    expect(message).toContain('Проголосовало: 3');
  });

  it('своё название сохраняется', () => {
    const message = createCompactPollMessage({ ...poll, title: 'Обед' }, 4, 1, 1, {
      status: 'completed',
      breakdown: [],
    });

    expect(message).toContain('📋 Обед');
  });
});

describe('createCompactPollMessage — ответственный назначен', () => {
  const poll = { duration: 30, title: null };

  it('называет ответственного и его логин', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'with_responsible',
      breakdown: [{ menuItemName: 'Плов', votes: 3, percentage: 100 }],
      responsibleUser: { firstName: 'Игорь', username: 'igor' },
    });

    expect(message).toContain('**Ответственный:** Игорь (@igor)');
    expect(message).toContain('Детали отправлены в личные сообщения');
  });

  it('без логина выводится только имя', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'with_responsible',
      breakdown: [],
      responsibleUser: { firstName: 'Игорь' },
    });

    expect(message).toContain('**Ответственный:** Игорь');
    expect(message).not.toContain('(@');
  });

  it('без ответственного блок не появляется', () => {
    const message = createCompactPollMessage(poll, 4, 8, 10, {
      status: 'with_responsible',
      breakdown: [],
    });

    expect(message).not.toContain('Ответственный');
  });

  it('название по умолчанию не дублируется', () => {
    const message = createCompactPollMessage(
      { ...poll, title: 'Голосование за обед' },
      4,
      1,
      0,
      { status: 'with_responsible', breakdown: [] }
    );

    expect(message).not.toContain('📋');
  });

  it('неизвестный статус даёт пустую строку', () => {
    const message = createCompactPollMessage(poll, 4, 0, 0, {
      status: 'что-то' as unknown as 'active',
    });

    expect(message).toBe('');
  });
});

describe('formatMultiWinnerResults', () => {
  const base = {
    winners: [
      {
        menuItemName: 'Плов',
        voteCount: 2,
        voters: [{ firstName: 'Игорь' }, { firstName: 'Аня' }],
      },
    ],
    bringOwn: { count: 0, voters: [] },
    skipped: { count: 0 },
    meta: { completedAt: '2026-08-03T09:00:00.000Z', tieBreak: null },
  };

  it('победитель получает трофей, остальные — вилку', () => {
    const message = formatMultiWinnerResults({
      ...base,
      winners: [
        ...base.winners,
        { menuItemName: 'Шурпа', voteCount: 1, voters: [{ firstName: 'Оля' }] },
      ],
    });

    expect(message).toContain('🏆 <b>Плов</b> — 2 человека');
    expect(message).toContain('🍴 <b>Шурпа</b> — 1 человек');
  });

  it('список голосовавших сворачивается после пяти имён', () => {
    const message = formatMultiWinnerResults({
      ...base,
      winners: [
        {
          menuItemName: 'Плов',
          voteCount: 7,
          voters: Array.from({ length: 7 }, (_, i) => ({
            firstName: `Гость${i + 1}`,
          })),
        },
      ],
    });

    expect(message).toContain('Гость5 и еще 2');
    expect(message).not.toContain('Гость6,');
  });

  it('без победителей так и написано', () => {
    const message = formatMultiWinnerResults({ ...base, winners: [] });

    expect(message).toContain('Нет голосов за блюда');
  });

  it('«принесу своё» показывается с именами', () => {
    const message = formatMultiWinnerResults({
      ...base,
      bringOwn: { count: 2, voters: [{ firstName: 'Оля' }, { firstName: 'Дима' }] },
    });

    expect(message).toContain('🏠 <b>Принесу своё</b> — 2 человека');
    expect(message).toContain('Оля, Дима');
  });

  it('длинный список «принесу своё» тоже сворачивается', () => {
    const message = formatMultiWinnerResults({
      ...base,
      bringOwn: {
        count: 7,
        voters: Array.from({ length: 7 }, (_, i) => ({ firstName: `Г${i}` })),
      },
    });

    expect(message).toContain('и еще 2');
  });

  it('пропустившие обед выводятся отдельной строкой', () => {
    const message = formatMultiWinnerResults({
      ...base,
      skipped: { count: 3 },
    });

    expect(message).toContain('🚫 <b>Пропускаю</b> — 3 человека');
  });

  it('способ разрешения ничьей объясняется', () => {
    const message = formatMultiWinnerResults({
      ...base,
      meta: {
        completedAt: '2026-08-03T09:00:00.000Z',
        tieBreak: { reason: 'Равное число голосов', method: 'earliest' },
      },
    });

    expect(message).toContain('Равное число голосов, выбрано по методу: earliest');
  });

  it('сообщение обрезается до лимита Telegram', () => {
    const message = formatMultiWinnerResults({
      ...base,
      winners: Array.from({ length: 60 }, (_, i) => ({
        menuItemName: `Блюдо ${i} ${'длинное название'.repeat(5)}`,
        voteCount: 1,
        voters: [{ firstName: 'Гость' }],
      })),
    });

    expect(message).toContain('Смотреть полные результаты в приложении');
    expect(message.length).toBeLessThan(4096);
  });

  it('в конце всегда время завершения', () => {
    expect(formatMultiWinnerResults(base)).toContain('Завершено:');
  });
});

describe('createResultsMessage', () => {
  const breakdown = [
    {
      menuItemName: 'Плов',
      votes: 3,
      percentage: 60,
      voters: [{ firstName: 'Игорь' }, { firstName: 'Аня' }],
    },
  ];

  it('для активного голосования показывает остаток времени', () => {
    const message = createResultsMessage({
      poll: {
        title: 'Обед',
        status: 'ACTIVE',
        endTime: new Date('2026-08-03T09:20:00.000Z'),
      },
      breakdown,
      totalVotes: 5,
    });

    expect(message).toContain('Голосование активно');
    expect(message).toContain('Осталось: 20 мин');
  });

  it('активное голосование без endTime не падает', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'ACTIVE' },
      breakdown,
      totalVotes: 1,
    });

    expect(message).toContain('Голосование активно');
    expect(message).not.toContain('Осталось');
  });

  it('для завершённого называет победителя', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      result: { winnerItem: 1, winnerMenuItem: { name: 'Плов' } },
      breakdown,
      totalVotes: 5,
    });

    expect(message).toContain('Голосование завершено');
    expect(message).toContain('**Победитель:** Плов');
  });

  it('рисует прогресс-бар из процентов', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      breakdown: [{ ...breakdown[0], percentage: 50 }],
      totalVotes: 5,
    });

    expect(message).toContain('█████░░░░░');
  });

  it('статистика по типам голосов выводится, когда есть', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      breakdown,
      totalVotes: 6,
      voteTypeStats: {
        menuItemVotes: 3,
        bringOwnVotes: 2,
        skipVotes: 1,
        total: 6,
      },
    });

    expect(message).toContain('Заказывают: 3');
    expect(message).toContain('Принесут из дома: 2');
    expect(message).toContain('Не обедают: 1');
  });

  it('нулевые категории не показываются', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      breakdown,
      totalVotes: 3,
      voteTypeStats: {
        menuItemVotes: 3,
        bringOwnVotes: 0,
        skipVotes: 0,
        total: 3,
      },
    });

    expect(message).not.toContain('Принесут из дома');
    expect(message).not.toContain('Не обедают');
  });

  it('длинный список голосовавших сворачивается после трёх имён', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      breakdown: [
        {
          ...breakdown[0],
          voters: Array.from({ length: 6 }, (_, i) => ({
            firstName: `Гость${i + 1}`,
          })),
        },
      ],
      totalVotes: 6,
    });

    expect(message).toContain('Гость3 и ещё 3');
  });

  it('без голосов дальше результатов не идёт', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      breakdown: [],
      totalVotes: 0,
    });

    expect(message).toContain('Никто не проголосовал');
  });

  it('ответственный дописывается в конце', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      result: { responsible: 1, responsibleUser: { firstName: 'Игорь' } },
      breakdown,
      totalVotes: 3,
    });

    expect(message).toContain('**Ответственный за заказ:** Игорь');
  });
});

describe('клавиатуры Mini App', () => {
  it('Direct Link собирается из имени бота и short name', () => {
    const url = createDirectLinkMiniAppUrl('vote_7');

    expect(url).toMatch(/^https:\/\/t\.me\/[^/]+\/[^?]+\?startapp=vote_7$/);
  });

  it('web_app-кнопка получает путь внутри Mini App', () => {
    const button = createWebAppButton('Меню', '/menu');

    expect(button.text).toBe('Меню');
    expect(button.web_app.url).toMatch(/\/menu$/);
  });

  it('без пути кнопка ведёт в корень', () => {
    const button = createWebAppButton('Главная');

    expect(button.web_app.url).not.toMatch(/\/$/);
  });

  it('приветствие группы: opt-in callback и ссылка на меню', () => {
    const keyboard = createGroupWelcomeKeyboard(-100500);

    expect(keyboard.inline_keyboard[0][0]).toEqual({
      text: '✅ Я обедаю',
      callback_data: 'optin_-100500',
    });
    expect(keyboard.inline_keyboard[1][0]).toMatchObject({
      url: expect.stringContaining('startapp=menu_-100500'),
    });
  });

  it('клавиатура голосования — Direct Link', () => {
    const keyboard = createVoteWebAppKeyboard(7);

    expect(keyboard.inline_keyboard[0][0].url).toContain('startapp=vote_7');
  });

  it('меню, создание голосования и результаты открывают свои экраны', () => {
    expect(createMenuWebAppKeyboard().inline_keyboard[0][0].web_app.url).toMatch(
      /\/menu$/
    );
    expect(createPollWebAppKeyboard().inline_keyboard[0][0].web_app.url).toMatch(
      /\/poll\/create$/
    );
    expect(
      createResultsWebAppKeyboard(7).inline_keyboard[0][0].web_app.url
    ).toMatch(/\/poll\/7\/results$/);
  });

  it('действия голосования: без результатов одна кнопка', () => {
    const keyboard = createPollActionsKeyboard(7);

    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0][0].web_app.url).toContain('?pollId=7');
  });

  it('действия голосования: с результатами две кнопки', () => {
    const keyboard = createPollActionsKeyboard(7, true);

    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[1][0].web_app.url).toMatch(
      /\/poll\/7\/results$/
    );
  });

  it('ответственному дают главную и платежи', () => {
    const keyboard = createResponsibleKeyboard(7);

    expect(keyboard.inline_keyboard).toHaveLength(2);
    expect(keyboard.inline_keyboard[1][0].web_app.url).toMatch(/\/profile$/);
  });
});
