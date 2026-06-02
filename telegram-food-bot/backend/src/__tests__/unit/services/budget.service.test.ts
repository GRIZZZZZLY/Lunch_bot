import { BudgetService } from '../../../services/budget.service';

// Мокаем prisma-клиент: setOrderCosts работает через interactive-транзакцию
// prisma.$transaction(async (tx) => ...), поэтому мок $transaction прокидывает
// тот же набор мок-моделей в колбэк.
const txMock = {
  pollOrderCosts: {
    upsert: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('../../../database/client', () => ({
  prisma: {
    poll: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('BudgetService.setOrderCosts — пересчёт расходов', () => {
  const service = new BudgetService();
  const pollId = 42;
  const responsibleUserId = 7;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ответственный за заказ — это вызывающий пользователь.
    prisma.poll.findUnique.mockResolvedValue({
      id: pollId,
      result: { responsibleUserId },
      responsibleSelection: null,
    });

    // $transaction(callback) → выполняем колбэк с мок-tx.
    prisma.$transaction.mockImplementation(async (cb: any) => cb(txMock));

    txMock.pollOrderCosts.upsert.mockResolvedValue({
      pollId,
      deliveryCost: 300,
      serviceFee: 0,
      tip: 0,
    });
    txMock.transaction.update.mockResolvedValue({});
  });

  it('пересчитывает только PENDING и замораживает PAID/CONFIRMED', async () => {
    // 3 участника: один ещё должен (PENDING), двое уже рассчитались.
    txMock.transaction.findMany.mockResolvedValue([
      { id: 1, status: 'PENDING', menuItem: { price: 100 } },
      { id: 2, status: 'PAID', menuItem: { price: 200 } },
      { id: 3, status: 'CONFIRMED', menuItem: { price: 50 } },
    ]);

    await service.setOrderCosts(pollId, responsibleUserId, {
      deliveryCost: 300,
      serviceFee: 0,
      tip: 0,
    });

    // Обновлён ровно один раз — только PENDING (id=1).
    expect(txMock.transaction.update).toHaveBeenCalledTimes(1);
    const call = txMock.transaction.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 1 });

    // Знаменатель делёжа — все 3 участника: доставка 300 / 3 = 100 на каждого.
    // Сумма PENDING = блюдо 100 + доля доставки 100 = 200.
    expect(call.data.deliveryShare).toBe(100);
    expect(call.data.amount).toBe(200);

    // Оплаченные долги (id=2, id=3) не трогаем — их суммы не меняются задним числом.
    const touchedIds = txMock.transaction.update.mock.calls.map((c: any) => c[0].where.id);
    expect(touchedIds).not.toContain(2);
    expect(touchedIds).not.toContain(3);
  });

  it('не пишет ни одной транзакции, если все уже оплачены', async () => {
    txMock.transaction.findMany.mockResolvedValue([
      { id: 1, status: 'CONFIRMED', menuItem: { price: 100 } },
      { id: 2, status: 'PAID', menuItem: { price: 200 } },
    ]);

    await service.setOrderCosts(pollId, responsibleUserId, {
      deliveryCost: 300,
      serviceFee: 0,
      tip: 0,
    });

    expect(txMock.transaction.update).not.toHaveBeenCalled();
  });
});
