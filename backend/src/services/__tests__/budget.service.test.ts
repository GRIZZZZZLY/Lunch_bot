import { BudgetService } from '../budget.service';
import { OrderCostsService } from '../order-costs.service';
import { ReminderService } from '../reminder.service';
import { prisma } from '../../database/client';

const mockSendMessage = jest.fn();
const mockEditMessageText = jest.fn();

jest.mock('../../database/client', () => ({
  prisma: {
    paymentReminder: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    pollOrderCosts: {
      findUnique: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../../bot/bot-instance', () => ({
  getBotInstance: () => ({
    api: {
      sendMessage: mockSendMessage,
      editMessageText: mockEditMessageText,
    },
  }),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('BudgetService Mini App behaviours', () => {
  const service = new BudgetService();
  const orderCostsService = new OrderCostsService();
  const reminderService = new ReminderService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses menu item price in poll breakdown when itemPrice is missing', async () => {
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: 11,
        fromUserId: 5,
        toUserId: 9,
        amount: 300,
        itemPrice: null,
        deliveryShare: null,
        serviceShare: null,
        tipShare: null,
        status: 'PENDING',
        fromUser: { firstName: 'Bob' },
        menuItem: { name: 'Soup', price: 300 },
      },
    ]);
    (prisma.pollOrderCosts.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await orderCostsService.getPollCostBreakdown(7);

    expect(result.totalItemsCost).toBe(300);
    expect(result.grandTotal).toBe(300);
    expect(result.participantsCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      itemPrice: 300,
      totalAmount: 300,
    });
  });

  it('does not let a debtor mark a confirmed transaction as paid again', async () => {
    (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce({
      fromUserId: 5,
      status: 'CONFIRMED',
    });

    await expect(BudgetService.markAsPaid(11, 5)).rejects.toThrow(
      'Cannot modify confirmed payment'
    );
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('cancels only a non-confirmed payment mark', async () => {
    (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 11,
      fromUserId: 5,
      status: 'PAID',
      amount: 300,
      fromUser: { firstName: 'Bob' },
      toUser: { telegramId: BigInt(9) },
    });

    await service.cancelMarkAsPaid(11, 5);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 11, fromUserId: 5, status: 'PAID' },
      data: {
        status: 'PENDING',
        paidAt: null,
        confirmedAt: null,
      },
    });
  });

  it('does not send a one-person reminder from a non-creditor', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      id: 11,
      fromUserId: 5,
      toUserId: 9,
      amount: 300,
      fromUser: { id: 5, firstName: 'Bob', telegramId: BigInt(5) },
      toUser: { id: 9, firstName: 'Alice' },
      poll: { group: { title: 'Team' } },
    });

    const result = await reminderService.sendReminder(11, 123);

    expect(result).toMatchObject({
      success: false,
      error: 'Only creditor can send reminders',
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(prisma.paymentReminder.create).not.toHaveBeenCalled();
  });

  it('records successful bulk reminders for pending debtors', async () => {
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: 11,
        fromUserId: 5,
        toUserId: 9,
        amount: 300,
        fromUser: { id: 5, firstName: 'Bob', telegramId: BigInt(5) },
        toUser: {
          id: 9,
          firstName: 'Alice',
          paymentPhone: '+79991234567',
          paymentCard: null,
        },
        poll: { group: { title: 'Team' } },
      },
    ]);
    mockSendMessage.mockResolvedValue({});

    const result = await reminderService.sendRemindersToAll(7, 9);

    expect(result).toEqual({
      sentCount: 1,
      failedCount: 0,
      totalCount: 1,
      failedUsers: [],
    });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        pollId: 7,
        toUserId: 9,
        status: 'PENDING',
      },
      include: {
        fromUser: true,
        toUser: true,
        poll: {
          include: {
            group: true,
          },
        },
      },
    });
    expect(prisma.paymentReminder.createMany).toHaveBeenCalledWith({
      data: [
        {
          transactionId: 11,
          type: 'MANUAL',
          sentBy: 9,
          message: expect.any(String),
        },
      ],
    });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11] } },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: expect.any(Date),
      },
    });
  });
});

/* Отмена подтверждения. Деньги: проверяем и окно, и права, и то, что при отказе
   статус не меняется. Окно — сутки (решение владельца, 2026-08-01). */
describe('BudgetService.undoConfirmation', () => {
  const base = {
    id: 42,
    toUserId: 7,
    fromUserId: 8,
    amount: 300,
    status: 'CONFIRMED',
    fromUser: { id: 8, firstName: 'Ян', telegramId: '111' },
    toUser: { id: 7, firstName: 'Игорь', telegramId: '222' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it('возвращает подтверждённый долг в PAID в пределах суток', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      confirmedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    await BudgetService.undoConfirmation(42, 7);

    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 42, toUserId: 7, status: 'CONFIRMED' },
      data: { status: 'PAID', confirmedAt: null },
    });
  });

  /* Регрессия. При подтверждении старое сообщение о долге переписывается в
     «✅ Оплата подтверждена!». После отмены оно так и висело в чате должника,
     утверждая обратное только что присланному уведомлению — два
     противоречащих факта об одном событии в одной переписке. */
  it('переписывает устаревшее «оплата подтверждена» в чате должника', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      confirmedAt: new Date(Date.now() - 60 * 60 * 1000),
      debtMessageId: 555,
      debtChatId: '111',
    });

    await BudgetService.undoConfirmation(42, 7);

    expect(mockEditMessageText).toHaveBeenCalledWith(
      '111',
      555,
      expect.stringContaining('Подтверждение оплаты отменено'),
      expect.objectContaining({ reply_markup: { inline_keyboard: [] } }),
    );
    // и должник всё равно получает отдельное уведомление
    expect(mockSendMessage).toHaveBeenCalledWith(111, expect.stringContaining('отменено'));
  });

  it('без сохранённого сообщения просто уведомляет, не падая', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      confirmedAt: new Date(Date.now() - 60 * 60 * 1000),
      debtMessageId: null,
      debtChatId: null,
    });

    await BudgetService.undoConfirmation(42, 7);

    expect(mockEditMessageText).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('после суток отказывает и статус не трогает', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      confirmedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    await expect(BudgetService.undoConfirmation(42, 7)).rejects.toThrow('Undo window has expired');
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('отменить может только получатель платежа', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      confirmedAt: new Date(),
    });

    await expect(BudgetService.undoConfirmation(42, 999)).rejects.toThrow('Access denied');
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('неподтверждённый платёж отменить нельзя', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
      ...base,
      status: 'PAID',
      confirmedAt: null,
    });

    await expect(BudgetService.undoConfirmation(42, 7)).rejects.toThrow(
      'Only a confirmed payment can be undone',
    );
    expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
  });
});
