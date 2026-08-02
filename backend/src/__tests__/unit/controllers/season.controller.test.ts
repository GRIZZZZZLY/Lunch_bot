/**
 * Сезоны и сезонные лидерборды. Лидерборд обязан быть привязан к группе:
 * без groupId он показывал бы очки людей из чужих команд. Личная статистика —
 * только своя или админская.
 */
import { SeasonController } from '../../../api/controllers/season.controller';
import { SeasonService } from '../../../services/season.service';
import { GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/season.service', () => ({
  SeasonService: {
    getAllSeasons: jest.fn(),
    getCurrentSeason: jest.fn(),
    getSeasonById: jest.fn(),
    getSeasonLeaderboard: jest.fn(),
    getUserSeasonStats: jest.fn(),
    rotateSeason: jest.fn(),
    createMonthlySeason: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const seasons = asServiceMock(SeasonService);
const groupService = asServiceMock(GroupService);

const USER = { id: 1, isAdmin: false };
const ADMIN = { id: 9, isAdmin: true };
const SEASON = { id: 3, name: 'Август 2026' };

beforeEach(() => {
  jest.clearAllMocks();
  groupService.isUserGroupMember.mockResolvedValue(true);
});

describe('GET /api/seasons', () => {
  it('отдаёт список сезонов', async () => {
    seasons.getAllSeasons.mockResolvedValue([SEASON]);
    const res = mockResponse();

    await SeasonController.getAllSeasons(mockRequest({ user: USER }), res);

    expect(seasons.getAllSeasons).toHaveBeenCalledWith(undefined);
    expect(res.body).toMatchObject({ data: [SEASON] });
  });

  it('лимит передаётся в сервис', async () => {
    seasons.getAllSeasons.mockResolvedValue([]);

    await SeasonController.getAllSeasons(
      mockRequest({ user: USER, query: { limit: '5' } }),
      mockResponse()
    );

    expect(seasons.getAllSeasons).toHaveBeenCalledWith(5);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getAllSeasons.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getAllSeasons(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/seasons/current', () => {
  it('отдаёт активный сезон', async () => {
    seasons.getCurrentSeason.mockResolvedValue(SEASON);
    const res = mockResponse();

    await SeasonController.getCurrentSeason(mockRequest({ user: USER }), res);

    expect(res.body).toMatchObject({ data: SEASON });
  });

  it('активного сезона нет — 404', async () => {
    seasons.getCurrentSeason.mockResolvedValue(null);
    const res = mockResponse();

    await SeasonController.getCurrentSeason(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getCurrentSeason.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getCurrentSeason(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/seasons/:id', () => {
  it('отдаёт сезон по id', async () => {
    seasons.getSeasonById.mockResolvedValue(SEASON);
    const res = mockResponse();

    await SeasonController.getSeasonById(
      mockRequest({ user: USER, params: { id: '3' } }),
      res
    );

    expect(seasons.getSeasonById).toHaveBeenCalledWith(3);
    expect(res.body).toMatchObject({ data: SEASON });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await SeasonController.getSeasonById(
      mockRequest({ user: USER, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('сезона нет — 404', async () => {
    seasons.getSeasonById.mockResolvedValue(null);
    const res = mockResponse();

    await SeasonController.getSeasonById(
      mockRequest({ user: USER, params: { id: '3' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getSeasonById.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getSeasonById(
      mockRequest({ user: USER, params: { id: '3' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/seasons/:id/leaderboard', () => {
  beforeEach(() => {
    seasons.getSeasonLeaderboard.mockResolvedValue([{ userId: 1, xp: 100 }]);
  });

  it('отдаёт лидерборд группы, по умолчанию 10 мест', async () => {
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({ user: USER, params: { id: '3' }, query: { groupId: '100' } }),
      res
    );

    expect(seasons.getSeasonLeaderboard).toHaveBeenCalledWith(3, 10, 100);
    expect(res.body).toMatchObject({ data: [{ userId: 1 }] });
  });

  it('лимит из запроса', async () => {
    await SeasonController.getSeasonLeaderboard(
      mockRequest({
        user: USER,
        params: { id: '3' },
        query: { groupId: '100', limit: '25' },
      }),
      mockResponse()
    );

    expect(seasons.getSeasonLeaderboard).toHaveBeenCalledWith(3, 25, 100);
  });

  it('нечисловой id сезона — 400', async () => {
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({
        user: USER,
        params: { id: 'нет' },
        query: { groupId: '100' },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['без groupId', {}],
    ['нечисловой groupId', { groupId: 'нет' }],
    ['нулевой groupId', { groupId: '0' }],
  ])('%s — 400', async (_label, query) => {
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({ user: USER, params: { id: '3' }, query }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(seasons.getSeasonLeaderboard).not.toHaveBeenCalled();
  });

  it('не участник группы — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({ user: USER, params: { id: '3' }, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('глобальный админ смотрит любой лидерборд', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({ user: ADMIN, params: { id: '3' }, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getSeasonLeaderboard.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getSeasonLeaderboard(
      mockRequest({ user: USER, params: { id: '3' }, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/seasons/:id/stats/:userId', () => {
  beforeEach(() => {
    seasons.getUserSeasonStats.mockResolvedValue({ xp: 250 });
  });

  it('пользователь смотрит свою статистику', async () => {
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: USER, params: { id: '3', userId: '1' } }),
      res
    );

    expect(seasons.getUserSeasonStats).toHaveBeenCalledWith(1, 3);
    expect(res.body).toMatchObject({ data: { xp: 250 } });
  });

  it('чужую статистику видит только админ', async () => {
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: USER, params: { id: '3', userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(seasons.getUserSeasonStats).not.toHaveBeenCalled();
  });

  it('админ смотрит чужую статистику', async () => {
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: ADMIN, params: { id: '3', userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['нечисловой сезон', { id: 'нет', userId: '1' }],
    ['нечисловой пользователь', { id: '3', userId: 'нет' }],
  ])('%s — 400', async (_label, params) => {
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: USER, params }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('статистики нет — 404', async () => {
    seasons.getUserSeasonStats.mockResolvedValue(null);
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: USER, params: { id: '3', userId: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getUserSeasonStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getUserSeasonStats(
      mockRequest({ user: USER, params: { id: '3', userId: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/seasons/current/stats/:userId', () => {
  beforeEach(() => {
    seasons.getUserSeasonStats.mockResolvedValue({ xp: 10 });
  });

  it('без seasonId сервис отдаёт текущий сезон', async () => {
    const res = mockResponse();

    await SeasonController.getCurrentSeasonUserStats(
      mockRequest({ user: USER, params: { userId: '1' } }),
      res
    );

    expect(seasons.getUserSeasonStats).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ data: { xp: 10 } });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await SeasonController.getCurrentSeasonUserStats(
      mockRequest({ user: USER, params: { userId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('чужая статистика — 403', async () => {
    const res = mockResponse();

    await SeasonController.getCurrentSeasonUserStats(
      mockRequest({ user: USER, params: { userId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('нет активного сезона — 404', async () => {
    seasons.getUserSeasonStats.mockResolvedValue(null);
    const res = mockResponse();

    await SeasonController.getCurrentSeasonUserStats(
      mockRequest({ user: USER, params: { userId: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    seasons.getUserSeasonStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.getCurrentSeasonUserStats(
      mockRequest({ user: USER, params: { userId: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/seasons/rotate', () => {
  it('админ ротирует сезон', async () => {
    seasons.rotateSeason.mockResolvedValue({ id: 4 });
    const res = mockResponse();

    await SeasonController.rotateSeason(mockRequest({ user: ADMIN }), res);

    expect(res.body).toMatchObject({ message: 'Season rotated successfully' });
  });

  it('не админ — 403', async () => {
    const res = mockResponse();

    await SeasonController.rotateSeason(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(403);
    expect(seasons.rotateSeason).not.toHaveBeenCalled();
  });

  it('без аутентификации — 403', async () => {
    const res = mockResponse();

    await SeasonController.rotateSeason(mockRequest(), res);

    expect(res.statusCode).toBe(403);
  });

  it('сезон ещё не закончился — 400', async () => {
    seasons.rotateSeason.mockRejectedValue(new Error('Season has not ended yet'));
    const res = mockResponse();

    await SeasonController.rotateSeason(mockRequest({ user: ADMIN }), res);

    expect(res.statusCode).toBe(400);
  });

  it('прочая ошибка — 500', async () => {
    seasons.rotateSeason.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.rotateSeason(mockRequest({ user: ADMIN }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/seasons/create', () => {
  it('админ создаёт месячный сезон', async () => {
    seasons.createMonthlySeason.mockResolvedValue({ id: 5 });
    const res = mockResponse();

    await SeasonController.createMonthlySeason(mockRequest({ user: ADMIN }), res);

    expect(res.body).toMatchObject({ message: 'Season created successfully' });
  });

  it('не админ — 403', async () => {
    const res = mockResponse();

    await SeasonController.createMonthlySeason(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(403);
    expect(seasons.createMonthlySeason).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    seasons.createMonthlySeason.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await SeasonController.createMonthlySeason(mockRequest({ user: ADMIN }), res);

    expect(res.statusCode).toBe(500);
  });
});
