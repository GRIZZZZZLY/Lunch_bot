/**
 * Заказы по категориям (категория = название блюда). Два места, где ошибка
 * стоит денег или доверия:
 *
 * 1. Роль ответственного захватывается атомарно (updateMany с VOLUNTEER_OPEN
 *    в условии): два одновременных отклика не должны назначить двоих.
 * 2. Расходы нельзя править после финализации — суммы уже разошлись людям как
 *    долги, и правка задним числом сделала бы расчёт неверным.
 */
import { CategoryOrderService } from '../../../services/category-order.service';
import { eventBus } from '../../../services/event-bus.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

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

  asMock(prismaMock.categoryOrder.create).mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: 1, ...args.data })) as never);
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
  it('категория с одним участником сразу получает ответственного', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: 'Плов',
        responsibleUserId: 1,
        selectionStatus: 'SELECTED_AUTO',
        selectionMode: 'auto',
        participantCount: 1,
      }),
    });
    expect(orders).toHaveLength(1);
  });

  it('категория с несколькими участниками ждёт добровольца', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: 'Плов' }, user: { id: 2 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        responsibleUserId: null,
        selectionStatus: 'VOLUNTEER_OPEN',
        selectionMode: null,
        participantCount: 2,
      }),
    });
  });

  it('повторные голоса одного человека не раздувают счётчик участников', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ participantCount: 1 }),
    });
  });

  it('голос без блюда и с пустым названием пропускается', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: null, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: '   ' }, user: { id: 2 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(orders).toEqual([]);
    expect(prismaMock.categoryOrder.create).not.toHaveBeenCalled();
  });

  it('название категории обрезается по краям', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: '  Плов  ' }, user: { id: 1 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ category: 'Плов' }),
    });
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

  it('ошибка базы превращается в понятное исключение', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(CategoryOrderService.createCategoryOrders(5)).rejects.toThrow(
      'Failed to create category orders'
    );
  });
});

describe('чтение категорий', () => {
  it('список по голосованию сортируется по названию', async () => {
    asMock(prismaMock.categoryOrder.findMany).mockResolvedValue([] as never);

    await CategoryOrderService.getCategoryOrdersForPoll(5);

    expect(prismaMock.categoryOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId: 5 },
        orderBy: { category: 'asc' },
      })
    );
  });

  it('ошибка чтения списка — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      CategoryOrderService.getCategoryOrdersForPoll(5)
    ).rejects.toThrow('Failed to get category orders');
  });

  it('одна категория отдаётся с позициями и авторами', async () => {
    await CategoryOrderService.getCategoryOrder(1);

    expect(prismaMock.categoryOrder.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    );
  });

  it('ошибка чтения категории — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockRejectedValue(
      new Error('db down')
    );

    await expect(CategoryOrderService.getCategoryOrder(1)).rejects.toThrow(
      'Failed to get category order'
    );
  });
});

describe('setResponsible', () => {
  it('доброволец забирает свободную категорию', async () => {
    await CategoryOrderService.setResponsible(1, 7, 'volunteer');

    expect(prismaMock.categoryOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        selectionStatus: 'VOLUNTEER_OPEN',
        responsibleUserId: null,
      },
      data: expect.objectContaining({
        responsibleUserId: 7,
        selectionStatus: 'SELECTED_VOLUNTEER',
        selectionMode: 'volunteer',
      }),
    });
  });

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

  it('гонка: занятую категорию второй раз не назначить', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({
      count: 0,
    });

    await expect(
      CategoryOrderService.setResponsible(1, 7, 'volunteer')
    ).rejects.toThrow('Failed to set responsible user');
    expect(bus.emit).not.toHaveBeenCalled();
  });
});

describe('getParticipants', () => {
  it('отдаёт уникальных голосовавших за категорию', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      pollId: 5,
      category: 'Плов',
    });
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { userId: 1 },
      { userId: 2 },
    ] as never);

    const participants = await CategoryOrderService.getParticipants(1);

    expect(prismaMock.vote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId: 5, menuItem: { name: 'Плов' } },
        distinct: ['userId'],
      })
    );
    expect(participants).toEqual([1, 2]);
  });

  it('категории нет — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(CategoryOrderService.getParticipants(1)).rejects.toThrow(
      'Failed to get participants'
    );
  });
});

describe('getParticipantsByCategoriesForPoll', () => {
  it('один запрос на все категории, дубликаты категорий свёрнуты', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { userId: 1, menuItem: { name: 'Плов' } },
      { userId: 2, menuItem: { name: 'Плов' } },
      { userId: 3, menuItem: { name: 'Шурпа' } },
    ] as never);

    const map = await CategoryOrderService.getParticipantsByCategoriesForPoll(
      5,
      ['Плов', 'Шурпа', 'Плов']
    );

    expect(prismaMock.vote.findMany).toHaveBeenCalledTimes(1);
    expect(map.get('Плов')).toEqual(new Set([1, 2]));
    expect(map.get('Шурпа')).toEqual(new Set([3]));
  });

  it('категория без голосов остаётся в карте пустой', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([] as never);

    const map = await CategoryOrderService.getParticipantsByCategoriesForPoll(
      5,
      ['Плов']
    );

    expect(map.get('Плов')).toEqual(new Set());
  });

  it('пустой список категорий не идёт в базу', async () => {
    const map = await CategoryOrderService.getParticipantsByCategoriesForPoll(
      5,
      []
    );

    expect(map.size).toBe(0);
    expect(prismaMock.vote.findMany).not.toHaveBeenCalled();
  });

  it('голос по чужой категории игнорируется', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { userId: 1, menuItem: { name: 'Лагман' } },
    ] as never);

    const map = await CategoryOrderService.getParticipantsByCategoriesForPoll(
      5,
      ['Плов']
    );

    expect(map.get('Плов')).toEqual(new Set());
  });

  it('ошибка базы — понятное исключение', async () => {
    asMock(prismaMock.vote.findMany).mockRejectedValue(new Error('db down'));

    await expect(
      CategoryOrderService.getParticipantsByCategoriesForPoll(5, ['Плов'])
    ).rejects.toThrow('Failed to get participants');
  });
});

describe('updateCalculationStatus', () => {
  it('старт расчёта помечается временем', async () => {
    await CategoryOrderService.updateCalculationStatus(1, 'IN_PROGRESS');

    expect(prismaMock.categoryOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        calculationStatus: 'IN_PROGRESS',
        calculationStartedAt: NOW,
      }),
    });
  });

  it('завершение расчёта помечается своим временем и событием finalized', async () => {
    await CategoryOrderService.updateCalculationStatus(1, 'COMPLETED');

    expect(prismaMock.categoryOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ calculationCompletedAt: NOW }),
    });
    expect(bus.emit).toHaveBeenCalledWith(
      'category_order_updated',
      expect.objectContaining({ type: 'finalized' })
    );
  });

  it('возврат в PENDING времён не пишет', async () => {
    await CategoryOrderService.updateCalculationStatus(1, 'PENDING');

    const data = (
      prismaMock.categoryOrder.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;
    expect(data).not.toHaveProperty('calculationStartedAt');
    expect(data).not.toHaveProperty('calculationCompletedAt');
  });

  it('ошибка базы — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.update).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      CategoryOrderService.updateCalculationStatus(1, 'COMPLETED')
    ).rejects.toThrow('Failed to update calculation status');
  });
});

describe('updateCosts', () => {
  it('складывает расходы и пересчитывает итог', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      totalItemsAmount: 1000,
    });

    await CategoryOrderService.updateCosts(1, {
      deliveryCost: 300,
      serviceFee: 50,
      tip: 100,
      notes: 'нал',
    });

    expect(prismaMock.categoryOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 1, calculationStatus: { not: 'COMPLETED' } },
      data: expect.objectContaining({
        deliveryCost: 300,
        serviceFee: 50,
        tip: 100,
        totalAdditionalCosts: 450,
        totalAmount: 1450,
        notes: 'нал',
      }),
    });
  });

  it('незаданные расходы считаются нулями', async () => {
    await CategoryOrderService.updateCosts(1, { tip: 100 });

    expect(prismaMock.categoryOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliveryCost: 0,
          serviceFee: 0,
          tip: 100,
        }),
      })
    );
  });

  it('завершённый расчёт править нельзя', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({
      count: 0,
    });

    await expect(
      CategoryOrderService.updateCosts(1, { tip: 100 })
    ).rejects.toThrow('Failed to update costs');
  });

  it.each([
    ['отрицательная доставка', { deliveryCost: -1 }],
    ['отрицательный сервис', { serviceFee: -1 }],
    ['отрицательные чаевые', { tip: -1 }],
    ['слишком большая сумма', { tip: 1_000_001 }],
    ['не число', { tip: Number.NaN }],
    ['бесконечность', { tip: Number.POSITIVE_INFINITY }],
  ])('%s отклоняется до записи', async (_label, costs) => {
    await expect(CategoryOrderService.updateCosts(1, costs)).rejects.toThrow(
      'Costs must be non-negative numbers'
    );
    expect(prismaMock.categoryOrder.updateMany).not.toHaveBeenCalled();
  });
});

describe('recalculateTotals', () => {
  beforeEach(() => {
    asMock(prismaMock.orderItem.aggregate).mockResolvedValue({
      _sum: { price: 800 },
    });
  });

  it('сумма позиций складывается с расходами', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      deliveryCost: 300,
      serviceFee: 50,
      tip: 100,
      pollId: 5,
    });

    await CategoryOrderService.recalculateTotals(1);

    expect(prismaMock.categoryOrder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        totalItemsAmount: 800,
        totalAmount: 1250,
      }),
    });
  });

  it('пустой заказ даёт нулевую сумму позиций', async () => {
    asMock(prismaMock.orderItem.aggregate).mockResolvedValue({
      _sum: { price: null },
    });

    await CategoryOrderService.recalculateTotals(1);

    expect(prismaMock.categoryOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalItemsAmount: 0 }),
      })
    );
  });

  it('категории нет — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(CategoryOrderService.recalculateTotals(1)).rejects.toThrow(
      'Failed to recalculate totals'
    );
  });

  it('о пересчёте сообщается событием', async () => {
    await CategoryOrderService.recalculateTotals(1);

    expect(bus.emit).toHaveBeenCalledWith(
      'category_order_updated',
      expect.objectContaining({ categoryOrderId: 1, type: 'updated' })
    );
  });
});

describe('deleteCategoryOrder', () => {
  it('удаляет категорию', async () => {
    asMock(prismaMock.categoryOrder.delete).mockResolvedValue({
      id: 1,
    });

    await CategoryOrderService.deleteCategoryOrder(1);

    expect(prismaMock.categoryOrder.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('ошибка базы — понятное исключение', async () => {
    asMock(prismaMock.categoryOrder.delete).mockRejectedValue(
      new Error('db down')
    );

    await expect(CategoryOrderService.deleteCategoryOrder(1)).rejects.toThrow(
      'Failed to delete category order'
    );
  });
});
