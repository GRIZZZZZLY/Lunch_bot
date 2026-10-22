/**
 * Голосование: правила, которые не видны через HTTP или живут только в сервисе.
 * Шлюз права голоса, пределы выбора и идемпотентность голоса проверяются на
 * настоящей БД в integration/api/votes.redis.test.ts; здесь остались ветки
 * сервиса (замена набора, разбивка, подсчёты) и арифметика XP за голос.
 */
import { VoteService } from '../../../services/vote.service';
import { VoteXpService } from '../../../services/vote-xp.service';
import { GamificationService } from '../../../services/gamification.service';
import { eventBus } from '../../../services/event-bus.service';
import { VoteType } from '../../../types/vote.types';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/gamification.service', () => ({
  GamificationService: { awardXP: jest.fn() },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const gamification = asServiceMock(GamificationService);
const bus = asServiceMock(eventBus);
const { logger } = jest.requireMock('../../../utils/logger');

const NOW = new Date('2026-08-03T12:00:00.000Z');

/** Голосование, в котором разрешено голосовать. */
function eligible(over: Record<string, unknown> = {}): void {
  asMock(prismaMock.poll.findUnique).mockResolvedValue({
    id: 1,
    status: 'ACTIVE',
    endedAt: null,
    groupId: 100,
    selectedMenuItemIds: null,
    duration: 60,
    createdAt: NOW,
    ...over,
  });
  asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
    isActive: true,
  });
  asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue({
    status: 'EXPECTED',
  });
}

/** Столько блюд из запрошенных реально существует в группе. */
function menuItemsExist(count: number): void {
  asMock(prismaMock.menuItem.count).mockResolvedValue(count);
}

/** Все запрошенные блюда существуют — как ответила бы БД (пустой список → 0). */
function allMenuItemsExist(): void {
  asMock(prismaMock.menuItem.count).mockImplementation((async (args: {
    where: { id: { in: number[] } };
  }) => args.where.id.in.length) as never);
}

function emitted(type: string): boolean {
  return bus.emit.mock.calls.some(
    ([event, payload]: [string, { type: string }]) =>
      event === 'poll_updated' && payload.type === type
  );
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  eligible();
  allMenuItemsExist();
  gamification.awardXP.mockResolvedValue(undefined);

  asMock(prismaMock.vote.findFirst).mockResolvedValue(null);
  asMock(prismaMock.vote.findMany).mockResolvedValue([]);
  asMock(prismaMock.vote.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 900, ...args.data })) as never);
  asMock(prismaMock.vote.createMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.vote.deleteMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.vote.update).mockResolvedValue({ id: 900 });
  asMock(prismaMock.vote.count).mockResolvedValue(1);
  asMock(prismaMock.vote.groupBy).mockResolvedValue([]);
  asMock(prismaMock.menuItem.findMany).mockResolvedValue([]);
  asMock(prismaMock.menuItem.findUnique).mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createMultipleVotes', () => {
  it.each([
    ['без блюд', 1, 5, [] as number[]],
    ['без голосования', 0, 5, [7]],
    ['без пользователя', 1, 0, [7]],
  ])('запрос %s отклоняется', async (_name, pollId, userId, ids) => {
    await expect(
      VoteService.createMultipleVotes(pollId, userId, ids)
    ).rejects.toThrow();
    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
  });

  it('причина отказа доходит до вызывающего как есть', async () => {
    eligible({ status: 'COMPLETED' });

    await expect(VoteService.createMultipleVotes(1, 5, [7])).rejects.toThrow(
      'Poll is not active'
    );
  });

  it('одно блюдо из двух недоступно — не проходит весь набор', async () => {
    menuItemsExist(1);

    await expect(VoteService.createMultipleVotes(1, 5, [7, 8])).rejects.toThrow(
      'Menu item is not available for this poll'
    );
    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
  });
});

describe('replaceUserVotes', () => {
  it('лишние голоса снимаются, новые добавляются одной транзакцией', async () => {
    menuItemsExist(2);
    asMock(prismaMock.vote.findMany)
      .mockResolvedValueOnce([{ menuItemId: 7 }, { menuItemId: 9 }])
      .mockResolvedValue([{ id: 1, menuItemId: 8 }, { id: 2, menuItemId: 7 }]);

    const result = await VoteService.replaceUserVotes(1, 5, [7, 8]);

    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5, menuItemId: { in: [9] } },
    });
    expect(
      (
        asMock(prismaMock.vote.createMany).mock.calls[0][0] as {
          data: Array<{ menuItemId: number }>;
        }
      ).data.map(row => row.menuItemId)
    ).toEqual([8]);
    expect(result.newlyCreatedItemIds).toEqual([8]);
  });

  it('неизменившийся набор не трогает БД и не начисляет XP', async () => {
    menuItemsExist(1);
    asMock(prismaMock.vote.findMany).mockResolvedValue([{ menuItemId: 7 }]);

    await VoteService.replaceUserVotes(1, 5, [7]);

    expect(asMock(prismaMock.vote.deleteMany)).not.toHaveBeenCalled();
    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('пустой набор снимает все голоса пользователя', async () => {
    menuItemsExist(0);
    asMock(prismaMock.vote.findMany)
      .mockResolvedValueOnce([{ menuItemId: 7 }])
      .mockResolvedValue([]);

    const result = await VoteService.replaceUserVotes(1, 5, []);

    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5, menuItemId: { in: [7] } },
    });
    expect(result.votes).toEqual([]);
  });

  it('право голоса проверяется и при замене набора', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(VoteService.replaceUserVotes(1, 5, [7])).rejects.toThrow(
      'User is not eligible to vote in this poll'
    );
  });

  it('событие об изменении уходит только при появлении новых голосов', async () => {
    asMock(prismaMock.vote.findMany)
      .mockResolvedValueOnce([{ menuItemId: 9 }])
      .mockResolvedValue([]);

    await VoteService.replaceUserVotes(1, 5, []);

    expect(emitted('vote_added')).toBe(false);
  });
});

describe('VoteXpService.awardVoteXp: множители XP', () => {
  type PollTiming = { duration: number; createdAt: Date } | null;
  type Row = {
    name: string;
    votesToday: number | Error;
    votedItems: number[] | Error;
    poll: PollTiming;
    xp: number;
  };

  /** Голосование на 4 часа: последний час ещё не наступил. */
  const far: PollTiming = { duration: 240, createdAt: NOW };
  /** Дедлайн в 12:30, сейчас 12:00 — последний час. */
  const lastHour: PollTiming = {
    duration: 60,
    createdAt: new Date('2026-08-03T11:30:00.000Z'),
  };
  const down = new Error('db down');

  it.each<Row>([
    { name: 'без бонусов — 10', votesToday: 3, votedItems: [7, 8], poll: far, xp: 10 },
    { name: 'первый голос за день ×1.5', votesToday: 1, votedItems: [7, 8], poll: far, xp: 15 },
    { name: 'единогласное голосование ×1.3', votesToday: 3, votedItems: [7], poll: far, xp: 13 },
    { name: 'голос в последний час ×1.4', votesToday: 3, votedItems: [7, 8], poll: lastHour, xp: 14 },
    // 10 × 1.5 = 15, затем 15 × 1.3 = 19.5 — множитель округляет вниз.
    { name: 'множители перемножаются с округлением вниз', votesToday: 1, votedItems: [7], poll: far, xp: 19 },
    { name: 'сбой проверки первого голоса бонуса не даёт', votesToday: down, votedItems: [7, 8], poll: far, xp: 10 },
    { name: 'сбой проверки единогласия бонуса не даёт', votesToday: 3, votedItems: down, poll: far, xp: 10 },
    { name: 'удалённое голосование бонуса за дедлайн не даёт', votesToday: 3, votedItems: [7, 8], poll: null, xp: 10 },
  ])('$name', async ({ votesToday, votedItems, poll, xp }) => {
    if (votesToday instanceof Error) {
      asMock(prismaMock.vote.count).mockRejectedValue(votesToday);
    } else {
      asMock(prismaMock.vote.count).mockResolvedValue(votesToday);
    }
    if (votedItems instanceof Error) {
      asMock(prismaMock.vote.findMany).mockRejectedValue(votedItems);
    } else {
      asMock(prismaMock.vote.findMany).mockResolvedValue(
        votedItems.map(menuItemId => ({ menuItemId }))
      );
    }
    asMock(prismaMock.poll.findUnique).mockResolvedValue(poll);

    await VoteXpService.awardVoteXp(5, 1, 7);

    expect(gamification.awardXP.mock.calls[0][1]).toBe(xp);
  });

  it('сбой начисления XP наружу не выходит', async () => {
    gamification.awardXP.mockRejectedValue(new Error('xp down'));

    await expect(VoteXpService.awardVoteXp(5, 1, 7)).resolves.toBeUndefined();
  });
});

describe('upsertVote', () => {
  const vote = { pollId: 1, userId: 5, menuItemId: 7 };

  it('причина отказа доходит до вызывающего как есть', async () => {
    eligible({ status: 'COMPLETED' });

    await expect(VoteService.upsertVote(vote)).rejects.toThrow(
      'Poll is not active'
    );
    expect(emitted('vote_changed')).toBe(false);
  });
});

/**
 * Правила выбора приехали из контроллера (задача 05): «одиночный выбор» и «не
 * больше N блюд» решались в HTTP-слое, то есть действовали ровно для одного
 * эндпоинта. Теперь они здесь — перед созданием голосов, для любого
 * вызывающего.
 */
describe('castVotes', () => {
  function poll(over: Record<string, unknown> = {}): void {
    asMock(prismaMock.poll.findUnique).mockImplementation((async (args: {
      select?: Record<string, unknown>;
    }) =>
      args.select && 'isMultiSelect' in args.select
        ? { isMultiSelect: true, maxSelections: 3, ...over }
        : {
            id: 1,
            status: 'ACTIVE',
            endedAt: null,
            groupId: 100,
            selectedMenuItemIds: null,
          }) as never);
  }

  beforeEach(() => {
    poll();
  });

  it('голоса подаются, когда выбор в пределах лимита', async () => {
    await VoteService.castVotes(1, 5, [7, 8]);

    expect(asMock(prismaMock.vote.createMany)).toHaveBeenCalled();
  });


  /* У старых голосований поле пустое, и они считались множественными.
     Сохранено намеренно: смена умолчания — отдельное решение. */
  it('пустой isMultiSelect понимается как множественный выбор', async () => {
    poll({ isMultiSelect: null });

    await expect(VoteService.castVotes(1, 5, [7, 8])).resolves.toBeDefined();
  });
});

describe('getVoteBreakdown', () => {
  function groups(rows: Array<[number, number]>): void {
    asMock(prismaMock.vote.groupBy).mockResolvedValue(
      rows.map(([menuItemId, count]) => ({
        menuItemId,
        _count: { menuItemId: count },
      }))
    );
  }

  it('без голосов возвращается пустая разбивка', async () => {
    groups([]);

    await expect(VoteService.getVoteBreakdown(1)).resolves.toEqual([]);
  });

  it('проценты считаются от общего числа голосов', async () => {
    groups([
      [7, 3],
      [8, 1],
    ]);
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([
      { id: 7, name: 'Плов' },
      { id: 8, name: 'Суп' },
    ]);

    const breakdown = await VoteService.getVoteBreakdown(1);

    expect(breakdown[0]).toMatchObject({
      menuItemName: 'Плов',
      votes: 3,
      percentage: 75,
    });
    expect(breakdown[1]).toMatchObject({ menuItemName: 'Суп', percentage: 25 });
  });

  it('результат отсортирован по числу голосов', async () => {
    groups([
      [7, 1],
      [8, 5],
    ]);
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([
      { id: 7, name: 'Плов' },
      { id: 8, name: 'Суп' },
    ]);

    const breakdown = await VoteService.getVoteBreakdown(1);

    expect(breakdown.map(row => row.menuItemId)).toEqual([8, 7]);
  });

  it('служебный вариант «Еда с собой» получает своё название, а не Unknown', async () => {
    groups([[-1, 2]]);

    const breakdown = await VoteService.getVoteBreakdown(1);

    expect(breakdown[0]).toMatchObject({
      menuItemId: -1,
      menuItemName: 'Еда с собой',
    });
    // Отрицательный id в БД не запрашивается.
    expect(asMock(prismaMock.menuItem.findMany)).not.toHaveBeenCalled();
  });

  it('удалённое блюдо помечается как Unknown, а голоса не теряются', async () => {
    groups([[7, 2]]);
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([]);

    const breakdown = await VoteService.getVoteBreakdown(1);

    expect(breakdown[0]).toMatchObject({ menuItemName: 'Unknown', votes: 2 });
  });

  it('к каждому блюду прикладываются голосовавшие', async () => {
    groups([[7, 2]]);
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([
      { id: 7, name: 'Плов' },
    ]);
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { menuItemId: 7, user: { id: 1, firstName: 'Иван', username: 'ivan' } },
      { menuItemId: 7, user: { id: 2, firstName: 'Пётр', username: null } },
      { menuItemId: null, user: { id: 3, firstName: 'Аня', username: null } },
    ]);

    const [row] = await VoteService.getVoteBreakdown(1);

    expect(row.voters).toEqual([
      { id: 1, firstName: 'Иван', username: 'ivan' },
      { id: 2, firstName: 'Пётр', username: undefined },
    ]);
  });

});

describe('подсчёты и списки', () => {
  it('голоса без блюда в подсчёт по блюдам не попадают', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { menuItemId: 7, menuItem: { id: 7, name: 'Плов' } },
      { menuItemId: 7, menuItem: { id: 7, name: 'Плов' } },
      { menuItemId: null, menuItem: null },
    ]);

    await expect(VoteService.getVoteCountByMenuItem(1)).resolves.toEqual([
      { menuItemId: 7, menuItemName: 'Плов', votes: 2 },
    ]);
  });

  it('подсчёт по блюдам отсортирован по убыванию', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { menuItemId: 7, menuItem: { id: 7, name: 'Плов' } },
      { menuItemId: 8, menuItem: { id: 8, name: 'Суп' } },
      { menuItemId: 8, menuItem: { id: 8, name: 'Суп' } },
    ]);

    const rows = await VoteService.getVoteCountByMenuItem(1);

    expect(rows.map(row => row.menuItemId)).toEqual([8, 7]);
  });

  it('getVoters склеивает имя и фамилию', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      {
        user: { id: 1, firstName: 'Иван', lastName: 'Петров', username: null },
        menuItem: { name: 'Плов' },
      },
      {
        user: { id: 2, firstName: 'Пётр', lastName: null, username: null },
        menuItem: { name: 'Суп' },
      },
    ]);

    await expect(VoteService.getVoters(1)).resolves.toEqual([
      { userId: 1, userName: 'Иван Петров', menuItemName: 'Плов' },
      { userId: 2, userName: 'Пётр', menuItemName: 'Суп' },
    ]);
  });
});

describe('getMostPopularMenuItem', () => {
  it('возвращает блюдо с наибольшим числом голосов', async () => {
    asMock(prismaMock.vote.groupBy).mockResolvedValue([
      { menuItemId: 7, _count: { menuItemId: 4 } },
    ]);
    asMock(prismaMock.menuItem.findUnique).mockResolvedValue({ name: 'Плов' });

    await expect(VoteService.getMostPopularMenuItem(1)).resolves.toEqual({
      menuItemId: 7,
      menuItemName: 'Плов',
      votes: 4,
    });
  });

  it('без голосов возвращается null', async () => {
    asMock(prismaMock.vote.groupBy).mockResolvedValue([]);

    await expect(VoteService.getMostPopularMenuItem(1)).resolves.toBeNull();
  });

  it('голоса без блюда победителем не становятся', async () => {
    asMock(prismaMock.vote.groupBy).mockResolvedValue([
      { menuItemId: null, _count: { menuItemId: 3 } },
    ]);

    await expect(VoteService.getMostPopularMenuItem(1)).resolves.toBeNull();
  });

  it('удалённое блюдо подписывается номером, а не пустотой', async () => {
    asMock(prismaMock.vote.groupBy).mockResolvedValue([
      { menuItemId: 7, _count: { menuItemId: 4 } },
    ]);
    asMock(prismaMock.menuItem.findUnique).mockResolvedValue(null);

    await expect(VoteService.getMostPopularMenuItem(1)).resolves.toMatchObject({
      menuItemName: 'Menu Item #7',
    });
  });

  it('сбой не роняет рулетку: возвращается null', async () => {
    asMock(prismaMock.vote.groupBy).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getMostPopularMenuItem(1)).resolves.toBeNull();
  });
});

describe('getVoteTypeStats', () => {
  it('типы голосов считаются раздельно', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { voteType: VoteType.MENU_ITEM },
      { voteType: VoteType.MENU_ITEM },
      { voteType: VoteType.BRING_OWN },
      { voteType: VoteType.SKIP },
    ]);

    await expect(VoteService.getVoteTypeStats(1)).resolves.toEqual({
      menuItemVotes: 2,
      bringOwnVotes: 1,
      skipVotes: 1,
      total: 4,
    });
  });

  it('незнакомый тип в счётчики не попадает, но входит в общее число', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { voteType: 'SOMETHING_NEW' },
    ]);

    await expect(VoteService.getVoteTypeStats(1)).resolves.toEqual({
      menuItemVotes: 0,
      bringOwnVotes: 0,
      skipVotes: 0,
      total: 1,
    });
  });
});
