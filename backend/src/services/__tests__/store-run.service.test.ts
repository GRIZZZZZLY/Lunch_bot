import { Prisma } from '@prisma/client';
import { StoreRunService } from '../store-run.service';
import { prisma } from '../../database/client';
import { BudgetService } from '../budget.service';

jest.mock('../../database/client', () => ({
  prisma: {
    groupMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    storeItem: {
      createManyAndReturn: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    storeRun: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../budget.service', () => ({
  BudgetService: {
    createTransactionsForStoreRun: jest.fn(),
  },
}));

jest.mock('../group.service', () => ({
  GroupService: {
    isUserGroupMember: jest.fn().mockResolvedValue(true),
  },
}));

const baseRun = {
  id: 7,
  groupId: 2,
  initiatorId: 5,
  storeName: 'Market',
  status: 'COLLECTING',
  collectUntil: new Date(Date.now() + 10 * 60 * 1000),
  shoppingAt: null,
  settledAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('StoreRunService user behaviours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads active store runs for groups where the user is active member', async () => {
    (prisma.groupMember.findMany as jest.Mock).mockResolvedValue([
      { groupId: 2 },
      { groupId: 3 },
    ]);
    (prisma.storeRun.findMany as jest.Mock).mockResolvedValue([baseRun]);

    const result = await StoreRunService.getActiveStoreRunsForUser(5);

    expect(result).toEqual([baseRun]);
    expect(prisma.storeRun.findMany).toHaveBeenCalledWith({
      where: {
        groupId: { in: [2, 3] },
        status: { in: ['COLLECTING', 'SHOPPING'] },
      },
      include: {
        initiator: true,
        items: { where: { userId: 5 }, select: { id: true, name: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a store run for an active group member', async () => {
    (prisma.groupMember.findUnique as jest.Mock).mockResolvedValue({ id: 1, isActive: true });
    (prisma.storeRun.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.storeRun.create as jest.Mock).mockResolvedValue(baseRun);

    const result = await StoreRunService.createStoreRun({
      initiatorId: 5,
      groupId: 2,
      storeName: ' Market ',
      collectMinutes: 10,
    });

    expect(result).toEqual(baseRun);
    expect(prisma.storeRun.create).toHaveBeenCalledWith({
      data: {
        groupId: 2,
        initiatorId: 5,
        storeName: 'Market',
        collectUntil: expect.any(Date),
      },
    });
  });

  it('adds participant items while the run is collecting', async () => {
    (prisma.storeRun.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      groupId: 2,
      status: 'COLLECTING',
    });
    (prisma.groupMember.findUnique as jest.Mock).mockResolvedValue({ id: 1, isActive: true });
    (prisma.storeItem.createManyAndReturn as jest.Mock).mockResolvedValue([
      { id: 11, storeRunId: 7, userId: 5, name: 'Milk', quantity: 2 },
    ]);

    await StoreRunService.addItemsBulk(7, 5, [
      { name: ' Milk ', quantity: 2, notes: ' Low fat ' },
    ]);

    expect(prisma.storeItem.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          storeRunId: 7,
          userId: 5,
          name: 'Milk',
          quantity: 2,
          notes: 'Low fat',
        },
      ],
    });
  });

  it('deletes only the participant own item before shopping starts', async () => {
    (prisma.storeItem.findUnique as jest.Mock).mockResolvedValue({
      id: 11,
      userId: 5,
      storeRun: { status: 'COLLECTING' },
    });
    (prisma.storeItem.delete as jest.Mock).mockResolvedValue({ id: 11 });

    await StoreRunService.deleteItem(11, 5);

    expect(prisma.storeItem.delete).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it('lets only the initiator start shopping', async () => {
    (prisma.storeRun.findUnique as jest.Mock).mockResolvedValue(baseRun);
    (prisma.storeRun.update as jest.Mock).mockResolvedValue({
      ...baseRun,
      status: 'SHOPPING',
    });

    await StoreRunService.startShopping(7, 5);

    expect(prisma.storeRun.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'SHOPPING', shoppingAt: expect.any(Date) },
    });
  });

  it('lets the initiator mark items as bought or not found while shopping', async () => {
    (prisma.storeItem.findUnique as jest.Mock).mockResolvedValue({
      id: 11,
      storeRun: { initiatorId: 5, status: 'SHOPPING' },
    });
    (prisma.storeItem.update as jest.Mock).mockResolvedValue({ id: 11 });

    await StoreRunService.setItemPrice(11, 5, 120, 'BOUGHT');
    await StoreRunService.setItemPrice(11, 5, null, 'NOT_FOUND');

    expect(prisma.storeItem.update).toHaveBeenNthCalledWith(1, {
      where: { id: 11 },
      data: {
        status: 'BOUGHT',
        price: new Prisma.Decimal(120),
      },
    });
    expect(prisma.storeItem.update).toHaveBeenNthCalledWith(2, {
      where: { id: 11 },
      data: {
        status: 'NOT_FOUND',
        price: null,
      },
    });
  });

  it('settles a shopping run and creates budget transactions', async () => {
    (prisma.storeRun.findUnique as jest.Mock).mockResolvedValue({
      ...baseRun,
      status: 'SHOPPING',
    });
    (BudgetService.createTransactionsForStoreRun as jest.Mock).mockResolvedValue([
      { id: 100 },
    ]);
    (prisma.storeRun.update as jest.Mock).mockResolvedValue({
      ...baseRun,
      status: 'SETTLED',
    });

    await StoreRunService.settle(7, 5);

    expect(BudgetService.createTransactionsForStoreRun).toHaveBeenCalledWith(7);
    expect(prisma.storeRun.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'SETTLED', settledAt: expect.any(Date) },
    });
  });

  it('cancels a collecting run by the initiator', async () => {
    (prisma.storeRun.findUnique as jest.Mock).mockResolvedValue(baseRun);
    (prisma.storeRun.update as jest.Mock).mockResolvedValue({
      ...baseRun,
      status: 'CANCELLED',
    });

    await StoreRunService.cancelStoreRun(7, 5);

    expect(prisma.storeRun.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
  });
});
