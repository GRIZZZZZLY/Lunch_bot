/**
 * Расписание автоголосований. Работает без человека, поэтому каждая защита тут
 * важнее обычного:
 *
 * - «уже запускали сегодня» и «в группе есть активное голосование» должны
 *   останавливать запуск, иначе в чате появляются дубли;
 * - блюда для автоголосования берутся из расписания, если оно их задаёт.
 *
 * Создание и правка расписаний, права и «бота выгнали — расписание
 * выключается» проверяют интеграционные тесты на тестовой БД.
 */
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { PollService } from '../../../services/poll.service';
import { MenuService } from '../../../services/menu.service';
import { notificationService } from '../../../services/notification.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getActivePollInGroup: jest.fn(), createPoll: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getActivePollInGroup: jest.fn(),
  },
}));

jest.mock('../../../services/menu.service', () => ({
  MenuService: { getActiveMenuItems: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupById: jest.fn() },
}));

jest.mock('../../../services/notification.service', () => ({
  notificationService: { botCanPostToGroup: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const pollService = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const menuService = asServiceMock(MenuService);
const notifications = asServiceMock(notificationService);
const botInstance = asMock(getBotInstance);

/** Понедельник, 09:00 по местному времени процесса. */
const MONDAY_9AM = new Date(2026, 7, 3, 9, 0, 0);

function recurringFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    groupId: 100,
    daysOfWeek: '[1,2,3,4,5]',
    timeOfDay: '11:30',
    duration: 30,
    selectedMenuItemIds: null,
    createdBy: 1,
    isEnabled: true,
    lastRunAt: null,
    nextRunAt: new Date(2026, 7, 3, 11, 30, 0),
    group: { id: 100, telegramId: BigInt(-1001), title: 'Команда', isActive: true },
    creator: { id: 1, firstName: 'Игорь' },
    ...overrides,
  };
}

let sendMessage: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(MONDAY_9AM);

  sendMessage = jest.fn().mockResolvedValue({ message_id: 77 });
  botInstance.mockReturnValue({ api: { sendMessage } });

  asMock(prismaMock.group.findUnique).mockResolvedValue({ id: 100 });
  asMock(prismaMock.menuItem.count).mockResolvedValue(2);
  asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(null);
  asMock(prismaMock.recurringPoll.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
  asMock(prismaMock.recurringPoll.update).mockResolvedValue(
    recurringFixture()
  );
  asMock(prismaMock.recurringPoll.delete).mockResolvedValue({ id: 1 });
  asMock(prismaMock.poll.update).mockResolvedValue({ id: 5 });
  asMock(prismaMock.groupMember.findFirst).mockResolvedValue({ id: 1 });

  pollQuery.getActivePollInGroup.mockResolvedValue(null);
  pollService.createPoll.mockResolvedValue({ id: 5 });
  menuService.getActiveMenuItems.mockResolvedValue([{ id: 1 }, { id: 2 }]);
  notifications.botCanPostToGroup.mockResolvedValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createRecurring', () => {
  const data = {
    groupId: 100,
    daysOfWeek: [1, 3, 5],
    timeOfDay: '11:30',
    duration: 30,
    createdBy: 1,
  };

  it.each([
    ['без дней недели', { daysOfWeek: [] }],
    ['время без двоеточия', { timeOfDay: '1130' }],
    ['час 24', { timeOfDay: '24:00' }],
    ['длительность меньше 5 минут', { duration: 4 }],
    ['длительность больше 180 минут', { duration: 181 }],
  ])('%s — отказ', async (_label, override) => {
    await expect(
      RecurringPollService.createRecurring({ ...data, ...override })
    ).rejects.toThrow();
    expect(prismaMock.recurringPoll.create).not.toHaveBeenCalled();
  });
});

describe('updateRecurring', () => {
  beforeEach(() => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );
  });

  it.each([
    ['невалидное время', { timeOfDay: '99:99' }],
    ['длительность вне диапазона', { duration: 1000 }],
  ])('%s — отказ', async (_label, patch) => {
    await expect(
      RecurringPollService.updateRecurring(1, patch)
    ).rejects.toThrow();
  });
});

describe('getActiveSchedules', () => {
  it('берёт только включённые, созревшие и в живых группах', async () => {
    asMock(prismaMock.recurringPoll.findMany).mockResolvedValue([] as never);

    await RecurringPollService.getActiveSchedules();

    expect(prismaMock.recurringPoll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          nextRunAt: { lte: MONDAY_9AM },
          group: { isActive: true },
        },
      })
    );
  });
});

describe('executeScheduledPoll', () => {
  beforeEach(() => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );
  });

  it('сообщение уходит в группу, messageId сохраняется', async () => {
    await RecurringPollService.executeScheduledPoll(1);

    expect(sendMessage).toHaveBeenCalledWith(
      -1001,
      expect.any(String),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
    expect(prismaMock.poll.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { messageId: 77, chatId: BigInt(-1001) },
    });
  });

  it('повторный запуск в тот же день пропускается', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture({ lastRunAt: MONDAY_9AM })
    );

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'SKIPPED_CONFLICT' });
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('активное голосование в группе останавливает запуск', async () => {
    pollQuery.getActivePollInGroup.mockResolvedValue({ id: 9 });

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'SKIPPED_CONFLICT' });
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('заданный список блюд берётся из расписания', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture({ selectedMenuItemIds: '[7,8]' })
    );

    await RecurringPollService.executeScheduledPoll(1);

    expect(menuService.getActiveMenuItems).not.toHaveBeenCalled();
    expect(prismaMock.poll.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { selectedMenuItemIds: '[7,8]', isAutomatic: true },
    });
  });

  it('меньше двух активных блюд — запуск отменяется', async () => {
    menuService.getActiveMenuItems.mockResolvedValue([{ id: 1 }]);

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'FAILED_NO_MENU' });
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('без поднятого бота голосование всё равно создаётся', async () => {
    botInstance.mockReturnValue(null);

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ success: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('падение отправки сообщения не отменяет созданное голосование', async () => {
    sendMessage.mockRejectedValue(new Error('chat not found'));

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ success: true, pollId: 5 });
  });

  it('расписания нет — статус ошибки, а не исключение', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(null);

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({
      success: false,
      status: 'FAILED_ERROR',
    });
  });

  it('падение создания голосования фиксируется как ошибка запуска', async () => {
    pollService.createPoll.mockRejectedValue(new Error('db down'));

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'FAILED_ERROR', message: 'db down' });
  });

  it('после успешного запуска пересчитывается следующее время', async () => {
    await RecurringPollService.executeScheduledPoll(1);

    expect(prismaMock.recurringPoll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastRunStatus: 'SUCCESS',
          lastRunAt: MONDAY_9AM,
          nextRunAt: expect.any(Date),
        }),
      })
    );
  });
});

describe('calculateNextRun', () => {
  it('сегодня, если день подходит и время впереди', () => {
    const next = RecurringPollService.calculateNextRun([1, 2, 3], '11:30');

    expect(next).toEqual(new Date(2026, 7, 3, 11, 30, 0));
  });

  it('время уже прошло — переносится на следующий подходящий день', () => {
    const next = RecurringPollService.calculateNextRun([1, 2], '08:00');

    // Понедельник 08:00 прошёл — следующий вторник.
    expect(next.getDate()).toBe(4);
    expect(next.getHours()).toBe(8);
  });

  it('день не подходит — ищется ближайший из списка', () => {
    const next = RecurringPollService.calculateNextRun([6], '11:30');

    // Ближайшая суббота.
    expect(next.getDay()).toBe(6);
  });

  it('воскресенье как день 0 тоже находится', () => {
    const next = RecurringPollService.calculateNextRun([0], '11:30');

    expect(next.getDay()).toBe(0);
  });
});

describe('getExecutionHistory', () => {
  it('ошибка чтения даёт пустую историю, а не исключение', async () => {
    asMock(prismaMock.poll.findMany).mockRejectedValue(new Error('db down'));

    await expect(
      RecurringPollService.getExecutionHistory(100)
    ).resolves.toEqual([]);
  });
});

describe('checkAdminAccess', () => {
  it('ошибка базы трактуется как отказ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.checkAdminAccess(1, 100)).resolves.toBe(
      false
    );
  });
});
