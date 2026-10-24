/**
 * Сообщения и клавиатуры для группового чата — чистые функции. Проверяются
 * решения, которые ломают сценарий в группе, а не вёрстка:
 *
 * - кнопка голосования — Direct Link (t.me/.../?startapp), а не web_app:
 *   web_app-кнопки в группах Telegram не принимает вовсе;
 * - пользовательский ввод экранирован: сообщения уходят в Markdown, и
 *   неэкранированный `_` даёт от Telegram 400 «can't parse entities»;
 * - итоги называют победителя, а остаток времени считается от реальных полей.
 */
import {
  createPollStartedMessage,
  createCompactPollKeyboard,
  createCompactPollMessage,
  createResultsMessage,
} from '../../../bot/keyboards/poll.keyboard';

const NOW = new Date('2026-08-03T09:00:00.000Z');

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

it('кнопка активного голосования — Direct Link, а не web_app', () => {
  const [button] = createCompactPollKeyboard(7).inline_keyboard[0];

  expect(button).not.toHaveProperty('web_app');
  expect(button).toHaveProperty('url', expect.stringMatching(/^https:\/\/t\.me\/.*startapp=vote_7/));
});

/* Остаток считается от `startedAt` + `duration`. Раньше и код, и тест
   смотрели на `poll.endTime` — поля с таким именем в схеме нет, то есть тест
   закреплял не поведение, а ошибку: в проде строка не появлялась никогда. */
it('остаток времени в итогах считается от startedAt + duration', () => {
  const message = createResultsMessage({
    poll: {
      title: 'Обед',
      status: 'ACTIVE',
      startedAt: new Date('2026-08-03T08:30:00.000Z'),
      duration: 50,
    },
    breakdown: [],
    totalVotes: 5,
  });

  expect(/(\d+) мин/.exec(message)?.[1]).toBe('20');
});

/* Гейт стоял на `result.winnerItem`, чего ни один ответ не содержит. Победителя
   нет в разбивке, чтобы имя могло попасть в сообщение только из `result`. */
it('итоги завершённого голосования называют победителя', () => {
  const message = createResultsMessage({
    poll: { title: 'Обед', status: 'COMPLETED' },
    result: { winnerMenuItem: { name: 'Шаурма' } },
    breakdown: [{ menuItemName: 'Плов', votes: 3, percentage: 60, voters: [] }],
    totalVotes: 5,
  });

  expect(message).toContain('Шаурма');
});

/* Название блюда экранировалось, а имена ответственного и голосовавших в тех
   же сообщениях — нет. */
it.each<[string, () => string, string[]]>([
  /* Анонс уходит сразу после создания голосования, и `400 can't parse
     entities` роняет весь сценарий запуска, а не только текст в чате. */
  ['название голосования в анонсе', () => createPollStartedMessage(NOW, 'Обед_в *Пловной*'), ['Обед\\_в \\*Пловной\\*']],
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
])('экранируется: %s', (_name, build, fragments) => {
  const message = build();

  for (const fragment of fragments) {
    expect(message).toContain(fragment);
  }
});
