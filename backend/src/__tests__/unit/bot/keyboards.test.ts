/**
 * Сообщения и клавиатуры для группового чата. Проверяются решения, а не
 * вёрстка: какие кнопки есть в каком состоянии, куда они ведут, сколько минут
 * осталось и что пользовательский ввод экранирован (сообщения уходят в
 * Markdown, и неэкранированный `_` даёт от Telegram 400 «can't parse entities»).
 *
 * Кнопка голосования — Direct Link (t.me/.../?startapp), а не web_app:
 * web_app-кнопки в группах не работают вообще.
 */
import {
  createPollStartedMessage,
  createCompactPollKeyboard,
  createCompactPollMessage,
  createResultsMessage,
} from '../../../bot/keyboards/poll.keyboard';
import {
  createWebAppButton,
  createDirectLinkMiniAppUrl,
  createGroupWelcomeKeyboard,
  createVoteWebAppKeyboard,
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
    // 09:30 UTC = 12:30 в Москве.
    expect(createPollStartedMessage(new Date('2026-08-03T09:30:00.000Z'))).toContain('12:30');
  });
});

describe('createCompactPollKeyboard', () => {
  it('активное голосование: кнопка — Direct Link на голосование, а не web_app', () => {
    const [button] = createCompactPollKeyboard(7).inline_keyboard[0];

    expect(button).not.toHaveProperty('web_app');
    expect(button).toHaveProperty('url', expect.stringMatching(/^https:\/\/t\.me\/.*startapp=vote_7/));
  });

  it.each(['completed', 'with_responsible'] as const)(
    'состояние %s кнопок не показывает',
    status => {
      expect(createCompactPollKeyboard(7, status).inline_keyboard).toEqual([]);
    }
  );
});

/** Минуты остатка из текста сообщения; null, если строки остатка нет. */
function minutesLeft(message: string): number | null {
  const match = /(\d+) мин/.exec(message);
  return match ? Number(match[1]) : null;
}

describe('остаток времени активного голосования', () => {
  it.each<[string, () => string, number | null]>([
    [
      'компактное: прошло 10 из 30 минут',
      () =>
        createCompactPollMessage(
          { duration: 30, startedAt: new Date('2026-08-03T08:50:00.000Z') },
          5,
          2,
          8
        ),
      20,
    ],
    [
      'компактное: без startedAt берётся полная длительность',
      () => createCompactPollMessage({ duration: 15 }, 3),
      15,
    ],
    [
      'компактное: остаток не уходит в минус',
      () =>
        createCompactPollMessage(
          { duration: 5, startedAt: new Date('2026-08-03T08:00:00.000Z') },
          3
        ),
      0,
    ],
    /* Остаток считается от `startedAt` + `duration`. Раньше и код, и тест
       смотрели на `poll.endTime` — поля с таким именем в схеме нет, то есть тест
       закреплял не поведение, а ошибку: в проде строка не появлялась никогда. */
    [
      'результаты: от startedAt + duration',
      () =>
        createResultsMessage({
          poll: {
            title: 'Обед',
            status: 'ACTIVE',
            startedAt: new Date('2026-08-03T08:30:00.000Z'),
            duration: 50,
          },
          breakdown: [],
          totalVotes: 5,
        }),
      20,
    ],
    [
      'результаты: без срока строки остатка нет, и сообщение строится',
      () =>
        createResultsMessage({
          poll: { title: 'Обед', status: 'ACTIVE' },
          breakdown: [],
          totalVotes: 1,
        }),
      null,
    ],
  ])('%s', (_name, build, expected) => {
    expect(minutesLeft(build())).toBe(expected);
  });
});

describe('createResultsMessage', () => {
  /* Гейт стоял на `result.winnerItem`, чего ни один ответ не содержит. Теперь
     условие — на самой связи `winnerMenuItem`, и тест подаёт то, что реально
     приходит из `getPollResult`. Победителя нет в разбивке, чтобы имя могло
     попасть в сообщение только из `result`. */
  it('для завершённого называет победителя', () => {
    const message = createResultsMessage({
      poll: { title: 'Обед', status: 'COMPLETED' },
      result: { winnerMenuItem: { name: 'Шаурма' } },
      breakdown: [{ menuItemName: 'Плов', votes: 3, percentage: 60, voters: [] }],
      totalVotes: 5,
    });

    expect(message).toContain('Шаурма');
  });
});

/* Название блюда экранировалось, а имена ответственного и голосовавших в тех
   же сообщениях — нет. */
describe('пользовательский ввод экранируется', () => {
  it.each<[string, () => string, string[]]>([
    /* Анонс уходит сразу после создания голосования, и `400 can't parse
       entities` роняет весь сценарий запуска, а не только текст в чате. */
    [
      'название голосования в анонсе',
      () => createPollStartedMessage(NOW, 'Обед_в *Пловной*'),
      ['Обед\\_в \\*Пловной\\*'],
    ],
    [
      'имя и логин ответственного',
      () =>
        createCompactPollMessage({ duration: 30, title: null }, 4, 8, 10, {
          status: 'with_responsible',
          breakdown: [],
          responsibleUser: { firstName: 'Аня_К', username: 'anya_k' },
        }),
      ['Аня\\_К', '@anya\\_k'],
    ],
    [
      'блюдо разбивки, голосовавший и ответственный в результатах',
      () =>
        createResultsMessage({
          poll: { title: 'Обед', status: 'COMPLETED' },
          result: { responsibleUser: { firstName: 'Аня_К' } },
          breakdown: [
            {
              menuItemName: 'Соус_острый *акция*',
              votes: 1,
              percentage: 100,
              voters: [{ firstName: 'Игорь_П' }],
            },
          ],
          totalVotes: 1,
        }),
      ['Соус\\_острый \\*акция\\*', 'Игорь\\_П', 'Аня\\_К'],
    ],
    [
      'свёрнутый список голосовавших',
      () =>
        createResultsMessage({
          poll: { title: 'Обед', status: 'COMPLETED' },
          breakdown: [
            {
              menuItemName: 'Плов',
              votes: 6,
              percentage: 100,
              voters: Array.from({ length: 6 }, (_, i) => ({ firstName: `Гость_${i + 1}` })),
            },
          ],
          totalVotes: 6,
        }),
      ['Гость\\_3'],
    ],
  ])('%s', (_name, build, fragments) => {
    const message = build();

    for (const fragment of fragments) {
      expect(message).toContain(fragment);
    }
  });
});

describe('клавиатуры Mini App', () => {
  it('Direct Link собирается из имени бота и short name', () => {
    expect(createDirectLinkMiniAppUrl('vote_7')).toMatch(
      /^https:\/\/t\.me\/[^/]+\/[^?]+\?startapp=vote_7$/
    );
  });

  it('web_app-кнопка получает путь внутри Mini App', () => {
    process.env.WEBAPP_URL = 'https://app.example.com';
    expect(createWebAppButton('Меню', '/menu')?.web_app.url).toMatch(/\/menu$/);
  });

  it('без пути кнопка ведёт в корень', () => {
    process.env.WEBAPP_URL = 'https://app.example.com';
    expect(createWebAppButton('Главная')?.web_app.url).not.toMatch(/\/$/);
  });

  it('приветствие группы: opt-in callback и ссылка на меню группы', () => {
    const buttons = createGroupWelcomeKeyboard(-100500).inline_keyboard.flat();

    expect(buttons.some(b => 'callback_data' in b && b.callback_data === 'optin_-100500')).toBe(true);
    expect(buttons.some(b => 'url' in b && b.url.includes('startapp=menu_-100500'))).toBe(true);
  });

  it('клавиатура голосования — Direct Link', () => {
    expect(createVoteWebAppKeyboard(7).inline_keyboard[0][0].url).toContain('startapp=vote_7');
  });
});
