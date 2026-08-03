/**
 * Расписание автоголосований. Работает без человека, поэтому каждая защита тут
 * важнее обычного:
 *
 * - «уже запускали сегодня» и «в группе есть активное голосование» должны
 *   останавливать запуск, иначе в чате появляются дубли;
 * - если бота выгнали из группы, расписание ВЫКЛЮЧАЕТСЯ, а не долбит каждый
 *   день в пустоту;
 * - блюда для автоголосования обязаны принадлежать этой же группе.
 */
import { RecurringPollService } from '../../../services/recurring-poll.service';
import { PollService } from '../../../services/poll.service';
import { MenuService } from '../../../services/menu.service';
import { notificationService } from '../../../services/notification.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/poll.service', () => ({
  PollService: { getActivePollInGroup: jest.fn(), createPoll: jest.fn() },
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

  pollService.getActivePollInGroup.mockResolvedValue(null);
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

  it('создаёт расписание и считает следующий запуск', async () => {
    const created = await RecurringPollService.createRecurring(data);

    expect(created).toMatchObject({
      groupId: 100,
      daysOfWeek: '[1,3,5]',
      timeOfDay: '11:30',
      duration: 30,
    });
    // Сегодня понедельник, 11:30 ещё впереди.
    expect((created as { nextRunAt: Date }).nextRunAt).toEqual(
      new Date(2026, 7, 3, 11, 30, 0)
    );
  });

  it('выбранные блюда проверяются на принадлежность группе', async () => {
    await RecurringPollService.createRecurring({
      ...data,
      selectedMenuItemIds: [1, 2],
    });

    expect(prismaMock.menuItem.count).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] }, groupId: 100, isActive: true, deletedAt: null },
    });
  });

  it('чужое или удалённое блюдо в расписание не попадёт', async () => {
    asMock(prismaMock.menuItem.count).mockResolvedValue(1);

    await expect(
      RecurringPollService.createRecurring({
        ...data,
        selectedMenuItemIds: [1, 999],
      })
    ).rejects.toThrow('must be active and belong to the group');
  });

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

  it('группы нет — отказ', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue(null);

    await expect(RecurringPollService.createRecurring(data)).rejects.toThrow(
      'Group not found'
    );
  });

  it('второе расписание для группы не создаётся', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );

    await expect(RecurringPollService.createRecurring(data)).rejects.toThrow(
      'already has a recurring poll schedule'
    );
  });
});

describe('updateRecurring', () => {
  beforeEach(() => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );
  });

  it('меняет длительность, не пересчитывая расписание', async () => {
    await RecurringPollService.updateRecurring(1, { duration: 45 });

    const data = (
      prismaMock.recurringPoll.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data.duration).toBe(45);
    // Дни и время не менялись — следующий запуск остаётся прежним.
    expect(data.nextRunAt).toEqual(new Date(2026, 7, 3, 11, 30, 0));
  });

  it('смена времени пересчитывает следующий запуск', async () => {
    await RecurringPollService.updateRecurring(1, { timeOfDay: '12:00' });

    const data = (
      prismaMock.recurringPoll.update.mock.calls[0][0] as {
        data: { nextRunAt: Date };
      }
    ).data;
    expect(data.nextRunAt).toEqual(new Date(2026, 7, 3, 12, 0, 0));
  });

  it('список блюд можно очистить', async () => {
    await RecurringPollService.updateRecurring(1, { selectedMenuItemIds: null });

    expect(prismaMock.recurringPoll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ selectedMenuItemIds: null }),
      })
    );
  });

  it('новый список блюд проверяется на принадлежность группе', async () => {
    asMock(prismaMock.menuItem.count).mockResolvedValue(0);

    await expect(
      RecurringPollService.updateRecurring(1, { selectedMenuItemIds: [999] })
    ).rejects.toThrow('must be active and belong to the group');
  });

  it('выключение расписания сохраняется', async () => {
    await RecurringPollService.updateRecurring(1, { isEnabled: false });

    expect(prismaMock.recurringPoll.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEnabled: false }),
      })
    );
  });

  it('расписания нет — отказ', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(null);

    await expect(
      RecurringPollService.updateRecurring(1, { duration: 45 })
    ).rejects.toThrow('Recurring poll not found');
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

describe('простые операции', () => {
  it('удаление', async () => {
    await RecurringPollService.deleteRecurring(1);

    expect(prismaMock.recurringPoll.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('ошибка удаления выбрасывается наружу', async () => {
    asMock(prismaMock.recurringPoll.delete).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.deleteRecurring(1)).rejects.toThrow(
      'db down'
    );
  });

  it('включение и выключение', async () => {
    await RecurringPollService.toggleEnabled(1, false);

    expect(prismaMock.recurringPoll.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isEnabled: false },
    });
  });

  it('ошибка переключения выбрасывается наружу', async () => {
    asMock(prismaMock.recurringPoll.update).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.toggleEnabled(1, true)).rejects.toThrow(
      'db down'
    );
  });

  it('чтение по группе включает группу и автора', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );

    await RecurringPollService.getByGroupId(100);

    expect(prismaMock.recurringPoll.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId: 100 } })
    );
  });

  it('ошибка чтения по группе выбрасывается наружу', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.getByGroupId(100)).rejects.toThrow(
      'db down'
    );
  });

  it('чтение по id', async () => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );

    await expect(RecurringPollService.getById(1)).resolves.toMatchObject({
      id: 1,
    });
  });

  it('все расписания сортируются от новых к старым', async () => {
    asMock(prismaMock.recurringPoll.findMany).mockResolvedValue([] as never);

    await RecurringPollService.getAllSchedules();

    expect(prismaMock.recurringPoll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('ошибка чтения всех расписаний выбрасывается наружу', async () => {
    asMock(prismaMock.recurringPoll.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.getAllSchedules()).rejects.toThrow(
      'db down'
    );
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

  it('ошибка выборки выбрасывается наружу', async () => {
    asMock(prismaMock.recurringPoll.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.getActiveSchedules()).rejects.toThrow(
      'db down'
    );
  });
});

describe('executeScheduledPoll', () => {
  beforeEach(() => {
    asMock(prismaMock.recurringPoll.findUnique).mockResolvedValue(
      recurringFixture()
    );
  });

  it('создаёт голосование, помечает его автоматическим и планирует напоминания', async () => {
    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ success: true, pollId: 5, status: 'SUCCESS' });
    expect(prismaMock.poll.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { selectedMenuItemIds: '[1,2]', isAutomatic: true },
    });
  });

  it('сообщение уходит в группу, messageId сохраняется', async () => {
    await RecurringPollService.executeScheduledPoll(1);

    expect(sendMessage).toHaveBeenCalledWith(
      -1001,
      expect.stringContaining('Голосование за обед запущено'),
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
    pollService.getActivePollInGroup.mockResolvedValue({ id: 9 });

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'SKIPPED_CONFLICT' });
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('бота выгнали — расписание выключается, а не долбит каждый день', async () => {
    notifications.botCanPostToGroup.mockResolvedValue(false);

    const result = await RecurringPollService.executeScheduledPoll(1);

    expect(result).toMatchObject({ status: 'FAILED_BOT_REMOVED' });
    expect(prismaMock.recurringPoll.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isEnabled: false },
    });
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
      message: 'Recurring poll not found',
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
  it('отдаёт автоматические голосования с числом голосов', async () => {
    asMock(prismaMock.poll.findMany).mockResolvedValue([
      {
        id: 5,
        startedAt: MONDAY_9AM,
        status: 'COMPLETED',
        _count: { votes: 4 },
      },
    ] as never);

    const history = await RecurringPollService.getExecutionHistory(100);

    expect(prismaMock.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: 100, isAutomatic: true }),
        take: 7,
      })
    );
    expect(history).toEqual([
      { date: MONDAY_9AM, status: 'COMPLETED', pollId: 5, voteCount: 4 },
    ]);
  });

  it('ошибка чтения даёт пустую историю, а не исключение', async () => {
    asMock(prismaMock.poll.findMany).mockRejectedValue(new Error('db down'));

    await expect(
      RecurringPollService.getExecutionHistory(100)
    ).resolves.toEqual([]);
  });
});

describe('checkAdminAccess', () => {
  it('админ группы проходит', async () => {
    await expect(
      RecurringPollService.checkAdminAccess(1, 100)
    ).resolves.toBe(true);
    expect(prismaMock.groupMember.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 1,
        groupId: 100,
        isActive: true,
        role: { in: ['ADMIN', 'CREATOR'] },
      },
    });
  });

  it('обычный участник не проходит', async () => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue(null);

    await expect(RecurringPollService.checkAdminAccess(1, 100)).resolves.toBe(
      false
    );
  });

  it('ошибка базы трактуется как отказ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(RecurringPollService.checkAdminAccess(1, 100)).resolves.toBe(
      false
    );
  });
});

describe('форматирование для интерфейса', () => {
  it.each([
    ['[0,1,2,3,4,5,6]', 'Каждый день'],
    ['[1,2,3,4,5]', 'Пн-Пт'],
    ['[6,0]', 'Выходные'],
    ['[1,3]', 'Пн, Ср'],
  ])('дни %s описываются как «%s»', (daysOfWeek, expected) => {
    const text = RecurringPollService.formatSchedule(
      recurringFixture({ daysOfWeek }) as never
    );

    expect(text).toContain(expected);
    expect(text).toContain('11:30');
    expect(text).toContain('30 мин');
  });

  it('без следующего запуска так и сказано', () => {
    expect(
      RecurringPollService.getNextRunInfo(
        recurringFixture({ nextRunAt: null }) as never
      )
    ).toBe('Не запланировано');
  });

  it('меньше часа — в минутах', () => {
    expect(
      RecurringPollService.getNextRunInfo(
        recurringFixture({ nextRunAt: new Date(2026, 7, 3, 9, 30, 0) }) as never
      )
    ).toBe('Через 30 мин');
  });

  it('меньше суток — в часах', () => {
    expect(
      RecurringPollService.getNextRunInfo(
        recurringFixture({ nextRunAt: new Date(2026, 7, 3, 14, 0, 0) }) as never
      )
    ).toBe('Через 5 ч');
  });

  it('дальше суток — датой', () => {
    expect(
      RecurringPollService.getNextRunInfo(
        recurringFixture({ nextRunAt: new Date(2026, 7, 5, 11, 30, 0) }) as never
      )
    ).toBe('05.08 в 11:30');
  });
});
