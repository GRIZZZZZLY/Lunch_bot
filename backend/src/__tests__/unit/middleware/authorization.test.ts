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
    groupService.isUserGroupMember.mockResolvedValue(true);
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(mkReq({ params: { pollId: '5' } }), res, next);

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(1, 100);
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

  it('без аутентификации — 401 и запись в лог', async () => {
    const res = mkRes();
    const next = jest.fn();

    await requirePollAccess(
      mkReq({ user: undefined, params: { pollId: '5' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
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

describe('requireCategoryOrderResponsible', () => {
  it('ответственный проходит', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(1);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('участник, но не ответственный — 403', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(2);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  /* Свойство перенесено из controller-тестов: глобальный флаг isAdmin роль в
     группе НЕ заменяет. Middleware его не читает вовсе — тест закрепляет
     именно это, чтобы «удобная» правка не добавила обход. */
  it('глобальный админ не становится ответственным по флагу', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(2);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ user: { id: 1, isAdmin: true }, params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('ответственный ещё не выбран — 404', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(null);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('без аутентификации — 401', async () => {
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderResponsible()(
      mkReq({ user: undefined, params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireCategoryOrderParticipant', () => {
  it('ответственный проходит, даже не будучи участником', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      responsibleUserId: 1,
    } as never);
    categoryOrders.getParticipants.mockResolvedValue([7, 8]);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('участник проходит, не будучи ответственным', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      responsibleUserId: 2,
    } as never);
    categoryOrders.getParticipants.mockResolvedValue([1, 8]);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('ни ответственный, ни участник — 403', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      responsibleUserId: 2,
    } as never);
    categoryOrders.getParticipants.mockResolvedValue([7, 8]);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  /* Обе выборки идут параллельно: последовательные await здесь удваивали бы
     задержку на каждом запросе к категорийному заказу. */
  it('ответственный и участники читаются одним заходом', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      responsibleUserId: 1,
    } as never);
    categoryOrders.getParticipants.mockResolvedValue([1]);

    await requireCategoryOrderParticipant(
      mkReq({ params: { id: '10' } }),
      mkRes(),
      jest.fn()
    );

    expect(categoryOrders.getCategoryOrder).toHaveBeenCalledWith(10);
    expect(categoryOrders.getParticipants).toHaveBeenCalledWith(10);
  });
});

describe('requireCategoryOrderPollAccess', () => {
  it('участник группы опроса проходит', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      pollId: 5,
    } as never);
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockResolvedValue(true);
    const next = jest.fn();

    await requireCategoryOrderPollAccess(
      mkReq({ params: { id: '10' } }),
      mkRes(),
      next
    );

    expect(next).toHaveBeenCalled();
  });

  it('человек из другой группы — 403', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      pollId: 5,
    } as never);
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mkRes();
    const next = jest.fn();

    await requireCategoryOrderPollAccess(
      mkReq({ params: { id: '10' } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  /* Глобальный флаг роль в группе не заменяет — свойство перенесено из
     снятого controller-теста «глобальный админ здесь не исключение». */
  it('глобальный админ без членства — 403', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue({
      id: 10,
      pollId: 5,
    } as never);
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mkRes();

    await requireCategoryOrderPollAccess(
      mkReq({ user: { id: 1, isAdmin: true }, params: { id: '10' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('категории нет — 404', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const res = mkRes();

    await requireCategoryOrderPollAccess(
      mkReq({ params: { id: '10' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('без аутентификации — 401', async () => {
    const res = mkRes();

    await requireCategoryOrderPollAccess(
      mkReq({ user: undefined, params: { id: '10' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('испорченный id — 400', async () => {
    const res = mkRes();

    await requireCategoryOrderPollAccess(
      mkReq({ params: { id: 'нет' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(categoryOrders.getCategoryOrder).not.toHaveBeenCalled();
  });
});

/**
 * Этот guard закрывает НАСТОЯЩУЮ утечку, а не переносит проверку. Раньше на
 * маршруте истории правок стоял `requireGroupAdmin`, который берёт `groupId`
 * из запроса и не связывает его с ресурсом: администратор группы A присылал
 * `orderItemId` из группы B со своим `groupId=A` и получал чужую историю.
 */
describe('requireOrderItemGroupAdmin', () => {
  it('администратор группы позиции проходит', async () => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(10);
    categoryOrders.getCategoryOrder.mockResolvedValue({ pollId: 5 } as never);
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    const next = jest.fn();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: '77' } }),
      mkRes(),
      next
    );

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 100);
    expect(next).toHaveBeenCalled();
  });

  /* Ровно тот случай, который раньше проходил: админ ЧУЖОЙ группы с
     подставленным groupId. Группа теперь берётся из самой позиции, поэтому
     подставить её нечем. */
  it('администратор другой группы получает 403, даже указав свой groupId', async () => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(10);
    categoryOrders.getCategoryOrder.mockResolvedValue({ pollId: 5 } as never);
    pollQuery.getPollGroupId.mockResolvedValue(100);
    groupService.isUserGroupAdmin.mockResolvedValue(false);
    const res = mkRes();
    const next = jest.fn();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: '77' }, query: { groupId: '999' } }),
      res,
      next
    );

    /* groupId из запроса не участвует в решении вовсе. */
    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 100);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('позиции нет — 403, существование чужих id не раскрываем', async () => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(null);
    const res = mkRes();

    await requireOrderItemGroupAdmin(
      mkReq({ params: { id: '77' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('без аутентификации — 401', async () => {
    const res = mkRes();

    await requireOrderItemGroupAdmin(
      mkReq({ user: undefined, params: { id: '77' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

/**
 * Тоже закрытая утечка: `requireGroupAdmin` на маршруте статистики проверял
 * только админство в группе из запроса, но не то, что целевой пользователь в
 * этой группе состоит. Администратор любой группы читал статистику любого.
 */
describe('requireGroupAdminOverUser', () => {
  it('админ читает статистику участника своей группы', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    groupService.isUserGroupMember.mockResolvedValue(true);
    const next = jest.fn();

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, query: { groupId: '100' } }),
      mkRes(),
      next
    );

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 100);
    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(42, 100);
    expect(next).toHaveBeenCalled();
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

  it('без аутентификации — 401', async () => {
    const res = mkRes();

    await requireGroupAdminOverUser(
      mkReq({
        user: undefined,
        params: { userId: '42' },
        query: { groupId: '100' },
      }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
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

  it('requireCategoryOrderParticipant — без аутентификации 401', async () => {
    const res = mkRes();

    await requireCategoryOrderParticipant(
      mkReq({ user: undefined, params: { id: '10' } }),
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
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

  /* groupId читается из params, query и body — приоритет именно такой.
     Порядок закреплён тестом, потому что у разных эндпоинтов параметр
     приходит по-разному, и без этого следующая правка добавит четвёртый. */
  it('requireGroupAdminOverUser — groupId из params имеет приоритет над query', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    groupService.isUserGroupMember.mockResolvedValue(true);

    await requireGroupAdminOverUser(
      mkReq({
        params: { userId: '42', groupId: '7' },
        query: { groupId: '100' },
      }),
      mkRes(),
      jest.fn()
    );

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 7);
  });

  it('requireGroupAdminOverUser — groupId из body, если нет ни params, ни query', async () => {
    groupService.isUserGroupAdmin.mockResolvedValue(true);
    groupService.isUserGroupMember.mockResolvedValue(true);

    await requireGroupAdminOverUser(
      mkReq({ params: { userId: '42' }, body: { groupId: 55 } }),
      mkRes(),
      jest.fn()
    );

    expect(groupService.isUserGroupAdmin).toHaveBeenCalledWith(1, 55);
  });
});
