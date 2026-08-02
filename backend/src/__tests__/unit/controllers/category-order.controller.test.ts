/**
 * Заказы по категориям: ответственный за категорию вбивает, кто что взял и по
 * какой цене, а из этого потом создаются долги. Права здесь тройные —
 * ответственный, участник категории и глобальный админ, и у каждого эндпоинта
 * своя комбинация. Тесты фиксируют именно её: право «смотреть» и право
 * «вписывать людям суммы» — не одно и то же.
 */
import { CategoryOrderController } from '../../../api/controllers/category-order.controller';
import { CategoryOrderService } from '../../../services/category-order.service';
import { OrderCalculationService } from '../../../services/order-calculation.service';
import { MultiCategoryResponsibleService } from '../../../services/multi-category-responsible.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {
    getCategoryOrdersForPoll: jest.fn(),
    getParticipantsByCategoriesForPoll: jest.fn(),
    getCategoryOrder: jest.fn(),
    getParticipants: jest.fn(),
    updateCosts: jest.fn(),
  },
}));

jest.mock('../../../services/order-calculation.service', () => ({
  OrderCalculationService: {
    saveOrderItem: jest.fn(),
    deleteOrderItem: jest.fn(),
    getProgress: jest.fn(),
    finalizeCalculation: jest.fn(),
    getEditHistory: jest.fn(),
    getOrderItems: jest.fn(),
  },
}));

jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: {
    handleVolunteerForCategory: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const categoryOrders = asServiceMock(CategoryOrderService);
const calculations = asServiceMock(OrderCalculationService);
const responsibles = asServiceMock(MultiCategoryResponsibleService);

/** Ответственный за категорию. */
const RESPONSIBLE = { id: 1, isAdmin: false };
/** Участник категории, но не ответственный. */
const PARTICIPANT = { id: 2, isAdmin: false };
/** Ни ответственный, ни участник. */
const OUTSIDER = { id: 3, isAdmin: false };
const GLOBAL_ADMIN = { id: 9, isAdmin: true };

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  // По умолчанию: ответственный — пользователь 1, участники — 1 и 2.
  prismaMock.categoryOrder.findUnique.mockResolvedValue({
    responsibleUserId: 1,
  } as never);
  categoryOrders.getParticipants.mockResolvedValue([1, 2]);
  prismaMock.poll.findUnique.mockResolvedValue({ groupId: 100 } as never);
  prismaMock.groupMember.findUnique.mockResolvedValue({ isActive: true } as never);
});

describe('GET /api/polls/:pollId/category-orders', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      { id: 1, category: 'Горячее' },
    ]);
  });

  it('участник группы видит все категории голосования', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 1, data: [{ id: 1 }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 403 (существование чужого опроса не раскрываем)', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('неактивное членство доступа не даёт', async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      isActive: false,
    } as never);
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('глобальный админ читает без членства', async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: GLOBAL_ADMIN, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/polls/:pollId/category-orders/my', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      { id: 1, category: 'Горячее' },
      { id: 2, category: 'Салаты' },
    ]);
    categoryOrders.getParticipantsByCategoriesForPoll.mockResolvedValue(
      new Map([
        ['Горячее', new Set([1, 2])],
        ['Салаты', new Set([5])],
      ])
    );
  });

  it('оставляет только категории, где пользователь голосовал', async () => {
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 1, data: [{ id: 1 }] });
  });

  it('категории без данных об участниках не попадают в выборку', async () => {
    categoryOrders.getParticipantsByCategoriesForPoll.mockResolvedValue(new Map());
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 0 });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('нет доступа к голосованию — 403', async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getParticipantsByCategoriesForPoll.mockRejectedValue(
      new Error('boom')
    );
    const res = mockResponse();

    await CategoryOrderController.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/category-orders/:id', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrder.mockResolvedValue({ id: 1, pollId: 12 });
  });

  it('ответственный видит категорию', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { id: 1 } });
  });

  it('участник категории видит категорию', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('посторонний — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: OUTSIDER, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('глобальный админ видит любую категорию', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getCategoryOrder.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/category-orders/:id/order-items', () => {
  const body = { userId: 2, itemName: '  Плов  ', price: 450, notes: '  без лука ' };

  beforeEach(() => {
    calculations.saveOrderItem.mockResolvedValue({ id: 7 });
  });

  it('ответственный вписывает позицию участнику, строки обрезаются', async () => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(calculations.saveOrderItem).toHaveBeenCalledWith({
      categoryOrderId: 1,
      userId: 2,
      itemName: 'Плов',
      price: 450,
      notes: 'без лука',
      enteredBy: 1,
    });
    expect(res.body).toMatchObject({ success: true });
  });

  it('пустые заметки не сохраняются', async () => {
    await CategoryOrderController.saveOrderItem(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { ...body, notes: '   ' },
      }),
      mockResponse()
    );

    expect(calculations.saveOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ notes: undefined })
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['userId дробный', { userId: 1.5 }],
    ['userId ноль', { userId: 0 }],
    ['пустое название', { itemName: '   ' }],
    ['название не строка', { itemName: 42 }],
    ['цена ноль', { price: 0 }],
    ['цена отрицательная', { price: -10 }],
    ['цена не число', { price: 'дорого' }],
  ])('%s — 400 VALIDATION_ERROR', async (_label, override) => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { ...body, ...override },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(calculations.saveOrderItem).not.toHaveBeenCalled();
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не ответственный — 403, даже если он участник', async () => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: PARTICIPANT, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Only responsible user can edit order items',
    });
  });

  it('глобальный админ тоже не может вписывать суммы — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('позицию нельзя вписать тому, кто не участник категории — 403', async () => {
    categoryOrders.getParticipants.mockResolvedValue([1]);
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Order items can only be created for category participants',
    });
  });

  it('ошибка сервиса — 500', async () => {
    calculations.saveOrderItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('DELETE /api/order-items/:id', () => {
  beforeEach(() => {
    prismaMock.orderItem.findUnique.mockResolvedValue({
      categoryOrderId: 1,
    } as never);
    calculations.deleteOrderItem.mockResolvedValue(undefined);
  });

  it('ответственный удаляет позицию', async () => {
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(calculations.deleteOrderItem).toHaveBeenCalledWith(7);
    expect(res.body).toMatchObject({ message: 'Order item deleted' });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('позиции нет — 404', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('категория позиции исчезла — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не ответственный — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: PARTICIPANT, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(calculations.deleteOrderItem).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    calculations.deleteOrderItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/category-orders/:id/progress', () => {
  beforeEach(() => {
    calculations.getProgress.mockResolvedValue({ filled: 2, total: 3 });
  });

  it.each([
    ['ответственный', RESPONSIBLE],
    ['участник', PARTICIPANT],
    ['глобальный админ', GLOBAL_ADMIN],
  ])('%s видит прогресс', async (_label, user) => {
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ user, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: { filled: 2 } });
  });

  it('посторонний — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ user: OUTSIDER, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getProgress.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getProgress(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/category-orders/:id/participants', () => {
  beforeEach(() => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
    ] as never);
  });

  it('ответственный получает список участников', async () => {
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      select: { id: true, firstName: true, lastName: true, username: true },
    });
    expect(res.body).toMatchObject({ data: [{ id: 1 }] });
  });

  it('глобальный админ тоже получает', async () => {
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('участник (не ответственный) — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка базы — 500', async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/category-orders/:id/finalize', () => {
  beforeEach(() => {
    calculations.finalizeCalculation.mockResolvedValue({ transactions: 3 });
  });

  it('ответственный закрывает расчёт и создаёт долги', async () => {
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(calculations.finalizeCalculation).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({
      message: 'Calculation finalized and transactions created',
    });
  });

  it('участник — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(calculations.finalizeCalculation).not.toHaveBeenCalled();
  });

  it('глобальный админ — 403 (создание долгов не его право)', async () => {
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('падение расчёта — 500 с отдельным кодом', async () => {
    calculations.finalizeCalculation.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'FINALIZATION_ERROR' });
  });
});

describe('POST /api/category-orders/:id/volunteer', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrder.mockResolvedValue({ id: 1, pollId: 12 });
    prismaMock.user.findUnique.mockResolvedValue({
      telegramId: BigInt(555),
    } as never);
    responsibles.handleVolunteerForCategory.mockResolvedValue(true);
  });

  it('участник берёт категорию на себя', async () => {
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(responsibles.handleVolunteerForCategory).toHaveBeenCalledWith(
      1,
      BigInt(555)
    );
    expect(res.body).toMatchObject({ message: 'Volunteer request processed' });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('нет доступа к голосованию — 403; глобальный админ здесь не исключение', async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('пользователя нет в базе — 404', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('категория уже занята — 409', async () => {
    responsibles.handleVolunteerForCategory.mockResolvedValue(false);
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'VOLUNTEER_NOT_AVAILABLE' });
  });

  it('ошибка сервиса — 500', async () => {
    responsibles.handleVolunteerForCategory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('PUT /api/category-orders/:id/costs', () => {
  beforeEach(() => {
    categoryOrders.updateCosts.mockResolvedValue({ id: 1, deliveryCost: 300 });
  });

  it('ответственный задаёт доставку, сервис и чай', async () => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { deliveryCost: 300, serviceFee: 50, tip: 100, notes: '  спасибо ' },
      }),
      res
    );

    expect(categoryOrders.updateCosts).toHaveBeenCalledWith(1, {
      deliveryCost: 300,
      serviceFee: 50,
      tip: 100,
      notes: 'спасибо',
    });
    expect(res.body).toMatchObject({ success: true });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['пустая строка', ''],
  ])('стоимость %s означает «не менять»', async (_label, value) => {
    await CategoryOrderController.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { deliveryCost: value, serviceFee: value, tip: value },
      }),
      mockResponse()
    );

    expect(categoryOrders.updateCosts).toHaveBeenCalledWith(1, {
      deliveryCost: undefined,
      serviceFee: undefined,
      tip: undefined,
      notes: undefined,
    });
  });

  it('строковое число принимается', async () => {
    await CategoryOrderController.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { deliveryCost: '250' },
      }),
      mockResponse()
    );

    expect(categoryOrders.updateCosts).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ deliveryCost: 250 })
    );
  });

  it.each([
    ['deliveryCost', 'deliveryCost'],
    ['serviceFee', 'serviceFee'],
    ['tip', 'tip'],
  ])('отрицательный %s — 400 с названием поля', async (_label, field) => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { [field]: -1 },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      error: `${field} must be a non-negative number`,
    });
  });

  it('нечисловая стоимость — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { tip: 'много' },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({ params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не ответственный — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({ user: PARTICIPANT, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(categoryOrders.updateCosts).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.updateCosts.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/order-items/:id/edit-history', () => {
  beforeEach(() => {
    calculations.getEditHistory.mockResolvedValue([{ id: 1 }]);
  });

  it('глобальный админ видит историю правок', async () => {
    const res = mockResponse();

    await CategoryOrderController.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '7' } }),
      res
    );

    expect(calculations.getEditHistory).toHaveBeenCalledWith(7);
    expect(res.body).toMatchObject({ count: 1 });
  });

  it('ответственный — 403 (история только для админа)', async () => {
    const res = mockResponse();

    await CategoryOrderController.getEditHistory(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(calculations.getEditHistory).not.toHaveBeenCalled();
  });

  it('без аутентификации — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.getEditHistory(
      mockRequest({ params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getEditHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/category-orders/:id/order-items', () => {
  beforeEach(() => {
    calculations.getOrderItems.mockResolvedValue([{ id: 7 }, { id: 8 }]);
  });

  it('ответственный видит позиции', async () => {
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 2 });
  });

  it('глобальный админ видит позиции', async () => {
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('участник — 403', async () => {
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    prismaMock.categoryOrder.findUnique.mockResolvedValue(null);
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getOrderItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await CategoryOrderController.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});
