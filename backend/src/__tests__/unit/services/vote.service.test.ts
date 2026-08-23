/**
 * Голосование — центральный сценарий приложения, и здесь же живёт проверка
 * права голоса. Один шлюз (assertMenuItemsAllowedForPoll) стоит перед каждым
 * способом отдать голос, поэтому он проверяется отдельно и подробно: без него
 * можно проголосовать в чужой группе, в закрытом голосовании или за блюдо,
 * которого в этом голосовании нет.
 *
 * Второе, что закреплено, — идемпотентность. Повторное нажатие не должно
 * добавлять второй голос за то же блюдо и не должно начислять XP второй раз;
 * ключ идемпотентности собирается из (poll, user, menuItem).
 *
 * Третье — XP и события живут ВНЕ транзакции: их сбой не имеет права откатить
 * уже поданный голос.
 */
import { VoteService } from '../../../services/vote.service';
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

describe('право голоса', () => {
  const vote = { pollId: 1, userId: 5, menuItemId: 7 };

  it('участник активного голосования голосует', async () => {
    await expect(VoteService.createVote(vote)).resolves.toMatchObject({
      menuItemId: 7,
      voteType: VoteType.MENU_ITEM,
    });
  });

  it('в несуществующем голосовании голос не принимается', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(VoteService.createVote(vote)).rejects.toThrow(
      'Failed to create vote'
    );
    expect(asMock(prismaMock.vote.create)).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'CANCELLED', 'PENDING'])(
    'в голосовании со статусом %s голос не принимается',
    async status => {
      eligible({ status });

      await expect(VoteService.createVote(vote)).rejects.toThrow();
      expect(asMock(prismaMock.vote.create)).not.toHaveBeenCalled();
    }
  );

  it('после дедлайна голос не принимается', async () => {
    eligible({ endedAt: new Date('2026-08-03T11:00:00.000Z') });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('ровно в момент дедлайна голос ещё принимается', async () => {
    eligible({ endedAt: NOW });

    await expect(VoteService.createVote(vote)).resolves.toBeDefined();
  });

  it('не участник группы голосовать не может', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('вышедший из группы голосовать не может', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      isActive: false,
    });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('не приглашённый в это голосование голосовать не может', async () => {
    asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue(null);

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('участник с иным статусом, чем EXPECTED, голосовать не может', async () => {
    asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue({
      status: 'DECLINED',
    });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('блюдо вне выбранного набора голосования отклоняется', async () => {
    eligible({ selectedMenuItemIds: JSON.stringify([1, 2, 3]) });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
    expect(asMock(prismaMock.vote.create)).not.toHaveBeenCalled();
  });

  it('блюдо из выбранного набора принимается', async () => {
    eligible({ selectedMenuItemIds: JSON.stringify([7, 8]) });

    await expect(VoteService.createVote(vote)).resolves.toBeDefined();
  });

  it('битый набор блюд в голосовании не открывает голосование за что угодно', async () => {
    eligible({ selectedMenuItemIds: '{not json' });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('набор блюд, оказавшийся не массивом, тоже отклоняется', async () => {
    eligible({ selectedMenuItemIds: JSON.stringify({ id: 7 }) });

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });

  it('блюдо из чужой группы отклоняется: проверка идёт по groupId', async () => {
    menuItemsExist(0);

    await expect(VoteService.createVote(vote)).rejects.toThrow();
    expect(asMock(prismaMock.menuItem.count)).toHaveBeenCalledWith({
      where: { id: { in: [7] }, groupId: 100, isActive: true },
    });
  });

  it('выключенное блюдо отклоняется', async () => {
    menuItemsExist(0);

    await expect(VoteService.createVote(vote)).rejects.toThrow();
  });
});

describe('createVote', () => {
  const vote = { pollId: 1, userId: 5, menuItemId: 7 };

  it('первый голос начисляет XP и рассылает событие', async () => {
    await VoteService.createVote(vote);

    expect(gamification.awardXP).toHaveBeenCalled();
    expect(emitted('vote_added')).toBe(true);
  });

  it('повторное нажатие не создаёт второй голос и не начисляет XP снова', async () => {
    asMock(prismaMock.vote.findFirst).mockResolvedValue({
      id: 900,
      menuItemId: 7,
    });

    const result = await VoteService.createVote(vote);

    expect(result).toMatchObject({ id: 900 });
    expect(asMock(prismaMock.vote.create)).not.toHaveBeenCalled();
    expect(gamification.awardXP).not.toHaveBeenCalled();
    expect(emitted('vote_added')).toBe(false);
  });

  it('сбой начисления XP не отменяет голос', async () => {
    gamification.awardXP.mockRejectedValue(new Error('xp service down'));

    await expect(VoteService.createVote(vote)).resolves.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to award XP for vote:',
      expect.any(Error)
    );
  });
});

describe('createVoteWithType', () => {
  it('голос «принесу своё» блюда не требует', async () => {
    const vote = await VoteService.createVoteWithType({
      pollId: 1,
      userId: 5,
      voteType: VoteType.BRING_OWN,
      customOption: 'Салат из дома',
    });

    expect(vote).toMatchObject({
      voteType: VoteType.BRING_OWN,
      customOption: 'Салат из дома',
    });
    // Без блюда список для проверки пуст — обращения к меню нет.
    expect(asMock(prismaMock.menuItem.count)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) })
    );
  });

  it('голос «пропускаю» тоже проходит проверку права голоса', async () => {
    asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue(null);

    await expect(
      VoteService.createVoteWithType({
        pollId: 1,
        userId: 5,
        voteType: VoteType.SKIP,
      })
    ).rejects.toThrow('Failed to create vote with type');
  });

  it('указанное блюдо проверяется на доступность', async () => {
    menuItemsExist(0);

    await expect(
      VoteService.createVoteWithType({
        pollId: 1,
        userId: 5,
        voteType: VoteType.MENU_ITEM,
        menuItemId: 7,
      })
    ).rejects.toThrow();
  });
});

describe('createMultipleVotes', () => {
  it('дубликаты в запросе схлопываются', async () => {
    menuItemsExist(2);
    asMock(prismaMock.vote.findMany).mockResolvedValue([]);

    await VoteService.createMultipleVotes(1, 5, [7, 7, 8]);

    const call = asMock(prismaMock.vote.createMany).mock.calls[0][0] as {
      data: Array<{ menuItemId: number }>;
    };
    expect(call.data.map(row => row.menuItemId)).toEqual([7, 8]);
  });

  it('уже отданные голоса не дублируются', async () => {
    menuItemsExist(2);
    asMock(prismaMock.vote.findMany)
      .mockResolvedValueOnce([{ id: 1, menuItemId: 7 }])
      .mockResolvedValue([
        { id: 1, menuItemId: 7 },
        { id: 2, menuItemId: 8 },
      ]);

    await VoteService.createMultipleVotes(1, 5, [7, 8]);

    const call = asMock(prismaMock.vote.createMany).mock.calls[0][0] as {
      data: Array<{ menuItemId: number }>;
    };
    expect(call.data.map(row => row.menuItemId)).toEqual([8]);
  });

  it('XP начисляется только за новые голоса', async () => {
    menuItemsExist(2);
    asMock(prismaMock.vote.findMany)
      .mockResolvedValueOnce([{ id: 1, menuItemId: 7 }])
      .mockResolvedValue([
        { id: 1, menuItemId: 7 },
        { id: 2, menuItemId: 8 },
      ]);

    await VoteService.createMultipleVotes(1, 5, [7, 8]);

    expect(gamification.awardXP).toHaveBeenCalledTimes(1);
  });

  it('когда всё уже отдано, ни вставки, ни XP, ни события', async () => {
    menuItemsExist(1);
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, menuItemId: 7 },
    ]);

    await VoteService.createMultipleVotes(1, 5, [7]);

    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
    expect(gamification.awardXP).not.toHaveBeenCalled();
    expect(emitted('vote_added')).toBe(false);
  });

  it.each([
    ['без блюд', [] as number[]],
    ['с пустым списком', [] as number[]],
  ])('запрос %s отклоняется', async (_name, ids) => {
    await expect(VoteService.createMultipleVotes(1, 5, ids)).rejects.toThrow(
      'Invalid parameters for multiple votes'
    );
  });

  it('запрос без голосования отклоняется', async () => {
    await expect(VoteService.createMultipleVotes(0, 5, [7])).rejects.toThrow(
      'Invalid parameters for multiple votes'
    );
  });

  it('запрос без пользователя отклоняется', async () => {
    await expect(VoteService.createMultipleVotes(1, 0, [7])).rejects.toThrow(
      'Invalid parameters for multiple votes'
    );
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

describe('множители XP', () => {
  const vote = { pollId: 1, userId: 5, menuItemId: 7 };

  function awardedXP(): number {
    return gamification.awardXP.mock.calls[0][1] as number;
  }

  /** Голосование на 4 часа: последний час ещё не наступил. */
  function farFromDeadline(): void {
    eligible({ duration: 240 });
  }

  /** Не первый голос за день. */
  function notFirstToday(): void {
    asMock(prismaMock.vote.count).mockResolvedValue(3);
  }

  /** Голоса разошлись по двум блюдам — не единогласно. */
  function notUnanimous(): void {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { menuItemId: 7 },
      { menuItemId: 8 },
    ]);
  }

  it('базовое начисление — 10 XP', async () => {
    farFromDeadline();
    notFirstToday();
    notUnanimous();

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(10);
  });

  it('первый голос за день даёт ×1.5', async () => {
    farFromDeadline();
    asMock(prismaMock.vote.count).mockResolvedValue(1);
    notUnanimous();

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(15);
  });

  it('единогласное голосование даёт ×1.3', async () => {
    farFromDeadline();
    notFirstToday();
    asMock(prismaMock.vote.findMany).mockResolvedValue([{ menuItemId: 7 }]);

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(13);
  });

  it('голос в последний час даёт ×1.4', async () => {
    notFirstToday();
    notUnanimous();
    eligible({
      duration: 60,
      createdAt: new Date('2026-08-03T11:30:00.000Z'),
    });

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(14);
  });

  it('множители перемножаются и результат округляется', async () => {
    farFromDeadline();
    asMock(prismaMock.vote.count).mockResolvedValue(1);
    asMock(prismaMock.vote.findMany).mockResolvedValue([{ menuItemId: 7 }]);

    await VoteService.createVote(vote);

    // 10 × 1.5 = 15, затем 15 × 1.3 = 19.5 — множитель округляет вниз: 19.
    expect(awardedXP()).toBe(19);
  });

  it('ключ идемпотентности собран из голосования, участника и блюда', async () => {
    await VoteService.createVote(vote);

    expect(gamification.awardXP).toHaveBeenCalledWith(
      5,
      expect.any(Number),
      expect.any(String),
      'SOCIAL',
      expect.objectContaining({ pollId: 1, menuItemId: 7, baseAmount: 10 }),
      'vote:1:5:7'
    );
  });

  it('сбой проверки «первого голоса за день» бонус не даёт', async () => {
    farFromDeadline();
    asMock(prismaMock.vote.count).mockRejectedValue(new Error('db down'));
    notUnanimous();

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(10);
  });

  it('сбой проверки единогласия бонус не даёт', async () => {
    farFromDeadline();
    notFirstToday();
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(10);
  });

  it('удалённое голосование бонус за дедлайн не даёт', async () => {
    notFirstToday();
    notUnanimous();
    asMock(prismaMock.poll.findUnique)
      .mockResolvedValueOnce({
        id: 1,
        status: 'ACTIVE',
        endedAt: null,
        groupId: 100,
        selectedMenuItemIds: null,
      })
      .mockResolvedValue(null);

    await VoteService.createVote(vote);

    expect(awardedXP()).toBe(10);
  });
});

describe('upsertVote', () => {
  const vote = { pollId: 1, userId: 5, menuItemId: 7 };

  it('прежние голоса снимаются, остаётся один', async () => {
    await VoteService.upsertVote(vote);

    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5 },
    });
    expect(asMock(prismaMock.vote.create)).toHaveBeenCalled();
    expect(emitted('vote_changed')).toBe(true);
  });

  it('причина отказа доходит до вызывающего как есть', async () => {
    eligible({ status: 'COMPLETED' });

    await expect(VoteService.upsertVote(vote)).rejects.toThrow(
      'Poll is not active'
    );
    expect(emitted('vote_changed')).toBe(false);
  });

  it('upsert с типом заменяет голос и сохраняет свой вариант', async () => {
    const result = await VoteService.upsertVoteWithType({
      pollId: 1,
      userId: 5,
      voteType: VoteType.BRING_OWN,
      customOption: 'Плов из дома',
    });

    expect(result).toMatchObject({ customOption: 'Плов из дома' });
    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalled();
    expect(emitted('vote_changed')).toBe(true);
  });

  it('отказ в upsert с типом пробрасывается', async () => {
    asMock(prismaMock.pollParticipant.findUnique).mockResolvedValue(null);

    await expect(
      VoteService.upsertVoteWithType({
        pollId: 1,
        userId: 5,
        voteType: VoteType.SKIP,
      })
    ).rejects.toThrow('User is not eligible to vote in this poll');
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

  it('несуществующее голосование — PollNotFoundError, голоса не создаются', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(VoteService.castVotes(1, 5, [7])).rejects.toMatchObject({
      statusCode: 404,
      code: 'POLL_NOT_FOUND',
    });
    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
  });

  it('одиночный выбор: несколько блюд — 400 SINGLE_SELECTION_ONLY', async () => {
    poll({ isMultiSelect: false });

    await expect(VoteService.castVotes(1, 5, [7, 8])).rejects.toMatchObject({
      statusCode: 400,
      code: 'SINGLE_SELECTION_ONLY',
    });
    expect(asMock(prismaMock.vote.createMany)).not.toHaveBeenCalled();
  });

  it('одиночный выбор: одно блюдо проходит', async () => {
    poll({ isMultiSelect: false });

    await expect(VoteService.castVotes(1, 5, [7])).resolves.toBeDefined();
  });

  it('превышен лимит выбора — 400 MAX_SELECTIONS_EXCEEDED с числом в тексте', async () => {
    poll({ maxSelections: 2 });

    await expect(VoteService.castVotes(1, 5, [7, 8, 9])).rejects.toMatchObject({
      statusCode: 400,
      code: 'MAX_SELECTIONS_EXCEEDED',
      message: 'Maximum 2 selections allowed',
    });
  });

  /* У старых голосований поле пустое, и они считались множественными.
     Сохранено намеренно: смена умолчания — отдельное решение. */
  it('пустой isMultiSelect понимается как множественный выбор', async () => {
    poll({ isMultiSelect: null });

    await expect(VoteService.castVotes(1, 5, [7, 8])).resolves.toBeDefined();
  });

  it('maxSelections больше трёх не поднимает предел выше трёх', async () => {
    poll({ maxSelections: 10 });

    await expect(VoteService.castVotes(1, 5, [7, 8, 9, 10])).rejects.toMatchObject({
      code: 'MAX_SELECTIONS_EXCEEDED',
      message: 'Maximum 3 selections allowed',
    });
  });
});

describe('removeVote', () => {
  it('снимаются все голоса пользователя в голосовании', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 1,
      status: 'ACTIVE',
    });

    await VoteService.removeVote(1, 5);

    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5 },
    });
    expect(emitted('vote_removed')).toBe(true);
  });

  /* Причина отказа теперь доезжает до вызывающего. Раньше собственный `catch`
     подменял её на «Failed to remove vote», из-за чего ветка 400 в контроллере
     была недостижима и клиент получал 500 за закрытое голосование. Тест это
     закреплял — вместе с подменой; закреплено обратное. */
  it('из завершённого голосования голос убрать нельзя, и причина не теряется', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue({
      id: 1,
      status: 'COMPLETED',
    });

    await expect(VoteService.removeVote(1, 5)).rejects.toThrow(
      'Poll is not active'
    );
    expect(asMock(prismaMock.vote.deleteMany)).not.toHaveBeenCalled();
  });

  it('из несуществующего голосования голос убрать нельзя', async () => {
    asMock(prismaMock.poll.findUnique).mockResolvedValue(null);

    await expect(VoteService.removeVote(1, 5)).rejects.toThrow();
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

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.groupBy).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getVoteBreakdown(1)).rejects.toThrow(
      'Failed to get vote breakdown'
    );
  });
});

describe('чтение голосов', () => {
  it('голоса пользователя — только за блюда', async () => {
    await VoteService.getUserVotes(1, 5);

    expect(asMock(prismaMock.vote.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId: 1, userId: 5, menuItemId: { not: null } },
      })
    );
  });

  it('сбой чтения голосов пользователя превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getUserVotes(1, 5)).rejects.toThrow(
      'Failed to get user votes'
    );
  });

  it('hasUserVoted при сбое отвечает «не голосовал», а не падает', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.hasUserVoted(1, 5)).resolves.toBe(false);
  });

  it('hasUserVoted подтверждает наличие голоса', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([{ id: 1 }]);

    await expect(VoteService.hasUserVoted(1, 5)).resolves.toBe(true);
  });

  it('все голоса голосования отдаются от новых к старым', async () => {
    await VoteService.getPollVotes(1);

    expect(asMock(prismaMock.vote.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  it('сбой чтения всех голосов превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getPollVotes(1)).rejects.toThrow(
      'Failed to get poll votes'
    );
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

  it('сбой подсчёта по блюдам превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getVoteCountByMenuItem(1)).rejects.toThrow(
      'Failed to get vote count by menu item'
    );
  });

  it('в списке голосовавших пропущены голоса без блюда', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      {
        createdAt: NOW,
        user: { id: 1, telegramId: 111n, firstName: 'Иван', lastName: null, username: null },
        menuItem: { name: 'Плов' },
      },
      {
        createdAt: NOW,
        user: { id: 2, telegramId: 222n, firstName: 'Пётр' },
        menuItem: null,
      },
    ]);

    const voters = await VoteService.getPollVoters(1);

    expect(voters).toEqual([
      {
        id: 1,
        telegramId: 111n,
        firstName: 'Иван',
        lastName: undefined,
        username: undefined,
        votedFor: 'Плов',
        votedAt: NOW,
      },
    ]);
  });

  it('сбой чтения голосовавших превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getPollVoters(1)).rejects.toThrow(
      'Failed to get poll voters'
    );
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

  it('сбой в getVoters превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getVoters(1)).rejects.toThrow(
      'Failed to get voters'
    );
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

describe('статистика пользователя', () => {
  function stats(over: Record<string, unknown> = {}) {
    asMock(prismaMock.vote.count).mockResolvedValue(
      (over.totalVotes as number) ?? 7
    );
    asMock(prismaMock.vote.findMany).mockResolvedValue(
      (over.polls as unknown[]) ?? [{ pollId: 1 }, { pollId: 2 }]
    );
    asMock(prismaMock.vote.groupBy).mockResolvedValue(
      (over.favorites as unknown[]) ?? [
        { menuItemId: 7, _count: { menuItemId: 4 } },
      ]
    );
    asMock(prismaMock.vote.findFirst).mockResolvedValue(
      'lastVote' in over ? over.lastVote : { createdAt: NOW }
    );
  }

  it('считает голоса, голосования и любимые блюда', async () => {
    stats();
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([
      { id: 7, name: 'Плов' },
    ]);

    await expect(VoteService.getUserVoteStats(5)).resolves.toEqual({
      totalVotes: 7,
      pollsParticipated: 2,
      favoriteMenuItems: [{ name: 'Плов', votes: 4 }],
      lastVoteDate: NOW,
    });
  });

  it('удалённое любимое блюдо подписывается номером', async () => {
    stats();
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([]);

    const result = await VoteService.getUserVoteStats(5);

    expect(result.favoriteMenuItems).toEqual([
      { name: 'Menu Item #7', votes: 4 },
    ]);
  });

  it('без голосов дата последнего голоса не задана', async () => {
    stats({ totalVotes: 0, polls: [], favorites: [], lastVote: null });

    await expect(VoteService.getUserVoteStats(5)).resolves.toMatchObject({
      totalVotes: 0,
      pollsParticipated: 0,
      favoriteMenuItems: [],
      lastVoteDate: undefined,
    });
  });

  it('сбой чтения статистики превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.count).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getUserVoteStats(5)).rejects.toThrow(
      'Failed to get user vote stats'
    );
  });

  it('история голосов отдаётся страницей и с общим числом', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([{ id: 1 }]);
    asMock(prismaMock.vote.count).mockResolvedValue(30);

    await expect(VoteService.getUserVotesHistory(5, 10, 20)).resolves.toEqual({
      votes: [{ id: 1 }],
      total: 30,
    });
    expect(asMock(prismaMock.vote.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    );
  });

  it('по умолчанию история — первые 20', async () => {
    await VoteService.getUserVotesHistory(5);

    expect(asMock(prismaMock.vote.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 })
    );
  });

  it('сбой чтения истории превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getUserVotesHistory(5)).rejects.toThrow(
      'Failed to get user votes'
    );
  });
});

describe('обслуживание и топы', () => {
  it('пустой список голосований в БД не идёт', async () => {
    await expect(VoteService.removeExpiredVotes([])).resolves.toBe(0);

    expect(asMock(prismaMock.vote.deleteMany)).not.toHaveBeenCalled();
  });

  it('удаляются только завершённые голосования старше 30 дней', async () => {
    asMock(prismaMock.vote.deleteMany).mockResolvedValue({ count: 4 });

    await expect(VoteService.removeExpiredVotes([1, 2])).resolves.toBe(4);
    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: {
        pollId: { in: [1, 2] },
        poll: {
          status: 'COMPLETED',
          createdAt: { lt: new Date('2026-07-04T12:00:00.000Z') },
        },
      },
    });
  });

  it('сбой удаления превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.deleteMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.removeExpiredVotes([1])).rejects.toThrow(
      'Failed to remove expired votes'
    );
  });

  it('топ блюд считает и голоса, и уникальных голосовавших', async () => {
    asMock(prismaMock.vote.groupBy)
      .mockResolvedValueOnce([{ menuItemId: 7, _count: { menuItemId: 5 } }])
      .mockResolvedValueOnce([
        { menuItemId: 7, userId: 1 },
        { menuItemId: 7, userId: 2 },
        { menuItemId: null, userId: 3 },
      ]);
    asMock(prismaMock.menuItem.findMany).mockResolvedValue([
      { id: 7, name: 'Плов' },
    ]);

    await expect(VoteService.getTopMenuItemsByVotes()).resolves.toEqual([
      { menuItemId: 7, menuItemName: 'Плов', totalVotes: 5, uniqueVoters: 2 },
    ]);
  });

  it('период и лимит применяются к запросу', async () => {
    await VoteService.getTopMenuItemsByVotes(7, 3);

    const call = asMock(prismaMock.vote.groupBy).mock.calls[0][0] as {
      where: { createdAt: { gte: Date } };
      take: number;
    };
    expect(call.where.createdAt.gte).toEqual(
      new Date('2026-07-27T12:00:00.000Z')
    );
    expect(call.take).toBe(3);
  });

  it('фильтр по группе добавляется только когда группа задана', async () => {
    await VoteService.getTopMenuItemsByVotes(30, 10, 100);

    expect(
      (
        asMock(prismaMock.vote.groupBy).mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where
    ).toMatchObject({ poll: { groupId: 100 } });
  });

  it('без группы фильтра по группе нет', async () => {
    await VoteService.getTopMenuItemsByVotes();

    expect(
      (
        asMock(prismaMock.vote.groupBy).mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where
    ).not.toHaveProperty('poll');
  });

  it('сбой построения топа превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.groupBy).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getTopMenuItemsByVotes()).rejects.toThrow(
      'Failed to get top menu items by votes'
    );
  });
});

describe('deleteVote', () => {
  it('удаление голоса за блюдо адресное', async () => {
    await VoteService.deleteVote(1, 5, 7);

    expect(asMock(prismaMock.vote.deleteMany)).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5, menuItemId: 7 },
    });
  });

  it('сбой удаления превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.deleteMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.deleteVote(1, 5, 7)).rejects.toThrow(
      'Failed to delete vote'
    );
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

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(VoteService.getVoteTypeStats(1)).rejects.toThrow(
      'Failed to get vote type stats'
    );
  });
});
