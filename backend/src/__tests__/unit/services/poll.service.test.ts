/**
 * Голосование: то, что не достать через HTTP. Создание, снимок участников,
 * кворум при голосовании, чтение через кэш и основные переходы статуса
 * проверяют интеграционные тесты голосований на тестовой БД.
 *
 * Здесь:
 *
 * 1. Пустой снимок ожидаемых участников НЕ закрывает голосование. Через
 *    эндпоинт такой случай не собрать: при пустом снимке голосовать некому.
 *
 * 2. Гонки внутри транзакции завершения: закрыли или отменили параллельно,
 *    строка исчезла, переход статуса не прошёл — ошибка, а не пустые итоги.
 *
 * 3. Пост-обработка (уведомления, заказы по категориям) вынесена за
 *    транзакцию: её падение не отменяет уже завершённое голосование.
 *
 * 4. Планировщик (`findExpiredActivePolls`, `cancelIfStillActive`), правило
 *    окончания `isPollOver` и арифметика статистики.
 */
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollStatsService } from '../../../services/poll-stats.service';
import { PollCompletionService } from '../../../services/poll-completion.service';
import { isPollOver } from '../../../utils/date';

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
    ACTIVE_POLL_GROUP: (groupId: number) => `active_poll_group_${groupId}`,
  },
  CACHE_TTL: { ACTIVE_POLLS: 30 },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { getGroupSettings: jest.fn() },
}));

jest.mock('../../../services/poll-notification.service', () => ({
  pollNotificationService: {
    sendPollCompletionNotifications: jest.fn(),
    sendPollCancelledNotifications: jest.fn(),
  },
}));

/* Заказы по категориям сервис доподгружает через `await import('./x.js')`.
   Для jest это ДРУГОЙ модуль, чем './x', поэтому оба специфаера мокаются, а
   `.js` — виртуально. Для уведомлений такой пары больше нет: динамический
   импорт снят вместе с разрезом сервиса. */

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

const {
  cacheService: cacheServiceMock,
  CacheInvalidator: cacheInvalidatorMock,
} = jest.requireMock('../../../services/cache.service');
const { pollNotificationService } = jest.requireMock(
  '../../../services/poll-notification.service'
);
const { CategoryOrderService } = jest.requireMock(
  '../../../services/category-order.service'
);
const { MultiCategoryResponsibleService } = jest.requireMock(
  '../../../services/multi-category-responsible.service'
);

const notifications = asServiceMock(pollNotificationService);
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

describe('checkQuorumAndComplete', () => {
  /* Завершение проверяется отдельно (completePoll / completePollMultiWinner).
     Здесь важна только логика кворума, поэтому само завершение подменяется. */
  let completePoll: jest.SpyInstance;

  beforeEach(() => {
    completePoll = jest
      .spyOn(PollCompletionService, 'completePoll')
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

  it('пустой снимок НЕ закрывает голосование', async () => {
    poll();
    expected([]);
    voted([1]);

    await expect(PollCompletionService.checkQuorumAndComplete(5)).resolves.toBe(false);
    expect(completePoll).not.toHaveBeenCalled();
  });

  it('удалённое голосование не проверяется', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(PollCompletionService.checkQuorumAndComplete(5)).resolves.toBe(false);
  });
});

describe('findExpiredActivePolls', () => {
  /* Просроченные отбирает БД. Мок отдаёт то, что вернул бы запрос: сравнение
     `startedAt + duration` с моментом проверки в JS больше не выполняется,
     поэтому фикстура — уже отобранные строки. `votesCount` приходит из
     Postgres как `bigint` — фикстура повторяет это, иначе тест проверял бы не
     тот тип, что приезжает в бою. */
  function expired(
    rows: Array<{
      id: number;
      groupId: number;
      endsAt?: Date;
      chatId?: bigint | null;
      messageId?: number | null;
      votesCount?: bigint;
    }>
  ) {
    asMock(prismaMock.$queryRaw).mockResolvedValue(
      rows.map(row => ({
        endsAt: NOW,
        chatId: null,
        messageId: null,
        votesCount: 0n,
        ...row,
      }))
    );
  }

  /** Текст запроса из тегированного шаблона: `$queryRaw(strings, ...values)`. */
  function lastQuery(): { sql: string; values: unknown[] } {
    const call = asMock(prismaMock.$queryRaw).mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    return { sql: call[0].join('?'), values: call.slice(1) };
  }

  /* `COUNT(*)` из Postgres — `bigint`. Без приведения `votesCount === 0`
     никогда не сработает, и пустое голосование пошло бы на завершение. */
  it('число голосов приводится к number', async () => {
    expired([{ id: 5, groupId: 100, votesCount: 3n }]);

    const [poll] = await PollCompletionService.findExpiredActivePolls(NOW);

    expect(poll.votesCount).toBe(3);
    expect(typeof poll.votesCount).toBe('number');
  });

  /* Граница «ровно в момент истечения» теперь на стороне SQL, и мок её не
     воспроизводит. Проверяем то, что осталось проверяемым здесь: сравнение
     нестрогое, иначе голосование живёт лишнюю минуту до следующего тика. */
  it('граница нестрогая: истёкшее ровно сейчас попадает в выборку', async () => {
    expired([]);

    await PollCompletionService.findExpiredActivePolls(NOW);

    expect(lastQuery().sql).toContain('<=');
  });
});

describe('cancelIfStillActive', () => {
  /* Пропущенный тик — простой, рестарт, ручной запуск скрипта через сутки —
     не должен растягивать длительность в истории до момента запуска. */
  it('в историю пишется фактический конец, а не время тика', async () => {
    const endedLongAgo = new Date(NOW.getTime() - 26 * 60 * 60_000);

    await PollCompletionService.cancelIfStillActive({
      id: 5,
      groupId: 100,
      endsAt: endedLongAgo,
    });

    expect(asMock(prismaMock.poll.updateMany)).toHaveBeenCalledWith({
      where: { id: 5, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endedAt: endedLongAgo },
    });
  });

  /* Оптимистичная блокировка: `where` по статусу + `count === 0` — это и есть
     ответ «закрыл кто-то другой», и вызывающий не должен считать это отменой. */
  it('уже закрытое другим процессом не считается отменённым', async () => {
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      PollCompletionService.cancelIfStillActive({
        id: 5,
        groupId: 100,
        endsAt: NOW,
      })
    ).resolves.toBe(false);
    expect(cacheInvalidatorMock.invalidatePoll).not.toHaveBeenCalled();
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

    const result = await PollStatsService.getUserParticipationStats(1);

    expect(result).toMatchObject({
      totalVotes: 4,
      totalPolls: 8,
      participationRate: 50,
    });
  });

  it('без завершённых голосований процент — ноль, а не деление на ноль', async () => {
    stats({ totalPolls: 0 });

    expect(
      (await PollStatsService.getUserParticipationStats(1)).participationRate
    ).toBe(0);
  });

  it('любимые блюда получают долю от всех голосов пользователя', async () => {
    stats({ totalVotes: 4, byItem: [{ menuItemId: 1, _count: { id: 3 } }] });

    const result = await PollStatsService.getUserParticipationStats(1);

    expect(result.favoriteItems).toEqual([
      { itemId: 1, itemName: 'Плов', voteCount: 3, percentage: 75 },
    ]);
  });

  it('удалённое блюдо подписывается Unknown, а голоса остаются', async () => {
    stats({ items: [] });

    const result = await PollStatsService.getUserParticipationStats(1);

    expect(result.favoriteItems[0]).toMatchObject({
      itemName: 'Unknown',
      voteCount: 3,
    });
  });

  it('без голосов доля не считается', async () => {
    stats({ totalVotes: 0 });

    expect(
      (await PollStatsService.getUserParticipationStats(1)).favoriteItems[0]
        .percentage
    ).toBe(0);
  });

  it('голос без блюда в активности подписан Unknown', async () => {
    stats({
      recent: [{ pollId: 5, createdAt: NOW, poll: { id: 5 }, menuItem: null }],
    });

    expect(
      (await PollStatsService.getUserParticipationStats(1)).recentActivity[0].itemName
    ).toBe('Unknown');
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

  it('гонка: закрыли параллельно и без результата — ошибка, а не пустые итоги', async () => {
    // Снаружи голосование ещё ACTIVE, внутри транзакции — уже COMPLETED.
    pollWithVotes([{ userId: 1, menuItemId: 1 }], {}, 'COMPLETED');

    await expect(PollCompletionService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll is already completed'
    );
    expect(asMock(prismaMock.pollResult.create)).not.toHaveBeenCalled();
  });

  it('гонка: отменили параллельно — завершение прерывается', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }], {}, 'CANCELLED');

    await expect(PollCompletionService.completePollMultiWinner(5, 1)).rejects.toThrow(
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

    await expect(PollCompletionService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll not found'
    );
  });

  it('гонка на переходе статуса прерывает завершение', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    asMock(prismaMock.poll.updateMany).mockResolvedValue({ count: 0 });

    await expect(PollCompletionService.completePollMultiWinner(5, 1)).rejects.toThrow(
      'Poll state changed during completion'
    );
    expect(asMock(prismaMock.pollResult.create)).not.toHaveBeenCalled();
  });

  it('сбой уведомлений не отменяет завершённое голосование', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    notifications.sendPollCompletionNotifications.mockRejectedValue(
      new Error('telegram down')
    );

    await expect(
      PollCompletionService.completePollMultiWinner(5, 1)
    ).resolves.toMatchObject({ id: 700, pollId: 5 });
    // Пост-обработка продолжается: заказы всё равно создаются.
    expect(categoryOrders.createCategoryOrders).toHaveBeenCalled();
  });

  it('сбой создания заказов по категориям не отменяет завершение', async () => {
    pollWithVotes([{ userId: 1, menuItemId: 1 }]);
    categoryOrders.createCategoryOrders.mockRejectedValue(
      new Error('db down')
    );

    await expect(
      PollCompletionService.completePollMultiWinner(5, 1)
    ).resolves.toMatchObject({ id: 700, pollId: 5 });
  });
});

/**
 * Правило окончания одно для экрана, запрета второго голосования и
 * планировщика. Граница нестрогая: ровно в момент окончания голосование уже
 * закрыто, иначе оно живёт лишнюю минуту до следующего тика.
 */
describe('isPollOver', () => {
  const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

  it.each([
    ['идёт пятую минуту из тридцати', { startedAt: minutesAgo(5), duration: 30, endedAt: null }, false],
    ['срок вышел по таймеру', { startedAt: minutesAgo(60), duration: 30, endedAt: null }, true],
    ['endedAt в прошлом важнее длинного срока', { startedAt: minutesAgo(5), duration: 600, endedAt: minutesAgo(1) }, true],
    ['окончание ровно сейчас', { startedAt: minutesAgo(30), duration: 30, endedAt: null }, true],
  ])('%s → %s', (_case, poll, over) => {
    expect(isPollOver(poll, NOW)).toBe(over);
  });
});

describe('getPollStats', () => {
  it('среднее число голосов на завершённое голосование округляется до сотых', async () => {
    asMock(prismaMock.poll.count).mockImplementation((async (args: {
      where: { status?: string };
    }) => (args.where.status === 'COMPLETED' ? 3 : 10)) as never);
    asMock(prismaMock.poll.findMany).mockResolvedValue([
      { _count: { votes: 5 } },
      { _count: { votes: 7 } },
      { _count: { votes: 4 } },
    ]);

    await expect(PollStatsService.getPollStats(1)).resolves.toMatchObject({
      completedPolls: 3,
      averageParticipants: 5.33,
    });
  });
});

describe('getPollVoteBreakdown', () => {
  it('голоса собираются по блюдам, доля считается от всех голосов', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 5,
      votes: [
        { menuItemId: 1, menuItem: { name: 'Пицца' }, user: { id: 1, firstName: 'U1', username: 'u1' } },
        { menuItemId: 1, menuItem: { name: 'Пицца' }, user: { id: 2, firstName: 'U2', username: null } },
        { menuItemId: 2, menuItem: { name: 'Бургер' }, user: { id: 3, firstName: 'U3', username: 'u3' } },
      ],
    });

    const result = await PollStatsService.getPollVoteBreakdown(5);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ menuItemId: 1, votes: 2, percentage: 67 });
    expect(result[0].voters).toHaveLength(2);
  });

  it('несуществующее голосование — ошибка', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(PollStatsService.getPollVoteBreakdown(999)).rejects.toThrow(
      'Poll not found'
    );
  });
});
