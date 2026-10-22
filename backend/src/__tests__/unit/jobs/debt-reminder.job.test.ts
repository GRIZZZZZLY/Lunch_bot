/**
 * Автонапоминания о долгах. Задача работает по расписанию, без пользователя:
 * если она сломается, никто не нажмёт кнопку и не увидит ошибку. Выборку,
 * рассылку и счётчики на тестовой БД проверяет integration/jobs/debt-reminder;
 * здесь — то, что там не воспроизвести: отказы Telegram, которые повтор не
 * исправит, сбои инфраструктуры и подстановка в шаблон письма.
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
  it('падение блокировки не выбрасывается из планировщика', async () => {
    lock.mockRejectedValue(new Error('redis down'));
    initDebtReminderJob();
    const tick = schedule.mock.calls[0][1] as () => Promise<void>;

    await expect(tick()).resolves.toBeUndefined();
  });
});

describe('рассылка напоминаний', () => {
  /* Повтор такой отправки не поможет. Незасчитанная попытка оставляла долг в
     выборке навсегда: задача каждый день падала на том же человеке, не глядя
     ни на intervalDays, ни на maxReminders. */
  it.each([
    "Call to 'sendMessage' failed! (400: Bad Request: chat not found)",
    "Call to 'sendMessage' failed! (403: Forbidden: bot can't initiate conversation with a user)",
    "Call to 'sendMessage' failed! (403: Forbidden: user is deactivated)",
  ])('отказ навсегда засчитывается как попытка: %s', async errorMessage => {
    sendMessage.mockRejectedValue(new Error(errorMessage));

    await runDebtReminderJobManually();

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
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
});

/**
 * Подстановка в шаблон напоминания. Шаблон настраивает группа, поэтому его
 * `*жирный*` обязан остаться разметкой, а вот подставляемые имена — нет:
 * письмо уходит на `parse_mode: 'Markdown'`.
 */
describe('подстановка в шаблон напоминания', () => {
  it('имя должника и имена кредиторов экранируются', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt({
        fromUser: { id: 1, firstName: 'Соус_острый', telegramId: BigInt(555) },
        toUser: { id: 2, firstName: 'Аня_К', lastName: 'С*ова' },
      }),
    ] as never);

    await runDebtReminderJobManually();

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain('Привет, Соус\\_острый!');
    expect(message).toContain('Аня\\_К С\\*ова');
  });

  /**
   * Ловушка `String.prototype.replace`: со СТРОКОВЫМ вторым аргументом `$&`,
   * `$'`, `` $` `` и `$1` в нём имеют специальное значение. Имя вида `$&`
   * подставляло само себя (`{userName}`), а не имя человека.
   */
  it('спецпоследовательности $& и $\' в имени подставляются буквально', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt({
        fromUser: { id: 1, firstName: "$&$'$1", telegramId: BigInt(555) },
      }),
    ] as never);

    await runDebtReminderJobManually();

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toContain("Привет, $&$'$1!");
    expect(message).not.toContain('{userName}');
  });

  /* `replace` со строкой меняет только ПЕРВОЕ вхождение: во шаблоне с двумя
     `{userName}` второй оставался неподставленным плейсхолдером. */
  it('токен подставляется во все вхождения, а не только в первое', async () => {
    reminderStub.getGroupsWithEnabledReminders.mockResolvedValue([
      {
        ...SETTINGS,
        messageTemplate: '{userName}, долг {totalAmount}. Пока, {userName}!',
      },
    ]);

    await runDebtReminderJobManually();

    const message = sendMessage.mock.calls[0][1] as string;
    expect(message).toBe('Игорь, долг 250.50. Пока, Игорь!');
  });

  /* Подстановка идёт одним проходом: имя, содержащее чужой токен, не должно
     стать точкой второй подстановки. */
  it('токен внутри подставленного имени второй раз не подставляется', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      debt({
        fromUser: {
          id: 1,
          firstName: '{totalAmount}',
          telegramId: BigInt(555),
        },
      }),
    ] as never);

    await runDebtReminderJobManually();

    expect(sendMessage.mock.calls[0][1] as string).toContain(
      'Привет, {totalAmount}!'
    );
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
    [31, '4 недели назад'],
    [40, '1 месяц назад'],
    [70, '2 месяца назад'],
    [160, '5 месяцев назад'],
  ])('долг %i дней описывается как «%s»', async (days, expected) => {
    expect(await ageText(days)).toContain(expected);
  });
});
