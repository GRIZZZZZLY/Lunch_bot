import { CategoryOrderService } from '../category-order.service';
import { prisma } from '../../database/client';

jest.mock('../../database/client', () => ({
  prisma: {
    categoryOrder: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../event-bus.service', () => ({
  eventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CategoryOrderService costs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates non-negative additional costs and recalculates totals', async () => {
    (prisma.categoryOrder.findUnique as jest.Mock).mockResolvedValue({
      totalItemsAmount: 550,
    });
    (prisma.categoryOrder.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.categoryOrder.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 3,
      pollId: 7,
      deliveryCost: 90,
      serviceFee: 10,
      tip: 0,
      totalAdditionalCosts: 100,
      totalAmount: 650,
    });

    await CategoryOrderService.updateCosts(3, {
      deliveryCost: 90,
      serviceFee: 10,
      tip: 0,
    });

    expect(prisma.categoryOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 3, calculationStatus: { not: 'COMPLETED' } },
      data: {
        deliveryCost: 90,
        serviceFee: 10,
        tip: 0,
        notes: undefined,
        totalAdditionalCosts: 100,
        totalAmount: 650,
        updatedAt: expect.any(Date),
      },
    });
  });

  it('rejects negative or invalid costs before database writes', async () => {
    await expect(
      CategoryOrderService.updateCosts(3, {
        deliveryCost: -1,
        serviceFee: 0,
        tip: 0,
      })
    ).rejects.toThrow('Costs must be non-negative numbers');

    await expect(
      CategoryOrderService.updateCosts(3, {
        deliveryCost: Number.NaN,
        serviceFee: 0,
        tip: 0,
      })
    ).rejects.toThrow('Costs must be non-negative numbers');

    expect(prisma.categoryOrder.updateMany).not.toHaveBeenCalled();
  });
});
