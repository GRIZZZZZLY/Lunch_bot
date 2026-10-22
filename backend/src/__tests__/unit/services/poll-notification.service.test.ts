/**
 * Уведомления домена «голосования». Отправка идёт через реальный транспорт
 * (`notification.service`) — замокан только бот и Prisma, поэтому тесты видят
 * ровно тот текст, который уйдёт в Telegram.
 *
 * Проверяется в первую очередь то, что пользователь замечает как «бот
 * молчит»: кому уходит сообщение и сколько раз. Из текста — только то, что
 * считается: сокращение длинных списков имён, формат денег, причина отмены.
 */
import { PollNotificationService } from '../../../services/poll-notification.service';
import { notificationService } from '../../../services/notification.service';
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
  it('multi-winner: блюдо названо, длинный список голосовавших сокращён', async () => {
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
    expect(message).toContain('Плов');
    expect(message).toContain('Оля');
    expect(message).not.toContain('Дима');
  });

  it('single-winner: цена победителя в рублях с копейками, топ блюд', async () => {
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
    expect(message).toContain('250.00');
    expect(message).toContain('Шурпа');
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
      { userId: 1, menuItemId: 1, user: { id: 1, telegramId: BigInt(1) }, menuItem: { id: 1, name: 'Плов', price: 250 } },
      { userId: 2, menuItemId: 1, user: { id: 2, telegramId: BigInt(2) }, menuItem: { id: 1, name: 'Плов', price: 250 } },
    ],
    ...overrides,
  });

  it('single-winner: уведомления уходят каждому голосовавшему по одному разу', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(pollFixture() as never);

    const results = await service.sendPollCompletionNotifications(5);

    expect(results).toHaveLength(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
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

    await expect(service.sendPollCompletionNotifications(5)).resolves.toHaveLength(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('без результата — исключение', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    await expect(service.sendPollCompletionNotifications(5)).rejects.toThrow(
      'Poll or result not found'
    );
  });

  /**
   * В этом файле `notification.service` не замокан целиком (см. комментарий в
   * шапке файла) — остальные тесты проверяют текст сообщения через мок бота.
   * Здесь же важен не текст, а то, ЧТО именно передаётся в `send` как chat id,
   * поэтому транспорт подменяется точечно через spyOn и восстанавливается
   * сразу после проверки, чтобы не задеть остальные тесты файла.
   */
  it('уведомление о завершении уходит на Telegram id голосовавших, а не на внутренний User.id', async () => {
    const sendSpy = jest
      .spyOn(notificationService, 'send')
      .mockResolvedValue({ success: true } as never);

    try {
      prismaMock.poll.findUnique.mockResolvedValue({
        id: 7,
        group: { title: 'Обед' },
        result: { totalVotes: 2, rouletteData: null, winnerMenuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
        votes: [
          { userId: 1, menuItemId: 1, user: { id: 1, telegramId: BigInt(555000001) }, menuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
          { userId: 2, menuItemId: 1, user: { id: 2, telegramId: BigInt(555000002) }, menuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
        ],
      } as never);

      await service.sendPollCompletionNotifications(7);

      const sentTo = sendSpy.mock.calls.map(([arg]) => arg.userId).sort();
      expect(sentTo).toEqual([555000001, 555000002]);
    } finally {
      sendSpy.mockRestore();
    }
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
    expect(String(sendMessage.mock.calls[0][0])).toBe('555');
  });

  it('без результата голосования возвращает ошибку, а не падает', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({ id: 5 } as never);

    const result = await service.notifyResponsible(5, 1);

    expect(result.success).toBe(false);
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
    expect(message).toContain('Аня');
    expect(message).toContain('перенесли обед');
    expect(message).toContain('Игорь');
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

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Гость10');
    expect(message).not.toContain('Гость11');
    expect(message).not.toContain('Гость12');
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
