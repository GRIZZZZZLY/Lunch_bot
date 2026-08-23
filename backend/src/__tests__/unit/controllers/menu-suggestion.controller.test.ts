/**
 * Предложения блюд: участник предлагает, администратор ГРУППЫ одобряет.
 *
 * Этот контроллер — тот самый, на котором две системы прав разошлись молча.
 * Список спрашивал роль в группе, а «одно предложение» читал глобальный флаг
 * users.is_admin. Последствия были не ошибкой, а тишиной: администратор группы
 * без флага видел очередь модерации и получал 403 на любом чужом предложении,
 * а владелец флага без членства читал предложения ЛЮБОЙ группы — groupId в том
 * пути не проверялся вовсе.
 *
 * Поэтому здесь проверяется прежде всего согласованность: право видеть чужое и
 * право менять чужое выводятся из одного источника — роли в group_members.
 *
 * Второе важное свойство: без groupId групповую выборку не с чем сверить, и
 * безопасный ответ — отдать только свои предложения, а не все.
 */
import {
  createSuggestion,
  getSuggestions,
  getSuggestionById,
  approveSuggestion,
  rejectSuggestion,
  getStats,
  getPendingCount,
  deleteSuggestion,
} from '../../../api/controllers/menu-suggestion.controller';
import { MenuSuggestionService } from '../../../services/menu-suggestion.service';
import { GroupAccessError, GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import type { MockRequestInit, MockResponse } from '../../helpers/http';

jest.mock('../../../services/menu-suggestion.service', () => ({
  MenuSuggestionService: {
    createSuggestion: jest.fn(),
    getSuggestions: jest.fn(),
    getSuggestionById: jest.fn(),
    approveSuggestion: jest.fn(),
    rejectSuggestion: jest.fn(),
    getStats: jest.fn(),
    getPendingCount: jest.fn(),
    deleteSuggestion: jest.fn(),
  },
}));

/* GroupAccessError берём настоящий: контроллер отличает его от прочих ошибок и
   отдаёт 403 вместо 500 — подменять этот класс заглушкой значило бы проверять
   не то. */
jest.mock('../../../services/group.service', () => {
  const actual = jest.requireActual('../../../services/group.service');
  return {
    GroupAccessError: actual.GroupAccessError,
    GroupService: { isUserGroupAdmin: jest.fn() },
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const suggestions = asServiceMock(MenuSuggestionService);
const groups = asServiceMock(GroupService);
const { logger } = jest.requireMock('../../../utils/logger');

const AUTHOR = { id: 5 };
const OTHER = { id: 9 };
const SUGGESTION = {
  id: 7,
  name: 'Плов',
  groupId: 100,
  status: 'PENDING',
  suggestedBy: 5,
};

type Handler = (req: never, res: never) => Promise<void>;

/** Вызывает обработчик и отдаёт ответ вместе с разобранным телом. */
async function call(
  handler: Handler,
  init: MockRequestInit = {}
): Promise<{ res: MockResponse; body: Record<string, unknown> }> {
  const res = mockResponse();
  await handler(mockRequest(init) as never, res as never);
  return { res, body: (res.body ?? {}) as Record<string, unknown> };
}

/** Фильтры, с которыми контроллер обратился к сервису. */
function usedFilters(): Record<string, unknown> {
  return suggestions.getSuggestions.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  groups.isUserGroupAdmin.mockResolvedValue(false);
  suggestions.createSuggestion.mockResolvedValue(SUGGESTION);
  suggestions.getSuggestions.mockResolvedValue([SUGGESTION]);
  suggestions.getSuggestionById.mockResolvedValue(SUGGESTION);
  suggestions.approveSuggestion.mockResolvedValue({ ...SUGGESTION, status: 'APPROVED' });
  suggestions.rejectSuggestion.mockResolvedValue({ ...SUGGESTION, status: 'REJECTED' });
  suggestions.getStats.mockResolvedValue({ pending: 2, approved: 1 });
  suggestions.getPendingCount.mockResolvedValue(2);
  suggestions.deleteSuggestion.mockResolvedValue(undefined);
});

describe('createSuggestion', () => {
  const body = { name: 'Плов', groupId: 100 };

  it('предложение создаётся с автором и группой', async () => {
    const { res, body: response } = await call(createSuggestion, {
      user: AUTHOR,
      body,
    });

    expect(res.statusCode).toBe(201);
    expect(response).toMatchObject({ success: true, data: SUGGESTION });
    expect(suggestions.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Плов', suggestedBy: 5, groupId: 100 })
    );
  });

  it('пробелы вокруг названия и описания срезаются', async () => {
    await call(createSuggestion, {
      user: AUTHOR,
      body: { ...body, name: '  Плов  ', description: '  без лука  ' },
    });

    expect(suggestions.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Плов', description: 'без лука' })
    );
  });

  it('цена приводится к числу', async () => {
    await call(createSuggestion, {
      user: AUTHOR,
      body: { ...body, price: '250.5' },
    });

    expect(suggestions.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ price: 250.5 })
    );
  });

  it('без цены поле не передаётся вовсе', async () => {
    await call(createSuggestion, { user: AUTHOR, body });

    const payload = suggestions.createSuggestion.mock.calls[0][0] as {
      price?: number;
    };
    expect(payload.price).toBeUndefined();
  });

  it('без аутентификации — 401', async () => {
    const { res } = await call(createSuggestion, { body });

    expect(res.statusCode).toBe(401);
    expect(suggestions.createSuggestion).not.toHaveBeenCalled();
  });

  it.each([
    ['без названия', {}],
    ['пустое название', { name: '   ' }],
  ])('%s — 400', async (_name, over) => {
    const { res, body: response } = await call(createSuggestion, {
      user: AUTHOR,
      body: { groupId: 100, ...over },
    });

    expect(res.statusCode).toBe(400);
    expect(response.code).toBe('VALIDATION_ERROR');
    expect(suggestions.createSuggestion).not.toHaveBeenCalled();
  });

  it.each([
    ['без groupId', {}],
    ['нечисловой groupId', { groupId: 'нет' }],
  ])('%s — 400: предложение без группы никому не видно', async (_name, over) => {
    const { res, body: response } = await call(createSuggestion, {
      user: AUTHOR,
      body: { name: 'Плов', ...over },
    });

    expect(res.statusCode).toBe(400);
    expect(response.code).toBe('MISSING_GROUP_ID');
    expect(suggestions.createSuggestion).not.toHaveBeenCalled();
  });

  it('отказ доступа от сервиса отдаётся как 403, а не 500', async () => {
    suggestions.createSuggestion.mockRejectedValue(
      new GroupAccessError('NOT_MEMBER', 'You are not a member of this group')
    );

    const { res, body: response } = await call(createSuggestion, {
      user: AUTHOR,
      body,
    });

    expect(res.statusCode).toBe(403);
    expect(response.code).toBe('NOT_MEMBER');
  });

  it('прочий сбой — 500 с записью в лог', async () => {
    suggestions.createSuggestion.mockRejectedValue(new Error('db down'));

    const { res } = await call(createSuggestion, { user: AUTHOR, body });

    expect(res.statusCode).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create suggestion',
      expect.any(Error)
    );
  });
});

describe('getSuggestions: кто что видит', () => {
  it('администратор группы видит всю очередь модерации', async () => {
    groups.isUserGroupAdmin.mockResolvedValue(true);

    await call(getSuggestions, { user: OTHER, query: { groupId: '100' } });

    expect(groups.isUserGroupAdmin).toHaveBeenCalledWith(9, 100);
    expect(usedFilters()).toEqual({ groupId: 100 });
  });

  it('обычный участник видит в группе только свои предложения', async () => {
    await call(getSuggestions, { user: AUTHOR, query: { groupId: '100' } });

    expect(usedFilters()).toEqual({ groupId: 100, suggestedBy: 5 });
  });

  it('без groupId отдаются только свои: сверять группу не с чем', async () => {
    groups.isUserGroupAdmin.mockResolvedValue(true);

    await call(getSuggestions, { user: OTHER });

    expect(usedFilters()).toEqual({ suggestedBy: 9 });
    expect(groups.isUserGroupAdmin).not.toHaveBeenCalled();
  });

  it.each([['нечисловой', 'нет'], ['нулевой', '0'], ['отрицательный', '-3']])(
    '%s groupId трактуется как отсутствующий — только свои',
    async (_name, raw) => {
      groups.isUserGroupAdmin.mockResolvedValue(true);

      await call(getSuggestions, { user: OTHER, query: { groupId: raw } });

      expect(usedFilters()).toEqual({ suggestedBy: 9 });
    }
  );

  it('фильтр по статусу передаётся дальше', async () => {
    await call(getSuggestions, {
      user: AUTHOR,
      query: { groupId: '100', status: 'PENDING' },
    });

    expect(usedFilters()).toMatchObject({ status: 'PENDING' });
  });

  it('постраничные параметры передаются числами', async () => {
    await call(getSuggestions, {
      user: AUTHOR,
      query: { groupId: '100', limit: '10', offset: '20' },
    });

    expect(usedFilters()).toMatchObject({ limit: 10, offset: 20 });
  });

  it('без аутентификации — 401', async () => {
    const { res } = await call(getSuggestions, { query: { groupId: '100' } });

    expect(res.statusCode).toBe(401);
    expect(suggestions.getSuggestions).not.toHaveBeenCalled();
  });

  it('сбой чтения — 500', async () => {
    suggestions.getSuggestions.mockRejectedValue(new Error('db down'));

    const { res } = await call(getSuggestions, { user: AUTHOR });

    expect(res.statusCode).toBe(500);
  });
});

describe('getSuggestionById: право видеть одно предложение', () => {
  it('своё предложение автор открывает всегда', async () => {
    const { res } = await call(getSuggestionById, {
      user: AUTHOR,
      params: { id: '7' },
    });

    expect(res.statusCode).toBe(200);
  });

  /* Ключевая проверка: раньше это решал глобальный флаг, из-за чего
     администратор группы получал 403 на своей же очереди модерации. */
  it('чужое предложение открывает администратор ГРУППЫ этого предложения', async () => {
    groups.isUserGroupAdmin.mockResolvedValue(true);

    const { res } = await call(getSuggestionById, {
      user: OTHER,
      params: { id: '7' },
    });

    expect(groups.isUserGroupAdmin).toHaveBeenCalledWith(9, 100);
    expect(res.statusCode).toBe(200);
  });

  it('посторонний участник чужое предложение не открывает', async () => {
    const { res, body } = await call(getSuggestionById, {
      user: OTHER,
      params: { id: '7' },
    });

    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('роль проверяется в группе ПРЕДЛОЖЕНИЯ, а не в произвольной', async () => {
    suggestions.getSuggestionById.mockResolvedValue({
      ...SUGGESTION,
      groupId: 200,
      suggestedBy: 1,
    });
    groups.isUserGroupAdmin.mockResolvedValue(true);

    await call(getSuggestionById, { user: OTHER, params: { id: '7' } });

    expect(groups.isUserGroupAdmin).toHaveBeenCalledWith(9, 200);
  });

  it('несуществующее предложение — 404 до проверки прав', async () => {
    suggestions.getSuggestionById.mockResolvedValue(null);

    const { res, body } = await call(getSuggestionById, {
      user: OTHER,
      params: { id: '7' },
    });

    expect(res.statusCode).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(groups.isUserGroupAdmin).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const { res } = await call(getSuggestionById, { params: { id: '7' } });

    expect(res.statusCode).toBe(401);
  });
});

describe('approveSuggestion / rejectSuggestion', () => {
  it('одобрение передаёт id, модератора и группу', async () => {
    const { res } = await call(approveSuggestion, {
      user: OTHER,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(200);
    expect(suggestions.approveSuggestion).toHaveBeenCalledWith(7, 9, 100);
  });

  it('отклонение передаёт причину', async () => {
    await call(rejectSuggestion, {
      user: OTHER,
      params: { id: '7' },
      query: { groupId: '100' },
      body: { reason: 'уже есть в меню' },
    });

    expect(suggestions.rejectSuggestion).toHaveBeenCalledWith(
      7,
      9,
      'уже есть в меню',
      100
    );
  });

  it.each([
    ['одобрение', approveSuggestion],
    ['отклонение', rejectSuggestion],
  ])('%s без groupId — 400', async (_name, handler) => {
    const { res, body } = await call(handler as Handler, {
      user: OTHER,
      params: { id: '7' },
    });

    expect(res.statusCode).toBe(400);
    expect(body.code).toBe('MISSING_GROUP_ID');
  });

  it.each([
    ['одобрение', approveSuggestion],
    ['отклонение', rejectSuggestion],
  ])('%s без аутентификации — 401', async (_name, handler) => {
    const { res } = await call(handler as Handler, {
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('groupId читается и из тела запроса', async () => {
    await call(approveSuggestion, {
      user: OTHER,
      params: { id: '7' },
      body: { groupId: 100 },
    });

    expect(suggestions.approveSuggestion).toHaveBeenCalledWith(7, 9, 100);
  });

  /* Отказ прав приходит из сервиса: маршрут закрыт requireGroupAdmin, а
     сервис проверяет ещё и состояние предложения. 403 не должен превратиться
     в 500 — иначе человек увидит «что-то сломалось» вместо причины. */
  it('отказ прав из сервиса отдаётся как 403', async () => {
    suggestions.approveSuggestion.mockRejectedValue(
      new GroupAccessError('NOT_ADMIN', 'Group admin access required')
    );

    const { res, body } = await call(approveSuggestion, {
      user: OTHER,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('NOT_ADMIN');
  });

  it('прочий сбой одобрения — 500', async () => {
    suggestions.approveSuggestion.mockRejectedValue(new Error('db down'));

    const { res } = await call(approveSuggestion, {
      user: OTHER,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(500);
  });
});

describe('статистика и счётчик', () => {
  it('статистика запрашивается по группе', async () => {
    const { res, body } = await call(getStats, { query: { groupId: '100' } });

    expect(res.statusCode).toBe(200);
    expect(suggestions.getStats).toHaveBeenCalledWith(100);
    expect(body).toMatchObject({ data: { pending: 2 } });
  });

  it('счётчик ожидающих запрашивается по группе', async () => {
    const { body } = await call(getPendingCount, { query: { groupId: '100' } });

    expect(suggestions.getPendingCount).toHaveBeenCalledWith(100);
    expect(body).toMatchObject({ success: true });
  });

  it.each([
    ['статистика', getStats],
    ['счётчик', getPendingCount],
  ])('%s без groupId — 400', async (_name, handler) => {
    const { res, body } = await call(handler as Handler, {});

    expect(res.statusCode).toBe(400);
    expect(body.code).toBe('MISSING_GROUP_ID');
  });

  it('сбой статистики — 500', async () => {
    suggestions.getStats.mockRejectedValue(new Error('db down'));

    const { res } = await call(getStats, { query: { groupId: '100' } });

    expect(res.statusCode).toBe(500);
  });
});

describe('deleteSuggestion', () => {
  it('удаление передаёт id, пользователя и группу', async () => {
    const { res } = await call(deleteSuggestion, {
      user: AUTHOR,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(200);
    expect(suggestions.deleteSuggestion).toHaveBeenCalledWith(7, 5, 100);
  });

  it('без аутентификации — 401', async () => {
    const { res } = await call(deleteSuggestion, {
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(401);
    expect(suggestions.deleteSuggestion).not.toHaveBeenCalled();
  });

  it('без groupId — 400', async () => {
    const { res, body } = await call(deleteSuggestion, {
      user: AUTHOR,
      params: { id: '7' },
    });

    expect(res.statusCode).toBe(400);
    expect(body.code).toBe('MISSING_GROUP_ID');
  });

  /* Право удалять проверяет сервис: он же знает, что предложение в статусе
     PENDING удалять нельзя. Отказ должен дойти до человека причиной, а не
     пятисоткой. */
  it('отказ прав из сервиса отдаётся как 403', async () => {
    suggestions.deleteSuggestion.mockRejectedValue(
      new GroupAccessError('NOT_ADMIN', 'Group admin access required')
    );

    const { res, body } = await call(deleteSuggestion, {
      user: AUTHOR,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(403);
    expect(body.code).toBe('NOT_ADMIN');
  });

  it('прочий сбой — 500', async () => {
    suggestions.deleteSuggestion.mockRejectedValue(new Error('db down'));

    const { res } = await call(deleteSuggestion, {
      user: AUTHOR,
      params: { id: '7' },
      query: { groupId: '100' },
    });

    expect(res.statusCode).toBe(500);
  });
});
