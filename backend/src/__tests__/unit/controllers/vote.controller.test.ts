/**
 * Голоса Mini App. Ключевое здесь — что набор голосов заменяется атомарно, что
 * лимит выбора соблюдается ДО записи, и что кворум-проверка не может утащить с
 * собой уже записанный голос.
 */
import {
  createMultipleVotes,
  getUserVotes,
  deleteVote,
} from '../../../api/controllers/vote.controller';
import { VoteService } from '../../../services/vote.service';
import { PollService } from '../../../services/poll.service';
import { GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/vote.service', () => ({
  VoteService: {
    replaceUserVotes: jest.fn(),
    getUserVotes: jest.fn(),
    deleteVote: jest.fn(),
  },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: {
    getPollGroupId: jest.fn(),
    getPollById: jest.fn(),
    checkQuorumAndComplete: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const voteService = asServiceMock(VoteService);
const pollService = asServiceMock(PollService);
const groupService = asServiceMock(GroupService);

const USER = { id: 1, isAdmin: false };

beforeEach(() => {
  jest.clearAllMocks();
  pollService.getPollGroupId.mockResolvedValue(100);
  pollService.getPollById.mockResolvedValue({
    id: 5,
    isMultiSelect: true,
    maxSelections: 3,
  });
  pollService.checkQuorumAndComplete.mockResolvedValue(undefined);
  groupService.isUserGroupMember.mockResolvedValue(true);
  voteService.replaceUserVotes.mockResolvedValue({
    votes: [{ id: 1, menuItemId: 2 }],
  });
});

describe('POST /api/votes/multiple', () => {
  it('заменяет набор голосов одним вызовом и убирает дубли', async () => {
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2, 3, 3] } }),
      res
    );

    expect(voteService.replaceUserVotes).toHaveBeenCalledWith(5, 1, [2, 3]);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Votes updated: 2 selected',
    });
  });

  it('пустой массив снимает все голоса', async () => {
    voteService.replaceUserVotes.mockResolvedValue({ votes: [] });
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [] } }),
      res
    );

    expect(voteService.replaceUserVotes).toHaveBeenCalledWith(5, 1, []);
    expect(res.statusCode).toBe(200);
  });

  it('проверка кворума вызывается после записи', async () => {
    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      mockResponse()
    );

    expect(pollService.checkQuorumAndComplete).toHaveBeenCalledWith(5);
  });

  it('падение проверки кворума не отменяет записанные голоса', async () => {
    pollService.checkQuorumAndComplete.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(voteService.replaceUserVotes).not.toHaveBeenCalled();
  });

  it.each([
    ['pollId строкой', { pollId: '5', menuItemIds: [2] }],
    ['pollId ноль', { pollId: 0, menuItemIds: [2] }],
    ['menuItemIds не массив', { pollId: 5, menuItemIds: 2 }],
    ['нецелый элемент', { pollId: 5, menuItemIds: [2.5] }],
    ['отрицательный элемент', { pollId: 5, menuItemIds: [-2] }],
    ['больше 20 элементов', { pollId: 5, menuItemIds: Array.from({ length: 21 }, (_, i) => i + 1) }],
  ])('%s — 400 VALIDATION_ERROR', async (_label, body) => {
    const res = mockResponse();

    await createMultipleVotes(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('ошибки валидации описывают поле', async () => {
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: -1, menuItemIds: [1] } }),
      res
    );

    expect(res.body).toMatchObject({
      details: [{ field: 'pollId', message: expect.any(String) }],
    });
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('голосование исчезло между проверками — 404', async () => {
    pollService.getPollById.mockResolvedValue(null);
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник группы — 403 (глобальный админ здесь не помогает)', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({
        user: { id: 1, isAdmin: true },
        body: { pollId: 5, menuItemIds: [2] },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(voteService.replaceUserVotes).not.toHaveBeenCalled();
  });

  it('одиночный выбор: два блюда — 400', async () => {
    pollService.getPollById.mockResolvedValue({
      id: 5,
      isMultiSelect: false,
    });
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2, 3] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'SINGLE_SELECTION_ONLY' });
  });

  it('превышен лимит выбора — 400', async () => {
    pollService.getPollById.mockResolvedValue({
      id: 5,
      isMultiSelect: true,
      maxSelections: 2,
    });
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [1, 2, 3] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'MAX_SELECTIONS_EXCEEDED' });
  });

  it('лимит выше трёх всё равно ограничен тремя', async () => {
    pollService.getPollById.mockResolvedValue({
      id: 5,
      isMultiSelect: true,
      maxSelections: 10,
    });
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [1, 2, 3, 4] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'Maximum 3 selections allowed' });
  });

  it.each([
    'Poll is not active',
    'Poll has expired',
    'Menu item is not available for this poll',
    'User is not eligible to vote in this poll',
  ])('доменная ошибка «%s» — 400 POLL_ERROR', async message => {
    voteService.replaceUserVotes.mockRejectedValue(new Error(message));
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'POLL_ERROR' });
  });

  it('неизвестная ошибка — 500 без утечки текста вне development', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    voteService.replaceUserVotes.mockRejectedValue(new Error('secret detail'));
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ details: undefined });
    process.env.NODE_ENV = originalEnv;
  });

  it('в development текст ошибки виден разработчику', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    voteService.replaceUserVotes.mockRejectedValue(new Error('detail'));
    const res = mockResponse();

    await createMultipleVotes(
      mockRequest({ user: USER, body: { pollId: 5, menuItemIds: [2] } }),
      res
    );

    expect(res.body).toMatchObject({ details: 'detail' });
    process.env.NODE_ENV = originalEnv;
  });
});

describe('GET /api/votes/:pollId/user', () => {
  beforeEach(() => {
    voteService.getUserVotes.mockResolvedValue([
      { id: 1, menuItemId: 2 },
      { id: 2, menuItemId: null },
    ] as never);
  });

  it('отдаёт голоса пользователя и список блюд без пустых значений', async () => {
    const res = mockResponse();

    await getUserVotes(mockRequest({ user: USER, params: { pollId: '5' } }), res);

    expect(voteService.getUserVotes).toHaveBeenCalledWith(5, 1);
    expect(res.body).toMatchObject({ success: true, menuItemIds: [2] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await getUserVotes(mockRequest({ params: { pollId: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await getUserVotes(
      mockRequest({ user: USER, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await getUserVotes(mockRequest({ user: USER, params: { pollId: '5' } }), res);

    expect(res.statusCode).toBe(404);
  });

  /* Чтение голосов чужой группы закрыто для всех: параметр allowGlobalRead и
     обход по users.is_admin удалены вместе с понятием глобального админа. */
  it('чужую группу не читает никто, включая прежнего глобального админа', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await getUserVotes(
      mockRequest({ user: { id: 1, isAdmin: true }, params: { pollId: '5' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 100);
  });

  it('не участник и не админ — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await getUserVotes(mockRequest({ user: USER, params: { pollId: '5' } }), res);

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    voteService.getUserVotes.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await getUserVotes(mockRequest({ user: USER, params: { pollId: '5' } }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/votes/:pollId/item/:menuItemId', () => {
  it('удаляет голос за конкретное блюдо', async () => {
    const res = mockResponse();

    await deleteVote(
      mockRequest({ user: USER, params: { pollId: '5', menuItemId: '2' } }),
      res
    );

    expect(voteService.deleteVote).toHaveBeenCalledWith(5, 1, 2);
    expect(res.body).toMatchObject({ success: true, message: 'Vote removed' });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await deleteVote(
      mockRequest({ params: { pollId: '5', menuItemId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['нечисловой pollId', { pollId: 'нет', menuItemId: '2' }],
    ['нечисловой menuItemId', { pollId: '5', menuItemId: 'нет' }],
    ['без параметров', {}],
  ])('%s — 400', async (_label, params) => {
    const res = mockResponse();

    await deleteVote(mockRequest({ user: USER, params }), res);

    expect(res.statusCode).toBe(400);
    expect(voteService.deleteVote).not.toHaveBeenCalled();
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await deleteVote(
      mockRequest({ user: USER, params: { pollId: '5', menuItemId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await deleteVote(
      mockRequest({ user: USER, params: { pollId: '5', menuItemId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    voteService.deleteVote.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await deleteVote(
      mockRequest({ user: USER, params: { pollId: '5', menuItemId: '2' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});
