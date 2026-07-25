import { OrderCalculationService } from '../order-calculation.service';
import { CategoryOrderService } from '../category-order.service';
import { prisma } from '../../database/client';

jest.mock('../../database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    categoryOrder: {
      findUnique: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderItemEditLog: {
      createMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../category-order.service', () => ({
  CategoryOrderService: {
    recalculateTotals: jest.fn(),
    getParticipants: jest.fn(),
  },
}));

jest.mock('../../bot/bot-instance', () => ({
  getBotInstance: () => null,
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../user.service', () => ({
  UserService: {
    getPaymentInfo: jest.fn(),
  },
}));

const txMock = {
  categoryOrder: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  transaction: {
    count: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('OrderCalculationService category order behaviours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async cb => cb(txMock));
    (CategoryOrderService.getParticipants as jest.Mock).mockResolvedValue([5, 9]);
    txMock.categoryOrder.updateMany.mockResolvedValue({ count: 1 });
  });

  it('saves a trimmed order item and recalculates totals', async () => {
    (prisma.orderItem.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.orderItem.create as jest.Mock).mockResolvedValue({
      id: 11,
      categoryOrderId: 3,
      userId: 5,
      itemName: 'Soup',
      price: 300,
      notes: undefined,
      enteredBy: 9,
    });

    await OrderCalculationService.saveOrderItem({
      categoryOrderId: 3,
      userId: 5,
      itemName: '  Soup  ',
      price: 300,
      notes: '   ',
      enteredBy: 9,
    });

    expect(prisma.orderItem.create).toHaveBeenCalledWith({
      data: {
        categoryOrderId: 3,
        userId: 5,
        itemName: 'Soup',
        price: 300,
        notes: undefined,
        enteredBy: 9,
      },
    });
    expect(CategoryOrderService.recalculateTotals).toHaveBeenCalledWith(3);
  });

  it('rejects empty item names and non-positive prices before database writes', async () => {
    await expect(
      OrderCalculationService.saveOrderItem({
        categoryOrderId: 3,
        userId: 5,
        itemName: '   ',
        price: 300,
        enteredBy: 9,
      })
    ).rejects.toThrow('Item name is required');

    await expect(
      OrderCalculationService.saveOrderItem({
        categoryOrderId: 3,
        userId: 5,
        itemName: 'Soup',
        price: 0,
        enteredBy: 9,
      })
    ).rejects.toThrow('Price must be between 0 and 1000000');

    expect(prisma.orderItem.create).not.toHaveBeenCalled();
    expect(prisma.orderItem.update).not.toHaveBeenCalled();
  });

  it('finalizes calculation atomically and creates debts for non-responsible participants', async () => {
    (prisma.categoryOrder.findUnique as jest.Mock)
      .mockResolvedValue({
        id: 3,
        pollId: 7,
        category: 'Soup',
        responsibleUserId: 9,
        participantCount: 2,
        deliveryCost: 80,
        serviceFee: 20,
        tip: 0,
        orderItems: [
          { id: 11, userId: 5, price: 300, user: { id: 5 } },
          { id: 12, userId: 9, price: 250, user: { id: 9 } },
        ],
        poll: { id: 7 },
      });
    txMock.transaction.count.mockResolvedValue(0);
    txMock.transaction.findMany.mockResolvedValue([
      {
        id: 21,
        categoryOrderId: 3,
        fromUserId: 5,
        toUserId: 9,
        amount: 350,
      },
    ]);

    const result = await OrderCalculationService.finalizeCalculation(3);

    expect(txMock.transaction.createMany).toHaveBeenCalledWith({
      data: [
        {
          pollId: 7,
          fromUserId: 5,
          toUserId: 9,
          amount: 350,
          categoryOrderId: 3,
          itemPrice: 300,
          deliveryShare: 40,
          serviceShare: 10,
          tipShare: 0,
          status: 'PENDING',
        },
      ],
      skipDuplicates: true,
    });
    expect(txMock.categoryOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 3,
        calculationStatus: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: {
        calculationStatus: 'COMPLETED',
        calculationCompletedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      transactionsCreated: 1,
      participantCount: 2,
      orderItemsCount: 2,
    });
  });

  it('does not create debts for a user outside the category participants', async () => {
    (prisma.categoryOrder.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      pollId: 7,
      category: 'Soup',
      responsibleUserId: 9,
      participantCount: 2,
      deliveryCost: 80,
      serviceFee: 20,
      tip: 0,
      orderItems: [
        { id: 11, userId: 5, price: 300, user: { id: 5 } },
        { id: 12, userId: 999, price: 250, user: { id: 999 } },
      ],
      poll: { id: 7 },
    });

    await expect(
      OrderCalculationService.finalizeCalculation(3)
    ).rejects.toThrow(
      'Cannot finalize: order items must exactly match category participants'
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(txMock.transaction.createMany).not.toHaveBeenCalled();
  });
});
