/**
 * Опыт, уровни, достижения. Ключевое здесь — идемпотентность начисления:
 * XP приходит из событий (голосование, волонтёрство, награда за сезон), любое
 * из которых может повториться при ретрае. Ключ идемпотентности обязан
 * гасить повтор, а конфликт уникального индекса — переигрываться, а не падать.
 */
import { Prisma } from '@prisma/client';

import { GamificationService } from '../../../services/gamification.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = new Date('2026-08-03T12:00:00.000Z');

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

});

describe('awardXP', () => {
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

});

describe('recalculateRatings', () => {
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

    expect(prismaMock.userAchievement.create).not.toHaveBeenCalled();
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

});
