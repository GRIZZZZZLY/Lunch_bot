/**
 * Уведомления домена «голосования». Отправка идёт через реальный транспорт
 * (`notification.service`) — замокан только бот и Prisma, поэтому тесты видят
 * ровно тот текст, который уйдёт в Telegram.
 *
 * Проверяется в первую очередь то, что пользователь замечает как «бот
 * молчит» или «бот прислал кракозябры»: кому уходит сообщение, сколько раз, и
 * читаем ли текст.
 */
import { PollNotificationService } from '../../../services/poll-notification.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Бот приходит из общего синглтона, а не из `initialize(bot)` на экземпляре.
 * Раньше «бота нет» изображал свежий `new`-экземпляр; теперь у сервисов нет
 * своего поля, и отсутствие бота — это пустой синглтон.
 */
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

const mockedGetBotInstance = getBotInstance as jest.MockedFunction<
  typeof getBotInstance
>;

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: PollNotificationService;
let sendMessage: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 42 });

  service = new PollNotificationService();
  mockedGetBotInstance.mockReturnValue({
    api: { sendMessage },
    botInfo: { id: 999 },
  } as never);

  prismaMock.user.findUnique.mockResolvedValue({ isActive: true } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

function withoutBot(): PollNotificationService {
  mockedGetBotInstance.mockReturnValue(null);
  return service;
}

describe('уведомления по голосованию', () => {
  it('уведомление о старте голосования содержит число блюд', async () => {
    await service.sendPollStartedNotification([555], {
      groupTitle: 'Команда',
      menuItems: [{ id: 1 }, { id: 2 }],
      endTime: new Date('2026-08-03T13:00:00.000Z'),
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('2');
  });

  it('уведомление о завершении в режиме multi-winner перечисляет блюда и людей', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'multi-winner',
      totalVotes: 5,
      winners: [
        {
          menuItemName: 'Плов',
          voters: [
            { firstName: 'Игорь' },
            { firstName: 'Аня' },
            { firstName: 'Оля' },
            { firstName: 'Дима' },
          ],
        },
      ],
      bringOwn: { count: 2, voters: [{ firstName: 'Женя' }] },
      skipped: { count: 1 },
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('*Плов* — 4 человека');
    expect(message).toContain('Игорь, Аня, Оля и ещё 1');
    expect(message).toContain('Принесу своё:* 2 человека');
    expect(message).toContain('Пропустили:* 1 человек');
  });

  it('пустое голосование получает отдельный текст', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'single-winner',
      totalVotes: 0,
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('Никто не проголосовал');
  });

  it('single-winner называет победителя и топ', async () => {
    await service.sendPollEndedNotification([555], {
      mode: 'single-winner',
      totalVotes: 3,
      winnerItem: { name: 'Плов', price: 250 },
      topItems: [
        { item: { name: 'Плов' }, votes: 2, percentage: 67 },
        { item: { name: 'Шурпа' }, votes: 1, percentage: 33 },
      ],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('*Победитель:* Плов');
    expect(message).toContain('250.00 руб.');
    expect(message).toContain('🥇 Плов - 2 голоса');
    expect(message).toContain('🥈 Шурпа - 1 голос');
  });
});

describe('sendPollCompletionNotifications', () => {
  const pollFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 5,
    group: { title: 'Команда' },
    result: {
      totalVotes: 2,
      rouletteData: null,
      winnerMenuItem: { id: 1, name: 'Плов', description: null, price: 250 },
    },
    votes: [
      { userId: 1, menuItemId: 1, user: { id: 1 }, menuItem: { id: 1, name: 'Плов', price: 250 } },
      { userId: 2, menuItemId: 1, user: { id: 2 }, menuItem: { id: 1, name: 'Плов', price: 250 } },
    ],
    ...overrides,
  });

  it('single-winner: уведомления уходят каждому голосовавшему по одному разу', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(pollFixture() as never);

    const results = await service.sendPollCompletionNotifications(5);

    expect(results).toHaveLength(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('multi-winner распознаётся по rouletteData', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(
      pollFixture({
        result: {
          totalVotes: 2,
          rouletteData: JSON.stringify({
            mode: 'multi-winner',
            winners: [{ menuItemName: 'Плов', voters: [{ firstName: 'Игорь' }] }],
            bringOwn: { count: 0 },
            skipped: { count: 0 },
          }),
          winnerMenuItem: null,
        },
      }) as never
    );

    await service.sendPollCompletionNotifications(5);

    expect(sendMessage.mock.calls[0][1]).toContain('Кто что заказывает');
  });

  it('битый rouletteData откатывается в single-winner', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(
      pollFixture({
        result: {
          totalVotes: 2,
          rouletteData: '{не json',
          winnerMenuItem: { id: 1, name: 'Плов', description: null, price: null },
        },
      }) as never
    );

    await service.sendPollCompletionNotifications(5);

    expect(sendMessage.mock.calls[0][1]).toContain('Победитель');
  });

  it('без результата — исключение', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    await expect(service.sendPollCompletionNotifications(5)).rejects.toThrow(
      'Poll or result not found'
    );
  });
});

describe('notifyResponsible', () => {
  it('шлёт поздравление выбранному ответственному', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      result: {
        totalVotes: 3,
        responsibleUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
        winnerMenuItem: { name: 'Плов', price: 250 },
      },
    } as never);
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { user: { id: 1, firstName: 'Игорь', username: 'igor' } },
    ] as never);

    const result = await service.notifyResponsible(5, 1);

    expect(result.success).toBe(true);
    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Поздравляем, Игорь');
    expect(message).toContain('Заказываем: Плов');
    expect(message).toContain('250.00 руб.');
  });

  it('без результата голосования возвращает ошибку, а не падает', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    const result = await service.notifyResponsible(5, 1);

    expect(result).toMatchObject({
      success: false,
      error: 'Poll or poll result not found',
    });
  });
});

describe('sendPollCancelledNotifications', () => {
  it('сообщает голосовавшим об отмене и причине', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      votes: [
        { user: { id: 1, firstName: 'Игорь', lastName: null, telegramId: BigInt(555) } },
      ],
    } as never);

    await service.sendPollCancelledNotifications(
      5,
      { id: 9, firstName: 'Аня' } as never,
      'перенесли обед'
    );

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('отменено администратором Аня');
    expect(message).toContain('Причина: перенесли обед');
    expect(message).toContain('• Игорь');
  });

  it('длинный список голосовавших сокращается', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: { title: 'Команда' },
      votes: Array.from({ length: 12 }, (_, i) => ({
        user: {
          id: i + 1,
          firstName: `Гость${i + 1}`,
          lastName: null,
          telegramId: BigInt(1000 + i),
        },
      })),
    } as never);

    await service.sendPollCancelledNotifications(5, { id: 9, firstName: 'Аня' } as never);

    expect(sendMessage.mock.calls[0][1]).toContain('и еще 2');
  });

  it('голосования нет — тихо выходим', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);

    await expect(
      service.sendPollCancelledNotifications(5, { id: 9 } as never)
    ).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без бота уведомления не отправляются', async () => {
    const fresh = withoutBot();
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      group: {},
      votes: [{ user: { id: 1, telegramId: BigInt(555) } }],
    } as never);

    await fresh.sendPollCancelledNotifications(5, { id: 9 } as never);

    expect(sendMessage).not.toHaveBeenCalled();
  });
});

/**
 * Текст шаблонов однажды был испорчен перекодировкой: UTF-8 байты прочитаны
 * как windows-1251 и записаны обратно, так что от `Началось голосование!`
 * осталась нечитаемая последовательность (пример — в
 * scripts/check-mojibake.mjs). Дожило это до коммита именно потому, что НИ
 * ОДИН тест не смотрел на сам текст: все проверки касались того, кому и
 * сколько раз уходит сообщение.
 *
 * Здесь закреплены читаемые строки. Тест намеренно сверяет подстроки, а не
 * шаблон целиком: цель — поймать порчу кодировки, а не запретить правки
 * формулировок.
 *
 * Честная оговорка о силе этих тестов: до починки кодировки упал бы только
 * первый из них (текст POLL_STARTED действительно был испорчен). Остальные —
 * не доказательство, а забор: они закрепляют текст, который уже был читаемым.
 *
 * Заголовки и ORDER_REMINDER здесь по-прежнему не проверить: `getTitle` не
 * вызывается ни одним рабочим путём, а у ORDER_REMINDER нет публичного метода
 * отправки. Это закрыто с другой стороны — реестр вынесен в
 * `notification.templates.ts` и проверяется как данные в
 * `notification.templates.test.ts`, где отправка не нужна вовсе.
 */
describe('читаемость текста шаблонов', () => {
  /** Маркеры mojibake из scripts/check-mojibake.mjs. */
  const MOJIBAKE = /Р[°Ѕµё‘‚]|С[‚†Ѓњ‹]/;

  it('уведомление о старте голосования читаемо', async () => {
    await service.sendPollStartedNotification([555], {
      groupTitle: 'Команда',
      menuItems: [{ id: 1, name: 'Плов' }],
      endTime: NOW,
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('В группе *Команда* началось новое голосование!');
    expect(message).toContain('Доступно блюд: 1');
    expect(message).toContain('Проголосуй в чате группы!');
  });

  it('уведомление победителю рулетки читаемо', async () => {
    await service.sendRouletteWinnerNotification({
      winner: { firstName: 'Игорь', telegramId: BigInt(555) },
      winnerItem: { name: 'Плов', price: 250 },
      voters: [{ id: 1 }, { id: 2 }],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('Поздравляем, Игорь!');
    expect(message).toContain('Рулетка выбрала тебя ответственным за заказ.');
    expect(message).toContain('Заказываем: Плов');
    expect(message).toContain('Участников: 2');
  });

  it('уведомление о завершении голосования читаемо', async () => {
    await service.sendPollEndedNotification([555], {
      totalVotes: 3,
      groupTitle: 'Команда',
      winners: [],
    } as never);

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).not.toMatch(MOJIBAKE);
    expect(message).toContain('Всего голосов: 3');
  });

  it('пустое голосование объясняет себя человеческим текстом', async () => {
    await service.sendPollEndedNotification([555], {
      totalVotes: 0,
      groupTitle: 'Команда',
      winners: [],
    } as never);

    expect(sendMessage.mock.calls[0][1]).toContain(
      'Никто не проголосовал. Все на диете?'
    );
  });
});
