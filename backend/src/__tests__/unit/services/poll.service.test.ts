/**
 * Голосование: снимок участников, кворум, завершение с несколькими
 * победителями. Создание из Mini App и автозавершение по таймеру закреплены в
 * poll.service.extensions.test.ts — здесь остальное.
 *
 * Что здесь по-настоящему важно:
 *
 * 1. Кворум считается по СНИМКУ ожидаемых участников, снятому при создании
 *    голосования. Раньше это была эвристика по истории группы, и для новой
 *    группы она давала «ожидается 1 человек» — голосование закрывалось после
 *    первого же голоса. Пустой снимок обязан НЕ закрывать голосование.
 *
 * 2. Завершение идемпотентно и защищено от гонки: переход ACTIVE → COMPLETED
 *    делается updateMany с условием на статус, и второй одновременный вызов
 *    получает существующий результат, а не второй комплект итогов.
 *
 * 3. Тай-брейк при равенстве голосов детерминирован: «раньше проголосовали»
 *    или «по алфавиту». Без этого победитель выбирался бы порядком строк из
 *    БД, то есть случайно.
 *
 * 4. Пост-обработка (уведомления, создание заказов по категориям) вынесена за
 *    транзакцию: её падение не имеет права отменить уже завершённое
 *    голосование.
 */
import { PollService } from '../../../services/poll.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  },
  CacheInvalidator: {
    invalidatePoll: jest.fn(),
    invalidateVote: jest.fn(),
  },
  CACHE_KEYS: {
    ACTIVE_POLLS: 'active_polls',
    ACTIVE_POLLS_GROUP: (groupId: number) => `active_polls_group_${groupId}`,
  },
  CACHE_TTL: { ACTIVE_POLLS: 30 },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupSettings: jest.fn() },
}));

jest.mock('../../../services/notification.service', () => ({
  NotificationService: jest.fn(),
  notificationService: { sendPollCompletionNotifications: jest.fn() },
}));

/* Сервис доподгружает уведомления и заказы по категориям через
   `await import('./x.service.js')`. Для jest это ДРУГОЙ модуль, чем
   './x.service', поэтому оба специфаера мокаются, а `.js` — виртуально. */
jest.mock(
  '../../../services/notification.service.js',
  () => jest.requireMock('../../../services/notification.service'),
  { virtual: true }
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: { createCategoryOrders: jest.fn() },
}));

jest.mock(
  '../../../services/category-order.service.js',
  () => jest.requireMock('../../../services/category-order.service'),
  { virtual: true }
);

jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: { startMultiCategorySelection: jest.fn() },
}));

jest.mock(
  '../../../services/multi-category-responsible.service.js',
  () => jest.requireMock('../../../services/multi-category-responsible.service'),
  { virtual: true }
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');
const {
  cacheService: cacheServiceMock,
  CacheInvalidator: cacheInvalidatorMock,
} = jest.requireMock('../../../services/cache.service');
const { notificationService } = jest.requireMock(
  '../../../services/notification.service'
);
const { CategoryOrderService } = jest.requireMock(
  '../../../services/category-order.service'
);
const { MultiCategoryResponsibleService } = jest.requireMock(
  '../../../services/multi-category-responsible.service'
);

const notifications = asServiceMock(notificationService);
const categoryOrders = asServiceMock(CategoryOrderService);
const multiCategory = asServiceMock(MultiCategoryResponsibleService);

const NOW = new Date('2026-08-03T12:00:00.000Z');

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  cacheServiceMock.getOrSet.mockImplementation(
    async (_key: string, loader: () => Promise<unknown>) => loader()
  );
  cacheInvalidatorMock.invalidatePoll.mockResolvedValue(undefined);

  notifications.sendPollCompletionNotifications.mockResolvedValue(undefined);
  categoryOrders.createCategoryOrders.mockResolvedValue([{ id: 1 }]);
  multiCategory.startMultiCategorySelection.mockResolvedValue(undefined);

  asMock(prismaMock.poll.findUnique).mockResolvedValue(null);
  asMock(prismaMock.poll.findFirst).mockResolvedValue(null);
  asMock(prismaMock.poll.findMany).mockResolvedValue([]);
  asMock(prismaMock.poll.count).mockResolvedValue(0);
  asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.pollParticipant.findMany).mockResolvedValue([]);
  asMock(prismaMock.pollParticipant.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.pollResult.findUnique).mockResolvedValue(null);
  asMock(prismaMock.pollResult.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 700, ...args.data })) as never);
  asMock(prismaMock.groupMember.findMany).mockResolvedValue([]);
  asMock(prismaMock.vote.findMany).mockResolvedValue([]);
  asMock(prismaMock.vote.count).mockResolvedValue(0);
  asMock(prismaMock.vote.groupBy).mockResolvedValue([]);
  asMock(prismaMock.menuItem.findMany).mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Снимок ожидаемых участников снимается ВНУТРИ транзакции createPoll.
 *
 * Публичный `createParticipantSnapshot` был второй реализацией того же правила
 * и в проде не вызывался ни разу: `createPoll` делает снимок сам, иначе
 * голосование могло существовать без списка ожидаемых голосующих, и
 * автозакрытие по кворуму не срабатывало бы. Метод удалён (задача 06), а
 * правило проверяется там, где оно живёт.
 */
describe('снимок участников при создании голосования', () => {
  function members(rows: Array<{ id: number; active?: boolean; participates?: boolean }>) {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue(
      rows.map(row => ({
        participatesInPolls: row.participates ?? true,
        user: { id: row.id, isActive: row.active ?? true },
      }))
    );
  }

  function createdPoll(id = 5) {
    asMock(prismaMock.poll.create).mockResolvedValue({
      id,
      groupId: 100,
      status: 'ACTIVE',
    });
  }

  beforeEach(() => {
    createdPoll();
  });

  it('участники группы попадают в снимок как EXPECTED', async () => {
    members([{ id: 1 }, { id: 2 }]);

    await PollService.createPoll({ groupId: 100, createdBy: 1, duration: 30 });

    expect(asMock(prismaMock.pollParticipant.createMany)).toHaveBeenCalledWith({
      data: [
        { pollId: 5, userId: 1, status: 'EXPECTED' },
        { pollId: 5, userId: 2, status: 'EXPECTED' },
      ],
    });
  });

  it('отказавшийся от обедов помечается EXCLUDED, а не выбрасывается', async () => {
    members([{ id: 1 }, { id: 2, participates: false }]);

    await PollService.createPoll({ groupId: 100, createdBy: 1, duration: 30 });

    const call = asMock(prismaMock.pollParticipant.createMany).mock
      .calls[0][0] as { data: Array<{ userId: number; status: string }> };
    expect(call.data).toEqual([
      { pollId: 5, userId: 1, status: 'EXPECTED' },
      { pollId: 5, userId: 2, status: 'EXCLUDED' },
    ]);
  });

  it('удалённый пользователь в снимок не попадает', async () => {
    members([{ id: 1 }, { id: 2, active: false }]);

    await PollService.createPoll({ groupId: 100, createdBy: 1, duration: 30 });

    const call = asMock(prismaMock.pollParticipant.createMany).mock
      .calls[0][0] as { data: Array<{ userId: number }> };
    expect(call.data.map(row => row.userId)).toEqual([1]);
  });

  it('снимок берётся только по активным членствам', async () => {
    await PollService.createPoll({ groupId: 100, createdBy: 1, duration: 30 });

    expect(asMock(prismaMock.groupMember.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId: 100, isActive: true } })
    );
  });

  it('пустая группа не создаёт пустой снимок и предупреждает', async () => {
    await PollService.createPoll({ groupId: 100, createdBy: 1, duration: 30 });

    expect(asMock(prismaMock.pollParticipant.createMany)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no active members for poll 5')
    );
  });
});

describe('checkQuorumAndComplete', () => {
  /* Завершение проверяется отдельно (completePoll / completePollMultiWinner).
     Здесь важна только логика кворума, поэтому само завершение подменяется. */
  let completePoll: jest.SpyInstance;

  beforeEach(() => {
    completePoll = jest
      .spyOn(PollService, 'completePoll')
      .mockResolvedValue({ id: 700 } as never);
  });

  afterEach(() => {
    completePoll.mockRestore();
  });

  function poll(status = 'ACTIVE') {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({ status });
  }

  function expected(userIds: number[]) {
    asMock(prismaMock.pollParticipant.findMany).mockResolvedValue(
      userIds.map(userId => ({ userId }))
    );
  }

  function voted(userIds: number[]) {
    asMock(prismaMock.vote.findMany).mockResolvedValue(
      userIds.map(userId => ({ userId }))
    );
  }

  it('когда проголосовали все ожидаемые — голосование закрывается', async () => {
    poll();
    expected([1, 2]);
    voted([1, 2]);

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(true);
    expect(completePoll).toHaveBeenCalledWith(5);
  });

  it('пока проголосовали не все, голосование остаётся открытым', async () => {
    poll();
    expected([1, 2]);
    voted([1]);

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(completePoll).not.toHaveBeenCalled();
  });

  it('параллельный вызов, уже закрывший голосование, ошибкой не считается', async () => {
    poll();
    expected([1]);
    voted([1]);
    completePoll.mockRejectedValue(new Error('Poll is already completed'));

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('прочий сбой завершения логируется как ошибка', async () => {
    poll();
    expected([1]);
    voted([1]);
    completePoll.mockRejectedValue(new Error('db down'));

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to auto-complete poll 5'),
      expect.any(Error)
    );
  });

  it('пустой снимок НЕ закрывает голосование', async () => {
    poll();
    expected([]);
    voted([1]);

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no EXPECTED participants')
    );
  });

  it('лишние голоса от неожидаемых участников кворум не подменяют', async () => {
    poll();
    expected([1, 2]);
    voted([1, 99]);

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
  });

  it('неактивное голосование не проверяется', async () => {
    poll('COMPLETED');

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(asMock(prismaMock.pollParticipant.findMany)).not.toHaveBeenCalled();
  });

  it('удалённое голосование не проверяется', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(PollService.checkQuorumAndComplete(5)).resolves.toBe(false);
  });
});

describe('cancelExpiredPolls', () => {
  function active(rows: Array<{ id: number; startedAt: Date; duration: number }>) {
    asMock(prismaMock.poll.findMany).mockResolvedValue(
      rows.map(row => ({ ...row, groupId: 100 }))
    );
  }

  it('истёкшее голосование отменяется, а не завершается', async () => {
    active([
      {
        id: 5,
        startedAt: new Date('2026-08-03T10:00:00.000Z'),
        duration: 30,
      },
    ]);

    await expect(PollService.cancelExpiredPolls(NOW)).resolves.toBe(1);
    expect(asMock(prismaMock.poll.updateMany)).toHaveBeenCalledWith({
      where: { id: 5, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endedAt: NOW },
    });
  });

  it('голосование в пределах таймера не трогается', async () => {
    active([{ id: 5, startedAt: NOW, duration: 30 }]);

    await expect(PollService.cancelExpiredPolls(NOW)).resolves.toBe(0);
    expect(asMock(prismaMock.poll.updateMany)).not.toHaveBeenCalled();
  });

  it('ровно в момент истечения голосование отменяется', async () => {
    active([
      {
        id: 5,
        startedAt: new Date('2026-08-03T11:30:00.000Z'),
        duration: 30,
      },
    ]);

    await expect(PollService.cancelExpiredPolls(NOW)).resolves.toBe(1);
  });

  it('уже отменённое другим процессом не считается дважды', async () => {
    active([
      {
        id: 5,
        startedAt: new Date('2026-08-03T10:00:00.000Z'),
        duration: 30,
      },
    ]);
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });

    await expect(PollService.cancelExpiredPolls(NOW)).resolves.toBe(0);
  });

  it('кэш группы сбрасывается после отмены', async () => {
    active([
      {
        id: 5,
        startedAt: new Date('2026-08-03T10:00:00.000Z'),
        duration: 30,
      },
    ]);

    await PollService.cancelExpiredPolls(NOW);

    expect(cacheInvalidatorMock.invalidatePoll).toHaveBeenCalledWith(5, 100);
  });

  it('без активных голосований ничего не делает', async () => {
    await expect(PollService.cancelExpiredPolls(NOW)).resolves.toBe(0);
  });
});

describe('getTodayCompletedPoll', () => {
  it('берётся последнее завершённое сегодня', async () => {
    asMock(prismaMock.poll.findFirst).mockResolvedValue({
      id: 5,
      endedAt: NOW,
    });

    await expect(PollQueryService.getTodayCompletedPoll(100)).resolves.toMatchObject({
      id: 5,
    });
    expect(asMock(prismaMock.poll.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          groupId: 100,
          status: 'COMPLETED',
          endedAt: { gte: expect.any(Date) },
        }),
      })
    );
  });

  it('если сегодня ничего не было — отдаётся последнее вообще', async () => {
    asMock(prismaMock.poll.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 4, endedAt: new Date('2026-08-01T12:00:00Z') });

    await expect(PollQueryService.getTodayCompletedPoll(100)).resolves.toMatchObject({
      id: 4,
    });
    // Второй запрос — без ограничения по дате.
    const secondCall = asMock(prismaMock.poll.findFirst).mock.calls[1][0] as {
      where: Record<string, unknown>;
    };
    expect(secondCall.where).toEqual({ groupId: 100, status: 'COMPLETED' });
  });

  it('в группе без истории возвращается null', async () => {
    await expect(PollQueryService.getTodayCompletedPoll(100)).resolves.toBeNull();
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.poll.findFirst).mockRejectedValue(new Error('db down'));

    await expect(PollQueryService.getTodayCompletedPoll(100)).rejects.toThrow(
      'Failed to get today completed poll'
    );
  });
});

describe('getPollGroupId', () => {
  it('возвращает группу голосования', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({ groupId: 100 });

    await expect(PollQueryService.getPollGroupId(5)).resolves.toBe(100);
  });

  it('для несуществующего голосования — null', async () => {
    await expect(PollQueryService.getPollGroupId(5)).resolves.toBeNull();
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.poll.findUnique).mockRejectedValue(new Error('db down'));

    await expect(PollQueryService.getPollGroupId(5)).rejects.toThrow(
      'Failed to get poll'
    );
  });
});

describe('getUserParticipationStats', () => {
  function stats(over: Record<string, unknown> = {}) {
    asMock(prismaMock.vote.count).mockResolvedValue(
      (over.totalVotes as number) ?? 4
    );
    asMock(prismaMock.poll.count).mockResolvedValue(
      (over.totalPolls as number) ?? 8
    );
    asMock(prismaMock.vote.groupBy).mockResolvedValue(
      (over.byItem as unknown[]) ?? [{ menuItemId: 1, _count: { id: 3 } }]
    );
    asMock(prismaMock.menuItem.findMany).mockResolvedValue(
      (over.items as unknown[]) ?? [{ id: 1, name: 'Плов' }]
    );
    asMock(prismaMock.vote.findMany).mockResolvedValue(
      (over.recent as unknown[]) ?? [
        {
          pollId: 5,
          createdAt: NOW,
          poll: { id: 5 },
          menuItem: { name: 'Плов' },
        },
      ]
    );
  }

  it('процент участия считается от числа завершённых голосований', async () => {
    stats({ totalVotes: 4, totalPolls: 8 });

    const result = await PollService.getUserParticipationStats(1);

    expect(result).toMatchObject({
      totalVotes: 4,
      totalPolls: 8,
      participationRate: 50,
    });
  });

  it('без завершённых голосований процент — ноль, а не деление на ноль', async () => {
    stats({ totalPolls: 0 });

    expect(
      (await PollService.getUserParticipationStats(1)).participationRate
    ).toBe(0);
  });

  it('любимые блюда получают долю от всех голосов пользователя', async () => {
    stats({ totalVotes: 4, byItem: [{ menuItemId: 1, _count: { id: 3 } }] });

    const result = await PollService.getUserParticipationStats(1);

    expect(result.favoriteItems).toEqual([
      { itemId: 1, itemName: 'Плов', voteCount: 3, percentage: 75 },
    ]);
  });

  it('удалённое блюдо подписывается Unknown, а голоса остаются', async () => {
    stats({ items: [] });

    const result = await PollService.getUserParticipationStats(1);

    expect(result.favoriteItems[0]).toMatchObject({
      itemName: 'Unknown',
      voteCount: 3,
    });
  });

  it('без голосов доля не считается', async () => {
    stats({ totalVotes: 0 });

    expect(
      (await PollService.getUserParticipationStats(1)).favoriteItems[0]
        .percentage
    ).toBe(0);
  });

  it('последняя активность отдаётся с датой в ISO', async () => {
    stats();

    const result = await PollService.getUserParticipationStats(1);

    expect(result.recentActivity).toEqual([
      {
        pollId: 5,
        pollTitle: 'Голосование на обед',
        votedAt: NOW.toISOString(),
        itemName: 'Плов',
      },
    ]);
  });

  it('голос без блюда в активности подписан Unknown', async () => {
    stats({
      recent: [{ pollId: 5, createdAt: NOW, poll: { id: 5 }, menuItem: null }],
    });

    expect(
      (await PollService.getUserParticipationStats(1)).recentActivity[0].itemName
    ).toBe('Unknown');
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.count).mockRejectedValue(new Error('db down'));

    await expect(PollService.getUserParticipationStats(1)).rejects.toThrow(
      'Failed to get user participation stats'
    );
  });
});

describe('completePollMultiWinner', () => {
  interface VoteInit {
    userId: number;
    menuItemId?: number | null;
    name?: string;
    type?: string;
    at?: string;
    price?: number;
  }

  /**
   * @param over          поля голосования; `status` — состояние ДО транзакции
   * @param statusInsideTx состояние, которое сервис увидит уже ВНУТРИ
   *                       транзакции (так моделируется гонка)
   */
  function pollWithVotes(
    votes: VoteInit[],
    over: Record<string, unknown> = {},
    statusInsideTx?: string
  ) {
    const row = {
      id: 5,
      groupId: 100,
      status: 'ACTIVE',
      votes: votes.map((vote, index) => ({
        id: index + 1,
        userId: vote.userId,
        menuItemId: vote.menuItemId ?? null,
        voteType: vote.type ?? 'MENU_ITEM',
        createdAt: new Date(vote.at ?? '2026-08-03T11:00:00.000Z'),
        menuItem:
          vote.menuItemId != null
            ? {
                id: vote.menuItemId,
                name: vote.name ?? `Блюдо ${vote.menuItemId}`,
                price: vote.price ?? 250,
                imageUrl: null,
              }
            : null,
        user: {
          id: vote.userId,
          firstName: `U${vote.userId}`,
          lastName: null,
          username: null,
        },
      })),
      group: { id: 100 },
      ...over,
    };
    asMock(prismaMock.poll.findUnique).mockImplementation((async (args: {
      select?: Record<string, unknown>;
    }) =>
      args.select
        ? {
            status:
              statusInsideTx ?? ((over.status as string) || 'ACTIVE'),
          }
        : row) as never);
    return row;
  }

  /** Разбор сохранённых итогов — они лежат в rouletteData как JSON. */
  function savedResult(): {
    version: number;
    mode: string;
    winners: Array<{
      menuItemId: number;
      menuItemName: string;
      voteCount: number;
      voterIds: number[];
      menuItemSnapshot: { price?: number; imageUrl?: string };
    }>;
    bringOwn: { count: number; voterIds: number[] };
    skipped: { count: number; voterIds: number[] };
    meta: {
      primaryWinnerId: number | null;
      tieBreak?: { method: string; appliedTo: number[]; reason: string };
      params: { minVotes: number; maxWinners: number | null };
      completedBy: number;
    };
  } {
    const call = asMock(prismaMock.pollResult.create).mock.calls[0][0] as {
      data: { rouletteData: string };
    };
    return JSON.parse(call.data.rouletteData);
  }

  it('каждое блюдо с голосами становится победителем', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1, name: 'Плов' },
      { userId: 2, menuItemId: 2, name: 'Суп' },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    const result = savedResult();
    expect(result.winners.map(w => w.menuItemName)).toEqual(['Плов', 'Суп']);
    expect(result.mode).toBe('multi-winner');
    expect(result.version).toBe(1);
  });

  it('победители отсортированы по числу голосов', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1, name: 'Плов' },
      { userId: 2, menuItemId: 2, name: 'Суп' },
      { userId: 3, menuItemId: 2, name: 'Суп' },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    expect(savedResult().winners.map(w => w.menuItemId)).toEqual([2, 1]);
  });

  it('в снимок победителя попадают цена и картинка на момент завершения', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1, name: 'Плов', price: 320 }]);

    await PollService.completePollMultiWinner(5, 1);

    expect(savedResult().winners[0].menuItemSnapshot).toEqual({ price: 320 });
  });

  it('minVotes отсекает блюда с одним случайным голосом', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1, name: 'Плов' },
      { userId: 2, menuItemId: 1, name: 'Плов' },
      { userId: 3, menuItemId: 2, name: 'Суп' },
    ]);

    await PollService.completePollMultiWinner(5, 1, { minVotes: 2 });

    expect(savedResult().winners.map(w => w.menuItemId)).toEqual([1]);
  });

  it('maxWinners ограничивает список', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1 },
      { userId: 2, menuItemId: 2 },
      { userId: 3, menuItemId: 3 },
    ]);

    await PollService.completePollMultiWinner(5, 1, { maxWinners: 2 });

    expect(savedResult().winners).toHaveLength(2);
  });

  it('единственный лидер побеждает без тай-брейка', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1 },
      { userId: 2, menuItemId: 1 },
      { userId: 3, menuItemId: 2 },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    const result = savedResult();
    expect(result.meta.primaryWinnerId).toBe(1);
    expect(result.meta.tieBreak).toBeUndefined();
  });

  it('при равенстве по умолчанию выигрывает тот, за кого проголосовали раньше', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1, at: '2026-08-03T11:30:00.000Z' },
      { userId: 2, menuItemId: 2, at: '2026-08-03T11:00:00.000Z' },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    const result = savedResult();
    expect(result.meta.primaryWinnerId).toBe(2);
    expect(result.meta.tieBreak).toMatchObject({
      method: 'earliest',
      appliedTo: [1, 2],
      reason: '2 блюд с 1 голосами',
    });
  });

  it('алфавитный тай-брейк учитывает русскую сортировку', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1, name: 'Яблоко' },
      { userId: 2, menuItemId: 2, name: 'Борщ' },
    ]);

    await PollService.completePollMultiWinner(5, 1, {
      tieBreakMethod: 'alphabetical',
    });

    const result = savedResult();
    expect(result.meta.primaryWinnerId).toBe(2);
    expect(result.meta.tieBreak?.method).toBe('alphabetical');
  });

  it('«принесу своё» и «пропускаю» считаются отдельно и победителями не становятся', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1 },
      { userId: 2, type: 'BRING_OWN' },
      { userId: 3, type: 'SKIP' },
      { userId: 4, type: 'SKIP' },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    const result = savedResult();
    expect(result.winners).toHaveLength(1);
    expect(result.bringOwn).toMatchObject({ count: 1, voterIds: [2] });
    expect(result.skipped).toMatchObject({ count: 2, voterIds: [3, 4] });
  });

  it('голосование без голосов завершается без победителя', async () => {
    pollWithVotes([]);

    await PollService.completePollMultiWinner(5, 1);

    const result = savedResult();
    expect(result.winners).toEqual([]);
    expect(result.meta.primaryWinnerId).toBeNull();
  });

  it('в итогах сохранены кто и с какими параметрами завершил', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);

    await PollService.completePollMultiWinner(5, 9, {
      minVotes: 2,
      maxWinners: 3,
    });

    expect(savedResult().meta).toMatchObject({
      completedBy: 9,
      params: { minVotes: 2, maxWinners: 3 },
    });
  });

  it('статус переводится атомарно, с условием на ACTIVE', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);

    await PollService.completePollMultiWinner(5, 1);

    expect(asMock(prismaMock.poll.updateMany)).toHaveBeenCalledWith({
      where: { id: 5, status: 'ACTIVE' },
      data: { status: 'COMPLETED', endedAt: NOW },
    });
  });

  it('уже завершённое голосование отдаёт прежний результат, а не второй комплект', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }], { status: 'COMPLETED' });
    asMock(prismaMock.pollResult.findUnique).mockResolvedValue({
      id: 700,
      pollId: 5,
    });

    await expect(
      PollService.completePollMultiWinner(5, 1)
    ).resolves.toMatchObject({ id: 700 });
    expect(asMock(prismaMock.pollResult.create)).not.toHaveBeenCalled();
  });

  it('гонка: закрыли параллельно и без результата — ошибка, а не пустые итоги', async () => {
    // Снаружи голосование ещё ACTIVE, внутри транзакции — уже COMPLETED.
    pollWithVotes([{ userId: 1, menuItemId: 1 }], {}, 'COMPLETED');

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll is already completed'
    );
    expect(asMock(prismaMock.pollResult.create)).not.toHaveBeenCalled();
  });

  it('гонка: отменили параллельно — завершение прерывается', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }], {}, 'CANCELLED');

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll is not active'
    );
  });

  it('гонка: голосование исчезло внутри транзакции', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    asMock(prismaMock.poll.findUnique).mockImplementation((async (args: {
      select?: Record<string, unknown>;
    }) =>
      args.select
        ? null
        : {
            id: 5,
            groupId: 100,
            status: 'ACTIVE',
            votes: [],
            group: { id: 100 },
          }) as never);

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll not found'
    );
  });

  it('отменённое голосование завершить нельзя', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }], { status: 'CANCELLED' });

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll is not active'
    );
  });

  it('несуществующее голосование завершить нельзя', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll not found'
    );
  });

  it('гонка на переходе статуса прерывает завершение', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });

    await expect(PollService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll state changed during completion'
    );
    expect(asMock(prismaMock.pollResult.create)).not.toHaveBeenCalled();
  });

  it('после завершения кэш голосования сбрасывается', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);

    await PollService.completePollMultiWinner(5, 1);

    expect(cacheInvalidatorMock.invalidatePoll).toHaveBeenCalledWith(5, 100);
  });

  it('участники получают уведомления, и создаются заказы по категориям', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);

    await PollService.completePollMultiWinner(5, 1);

    expect(notifications.sendPollCompletionNotifications).toHaveBeenCalledWith(5);
    expect(categoryOrders.createCategoryOrders).toHaveBeenCalledWith(5);
    expect(multiCategory.startMultiCategorySelection).toHaveBeenCalledWith(5);
  });

  it('сбой уведомлений не отменяет завершённое голосование', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    notifications.sendPollCompletionNotifications.mockRejectedValue(
      new Error('telegram down')
    );

    await expect(
      PollService.completePollMultiWinner(5, 1)
    ).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error sending completion notifications:',
      expect.any(Error)
    );
    // Пост-обработка продолжается: заказы всё равно создаются.
    expect(categoryOrders.createCategoryOrders).toHaveBeenCalled();
  });

  it('сбой создания заказов по категориям не отменяет завершение', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('db down')
    );

    await expect(
      PollService.completePollMultiWinner(5, 1)
    ).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error in category order creation/selection:',
      expect.any(Error)
    );
  });

  it('в результат пишется общее число голосов, включая «своё» и «пропуск»', async () => {
    pollWithVotes([
      { userId: 1, menuItemId: 1 },
      { userId: 2, type: 'BRING_OWN' },
      { userId: 3, type: 'SKIP' },
    ]);

    await PollService.completePollMultiWinner(5, 1);

    const call = asMock(prismaMock.pollResult.create).mock.calls[0][0] as {
      data: { totalVotes: number; winnerMenuItemId: number | null };
    };
    expect(call.data.totalVotes).toBe(3);
    expect(call.data.winnerMenuItemId).toBe(1);
  });
});

describe('чтение через кэш', () => {
  it('активное голосование группы читается через кэш с ключом группы', async () => {
    asMock(prismaMock.poll.findFirst).mockResolvedValue({ id: 5 });

    await expect(PollQueryService.getActivePollInGroup(100)).resolves.toMatchObject({
      id: 5,
    });
    expect(cacheServiceMock.getOrSet).toHaveBeenCalledWith(
      'active_polls_group_100',
      expect.any(Function),
      30
    );
  });

  it('сбой кэша превращается в понятную ошибку', async () => {
    cacheServiceMock.getOrSet.mockRejectedValue(new Error('redis down'));

    await expect(PollQueryService.getActivePollInGroup(100)).rejects.toThrow(
      'Failed to get active poll'
    );
  });

  it('пустой список групп не идёт ни в кэш, ни в БД', async () => {
    await expect(PollQueryService.getActivePolls([])).resolves.toEqual([]);

    expect(cacheServiceMock.getOrSet).not.toHaveBeenCalled();
  });

  it('одна группа использует её собственный ключ кэша', async () => {
    await PollQueryService.getActivePolls([100]);

    expect(cacheServiceMock.getOrSet).toHaveBeenCalledWith(
      'active_polls_group_100',
      expect.any(Function),
      30
    );
  });

  it('несколько групп дают устойчивый ключ независимо от порядка', async () => {
    await PollQueryService.getActivePolls([200, 100]);

    expect(cacheServiceMock.getOrSet).toHaveBeenCalledWith(
      'active_polls_100_200',
      expect.any(Function),
      30
    );
  });

  it('без списка групп используется общий ключ', async () => {
    await PollQueryService.getActivePolls();

    expect(cacheServiceMock.getOrSet).toHaveBeenCalledWith(
      'active_polls',
      expect.any(Function),
      30
    );
  });

  it('сбой чтения активных голосований пробрасывается как есть', async () => {
    cacheServiceMock.getOrSet.mockRejectedValue(new Error('redis down'));

    await expect(PollQueryService.getActivePolls()).rejects.toThrow('redis down');
  });
});

describe('getPollById', () => {
  it('голосование отдаётся с группой, голосами и итогами', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({ id: 5 });

    await PollQueryService.getPollById(5);

    const call = asMock(prismaMock.poll.findUnique).mock.calls[0][0] as {
      include: Record<string, unknown>;
    };
    expect(Object.keys(call.include)).toEqual(
      expect.arrayContaining(['group', 'votes', 'result', '_count'])
    );
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.poll.findUnique).mockRejectedValue(new Error('db down'));

    await expect(PollQueryService.getPollById(5)).rejects.toThrow(
      'Failed to get poll'
    );
  });
});
