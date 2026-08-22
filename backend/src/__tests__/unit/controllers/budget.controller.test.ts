/**
 * Контроллер денег. Здесь ошибка доступа стоит дороже всего: пометить чужой
 * долг оплаченным или подтвердить чужой платёж — это списание реальных денег.
 * Поэтому у каждого мутирующего эндпоинта проверяется, что чужую транзакцию
 * трогать нельзя И что сервис при отказе не вызывается вовсе.
 */
import { BudgetController } from '../../../api/controllers/budget.controller';
import { BudgetService } from '../../../services/budget.service';
import { PollService } from '../../../services/poll.service';
import { GroupService } from '../../../services/group.service';
import { mockRequest, mockResponse } from '../../helpers/http';

jest.mock('../../../services/budget.service', () => ({
  BudgetService: { undoConfirmation: jest.fn() },
}));

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollGroupId: jest.fn() },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const budgetStatics = BudgetService as unknown as {
  undoConfirmation: jest.Mock;
};
const pollService = PollService as jest.Mocked<typeof PollService>;
const groupService = GroupService as jest.Mocked<typeof GroupService>;

/** Экземпляр сервиса, который контроллер получает через конструктор. */
function serviceStub() {
  return {
    markAsPaid: jest.fn(),
    confirmPayment: jest.fn(),
    cancelMarkAsPaid: jest.fn(),
    markAllPaidByResponsible: jest.fn(),
  };
}

/** Order-costs — отдельный сервис, отдельный аргумент конструктора. */
function orderCostsServiceStub() {
  return {
    setOrderCosts: jest.fn(),
    getOrderCosts: jest.fn(),
    getPollCostBreakdown: jest.fn(),
  };
}

/** Напоминания — тоже отдельный сервис. */
function reminderServiceStub() {
  return {
    sendReminder: jest.fn(),
    sendRemindersToAll: jest.fn(),
  };
}

/** Query-сервис — чтения долгов/кредитов/статистики/транзакции по id. */
function queryServiceStub() {
  return {
    getUserDebts: jest.fn(),
    getUserCredits: jest.fn(),
    getTransactionById: jest.fn(),
    getUserStats: jest.fn(),
  };
}

/** Poll-flow — создание транзакций из голосования, тут только calculateTotals. */
function pollFlowServiceStub() {
  return {
    calculateTotals: jest.fn(),
  };
}

let service: ReturnType<typeof serviceStub>;
let orderCostsService: ReturnType<typeof orderCostsServiceStub>;
let reminderService: ReturnType<typeof reminderServiceStub>;
let queryService: ReturnType<typeof queryServiceStub>;
let pollFlowService: ReturnType<typeof pollFlowServiceStub>;
let controller: BudgetController;

const DEBTOR = { id: 1, isAdmin: false };
const CREDITOR = { id: 2, isAdmin: false };

beforeEach(() => {
  jest.clearAllMocks();
  service = serviceStub();
  orderCostsService = orderCostsServiceStub();
  reminderService = reminderServiceStub();
  queryService = queryServiceStub();
  pollFlowService = pollFlowServiceStub();
  controller = new BudgetController(
    service,
    orderCostsService,
    reminderService as unknown as ConstructorParameters<typeof BudgetController>[2],
    queryService as unknown as ConstructorParameters<typeof BudgetController>[3],
    pollFlowService
  );
  pollService.getPollGroupId.mockResolvedValue(100);
  groupService.isUserGroupMember.mockResolvedValue(true);
});

describe('GET /api/budget/debts', () => {
  it('отдаёт долги по id из токена, а не из запроса', async () => {
    queryService.getUserDebts.mockResolvedValue([{ id: 1, amount: 500 }]);
    const res = mockResponse();

    await controller.getDebts(
      mockRequest({ user: DEBTOR, query: { userId: '999' } }),
      res
    );

    expect(queryService.getUserDebts).toHaveBeenCalledWith(1, undefined, false);
    expect(res.body).toMatchObject({ success: true, data: [{ id: 1 }] });
  });

  it('передаёт фильтры статуса и активности', async () => {
    queryService.getUserDebts.mockResolvedValue([]);

    await controller.getDebts(
      mockRequest({
        user: DEBTOR,
        query: { status: 'PENDING', activeOnly: 'true' },
      }),
      mockResponse()
    );

    expect(queryService.getUserDebts).toHaveBeenCalledWith(1, 'PENDING', true);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getDebts(mockRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(queryService.getUserDebts).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    queryService.getUserDebts.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getDebts(mockRequest({ user: DEBTOR }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/budget/credits', () => {
  it('отдаёт кредиты по id из токена', async () => {
    queryService.getUserCredits.mockResolvedValue([{ id: 5 }]);
    const res = mockResponse();

    await controller.getCredits(mockRequest({ user: CREDITOR }), res);

    expect(queryService.getUserCredits).toHaveBeenCalledWith(2, undefined, false);
    expect(res.body).toMatchObject({ success: true });
  });

  it('передаёт фильтры', async () => {
    queryService.getUserCredits.mockResolvedValue([]);

    await controller.getCredits(
      mockRequest({
        user: CREDITOR,
        query: { status: 'CONFIRMED', activeOnly: 'true' },
      }),
      mockResponse()
    );

    expect(queryService.getUserCredits).toHaveBeenCalledWith(2, 'CONFIRMED', true);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getCredits(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    queryService.getUserCredits.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getCredits(mockRequest({ user: CREDITOR }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/mark-paid', () => {
  beforeEach(() => {
    queryService.getTransactionById.mockResolvedValue({
      id: 7,
      fromUserId: 1,
      toUserId: 2,
    });
  });

  it('должник помечает свой долг оплаченным', async () => {
    const res = mockResponse();

    await controller.markAsPaid(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(service.markAsPaid).toHaveBeenCalledWith(7, 1);
    expect(res.body).toEqual({ success: true });
  });

  it('чужой долг помечать нельзя — 403 и сервис не вызывается', async () => {
    const res = mockResponse();

    await controller.markAsPaid(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.markAsPaid).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.markAsPaid(mockRequest({ body: { transactionId: 7 } }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['строка вместо числа', { transactionId: '7' }],
    ['ноль', { transactionId: 0 }],
    ['отрицательный', { transactionId: -1 }],
    ['дробный', { transactionId: 1.5 }],
    ['пустое тело', {}],
  ])('%s — 400 VALIDATION_ERROR', async (_label, body) => {
    const res = mockResponse();

    await controller.markAsPaid(mockRequest({ user: DEBTOR, body }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('транзакции нет — 404', async () => {
    queryService.getTransactionById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.markAsPaid(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    service.markAsPaid.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.markAsPaid(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/confirm-payment', () => {
  beforeEach(() => {
    queryService.getTransactionById.mockResolvedValue({
      id: 7,
      fromUserId: 1,
      toUserId: 2,
    });
  });

  it('получатель подтверждает платёж в свой адрес', async () => {
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(service.confirmPayment).toHaveBeenCalledWith(7, 2);
    expect(res.body).toEqual({ success: true });
  });

  it('должник не может подтвердить платёж за получателя — 403', async () => {
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.confirmPayment).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидное тело — 400', async () => {
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ user: CREDITOR, body: { transactionId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('транзакции нет — 404', async () => {
    queryService.getTransactionById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    service.confirmPayment.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.confirmPayment(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/undo-confirmation', () => {
  beforeEach(() => {
    queryService.getTransactionById.mockResolvedValue({
      id: 7,
      fromUserId: 1,
      toUserId: 2,
    });
    budgetStatics.undoConfirmation.mockResolvedValue(undefined);
  });

  it('получатель отменяет своё подтверждение', async () => {
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(budgetStatics.undoConfirmation).toHaveBeenCalledWith(7, 2);
    expect(res.body).toEqual({ success: true });
  });

  it('должник отменить подтверждение не может — 403', async () => {
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(budgetStatics.undoConfirmation).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидное тело — 400', async () => {
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('транзакции нет — 404', async () => {
    queryService.getTransactionById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('окно отмены истекло — 409 UNDO_WINDOW_EXPIRED', async () => {
    budgetStatics.undoConfirmation.mockRejectedValue(
      new Error('Undo window has expired')
    );
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'UNDO_WINDOW_EXPIRED' });
  });

  it.each([
    'Only a confirmed payment can be undone',
    'Transaction state changed',
  ])('«%s» — 409 WRONG_STATUS', async message => {
    budgetStatics.undoConfirmation.mockRejectedValue(new Error(message));
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'WRONG_STATUS' });
  });

  it('прочая ошибка — 500', async () => {
    budgetStatics.undoConfirmation.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.undoConfirmation(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/cancel-mark', () => {
  beforeEach(() => {
    queryService.getTransactionById.mockResolvedValue({
      id: 7,
      fromUserId: 1,
      toUserId: 2,
    });
  });

  it('должник снимает свою отметку об оплате', async () => {
    const res = mockResponse();

    await controller.cancelMark(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(service.cancelMarkAsPaid).toHaveBeenCalledWith(7, 1);
    expect(res.body).toEqual({ success: true });
  });

  it('чужую отметку снять нельзя — 403', async () => {
    const res = mockResponse();

    await controller.cancelMark(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(service.cancelMarkAsPaid).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.cancelMark(mockRequest({ body: { transactionId: 7 } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидное тело — 400', async () => {
    const res = mockResponse();

    await controller.cancelMark(mockRequest({ user: DEBTOR, body: {} }), res);

    expect(res.statusCode).toBe(400);
  });

  it('транзакции нет — 404', async () => {
    queryService.getTransactionById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.cancelMark(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    service.cancelMarkAsPaid.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.cancelMark(
      mockRequest({ user: DEBTOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/mark-all-paid', () => {
  it('сборщик закрывает все долги по заказу', async () => {
    const res = mockResponse();

    await controller.markAllPaid(
      mockRequest({ user: CREDITOR, body: { pollId: 12 } }),
      res
    );

    expect(service.markAllPaidByResponsible).toHaveBeenCalledWith(12, 2);
    expect(res.body).toEqual({ success: true });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.markAllPaid(mockRequest({ body: { pollId: 12 } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидный pollId — 400 с человеческим описанием', async () => {
    const res = mockResponse();

    await controller.markAllPaid(
      mockRequest({ user: CREDITOR, body: { pollId: 0 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      error: expect.stringContaining('pollId'),
    });
  });

  it('ошибка сервиса — 500', async () => {
    service.markAllPaidByResponsible.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.markAllPaid(
      mockRequest({ user: CREDITOR, body: { pollId: 12 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/budget/stats', () => {
  it('без диапазона дат передаёт undefined', async () => {
    queryService.getUserStats.mockResolvedValue({ paid: 0 });

    await controller.getStats(mockRequest({ user: DEBTOR }), mockResponse());

    expect(queryService.getUserStats).toHaveBeenCalledWith(1, undefined, undefined);
  });

  it('диапазон дат превращается в Date', async () => {
    queryService.getUserStats.mockResolvedValue({ paid: 0 });

    await controller.getStats(
      mockRequest({
        user: DEBTOR,
        query: { from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' },
      }),
      mockResponse()
    );

    expect(queryService.getUserStats).toHaveBeenCalledWith(
      1,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-01T00:00:00.000Z')
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getStats(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    queryService.getUserStats.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getStats(mockRequest({ user: DEBTOR }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/send-reminder', () => {
  it('отправляет напоминание по транзакции', async () => {
    const res = mockResponse();

    await controller.sendReminder(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(reminderService.sendReminder).toHaveBeenCalledWith(7, 2);
    expect(res.body).toMatchObject({ success: true, message: 'Reminder sent' });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.sendReminder(
      mockRequest({ body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидное тело — 400', async () => {
    const res = mockResponse();

    await controller.sendReminder(mockRequest({ user: CREDITOR, body: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('ошибка сервиса — 500', async () => {
    reminderService.sendReminder.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.sendReminder(
      mockRequest({ user: CREDITOR, body: { transactionId: 7 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/send-reminders-all', () => {
  it('возвращает счётчики доставки', async () => {
    reminderService.sendRemindersToAll.mockResolvedValue({
      sentCount: 2,
      failedCount: 1,
      totalCount: 3,
      failedUsers: [{ id: 9 }],
    });
    const res = mockResponse();

    await controller.sendRemindersAll(
      mockRequest({ user: CREDITOR, body: { pollId: 12 } }),
      res
    );

    expect(res.body).toMatchObject({
      success: true,
      sentCount: 2,
      failedCount: 1,
      totalCount: 3,
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.sendRemindersAll(
      mockRequest({ body: { pollId: 12 } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('без pollId — 400', async () => {
    const res = mockResponse();

    await controller.sendRemindersAll(
      mockRequest({ user: CREDITOR, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(reminderService.sendRemindersToAll).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    reminderService.sendRemindersToAll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.sendRemindersAll(
      mockRequest({ user: CREDITOR, body: { pollId: 12 } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/budget/poll-totals/:pollId', () => {
  it('участник группы получает итоги заказа', async () => {
    pollFlowService.calculateTotals.mockResolvedValue({ total: 1500 });
    const res = mockResponse();

    await controller.getPollTotals(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(pollFlowService.calculateTotals).toHaveBeenCalledWith(12, 1);
    expect(res.body).toMatchObject({ data: { total: 1500 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getPollTotals(mockRequest({ params: { pollId: '12' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('без pollId — 400', async () => {
    const res = mockResponse();

    await controller.getPollTotals(mockRequest({ user: DEBTOR }), res);

    expect(res.statusCode).toBe(400);
  });

  it('голосования нет — 404', async () => {
    pollService.getPollGroupId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getPollTotals(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'POLL_NOT_FOUND' });
  });

  it('не участник группы заказа — 403 (anti-IDOR)', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollTotals(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(pollFlowService.calculateTotals).not.toHaveBeenCalled();
  });

  /* Прежде здесь глобальный флаг открывал бюджет любой группы. Понятия
     глобального администратора больше нет: членство проверяется всегда, и
     чужой человек с любым флагом получает 403. */
  it('членство проверяется даже у того, кто прежде был глобальным админом', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollTotals(
      mockRequest({ user: { id: 9, isAdmin: true }, params: { pollId: '12' } }),
      res
    );

    expect(groupService.isUserGroupMember).toHaveBeenCalledWith(9, 100);
    expect(res.statusCode).toBe(403);
    expect(pollFlowService.calculateTotals).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    pollFlowService.calculateTotals.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollTotals(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('POST /api/budget/order-costs/:pollId', () => {
  const body = { deliveryCost: 300, serviceFee: 50, tip: 100, notes: 'самовывоз' };

  it('ответственный задаёт стоимости заказа', async () => {
    orderCostsService.setOrderCosts.mockResolvedValue({ id: 1, ...body });
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({ user: CREDITOR, params: { pollId: '12' }, body }),
      res
    );

    expect(orderCostsService.setOrderCosts).toHaveBeenCalledWith(12, 2, body);
    expect(res.body).toMatchObject({ success: true });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({ params: { pollId: '12' }, body }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('без pollId — 400', async () => {
    const res = mockResponse();

    await controller.setOrderCosts(mockRequest({ user: CREDITOR, body }), res);

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['deliveryCost строкой', { deliveryCost: '300' }],
    ['deliveryCost отрицательный', { deliveryCost: -1 }],
    ['serviceFee строкой', { serviceFee: '50' }],
    ['serviceFee отрицательный', { serviceFee: -1 }],
    ['tip строкой', { tip: '100' }],
    ['tip отрицательный', { tip: -1 }],
  ])('%s — 400', async (_label, override) => {
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({
        user: CREDITOR,
        params: { pollId: '12' },
        body: { ...body, ...override },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(orderCostsService.setOrderCosts).not.toHaveBeenCalled();
  });

  it('голосования нет — 404', async () => {
    orderCostsService.setOrderCosts.mockRejectedValue(new Error('Poll not found'));
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({ user: CREDITOR, params: { pollId: '12' }, body }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не ответственный — 403', async () => {
    orderCostsService.setOrderCosts.mockRejectedValue(
      new Error('Only responsible person can set order costs')
    );
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({ user: CREDITOR, params: { pollId: '12' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('прочая ошибка — 500', async () => {
    orderCostsService.setOrderCosts.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.setOrderCosts(
      mockRequest({ user: CREDITOR, params: { pollId: '12' }, body }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/budget/order-costs/:pollId', () => {
  it('отдаёт стоимости заказа участнику группы', async () => {
    orderCostsService.getOrderCosts.mockResolvedValue({ id: 1, deliveryCost: 300 });
    const res = mockResponse();

    await controller.getOrderCosts(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { deliveryCost: 300 } });
  });

  it('стоимости не заданы — 404', async () => {
    orderCostsService.getOrderCosts.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getOrderCosts(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getOrderCosts(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('без pollId — 400', async () => {
    const res = mockResponse();

    await controller.getOrderCosts(mockRequest({ user: DEBTOR }), res);

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getOrderCosts(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(orderCostsService.getOrderCosts).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    orderCostsService.getOrderCosts.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getOrderCosts(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/budget/poll-breakdown/:pollId', () => {
  it('отдаёт разбивку по участникам', async () => {
    orderCostsService.getPollCostBreakdown.mockResolvedValue([{ userId: 1, amount: 500 }]);
    const res = mockResponse();

    await controller.getPollCostBreakdown(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ data: [{ userId: 1, amount: 500 }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getPollCostBreakdown(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('без pollId — 400', async () => {
    const res = mockResponse();

    await controller.getPollCostBreakdown(mockRequest({ user: DEBTOR }), res);

    expect(res.statusCode).toBe(400);
  });

  it('не участник — 403', async () => {
    groupService.isUserGroupMember.mockResolvedValue(false);
    const res = mockResponse();

    await controller.getPollCostBreakdown(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('ошибка сервиса — 500', async () => {
    orderCostsService.getPollCostBreakdown.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getPollCostBreakdown(
      mockRequest({ user: DEBTOR, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
  });
});
