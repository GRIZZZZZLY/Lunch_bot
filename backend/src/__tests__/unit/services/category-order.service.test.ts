/**
 * Заказы по категориям (категория = название блюда). Права, расходы, копейки,
 * захват роли ответственного и запрет правки после финализации проверяет
 * интеграционный набор category-orders.redis.test.ts. Здесь — разбор голосов в
 * категории, события и то, что ноль в расходах — значение, а не «не задано».
 */
import { CategoryOrderService } from '../../../services/category-order.service';
import { eventBus } from '../../../services/event-bus.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';
import { money } from '../../helpers/money';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const bus = asServiceMock(eventBus);

const NOW = new Date('2026-08-03T12:00:00.000Z');

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  /* Вставка одна на все категории: мок возвращает те же строки с id — так же,
     как `createManyAndReturn` в PostgreSQL, в порядке входных данных. */
  asMock(prismaMock.categoryOrder.createManyAndReturn).mockImplementation((async (args: {
    data: Array<Record<string, unknown>>;
  }) => args.data.map((row, index) => ({ id: index + 1, ...row }))) as never);
  asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({
    count: 1,
  });
  asMock(prismaMock.categoryOrder.findUniqueOrThrow).mockResolvedValue({
    id: 1,
    pollId: 5,
  });
  asMock(prismaMock.categoryOrder.update).mockResolvedValue({
    id: 1,
    pollId: 5,
  });
  asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
    id: 1,
    pollId: 5,
    totalItemsAmount: 0,
    deliveryCost: 0,
    serviceFee: 0,
    tip: 0,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createCategoryOrders', () => {
  it('повторные голоса одного человека не раздувают счётчик участников', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(orders).toEqual([expect.objectContaining({ participantCount: 1 })]);
  });

  it('голос без блюда и с пустым названием пропускается', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: null, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: '   ' }, user: { id: 2 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(orders).toEqual([]);
    /* Нечего вставлять — в базу не идём вовсе: `data: []` был бы запросом
       ради пустоты. */
    expect(prismaMock.categoryOrder.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('название категории обрезается по краям', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: '  Плов  ' }, user: { id: 1 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(orders).toEqual([expect.objectContaining({ category: 'Плов' })]);
  });

  it('на каждую созданную категорию уходит событие', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: 'Шурпа' }, user: { id: 2 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(bus.emit).toHaveBeenCalledTimes(2);
    expect(bus.emit).toHaveBeenCalledWith(
      'category_order_updated',
      expect.objectContaining({ pollId: 5, type: 'created' })
    );
  });
});

describe('setResponsible', () => {
  it('рулетка помечается своим статусом', async () => {
    await CategoryOrderService.setResponsible(1, 7, 'roulette');

    expect(prismaMock.categoryOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selectionStatus: 'SELECTED_ROULETTE',
        }),
      })
    );
  });

  it('о назначении сообщается событием', async () => {
    await CategoryOrderService.setResponsible(1, 7, 'volunteer');

    expect(bus.emit).toHaveBeenCalledWith(
      'responsible_selected',
      expect.objectContaining({
        categoryOrderId: 1,
        pollId: 5,
        responsibleUserId: 7,
        method: 'volunteer',
      })
    );
  });
});

describe('updateCalculationStatus', () => {
  it('завершение расчёта сообщается событием finalized', async () => {
    await CategoryOrderService.updateCalculationStatus(1, 'COMPLETED');

    expect(bus.emit).toHaveBeenCalledWith(
      'category_order_updated',
      expect.objectContaining({ type: 'finalized' })
    );
  });
});

describe('updateCosts', () => {
  it('нулевые суммы записываются, а не считаются «не заданными»', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      totalItemsAmount: 500,
    });

    await CategoryOrderService.updateCosts(1, {
      deliveryCost: 0,
      serviceFee: 0,
      tip: 0,
    });

    expect(prismaMock.categoryOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAdditionalCosts: money(0),
          totalAmount: money(500),
        }),
      })
    );
  });
});
