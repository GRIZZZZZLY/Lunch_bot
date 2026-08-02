/**
 * Сезоны геймификации. Два свойства, которые нельзя терять:
 *
 * 1. Ротация не должна закрывать сезон раньше срока — иначе награды получают
 *    не те, и «месяц» превращается в неделю.
 * 2. Награды выдаются с идемпотентным ключом на (сезон, пользователь, место):
 *    повторный запуск ротации не должен начислить приз дважды.
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
  it('текущий сезон — активный с наибольшим номером', async () => {
    prismaMock.season.findFirst.mockResolvedValue(seasonFixture() as never);

    const season = await SeasonService.getCurrentSeason();

    expect(prismaMock.season.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { number: 'desc' },
    });
    expect(season).toMatchObject({ id: 3 });
  });

  it('ошибка базы даёт null, а не исключение', async () => {
    prismaMock.season.findFirst.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getCurrentSeason()).resolves.toBeNull();
  });

  it('список сезонов идёт от свежего к старому', async () => {
    prismaMock.season.findMany.mockResolvedValue([seasonFixture()] as never);

    await SeasonService.getAllSeasons(5);

    expect(prismaMock.season.findMany).toHaveBeenCalledWith({
      orderBy: { number: 'desc' },
      take: 5,
    });
  });

  it('ошибка базы даёт пустой список', async () => {
    prismaMock.season.findMany.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getAllSeasons()).resolves.toEqual([]);
  });

  it('сезон по id', async () => {
    prismaMock.season.findUnique.mockResolvedValue(seasonFixture() as never);

    await expect(SeasonService.getSeasonById(3)).resolves.toMatchObject({ id: 3 });
  });

  it('ошибка базы при чтении по id даёт null', async () => {
    prismaMock.season.findUnique.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.getSeasonById(3)).resolves.toBeNull();
  });
});

describe('createMonthlySeason', () => {
  beforeEach(() => {
    prismaMock.season.findFirst.mockResolvedValue(null as never);
    prismaMock.season.create.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: 10, ...args.data })) as never);
  });

  it('первый сезон получает номер 1 и название по месяцу', async () => {
    const season = await SeasonService.createMonthlySeason();

    expect(season).toMatchObject({ number: 1, name: 'Август 2026' });
  });

  it('срок нового сезона — месяц от сегодня', async () => {
    await SeasonService.createMonthlySeason();

    const data = (prismaMock.season.create.mock.calls[0][0] as {
      data: { startDate: Date; endDate: Date };
    }).data;
    expect(data.startDate).toEqual(NOW);
    expect(data.endDate).toEqual(new Date('2026-09-03T12:00:00.000Z'));
  });

  it('номер продолжает нумерацию последнего сезона', async () => {
    // Первый findFirst — активный сезон, второй — последний по номеру.
    prismaMock.season.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ number: 7 } as never);

    const season = await SeasonService.createMonthlySeason();

    expect(season).toMatchObject({ number: 8 });
  });

  it('активный сезон деактивируется перед созданием нового', async () => {
    prismaMock.season.findFirst
      .mockResolvedValueOnce(seasonFixture() as never)
      .mockResolvedValueOnce(seasonFixture() as never);

    await SeasonService.createMonthlySeason();

    expect(prismaMock.season.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isActive: false },
    });
  });

  it('награды и метаданные пишутся строкой JSON', async () => {
    await SeasonService.createMonthlySeason();

    const data = (prismaMock.season.create.mock.calls[0][0] as {
      data: { rewards: string; metadata: string };
    }).data;
    expect(JSON.parse(data.rewards).top3).toHaveLength(3);
    expect(JSON.parse(data.metadata)).toMatchObject({ totalParticipants: 0 });
  });

  it('ошибка базы превращается в понятное исключение', async () => {
    prismaMock.season.create.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.createMonthlySeason()).rejects.toThrow(
      'Failed to create monthly season'
    );
  });
});

describe('rotateSeason', () => {
  beforeEach(() => {
    prismaMock.season.create.mockResolvedValue({ id: 11, number: 4 } as never);
    prismaMock.season.findUnique.mockResolvedValue(seasonFixture() as never);
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);
  });

  it('без активного сезона просто создаёт первый', async () => {
    prismaMock.season.findFirst.mockResolvedValue(null as never);

    await SeasonService.rotateSeason();

    expect(prismaMock.season.create).toHaveBeenCalled();
  });

  it('сезон, который ещё не закончился, ротировать нельзя', async () => {
    prismaMock.season.findFirst.mockResolvedValue(
      seasonFixture({ endDate: new Date('2026-09-01T00:00:00.000Z') }) as never
    );

    await expect(SeasonService.rotateSeason()).rejects.toThrow(
      'Failed to rotate season'
    );
    expect(prismaMock.season.update).not.toHaveBeenCalled();
  });

  it('закончившийся сезон закрывается, награды выдаются, создаётся новый', async () => {
    prismaMock.season.findFirst.mockResolvedValue(seasonFixture() as never);
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 1, _sum: { amount: 900 } },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
    ] as never);

    await SeasonService.rotateSeason();

    expect(prismaMock.season.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isActive: false },
    });
    expect(gamification.awardXP).toHaveBeenCalled();
    expect(prismaMock.season.create).toHaveBeenCalled();
  });
});

describe('awardSeasonRewards', () => {
  /** Лидерборд из N человек с убывающим XP. */
  function leaderboardOf(count: number): void {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        userId: i + 1,
        _sum: { amount: 1000 - i },
      })) as never
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

  it('топ-3 получают свои призы в порядке мест', async () => {
    leaderboardOf(3);

    await SeasonService.awardSeasonRewards(3);

    expect(gamification.awardXP).toHaveBeenCalledTimes(3);
    expect(gamification.awardXP).toHaveBeenNthCalledWith(
      1,
      1,
      500,
      expect.stringContaining('1 место'),
      'SOCIAL',
      expect.objectContaining({ position: 1 }),
      'season:3:1:position:1'
    );
    expect(gamification.awardXP).toHaveBeenNthCalledWith(
      3,
      3,
      200,
      expect.any(String),
      'SOCIAL',
      expect.objectContaining({ position: 3 }),
      'season:3:3:position:3'
    );
  });

  it('идемпотентный ключ уникален на место — повтор не удвоит приз', async () => {
    leaderboardOf(3);

    await SeasonService.awardSeasonRewards(3);

    const keys = gamification.awardXP.mock.calls.map(call => call[5]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('места с 4 по 10 получают приз топ-10', async () => {
    leaderboardOf(10);

    await SeasonService.awardSeasonRewards(3);

    // Лидерборд отдаёт максимум 10 записей: 3 призовых + 7 «топ-10».
    expect(gamification.awardXP).toHaveBeenCalledTimes(10);
    expect(gamification.awardXP).toHaveBeenNthCalledWith(
      4,
      4,
      100,
      expect.stringContaining('топ-10'),
      'SOCIAL',
      expect.any(Object),
      'season:3:4:position:4'
    );
  });

  it('сезона нет — награды не выдаются', async () => {
    prismaMock.season.findUnique.mockResolvedValue(null as never);

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
  it('суммирует XP за сезон и нумерует места', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([
      { userId: 2, _sum: { amount: 900 } },
      { userId: 1, _sum: { amount: 400 } },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
      { id: 2, firstName: 'Аня', lastName: 'П', username: null },
    ] as never);

    const board = await SeasonService.getSeasonLeaderboard(3, 10);

    expect(board).toEqual([
      {
        userId: 2,
        totalXP: 900,
        position: 1,
        user: { firstName: 'Аня', lastName: 'П', username: null },
      },
      {
        userId: 1,
        totalXP: 400,
        position: 2,
        user: { firstName: 'Игорь', lastName: null, username: 'igor' },
      },
    ]);
  });

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

  it('с groupId выборка ограничена активными участниками группы', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);

    await SeasonService.getSeasonLeaderboard(3, 5, 100);

    expect(asMock(prismaMock.xPHistory.groupBy)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId: 3,
          user: {
            groupMemberships: { some: { groupId: 100, isActive: true } },
          },
        },
        take: 5,
      })
    );
  });

  it('без groupId фильтра по группе нет', async () => {
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);

    await SeasonService.getSeasonLeaderboard(3);

    expect(asMock(prismaMock.xPHistory.groupBy)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonId: 3 } })
    );
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

  it('считает сумму, разбивку по категориям и место', async () => {
    const stats = await SeasonService.getUserSeasonStats(1, 3);

    expect(stats).toEqual({
      seasonId: 3,
      seasonName: 'Июль 2026',
      totalXP: 175,
      position: 1,
      categoriesBreakdown: {
        GASTRO: 125,
        RESPONSIBLE: 0,
        SOCIAL: 50,
        EXPLORER: 0,
      },
    });
  });

  it('без seasonId берётся текущий сезон', async () => {
    await SeasonService.getUserSeasonStats(1);

    expect(prismaMock.season.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { number: 'desc' },
    });
  });

  it('сезона нет — null', async () => {
    prismaMock.season.findUnique.mockResolvedValue(null as never);

    await expect(SeasonService.getUserSeasonStats(1, 3)).resolves.toBeNull();
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

describe('checkAndRotateSeason', () => {
  beforeEach(() => {
    prismaMock.season.create.mockResolvedValue({ id: 11, number: 4 } as never);
    prismaMock.season.findUnique.mockResolvedValue(seasonFixture() as never);
    asMock(prismaMock.xPHistory.groupBy).mockResolvedValue([] as never);
  });

  it('без активного сезона создаёт первый', async () => {
    prismaMock.season.findFirst.mockResolvedValue(null as never);

    await SeasonService.checkAndRotateSeason();

    expect(prismaMock.season.create).toHaveBeenCalled();
  });

  it('закончившийся сезон ротируется', async () => {
    prismaMock.season.findFirst.mockResolvedValue(seasonFixture() as never);

    await SeasonService.checkAndRotateSeason();

    expect(prismaMock.season.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { isActive: false },
    });
  });

  it('действующий сезон не трогается', async () => {
    prismaMock.season.findFirst.mockResolvedValue(
      seasonFixture({ endDate: new Date('2026-09-01T00:00:00.000Z') }) as never
    );

    await SeasonService.checkAndRotateSeason();

    expect(prismaMock.season.update).not.toHaveBeenCalled();
    expect(prismaMock.season.create).not.toHaveBeenCalled();
  });

  it('ошибка внутри не выбрасывается наружу (задача по расписанию)', async () => {
    prismaMock.season.findFirst.mockRejectedValue(new Error('db down'));

    await expect(SeasonService.checkAndRotateSeason()).resolves.toBeUndefined();
  });
});
