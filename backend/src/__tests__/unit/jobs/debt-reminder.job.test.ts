/**
 * Автонапоминания о долгах. Задача работает по расписанию, без пользователя:
 * если она сломается, никто не нажмёт кнопку и не увидит ошибку. Поэтому здесь
 * проверяется не только «письма ушли», но и:
 *
 * - выборка ограничена: только PENDING, старше minDebtAge, не чаще intervalDays,
 *   не больше maxReminders раз — иначе человек получает напоминание каждый час;
 * - счётчик напоминаний инкрементится ТОЛЬКО после успешной отправки;
 * - падение отправки одному не отменяет рассылку остальным;
 * - задача идёт под распределённой блокировкой: два процесса не разошлют дубль.
 */
import cron from 'node-cron';

import {
  initDebtReminderJob,
  runDebtReminderJobManually,
} from '../../../jobs/debt-reminder.job';
import { ReminderSettingsService } from '../../../services/reminder-settings.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { withDistributedLock } from '../../../utils/distributed-lock';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

/* Сервис создаётся внутри задачи, поэтому мокается как класс. Обращение к
   заглушке — через функцию: фабрика jest.mock поднимается выше объявлений. */
let reminderStub: Record<string, jest.Mock>;
function currentReminderStub(): Record<string, jest.Mock> {
  return reminderStub;
}

jest.mock('../../../services/reminder-settings.service', () => ({
  ReminderSettingsService: jest.fn(() => currentReminderStub()),
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/distributed-lock', () => ({
  withDistributedLock: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const schedule = asMock(cron.schedule);
const botInstance = asMock(getBotInstance);
const lock = asMock(withDistributedLock);

const NOW = new Date('2026-08-03T10:00:00.000Z');

const SETTINGS = {
  groupId: 100,
  intervalDays: 3,
  minDebtAge: 2,
  maxReminders: 5,
  messageTemplate:
    'Привет, {userName}! Долг {totalAmount} руб.\n{debtsList}\nСамый старый — {oldestDebtAge}.',
};

let sendMessage: jest.Mock;

/** Долг, созданный `daysAgo` дней назад. */
function debt(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    fromUserId: 1,
    amount: 250.5,
    createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
    fromUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
    toUser: { id: 2, firstName: 'Аня', lastName: 'П' },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage } });

  reminderStub = {
    getGroupsWithEnabledReminders: jest.fn().mockResolvedValue([SETTINGS]),
  };

  asMock(prismaMock.transaction.findMany).mockResolvedValue([debt()] as never);
  asMock(prismaMock.transaction.updateMany).mockResolvedValue({
    count: 1,
  });

  // По умолчанию блокировка просто исполняет задачу.
  lock.mockImplementation(async (_key: string, _ttl: number, fn: () => unknown) =>
    fn()
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe('initDebtReminderJob', () => {
  it('регистрирует ежедневный запуск в 10:00', () => {
    initDebtReminderJob();

    expect(schedule).toHaveBeenCalledWith('0 10 * * *', expect.any(Function));
  });

  it('запуск идёт под распределённой блокировкой на 55 минут', async () => {
    initDebtReminderJob();
    const tick = schedule.mock.calls[0][1] as () => Promise<void>;

    await tick();

    expect(lock).toHaveBeenCalledWith(
      'job:debt-reminder',
      55 * 60,
      expect.any(Function)
    );
  });

  it('падение блокировки не выбрасывается из планировщика', async () => {
    lock.mockRejectedValue(new Error('redis down'));
    initDebtReminderJob();
    const tick = schedule.mock.calls[0][1] as () => Promise<void>;

    await expect(tick()).resolves.toBeUndefined();
  });
});

describe('рассылка напоминаний', () => {
  it('отправляет должнику одно письмо со всеми его долгами', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt(),
      debt({ id: 2, amount: 100, toUser: { id: 3, firstName: 'Оля' } }),
    ] as never);

    await runDebtReminderJobManually();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe('555');
    expect(message).toContain('Привет, Игорь!');
    expect(message).toContain('350.50 руб.');
    expect(message).toContain('Аня П: 250.50 руб.');
    expect(message).toContain('Оля : 100.00 руб.');
  });

  it('счётчик напоминаний увеличивается только после успешной отправки', async () => {
    await runDebtReminderJobManually();

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('заблокированный бот не увеличивает счётчик — напоминание не доставлено', async () => {
    sendMessage.mockRejectedValue(new Error('bot was blocked by the user'));

    await runDebtReminderJobManually();

    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('падение одному не отменяет рассылку остальным', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt(),
      debt({
        id: 2,
        fromUserId: 2,
        fromUser: { id: 2, firstName: 'Оля', telegramId: BigInt(777) },
      }),
    ] as never);
    sendMessage
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(undefined);

    await runDebtReminderJobManually();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    /* Счётчик поднят только у доставленного напоминания: у неудачной отправки
       попытка из maxReminders не должна сгорать. */
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [2] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('выборка ограничена настройками группы', async () => {
    await runDebtReminderJobManually();

    const where = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;

    expect(where).toMatchObject({
      status: 'PENDING',
      reminderCount: { lt: 5 },
      fromUser: {
        groupMemberships: { some: { groupId: 100, isActive: true } },
      },
    });
    // Долг старше двух дней.
    expect(where.createdAt).toEqual({
      lte: new Date('2026-08-01T10:00:00.000Z'),
    });
    // Либо ещё не напоминали, либо не чаще, чем раз в три дня.
    expect(where.OR).toEqual([
      { lastReminderAt: null },
      { lastReminderAt: { lte: new Date('2026-07-31T10:00:00.000Z') } },
    ]);
  });

  it('несколько групп обрабатываются по своим настройкам', async () => {
    reminderStub.getGroupsWithEnabledReminders.mockResolvedValue([
      SETTINGS,
      { ...SETTINGS, groupId: 200, maxReminders: 2 },
    ]);

    await runDebtReminderJobManually();

    expect(prismaMock.transaction.findMany).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('без групп с включёнными напоминаниями задача ничего не делает', async () => {
    reminderStub.getGroupsWithEnabledReminders.mockResolvedValue([]);

    await runDebtReminderJobManually();

    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('без должников писем нет', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await runDebtReminderJobManually();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('неподнятый бот не роняет задачу', async () => {
    botInstance.mockReturnValue(null);

    await expect(runDebtReminderJobManually()).resolves.toBeUndefined();
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });

  it('ошибка базы не выбрасывается наружу (иначе упадёт планировщик)', async () => {
    reminderStub.getGroupsWithEnabledReminders.mockRejectedValue(
      new Error('db down')
    );

    await expect(runDebtReminderJobManually()).resolves.toBeUndefined();
  });

  it('рассылка идёт пачками по четыре — лимиты Telegram', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      Array.from({ length: 9 }, (_, i) =>
        debt({
          id: i + 1,
          fromUserId: i + 1,
          fromUser: {
            id: i + 1,
            firstName: `Должник${i + 1}`,
            telegramId: BigInt(1000 + i),
          },
        })
      )
    );

    await runDebtReminderJobManually();

    expect(sendMessage).toHaveBeenCalledTimes(9);
    /* Запись счётчиков — по одному запросу на пачку, а не на должника: раньше
       было девять `updateMany` на девять писем. Пачка, а не весь список,
       намеренно — окно между отправкой и записью ограничено четырьмя
       должниками, и падение внутри пачки повторит напоминание только им. */
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledTimes(3);
    expect(prismaMock.transaction.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: [1, 2, 3, 4] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
    expect(prismaMock.transaction.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: { in: [9] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });
});

describe('формулировка возраста долга', () => {
  /** Возраст в тексте письма для долга, созданного `days` дней назад. */
  async function ageText(days: number): Promise<string> {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt({ createdAt: new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000) }),
    ] as never);

    await runDebtReminderJobManually();

    return sendMessage.mock.calls[0][1] as string;
  }

  it.each([
    [0, 'сегодня'],
    [1, 'вчера'],
    [3, '3 дня назад'],
    [10, '10 дней назад'],
    [21, '21 день назад'],
    [22, '22 дня назад'],
    [25, '25 дней назад'],
    [31, '4 недели назад'],
    [40, '1 месяц назад'],
    [70, '2 месяца назад'],
    [160, '5 месяцев назад'],
  ])('долг %i дней описывается как «%s»', async (days, expected) => {
    expect(await ageText(days)).toContain(expected);
  });
});
