/**
 * Что именно увидит клиент, когда handler отдал ошибку через `next(err)`.
 *
 * Тесты контроллера доказывают только то, что ошибка не съедена и ушла в
 * `next`. Этого недостаточно: задача 03 прямо предупреждает, что перевод
 * `catch` на `next(err)` может ПОМЕНЯТЬ статус, и «не 200» такого не заметит.
 * Поэтому здесь handler и `errorHandler` соединены в цепочку, как в приложении,
 * и проверяется конкретный ответ — статус, код и legacy-поля, на которые
 * опирается фронт.
 *
 * Переведены только те catch-блоки, которые и раньше отдавали ровно
 * `500 INTERNAL_ERROR`. Но «значит статус измениться не может» — НЕВЕРНО, и
 * это выяснилось только на ревью: `errorHandler` распознаёт известные ошибки
 * Prisma и отдаёт им 409/404. Для обычной ошибки ответ прежний, для
 * Prisma-ошибки — осмысленнее прежнего; закреплено оба случая, вторым
 * describe ниже.
 */
import { CategoryOrderController } from '../../../api/controllers/category-order.controller';
import { errorHandler } from '../../../api/middleware/error-handler';
import { CategoryOrderService } from '../../../services/category-order.service';
import { mockRequest, mockResponse } from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {
    getCategoryOrdersForPoll: jest.fn(),
    getCategoryOrder: jest.fn(),
    getParticipants: jest.fn(),
    getResponsibleUserId: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const categoryOrders = asServiceMock(CategoryOrderService);

const USER = { id: 1, isAdmin: false };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ошибка из handler доходит до клиента тем же ответом', () => {
  it('сбой сервиса — 500 INTERNAL_ERROR с legacy-полями', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(
      new Error('db down')
    );
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    /* Так же, как в приложении: handler отдаёт ошибку в next, а ответ
       формирует errorHandler, смонтированный после маршрутов. */
    await CategoryOrderController.getCategoryOrdersForPoll(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      // Legacy-зеркала: на них построен разбор ошибок на клиенте.
      success: false,
    });
    expect(typeof (res.body as { error?: unknown }).error).toBe('string');
  });

  it('ответ несёт requestId для сопоставления с логами', async () => {
    categoryOrders.getCategoryOrder.mockRejectedValue(new Error('db down'));
    const req = mockRequest({
      user: USER,
      params: { id: '1' },
      extra: { requestId: 'req-42' },
    });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.body).toMatchObject({ traceId: 'req-42' });
  });

  /* Ошибки с осмысленным статусом переводить было нельзя, и это проверяется
     здесь же: 404 остаётся 404, а не превращается в 500. */
  it('отсутствие категории по-прежнему 404, а не 500', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const req = mockRequest({ user: USER, params: { id: '1' } });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrder(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('плохой параметр по-прежнему 400, а не 500', async () => {
    const req = mockRequest({ user: USER, params: { pollId: 'нет' } });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVALID_POLL_ID' });
  });
});

/**
 * Утверждение «перевод на next(err) не может изменить статус» было НЕВЕРНЫМ, и
 * это выяснилось на ревью. `errorHandler` распознаёт известные ошибки Prisma:
 * `P2002` → 409 `DUPLICATE_ENTRY`, `P2025` → 404 `NOT_FOUND`. То есть у
 * переведённых мутаций сбой БД теперь даёт не 500, а осмысленный код.
 *
 * Это улучшение, но именно поэтому его надо закрепить: молчаливая смена
 * контракта — то же самое, что регрессия, только в другую сторону.
 */
describe('известные ошибки Prisma получают свой статус, а не 500', () => {
  function prismaError(code: string): Error {
    const err = new Error('prisma failed');
    err.name = 'PrismaClientKnownRequestError';
    (err as Error & { code: string }).code = code;
    return err;
  }

  it('нарушение уникальности (P2002) — 409 DUPLICATE_ENTRY', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(
      prismaError('P2002')
    );
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'DUPLICATE_ENTRY' });
  });

  it('запись не найдена (P2025) — 404 NOT_FOUND', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(
      prismaError('P2025')
    );
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('неизвестный код Prisma остаётся 500', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(
      prismaError('P9999')
    );
    const req = mockRequest({ user: USER, params: { pollId: '12' } });
    const res = mockResponse();

    await CategoryOrderController.getCategoryOrdersForPoll(req, res, err =>
      errorHandler(err as Error, req, res, jest.fn())
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
