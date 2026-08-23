/**
 * Заказы по категориям: ответственный за категорию вбивает, кто что взял и по
 * какой цене, а из этого потом создаются долги.
 *
 * Авторизация здесь больше НЕ проверяется — она уехала на маршруты
 * (`api/middleware/authorization.ts`). Её тесты живут в двух местах:
 * `__tests__/unit/middleware/authorization.test.ts` — сами правила, и
 * `__tests__/unit/routes/category-order-authorization.test.ts` — то, что нужный
 * guard действительно стоит в цепочке нужного маршрута. Второе не менее важно
 * первого: handler, вызванный напрямую (как в этом файле), никакой авторизации
 * не делает, и без теста на проводку новый эндпоинт без guard'а прошёл бы всё.
 *
 * Единственное исключение — `DELETE /api/order-items/:id`: там `:id` это
 * ПОЗИЦИЯ, а право принадлежит ответственному за ЗАКАЗ, который выясняется
 * только после запроса. Эта проверка осталась в контроллере, и её тест — тоже.
 */
import { CategoryOrderController } from '../../../api/controllers/category-order.controller';
import { CategoryOrderService } from '../../../services/category-order.service';
import { OrderCalculationService } from '../../../services/order-calculation.service';
import { MultiCategoryResponsibleService } from '../../../services/multi-category-responsible.service';
import { UserService } from '../../../services/user.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import {
  mockRequest,
  mockResponse,
  withErrorHandler,
} from '../../helpers/http';
import { asServiceMock } from '../../helpers/mocks';
import {
  CalculationCompletedError,
  CalculationNotReadyError,
  CategoryOrderNotFoundError,
} from '../../../services/category-order.errors';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/category-order.service', () => ({
  CategoryOrderService: {
    getCategoryOrdersForPoll: jest.fn(),
    getParticipantsByCategoriesForPoll: jest.fn(),
    getCategoryOrder: jest.fn(),
    getParticipants: jest.fn(),
    getResponsibleUserId: jest.fn(),
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
    getCategoryOrderIdForItem: jest.fn(),
  },
}));

jest.mock('../../../services/multi-category-responsible.service', () => ({
  MultiCategoryResponsibleService: {
    handleVolunteerForCategory: jest.fn(),
  },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUsersByIds: jest.fn(), getUserById: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Контроллер, соединённый с НАСТОЯЩИМ `errorHandler`, — как в приложении.
 *
 * Handler'ы больше не отвечают об ошибке сами и не принимают `next`: Express 5
 * передаёт отказ асинхронного обработчика в цепочку ошибок, а ответ собирает
 * `errorHandler` (задача 05 сделала то же в `poll.controller`). Обёртка ставит
 * его на место `next`, поэтому утверждения про `res.statusCode` и `res.body`
 * продолжают проверять то, что увидит клиент, — и каждый такой тест заодно
 * стал тестом делегирования: подмена 409 на 500 падает сразу.
 */
const controller = withErrorHandler(CategoryOrderController);

const categoryOrders = asServiceMock(CategoryOrderService);
const calculations = asServiceMock(OrderCalculationService);
const responsibles = asServiceMock(MultiCategoryResponsibleService);
const users = asServiceMock(UserService);

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
  categoryOrders.getResponsibleUserId.mockResolvedValue(1);
  categoryOrders.getParticipants.mockResolvedValue([1, 2]);
});

describe('GET /api/polls/:pollId/category-orders', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrdersForPoll.mockResolvedValue([
      { id: 1, category: 'Горячее' },
    ]);
  });

  it('участник группы видит все категории голосования', async () => {
    const res = mockResponse();

    await controller.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 1, data: [{ id: 1 }] });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getCategoryOrdersForPoll(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await controller.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getCategoryOrdersForPoll.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
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

    await controller.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 1, data: [{ id: 1 }] });
  });

  it('категории без данных об участниках не попадают в выборку', async () => {
    categoryOrders.getParticipantsByCategoriesForPoll.mockResolvedValue(new Map());
    const res = mockResponse();

    await controller.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 0 });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getMyCategoryOrdersForPoll(
      mockRequest({ params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой pollId — 400', async () => {
    const res = mockResponse();

    await controller.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getParticipantsByCategoriesForPoll.mockRejectedValue(
      new Error('boom')
    );
    const res = mockResponse();

    await controller.getMyCategoryOrdersForPoll(
      mockRequest({ user: PARTICIPANT, params: { pollId: '12' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/category-orders/:id', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrder.mockResolvedValue({ id: 1, pollId: 12 });
  });

  it('ответственный видит категорию', async () => {
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({ data: { id: 1 } });
  });

  it('участник категории видит категорию', async () => {
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404', async () => {
    categoryOrders.getCategoryOrder.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.getCategoryOrder.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getCategoryOrder(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('POST /api/category-orders/:id/order-items', () => {
  const body = { userId: 2, itemName: '  Плов  ', price: 450, notes: '  без лука ' };

  beforeEach(() => {
    calculations.saveOrderItem.mockResolvedValue({ id: 7 });
  });

  it('ответственный вписывает позицию участнику, строки обрезаются', async () => {
    const res = mockResponse();

    await controller.saveOrderItem(
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
    await controller.saveOrderItem(
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

    await controller.saveOrderItem(
      mockRequest({ params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.saveOrderItem(
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

    await controller.saveOrderItem(
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

  /* Проверки «есть ли ответственный» здесь больше нет: тот же запрос делает
     `requireCategoryOrderResponsible` на маршруте и отдаёт тот же 404. Тест
     сторожит именно отсутствие дубля — иначе он вернётся при следующей правке. */
  it('handler не повторяет запрос ответственного за маршрутом', async () => {
    const res = mockResponse();

    await controller.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(categoryOrders.getResponsibleUserId).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('позицию нельзя вписать тому, кто не участник категории — 403', async () => {
    categoryOrders.getParticipants.mockResolvedValue([1]);
    const res = mockResponse();

    await controller.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Order items can only be created for category participants',
    });
  });

  /* Пустой список участников. Правило `participantIds.includes(userId)` при
     пустом списке отказывает ВСЕМ, включая ответственного, — и это верно, но
     нигде не было записано, а задача 08 требует закрепить: «участников нет»
     не должно вырождаться в «пускаем любого». */
  it('за категорию никто не голосовал — вписать позицию нельзя никому', async () => {
    categoryOrders.getParticipants.mockResolvedValue([]);
    const res = mockResponse();

    await controller.saveOrderItem(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { ...body, userId: RESPONSIBLE.id },
      }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(calculations.saveOrderItem).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    calculations.saveOrderItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.saveOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('DELETE /api/order-items/:id', () => {
  beforeEach(() => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(1);
    calculations.deleteOrderItem.mockResolvedValue(undefined);
  });

  it('ответственный удаляет позицию', async () => {
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(calculations.deleteOrderItem).toHaveBeenCalledWith(7);
    expect(res.body).toMatchObject({ message: 'Order item deleted' });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('позиции нет — 404', async () => {
    calculations.getCategoryOrderIdForItem.mockResolvedValue(null);
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('категория позиции исчезла — 404', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('не ответственный — 403', async () => {
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: PARTICIPANT, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(403);
    expect(calculations.deleteOrderItem).not.toHaveBeenCalled();
  });

  it('ошибка сервиса — 500', async () => {
    calculations.deleteOrderItem.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.deleteOrderItem(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/category-orders/:id/progress', () => {
  beforeEach(() => {
    calculations.getProgress.mockResolvedValue({ filled: 2, total: 3 });
  });

  it.each([
    ['ответственный', RESPONSIBLE],
    ['участник', PARTICIPANT],
    /* Прежнего глобального админа в списке больше нет: прогресс виден
       ответственному и участникам категории, посторонний получает 403
       (проверяется отдельным тестом ниже). */
  ])('%s видит прогресс', async (_label, user) => {
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ user, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: { filled: 2 } });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  /**
   * ЗАКРЕПЛЁННЫЙ ДЕФЕКТ, а не контракт.
   *
   * Handler спрашивает `getResponsibleUserId` и отвечает 404 «категории нет»,
   * когда ответственного НЕТ. Но у категории с двумя и более участниками
   * ответственного нет до тех пор, пока кто-нибудь не откликнется
   * (`selectionStatus: VOLUNTEER_OPEN`), а маршрут прогресса открыт участникам
   * (`requireCategoryOrderParticipant`), а не только ответственному. То есть
   * участник категории, за которую ещё никто не взялся, получает «не найдено»
   * вместо прогресса.
   *
   * Тест перевёрнут в шаге «handler'ы перестают повторять проверку маршрута».
   */
  it('ответственный не выбран — участник всё равно видит прогресс', async () => {
    categoryOrders.getResponsibleUserId.mockResolvedValue(null);
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ data: { filled: 2 } });
  });

  /* Отсутствие самого заказа по-прежнему 404 — но теперь его отдаёт сервис
     типизированной ошибкой, а не собственная проверка обработчика. */
  it('заказа нет — 404 из сервиса', async () => {
    calculations.getProgress.mockRejectedValue(new CategoryOrderNotFoundError());
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getProgress.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getProgress(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/category-orders/:id/participants', () => {
  beforeEach(() => {
    users.getUsersByIds.mockResolvedValue([
      { id: 1, firstName: 'Игорь', lastName: null, username: 'igor' },
    ] as never);
  });

  it('ответственный получает список участников', async () => {
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(users.getUsersByIds).toHaveBeenCalledWith([1, 2]);
    expect(res.body).toMatchObject({ data: [{ id: 1 }] });
  });

  /* Сервис отдаёт полную запись пользователя, включая telegramId. Контроллер
     обязан выбрать поля сам — иначе Telegram-id участников уходит наружу. */
  it('в ответ попадают только имена, без telegramId', async () => {
    users.getUsersByIds.mockResolvedValue([
      {
        id: 1,
        firstName: 'Игорь',
        lastName: null,
        username: 'igor',
        telegramId: BigInt(555),
        isAdmin: true,
      },
    ] as never);
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.body).toEqual(
      expect.objectContaining({
        data: [{ id: 1, firstName: 'Игорь', lastName: null, username: 'igor' }],
      })
    );
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404 из сервиса, а не из повторной проверки', async () => {
    categoryOrders.getParticipants.mockRejectedValue(
      new CategoryOrderNotFoundError()
    );
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(categoryOrders.getResponsibleUserId).not.toHaveBeenCalled();
  });

  it('ошибка базы — 500', async () => {
    users.getUsersByIds.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getParticipants(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('POST /api/category-orders/:id/finalize', () => {
  beforeEach(() => {
    calculations.finalizeCalculation.mockResolvedValue({ transactions: 3 });
  });

  it('ответственный закрывает расчёт и создаёт долги', async () => {
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(calculations.finalizeCalculation).toHaveBeenCalledWith(1);
    expect(res.body).toMatchObject({
      message: 'Calculation finalized and transactions created',
    });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404 из сервиса', async () => {
    calculations.finalizeCalculation.mockRejectedValue(
      new CategoryOrderNotFoundError()
    );
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  /**
   * Самый заметный из закрытых дефектов этого файла.
   *
   * Прежний `catch` отвечал `500 FINALIZATION_ERROR` на ЛЮБУЮ ошибку расчёта,
   * поэтому «не у всех заполнены позиции» приходило ответственному как «Ошибка
   * на сервере» — и он повторял попытку, не понимая, чего ждать. Теперь причина
   * доходит своим статусом.
   */
  it('расчёт не готов — 409 с причиной, а не 500', async () => {
    calculations.finalizeCalculation.mockRejectedValue(
      new CalculationNotReadyError(
        'Cannot finalize: order items must exactly match category participants'
      )
    );
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'CALCULATION_NOT_READY' });
  });

  it('настоящий сбой расчёта остаётся 500', async () => {
    calculations.finalizeCalculation.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.finalizeCalculation(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('POST /api/category-orders/:id/volunteer', () => {
  beforeEach(() => {
    categoryOrders.getCategoryOrder.mockResolvedValue({ id: 1, pollId: 12 });
    users.getUserById.mockResolvedValue({
      telegramId: BigInt(555),
    });
    responsibles.handleVolunteerForCategory.mockResolvedValue(true);
  });

  it('участник берёт категорию на себя', async () => {
    const res = mockResponse();

    await controller.volunteerForCategory(
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

    await controller.volunteerForCategory(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  /* Существование категории проверяет `requireCategoryOrderPollAccess` на
     маршруте — тем же запросом и с тем же 404. Обработчик читал категорию
     ДВАЖДЫ: один раз ради проверки, второй — для ответа. Остался только
     второй. */
  it('категория читается один раз — для ответа, а не для проверки', async () => {
    const res = mockResponse();

    await controller.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(categoryOrders.getCategoryOrder).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('пользователя нет в базе — 404', async () => {
    users.getUserById.mockResolvedValue(null);
    const res = mockResponse();

    await controller.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(404);
  });

  it('категория уже занята — 409', async () => {
    responsibles.handleVolunteerForCategory.mockResolvedValue(false);
    const res = mockResponse();

    await controller.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'VOLUNTEER_NOT_AVAILABLE' });
  });

  it('ошибка сервиса — 500', async () => {
    responsibles.handleVolunteerForCategory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.volunteerForCategory(
      mockRequest({ user: PARTICIPANT, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('PUT /api/category-orders/:id/costs', () => {
  beforeEach(() => {
    categoryOrders.updateCosts.mockResolvedValue({ id: 1, deliveryCost: 300 });
  });

  it('ответственный задаёт доставку, сервис и чай', async () => {
    const res = mockResponse();

    await controller.updateCosts(
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
    await controller.updateCosts(
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
    await controller.updateCosts(
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

    await controller.updateCosts(
      mockRequest({
        user: RESPONSIBLE,
        params: { id: '1' },
        body: { [field]: -1 },
      }),
      res
    );

    expect(res.statusCode).toBe(400);
    /* Название поля осталось в ответе, но пришло из схемы, а не из
       рукописной строки: теперь оно и в `errors[]`, а не только внутри текста.
       Проверяется именно поле — на него смотрит форма на клиенте. */
    expect(res.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ field })],
    });
    expect(res.body).toHaveProperty('error', expect.stringContaining(field));
  });

  it('нечисловая стоимость — 400', async () => {
    const res = mockResponse();

    await controller.updateCosts(
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

    await controller.updateCosts(
      mockRequest({ params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('категории нет — 404 из сервиса', async () => {
    categoryOrders.updateCosts.mockRejectedValue(
      new CategoryOrderNotFoundError()
    );
    const res = mockResponse();

    await controller.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(categoryOrders.getResponsibleUserId).not.toHaveBeenCalled();
  });

  /* Закрытый расчёт — 409, а не 500: до типизации отказов сервиса ответственный
     получал «Ошибка на сервере» и правил суммы повторно. */
  it('расчёт уже закрыт — 409 CALCULATION_COMPLETED', async () => {
    categoryOrders.updateCosts.mockRejectedValue(new CalculationCompletedError());
    const res = mockResponse();

    await controller.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: 'CALCULATION_COMPLETED' });
  });

  it('ошибка сервиса — 500', async () => {
    categoryOrders.updateCosts.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.updateCosts(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' }, body: {} }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/order-items/:id/edit-history', () => {
  beforeEach(() => {
    calculations.getEditHistory.mockResolvedValue([{ id: 1 }]);
  });

  it('глобальный админ видит историю правок', async () => {
    const res = mockResponse();

    await controller.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '7' } }),
      res
    );

    expect(calculations.getEditHistory).toHaveBeenCalledWith(7);
    expect(res.body).toMatchObject({ count: 1 });
  });

  /* Право на историю правок проверяет requireGroupAdmin на маршруте — это
     данные группы, и решает роль в ней. В контроллере осталась только проверка
     аутентификации: дублировать авторизацию в двух местах значит рано или
     поздно развести две проверки, что уже случилось с прежним глобальным
     флагом. */
  it('аутентифицированный проходит: право даёт мидлвара маршрута', async () => {
    const res = mockResponse();

    await controller.getEditHistory(
      mockRequest({ user: RESPONSIBLE, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(calculations.getEditHistory).toHaveBeenCalledWith(7);
  });

  /* 401, а не прежние 403 «Admin access required». Отсутствие аутентификации —
     это 401 по определению, и ветка недостижима: до контроллера стоят
     `telegramAuthMiddleware` и `requireOrderItemGroupAdmin`, оба отвечают 401
     сами. Единственная смена кода ответа в этом файле, и она осознанная. */
  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getEditHistory(mockRequest({ params: { id: '7' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getEditHistory.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getEditHistory(
      mockRequest({ user: GLOBAL_ADMIN, params: { id: '7' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/category-orders/:id/order-items', () => {
  beforeEach(() => {
    calculations.getOrderItems.mockResolvedValue([{ id: 7 }, { id: 8 }]);
  });

  it('ответственный видит позиции', async () => {
    const res = mockResponse();

    await controller.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.body).toMatchObject({ count: 2 });
  });

  it('без аутентификации — 401', async () => {
    const res = mockResponse();

    await controller.getOrderItems(
      mockRequest({ params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(401);
  });

  it('нечисловой id — 400', async () => {
    const res = mockResponse();

    await controller.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: 'нет' } }),
      res
    );

    expect(res.statusCode).toBe(400);
  });

  /* Существование заказа проверяет `requireCategoryOrderResponsible` на
     маршруте. ИЗМЕНЕНИЕ ПОВЕДЕНИЯ: вызванный напрямую, минуя маршрут,
     обработчик теперь отдаст пустой список вместо 404 — `getOrderItems`
     фильтрует по `categoryOrderId` и на отсутствующем заказе просто ничего не
     находит. Через маршрут ответ прежний: 404 отдаёт guard. */
  it('handler не повторяет запрос ответственного за маршрутом', async () => {
    const res = mockResponse();

    await controller.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(categoryOrders.getResponsibleUserId).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('ошибка сервиса — 500', async () => {
    calculations.getOrderItems.mockRejectedValue(new Error('boom'));
    const res = mockResponse();

    await controller.getOrderItems(
      mockRequest({ user: RESPONSIBLE, params: { id: '1' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
