import { MenuService } from '../../../services/menu.service';
import { GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    menuItem: { createManyAndReturn: jest.fn() },
    groupMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../services/cache.service', () => ({
  CacheInvalidator: { invalidateMenu: jest.fn() },
  cacheService: { getOrSet: jest.fn() },
  CACHE_KEYS: { MENU_ITEMS_ACTIVE: 'menu_items_active' },
  CACHE_TTL: { MENU_ITEMS_ACTIVE: 300 },
}));

const { prisma } = require('../../../database/client');

const USER = 7;
const BASE = {
  name: 'Пицца',
  description: undefined,
  price: 500,
  imageUrl: undefined,
  isActive: true,
};

function adminOfGroup1() {
  prisma.groupMember.findFirst.mockImplementation(({ where }: any) =>
    Promise.resolve(where.groupId === 1 ? { id: 1 } : null)
  );
}

describe('MenuService.createMenuItemForGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one copy per group when the user is admin of all', async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
    prisma.menuItem.createManyAndReturn.mockResolvedValue([
      { id: 10, groupId: 1, name: 'Пицца' },
      { id: 11, groupId: 2, name: 'Пицца' },
    ]);

    const result = await MenuService.createMenuItemForGroups(
      BASE,
      USER,
      [1, 2]
    );

    expect(result).toHaveLength(2);
    const arg = prisma.menuItem.createManyAndReturn.mock.calls[0][0];
    expect(arg.data).toHaveLength(2);
    expect(arg.data.map((d: any) => d.groupId).sort()).toEqual([1, 2]);
    expect(arg.data.every((d: any) => d.createdBy === USER)).toBe(true);
  });

  it('creates nothing and throws if the user is not admin of one of the groups', async () => {
    adminOfGroup1();
    await expect(
      MenuService.createMenuItemForGroups(BASE, USER, [1, 2])
    ).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('dedupes group ids', async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
    prisma.menuItem.createManyAndReturn.mockResolvedValue([
      { id: 10, groupId: 1 },
    ]);
    await MenuService.createMenuItemForGroups(BASE, USER, [1, 1]);
    const arg = prisma.menuItem.createManyAndReturn.mock.calls[0][0];
    expect(arg.data).toHaveLength(1);
  });

  it('throws when groupIds is empty', async () => {
    await expect(
      MenuService.createMenuItemForGroups(BASE, USER, [])
    ).rejects.toThrow();
    expect(prisma.menuItem.createManyAndReturn).not.toHaveBeenCalled();
  });
});
