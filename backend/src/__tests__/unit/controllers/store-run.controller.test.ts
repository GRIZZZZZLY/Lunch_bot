/**
 * Забег в магазин. Контроллер тонкий, но два свойства критичны:
 * доменная ошибка сервиса обязана превращаться в осмысленный HTTP-код
 * (404/403/409, а не 500), и рассылки уведомлений идут fire-and-forget —
 * их падение не должно валить ответ пользователю.
 */
import { StoreRunController } from '../../../api/controllers/store-run.controller';
import { StoreRunService } from '../../../services/store-run.service';
import { notificationService } from '../../../services/notification.service';
import { StoreRunBudgetService } from '../../../services/store-run-budget.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../services/store-run.service', () => {
  class StoreRunError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
      this.name = 'StoreRunError';
    }
  }

  return {
    StoreRunError,
    StoreRunService: {
      createStoreRun: jest.fn(),
      getActiveStoreRunsForUser: jest.fn(),
      getStoreRunById: jest.fn(),
      addItemsBulk: jest.fn(),
      updateItem: jest.fn(),
      deleteItem: jest.fn(),
      setItemPrice: jest.fn(),
      startShopping: jest.fn(),
      settle: jest.fn(),
      cancelStoreRun: jest.fn(),
    },
  };
});

jest.mock('../../../services/notification.service', () => ({
  notificationService: {
    botCanPostToGroup: jest.fn(),
    notifyGroupMembersAboutStoreRun: jest.fn(),
    postStoreRunToGroup: jest.fn(),
    notifyShoppingStarted: jest.fn(),
    notifyStoreRunParticipantsNoDebt: jest.fn(),
    markStoreRunGroupCompleted: jest.fn(),
    deleteStoreRunMessages: jest.fn(),
  },
}));

jest.mock('../../../services/store-run-budget.service', () => ({
  StoreRunBudgetService: { notifyStoreRunSettled: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  StoreRunError,
}: { StoreRunError: new (code: string, message: string) => Error } =
  jest.requireMock('../../../services/store-run.service');

const storeRunService = asServiceMock(StoreRunService);
const notifications = notificationService as unknown as Record<string, jest.Mock>;
const budgetStatics = StoreRunBudgetService as unknown as Record<string, jest.Mock>;

const USER = { id: 1 };
const controller = new StoreRunController();

/** Все fire-and-forget рассылки по умолчанию успешны. */
beforeEach(() => {
  jest.clearAllMocks();
  notifications.botCanPostToGroup.mockResolvedValue(true);
  notifications.notifyGroupMembersAboutStoreRun.mockResolvedValue([
    { success: true },
  ]);
  notifications.postStoreRunToGroup.mockResolvedValue(undefined);
  notifications.notifyShoppingStarted.mockResolvedValue(undefined);
  notifications.notifyStoreRunParticipantsNoDebt.mockResolvedValue(undefined);
  notifications.markStoreRunGroupCompleted.mockResolvedValue(undefined);
  notifications.deleteStoreRunMessages.mockResolvedValue(undefined);
  budgetStatics.notifyStoreRunSettled.mockResolvedValue(undefined);
});

describe('POST /api/store-runs', () => {
  const body = { groupId: 100, storeName: 'Магнит', collectMinutes: 10 };

  beforeEach(() => {
    storeRunService.createStoreRun.mockResolvedValue({ id: 5 });
  });

  it('создаёт забег и рассылает приглашения', async () => {
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);

    expect(storeRunService.createStoreRun).toHaveBeenCalledWith({
      initiatorId: 1,
      groupId: 100,
      storeName: 'Магнит',
      collectMinutes: 10,
    });
    expect(res.statusCode).toBe(201);
    expect(notifications.notifyGroupMembersAboutStoreRun).toHaveBeenCalledWith(5);
    expect(notifications.postStoreRunToGroup).toHaveBeenCalledWith(5);
  });

  it('бота нет в группе — 409 BOT_NOT_IN_GROUP', async () => {
    notifications.botCanPostToGroup.mockResolvedValue(false);
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'BOT_NOT_IN_GROUP' });
    expect(storeRunService.createStoreRun).not.toHaveBeenCalled();
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ body }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['groupId строкой', { groupId: '100' }],
    ['пустое имя магазина', { storeName: '' }],
    ['имя магазина длиннее 100', { storeName: 'м'.repeat(101) }],
    ['сбор меньше 3 минут', { collectMinutes: 2 }],
    ['сбор больше 30 минут', { collectMinutes: 31 }],
  ])('%s — 400', async (_label, override) => {
    const res = mockResponse();

    await controller.createStoreRun(
      mockRequest({ user: USER, body: { ...body, ...override } }),
      res
    );

    expect(res.statusCode).toBe(400);
    /* Раньше ответ был `{ error: 'Invalid input', issues }` — без `code`, то
       есть фронт не мог выбрать по нему текст. Теперь форма та же, что у
       остальных маршрутов, и проверяется код плюс поле, а не английская фраза. */
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ field: Object.keys(override)[0] })],
    });
  });

  it('уже есть активный забег — 409', async () => {
    storeRunService.createStoreRun.mockRejectedValue(
      new StoreRunError('ACTIVE_RUN_EXISTS', 'Забег уже идёт')
    );
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(409);
  });

  it('неизвестная ошибка — 500', async () => {
    storeRunService.createStoreRun.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(500);
  });

  it('падение рассылки не влияет на ответ', async () => {
    notifications.notifyGroupMembersAboutStoreRun.mockRejectedValue(
      new Error('dm failed')
    );
    notifications.postStoreRunToGroup.mockRejectedValue(new Error('post failed'));
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);

    expect(res.statusCode).toBe(201);
  });

  it('ни одно приглашение не доставлено — предупреждение в лог, ответ успешный', async () => {
    const { logger } = jest.requireMock('../../../utils/logger');
    notifications.notifyGroupMembersAboutStoreRun.mockResolvedValue([
      { success: false },
      { success: false },
    ]);
    const res = mockResponse();

    await controller.createStoreRun(mockRequest({ user: USER, body }), res);
    await Promise.resolve();

    expect(res.statusCode).toBe(201);
    expect(logger.warn).toHaveBeenCalledWith(
      'Store run created but no DMs were delivered',
      expect.objectContaining({ storeRunId: 5, attempted: 2 })
    );
  });
});

describe('GET /api/store-runs/active', () => {
  it('отдаёт активные забеги пользователя', async () => {
    storeRunService.getActiveStoreRunsForUser.mockResolvedValue([
      { id: 5 },
    ] as never);
    const res = mockResponse();

    await controller.getActiveForUser(mockRequest({ user: USER }), res);

    expect(storeRunService.getActiveStoreRunsForUser).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({ success: true, data: [{ id: 5 }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getActiveForUser(mockRequest(), res);

    expect(res.statusCode).toBe(401);
  });

  it('ошибка сервиса — 500', async () => {
    storeRunService.getActiveStoreRunsForUser.mockRejectedValue(
      new Error('boom')
    );
    const res = mockResponse();

    await controller.getActiveForUser(mockRequest({ user: USER }), res);

    expect(res.statusCode).toBe(500);
  });
});

describe('GET /api/store-runs/:id', () => {
  it('отдаёт забег участнику', async () => {
    storeRunService.getStoreRunById.mockResolvedValue({ id: 5 });
    const res = mockResponse();

    await controller.getStoreRun(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(storeRunService.getStoreRunById).toHaveBeenCalledWith(5, 1);
    expect(res.body).toMatchObject({ data: { id: 5 } });
  });

  it('забега нет — 404', async () => {
    storeRunService.getStoreRunById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getStoreRun(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getStoreRun(mockRequest({ params: { id: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['нечисловой', 'нет'],
    ['ноль', '0'],
    ['отрицательный', '-1'],
    ['дробный', '1.5'],
  ])('%s id — 400', async (_label, id) => {
    const res = mockResponse();

    await controller.getStoreRun(mockRequest({ user: USER, params: { id } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('нет доступа к забегу — 403', async () => {
    storeRunService.getStoreRunById.mockRejectedValue(
      new StoreRunError('FORBIDDEN', 'Нет доступа')
    );
    const res = mockResponse();

    await controller.getStoreRun(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/store-runs/:id/items', () => {
  const body = { items: [{ name: 'Молоко', quantity: 2, notes: '2.5%' }] };

  it('добавляет позиции списком', async () => {
    storeRunService.addItemsBulk.mockResolvedValue([{ id: 1 }] as never);
    const res = mockResponse();

    await controller.addItems(
      mockRequest({ user: USER, params: { id: '5' }, body }),
      res
    );

    expect(storeRunService.addItemsBulk).toHaveBeenCalledWith(5, 1, body.items);
    expect(res.statusCode).toBe(201);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.addItems(mockRequest({ params: { id: '5' }, body }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидный id — 400', async () => {
    const res = mockResponse();

    await controller.addItems(
      mockRequest({ user: USER, params: { id: 'нет' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'INVALID_ID',
      errors: [expect.objectContaining({ field: 'id' })],
    });
  });

  it.each([
    ['пустой список', { items: [] }],
    ['больше 20 позиций', { items: Array.from({ length: 21 }, () => ({ name: 'x' })) }],
    ['позиция без имени', { items: [{ name: '' }] }],
    ['количество ноль', { items: [{ name: 'x', quantity: 0 }] }],
    ['количество больше 99', { items: [{ name: 'x', quantity: 100 }] }],
  ])('%s — 400', async (_label, invalidBody) => {
    const res = mockResponse();

    await controller.addItems(
      mockRequest({ user: USER, params: { id: '5' }, body: invalidBody }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(storeRunService.addItemsBulk).not.toHaveBeenCalled();
  });

  it('забег уже не в статусе сбора — 409', async () => {
    storeRunService.addItemsBulk.mockRejectedValue(
      new StoreRunError('WRONG_STATUS', 'Сбор закрыт')
    );
    const res = mockResponse();

    await controller.addItems(
      mockRequest({ user: USER, params: { id: '5' }, body }),
      res
    );

    expect(res.statusCode).toBe(409);
  });
});

describe('PATCH /api/store-runs/:id/items/:itemId', () => {
  it('правит позицию', async () => {
    storeRunService.updateItem.mockResolvedValue({ id: 9 });
    const res = mockResponse();

    await controller.updateItem(
      mockRequest({
        user: USER,
        params: { id: '5', itemId: '9' },
        body: { name: 'Кефир' },
      }),
      res
    );

    expect(storeRunService.updateItem).toHaveBeenCalledWith(9, 1, {
      name: 'Кефир',
    });
    expect(res.body).toMatchObject({ data: { id: 9 } });
  });

  it('notes можно очистить через null', async () => {
    storeRunService.updateItem.mockResolvedValue({ id: 9 });

    await controller.updateItem(
      mockRequest({
        user: USER,
        params: { id: '5', itemId: '9' },
        body: { notes: null },
      }),
      mockResponse()
    );

    expect(storeRunService.updateItem).toHaveBeenCalledWith(9, 1, {
      notes: null,
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.updateItem(
      mockRequest({ params: { id: '5', itemId: '9' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидный itemId — 400', async () => {
    const res = mockResponse();

    await controller.updateItem(
      mockRequest({ user: USER, params: { id: '5', itemId: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      code: 'INVALID_ID',
      errors: [expect.objectContaining({ field: 'itemId' })],
    });
  });

  it('слишком длинное имя — 400', async () => {
    const res = mockResponse();

    await controller.updateItem(
      mockRequest({
        user: USER,
        params: { id: '5', itemId: '9' },
        body: { name: 'x'.repeat(201) },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('чужая позиция — 403', async () => {
    storeRunService.updateItem.mockRejectedValue(
      new StoreRunError('FORBIDDEN', 'Не твоя позиция')
    );
    const res = mockResponse();

    await controller.updateItem(
      mockRequest({ user: USER, params: { id: '5', itemId: '9' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/store-runs/:id/items/:itemId', () => {
  it('удаляет позицию и отвечает 204 без тела', async () => {
    storeRunService.deleteItem.mockResolvedValue(undefined);
    const res = mockResponse();

    await controller.deleteItem(
      mockRequest({ user: USER, params: { id: '5', itemId: '9' } }),
      res
    );

    expect(storeRunService.deleteItem).toHaveBeenCalledWith(9, 1);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.deleteItem(
      mockRequest({ params: { id: '5', itemId: '9' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидный itemId — 400', async () => {
    const res = mockResponse();

    await controller.deleteItem(
      mockRequest({ user: USER, params: { id: '5', itemId: '0' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('позиции нет — 404', async () => {
    storeRunService.deleteItem.mockRejectedValue(
      new StoreRunError('NOT_FOUND', 'Позиция не найдена')
    );
    const res = mockResponse();

    await controller.deleteItem(
      mockRequest({ user: USER, params: { id: '5', itemId: '9' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/store-runs/:id/items/:itemId/price', () => {
  const body = { price: 120.5, status: 'BOUGHT' };

  it('инициатор проставляет цену', async () => {
    storeRunService.setItemPrice.mockResolvedValue({ id: 9 });
    const res = mockResponse();

    await controller.setItemPrice(
      mockRequest({ user: USER, params: { id: '5', itemId: '9' }, body }),
      res
    );

    expect(storeRunService.setItemPrice).toHaveBeenCalledWith(
      9,
      1,
      120.5,
      'BOUGHT'
    );
    expect(res.body).toMatchObject({ success: true });
  });

  it('не нашли товар — цена null со статусом NOT_FOUND', async () => {
    storeRunService.setItemPrice.mockResolvedValue({ id: 9 });

    await controller.setItemPrice(
      mockRequest({
        user: USER,
        params: { id: '5', itemId: '9' },
        body: { price: null, status: 'NOT_FOUND' },
      }),
      mockResponse()
    );

    expect(storeRunService.setItemPrice).toHaveBeenCalledWith(
      9,
      1,
      null,
      'NOT_FOUND'
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.setItemPrice(
      mockRequest({ params: { id: '5', itemId: '9' }, body }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('невалидный itemId — 400', async () => {
    const res = mockResponse();

    await controller.setItemPrice(
      mockRequest({ user: USER, params: { id: '5', itemId: 'нет' }, body }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['отрицательная цена', { price: -1, status: 'BOUGHT' }],
    ['цена больше 100000', { price: 100001, status: 'BOUGHT' }],
    ['неизвестный статус', { price: 10, status: 'MAYBE' }],
    ['без статуса', { price: 10 }],
  ])('%s — 400', async (_label, invalidBody) => {
    const res = mockResponse();

    await controller.setItemPrice(
      mockRequest({
        user: USER,
        params: { id: '5', itemId: '9' },
        body: invalidBody,
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(storeRunService.setItemPrice).not.toHaveBeenCalled();
  });

  it('не инициатор — 403', async () => {
    storeRunService.setItemPrice.mockRejectedValue(
      new StoreRunError('FORBIDDEN', 'Только инициатор')
    );
    const res = mockResponse();

    await controller.setItemPrice(
      mockRequest({ user: USER, params: { id: '5', itemId: '9' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/store-runs/:id/start-shopping', () => {
  it('переводит забег в закупку и уведомляет участников', async () => {
    storeRunService.startShopping.mockResolvedValue({ id: 5 });
    const res = mockResponse();

    await controller.startShopping(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(storeRunService.startShopping).toHaveBeenCalledWith(5, 1);
    expect(notifications.notifyShoppingStarted).toHaveBeenCalledWith(5);
    expect(res.body).toMatchObject({ success: true });
  });

  it('падение уведомления не влияет на ответ', async () => {
    storeRunService.startShopping.mockResolvedValue({ id: 5 });
    notifications.notifyShoppingStarted.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.startShopping(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.startShopping(mockRequest({ params: { id: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидный id — 400', async () => {
    const res = mockResponse();

    await controller.startShopping(
      mockRequest({ user: USER, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('неверный статус забега — 409', async () => {
    storeRunService.startShopping.mockRejectedValue(
      new StoreRunError('WRONG_STATUS', 'Уже в магазине')
    );
    const res = mockResponse();

    await controller.startShopping(
      mockRequest({ user: USER, params: { id: '5' } }),
      res
    );

    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/store-runs/:id/settle', () => {
  beforeEach(() => {
    storeRunService.settle.mockResolvedValue({ id: 5 });
  });

  it('закрывает забег и запускает все три рассылки', async () => {
    const res = mockResponse();

    await controller.settle(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(storeRunService.settle).toHaveBeenCalledWith(5, 1);
    expect(budgetStatics.notifyStoreRunSettled).toHaveBeenCalledWith(5);
    expect(notifications.notifyStoreRunParticipantsNoDebt).toHaveBeenCalledWith(5);
    expect(notifications.markStoreRunGroupCompleted).toHaveBeenCalledWith(5);
    expect(res.body).toMatchObject({ success: true });
  });

  it('падение любой рассылки не отменяет расчёт', async () => {
    budgetStatics.notifyStoreRunSettled.mockRejectedValue(new Error('a'));
    notifications.notifyStoreRunParticipantsNoDebt.mockRejectedValue(new Error('b'));
    notifications.markStoreRunGroupCompleted.mockRejectedValue(new Error('c'));
    const res = mockResponse();

    await controller.settle(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.settle(mockRequest({ params: { id: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидный id — 400', async () => {
    const res = mockResponse();

    await controller.settle(mockRequest({ user: USER, params: { id: 'нет' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('не инициатор — 403', async () => {
    storeRunService.settle.mockRejectedValue(
      new StoreRunError('FORBIDDEN', 'Только инициатор')
    );
    const res = mockResponse();

    await controller.settle(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/store-runs/:id/cancel', () => {
  beforeEach(() => {
    storeRunService.cancelStoreRun.mockResolvedValue({ id: 5 });
  });

  it('отменяет забег и убирает сообщения', async () => {
    const res = mockResponse();

    await controller.cancel(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(storeRunService.cancelStoreRun).toHaveBeenCalledWith(5, 1);
    expect(notifications.deleteStoreRunMessages).toHaveBeenCalledWith(5);
    expect(res.body).toMatchObject({ success: true });
  });

  it('падение удаления сообщений не влияет на ответ', async () => {
    notifications.deleteStoreRunMessages.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.cancel(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.cancel(mockRequest({ params: { id: '5' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('невалидный id — 400', async () => {
    const res = mockResponse();

    await controller.cancel(mockRequest({ user: USER, params: { id: '0' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('забега нет — 404', async () => {
    storeRunService.cancelStoreRun.mockRejectedValue(
      new StoreRunError('NOT_FOUND', 'Нет забега')
    );
    const res = mockResponse();

    await controller.cancel(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('прочий код ошибки — 400', async () => {
    storeRunService.cancelStoreRun.mockRejectedValue(
      new StoreRunError('VALIDATION', 'Неверные данные')
    );
    const res = mockResponse();

    await controller.cancel(mockRequest({ user: USER, params: { id: '5' } }), res);

    expect(res.statusCode).toBe(400);
  });
});
