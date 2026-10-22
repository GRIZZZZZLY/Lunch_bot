/**
 * BudgetService, статические методы. Переходы статусов долга, роли, окно
 * отмены и задания очереди проверяет интеграционный набор на настоящей
 * PostgreSQL (budget-lifecycle.redis.test.ts). Здесь — только адресаты
 * события SSE: экран обновляется у обеих сторон долга, а не у одной.
 */
import { BudgetService } from '../../../services/budget.service';
import { eventBus } from '../../../services/event-bus.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const bus = asServiceMock(eventBus);

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  prismaMock.transaction.findUnique.mockResolvedValue({
    id: 10,
    pollId: 5,
    fromUserId: 1,
    toUserId: 2,
    amount: 250,
    status: 'PENDING',
    confirmedAt: null,
    debtMessageId: null,
    debtChatId: null,
    fromUser: { id: 1, firstName: 'Игорь', username: 'igor', telegramId: BigInt(555) },
    toUser: { id: 2, firstName: 'Аня', telegramId: BigInt(777) },
    menuItem: { id: 1, name: 'Плов', price: 250 },
  } as never);
  asMock(prismaMock.transaction.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.transaction.updateManyAndReturn).mockResolvedValue([
    { id: 10 },
  ] as never);
  asMock(prismaMock.outboxEvent.createManyAndReturn).mockResolvedValue([
    { id: 501 },
  ] as never);
});

describe('markAsPaid', () => {
  it('событие об изменении долга адресовано обеим сторонам', async () => {
    await BudgetService.markAsPaid(10, 1);

    expect(bus.emit).toHaveBeenCalledWith(
      'debt_updated',
      expect.objectContaining({ transactionId: 10, audience: [1, 2] })
    );
  });
});
