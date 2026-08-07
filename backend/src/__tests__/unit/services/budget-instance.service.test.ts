/**
 * BudgetService, методы экземпляра: то, что вызывает HTTP-слой. Здесь считаются
 * и переписываются реальные суммы долгов, поэтому тесты закрепляют арифметику и
 * границы видимости данных:
 *
 * - в списке СВОИХ долгов реквизиты получателя нужны (по ним и переводят),
 *   а в списке кредитов реквизиты должника не запрашиваются вовсе;
 * - счётчик напоминаний растёт только по факту доставки.
 *
 * Статические методы (перевод статусов, уведомления) покрыты в
 * services/__tests__/budget.service.test.ts. Расходы на заказ (setOrderCosts/
 * getOrderCosts/getPollCostBreakdown) переехали в OrderCostsService — тесты
 * в order-costs.service.test.ts.
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

describe('getTransactionById', () => {
  it('запрашивает только поля, нужные для проверки прав', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 10 } as never);

    await service.getTransactionById(10);

    expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        status: true,
      },
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    prismaMock.transaction.findUnique.mockRejectedValue(new Error('db down'));

    await expect(service.getTransactionById(10)).rejects.toThrow('db down');
  });
});

describe('getUserDebts', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('берёт долги, где пользователь — плательщик', async () => {
    await service.getUserDebts(1);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromUserId: 1 },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('реквизиты получателя запрашиваются — по ним человек и переводит', async () => {
    await service.getUserDebts(1);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { toUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.toUser.select).toMatchObject({
      paymentPhone: true,
      paymentCard: true,
      paymentDetails: true,
    });
  });

  it('свои реквизиты в список долгов не попадают', async () => {
    await service.getUserDebts(1);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { fromUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.fromUser.select).not.toHaveProperty('paymentCard');
    expect(include.fromUser.select).not.toHaveProperty('paymentPhone');
  });

  it('явный статус фильтрует выборку', async () => {
    await service.getUserDebts(1, 'CONFIRMED');

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fromUserId: 1, status: 'CONFIRMED' } })
    );
  });

  it('activeOnly без статуса берёт незакрытые долги', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    await service.getUserDebts(1, undefined, true);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromUserId: 1, status: { in: ['PENDING', 'PAID'] } },
      })
    );
  });

  it('activeOnly убирает долг тому, кто вышел из группы', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, toUserId: 99 }),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 2 },
    ] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts.map(d => d.id)).toEqual([10]);
  });

  it('долг без группы (магазинный забег) не отфильтровывается', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 12, poll: null, toUserId: 99 }),
      tx(),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 2 },
    ] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts.map(d => d.id)).toEqual([12, 10]);
  });

  it('без известных членств фильтр не применяется', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    const debts = await service.getUserDebts(1, undefined, true);

    expect(debts).toHaveLength(1);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserDebts(1)).rejects.toThrow('db down');
  });
});

describe('getUserCredits', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([tx()] as never);
  });

  it('берёт долги, где пользователь — получатель', async () => {
    await service.getUserCredits(2);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { toUserId: 2 } })
    );
  });

  it('реквизиты должника сборщику не отдаются — деньги идут в другую сторону', async () => {
    await service.getUserCredits(2);

    const include = (
      prismaMock.transaction.findMany.mock.calls[0][0] as {
        include: { fromUser: { select: Record<string, boolean> } };
      }
    ).include;
    expect(include.fromUser.select).toEqual({
      id: true,
      firstName: true,
      username: true,
    });
  });

  it('явный статус фильтрует выборку', async () => {
    await service.getUserCredits(2, 'PAID');

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { toUserId: 2, status: 'PAID' } })
    );
  });

  it('activeOnly убирает долги вышедших из группы должников', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, fromUserId: 99 }),
    ] as never);
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { groupId: 100, userId: 1 },
    ] as never);

    const credits = await service.getUserCredits(2, undefined, true);

    expect(credits.map(c => c.id)).toEqual([10]);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserCredits(2)).rejects.toThrow('db down');
  });
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

describe('getUserStats', () => {
  beforeEach(() => {
    asMock(prismaMock.responsibleSelection.count).mockResolvedValue(3);
  });

  it('считает траты, поступления и баланс', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 1, amount: 100, status: 'CONFIRMED' }),
      tx({ id: 2, amount: 200, status: 'PENDING' }),
      tx({ id: 3, fromUserId: 2, toUserId: 1, amount: 50 }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats).toMatchObject({
      totalSpent: 300,
      totalReceived: 50,
      balance: -250,
      totalOrders: 2,
      confirmedOrders: 1,
      pendingOrders: 1,
      timesResponsible: 3,
    });
  });

  it('средний чек считается по подтверждённым заказам', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ id: 1, amount: 100, status: 'CONFIRMED' }),
      tx({ id: 2, amount: 200, status: 'CONFIRMED' }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.averagePerOrder).toBe(150);
  });

  it('без подтверждённых заказов средний чек — ноль, а не деление на ноль', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ amount: 100, status: 'PENDING' }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.averagePerOrder).toBe(0);
  });

  it('топ блюд отсортирован по сумме и ограничен пятью', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue(
      [
        tx({ id: 1, amount: 100, menuItem: { name: 'Плов', price: 100 } }),
        tx({ id: 2, amount: 100, menuItem: { name: 'Плов', price: 100 } }),
        tx({ id: 3, amount: 500, menuItem: { name: 'Стейк', price: 500 } }),
        tx({ id: 4, amount: 10, menuItem: { name: 'Чай', price: 10 } }),
        tx({ id: 5, amount: 20, menuItem: { name: 'Кофе', price: 20 } }),
        tx({ id: 6, amount: 30, menuItem: { name: 'Сок', price: 30 } }),
        tx({ id: 7, amount: 40, menuItem: { name: 'Суп', price: 40 } }),
      ] as never
    );

    const stats = await service.getUserStats(1);

    expect(stats.topDishes).toHaveLength(5);
    expect(stats.topDishes[0]).toMatchObject({ name: 'Стейк', total: 500 });
    expect(stats.topDishes[1]).toMatchObject({ name: 'Плов', count: 2, total: 200 });
  });

  it('транзакции без блюда в топ не попадают', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx({ menuItem: null }),
    ] as never);

    const stats = await service.getUserStats(1);

    expect(stats.topDishes).toEqual([]);
  });

  it('диапазон дат уходит в запрос', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-08-01T00:00:00.000Z');

    await service.getUserStats(1, from, to);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
      })
    );
  });

  it('только нижняя граница тоже работает', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);
    const from = new Date('2026-07-01T00:00:00.000Z');

    await service.getUserStats(1, from);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from } }),
      })
    );
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getUserStats(1)).rejects.toThrow('db down');
  });
});

describe('sendReminder', () => {
  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue(tx() as never);
    asMock(prismaMock.paymentReminder.create).mockResolvedValue({
      id: 1,
    });
    asMock(prismaMock.transaction.update).mockResolvedValue(tx());
  });

  it('получатель отправляет напоминание должнику', async () => {
    const result = await service.sendReminder(10, 2);

    expect(result).toEqual({ success: true });
    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe(555);
    expect(message).toContain('Аня напоминает о платеже');
    expect(message).toContain('250.00₽');
    expect(message).toContain('Заказ в Команда');
    expect(message).toContain('СБП: +79990001122');
  });

  it('напоминание фиксируется и увеличивает счётчик', async () => {
    await service.sendReminder(10, 2);

    expect(prismaMock.paymentReminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionId: 10,
        type: 'MANUAL',
        sentBy: 2,
      }),
    });
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('напомнить может только получатель платежа', async () => {
    const result = await service.sendReminder(10, 1);

    expect(result).toMatchObject({
      success: false,
      error: 'Only creditor can send reminders',
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('транзакции нет — понятный отказ', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.sendReminder(10, 2)).resolves.toMatchObject({
      success: false,
      error: 'Transaction not found',
    });
  });

  it('заблокированный бот классифицируется и счётчик не растёт', async () => {
    sendMessage.mockRejectedValue(
      Object.assign(new Error('Forbidden: bot was blocked by the user'), {
        error_code: 403,
      })
    );

    const result = await service.sendReminder(10, 2);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('bot_blocked');
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('без группы в заказе название подставляется общим словом', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(
      tx({ poll: null }) as never
    );

    await service.sendReminder(10, 2);

    expect(sendMessage.mock.calls[0][1]).toContain('Заказ в группа');
  });

  it('ошибка записи в базу превращается во внутреннюю ошибку', async () => {
    asMock(prismaMock.paymentReminder.create).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.sendReminder(10, 2)).resolves.toMatchObject({
      success: false,
      error: 'Internal error',
    });
  });
});

describe('sendRemindersToAll', () => {
  beforeEach(() => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      tx(),
      tx({ id: 11, fromUser: { id: 3, firstName: 'Оля', telegramId: BigInt(888) } }),
    ] as never);
    asMock(prismaMock.paymentReminder.createMany).mockResolvedValue({
      count: 2,
    });
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 2,
    });
  });

  it('рассылает всем должникам заказа и считает результат', async () => {
    const result = await service.sendRemindersToAll(5, 2);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId: 5, toUserId: 2, status: 'PENDING' },
      })
    );
    expect(result).toMatchObject({
      sentCount: 2,
      failedCount: 0,
      totalCount: 2,
      failedUsers: [],
    });
  });

  it('счётчики обновляются одной пачкой', async () => {
    await service.sendRemindersToAll(5, 2);

    expect(prismaMock.paymentReminder.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [10, 11] } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('недоставленные перечисляются с причиной, счётчик им не растёт', async () => {
    sendMessage
      .mockRejectedValueOnce(
        Object.assign(new Error('Forbidden: bot was blocked by the user'), {
          error_code: 403,
        })
      )
      .mockResolvedValueOnce(undefined);

    const result = await service.sendRemindersToAll(5, 2);

    expect(result).toMatchObject({ sentCount: 1, failedCount: 1 });
    expect(result.failedUsers[0]).toMatchObject({
      id: 1,
      firstName: 'Игорь',
      errorCode: 'bot_blocked',
    });
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [11] } } })
    );
  });

  it('никому не доставлено — пачка не пишется', async () => {
    sendMessage.mockRejectedValue(new Error('network'));

    const result = await service.sendRemindersToAll(5, 2);

    expect(result).toMatchObject({ sentCount: 0, failedCount: 2 });
    expect(prismaMock.paymentReminder.createMany).not.toHaveBeenCalled();
    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('без должников результат пустой', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(service.sendRemindersToAll(5, 2)).resolves.toMatchObject({
      totalCount: 0,
      sentCount: 0,
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.sendRemindersToAll(5, 2)).rejects.toThrow('db down');
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
    const calculateTotals = jest
      .spyOn(BudgetService, 'calculateTotals')
      .mockResolvedValue({ totalOrder: 0 } as never);

    await service.markAsPaid(10, 1);
    await service.confirmPayment(10, 2);
    await service.markAllPaidByResponsible(5, 2);
    await service.calculateTotals(5, 2);

    expect(markAsPaid).toHaveBeenCalledWith(10, 1);
    expect(confirmPayment).toHaveBeenCalledWith(10, 2);
    expect(markAll).toHaveBeenCalledWith(5, 2);
    expect(calculateTotals).toHaveBeenCalledWith(5, 2);

    markAsPaid.mockRestore();
    confirmPayment.mockRestore();
    markAll.mockRestore();
    calculateTotals.mockRestore();
  });
});
