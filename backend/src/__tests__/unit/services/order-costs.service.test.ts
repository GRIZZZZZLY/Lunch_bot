/**
 * Разбивка стоимости заказа по участникам: цена позиций плюс расходы на
 * заказ (доставка/сервис/чай). Основной расчёт проверяет интеграционный тест
 * разбивки голосования; здесь — запасные ветки: цена блюда вместо
 * несохранённой цены позиции, заказ без расходов и без участников.
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

  it('без itemPrice берётся цена блюда', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 10, itemPrice: null, amount: 395 }),
    ] as never);

    const breakdown = await service.getPollCostBreakdown(5);

    expect(breakdown.transactions[0].itemPrice).toBe(200);
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
});
