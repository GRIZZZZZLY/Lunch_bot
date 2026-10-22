/**
 * BudgetService.cancelMarkAsPaid. Роли, статусы и задание получателю
 * проверяет интеграционный набор budget-lifecycle.redis.test.ts. Здесь —
 * гонка, которую через эндпоинт не поймать: статус сменился между чтением и
 * условной записью, и отмена не должна молча пройти.
 */
import { BudgetService } from '../../../services/budget.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
});

describe('cancelMarkAsPaid', () => {
  it('статус изменился между чтением и записью — гонка распознаётся', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      fromUserId: 1,
      toUserId: 2,
      amount: 250,
      status: 'CANCELLED',
    } as never);

    await expect(new BudgetService().cancelMarkAsPaid(10, 1)).rejects.toThrow(
      'Transaction state changed'
    );
  });
});
