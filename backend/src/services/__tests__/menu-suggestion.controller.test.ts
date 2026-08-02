/* Кто видит чужие предложения. Интерфейс рисует кнопки модерации по роли в
   ГРУППЕ, и по ней же устроены approve/reject. Список же фильтровался по
   глобальному users.is_admin — и админ группы получал пустую очередь при
   нарисованных кнопках, а глобальный админ без роли — чужие предложения из
   всех групп сразу. */
import type { Request, Response } from 'express';
import { getSuggestions } from '../../api/controllers/menu-suggestion.controller';
import { MenuSuggestionService } from '../menu-suggestion.service';
import { GroupService } from '../group.service';

jest.mock('../menu-suggestion.service', () => ({
  MenuSuggestionService: { getSuggestions: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function call(query: Record<string, string>, user: { id: number; isAdmin: boolean }) {
  const req = { query, user } as unknown as Request;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { req, res: { json, status } as unknown as Response };
}

const filters = () => (MenuSuggestionService.getSuggestions as jest.Mock).mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  (MenuSuggestionService.getSuggestions as jest.Mock).mockResolvedValue([]);
});

describe('GET /api/suggestions — кто видит чужое', () => {
  it('админ группы без глобального флага видит всю очередь группы', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(true);
    const { req, res } = call({ groupId: '10' }, { id: 5, isAdmin: false });

    await getSuggestions(req as never, res);

    expect(filters()).toEqual({ groupId: 10 });
    expect(filters().suggestedBy).toBeUndefined();
  });

  it('обычный участник видит только свои', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(false);
    const { req, res } = call({ groupId: '10' }, { id: 5, isAdmin: false });

    await getSuggestions(req as never, res);

    expect(filters()).toEqual({ groupId: 10, suggestedBy: 5 });
  });

  /* Глобальный флаг больше не даёт доступа к чужим предложениям: он не
     привязан к группе, и по нему нельзя решить, какую очередь показывать. */
  it('глобальный админ без роли в группе видит только свои', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(false);
    const { req, res } = call({ groupId: '10' }, { id: 5, isAdmin: true });

    await getSuggestions(req as never, res);

    expect(filters()).toEqual({ groupId: 10, suggestedBy: 5 });
  });

  it('без groupId группу не с чем сверить — отдаём только свои', async () => {
    const asAdmin = jest.spyOn(GroupService, 'isUserGroupAdmin');
    const { req, res } = call({}, { id: 5, isAdmin: true });

    await getSuggestions(req as never, res);

    expect(filters()).toEqual({ suggestedBy: 5 });
    expect(asAdmin).not.toHaveBeenCalled();
  });

  it('фильтр по статусу переживает проверку прав', async () => {
    jest.spyOn(GroupService, 'isUserGroupAdmin').mockResolvedValue(true);
    const { req, res } = call({ groupId: '10', status: 'PENDING' }, { id: 5, isAdmin: false });

    await getSuggestions(req as never, res);

    expect(filters()).toEqual({ groupId: 10, status: 'PENDING' });
  });
});
