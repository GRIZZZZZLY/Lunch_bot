/**
 * Контроллер голосований — место, где решается доступ: участник группы читает,
 * админ группы меняет. Тесты идут по каждому эндпоинту и проверяют три вещи,
 * которые ломаются молча: код ответа, аргументы, переданные в сервис, и то, что
 * при отказе в доступе сервис вообще не вызывается.
 *
 * Handler'ы больше не формируют ответ на ошибку — они её бросают, а тело и
 * статус собирает `errorHandler` (задача 05). Поэтому контроллер вызывается
 * через `withErrorHandler`: обёртка ставит на место обработчика ошибок тот
 * самый, что смонтирован в приложении. Утверждения про `res.statusCode` и
 * `res.body` продолжают проверять то, что увидит клиент, и заодно ловят подмену
 * статуса — «409 стал 500» видно сразу, а не когда-нибудь на проде.
 *
 * Сценарии создания голосования переехали в `poll-creation.service.ts`, а
 * правила выбора блюд — в `VoteService.castVotes`. Здесь остались проверки
 * делегирования; сами сценарии проверяются в тестах этих сервисов.
 */
import { PollController } from '../../../api/controllers/poll.controller';
import { PollService } from '../../../services/poll.service';
import {
  NoMenuItemsError,
  NoVotersError,
  NotEnoughMenuItemsError,
  PollAlreadyActiveError,
  PollAlreadyCompletedError,
  PollGroupNotFoundError,
  PollNotActiveError,
  PollNotFoundError,
  PollStateError,
} from '../../../services/poll.errors';
import {
  MaxSelectionsExceededError,
  SingleSelectionOnlyError,
  VoteNotFoundError,
  VotingError,
} from '../../../services/vote.errors';
import { BotNotInitializedError } from '../../../bot/bot-instance';
import { VoteService } from '../../../services/vote.service';
import { MenuService } from '../../../services/menu.service';
import { GroupService } from '../../../services/group.service';
import {
  createPollForGroup,
  repeatPoll,
} from '../../../services/poll-creation.service';
import { FEATURES } from '../../../config/features';
import {
  adminRequest,
  memberRequest,
  mockRequest,
  mockResponse,
  withErrorHandler,
} from '../../helpers/http';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { PollQueryService } from '../../../services/poll-query.service';

/* Классы ошибок НЕ мокаются: контроллер и `errorHandler` различают их по типу,
   а самодельная подделка в фабрике мока — это тест собственной выдумки.
   Прежняя версия этого файла объявляла свой `PollAlreadyActiveError`, и он
   перестал бы совпадать с настоящим при любом изменении настоящего. */
jest.mock('../../../services/poll.service', () => {
  const errors = jest.requireActual('../../../services/poll.errors');

  return {
    PollAlreadyActiveError: errors.PollAlreadyActiveError,
    PollService: {
      getPollResultByPollId: jest.fn(),
      getPollVoteBreakdown: jest.fn(),
      getPollStats: jest.fn(),
      getUserParticipationStats: jest.fn(),
      createPoll: jest.fn(),
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
    castVotes: jest.fn(),
    removeVote: jest.fn(),
  },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollById: jest.fn(),
    getPollGroupId: jest.fn(),
    getTodayCompletedPoll: jest.fn(),
    getActivePollInGroup: jest.fn(),
    getActivePolls: jest.fn(),
    getPollHistory: jest.fn(),
    getLastCompletedPoll: jest.fn(),
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

jest.mock('../../../services/poll-creation.service', () => ({
  createPollForGroup: jest.fn(),
  repeatPoll: jest.fn(),
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

/** Контроллер, соединённый с настоящим обработчиком ошибок — как в приложении. */
const controller = withErrorHandler(PollController);

const pollService = asServiceMock(PollService);
const pollQuery = asServiceMock(PollQueryService);
const voteService = asServiceMock(VoteService);
const menuService = asServiceMock(MenuService);
const groupService = asServiceMock(GroupService);
const createForGroup = asMock(createPollForGroup);
const repeat = asMock(repeatPoll);

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
    pollQuery.getActivePolls.mockResolvedValue([
      pollFixture({ id: 1, startedAt: NOW, duration: 30, endedAt: null }),
    ]);
    const req = adminRequest();
    const res = mockResponse();

    await controller.getActivePolls(req, res);

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
    pollQuery.getActivePolls.mockResolvedValue([]);
    groupService.getGroupsForUser.mockResolvedValue([] as never);

    await controller.getActivePolls(adminRequest(), mockResponse());

    expect(groupService.getGroupsForUser).toHaveBeenCalled();
    expect(pollQuery.getActivePolls).toHaveBeenCalledWith([]);
  });

  it('обычному пользователю показывает только его группы, без дублей', async () => {
    groupService.getGroupsForUser.mockResolvedValue([
      { groupId: 5 },
      { groupId: 7 },
      { groupId: 5 },
    ] as never);
    pollQuery.getActivePolls.mockResolvedValue([]);

    await controller.getActivePolls(memberRequest(), mockResponse());

    expect(pollQuery.getActivePolls).toHaveBeenCalledWith([5, 7]);
  });

  it('без аутентификации отвечает 401 и не трогает сервис', async () => {
    const res = mockResponse();

    await controller.getActivePolls(mockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(pollQuery.getActivePolls).not.toHaveBeenCalled();
  });

  it('падение сервиса превращается в 500', async () => {
    pollQuery.getActivePolls.mockRejectedValue(new Error('db down'));
    const res = mockResponse();

    await controller.getActivePolls(adminRequest(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('endedAt имеет приоритет над расчётным временем', async () => {
    pollQuery.getActivePolls.mockResolvedValue([
      pollFixture({ endedAt: new Date('2026-08-02T12:05:00.000Z') }),
    ]);
    const res = mockResponse();

    await controller.getActivePolls(adminRequest(), res);

    expect((res.body as { data: Array<{ endTime: string }> }).data[0].endTime).toBe(
      '2026-08-02T12:05:00.000Z'
    );
  });
});

describe('GET /api/polls/history', () => {
  it('отдаёт страницу истории с признаком следующей страницы', async () => {
    pollQuery.getPollHistory.mockResolvedValue({
      polls: [pollFixture()],
      total: 50,
    });
    const res = mockResponse();

    await controller.getPollHistory(
      adminRequest({ query: { limit: '20', offset: '0' } }),
      res
    );

    expect(res.body).toMatchObject({
      success: true,
      data: { total: 50, limit: 20, offset: 0, hasNext: true },
    });
  });

  it('на последней странице hasNext=false', async () => {
    pollQuery.getPollHistory.mockResolvedValue({
      polls: [],
      total: 25,
    });
    const res = mockResponse();

    await controller.getPollHistory(
      adminRequest({ query: { limit: '20', offset: '20' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { hasNext: false } });
  });

  it('по умолчанию limit=20, offset=0', async () => {
    pollQuery.getPollHistory.mockResolvedValue({ polls: [], total: 0 });

    await controller.getPollHistory(adminRequest(), mockResponse());

    // Список групп человека, а не undefined: обход по глобальному флагу удалён.
    expect(pollQuery.getPollHistory).toHaveBeenCalledWith([], 20, 0);
  });

  it('с groupId проверяет членство и запрашивает историю одной группы', async () => {
    pollQuery.getPollHistory.mockResolvedValue({ polls: [], total: 0 });

    await controller.getPollHistory(
      memberRequest({ query: { groupId: '42' } }),
      mockResponse()
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 42);
    expect(pollQuery.getPollHistory).toHaveBeenCalledWith(42, 20, 0);
  });

  it('не участнику группы отвечает 403 и не читает историю', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollHistory(
      memberRequest({ query: { groupId: '42' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollQuery.getPollHistory).not.toHaveBeenCalled();
  });

  it('нечисловой groupId отклоняется как 400', async () => {
    const res = mockResponse();

    await controller.getPollHistory(
      adminRequest({ query: { groupId: 'abc' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_GROUP_ID' });
  });

  it('ошибка сервиса — 500', async () => {
    pollQuery.getPollHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollHistory(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/last-completed', () => {
  it('отдаёт последнее завершённое голосование', async () => {
    pollQuery.getLastCompletedPoll.mockResolvedValue(pollFixture({ id: 9 }));
    const res = mockResponse();

    await controller.getLastCompleted(adminRequest(), res);

    expect(res.body).toMatchObject({ success: true, data: { id: 9 } });
  });

  it('null, когда завершённых голосований нет', async () => {
    pollQuery.getLastCompletedPoll.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getLastCompleted(adminRequest(), res);

    expect(res.body).toEqual({ success: true, data: null });
  });

  it('groupId имеет приоритет над списком доступных групп', async () => {
    pollQuery.getLastCompletedPoll.mockResolvedValue(null);

    await controller.getLastCompleted(
      memberRequest({ query: { groupId: '3' } }),
      mockResponse()
    );

    expect(pollQuery.getLastCompletedPoll).toHaveBeenCalledWith(3);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getLastCompleted(
      adminRequest({ query: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник группы — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getLastCompleted(
      memberRequest({ query: { groupId: '3' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollQuery.getLastCompletedPoll).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    pollQuery.getLastCompletedPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getLastCompleted(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/today-completed/:groupId', () => {
  it('отдаёт голосование, завершённое сегодня', async () => {
    pollQuery.getTodayCompletedPoll.mockResolvedValue(pollFixture({ id: 4 }));
    const res = mockResponse();

    await controller.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ success: true, data: { id: 4 } });
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getTodayCompletedPoll(
      memberRequest({ params: { groupId: 'x' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollQuery.getTodayCompletedPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getTodayCompletedPoll(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/repeat/:id', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    repeat.mockResolvedValue(pollFixture({ id: 11 }));
  });

  it('повторяет голосование и отдаёт созданную копию', async () => {
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(repeat).toHaveBeenCalledWith(10, 1);
    expect(res.body).toMatchObject({
      success: true,
      data: { id: 11 },
      message: 'Poll repeated and sent to Telegram group',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
    /* Был `INVALID_POLL_ID`, стал `INVALID_ID`. Это не потеря, а то самое
       расхождение, ради которого задача заведена: за один и тот же `:id`
       девять handler'ов отдавали `INVALID_ID`, а этот один — `INVALID_POLL_ID`.
       Код теперь определяется ИМЕНЕМ параметра (`schemas/common.ts`), и
       `INVALID_POLL_ID` остался за `:pollId` — там, где он действительно
       называет другой параметр. Текст на фронте есть у обоих кодов. */
    expect(res.body).toMatchObject({ code: 'INVALID_ID' });
    expect(repeat).not.toHaveBeenCalled();
  });

  it('голосования нет — 404 и сценарий не запускается', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
    expect(repeat).not.toHaveBeenCalled();
  });

  it('не админ группы — 403 и копия не создаётся', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(repeat).not.toHaveBeenCalled();
  });

  /* Отказ сценария доезжает до клиента своим статусом, а не 500: код и статус
     несёт класс ошибки, а не сравнение строк в контроллере. */
  it('пустое меню — 400 NO_MENU_ITEMS', async () => {
    repeat.mockRejectedValue(new NoMenuItemsError());
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NO_MENU_ITEMS' });
  });

  it('ошибка отправки в Telegram — 500', async () => {
    repeat.mockRejectedValue(new Error('telegram down'));
    const res = mockResponse();

    await controller.repeatPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/stats', () => {
  it('отдаёт статистику по доступным группам', async () => {
    pollService.getPollStats.mockResolvedValue({ total: 3 });
    const res = mockResponse();

    await controller.getPollStats(adminRequest(), res);

    expect(res.body).toMatchObject({ success: true, data: { total: 3 } });
    // Группы человека, а не «все»: глобального администратора больше нет.
    expect(pollService.getPollStats).toHaveBeenCalledWith([]);
  });

  it('с groupId сужает выборку после проверки членства', async () => {
    pollService.getPollStats.mockResolvedValue({ total: 1 });

    await controller.getPollStats(
      memberRequest({ query: { groupId: '9' } }),
      mockResponse()
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 9);
    expect(pollService.getPollStats).toHaveBeenCalledWith(9);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollStats(
      memberRequest({ query: { groupId: '9' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getPollStats(
      adminRequest({ query: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollStats(adminRequest(), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('статистика участия', () => {
  it('свою статистику берёт по id из токена, а не из запроса', async () => {
    pollService.getUserParticipationStats.mockResolvedValue({ votes: 5 });

    await controller.getUserStats(
      mockRequest({ user: { id: 77 }, query: { userId: '1' } }),
      mockResponse()
    );

    expect(pollService.getUserParticipationStats).toHaveBeenCalledWith(77);
  });

  it('своя статистика: ошибка сервиса — 500', async () => {
    pollService.getUserParticipationStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getUserStats(mockRequest({ user: { id: 77 } }), res);

    expect(res.statusCode).toBe(500);
  });

  it('статистика по userId отдаётся админу', async () => {
    pollService.getUserParticipationStats.mockResolvedValue({ votes: 2 });
    const res = mockResponse();

    await controller.getUserStatsByUserId(
      adminRequest({ params: { userId: '55' } }),
      res
    );

    expect(pollService.getUserParticipationStats).toHaveBeenCalledWith(55);
    expect(res.body).toMatchObject({ data: { votes: 2 } });
  });

  it('нечисловой userId — 400', async () => {
    const res = mockResponse();

    await controller.getUserStatsByUserId(
      adminRequest({ params: { userId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_USER_ID' });
  });

  it('статистика по userId: ошибка сервиса — 500', async () => {
    pollService.getUserParticipationStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getUserStatsByUserId(
      adminRequest({ params: { userId: '55' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id', () => {
  it('отдаёт голосование с endTime', async () => {
    pollQuery.getPollById.mockResolvedValue(pollFixture());
    const res = mockResponse();

    await controller.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { id: 10, endTime: '2026-08-02T12:30:00.000Z' },
    });
  });

  it('фильтрует голоса по выбранным блюдам', async () => {
    pollQuery.getPollById.mockResolvedValue(
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

    await controller.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    const votes = (res.body as { data: { votes: Array<{ id: number }> } }).data
      .votes;
    expect(votes.map(v => v.id)).toEqual([1]);
  });

  it('пустой список выбранных блюд не фильтрует голоса', async () => {
    pollQuery.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: '[]', votes: [{ id: 1, menuItemId: 9 }] })
    );
    const res = mockResponse();

    await controller.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(
      (res.body as { data: { votes: unknown[] } }).data.votes
    ).toHaveLength(1);
  });

  it('битый JSON выбранных блюд не роняет ответ', async () => {
    pollQuery.getPollById.mockResolvedValue(
      pollFixture({ selectedMenuItemIds: 'не json', votes: [{ id: 1, menuItemId: 9 }] })
    );
    const res = mockResponse();

    await controller.getPollById(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getPollById(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не найдено — 404', async () => {
    pollQuery.getPollById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не участник группы голосования — 403', async () => {
    pollQuery.getPollById.mockResolvedValue(pollFixture());
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollQuery.getPollById.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollById(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id/results', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.getPollResultByPollId.mockResolvedValue({ id: 1 });
    pollService.getPollVoteBreakdown.mockResolvedValue([{ menuItemId: 1 }] as never);
  });

  it('отдаёт результат вместе с разбивкой голосов', async () => {
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { result: { id: 1 }, breakdown: [{ menuItemId: 1 }] },
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'POLL_NOT_FOUND' });
  });

  it('результатов ещё нет — 404 RESULTS_NOT_FOUND', async () => {
    pollService.getPollResultByPollId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'RESULTS_NOT_FOUND' });
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollService.getPollResultByPollId).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    pollService.getPollVoteBreakdown.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollResults(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:id/votes', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    voteService.getPollVotes.mockResolvedValue([{ id: 1 }, { id: 2 }] as never);
    voteService.getVoteCountByMenuItem.mockResolvedValue([
      { menuItemId: 1, count: 2 },
    ] as never);
  });

  it('отдаёт голоса, сводку и их количество', async () => {
    const res = mockResponse();

    await controller.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({
      data: { totalVotes: 2, summary: [{ menuItemId: 1, count: 2 }] },
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getPollVotes(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollVotes(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.getPollVotes).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    voteService.getPollVotes.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollVotes(
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

    await controller.createPoll(
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

    await controller.createPoll(mockRequest({ body: { groupId: 1 } }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['отсутствующий groupId', {}],
    ['нулевой groupId', { groupId: 0 }],
    ['отрицательный groupId', { groupId: -5 }],
    ['нечисловой groupId', { groupId: 'нет' }],
  ])('%s — 400', async (_label, body) => {
    const res = mockResponse();

    await controller.createPoll(adminRequest({ body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.createPoll(
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

    await controller.createPoll(
      adminRequest({ body: { groupId: 100 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_ACTIVE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.createPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.createPoll(
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
    createForGroup.mockResolvedValue({
      pollId: 21,
      messageId: 99,
      groupTitle: 'Команда',
      duration: 30,
      menuItemsCount: 2,
    });
  });

  /* Сам сценарий (проверка группы, отбор блюд, значения по умолчанию) живёт в
     `poll-creation.service.ts` и проверяется его тестами. Здесь — что
     разобранный вход доходит до сценария без искажений и что автором
     становится тот, кто запрос подписал, а не поле из тела. */
  it('передаёт разобранный вход в сценарий и отдаёт 201', async () => {
    const res = mockResponse();

    await controller.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(201);
    expect(createForGroup).toHaveBeenCalledWith({
      groupId: 100,
      createdBy: 1,
      duration: 30,
      selectedMenuItems: [1, 2],
      title: 'Обед',
      isMultiSelect: undefined,
      maxSelections: undefined,
    });
    expect(res.body).toMatchObject({
      data: { pollId: 21, messageId: 99, groupTitle: 'Команда', menuItemsCount: 2 },
    });
  });

  it('параметры множественного выбора передаются как есть', async () => {
    await controller.createPollFromWebApp(
      adminRequest({
        body: { ...body, isMultiSelect: false, maxSelections: 3 },
      }),
      mockResponse()
    );

    expect(createForGroup).toHaveBeenCalledWith(
      expect.objectContaining({ isMultiSelect: false, maxSelections: 3 })
    );
  });

  it.each([
    ['отсутствующий groupId', { groupId: undefined }],
    ['нечисловой groupId', { groupId: 'нет' }],
  ])('%s — 400 INVALID_GROUP_ID', async (_label, override) => {
    const res = mockResponse();

    await controller.createPollFromWebApp(
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

    await controller.createPollFromWebApp(
      adminRequest({ body: { ...body, duration } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_DURATION' });
  });

  it('не админ группы — 403 и сценарий не запускается', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(403);
    expect(createForGroup).not.toHaveBeenCalled();
  });

  /* Отказы сценария доезжают до клиента своим статусом и кодом. Проверяется
     каждый класс: подмена любого из них на 500 — регрессия, видимая
     пользователю, и «не 200» её не заметит. */
  it.each([
    ['группа не найдена', new PollGroupNotFoundError(), 404, 'GROUP_NOT_FOUND'],
    [
      'в группе уже идёт голосование',
      new PollAlreadyActiveError(100, 3),
      400,
      'POLL_ALREADY_ACTIVE',
    ],
    ['меньше двух блюд', new NotEnoughMenuItemsError(), 400, 'NOT_ENOUGH_ITEMS'],
    /* Ветка бота раньше сверялась с подстрокой 'Bot not initialized', а
       бросалось 'Bot instance is not initialized': 503 в проде не отдавался
       никогда, и прежний тест этого не видел, потому что сам сочинял текст
       ошибки. Теперь статус и код несёт сам класс. */
    ['бот не поднят', new BotNotInitializedError(), 503, 'BOT_NOT_AVAILABLE'],
  ])('%s — %i', async (_label, error, status, code) => {
    createForGroup.mockRejectedValue(error);
    const res = mockResponse();

    await controller.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(status);
    expect(res.body).toMatchObject({ code });
  });

  it('прочий сбой — 500', async () => {
    createForGroup.mockRejectedValue(new Error('telegram timeout'));
    const res = mockResponse();

    await controller.createPollFromWebApp(adminRequest({ body }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/polls/active/:groupId', () => {
  it('отдаёт активное голосование группы', async () => {
    pollQuery.getActivePollInGroup.mockResolvedValue(pollFixture({ id: 3 }));
    const res = mockResponse();

    await controller.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { id: 3 } });
  });

  it('активного голосования нет — 404 с data: null', async () => {
    pollQuery.getActivePollInGroup.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NO_ACTIVE_POLL', data: null });
  });

  it('нечисловой groupId — 400', async () => {
    const res = mockResponse();

    await controller.getActivePollInGroup(
      memberRequest({ params: { groupId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    pollQuery.getActivePollInGroup.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getActivePollInGroup(
      memberRequest({ params: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/complete', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.completePoll.mockResolvedValue({
      winnerMenuItemId: 1,
      totalVotes: 4,
    });
  });

  it('завершает голосование', async () => {
    const res = mockResponse();

    await controller.completePoll(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(pollService.completePoll).toHaveBeenCalledWith(10);
    expect(res.body).toMatchObject({ message: 'Poll completed successfully' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.completePoll(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(pollService.completePoll).not.toHaveBeenCalled();
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.completePoll.mockRejectedValue(new PollNotFoundError());
    const res = mockResponse();

    await controller.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('голосование уже завершено — 400', async () => {
    pollService.completePoll.mockRejectedValue(new PollAlreadyCompletedError());
    const res = mockResponse();

    await controller.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ALREADY_COMPLETED' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.completePoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.completePoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/cancel', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.cancelPoll.mockResolvedValue(pollFixture({ status: 'CANCELLED' }));
  });

  it('отменяет голосование с причиной из тела запроса', async () => {
    const res = mockResponse();

    await controller.cancelPoll(
      adminRequest({ params: { id: '10' }, body: { reason: 'Перенесли' } }),
      res
    );

    expect(pollService.cancelPoll).toHaveBeenCalledWith(10, 1, 'Перенесли');
    expect(res.body).toMatchObject({ message: 'Poll cancelled successfully' });
  });

  it('без причины подставляет значение по умолчанию', async () => {
    await controller.cancelPoll(
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

    await controller.cancelPoll(
      adminRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.cancelPoll.mockRejectedValue(new PollNotFoundError());
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('отменить можно только активное голосование — 409', async () => {
    pollService.cancelPoll.mockRejectedValue(
      new PollStateError('Only an active poll can be cancelled')
    );
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'INVALID_POLL_STATE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.cancelPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.cancelPoll(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/vote', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
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

    await controller.vote(
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

    await controller.vote(
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

    await controller.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.vote(
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

    await controller.vote(
      memberRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_MENU_ITEM_ID' });
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403 и голос не записывается', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.vote(
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
    voteService.upsertVote.mockRejectedValue(new VotingError(message));
    const res = mockResponse();

    await controller.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ERROR', error: message });
  });

  it('неизвестная ошибка — 500', async () => {
    voteService.upsertVote.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.vote(
      memberRequest({ params: { id: '10' }, body: { menuItemId: 2 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/vote-multiple', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.checkAutoComplete.mockResolvedValue(false);
    voteService.castVotes.mockResolvedValue([
      { id: 1, menuItemId: 1 },
      { id: 2, menuItemId: 2 },
    ] as never);
  });

  /* Правила выбора («одиночный выбор», «не больше N блюд») проверяет
     `VoteService.castVotes` — там же, где они действуют для любого другого
     вызывающего. Контроллер отвечает за нормализацию и за то, что отказ
     сервиса доезжает своим статусом; сами правила закреплены в
     `vote.service.test.ts`. */
  it('записывает несколько голосов и убирает дубли', async () => {
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({
        params: { id: '10' },
        body: { menuItemIds: [1, 2, 2] },
      }),
      res
    );

    expect(voteService.castVotes).toHaveBeenCalledWith(10, 1, [1, 2]);
    expect(res.body).toMatchObject({
      message: 'Successfully voted for 2 items',
    });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.voteMultiple(
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

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_MENU_ITEM_IDS' });
  });

  it('нечисловой элемент массива — 400', async () => {
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1, 'нет'] } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404 по groupId', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(voteService.castVotes).not.toHaveBeenCalled();
  });

  it('голосование исчезло между проверками — 404 от сервиса', async () => {
    voteService.castVotes.mockRejectedValue(new PollNotFoundError());
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'POLL_NOT_FOUND' });
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.castVotes).not.toHaveBeenCalled();
  });

  it.each([
    [new SingleSelectionOnlyError(), 'SINGLE_SELECTION_ONLY'],
    [new MaxSelectionsExceededError(2), 'MAX_SELECTIONS_EXCEEDED'],
  ])('отказ по правилам выбора — 400 %s', async (error, code) => {
    voteService.castVotes.mockRejectedValue(error);
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1, 2, 3] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code });
  });

  it('автозавершение запускается после множественного голоса', async () => {
    pollService.checkAutoComplete.mockResolvedValue(true);
    pollService.completePollMultiWinner.mockResolvedValue({});

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      mockResponse()
    );

    expect(pollService.completePollMultiWinner).toHaveBeenCalled();
  });

  it('падение автозавершения не отменяет записанные голоса', async () => {
    pollService.checkAutoComplete.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.body).toMatchObject({ success: true });
  });

  it.each([
    'Poll is not active',
    'Invalid parameters for multiple votes',
    'Poll menu configuration is invalid',
  ])('доменная ошибка «%s» — 400 POLL_ERROR', async message => {
    voteService.castVotes.mockRejectedValue(new VotingError(message));
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ERROR', error: message });
  });

  it('неизвестная ошибка — 500', async () => {
    voteService.castVotes.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.voteMultiple(
      memberRequest({ params: { id: '10' }, body: { menuItemIds: [1] } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/polls/:id/vote', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    voteService.removeVote.mockResolvedValue(undefined);
  });

  it('снимает голос', async () => {
    const res = mockResponse();

    await controller.removeVote(
      memberRequest({ params: { id: '10' } }),
      res
    );

    expect(voteService.removeVote).toHaveBeenCalledWith(10, 1);
    expect(res.body).toMatchObject({ message: 'Vote removed successfully' });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.removeVote(
      memberRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(voteService.removeVote).not.toHaveBeenCalled();
  });

  it('голоса не было — 404 VOTE_NOT_FOUND', async () => {
    voteService.removeVote.mockRejectedValue(new VoteNotFoundError());
    const res = mockResponse();

    await controller.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'VOTE_NOT_FOUND' });
  });

  it.each(['Poll not found', 'Poll is not active'])(
    'доменная ошибка «%s» — 400',
    async message => {
      voteService.removeVote.mockRejectedValue(new VotingError(message));
      const res = mockResponse();

      await controller.removeVote(
        memberRequest({ params: { id: '10' } }),
        res
      );

      expect(res.statusCode).toBe(400);
    }
  );

  it('неизвестная ошибка — 500', async () => {
    voteService.removeVote.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.removeVote(memberRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/polls/:id/roulette', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.runRoulette.mockResolvedValue({
      responsibleUserId: 7,
    });
  });

  it('выбирает ответственного', async () => {
    const res = mockResponse();

    await controller.runRoulette(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(pollService.runRoulette).toHaveBeenCalledWith(10);
    expect(res.body).toMatchObject({ data: { responsibleUserId: 7 } });
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.runRoulette(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(403);
    expect(pollService.runRoulette).not.toHaveBeenCalled();
  });

  it('сервис не нашёл голосование — 404', async () => {
    pollService.runRoulette.mockRejectedValue(new PollNotFoundError());
    const res = mockResponse();

    await controller.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('нет голосовавших — 400 NO_VOTERS', async () => {
    pollService.runRoulette.mockRejectedValue(new NoVotersError());
    const res = mockResponse();

    await controller.runRoulette(adminRequest({ params: { id: '10' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NO_VOTERS' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.runRoulette.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.runRoulette(adminRequest({ params: { id: '10' } }), res);

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

    await controller.getPopularItems(
      memberRequest({ query: { groupId: '100', limit: '5' } }),
      res
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(5, 100);
    expect(res.body).toMatchObject({ count: 1 });
  });

  it('без limit берёт 10', async () => {
    await controller.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      mockResponse()
    );

    expect(menuService.getPopularMenuItems).toHaveBeenCalledWith(10, 100);
  });

  it('отрицательный limit — 400', async () => {
    const res = mockResponse();

    await controller.getPopularItems(
      memberRequest({ query: { groupId: '100', limit: '-1' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_LIMIT' });
  });

  it('без groupId — 400', async () => {
    const res = mockResponse();

    await controller.getPopularItems(memberRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MISSING_GROUP_ID' });
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    menuService.getPopularMenuItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPopularItems(
      memberRequest({ query: { groupId: '100' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PATCH /api/polls/:id/complete-multi', () => {
  beforeEach(() => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    pollService.completePollMultiWinner.mockResolvedValue({
      id: 1,
      rouletteData: JSON.stringify({ winners: [{ menuItemId: 1 }] }),
    });
  });

  it('завершает голосование с несколькими победителями', async () => {
    const res = mockResponse();

    await controller.completePollMultiWinner(
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

    await controller.completePollMultiWinner(
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

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { resultData: {} } });
  });

  it('фича выключена — 503', async () => {
    FEATURES.MULTI_WINNER_VOTING = false;
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(pollService.completePollMultiWinner).not.toHaveBeenCalled();
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mockResponse();

    await controller.completePollMultiWinner(
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

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('альтернативный tieBreakMethod принимается', async () => {
    const res = mockResponse();

    await controller.completePollMultiWinner(
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
      new PollNotFoundError()
    );
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('уже завершено — 400 ALREADY_COMPLETED', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(
      new PollAlreadyCompletedError()
    );
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'ALREADY_COMPLETED' });
  });

  it('не активно — 400 NOT_ACTIVE', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(
      new PollNotActiveError()
    );
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'NOT_ACTIVE' });
  });

  it('прочая ошибка — 500', async () => {
    pollService.completePollMultiWinner.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.completePollMultiWinner(
      adminRequest({ params: { id: '10' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});
