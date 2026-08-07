/**
 * Расходы на заказ (доставка/сервис/чай), заведённые ответственным после
 * закрытия голосования, и разбивка по участникам.
 *
 * Ключевое правило, из-за которого это стоит тестов: пересчёт расходов
 * трогает только PENDING-долги. Уже оплаченные (PAID/CONFIRMED) заморожены —
 * сумма не должна меняться задним числом, если ответственный позже правит
 * расходы.
 */
import { OrderCostsService } from '../../../services/order-costs.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: OrderCostsService;

/** Транзакция: должник 1 → получатель 2. */
function tx(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    fromUserId: 1,
    toUserId: 2,
    amount: 250,
    status: 'PENDING',
    itemPrice: null,
    deliveryShare: null,
    serviceShare: null,
    tipShare: null,
    createdAt: NOW,
    fromUser: { id: 1, firstName: 'Игорь', telegramId: BigInt(555) },
    toUser: { id: 2, firstName: 'Аня', telegramId: BigInt(777) },
    menuItem: { id: 1, name: 'Плов', price: 200 },
    poll: { id: 5, groupId: 100, group: { id: 100, title: 'Команда' } },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  service = new OrderCostsService();
});

describe('setOrderCosts', () => {
  const costs = { deliveryCost: 300, serviceFee: 60, tip: 30 };

  beforeEach(() => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      result: { responsibleUserId: 2 },
      responsibleSelection: null,
    } as never);
    asMock(prismaMock.pollOrderCosts.upsert).mockResolvedValue({
      id: 1,
      pollId: 5,
      ...costs,
    });
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.transaction.update).mockResolvedValue(tx());
  });

  it('ответственный сохраняет расходы', async () => {
    const result = await service.setOrderCosts(5, 2, { ...costs, notes: 'нал' });

    expect(prismaMock.pollOrderCosts.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pollId: 5 } })
    );
    expect(result).toMatchObject({ pollId: 5 });
  });

  it('расходы делятся на всех участников заказа', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, fromUserId: 1, toUserId: 2 }),
      tx({ id: 11, fromUserId: 3, toUserId: 2 }),
    ] as never);

    await service.setOrderCosts(5, 2, costs);

    // Участников трое (1, 2, 3): 300/3 + 60/3 + 30/3 = 130 к цене блюда 200.
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        itemPrice: 200,
        deliveryShare: 100,
        serviceShare: 20,
        tipShare: 10,
        amount: 330,
      },
    });
  });

  it('оплаченные долги задним числом не меняются', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, status: 'PENDING' }),
      tx({ id: 11, status: 'PAID' }),
      tx({ id: 12, status: 'CONFIRMED' }),
    ] as never);

    await service.setOrderCosts(5, 2, costs);

    expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10 } })
    );
  });

  it('без транзакций пересчитывать нечего', async () => {
    await service.setOrderCosts(5, 2, costs);

    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('ответственный из responsibleSelection тоже принимается', async () => {
    prismaMock.poll.findUnique.mockResolvedValue({
      id: 5,
      result: null,
      responsibleSelection: { selectedUserId: 2 },
    } as never);

    await expect(service.setOrderCosts(5, 2, costs)).resolves.toBeDefined();
  });

  it('голосования нет — понятная ошибка', async () => {
    prismaMock.poll.findUnique.mockResolvedValue(null);

    await expect(service.setOrderCosts(5, 2, costs)).rejects.toThrow(
      'Poll not found'
    );
  });

  it('не ответственный расходы задать не может', async () => {
    await expect(service.setOrderCosts(5, 99, costs)).rejects.toThrow(
      'Only responsible person can set order costs'
    );
    expect(prismaMock.pollOrderCosts.upsert).not.toHaveBeenCalled();
  });

  it('блюдо без цены даёт долю расходов без стоимости позиции', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, menuItem: null }),
    ] as never);

    await service.setOrderCosts(5, 2, costs);

    // Участников двое: 300/2 + 60/2 + 30/2 = 195.
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({ itemPrice: 0, amount: 195 }),
    });
  });

  it('без числовых fromUserId/toUserId знаменатель — число транзакций', async () => {
    // Ни у одной записи нет fromUserId/toUserId => participantIds пуст,
    // делёж падает на transactions.length (3), не на participantIds.size.
    asMock(prismaMock.pollOrderCosts.upsert).mockResolvedValue({
      id: 1,
      pollId: 5,
      deliveryCost: 300,
      serviceFee: 0,
      tip: 0,
    });
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { id: 1, status: 'PENDING', menuItem: { price: 100 } },
      { id: 2, status: 'PAID', menuItem: { price: 200 } },
      { id: 3, status: 'CONFIRMED', menuItem: { price: 50 } },
    ] as never);

    await service.setOrderCosts(5, 2, { deliveryCost: 300, serviceFee: 0, tip: 0 });

    // Обновлён ровно один раз — только PENDING (id=1).
    expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
    const call = asMock(prismaMock.transaction.update).mock.calls[0][0] as {
      where: { id: number };
      data: { deliveryShare: number; amount: number };
    };
    expect(call.where).toEqual({ id: 1 });

    // 300 / 3 = 100 на каждого; сумма PENDING = блюдо 100 + доля доставки 100 = 200.
    expect(call.data.deliveryShare).toBe(100);
    expect(call.data.amount).toBe(200);
  });

  it('не пишет ни одной транзакции, если все уже оплачены', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 1, status: 'CONFIRMED', menuItem: { price: 100 } }),
      tx({ id: 2, status: 'PAID', menuItem: { price: 200 } }),
    ] as never);

    await service.setOrderCosts(5, 2, costs);

    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });
});

describe('getOrderCosts', () => {
  it('читает расходы по заказу', async () => {
    prismaMock.pollOrderCosts.findUnique.mockResolvedValue({ id: 1 } as never);

    await expect(service.getOrderCosts(5)).resolves.toMatchObject({ id: 1 });
    expect(prismaMock.pollOrderCosts.findUnique).toHaveBeenCalledWith({
      where: { pollId: 5 },
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    prismaMock.pollOrderCosts.findUnique.mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getOrderCosts(5)).rejects.toThrow('db down');
  });
});

describe('getPollCostBreakdown', () => {
  const orderCosts = {
    id: 1,
    pollId: 5,
    deliveryCost: 300,
    serviceFee: 60,
    tip: 30,
    notes: 'нал',
    enteredBy: 2,
    enteredAt: NOW,
    updatedAt: NOW,
  };

  beforeEach(() => {
    prismaMock.pollOrderCosts.findUnique.mockResolvedValue(orderCosts as never);
  });

  it('собирает разбивку по участникам и общий итог', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({
        id: 10,
        itemPrice: 200,
        deliveryShare: 150,
        serviceShare: 30,
        tipShare: 15,
        amount: 395,
      }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown).toMatchObject({
      pollId: 5,
      totalItemsCost: 200,
      totalDeliveryCost: 300,
      totalServiceFee: 60,
      totalTip: 30,
      grandTotal: 590,
      participantsCount: 2,
    });
    expect(breakdown.transactions[0]).toMatchObject({
      transactionId: 10,
      userId: 1,
      userName: 'Игорь',
      menuItemName: 'Плов',
      itemPrice: 200,
      status: 'PENDING',
    });
  });

  it('без itemPrice берётся цена блюда', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, itemPrice: null, amount: 395 }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown.transactions[0].itemPrice).toBe(200);
  });

  it('без цены блюда стоимость позиции восстанавливается из суммы', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({
        id: 10,
        itemPrice: null,
        menuItem: null,
        amount: 395,
        deliveryShare: 150,
        serviceShare: 30,
        tipShare: 15,
      }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown.transactions[0]).toMatchObject({
      itemPrice: 200,
      menuItemName: 'Unknown',
    });
  });

  it('восстановленная стоимость не уходит в минус', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({
        id: 10,
        itemPrice: null,
        menuItem: null,
        amount: 10,
        deliveryShare: 150,
        serviceShare: 30,
        tipShare: 15,
      }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown.transactions[0].itemPrice).toBe(0);
  });

  it('без расходов на заказ блок orderCosts не отдаётся', async () => {
    prismaMock.pollOrderCosts.findUnique.mockResolvedValue(null);
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, itemPrice: 200 }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown.orderCosts).toBeUndefined();
    expect(breakdown.grandTotal).toBe(200);
  });

  it('без транзакций участников считается ноль', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown).toMatchObject({
      participantsCount: 0,
      totalItemsCost: 0,
      grandTotal: 390,
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getPollCostBreakdown(5)).rejects.toThrow('db down');
  });
});
