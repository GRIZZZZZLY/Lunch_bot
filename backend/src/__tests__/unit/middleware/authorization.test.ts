/**
 * Авторизация ресурсов опроса и категорийного заказа.
 *
 * Эти проверки раньше жили копиями внутри контроллеров, в том числе с прямым
 * обращением к Prisma из HTTP-слоя. Здесь закреплено то, ради чего их и
 * сводили в одно место: правило одно, отказ один, и посторонний из другой
 * группы не отличает «нет доступа» от «нет такого опроса».
 */
import {
  requirePollAccess,
  requireCategoryOrderPollAccess,
  requireCategoryOrderResponsible,
  requireCategoryOrderParticipant,
  requireGroupAdminOverUser,
  requireOrderItemGroupAdmin,
} from '../../../api/middleware/authorization';
import { OrderCalculationService } from '../../../services/order-calculation.service';
import { CategoryOrderService } from '../../../services/category-order.service';
import { GroupService } from '../../../services/group.service';
import { PollQueryService } from '../../../services/poll-query.service';

jest.mock('../../../services/category-order.service');
jest.mock('../../../services/group.service');
jest.mock('../../../services/order-calculation.service');
jest.mock('../../../services/poll.service');

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: {
    getPollGroupId: jest.fn(),
  },
}));


const mkRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const mkReq = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { id: 1 },
    params: {},
    query: {},
    body: {},
    ...overrides,
  }) as never;

const pollQuery = PollQueryService as jest.Mocked<typeof PollQueryService>;
const groupService = GroupService as jest.Mocked<typeof GroupService>;
const categoryOrders = CategoryOrderService as jest.Mocked<
  typeof CategoryOrderService
>;
const calculations = OrderCalculationService as jest.Mocked<
  typeof OrderCalculationService
>;

beforeEach(() => jest.clearAllMocks());

describe('requirePollAccess', () => {
  it('участник группы опроса проходит', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockImplementation(
      async (userId, groupId) => userId === 1 && groupId === 100
    );
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: '5' } }), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  /* Тоже перенесено из controller-тестов: доступ даёт членство в группе, а не
     глобальный флаг администратора. */
  it('глобальный админ без членства в группе получает 403', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(
      mkReq({ user: { id: 1, isAdmin: true }, params: { pollId: '5' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('человек из другой группы получает 403', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: '5' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  /* 404 сообщал бы постороннему, какие id опросов существуют, — то есть
     позволял бы перебором изучать чужие группы. */
  it('несуществующий опрос отвечает 403, а не 404', async () => {
    pollQuery.getPollGroupId.mockResolvedValue(null);
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: '999' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(groupService.isUserGroupMember).not.toHaveBeenCalled();
  });

  it('испорченный pollId — 400, без обращения к сервисам', async () => {
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: 'abc' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pollQuery.getPollGroupId).not.toHaveBeenCalled();
  });

  it('сбой сервиса — 500, а не тихий пропуск', async () => {
    pollQuery.getPollGroupId.mockRejectedValue(new Error('db down'));
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: '5' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * Тоже закрытая утечка: `requireGroupAdmin` на маршруте статистики проверял
 * только админство в группе из запроса, но не то, что целевой пользователь в
 * этой группе состоит. Администратор любой группы читал статистику любого.
 */
describe('requireGroupAdminOverUser', () => {
  /* Пользователь 1 — админ только группы 7, участник 42 состоит только в ней.
     groupId читается из params, затем query, затем body: у разных эндпоинтов
     параметр приходит по-разному. */
  it.each<[string, Record<string, unknown>, boolean]>([
    ['группа из query', { params: { userId: '42' }, query: { groupId: '7' } }, true],
    ['params важнее query', { params: { userId: '42', groupId: '7' }, query: { groupId: '100' } }, true],
    ['подменить группу через query нельзя', { params: { userId: '42', groupId: '100' }, query: { groupId: '7' } }, false],
    ['группа из body, если нет ни params, ни query', { params: { userId: '42' }, body: { groupId: 7 } }, true],
  ])('%s', async (_name, init, passes) => {
    groupService.isUserGroupAdmin.mockImplementation(async (userId, groupId) => userId === 1 && groupId === 7);
    groupService.isUserGroupMember.mockImplementation(async (userId, groupId) => userId === 42 && groupId === 7);
    const res = mkRes();
    const next = jest.fn();

    await requireGroupAdminOverUser(mkReq(init), res, next);

    expect(next).toHaveBeenCalledTimes(passes ? 1 : 0);
    if (!passes) expect(res.status).toHaveBeenCalledWith(403);
  });

  it('целевой пользователь не в этой группе — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mkRes();
    const next = jest.fn();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('не админ группы — 403', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    groupService.isUserGroupMember.mockResolvedValue(true);
    const res = mkRes();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  /* Оба отказа одним текстом намеренно: разные ответы позволяли бы перебором
     выяснять состав чужой группы. */
  it('оба отказа неотличимы по ответу', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const notMember = mkRes();
    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      notMember,
      jest.fn()
    );

    groupService.isUserGroupAdmin.mockResolvedValue(false);
    groupService.isUserGroupMember.mockResolvedValue(true);
    const notAdmin = mkRes();
    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      notAdmin,
      jest.fn()
    );

    expect(notMember.json.mock.calls[0][0]).toEqual(
      notAdmin.json.mock.calls[0][0]
    );
  });

  it('без groupId — 400', async () => {
    const res = mkRes();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

/**
 * Сбой сервиса — 500, а НЕ тихий `next()`. Это главное свойство catch-веток:
 * упавшая проверка доступа не должна превращаться в разрешение. Проверяется
 * для каждого guard'а отдельно, потому что «наверное там то же самое» — ровно
 * то допущение, из-за которого один из них однажды пропустит запрос.
 */
describe('сбой проверки доступа не открывает доступ', () => {
  it('requireCategoryOrderResponsible — 500, next не вызван', async () => {
    categoryOrders.getResponsibleUserId.mockRejectedValue(new Error('db down'));
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireCategoryOrderParticipant — 500, next не вызван', async () => {
    categoryOrders.getCategoryOrder.mockRejectedValue(new Error('db down'));
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireCategoryOrderPollAccess — 500, next не вызван', async () => {
    categoryOrders.getCategoryOrder.mockRejectedValue(new Error('db down'));
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderPollAccess(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrderItemGroupAdmin — 500, next не вызван', async () => {
    calculations.getCategoryOrderIdForItem.mockRejectedValue(
      new Error('db down')
    );
    const res = mkRes();
    const next = jest.fn();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: '77' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireGroupAdminOverUser — 500, next не вызван', async () => {
    groupService.isUserGroupAdmin.mockRejectedValue(new Error('db down'));
    groupService.isUserGroupMember.mockResolvedValue(true);
    const res = mkRes();
    const next = jest.fn();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('испорченные параметры отклоняются до обращения к базе', () => {
  it('requireCategoryOrderResponsible — нечисловой id', async () => {
    const res = mkRes();

    await requireCategoryOrderResponsible()(
      mkReq({ params: { id: 'нет' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(categoryOrders.getResponsibleUserId).not.toHaveBeenCalled();
  });

  it('requireCategoryOrderParticipant — нечисловой id', async () => {
    const res = mkRes();

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: 'нет' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(categoryOrders.getCategoryOrder).not.toHaveBeenCalled();
  });

  it('requireOrderItemGroupAdmin — нечисловой id', async () => {
    const res = mkRes();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: 'нет' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(calculations.getCategoryOrderIdForItem).not.toHaveBeenCalled();
  });

  it('requireOrderItemGroupAdmin — категория позиции исчезла, 403', async () => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(10);
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const res = mkRes();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: '77' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('requireGroupAdminOverUser — нечисловой userId', async () => {
    const res = mkRes();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: 'нет' }, query: { groupId: '100' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(groupService.isUserGroupAdmin).not.toHaveBeenCalled();
  });
});
