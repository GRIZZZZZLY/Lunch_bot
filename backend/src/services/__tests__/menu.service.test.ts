import { MenuService } from '../menu.service';
import { prisma } from '../../database/client';
import { MenuItem, Prisma } from '@prisma/client';
import { cacheService, CacheInvalidator } from '../cache.service';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    menuItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    vote: {
      updateMany: jest.fn(),
    },
    pollResult: {
      updateMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock cache service
jest.mock('../cache.service', () => ({
  cacheService: {
    getOrSet: jest.fn(),
  },
  CacheInvalidator: {
    invalidateMenu: jest.fn(),
  },
  CACHE_KEYS: {
    MENU_ITEMS_ACTIVE: 'menu_items_active',
  },
  CACHE_TTL: {
    MENU: 300,
  },
}));

// Авторизация (F2) тестируется отдельно в menu-authz.service.test.ts.
// Здесь проверяется бизнес-логика меню, поэтому assertAdmin всегда проходит.
jest.mock('../group.service', () => ({
  GroupService: { assertAdmin: jest.fn().mockResolvedValue(undefined) },
  GroupAccessError: class GroupAccessError extends Error {},
}));

// id пользователя, выполняющего операцию (админ группы в этих тестах).
const ACTING_USER = 1;

type MenuItemOverrides = Omit<Partial<MenuItem>, 'price'> & {
  price?: number | Prisma.Decimal | null;
};

const toDecimal = (value: number | Prisma.Decimal): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

// Helper function to create mock menu item
const createMockMenuItem = (overrides?: MenuItemOverrides): MenuItem => {
  const { price, ...restOverrides } = overrides || {};

  return {
    id: 1,
    name: 'Test Dish',
    description: 'Test Description',
    price:
      price === undefined
        ? new Prisma.Decimal(100)
        : price === null
        ? null
        : toDecimal(price),
    imageUrl: 'https://example.com/image.jpg',
    isActive: true,
    createdBy: 1,
    groupId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...restOverrides,
  };
};

describe('MenuService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMenuItem', () => {
    it('should create a new menu item successfully', async () => {
      const mockData = {
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 500,
        imageUrl: 'https://example.com/pizza.jpg',
        isActive: true,
        createdBy: 1,
        groupId: 1,
      };

      const mockCreatedItem = createMockMenuItem(mockData);

      (prisma.menuItem.create as jest.Mock).mockResolvedValue(mockCreatedItem);

      const result = await MenuService.createMenuItem(mockData);

      expect(prisma.menuItem.create).toHaveBeenCalledWith({
        data: {
          name: mockData.name,
          description: mockData.description,
          price: mockData.price,
          imageUrl: mockData.imageUrl,
          isActive: mockData.isActive,
          createdBy: mockData.createdBy,
          groupId: mockData.groupId,
        },
      });

      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedItem);
    });

    it('should create menu item with default isActive=true if not provided', async () => {
      const mockData = {
        name: 'Burger',
        createdBy: 1,
        groupId: 1,
      };

      const mockCreatedItem = createMockMenuItem({ name: 'Burger', isActive: true });

      (prisma.menuItem.create as jest.Mock).mockResolvedValue(mockCreatedItem);

      await MenuService.createMenuItem(mockData);

      expect(prisma.menuItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: true,
        }),
      });
    });

    it('should throw an error if creation fails', async () => {
      const mockData = {
        name: 'Pizza',
        createdBy: 1,
        groupId: 1,
      };

      (prisma.menuItem.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(MenuService.createMenuItem(mockData)).rejects.toThrow('Failed to create menu item');
    });
  });

  describe('getMenuItemById', () => {
    it('should return menu item if found', async () => {
      const mockItem = createMockMenuItem();

      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(mockItem);

      const result = await MenuService.getMenuItemById(1);

      expect(prisma.menuItem.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });

      expect(result).toEqual(mockItem);
    });

    it('should return null if menu item not found', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await MenuService.getMenuItemById(999);

      expect(result).toBeNull();
    });

    it('should throw an error if query fails', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(MenuService.getMenuItemById(1)).rejects.toThrow('Failed to get menu item');
    });
  });

  describe('updateMenuItem', () => {
    it('should update menu item successfully', async () => {
      const mockUpdatedItem = createMockMenuItem({
        name: 'Updated Pizza',
        price: 600,
      });

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue({ groupId: 1 });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue(mockUpdatedItem);

      const result = await MenuService.updateMenuItem(1, {
        name: 'Updated Pizza',
        price: 600,
      }, ACTING_USER);

      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: 1, groupId: 1 },
        data: {
          name: 'Updated Pizza',
          price: 600,
          updatedAt: expect.any(Date),
        },
      });

      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedItem);
    });

    it('should ignore create-only groupIds when updating a menu item', async () => {
      const mockUpdatedItem = createMockMenuItem({
        name: 'Updated Pizza',
        price: 600,
      });

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue({ groupId: 1 });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue(mockUpdatedItem);

      await MenuService.updateMenuItem(1, {
        name: 'Updated Pizza',
        price: 600,
        groupId: 1,
        groupIds: [1],
      } as any, ACTING_USER);

      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: 1, groupId: 1 },
        data: {
          name: 'Updated Pizza',
          price: 600,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if menu item not found', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        MenuService.updateMenuItem(999, { name: 'Test' }, ACTING_USER)
      ).rejects.toThrow('Menu item not found');
    });
  });

  describe('deleteMenuItem', () => {
    it('помечает блюдо удалённым и гасит isActive, а строку не трогает', async () => {
      const mockItem = {
        ...createMockMenuItem(),
        _count: {
          votes: 0,
          pollResults: 0,
        },
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.menuItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await MenuService.deleteMenuItem(1, ACTING_USER);

      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: { id: 1, groupId: 1, deletedAt: null },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
      expect(prisma.menuItem.delete).not.toHaveBeenCalled();
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
    });

    /* Регрессия. Раньше удаление обнуляло menuItemId у ВСЕХ голосов за блюдо и
       winnerMenuItemId у ВСЕХ результатов, где оно побеждало: администратор
       убирал блюдо из меню и молча стирал победителей в завершённых опросах
       всей группы. Голоса и результаты должны пережить удаление. */
    it('не трогает историю: голоса и результаты опросов остаются на месте', async () => {
      const mockItem = {
        ...createMockMenuItem(),
        _count: {
          votes: 5,
          pollResults: 2,
        },
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.menuItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await MenuService.deleteMenuItem(1, ACTING_USER);

      expect(prisma.vote.updateMany).not.toHaveBeenCalled();
      expect(prisma.pollResult.updateMany).not.toHaveBeenCalled();
      expect(prisma.menuItem.delete).not.toHaveBeenCalled();
    });

    it('should throw error if menu item not found', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(MenuService.deleteMenuItem(999, ACTING_USER)).rejects.toThrow('Menu item not found');
    });
  });

  describe('getAllMenuItems', () => {
    it('should return all menu items ordered by active status and name', async () => {
      const mockItems = [
        createMockMenuItem({ id: 1, name: 'Apple', isActive: true }),
        createMockMenuItem({ id: 2, name: 'Banana', isActive: true }),
        createMockMenuItem({ id: 3, name: 'Cherry', isActive: false }),
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(mockItems);

      const result = await MenuService.getAllMenuItems(1);

      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        where: { groupId: 1, deletedAt: null },
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
      });

      expect(result).toEqual(mockItems);
    });
  });

  describe('getActiveMenuItems', () => {
    it('should return active menu items from cache or database', async () => {
      const mockActiveItems = [
        createMockMenuItem({ id: 1, name: 'Pizza', isActive: true }),
        createMockMenuItem({ id: 2, name: 'Burger', isActive: true }),
      ];

      (cacheService.getOrSet as jest.Mock).mockImplementation(async (key, fetchFn) => {
        return await fetchFn();
      });

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(mockActiveItems);

      const result = await MenuService.getActiveMenuItems(1);

      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockActiveItems);
    });
  });

  describe('searchMenuItems', () => {
    it('should search menu items by name or description', async () => {
      const mockItems = [
        createMockMenuItem({ name: 'Cheese Pizza', description: 'Pizza with cheese' }),
        createMockMenuItem({ name: 'Pepperoni', description: 'Pizza with pepperoni' }),
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(mockItems);

      const result = await MenuService.searchMenuItems('pizza', 1);

      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'pizza' } },
            { description: { contains: 'pizza' } },
          ],
          isActive: true,
          groupId: 1,
        },
        orderBy: { name: 'asc' },
      });

      expect(result).toEqual(mockItems);
    });
  });

  describe('toggleMenuItemStatus', () => {
    it('should toggle menu item status from active to inactive', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue({
        isActive: true,
        groupId: 1,
      });

      const mockToggledItem = createMockMenuItem({ isActive: false });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue(mockToggledItem);

      const result = await MenuService.toggleMenuItemStatus(1, ACTING_USER);

      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: 1, groupId: 1 },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });

      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });

    it('should toggle menu item status from inactive to active', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue({
        isActive: false,
        groupId: 1,
      });

      const mockToggledItem = createMockMenuItem({ isActive: true });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue(mockToggledItem);

      const result = await MenuService.toggleMenuItemStatus(1, ACTING_USER);

      expect(result.isActive).toBe(true);
    });

    it('should throw error if menu item not found', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(MenuService.toggleMenuItemStatus(999, ACTING_USER)).rejects.toThrow('Menu item not found');
    });
  });

  describe('getPopularMenuItems', () => {
    it('should return popular menu items with stats', async () => {
      const mockPopularItems = [
        {
          ...createMockMenuItem({ id: 1, name: 'Pizza' }),
          _count: {
            votes: 50,
            pollResults: 10,
          },
        },
        {
          ...createMockMenuItem({ id: 2, name: 'Burger' }),
          _count: {
            votes: 30,
            pollResults: 5,
          },
        },
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(mockPopularItems);

      const result = await MenuService.getPopularMenuItems(10, 1);

      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true, groupId: 1, deletedAt: null },
        include: {
          _count: {
            select: {
              votes: true,
              pollResults: true,
            },
          },
        },
        orderBy: {
          votes: {
            _count: 'desc',
          },
        },
        take: 10,
      });

      expect(result[0]).toHaveProperty('voteCount', 50);
      expect(result[0]).toHaveProperty('winCount', 10);
      expect(result[1]).toHaveProperty('voteCount', 30);
      expect(result[1]).toHaveProperty('winCount', 5);
    });
  });

  describe('getMenuStats', () => {
    it('should return menu statistics', async () => {
      (prisma.menuItem.count as jest.Mock)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40); // active

      (prisma.menuItem.aggregate as jest.Mock).mockResolvedValue({
        _avg: {
          price: 350.5,
        },
      });

      const result = await MenuService.getMenuStats(1);

      expect(result).toEqual({
        total: 50,
        active: 40,
        averagePrice: 350.5,
      });
    });

    it('should handle null average price', async () => {
      (prisma.menuItem.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);

      (prisma.menuItem.aggregate as jest.Mock).mockResolvedValue({
        _avg: {
          price: null,
        },
      });

      const result = await MenuService.getMenuStats(1);

      expect(result.averagePrice).toBe(0);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update menu items status', async () => {
      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([{ groupId: 1 }, { groupId: 1 }, { groupId: 1 }]);
      (prisma.menuItem.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await MenuService.bulkUpdateStatus([1, 2, 3], false, ACTING_USER);

      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [1, 2, 3],
          },
          groupId: {
            in: [1],
          },
          deletedAt: null,
        },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });

      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('should return 0 if no items were updated', async () => {
      (prisma.menuItem.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);

      const result = await MenuService.bulkUpdateStatus([999], true, ACTING_USER);

      expect(result).toBe(0);
    });
  });

  describe('getActiveMenuItems (per-group)', () => {
    it('запрашивает только блюда указанной группы', async () => {
      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([createMockMenuItem({ groupId: 7 })]);
      (cacheService.getOrSet as jest.Mock).mockImplementation(async (_k: string, fn: any) => fn());
      await MenuService.getActiveMenuItems(7);
      expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, groupId: 7, deletedAt: null } })
      );
    });

    it('использует per-group ключ кэша', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue([]);
      await MenuService.getActiveMenuItems(7);
      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'menu_items_active:7', expect.any(Function), 300
      );
    });
  });
});
