/**
 * Контроллер голосований — самый большой обработчик HTTP в проекте и место, где
 * решается доступ: участник группы читает, админ группы меняет. Тесты идут по
 * каждому эндпоинту и проверяют три вещи, которые ломаются молча:
 * код ответа, аргументы, переданные в сервис, и то, что при отказе в доступе
 * сервис вообще не вызывается.
 */
import { PollController } from '../../../api/controllers/poll.controller';
import { PollService } from '../../../services/poll.service';
import { VoteService } from '../../../services/vote.service';
import { MenuService } from '../../../services/menu.service';
import { GroupService } from '../../../services/group.service';
import { createPollFromWebApp } from '../../../services/poll.service.extensions';
import { BotNotInitializedError } from '../../../bot/bot-instance';
import { FEATURES } from '../../../config/features';
import {
  adminRequest,
  memberRequest,
  mockRequest,
  mockResponse,
} from '../../helpers/http';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/poll.service', () => {
  class PollAlreadyActiveError extends Error {
    readonly code = 'POLL_ALREADY_ACTIVE';
    constructor(
      public readonly groupId: number,
      public readonly existingPollId: number
    ) {
      super(`Group ${groupId} already has an active poll (#${existingPollId})`);
      this.name = 'PollAlreadyActiveError';
    }
  }

  return {
    PollAlreadyActiveError,
    PollService: {
      getActivePolls: jest.fn(),
      getPollHistory: jest.fn(),
      getLastCompletedPoll: jest.fn(),
      getTodayCompletedPoll: jest.fn(),
      getPollById: jest.fn(),
      getPollGroupId: jest.fn(),
      getPollResultByPollId: jest.fn(),
      getPollVoteBreakdown: jest.fn(),
      getPollStats: jest.fn(),
      getUserParticipationStats: jest.fn(),
      createPoll: jest.fn(),
      getActivePollInGroup: jest.fn(),
      completePoll: jest.fn(),
      completePollMultiWinner: jest.fn(),
      cancelPoll: jest.fn(),
      checkAutoComplete: jest.fn(),
      runRoulette: jest.fn(),
    },
  };
});

jest.mock('../../../services/vote.service', () => ({
  VoteService: {
    getPollVotes: jest.fn(),
    getVoteCountByMenuItem: jest.fn(),
    upsertVote: jest.fn(),
    createMultipleVotes: jest.fn(),
    removeVote: jest.fn(),
  },
}));

jest.mock('../../../services/menu.service', () => ({
  MenuService: {
    getActiveMenuItems: jest.fn(),
    getMenuItemsByIds: jest.fn(),
    getPopularMenuItems: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    isUserGroupMember: jest.fn(),
    isUserGroupAdmin: jest.fn(),
    getGroupsForUser: jest.fn(),
    getGroupById: jest.fn(),
  },
}));

jest.mock('../../../services/poll.service.extensions', () => ({
  createPollFromWebApp: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../config/features', () => ({
  FEATURES: { MULTI_WINNER_VOTING: true },
  isFeatureEnabled: jest.fn(),
}));

const {
  PollAlreadyActiveError,
}: { PollAlreadyActiveError: new (g: number, p: number) => Error } =
  jest.requireMock('../../../services/poll.service');

const pollService = asServiceMock(PollService);
const voteService = asServiceMock(VoteService);
const menuService = asServiceMock(MenuService);
const groupService = asServiceMock(GroupService);
const createFromWebApp = asMock(createPollFromWebApp);

const NOW = new Date('2026-08-02T12:00:00.000Z');

/** Минимальное голосование в форме, которую отдаёт сервис. */
function pollFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    groupId: 100,
    duration: 30,
    startedAt: NOW,
    endedAt: null,
    status: 'ACTIVE',
    isMultiSelect: true,
    maxSelections: 3,
    selectedMenuItemIds: null,
    votes: [],
    ...overrides,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  FEATURES.MULTI_WINNER_VOTING = true;
  groupService.isUserGroupMember.mockResolvedValue(true);
  groupService.isUserGroupAdmin.mockResolvedValue(true);
  groupService.getGroupsForUser.mockResolvedValue([] as never);
});

describe('GET /api/polls/active', () => {
  it('отдаёт активные голосования с вычисленным endTime', async () => {
    pollService.getActivePolls.mockResolvedValue([
      pollFixture({ id: 1, startedAt: NOW, duration: 30, endedAt: null }),
    ]);
    const req = adminRequest();
    const res = mockResponse();

    await PollController.getActivePolls(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { data: Array<{ endTime: string }>; count: number };
    expect(body.count).toBe(1);
    // startedAt + duration: 12:00 + 30 мин
    expect(body.data[0].endTime).toBe('2026-08-02T12:30:00.000Z');
  });

  /* Прежде глобальный флаг давал undefined — «фильтра нет, видно всё». Понятия
     глобального администратора больше нет: выборка всегда сужается до групп
     самого человека, и у того, кто ни в одной группе не состоит, она пустая. */
  it('выборка сужается до групп человека, даже с прежним флагом', async () => {
    pollService.getActivePolls.mockResolvedValue([]);
    groupService.getGroupsForUser.mockResolvedValue([] as never);

    await PollController.getActivePolls(adminRequest(), mockResponse());

    expect(groupService.getGroupsForUser).toHaveBeenCalled();
    expect(pollService.getActivePolls).toHaveBeenCalledWith([]);
  });

  it('обычному пользователю показывает только его группы, без дублей', async () => {
    groupService.getGroupsForUser.mockResolvedValue([
      { groupId: 5 },
      { groupId: 7 },
      { groupId: 5 },
    ] as never);
    pollService.getActivePolls.mockResolvedValue([]);

    await PollController.getActivePolls(memberRequest(), mockResponse());

    expect(pollService.getActivePolls).toHaveBeenCalledWith([5, 7]);
  });

  it('без аутентификации отвечает 401 и не трогает сервис', async () => {
    const res = mockResponse();

    await PollController.getActivePolls(mockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(pollService.getActivePolls).not.toHaveBeenCalled();
  });

  it('падение сервиса превращается в 500', async () => {
    pollService.getActivePolls.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await PollController.getActivePolls(adminRequest(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('endedAt имеет приоритет над расчётным временем', async () => {
    pollService.getActivePolls.mockResolvedValue([
      pollFixture({ endedAt: new Date('2026-08-02T12:05:00.000Z') }),
    ]);
    const res = mockResponse();

    await PollController.getActivePolls(adminRequest(), res);

    expect((res.body as { data: Array<{ endTime: string }> }).data[0].endTime).toBe(
      '2026-08-02T12:05:00.000Z'
    );
  });
});

describe('GET /api/polls/history', () => {
  it('отдаёт страницу истории с признаком следующей страницы', async () => {
    pollService.getPollHistory.mockResolvedValue({
      polls: [pollFixture()],
      total: 50,
    });
    const res = mockResponse();

    await PollController.getPollHistory(
      adminRequest({ query: { limit: '20', offset: '0' } }),
      res
    );

    expect(res.body).toMatchObject({
      success: true,
      data: { total: 50, limit: 20, offset: 0, hasNext: true },
    });
  });

  it('на последней странице hasNext=false', async () => {
    pollService.getPollHistory.mockResolvedValue({
      polls: [],
      total: 25,
    });
    const res = mockResponse();

    await PollController.getPollHistory(
      adminRequest({ query: { limit: '20', offset: '20' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { hasNext: false } });
  });

  it('по умолчанию limit=20, offset=0', async () => {
    pollService.getPollHistory.mockResolvedValue({ polls: [], total: 0 });

    await PollController.getPollHistory(adminRequest(), mockResponse());

    // Список групп человека, а не undefined: обход по глобальному флагу удалён.
    expect(pollService.getPollHistory).toHaveBeenCalledWith([], 20, 0);
  });

  it('с groupId проверяет членство и запрашивает историю одной группы', async () => {
    pollService.getPollHistory.mockResolvedValue({ polls: [], total: 0 });

    await PollController.getPollHistory(
      memberRequest({ query: { groupId: '42' } }),
      mockResponse()
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 42);
    expect(pollService.getPollHistory).toHaveBeenCalledWith(42, 20, 0);
  });

  it('не участнику группы отвечает 403 и не читает историю', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPollHistory(
      memberRequest({ query: { groupId: '42' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollService.getPollHistory).not.toHaveBeenCalled();
  });

  it('нечисловой groupId отклоняется как 400', async () => {
    const res = mockResponse();

    await PollController.getPollHistory(
      adminRequest({ query: { groupId: 'abc' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_GROUP_ID' });
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPollHistory(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/last-completed', () => {
  it('отдаёт последнее завершённое голосование', async () => {
    pollService.getLastCompletedPoll.mockResolvedValue(pollFixture({ id: 9 }));
    const res = mockResponse();

    await PollController.getLastCompleted(adminRequest(), res);

    expect(res.body).toMatchObject({ success: true, data: { id: 9 } });
  });

  it('null, когда завершённых голосований нет', async () => {
    pollService.getLastCompletedPoll.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getLastCompleted(adminRequest(), res);

    expect(res.body).toEqual({ success: true, data: null });
  });

  it('groupId имеет приоритет над списком доступных групп', async () => {
    pollService.getLastCompletedPoll.mockResolvedValue(null);

    await PollController.getLastCompleted(
      memberRequest({ query: { groupId: '3' } }),
      mockResponse()
    );

    expect(pollService.getLastCompletedPoll).toHaveBeenCalledWith(3);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await PollController.getLastCompleted(
      adminRequest({ query: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник группы — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getLastCompleted(
      memberRequest({ query: { groupId: '3' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollService.getLastCompletedPoll).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getLastCompletedPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getLastCompleted(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/today-completed/:groupId', () => {
  it('отдаёт голосование, завершённое сегодня', async () => {
    pollService.getTodayCompletedPoll.mockResolvedValue(pollFixture({ id: 4 }));
    const res = mockResponse();

    await PollController.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ success: true, data: { id: 4 } });
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await PollController.getTodayCompletedPoll(
      memberRequest({ params: { groupId: 'x' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getTodayCompletedPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/repeat/:id', () => {
  beforeEach(() => {
    pollService.getPollById.mockResolvedValue(pollFixture());
    menuService.getActiveMenuItems.mockResolvedValue([
      { id: 1, name: 'Плов' },
      { id: 2, name: 'Шурпа' },
    ] as never);
    createFromWebApp.mockResolvedValue({ pollId: 11, messageId: 55 });
  });

  it('создаёт копию голосования и отправляет её в группу', async () => {
    const res = mockResponse();

    await PollController.repeatPoll(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 100, duration: 30, createdBy: 1 })
    );
    expect(res.body).toMatchObject({
      success: true,
      message: 'Poll repeated and sent to Telegram group',
    });
  });

  it('берёт ровно те блюда, что были выбраны в исходном голосовании', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: '[3,4]' })
    );
    menuService.getMenuItemsByIds.mockResolvedValue([
      { id: 3, name: 'Лагман' },
      { id: 4, name: 'Манты' },
    ] as never);

    await PollController.repeatPoll(
      adminRequest({ params: { id: '10' } }),
      mockResponse()
    );

    expect(menuService.getMenuItemsByIds).toHaveBeenCalledWith([3, 4]);
    expect(menuService.getActiveMenuItems).not.toHaveBeenCalled();
    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMenuItemIds: [3, 4] })
    );
  });

  it('битый JSON в selectedMenuItemIds не роняет запрос — берутся активные блюда', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: '{не json' })
    );
    const res = mockResponse();

    await PollController.repeatPoll(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(menuService.getActiveMenuItems).toHaveBeenCalledWith(100);
    expect(res.statusCode).toBe(200);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.repeatPoll(adminRequest({ params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
    /* Был `INVALID_POLL_ID`, стал `INVALID_ID`. Это не потеря, а то самое
       расхождение, ради которого задача заведена: за один и тот же `:id`
       девять handler'ов отдавали `INVALID_ID`, а этот один — `INVALID_POLL_ID`.
       Код теперь определяется ИМЕНЕМ параметра (`schemas/common.ts`), и
       `INVALID_POLL_ID` остался за `:pollId` — там, где он действительно
       называет другой параметр. Текст на фронте есть у обоих кодов. */
    expect(res.body).toMatchObject({ code: 'INVALID_ID' });
  });

  it('исходное голосование не найдено — 404', async () => {
    pollService.getPollById.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403 и копия не создаётся', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(createFromWebApp).not.toHaveBeenCalled();
  });

  it('пустое меню — 400 NO_MENU_ITEMS', async () => {
    menuService.getActiveMenuItems.mockResolvedValue([] as never);
    const res = mockResponse();

    await PollController.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NO_MENU_ITEMS' });
  });

  it('ошибка отправки в Telegram — 500', async () => {
    createFromWebApp.mockRejectedValue(new Error('telegram down'));
    const res = mockResponse();

    await PollController.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/stats', () => {
  it('отдаёт статистику по доступным группам', async () => {
    pollService.getPollStats.mockResolvedValue({ total: 3 });
    const res = mockResponse();

    await PollController.getPollStats(adminRequest(), res);

    expect(res.body).toMatchObject({ success: true, data: { total: 3 } });
    // Группы человека, а не «все»: глобального администратора больше нет.
    expect(pollService.getPollStats).toHaveBeenCalledWith([]);
  });

  it('с groupId сужает выборку после проверки членства', async () => {
    pollService.getPollStats.mockResolvedValue({ total: 1 });

    await PollController.getPollStats(
      memberRequest({ query: { groupId: '9' } }),
      mockResponse()
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 9);
    expect(pollService.getPollStats).toHaveBeenCalledWith(9);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPollStats(
      memberRequest({ query: { groupId: '9' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await PollController.getPollStats(
      adminRequest({ query: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPollStats(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('статистика участия', () => {
  it('свою статистику берёт по id из токена, а не из запроса', async () => {
    pollService.getUserParticipationStats.mockResolvedValue({ votes: 5 });

    await PollController.getUserStats(
      mockRequest({ user: { id: 77 }, query: { userId: '1' } }),
      mockResponse()
    );

    expect(pollService.getUserParticipationStats).toHaveBeenCalledWith(77);
  });

  it('своя статистика: ошибка сервиса — 500', async () => {
    pollService.getUserParticipationStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getUserStats(mockRequest({ user: { id: 77 } }), res);

    expect(res.statusCode).toBe(500);
  });

  it('статистика по userId отдаётся админу', async () => {
    pollService.getUserParticipationStats.mockResolvedValue({ votes: 2 });
    const res = mockResponse();

    await PollController.getUserStatsByUserId(
      adminRequest({ params: { userId: '55' } }),
      res
    );

    expect(pollService.getUserParticipationStats).toHaveBeenCalledWith(55);
    expect(res.body).toMatchObject({ data: { votes: 2 } });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await PollController.getUserStatsByUserId(
      adminRequest({ params: { userId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_USER_ID' });
  });

  it('статистика по userId: ошибка сервиса — 500', async () => {
    pollService.getUserParticipationStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getUserStatsByUserId(
      adminRequest({ params: { userId: '55' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id', () => {
  it('отдаёт голосование с endTime', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture());
    const res = mockResponse();

    await PollController.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { id: 10, endTime: '2026-08-02T12:30:00.000Z' },
    });
  });

  it('фильтрует голоса по выбранным блюдам', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({
        selectedMenuItemIds: '[1,2]',
        votes: [
          { id: 1, menuItemId: 1 },
          { id: 2, menuItemId: 3 },
          { id: 3, menuItemId: null },
        ],
      })
    );
    const res = mockResponse();

    await PollController.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    const votes = (res.body as { data: { votes: Array<{ id: number }> } }).data
      .votes;
    expect(votes.map(v => v.id)).toEqual([1]);
  });

  it('пустой список выбранных блюд не фильтрует голоса', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: '[]', votes: [{ id: 1, menuItemId: 9 }] })
    );
    const res = mockResponse();

    await PollController.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(
      (res.body as { data: { votes: unknown[] } }).data.votes
    ).toHaveLength(1);
  });

  it('битый JSON выбранных блюд не роняет ответ', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: 'не json', votes: [{ id: 1, menuItemId: 9 }] })
    );
    const res = mockResponse();

    await PollController.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.getPollById(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не найдено — 404', async () => {
    pollService.getPollById.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не участник группы голосования — 403', async () => {
    pollService.getPollById.mockResolvedValue(pollFixture());
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollById.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id/results', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.getPollResultByPollId.mockResolvedValue({ id: 1 });
    pollService.getPollVoteBreakdown.mockResolvedValue([{ menuItemId: 1 }] as never);
  });

  it('отдаёт результат вместе с разбивкой голосов', async () => {
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { result: { id: 1 }, breakdown: [{ menuItemId: 1 }] },
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'POLL_NOT_FOUND' });
  });

  it('результатов ещё нет — 404 RESULTS_NOT_FOUND', async () => {
    pollService.getPollResultByPollId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'RESULTS_NOT_FOUND' });
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollService.getPollResultByPollId).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollVoteBreakdown.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id/votes', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    voteService.getPollVotes.mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
    voteService.getVoteCountByMenuItem.mockResolvedValue([
      { menuItemId: 1, count: 2 },
    ] as never);
  });

  it('отдаёт голоса, сводку и их количество', async () => {
    const res = mockResponse();

    await PollController.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { totalVotes: 2, summary: [{ menuItemId: 1, count: 2 }] },
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.getPollVotes(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.getPollVotes).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    voteService.getPollVotes.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls', () => {
  it('создаёт голосование от имени аутентифицированного пользователя', async () => {
    pollService.createPoll.mockResolvedValue(pollFixture({ id: 12 }));
    const res = mockResponse();

    await PollController.createPoll(
      mockRequest({
        user: { id: 8, isAdmin: false },
        body: { groupId: 100, duration: 45, createdBy: 999 },
      }),
      res
    );

    expect(res.statusCode).toBe(201);
    // createdBy из тела запроса игнорируется — иначе можно создать
    // голосование от чужого имени.
    expect(pollService.createPoll).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 100, createdBy: 8 })
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await PollController.createPoll(mockRequest({ body: { groupId: 1 } }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['отсутствующий groupId', {}],
    ['нулевой groupId', { groupId: 0 }],
    ['отрицательный groupId', { groupId: -5 }],
    ['нечисловой groupId', { groupId: 'нет' }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await PollController.createPoll(adminRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.createPoll(
      adminRequest({ body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollService.createPoll).not.toHaveBeenCalled();
  });

  it('гонка на уровне сервиса отдаёт 400 с кодом сервиса', async () => {
    pollService.createPoll.mockRejectedValue(
      new PollAlreadyActiveError(100, 7)
    );
    const res = mockResponse();

    await PollController.createPoll(
      adminRequest({ body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_ACTIVE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.createPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.createPoll(
      adminRequest({ body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/create-from-webapp', () => {
  const body = {
    groupId: '100',
    duration: '30',
    selectedMenuItems: ['1', '2'],
    title: 'Обед',
  };

  beforeEach(() => {
    groupService.getGroupById.mockResolvedValue({
      id: 100,
      title: 'Команда',
    });
    pollService.getActivePollInGroup.mockResolvedValue(null);
    menuService.getActiveMenuItems.mockResolvedValue([
      { id: 1, name: 'Плов' },
      { id: 2, name: 'Шурпа' },
      { id: 3, name: 'Лагман' },
    ] as never);
    createFromWebApp.mockResolvedValue({ pollId: 21, messageId: 99 });
  });

  it('создаёт голосование только из выбранных блюд', async () => {
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(201);
    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 100,
        duration: 30,
        title: 'Обед',
        selectedMenuItemIds: [1, 2],
        isMultiSelect: true,
        maxSelections: 3,
      })
    );
    expect(res.body).toMatchObject({
      data: { pollId: 21, messageId: 99, groupTitle: 'Команда', menuItemsCount: 2 },
    });
  });

  it('без duration берёт 30 минут', async () => {
    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, duration: undefined } }),
      mockResponse()
    );

    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 30 })
    );
  });

  it('одиночный выбор ограничивает maxSelections до 1', async () => {
    await PollController.createPollFromWebApp(
      adminRequest({
        body: { ...body, isMultiSelect: false, maxSelections: 3 },
      }),
      mockResponse()
    );

    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ isMultiSelect: false, maxSelections: 1 })
    );
  });

  it('maxSelections больше трёх обрезается до трёх', async () => {
    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, maxSelections: 10 } }),
      mockResponse()
    );

    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ maxSelections: 3 })
    );
  });

  it('без selectedMenuItems берёт все активные блюда', async () => {
    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, selectedMenuItems: undefined } }),
      mockResponse()
    );

    expect(createFromWebApp).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMenuItemIds: [1, 2, 3] })
    );
  });

  it.each([
    ['отсутствующий groupId', { groupId: undefined }],
    ['нечисловой groupId', { groupId: 'нет' }],
  ])('%s — 400 INVALID_GROUP_ID', async (_label, override) => {
    const res = mockResponse();

    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, ...override } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_GROUP_ID' });
  });

  it.each([
    ['0 минут', '0'],
    ['больше суток', '1441'],
  ])('длительность %s — 400', async (_label, duration) => {
    const res = mockResponse();

    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, duration } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_DURATION' });
  });

  it('группа не найдена — 404', async () => {
    groupService.getGroupById.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'GROUP_NOT_FOUND' });
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(403);
    expect(createFromWebApp).not.toHaveBeenCalled();
  });

  it('в группе уже есть активное голосование — 400', async () => {
    pollService.getActivePollInGroup.mockResolvedValue(pollFixture());
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_ACTIVE' });
  });

  it('меньше двух блюд после фильтрации — 400', async () => {
    const res = mockResponse();

    await PollController.createPollFromWebApp(
      adminRequest({ body: { ...body, selectedMenuItems: ['1'] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NOT_ENOUGH_ITEMS' });
  });

  it('падение загрузки меню — 500', async () => {
    menuService.getActiveMenuItems.mockRejectedValue(new Error('menu down'));
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(500);
  });

  /**
   * Ветка сверялась с подстрокой 'Bot not initialized', а сервис бросал
   * 'Bot instance is not initialized' — 503 в проде не отдавался никогда,
   * и этот тест этого не видел, потому что сам сочинял текст ошибки.
   * Теперь тип ошибки настоящий, тот же, что бросает getRequiredBotInstance.
   */
  it('неинициализированный бот — 503', async () => {
    createFromWebApp.mockRejectedValue(new BotNotInitializedError());
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'BOT_NOT_AVAILABLE' });
  });

  it('ошибка бота не маскирует прочие сбои — остаётся 500', async () => {
    createFromWebApp.mockRejectedValue(new Error('telegram timeout'));
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('гонка на уровне сервиса — 400 с кодом сервиса', async () => {
    createFromWebApp.mockRejectedValue(new PollAlreadyActiveError(100, 3));
    const res = mockResponse();

    await PollController.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_ACTIVE' });
  });
});

describe('GET /api/polls/active/:groupId', () => {
  it('отдаёт активное голосование группы', async () => {
    pollService.getActivePollInGroup.mockResolvedValue(pollFixture({ id: 3 }));
    const res = mockResponse();

    await PollController.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { id: 3 } });
  });

  it('активного голосования нет — 404 с data: null', async () => {
    pollService.getActivePollInGroup.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NO_ACTIVE_POLL', data: null });
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await PollController.getActivePollInGroup(
      memberRequest({ params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getActivePollInGroup.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/complete', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.completePoll.mockResolvedValue({
      winnerMenuItemId: 1,
      totalVotes: 4,
    });
  });

  it('завершает голосование', async () => {
    const res = mockResponse();

    await PollController.completePoll(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(pollService.completePoll).toHaveBeenCalledWith(10);
    expect(res.body).toMatchObject({ message: 'Poll completed successfully' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.completePoll(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(pollService.completePoll).not.toHaveBeenCalled();
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.completePoll.mockRejectedValue(new Error('Poll not found'));
    const res = mockResponse();

    await PollController.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('голосование уже завершено — 400', async () => {
    pollService.completePoll.mockRejectedValue(
      new Error('Poll is already completed')
    );
    const res = mockResponse();

    await PollController.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_COMPLETED' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.completePoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/cancel', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.cancelPoll.mockResolvedValue(pollFixture({ status: 'CANCELLED' }));
  });

  it('отменяет голосование с причиной из тела запроса', async () => {
    const res = mockResponse();

    await PollController.cancelPoll(
      adminRequest({ params: { id: '10' }, body: { reason: 'Перенесли' } }),
      res
    );

    expect(pollService.cancelPoll).toHaveBeenCalledWith(10, 1, 'Перенесли');
    expect(res.body).toMatchObject({ message: 'Poll cancelled successfully' });
  });

  it('без причины подставляет значение по умолчанию', async () => {
    await PollController.cancelPoll(
      adminRequest({ params: { id: '10' } }),
      mockResponse()
    );

    expect(pollService.cancelPoll).toHaveBeenCalledWith(
      10,
      1,
      'Отменено через API'
    );
  });

  it.each([
    ['причина не строка', { reason: 42 }],
    ['причина длиннее 500 символов', { reason: 'я'.repeat(501) }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await PollController.cancelPoll(
      adminRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.cancelPoll.mockRejectedValue(new Error('Poll not found'));
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('отменить можно только активное голосование — 409', async () => {
    pollService.cancelPoll.mockRejectedValue(
      new Error('Only an active poll can be cancelled')
    );
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'INVALID_POLL_STATE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.cancelPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/vote', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.checkAutoComplete.mockResolvedValue(false);
    voteService.upsertVote.mockResolvedValue({
      id: 1,
      menuItemId: 2,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('записывает голос', async () => {
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(voteService.upsertVote).toHaveBeenCalledWith({
      pollId: 10,
      userId: 1,
      menuItemId: 2,
    });
    expect(res.body).toMatchObject({ message: 'Vote cast successfully' });
  });

  it('автозавершение запускается, когда сервис его разрешил', async () => {
    pollService.checkAutoComplete.mockResolvedValue(true);
    pollService.completePollMultiWinner.mockResolvedValue({});

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      mockResponse()
    );

    expect(pollService.completePollMultiWinner).toHaveBeenCalledWith(10, 1, {
      minVotes: 1,
      tieBreakMethod: 'earliest',
    });
  });

  it('падение автозавершения не отменяет уже записанный голос', async () => {
    pollService.checkAutoComplete.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: 'нет' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['отсутствующий menuItemId', {}],
    ['нечисловой menuItemId', { menuItemId: 'нет' }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_MENU_ITEM_ID' });
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403 и голос не записывается', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.upsertVote).not.toHaveBeenCalled();
  });

  it.each([
    'Poll is not active',
    'Poll has expired',
    'Menu item is not available for this poll',
    'User is not eligible to vote in this poll',
  ])('доменная ошибка «%s» — 400 POLL_ERROR', async message => {
    voteService.upsertVote.mockRejectedValue(new Error(message));
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ERROR', error: message });
  });

  it('неизвестная ошибка — 500', async () => {
    voteService.upsertVote.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/vote-multiple', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.getPollById.mockResolvedValue(pollFixture());
    pollService.checkAutoComplete.mockResolvedValue(false);
    voteService.createMultipleVotes.mockResolvedValue([
      { id: 1, menuItemId: 1 },
      { id: 2, menuItemId: 2 },
    ] as never);
  });

  it('записывает несколько голосов и убирает дубли', async () => {
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({
        params: { id: '10' },
        body: { menuItemIds: [1, 2, 2] },
      }),
      res
    );

    expect(voteService.createMultipleVotes).toHaveBeenCalledWith(10, 1, [1, 2]);
    expect(res.body).toMatchObject({
      message: 'Successfully voted for 2 items',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: 'нет' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['пустой массив', { menuItemIds: [] }],
    ['не массив', { menuItemIds: 5 }],
    ['отсутствующее поле', {}],
  ])('%s — 400 INVALID_MENU_ITEM_IDS', async (_label, body) => {
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_MENU_ITEM_IDS' });
  });

  it('нечисловой элемент массива — 400', async () => {
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1, 'нет'] } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404 по groupId', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('голосование исчезло между проверками — 404', async () => {
    pollService.getPollById.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.createMultipleVotes).not.toHaveBeenCalled();
  });

  it('одиночный выбор: несколько блюд — 400', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ isMultiSelect: false })
    );
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1, 2] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'SINGLE_SELECTION_ONLY' });
  });

  it('превышен лимит выбора — 400', async () => {
    pollService.getPollById.mockResolvedValue(
      pollFixture({ maxSelections: 2 })
    );
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1, 2, 3] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MAX_SELECTIONS_EXCEEDED' });
  });

  it('автозавершение запускается после множественного голоса', async () => {
    pollService.checkAutoComplete.mockResolvedValue(true);
    pollService.completePollMultiWinner.mockResolvedValue({});

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      mockResponse()
    );

    expect(pollService.completePollMultiWinner).toHaveBeenCalled();
  });

  it('падение автозавершения не отменяет записанные голоса', async () => {
    pollService.checkAutoComplete.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.body).toMatchObject({ success: true });
  });

  it.each([
    'Poll is not active',
    'Invalid parameters for multiple votes',
    'Poll menu configuration is invalid',
  ])('доменная ошибка «%s» — 400', async message => {
    voteService.createMultipleVotes.mockRejectedValue(new Error(message));
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('неизвестная ошибка — 500', async () => {
    voteService.createMultipleVotes.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/polls/:id/vote', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    voteService.removeVote.mockResolvedValue(undefined);
  });

  it('снимает голос', async () => {
    const res = mockResponse();

    await PollController.removeVote(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(voteService.removeVote).toHaveBeenCalledWith(10, 1);
    expect(res.body).toMatchObject({ message: 'Vote removed successfully' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.removeVote(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(voteService.removeVote).not.toHaveBeenCalled();
  });

  it('голоса не было — 404 VOTE_NOT_FOUND', async () => {
    voteService.removeVote.mockRejectedValue(new Error('Vote not found'));
    const res = mockResponse();

    await PollController.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'VOTE_NOT_FOUND' });
  });

  it.each(['Poll not found', 'Poll is not active'])(
    'доменная ошибка «%s» — 400',
    async message => {
      voteService.removeVote.mockRejectedValue(new Error(message));
      const res = mockResponse();

      await PollController.removeVote(
        memberRequest({ params: { id: '10' } }),
        res
      );

      expect(res.statusCode).toBe(400);
    }
  );

  it('неизвестная ошибка — 500', async () => {
    voteService.removeVote.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/roulette', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.runRoulette.mockResolvedValue({
      responsibleUserId: 7,
    });
  });

  it('выбирает ответственного', async () => {
    const res = mockResponse();

    await PollController.runRoulette(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(pollService.runRoulette).toHaveBeenCalledWith(10);
    expect(res.body).toMatchObject({ data: { responsibleUserId: 7 } });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.runRoulette(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(pollService.runRoulette).not.toHaveBeenCalled();
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.runRoulette.mockRejectedValue(new Error('Poll not found'));
    const res = mockResponse();

    await PollController.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('нет голосовавших — 400 NO_VOTERS', async () => {
    pollService.runRoulette.mockRejectedValue(new Error('No voters found'));
    const res = mockResponse();

    await PollController.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NO_VOTERS' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.runRoulette.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/popular-items', () => {
  beforeEach(() => {
    menuService.getPopularMenuItems.mockResolvedValue([
      { id: 1, name: 'Плов', votes: 9 },
    ] as never);
  });

  it('отдаёт популярные блюда группы', async () => {
    const res = mockResponse();

    await PollController.getPopularItems(
      memberRequest({ query: { groupId: '100', limit: '5' } }),
      res
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(5, 100);
    expect(res.body).toMatchObject({ count: 1 });
  });

  it('без limit берёт 10', async () => {
    await PollController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      mockResponse()
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(10, 100);
  });

  it('отрицательный limit — 400', async () => {
    const res = mockResponse();

    await PollController.getPopularItems(
      memberRequest({ query: { groupId: '100', limit: '-1' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_LIMIT' });
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await PollController.getPopularItems(memberRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getPopularMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/complete-multi', () => {
  beforeEach(() => {
    pollService.getPollGroupId.mockResolvedValue(100);
    pollService.completePollMultiWinner.mockResolvedValue({
      id: 1,
      rouletteData: JSON.stringify({ winners: [{ menuItemId: 1 }] }),
    });
  });

  it('завершает голосование с несколькими победителями', async () => {
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' }, body: { minVotes: 2 } }),
      res
    );

    expect(pollService.completePollMultiWinner).toHaveBeenCalledWith(10, 1, {
      minVotes: 2,
      maxWinners: null,
      tieBreakMethod: 'earliest',
    });
    expect(res.body).toMatchObject({
      data: { resultData: { winners: [{ menuItemId: 1 }] } },
    });
  });

  it('rouletteData объектом не требует разбора JSON', async () => {
    pollService.completePollMultiWinner.mockResolvedValue({
      rouletteData: { winners: [] },
    });
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { resultData: { winners: [] } } });
  });

  it('пустой rouletteData даёт пустой объект', async () => {
    pollService.completePollMultiWinner.mockResolvedValue({
      rouletteData: null,
    });
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { resultData: {} } });
  });

  it('фича выключена — 503', async () => {
    FEATURES.MULTI_WINNER_VOTING = false;
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(pollService.completePollMultiWinner).not.toHaveBeenCalled();
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it.each([
    ['minVotes не число', { minVotes: 'два' }],
    ['minVotes отрицательный', { minVotes: -1 }],
    ['minVotes больше 100', { minVotes: 101 }],
    ['maxWinners не число', { maxWinners: 'все' }],
    ['maxWinners меньше 1', { maxWinners: 0 }],
    ['maxWinners больше 50', { maxWinners: 51 }],
    ['неизвестный tieBreakMethod', { tieBreakMethod: 'random' }],
  ])('%s — 400 INVALID_PARAMS', async (_label, body) => {
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('альтернативный tieBreakMethod принимается', async () => {
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({
        params: { id: '10' },
        body: { tieBreakMethod: 'alphabetical', maxWinners: 5 },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(pollService.completePollMultiWinner).toHaveBeenCalledWith(10, 1, {
      minVotes: 1,
      maxWinners: 5,
      tieBreakMethod: 'alphabetical',
    });
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(
      new Error('Poll not found')
    );
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('уже завершено — 400 ALREADY_COMPLETED', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(
      new Error('Poll is already completed')
    );
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'ALREADY_COMPLETED' });
  });

  it('не активно — 400 NOT_ACTIVE', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(
      new Error('Poll is not active')
    );
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NOT_ACTIVE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await PollController.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});
