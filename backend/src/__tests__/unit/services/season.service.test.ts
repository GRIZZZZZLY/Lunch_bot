/**
 * Сезоны геймификации. Ротацию, нумерацию, призы по местам и лидерборд
 * группы проверяет интеграционный набор gamification.redis.test.ts. Здесь:
 *
 * - награды выдаются с идемпотентным ключом на (сезон, пользователь, место):
 *   повторная выдача того же сезона несёт те же ключи и приз не удвоит;
 * - пустые и неполные данные и сбои БД не роняют чтение и ротацию.
 */
import { SeasonService } from '../../../services/season.service';
import { GamificationService } from '../../../services/gamification.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/gamification.service', () =>
  require('../../helpers/gamification-mock')
);

/* Сервис подтягивает геймификацию динамически, с расширением .js — для jest это
   отдельный путь модуля, и без второго мока вызовы уходили в настоящий сервис. */
jest.mock(
  '../../../services/gamification.service.js',
  () => require('../../helpers/gamification-mock'),
  { virtual: true }
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const gamification = asServiceMock(GamificationService);

const NOW = new Date('2026-08-03T12:00:00.000Z');

const REWARDS = {
  top3: [
    { xp: 500, badge: '🥇' },
    { xp: 300, badge: '🥈' },
    { xp: 200, badge: '🥉' },
  ],
  top10: { xp: 100, badge: '🏆' },
  participant: { xp: 50 },
};

function seasonFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    number: 3,
    name: 'Июль 2026',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-08-01T00:00:00.000Z'),
    isActive: true,
    rewards: JSON.stringify(REWARDS),
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  gamification.awardXP.mockResolvedValue({ xp: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('чтение сезонов', () => {
  it('ошибка базы даёт null, а не исключение', async () => {
    prismaMock.season.findFirst.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getCurrentSeason()).resolves.toBeNull();
  });

  it('ошибка базы даёт пустой список', async () => {
    prismaMock.season.findMany.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getAllSeasons()).resolves.toEqual([]);
  });

  it('ошибка базы при чтении по id даёт null', async () => {
    prismaMock.season.findUnique.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getSeasonById(3)).resolves.toBeNull();
  });
});

describe('createMonthlySeason', () => {
  beforeEach(() => {
    prismaMock.season.findFirst.mockResolvedValue(null);
    prismaMock.season.create.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: 10, ...args.data })) as never);
  });

  it('первый сезон получает номер 1 и название по месяцу', async () => {
    const season = await SeasonService.createMonthlySeason();

    expect(season).toMatchObject({ number: 1, name: 'Август 2026' });
  });

  it('срок нового сезона — месяц от сегодня', async () => {
    const season = await SeasonService.createMonthlySeason();

    expect(season).toMatchObject({
      startDate: NOW,
      endDate: new Date('2026-09-03T12:00:00.000Z'),
    });
  });
});

describe('awardSeasonRewards', () => {
  /** Лидерборд из N человек с убывающим XP. */
  function leaderboardOf(count: number): void {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        userId: i + 1,
        _sum: { amount: 1000 - i },
      }))
    );
    prismaMock.user.findMany.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        firstName: `Игрок${i + 1}`,
        lastName: null,
        username: null,
      })) as never
    );
  }

  beforeEach(() => {
    prismaMock.season.findUnique.mockResolvedValue(seasonFixture() as never);
  });

  it('идемпотентный ключ уникален на место и повторяется при повторной выдаче', async () => {
    leaderboardOf(3);

    await SeasonService.awardSeasonRewards(3);
    const first = gamification.awardXP.mock.calls.map(call => call[5]);
    gamification.awardXP.mockClear();
    await SeasonService.awardSeasonRewards(3);
    const second = gamification.awardXP.mock.calls.map(call => call[5]);

    expect(new Set(first).size).toBe(first.length);
    expect(second).toEqual(first);
  });

  it('сезона нет — награды не выдаются', async () => {
    prismaMock.season.findUnique.mockResolvedValue(null);

    await SeasonService.awardSeasonRewards(3);

    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('пустой лидерборд — награды не выдаются', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);

    await SeasonService.awardSeasonRewards(3);

    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('сезон без настроенных наград пропускается', async () => {
    prismaMock.season.findUnique.mockResolvedValue(
      seasonFixture({ rewards: null }) as never
    );
    leaderboardOf(3);

    await SeasonService.awardSeasonRewards(3);

    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('награды объектом (не строкой) тоже принимаются', async () => {
    prismaMock.season.findUnique.mockResolvedValue(
      seasonFixture({ rewards: REWARDS }) as never
    );
    leaderboardOf(1);

    await SeasonService.awardSeasonRewards(3);

    expect(gamification.awardXP).toHaveBeenCalledTimes(1);
  });

  it('падение начисления не роняет ротацию', async () => {
    leaderboardOf(3);
    gamification.awardXP.mockRejectedValue(new Error('boom'));

    await expect(SeasonService.awardSeasonRewards(3)).resolves.toBeUndefined();
  });
});

describe('getSeasonLeaderboard', () => {
  it('нулевая сумма не превращается в undefined', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 1, _sum: { amount: null } },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: null },
    ] as never);

    const board = await SeasonService.getSeasonLeaderboard(3);

    expect(board[0].totalXP).toBe(0);
  });

  it('ошибка базы даёт пустой лидерборд', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getSeasonLeaderboard(3)).resolves.toEqual([]);
  });
});

describe('getUserSeasonStats', () => {
  beforeEach(() => {
    prismaMock.season.findUnique.mockResolvedValue(seasonFixture() as never);
    prismaMock.season.findFirst.mockResolvedValue(seasonFixture() as never);
    prismaMock.xPHistory.findMany.mockResolvedValue([
      { amount: 100, category: 'GASTRO' },
      { amount: 50, category: 'SOCIAL' },
      { amount: 25, category: 'GASTRO' },
    ] as never);
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 1, _sum: { amount: 175 } },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: null },
    ] as never);
  });

  it('пользователя нет в лидерборде — место null', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 99, _sum: { amount: 500 } },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 99, firstName: 'Другой', lastName: null, username: null },
    ] as never);

    const stats = await SeasonService.getUserSeasonStats(1, 3);

    expect(stats?.position).toBeNull();
  });

  it('неизвестная категория XP не ломает разбивку', async () => {
    prismaMock.xPHistory.findMany.mockResolvedValue([
      { amount: 10, category: 'НЕИЗВЕСТНО' },
    ] as never);

    const stats = await SeasonService.getUserSeasonStats(1, 3);

    expect(stats?.totalXP).toBe(10);
    expect(stats?.categoriesBreakdown).toEqual({
      GASTRO: 0,
      RESPONSIBLE: 0,
      SOCIAL: 0,
      EXPLORER: 0,
    });
  });

  it('ошибка базы даёт null', async () => {
    prismaMock.xPHistory.findMany.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getUserSeasonStats(1, 3)).resolves.toBeNull();
  });
});
