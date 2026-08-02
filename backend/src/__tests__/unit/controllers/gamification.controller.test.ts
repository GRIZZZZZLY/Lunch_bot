/**
 * Опыт, достижения, квесты, лидерборд. Два узких места:
 * лидерборд обязан быть ограничен группой (иначе видны очки чужих команд),
 * а начисление XP руками — только админу и только с идемпотентным ключом,
 * иначе повтор запроса начислит опыт дважды.
 */
import {
  getUserStats,
  getUserAchievements,
  getUserQuests,
  getXPHistory,
  getLeaderboard,
  awardXP,
  recalculateRatings,
} from '../../../api/controllers/gamification.controller';
import { GamificationService } from '../../../services/gamification.service';
import { QuestService } from '../../../services/quest.service';
import { GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { AuthenticatedRequest } from '../../../types/api.types';

jest.mock('../../../services/gamification.service', () => ({
  GamificationService: {
    getUserStats: jest.fn(),
    getAchievementsWithStatus: jest.fn(),
    getXPHistory: jest.fn(),
    getLeaderboard: jest.fn(),
    awardXP: jest.fn(),
    recalculateRatings: jest.fn(),
  },
}));

jest.mock('../../../services/quest.service', () => ({
  QuestService: {
    autoAssignQuests: jest.fn(),
    getUserQuests: jest.fn(),
    getQuestStats: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const gamification = asServiceMock(GamificationService);
const quests = asServiceMock(QuestService);
const groupService = asServiceMock(GroupService);

const USER = { id: 1, isAdmin: false };
const ADMIN = { id: 9, isAdmin: true };

/** Контроллеры принимают AuthenticatedRequest — форма та же, тип строже. */
const authRequest = (init: Parameters<typeof mockRequest>[0] = {}) =>
  mockRequest(init) as unknown as AuthenticatedRequest;

beforeEach(() => {
  jest.clearAllMocks();
  groupService.isUserGroupMember.mockResolvedValue(true);
});

describe('GET /api/gamification/user/stats', () => {
  it('отдаёт статистику по id из токена', async () => {
    gamification.getUserStats.mockResolvedValue({ xp: 500, level: 3 });
    const res = mockResponse();

    await getUserStats(authRequest({ user: USER }), res);

    expect(gamification.getUserStats).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ data: { xp: 500 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getUserStats(authRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    gamification.getUserStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getUserStats(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/gamification/user/achievements', () => {
  it('отдаёт достижения со статусом', async () => {
    gamification.getAchievementsWithStatus.mockResolvedValue([
      { id: 1, unlocked: true },
    ]);
    const res = mockResponse();

    await getUserAchievements(authRequest({ user: USER }), res);

    expect(res.body).toMatchObject({ data: [{ unlocked: true }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getUserAchievements(authRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    gamification.getAchievementsWithStatus.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getUserAchievements(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/gamification/user/quests', () => {
  beforeEach(() => {
    quests.autoAssignQuests.mockResolvedValue(undefined);
    quests.getUserQuests.mockResolvedValue([{ id: 1 }]);
    quests.getQuestStats.mockResolvedValue({ completed: 2 });
  });

  it('выдаёт квесты, предварительно назначив новые', async () => {
    const res = mockResponse();

    await getUserQuests(authRequest({ user: USER }), res);

    expect(quests.autoAssignQuests).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({
      data: { quests: [{ id: 1 }], stats: { completed: 2 } },
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getUserQuests(authRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(quests.autoAssignQuests).not.toHaveBeenCalled();
  });

  it('падение назначения квестов — 500', async () => {
    quests.autoAssignQuests.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getUserQuests(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/gamification/user/xp-history', () => {
  it('по умолчанию отдаёт 50 записей', async () => {
    gamification.getXPHistory.mockResolvedValue([]);

    await getXPHistory(authRequest({ user: USER }), mockResponse());

    expect(gamification.getXPHistory).toHaveBeenCalledWith(1, 50);
  });

  it('лимит из запроса', async () => {
    gamification.getXPHistory.mockResolvedValue([]);

    await getXPHistory(
      authRequest({ user: USER, query: { limit: '5' } }),
      mockResponse()
    );

    expect(gamification.getXPHistory).toHaveBeenCalledWith(1, 5);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getXPHistory(authRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    gamification.getXPHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getXPHistory(authRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/gamification/leaderboard', () => {
  beforeEach(() => {
    gamification.getLeaderboard.mockResolvedValue([{ userId: 1, xp: 100 }]);
  });

  it('по умолчанию TOTAL и 10 мест, всегда в пределах группы', async () => {
    const res = mockResponse();

    await getLeaderboard(
      authRequest({ user: USER, query: { groupId: '100' } }),
      res
    );

    expect(gamification.getLeaderboard).toHaveBeenCalledWith('TOTAL', 10, 100);
    expect(res.body).toMatchObject({ data: [{ userId: 1 }] });
  });

  it.each(['GASTRO', 'RESPONSIBLE', 'SOCIAL', 'EXPLORER'])(
    'категория %s принимается',
    async category => {
      await getLeaderboard(
        authRequest({ user: USER, query: { groupId: '100', category } }),
        mockResponse()
      );

      expect(gamification.getLeaderboard).toHaveBeenCalledWith(category, 10, 100);
    }
  );

  it('неизвестная категория — 400', async () => {
    const res = mockResponse();

    await getLeaderboard(
      authRequest({ user: USER, query: { groupId: '100', category: 'НЕТ' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(gamification.getLeaderboard).not.toHaveBeenCalled();
  });

  it.each([
    ['без groupId', {}],
    ['нечисловой groupId', { groupId: 'нет' }],
    ['нулевой groupId', { groupId: '0' }],
  ])('%s — 400 MISSING_GROUP_ID', async (_label, query) => {
    const res = mockResponse();

    await getLeaderboard(authRequest({ user: USER, query }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не участник группы — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await getLeaderboard(
      authRequest({ user: USER, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('глобальный админ смотрит любой лидерборд', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await getLeaderboard(
      authRequest({ user: ADMIN, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getLeaderboard(authRequest({ query: { groupId: '100' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    gamification.getLeaderboard.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getLeaderboard(
      authRequest({ user: USER, query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/gamification/admin/award-xp', () => {
  const body = { userId: 2, amount: 100, reason: '  помог с закупкой ', category: 'SOCIAL' };

  beforeEach(() => {
    gamification.awardXP.mockResolvedValue({ xp: 600 });
  });

  it('админ начисляет XP; причина обрезается', async () => {
    const res = mockResponse();

    await awardXP(authRequest({ user: ADMIN, body }), res);

    expect(gamification.awardXP).toHaveBeenCalledWith(
      2,
      100,
      'помог с закупкой',
      'SOCIAL',
      { source: 'operations-api' },
      undefined
    );
    expect(res.body).toMatchObject({ data: { xp: 600 } });
  });

  it('idempotency-key превращается в ключ операции', async () => {
    await awardXP(
      authRequest({
        user: ADMIN,
        body,
        headers: { 'idempotency-key': 'abc-123' },
      }),
      mockResponse()
    );

    expect(gamification.awardXP).toHaveBeenCalledWith(
      2,
      100,
      'помог с закупкой',
      'SOCIAL',
      { source: 'operations-api' },
      'operations-xp:2:abc-123'
    );
  });

  it('не админ — 403', async () => {
    const res = mockResponse();

    await awardXP(authRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(403);
    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('без аутентификации — 403', async () => {
    const res = mockResponse();

    await awardXP(authRequest({ body }), res);

    expect(res.statusCode).toBe(403);
  });

  it.each([
    ['userId строкой', { userId: '2' }],
    ['userId ноль', { userId: 0 }],
    ['amount ноль', { amount: 0 }],
    ['amount отрицательный', { amount: -5 }],
    ['amount больше 100000', { amount: 100_001 }],
    ['amount дробный', { amount: 1.5 }],
    ['причина пустая', { reason: '   ' }],
    ['причина не строка', { reason: 42 }],
    ['причина длиннее 300', { reason: 'x'.repeat(301) }],
    ['неизвестная категория', { category: 'НЕТ' }],
    ['категория TOTAL (нельзя начислять напрямую)', { category: 'TOTAL' }],
  ])('%s — 400', async (_label, override) => {
    const res = mockResponse();

    await awardXP(authRequest({ user: ADMIN, body: { ...body, ...override } }), res);

    expect(res.statusCode).toBe(400);
    expect(gamification.awardXP).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    gamification.awardXP.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await awardXP(authRequest({ user: ADMIN, body }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/gamification/admin/recalculate-ratings', () => {
  it('админ пересчитывает рейтинги', async () => {
    gamification.recalculateRatings.mockResolvedValue(undefined);
    const res = mockResponse();

    await recalculateRatings(authRequest({ user: ADMIN, body: { userId: 2 } }), res);

    expect(gamification.recalculateRatings).toHaveBeenCalledWith(2);
    expect(res.body).toMatchObject({
      message: 'Ratings recalculated successfully',
    });
  });

  it('не админ — 403', async () => {
    const res = mockResponse();

    await recalculateRatings(authRequest({ user: USER, body: { userId: 2 } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('без userId — 400', async () => {
    const res = mockResponse();

    await recalculateRatings(authRequest({ user: ADMIN, body: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(gamification.recalculateRatings).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    gamification.recalculateRatings.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await recalculateRatings(authRequest({ user: ADMIN, body: { userId: 2 } }), res);

    expect(res.statusCode).toBe(500);
  });
});
