import { BudgetService } from '../budget.service';
import { prisma } from '../../database/client';

const mockSendMessage = jest.fn();

jest.mock('../../database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    paymentReminder: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    poll: {
      findUnique: jest.fn(),
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

const txMock = {
  pollOrderCosts: {
    upsert: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('BudgetService Mini App behaviours', () => {
  const service = new BudgetService();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(txMock));
  });

  it('splits order costs across debtors and the responsible user', async () => {
    (prisma.poll.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      result: { responsibleUserId: 9 },
      responsibleSelection: null,
    });
    txMock.pollOrderCosts.upsert.mockResolvedValue({
      pollId: 7,
      deliveryCost: 90,
      serviceFee: 0,
      tip: 0,
    });
    txMock.transaction.findMany.mockResolvedValue([
      {
        id: 11,
        fromUserId: 5,
        toUserId: 9,
        status: 'PENDING',
        menuItem: { price: 300 },
      },
      {
        id: 12,
        fromUserId: 6,
        toUserId: 9,
        status: 'PENDING',
        menuItem: { price: 200 },
      },
    ]);
    txMock.transaction.update.mockResolvedValue({});

    await service.setOrderCosts(7, 9, {
      deliveryCost: 90,
      serviceFee: 0,
      tip: 0,
    });

    expect(txMock.transaction.update).toHaveBeenCalledTimes(2);
    expect(txMock.transaction.update).toHaveBeenNthCalledWith(1, {
      where: { id: 11 },
      data: {
        itemPrice: 300,
        deliveryShare: 30,
        serviceShare: 0,
        tipShare: 0,
        amount: 330,
      },
    });
    expect(txMock.transaction.update).toHaveBeenNthCalledWith(2, {
      where: { id: 12 },
      data: {
        itemPrice: 200,
        deliveryShare: 30,
        serviceShare: 0,
        tipShare: 0,
        amount: 230,
      },
    });
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

    const result = await service.getPollCostBreakdown(7);

    expect(result.totalItemsCost).toBe(300);
    expect(result.grandTotal).toBe(300);
    expect(result.participantsCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      itemPrice: 300,
      totalAmount: 300,
    });
  });

  it('does not let a debtor mark a confirmed transaction as paid again', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce({
      status: 'CONFIRMED',
    });

    await expect(BudgetService.markAsPaid(11, 5)).rejects.toThrow(
      'Cannot modify confirmed payment'
    );
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('cancels only a non-confirmed payment mark', async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValueOnce({
      status: 'PAID',
    });
    (prisma.transaction.update as jest.Mock).mockResolvedValue({
      id: 11,
      amount: 300,
      fromUser: { firstName: 'Bob' },
      toUser: { telegramId: BigInt(9) },
    });

    await service.cancelMarkAsPaid(11);

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        status: 'PENDING',
        paidAt: null,
        confirmedAt: null,
      },
      include: { fromUser: true, toUser: true },
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

    const result = await service.sendReminder(11, 123);

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

    const result = await service.sendRemindersToAll(7, 9);

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
