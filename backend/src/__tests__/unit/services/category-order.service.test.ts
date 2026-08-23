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
  it('категория с одним участником сразу получает ответственного', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          category: 'Плов',
          responsibleUserId: 1,
          selectionStatus: 'SELECTED_AUTO',
          selectionMode: 'auto',
          participantCount: 1,
        }),
      ],
    });
    expect(orders).toHaveLength(1);
  });

  it('категория с несколькими участниками ждёт добровольца', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: 'Плов' }, user: { id: 2 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          responsibleUserId: null,
          selectionStatus: 'VOLUNTEER_OPEN',
          selectionMode: null,
          participantCount: 2,
        }),
      ],
    });
  });

  it('повторные голоса одного человека не раздувают счётчик участников', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
    ] as never);

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.createManyAndReturn).toHaveBeenCalledWith({
      data: [expect.objectContaining({ participantCount: 1 })],
    });
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

    await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.createManyAndReturn).toHaveBeenCalledWith({
      data: [expect.objectContaining({ category: 'Плов' })],
    });
  });

  /* Цена завершения голосования не должна расти от числа блюд: раньше на
     каждую категорию шла своя вставка. */
  it('все категории вставляются одним запросом', async () => {
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { id: 1, userId: 1, menuItem: { name: 'Плов' }, user: { id: 1 } },
      { id: 2, userId: 2, menuItem: { name: 'Шурпа' }, user: { id: 2 } },
      { id: 3, userId: 3, menuItem: { name: 'Лагман' }, user: { id: 3 } },
    ] as never);

    const orders = await CategoryOrderService.createCategoryOrders(5);

    expect(prismaMock.categoryOrder.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(orders).toHaveLength(3);
    // Порядок строк сохранён: id раздаются в порядке вставки.
    expect(orders.map(order => order.category)).toEqual(['Плов', 'Шурпа', 'Лагман']);
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

    /* Причина отказа теперь доезжает до клиента: до типизации собственный
       `catch` метода подменял её на «Failed to set responsible user», и второй
       доброволец получал 500 вместо «категорию уже взяли». */
    await expect(
      CategoryOrderService.setResponsible(1, 7, 'volunteer')
    ).rejects.toMatchObject({
      message: 'CategoryOrder is already assigned',
      statusCode: 409,
      code: 'VOLUNTEER_NOT_AVAILABLE',
    });
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

  /* Название теста обещало «понятное исключение», а проверялось «Failed to get
     participants» — то есть ровно НЕпонятное. Теперь обещание выполнено: 404 со
     своим кодом. */
  it('категории нет — 404 NOT_FOUND', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(CategoryOrderService.getParticipants(1)).rejects.toMatchObject({
      message: 'CategoryOrder not found',
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  /* Сбой базы по-прежнему безымянный: наружу не должны уходить внутренности.
     Проверяется здесь же, потому что «пропускаем свои ошибки» легко превратить
     в «пропускаем любые». */
  it('сбой базы остаётся безымянным', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockRejectedValue(
      new Error('connection terminated')
    );

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
        totalAdditionalCosts: money(450),
        totalAmount: money(1450),
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

  it('завершённый расчёт править нельзя — 409, а не 500', async () => {
    asMock(prismaMock.categoryOrder.updateMany).mockResolvedValue({
      count: 0,
    });

    /* Самый заметный из закрытых дефектов: ответственный, вернувшийся к уже
       закрытому расчёту, получал «Ошибка на сервере» и повторял попытку, вместо
       того чтобы узнать, что менять уже нечего. */
    await expect(
      CategoryOrderService.updateCosts(1, { tip: 100 })
    ).rejects.toMatchObject({
      message: 'Completed category order costs cannot be changed',
      statusCode: 409,
      code: 'CALCULATION_COMPLETED',
    });
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

  /**
   * Копейки. Это тот дефект, из-за которого задача 08 отдельно предупреждает
   * «не приводите к `number` внутри расчёта».
   *
   * Колонки денег объявлены `Decimal`, но складывались обычным `+` над double:
   * `0.1 + 0.2` даёт `0.30000000000000004`, и это уходило в базу как есть.
   * Дальше сумма делится на участников в `finalizeCalculation` — то есть
   * погрешность попадала в долг конкретного человека, и заметна она только на
   * суммах вида 333.33, а не на круглых.
   */
  it('копейки складываются без потери точности', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      totalItemsAmount: 0,
    });

    await CategoryOrderService.updateCosts(1, {
      deliveryCost: 0.1,
      serviceFee: 0.2,
      tip: 0,
    });

    const written = (
      prismaMock.categoryOrder.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;

    /* Именно `String`, а не сравнение с числом: `0.3 === 0.30000000000000004`
       ложно, но `expect(x).toBe(0.3)` прошло бы и на испорченном значении,
       если бы оно случайно совпало по представлению. Строка показывает, что
       уходит в колонку. */
    expect(String(written.totalAdditionalCosts)).toBe('0.3');
    expect(String(written.totalAmount)).toBe('0.3');
  });

  it('копейки не теряются и при пересчёте с суммой позиций', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue({
      totalItemsAmount: 333.33,
    });

    await CategoryOrderService.updateCosts(1, { deliveryCost: 0.07 });

    const written = (
      prismaMock.categoryOrder.updateMany.mock.calls[0][0] as {
        data: Record<string, unknown>;
      }
    ).data;

    expect(String(written.totalAmount)).toBe('333.4');
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
        totalItemsAmount: money(800),
        totalAmount: money(1250),
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
        data: expect.objectContaining({ totalItemsAmount: money(0) }),
      })
    );
  });

  it('категории нет — 404 NOT_FOUND', async () => {
    asMock(prismaMock.categoryOrder.findUnique).mockResolvedValue(null);

    await expect(
      CategoryOrderService.recalculateTotals(1)
    ).rejects.toMatchObject({
      message: 'CategoryOrder not found',
      statusCode: 404,
      code: 'NOT_FOUND',
    });
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
