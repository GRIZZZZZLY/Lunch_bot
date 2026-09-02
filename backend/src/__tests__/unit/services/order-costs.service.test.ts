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
