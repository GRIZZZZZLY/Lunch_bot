import { MenuService } from '../../../services/menu.service';
import { GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    menuItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    groupMember: { findFirst: jest.fn() },
    vote: { updateMany: jest.fn() },
    pollResult: { updateMany: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/cache.service', () => ({
  CacheInvalidator: { invalidateMenu: jest.fn() },
  cacheService: { getOrSet: jest.fn() },
  CACHE_KEYS: { MENU_ITEMS_ACTIVE: 'menu_items_active' },
  CACHE_TTL: { MENU_ITEMS_ACTIVE: 300 },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

// admin of group A (groupId=1), item belongs to group B (groupId=2)
const ADMIN_A = 7;
const ITEM_IN_B = { id: 777, groupId: 2 };

function mockAdminOf(groupId: number) {
  // isUserGroupAdmin → findFirst returns truthy only for the admin's own group
  prisma.groupMember.findFirst.mockImplementation(({ where }: any) =>
    Promise.resolve(where.groupId === 1 ? { id: 1 } : null),
  );
}

describe('MenuService write authorization (F2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminOf(1);
  });

  it('updateMenuItem: admin of A cannot edit an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue(ITEM_IN_B);
    await expect(
      MenuService.updateMenuItem(777, { name: 'hacked', groupId: 1 } as any, ADMIN_A),
    ).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('updateMenuItem: admin of own group succeeds, groupId is NOT moved', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ id: 555, groupId: 1 });
    prisma.menuItem.update.mockResolvedValue({ id: 555, groupId: 1, name: 'ok' });

    await MenuService.updateMenuItem(555, { name: 'ok', groupId: 2 } as any, ADMIN_A);

    const arg = prisma.menuItem.update.mock.calls[0][0];
    // scoped by id + groupId
    expect(arg.where).toEqual({ id: 555, groupId: 1 });
    // groupId stripped from data — no re-parenting
    expect(arg.data.groupId).toBeUndefined();
  });

  it('deleteMenuItem: admin of A cannot delete an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ ...ITEM_IN_B, _count: { votes: 0, pollResults: 0 } });
    await expect(MenuService.deleteMenuItem(777, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it('toggleMenuItemStatus: admin of A cannot toggle an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ isActive: true, groupId: 2 });
    await expect(MenuService.toggleMenuItemStatus(777, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('bulkUpdateStatus: rejects if any id belongs to a non-admin group', async () => {
    prisma.menuItem.findMany.mockResolvedValue([{ id: 10, groupId: 1 }, { id: 11, groupId: 2 }]);
    await expect(MenuService.bulkUpdateStatus([10, 11], false, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.updateMany).not.toHaveBeenCalled();
  });
});
