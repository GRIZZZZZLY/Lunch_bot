/**
 * Опыт, уровни, достижения. Ключевое здесь — идемпотентность начисления:
 * XP приходит из событий (голосование, волонтёрство, награда за сезон), любое
 * из которых может повториться при ретрае. Ключ идемпотентности обязан
 * гасить повтор, а конфликт уникального индекса — переигрываться, а не падать.
 */
import { Prisma } from '@prisma/client';

import {
  GamificationService,
  gamificationService,
} from '../../../services/gamification.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = new Date('2026-08-03T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function statsFixture(overrides: Record<string, unknown> = {}) {
  return {
    userId: 1,
    totalXP: 0,
    level: 1,
    rank: 'Новичок',
    currentStreak: 0,
    longestStreak: 0,
    lastVoteDate: null,
    pollsWon: 0,
    pollsParticipated: 0,
    categoriesTried: 0,
    timesResponsible: 0,
    timesVolunteer: 0,
    ordersReceived: 0,
    paymentsOnTime: 0,
    referralsCount: 0,
    newDishesDiscovered: 0,
    menuItemsAdded: 0,
    user: { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  asMock(prismaMock.season.findFirst).mockResolvedValue(null);
  asMock(prismaMock.xPHistory.findUnique).mockResolvedValue(null);
  asMock(prismaMock.xPHistory.create).mockResolvedValue({ id: 1 });
  asMock(prismaMock.userStats.upsert).mockResolvedValue(
    statsFixture()
  );
  asMock(prismaMock.userStats.update).mockResolvedValue(
    statsFixture({ totalXP: 100, level: 1 })
  );
  asMock(prismaMock.userStats.findUnique).mockResolvedValue(
    statsFixture()
  );
  asMock(prismaMock.userStats.findUniqueOrThrow).mockResolvedValue(
    statsFixture({ totalXP: 500, level: 3 })
  );
  asMock(prismaMock.achievement.findMany).mockResolvedValue([] as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('уровни и звания', () => {
  it.each([
    [0, 1],
    [-10, 1],
    [100, 1],
    [1000, 4],
    [10_000, 21],
  ])('XP %i соответствует уровню %i', (xp, level) => {
    expect(GamificationService.calculateLevel(xp)).toBe(level);
  });

  it('порог уровня растёт быстрее линейного', () => {
    expect(GamificationService.xpForLevel(1)).toBe(100);
    expect(GamificationService.xpForLevel(4)).toBe(800);
    expect(GamificationService.xpForLevel(10)).toBe(3162);
  });

  it.each([
    [1, 'Новичок'],
    [5, 'Гурман'],
    [10, 'Эксперт'],
    [15, 'Мастер'],
    [20, 'Легенда'],
    [25, 'Гранд-мастер'],
  ])('уровень %i — звание «%s»', (level, title) => {
    expect(GamificationService.getRankTitle(level)).toBe(title);
  });
});

describe('awardXP', () => {
  it('начисляет опыт, пишет историю и пересчитывает уровень', async () => {
    asMock(prismaMock.userStats.update)
      .mockResolvedValueOnce(statsFixture({ totalXP: 1000 }))
      .mockResolvedValueOnce(
        statsFixture({ totalXP: 1000, level: 4, rank: 'Новичок' })
      );

    const result = await GamificationService.awardXP(1, 1000, 'Тест', 'SOCIAL');

    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        amount: 1000,
        reason: 'Тест',
        category: 'SOCIAL',
      }),
    });
    expect(result).toMatchObject({ applied: true, leveledUp: true, newLevel: 4 });
  });

  it('повтор с тем же ключом идемпотентности ничего не начисляет', async () => {
    asMock(prismaMock.xPHistory.findUnique).mockResolvedValue({
      id: 1,
    });

    const result = await GamificationService.awardXP(
      1,
      100,
      'Тест',
      'SOCIAL',
      undefined,
      'poll-vote:5:1'
    );

    expect(result).toMatchObject({ applied: false, leveledUp: false });
    expect(prismaMock.xPHistory.create).not.toHaveBeenCalled();
  });

  it('опыт привязывается к активному сезону', async () => {
    asMock(prismaMock.season.findFirst).mockResolvedValue({ id: 3 });

    await GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL');

    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ seasonId: 3 }),
    });
  });

  it('без активного сезона опыт всё равно начисляется', async () => {
    await GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL');

    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ seasonId: null }),
    });
  });

  it.each([
    ['нецелый userId', [1.5, 100, 'Тест']],
    ['userId ноль', [0, 100, 'Тест']],
    ['нулевой опыт', [1, 0, 'Тест']],
    ['отрицательный опыт', [1, -5, 'Тест']],
    ['опыт больше 100000', [1, 100_001, 'Тест']],
    ['нецелый опыт', [1, 1.5, 'Тест']],
    ['пустая причина', [1, 100, '']],
    ['причина длиннее 300', [1, 100, 'x'.repeat(301)]],
  ])('%s — отказ до записи', async (_label, args) => {
    const [userId, amount, reason] = args as [number, number, string];

    await expect(
      GamificationService.awardXP(userId, amount, reason, 'SOCIAL')
    ).rejects.toThrow('Invalid XP award parameters');
    expect(prismaMock.xPHistory.create).not.toHaveBeenCalled();
  });

  it.each([
    ['слишком короткий', 'short'],
    ['слишком длинный', 'k'.repeat(201)],
  ])('ключ идемпотентности %s — отказ', async (_label, key) => {
    await expect(
      GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL', undefined, key)
    ).rejects.toThrow('Invalid XP award parameters');
  });

  it('слишком большие метаданные не пишутся', async () => {
    await expect(
      GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL', {
        blob: 'x'.repeat(5000),
      })
    ).rejects.toThrow('XP metadata is too large');
  });

  it('конфликт сериализации переигрывается', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '6',
    });
    const transaction = asMock(prismaMock.$transaction);
    const original = transaction.getMockImplementation()!;
    transaction
      .mockImplementationOnce(() => Promise.reject(conflict))
      .mockImplementationOnce(original as never);

    const promise = GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL');
    await jest.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toMatchObject({ applied: true });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('исчерпание попыток даёт понятную ошибку', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '6',
    });
    asMock(prismaMock.$transaction).mockRejectedValue(conflict);

    const promise = GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL');
    const assertion = expect(promise).rejects.toThrow('write conflict');
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('прочая ошибка базы не переигрывается', async () => {
    asMock(prismaMock.$transaction).mockRejectedValue(new Error('db down'));

    await expect(
      GamificationService.awardXP(1, 100, 'Тест', 'SOCIAL')
    ).rejects.toThrow('db down');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('при повышении уровня проверяются достижения', async () => {
    asMock(prismaMock.userStats.update)
      .mockResolvedValueOnce(statsFixture({ totalXP: 1000 }))
      .mockResolvedValueOnce(statsFixture({ totalXP: 1000, level: 4 }));

    await GamificationService.awardXP(1, 1000, 'Тест', 'SOCIAL');

    expect(prismaMock.achievement.findMany).toHaveBeenCalled();
  });
});

describe('updateStreak', () => {
  it('первый голос создаёт серию из одного дня', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(null);
    asMock(prismaMock.userStats.create).mockResolvedValue({});

    await GamificationService.updateStreak(1);

    expect(prismaMock.userStats.create).toHaveBeenCalledWith({
      data: { userId: 1, currentStreak: 1, longestStreak: 1, lastVoteDate: NOW },
    });
  });

  it('голос на следующий день продлевает серию', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        currentStreak: 3,
        longestStreak: 5,
        lastVoteDate: new Date(NOW.getTime() - DAY),
      })
    );

    await GamificationService.updateStreak(1);

    expect(prismaMock.userStats.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { currentStreak: 4, longestStreak: 5, lastVoteDate: NOW },
    });
  });

  it('повторный голос в тот же день серию не меняет', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({ currentStreak: 3, lastVoteDate: NOW })
    );

    await GamificationService.updateStreak(1);

    expect(prismaMock.userStats.update).not.toHaveBeenCalled();
  });

  it('пропущенный день обнуляет серию', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        currentStreak: 9,
        longestStreak: 9,
        lastVoteDate: new Date(NOW.getTime() - 3 * DAY),
      })
    );

    await GamificationService.updateStreak(1);

    expect(prismaMock.userStats.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { currentStreak: 1, longestStreak: 9, lastVoteDate: NOW },
    });
  });

  it('каждые семь дней подряд дают бонус', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        currentStreak: 6,
        longestStreak: 6,
        lastVoteDate: new Date(NOW.getTime() - DAY),
      })
    );

    await GamificationService.updateStreak(1);

    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 50, reason: 'Серия 7 дней!' }),
    });
  });

  it('запись без даты голоса начинает серию заново', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({ currentStreak: 0, lastVoteDate: null })
    );

    await GamificationService.updateStreak(1);

    expect(prismaMock.userStats.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: expect.objectContaining({ currentStreak: 1 }),
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.userStats.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(GamificationService.updateStreak(1)).rejects.toThrow('db down');
  });
});

describe('рейтинги и счётчики', () => {
  it.each([
    ['GASTRO', 'gastroRating'],
    ['RESPONSIBLE', 'responsibleRating'],
    ['SOCIAL', 'socialRating'],
    ['EXPLORER', 'explorerRating'],
  ])('категория %s пишется в поле %s', async (category, field) => {
    await GamificationService.updateRating(
      1,
      category as 'GASTRO',
      10
    );

    expect(prismaMock.userStats.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      create: { userId: 1, [field]: 10 },
      update: { [field]: { increment: 10 } },
    });
  });

  it('счётчик увеличивается на указанную величину', async () => {
    await GamificationService.incrementStat(1, 'pollsWon', 2);

    expect(prismaMock.userStats.upsert).toHaveBeenCalledWith({
      where: { userId: 1 },
      create: { userId: 1, pollsWon: 2 },
      update: { pollsWon: { increment: 2 } },
    });
  });

  it('по умолчанию счётчик растёт на единицу', async () => {
    await GamificationService.incrementStat(1, 'pollsWon');

    expect(prismaMock.userStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: 1, pollsWon: 1 } })
    );
  });

  it('рейтинги пересчитываются по формулам', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        pollsWon: 2,
        pollsParticipated: 10,
        categoriesTried: 3,
        timesResponsible: 1,
        timesVolunteer: 2,
        ordersReceived: 4,
        currentStreak: 5,
        longestStreak: 9,
        paymentsOnTime: 6,
        referralsCount: 1,
        newDishesDiscovered: 7,
        menuItemsAdded: 2,
      })
    );

    await GamificationService.recalculateRatings(1);

    expect(prismaMock.userStats.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: {
        gastroRating: 2 * 10 + 10 * 2 + 3 * 20,
        responsibleRating: 1 * 50 + 2 * 100 + 4 * 30,
        socialRating: 5 * 20 + 9 * 10 + 6 * 15 + 1 * 100,
        explorerRating: 7 * 10 + 3 * 50 + 2 * 30,
      },
    });
  });

  it('без статистики пересчитывать нечего', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(null);

    await GamificationService.recalculateRatings(1);

    expect(prismaMock.userStats.update).not.toHaveBeenCalled();
  });
});

describe('достижения', () => {
  const achievement = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    key: 'FIRST_VOTE',
    title: 'Первый голос',
    category: 'GASTRO',
    xpReward: 50,
    isActive: true,
    isHidden: false,
    rarity: 'COMMON',
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsParticipated',
      value: 1,
    }),
    ...overrides,
  });

  beforeEach(() => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        pollsParticipated: 5,
        level: 3,
        currentStreak: 2,
        user: { achievements: [] },
      })
    );
    asMock(prismaMock.achievement.findMany).mockResolvedValue([
      achievement(),
    ] as never);
    asMock(prismaMock.achievement.findUnique).mockResolvedValue(
      achievement()
    );
    asMock(prismaMock.userAchievement.create).mockResolvedValue({
      id: 1,
    });
  });

  it('выполненное условие открывает достижение и даёт опыт', async () => {
    await GamificationService.checkAchievements(1);

    expect(prismaMock.userAchievement.create).toHaveBeenCalledWith({
      data: { userId: 1, achievementId: 1, progress: 100 },
    });
    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 50 }),
    });
  });

  it('уже открытое достижение не выдаётся повторно', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({
        pollsParticipated: 5,
        user: { achievements: [{ achievementId: 1 }] },
      })
    );

    await GamificationService.checkAchievements(1);

    expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
  });

  it.each([
    ['stat_gte выполнено', { type: 'stat_gte', stat: 'pollsParticipated', value: 5 }, true],
    ['stat_gte не выполнено', { type: 'stat_gte', stat: 'pollsParticipated', value: 99 }, false],
    ['stat_lte выполнено', { type: 'stat_lte', stat: 'pollsParticipated', value: 10 }, true],
    ['level выполнено', { type: 'level', value: 3 }, true],
    ['level не выполнено', { type: 'level', value: 10 }, false],
    ['streak выполнено', { type: 'streak', value: 2 }, true],
    ['custom всегда false', { type: 'custom' }, false],
    ['неизвестный тип', { type: 'НЕТ' }, false],
    ['stat_gte без поля', { type: 'stat_gte', value: 1 }, false],
  ])('условие %s', async (_label, requirement, unlocked) => {
    asMock(prismaMock.achievement.findMany).mockResolvedValue([
      achievement({ requirement: JSON.stringify(requirement) }),
    ] as never);

    await GamificationService.checkAchievements(1);

    if (unlocked) {
      expect(prismaMock.userAchievement.create).toHaveBeenCalled();
    } else {
      expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
    }
  });

  it('требование объектом (не строкой) тоже читается', async () => {
    asMock(prismaMock.achievement.findMany).mockResolvedValue([
      achievement({
        requirement: { type: 'stat_gte', stat: 'pollsParticipated', value: 1 },
      }),
    ] as never);

    await GamificationService.checkAchievements(1);

    expect(prismaMock.userAchievement.create).toHaveBeenCalled();
  });

  it('без статистики достижения не проверяются', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(null);

    await GamificationService.checkAchievements(1);

    expect(prismaMock.achievement.findMany).not.toHaveBeenCalled();
  });

  it('неизвестное достижение открыть нельзя', async () => {
    asMock(prismaMock.achievement.findUnique).mockResolvedValue(null);

    await GamificationService.unlockAchievement(1, 99);

    expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
  });

  it('повторная выдача (уникальный индекс) не выбрасывается наружу', async () => {
    asMock(prismaMock.userAchievement.create).mockRejectedValue(
      Object.assign(new Error('UNIQUE constraint failed'), {
        code: 'UNIQUE_VIOLATION',
      })
    );

    await expect(
      GamificationService.unlockAchievement(1, 1)
    ).resolves.toBeUndefined();
  });

  it('список достижений помечает открытые', async () => {
    asMock(prismaMock.achievement.findMany).mockResolvedValue([
      achievement({ id: 1 }),
      achievement({ id: 2, key: 'SECOND' }),
    ] as never);
    asMock(prismaMock.userAchievement.findMany).mockResolvedValue([
      { achievementId: 1, unlockedAt: NOW },
    ] as never);

    const list = await GamificationService.getAchievementsWithStatus(1);

    expect(list[0]).toMatchObject({ id: 1, unlocked: true, unlockedAt: NOW });
    expect(list[1]).toMatchObject({ id: 2, unlocked: false });
  });

  it('скрытые достижения в список не попадают', async () => {
    asMock(prismaMock.achievement.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.userAchievement.findMany).mockResolvedValue([] as never);

    await GamificationService.getAchievementsWithStatus(1);

    expect(prismaMock.achievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, isHidden: false } })
    );
  });
});

describe('getLeaderboard', () => {
  beforeEach(() => {
    asMock(prismaMock.userStats.findMany).mockResolvedValue([
      { userId: 1, totalXP: 500, level: 3, rank: 'Новичок', user: { id: 1 } },
      { userId: 2, totalXP: 100, level: 1, rank: 'Новичок', user: { id: 2 } },
    ] as never);
  });

  it('места нумеруются по порядку', async () => {
    const board = await GamificationService.getLeaderboard('TOTAL', 10);

    expect(board[0]).toMatchObject({ position: 1, userId: 1 });
    expect(board[1]).toMatchObject({ position: 2, userId: 2 });
  });

  it.each([
    ['TOTAL', 'totalXP'],
    ['GASTRO', 'gastroRating'],
    ['RESPONSIBLE', 'responsibleRating'],
    ['SOCIAL', 'socialRating'],
    ['EXPLORER', 'explorerRating'],
  ])('категория %s сортируется по полю %s', async (category, field) => {
    await GamificationService.getLeaderboard(category as 'TOTAL', 10);

    expect(prismaMock.userStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { [field]: 'desc' } })
    );
  });

  it('с groupId выборка ограничена активными участниками группы', async () => {
    await GamificationService.getLeaderboard('TOTAL', 10, 100);

    expect(prismaMock.userStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: { groupMemberships: { some: { groupId: 100, isActive: true } } },
        },
      })
    );
  });

  it('сезонный лидерборд считается по истории опыта', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 1, _sum: { amount: 900 } },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
    ] as never);

    const board = await GamificationService.getLeaderboard('TOTAL', 10, 100, 3);

    expect(prismaMock.xPHistory.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seasonId: 3 }),
      })
    );
    // 900 XP: floor((900/100)^(2/3)) = 4.
    expect(board[0]).toMatchObject({ position: 1, totalXP: 900, level: 4 });
  });

  it('seasonId null означает за всё время', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([] as never);

    await GamificationService.getLeaderboard('TOTAL', 10, undefined, null);

    expect(prismaMock.xPHistory.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('сезонный лидерборд по категории фильтрует историю', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 1, _sum: { amount: 300 } },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      { id: 1, firstName: 'Игорь' },
    ] as never);

    const board = await GamificationService.getLeaderboard('GASTRO', 10, 100, 3);

    expect(prismaMock.xPHistory.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'GASTRO' }),
      })
    );
    expect(board[0]).toMatchObject({ gastroRating: 300, socialRating: 0 });
  });

  it('ошибка сезонного лидерборда даёт пустой список', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      GamificationService.getLeaderboard('TOTAL', 10, undefined, 3)
    ).resolves.toEqual([]);
  });
});

describe('getUserStats', () => {
  it('добавляет прогресс до следующего уровня', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(
      statsFixture({ totalXP: 400, level: 3 })
    );

    const stats = await GamificationService.getUserStats(1);

    // Уровень 3 = 519 XP, уровень 4 = 800 XP.
    expect(stats).toMatchObject({
      xpProgress: 400 - 519,
      xpRequired: 800 - 519,
    });
  });

  it('без записи статистика создаётся', async () => {
    asMock(prismaMock.userStats.findUnique).mockResolvedValue(null);
    asMock(prismaMock.userStats.create).mockResolvedValue(
      statsFixture()
    );

    await GamificationService.getUserStats(1);

    expect(prismaMock.userStats.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 1 } })
    );
  });
});

describe('getXPHistory', () => {
  it('по умолчанию отдаёт 50 последних записей', async () => {
    asMock(prismaMock.xPHistory.findMany).mockResolvedValue([] as never);

    await GamificationService.getXPHistory(1);

    expect(prismaMock.xPHistory.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('лимит можно задать', async () => {
    asMock(prismaMock.xPHistory.findMany).mockResolvedValue([] as never);

    await GamificationService.getXPHistory(1, 5);

    expect(prismaMock.xPHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

describe('фасад gamificationService', () => {
  it('делегирует вызовы в статические методы', async () => {
    asMock(prismaMock.userStats.findMany).mockResolvedValue([] as never);

    await gamificationService.getUserProgress(1);
    await gamificationService.addXP(1, 100, 'Тест');
    await gamificationService.checkAchievements(1);
    await gamificationService.getLeaderboard(5, 100);

    expect(prismaMock.xPHistory.create).toHaveBeenCalled();
    expect(prismaMock.userStats.findMany).toHaveBeenCalled();
  });

  it('addXP без причины подставляет заглушку', async () => {
    await gamificationService.addXP(1, 100);

    expect(prismaMock.xPHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'unknown', category: 'SOCIAL' }),
    });
  });
});
