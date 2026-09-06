/**
 * BudgetService, методы экземпляра: cancelMarkAsPaid и делегирующие обёртки
 * над статикой (markAsPaid/confirmPayment/markAllPaidByResponsible).
 *
 * Статические методы (перевод статусов, уведомления) покрыты в
 * services/__tests__/budget.service.test.ts. Расходы на заказ переехали в
 * OrderCostsService (order-costs.service.test.ts), напоминания — в
 * ReminderService (reminder.service.test.ts), долги/кредиты/статистика — в
 * BudgetQueryService (budget-query.service.test.ts), создание транзакций из
 * голосования и уведомления — в PollFlowService (poll-flow.service.test.ts).
 */
import { BudgetService } from '../../../services/budget.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../services/poll.service', () => ({
  PollService: { getPollById: jest.fn(), getPollResultByPollId: jest.fn() },
}));

jest.mock('../../../services/user.service', () => ({
  UserService: { getUserById: jest.fn(), getPaymentInfo: jest.fn() },
}));

jest.mock('../../../services/event-bus.service', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');

let service: BudgetService;
let sendMessage: jest.Mock;

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
    toUser: {
      id: 2,
      firstName: 'Аня',
      telegramId: BigInt(777),
      paymentPhone: '+79990001122',
      paymentCard: 'https://pay/anya',
    },
    menuItem: { id: 1, name: 'Плов', price: 200 },
    poll: { id: 5, groupId: 100, group: { id: 100, title: 'Команда' } },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage } });

  service = new BudgetService();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('cancelMarkAsPaid', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 1,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ status: 'PENDING' }) as never
    );
  });

  it('снимает отметку только со своей PAID-транзакции', async () => {
    await service.cancelMarkAsPaid(10, 1);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, fromUserId: 1, status: 'PAID' },
      data: { status: 'PENDING', paidAt: null, confirmedAt: null },
    });
  });

  it('получателя уведомляют об отмене', async () => {
    await service.cancelMarkAsPaid(10, 1);

    expect(sendMessage).toHaveBeenCalledWith(
      777,
      expect.stringContaining('Отменена отметка оплаты'),
      { parse_mode: 'Markdown' }
    );
  });

  it('без поднятого бота отмена всё равно проходит', async () => {
    botInstance.mockReturnValue(null);

    await expect(service.cancelMarkAsPaid(10, 1)).resolves.toMatchObject({
      id: 10,
    });
  });

  it('транзакции нет — понятная ошибка', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.cancelMarkAsPaid(10, 1)).rejects.toThrow(
      'Transaction not found'
    );
  });

  it('чужую отметку снять нельзя', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ fromUserId: 99 }) as never
    );

    await expect(service.cancelMarkAsPaid(10, 1)).rejects.toThrow(
      'Access denied'
    );
  });

  it('повторная отмена (уже PENDING) идемпотентна', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ status: 'PENDING' }) as never
    );

    await expect(service.cancelMarkAsPaid(10, 1)).resolves.toMatchObject({
      status: 'PENDING',
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('подтверждённый платёж отменить нельзя', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ status: 'CONFIRMED' }) as never
    );

    await expect(service.cancelMarkAsPaid(10, 1)).rejects.toThrow(
      'Cannot cancel confirmed payment'
    );
  });

  it('статус изменился между чтением и записью — гонка распознаётся', async () => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 0,
    });
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ status: 'CANCELLED' }) as never
    );

    await expect(service.cancelMarkAsPaid(10, 1)).rejects.toThrow(
      'Transaction state changed'
    );
  });
});

describe('делегирующие обёртки', () => {
  it('markAsPaid / confirmPayment / markAllPaidByResponsible идут в статические методы', async () => {
    const markAsPaid = jest
      .spyOn(BudgetService, 'markAsPaid')
      .mockResolvedValue({ id: 10 });
    const confirmPayment = jest
      .spyOn(BudgetService, 'confirmPayment')
      .mockResolvedValue({ id: 10 });
    const markAll = jest
      .spyOn(BudgetService, 'markAllPaidByResponsible')
      .mockResolvedValue(undefined);

    await service.markAsPaid(10, 1);
    await service.confirmPayment(10, 2);
    await service.markAllPaidByResponsible(5, 2);

    expect(markAsPaid).toHaveBeenCalledWith(10, 1);
    expect(confirmPayment).toHaveBeenCalledWith(10, 2);
    expect(markAll).toHaveBeenCalledWith(5, 2);

    markAsPaid.mockRestore();
    confirmPayment.mockRestore();
    markAll.mockRestore();
  });
});

/**
 * Отметка уже снята в PostgreSQL, а Telegram недоступен. Раньше ошибка
 * отправки пробрасывалась наружу: клиент откатывал строку и показывал
 * «Не удалось отменить отметку» на сохранённом переходе.
 */
describe('cancelMarkAsPaid при недоступном Telegram', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({ count: 1 });
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ status: 'PENDING' }) as never
    );
  });

  it('возвращает снятую отметку, а не ошибку', async () => {
    sendMessage.mockRejectedValue(
      Object.assign(new Error('Bad Gateway'), { error_code: 502 })
    );

    await expect(service.cancelMarkAsPaid(10, 1)).resolves.toMatchObject({
      id: 10,
    });

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 10, fromUserId: 1, status: 'PAID' },
      data: { status: 'PENDING', paidAt: null, confirmedAt: null },
    });
  });

  it('ошибка записи в БД по-прежнему идёт наружу', async () => {
    asMock(prismaMock.transaction.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.cancelMarkAsPaid(10, 1)).rejects.toThrow('db down');
  });
});
