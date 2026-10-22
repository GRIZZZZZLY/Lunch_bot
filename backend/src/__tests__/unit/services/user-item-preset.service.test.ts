import { UserItemPresetService } from '../../../services/user-item-preset.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    userItemPreset: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    storeItem: { findMany: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { prisma } = require('../../../database/client');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.userItemPreset.findMany.mockResolvedValue([]);
  prisma.storeItem.findMany.mockResolvedValue([]);
  prisma.userItemPreset.deleteMany.mockResolvedValue({ count: 0 });
});

describe('UserItemPresetService.listForUser', () => {
  it('сбой подсчёта истории не роняет список', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        name: 'Молоко',
        normalizedName: 'молоко',
        quantity: 1,
        notes: null,
        pinned: false,
        usageCount: 1,
        lastUsedAt: new Date('2026-09-01'),
      },
    ]);
    prisma.storeItem.findMany.mockRejectedValue(new Error('db down'));

    await expect(
      UserItemPresetService.listForUser(7, { storeId: 5, groupId: 9 }),
    ).resolves.toHaveLength(1);
  });
});

describe('UserItemPresetService.recordUsage', () => {
  it('пустое имя не создаёт запись', async () => {
    await UserItemPresetService.recordUsage(7, { name: '   ' });
    expect(prisma.userItemPreset.upsert).not.toHaveBeenCalled();
  });

  it('сбой записи не выходит наружу', async () => {
    prisma.userItemPreset.upsert.mockRejectedValue(new Error('db down'));

    await expect(
      UserItemPresetService.recordUsage(7, { name: 'Молоко' }),
    ).resolves.toBeUndefined();
  });
});
