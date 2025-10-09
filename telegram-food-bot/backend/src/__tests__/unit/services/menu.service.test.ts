import { MenuService } from '../../../services/menu.service';
import { MenuItem } from '@prisma/client';

// Mock dependencies
jest.mock('../../../database/client', () => ({
  prisma: {
    menuItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
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

jest.mock('../../../services/cache.service', () => ({
  cacheService: {
    getOrSet: jest.fn(),
  },
  CacheInvalidator: {
    invalidateMenu: jest.fn(),
  },
  CACHE_KEYS: {
    MENU_ITEMS_ACTIVE: 'menu_items_active',
    MENU_ITEMS_BY_CATEGORY: (category: string) => `menu_items_by_category_${category}`,
  },
  CACHE_TTL: {
    MENU: 300,
  },
}));

// Import mocked dependencies
import { prisma } from '../../../database/client';
import { cacheService, CacheInvalidator } from '../../../services/cache.service';

describe('MenuService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMenuItem', () => {
    it('should create menu item successfully', async () => {
      // Arrange
      const createData = {
        name: 'Pizza Margherita',
        description: 'Classic Italian pizza',
        price: 12.99,
        category: 'Main Course',
        imageUrl: 'https://example.com/pizza.jpg',
        isActive: true,
        createdBy: 1,
      };

      const expectedMenuItem: MenuItem = {
        id: 1,
        name: createData.name,
        description: createData.description,
        price: createData.price,
        category: createData.category,
        imageUrl: createData.imageUrl,
        isActive: true,
        createdBy: createData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.menuItem.create as jest.Mock).mockResolvedValue(expectedMenuItem);

      // Act
      const result = await MenuService.createMenuItem(createData);

      // Assert
      expect(prisma.menuItem.create).toHaveBeenCalledWith({
        data: {
          name: createData.name,
          description: createData.description,
          price: createData.price,
          category: createData.category,
          imageUrl: createData.imageUrl,
          isActive: true,
          createdBy: createData.createdBy,
        },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toEqual(expectedMenuItem);
    });

    it('should create menu item with default isActive=true', async () => {
      // Arrange
      const createData = {
        name: 'Burger',
        createdBy: 1,
      };

      const expectedMenuItem: MenuItem = {
        id: 2,
        name: createData.name,
        description: null,
        price: null,
        category: null,
        imageUrl: null,
        isActive: true,
        createdBy: createData.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.menuItem.create as jest.Mock).mockResolvedValue(expectedMenuItem);

      // Act
      const result = await MenuService.createMenuItem(createData);

      // Assert
      expect(result.isActive).toBe(true);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const createData = {
        name: 'Pizza',
        createdBy: 1,
      };

      (prisma.menuItem.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.createMenuItem(createData)).rejects.toThrow('Failed to create menu item');
    });
  });

  describe('getMenuItemById', () => {
    it('should return menu item when exists', async () => {
      // Arrange
      const menuItemId = 1;
      const expectedMenuItem: MenuItem = {
        id: menuItemId,
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 10.99,
        category: 'Main Course',
        imageUrl: 'pizza.jpg',
        isActive: true,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(expectedMenuItem);

      // Act
      const result = await MenuService.getMenuItemById(menuItemId);

      // Assert
      expect(prisma.menuItem.findUnique).toHaveBeenCalledWith({
        where: { id: menuItemId },
      });
      expect(result).toEqual(expectedMenuItem);
    });

    it('should return null when menu item not found', async () => {
      // Arrange
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await MenuService.getMenuItemById(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      (prisma.menuItem.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.getMenuItemById(1)).rejects.toThrow('Failed to get menu item');
    });
  });

  describe('updateMenuItem', () => {
    it('should update menu item successfully', async () => {
      // Arrange
      const menuItemId = 1;
      const updateData = {
        name: 'Updated Pizza',
        price: 15.99,
      };

      const expectedMenuItem: MenuItem = {
        id: menuItemId,
        name: updateData.name,
        description: 'Delicious pizza',
        price: updateData.price,
        category: 'Main Course',
        imageUrl: 'pizza.jpg',
        isActive: true,
        createdBy: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.menuItem.update as jest.Mock).mockResolvedValue(expectedMenuItem);

      // Act
      const result = await MenuService.updateMenuItem(menuItemId, updateData);

      // Assert
      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: menuItemId },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toEqual(expectedMenuItem);
    });

    it('should throw error when menu item not found', async () => {
      // Arrange
      const menuItemId = 999;
      const updateData = { name: 'Updated' };

      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      (prisma.menuItem.update as jest.Mock).mockRejectedValue(prismaError);

      // Act & Assert
      await expect(MenuService.updateMenuItem(menuItemId, updateData)).rejects.toThrow('Failed to update menu item');
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const menuItemId = 1;
      const updateData = { name: 'Updated' };

      (prisma.menuItem.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.updateMenuItem(menuItemId, updateData)).rejects.toThrow('Failed to update menu item');
    });
  });

  describe('deleteMenuItem', () => {
    it('should delete menu item without related data', async () => {
      // Arrange
      const menuItemId = 1;
      const menuItemWithCounts = {
        id: menuItemId,
        name: 'Pizza',
        description: 'Delicious',
        price: 10.99,
        category: 'Main',
        imageUrl: null,
        isActive: true,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          votes: 0,
          pollResults: 0,
        },
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(menuItemWithCounts);
      (prisma.menuItem.delete as jest.Mock).mockResolvedValue({});

      // Act
      await MenuService.deleteMenuItem(menuItemId);

      // Assert
      expect(prisma.menuItem.findUnique).toHaveBeenCalledWith({
        where: { id: menuItemId },
        include: {
          _count: {
            select: {
              votes: true,
              pollResults: true,
            },
          },
        },
      });
      expect(prisma.vote.updateMany).not.toHaveBeenCalled();
      expect(prisma.pollResult.updateMany).not.toHaveBeenCalled();
      expect(prisma.menuItem.delete).toHaveBeenCalledWith({
        where: { id: menuItemId },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
    });

    it('should delete menu item and clean up related data', async () => {
      // Arrange
      const menuItemId = 1;
      const menuItemWithCounts = {
        id: menuItemId,
        name: 'Pizza',
        description: 'Delicious',
        price: 10.99,
        category: 'Main',
        imageUrl: null,
        isActive: true,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          votes: 5,
          pollResults: 2,
        },
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(menuItemWithCounts);
      (prisma.vote.updateMany as jest.Mock).mockResolvedValue({ count: 5 });
      (prisma.pollResult.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.menuItem.delete as jest.Mock).mockResolvedValue({});

      // Act
      await MenuService.deleteMenuItem(menuItemId);

      // Assert
      expect(prisma.vote.updateMany).toHaveBeenCalledWith({
        where: { menuItemId },
        data: { menuItemId: null },
      });
      expect(prisma.pollResult.updateMany).toHaveBeenCalledWith({
        where: { winnerMenuItemId: menuItemId },
        data: { winnerMenuItemId: null },
      });
      expect(prisma.menuItem.delete).toHaveBeenCalledWith({
        where: { id: menuItemId },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
    });

    it('should throw error when menu item not found', async () => {
      // Arrange
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(MenuService.deleteMenuItem(999)).rejects.toThrow('Menu item not found');
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const menuItemWithCounts = {
        id: 1,
        _count: { votes: 0, pollResults: 0 },
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(menuItemWithCounts);
      (prisma.menuItem.delete as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.deleteMenuItem(1)).rejects.toThrow('Failed to delete menu item');
    });
  });

  describe('getAllMenuItems', () => {
    it('should return all menu items sorted', async () => {
      // Arrange
      const expectedItems: MenuItem[] = [
        {
          id: 1,
          name: 'Apple Pie',
          description: null,
          price: 5.99,
          category: 'Dessert',
          imageUrl: null,
          isActive: true,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'Burger',
          description: null,
          price: 8.99,
          category: 'Main',
          imageUrl: null,
          isActive: false,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(expectedItems);

      // Act
      const result = await MenuService.getAllMenuItems();

      // Assert
      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
      });
      expect(result).toEqual(expectedItems);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      (prisma.menuItem.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.getAllMenuItems()).rejects.toThrow('Failed to get menu items');
    });
  });

  describe('getActiveMenuItems', () => {
    it('should return active menu items from cache', async () => {
      // Arrange
      const expectedItems: MenuItem[] = [
        {
          id: 1,
          name: 'Pizza',
          description: 'Delicious',
          price: 10.99,
          category: 'Main',
          imageUrl: null,
          isActive: true,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (cacheService.getOrSet as jest.Mock).mockResolvedValue(expectedItems);

      // Act
      const result = await MenuService.getActiveMenuItems();

      // Assert
      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(expectedItems);
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (cacheService.getOrSet as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Act & Assert
      await expect(MenuService.getActiveMenuItems()).rejects.toThrow('Failed to get active menu items');
    });
  });

  describe('getMenuItemsByCategory', () => {
    it('should return menu items by category from cache', async () => {
      // Arrange
      const category = 'Main Course';
      const expectedItems: MenuItem[] = [
        {
          id: 1,
          name: 'Pizza',
          description: 'Delicious',
          price: 10.99,
          category,
          imageUrl: null,
          isActive: true,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (cacheService.getOrSet as jest.Mock).mockResolvedValue(expectedItems);

      // Act
      const result = await MenuService.getMenuItemsByCategory(category);

      // Assert
      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(expectedItems);
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (cacheService.getOrSet as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Act & Assert
      await expect(MenuService.getMenuItemsByCategory('Main')).rejects.toThrow('Failed to get menu items by category');
    });
  });

  describe('searchMenuItems', () => {
    it('should search menu items by name or description', async () => {
      // Arrange
      const query = 'pizza';
      const expectedItems: MenuItem[] = [
        {
          id: 1,
          name: 'Pizza Margherita',
          description: 'Classic pizza',
          price: 10.99,
          category: 'Main',
          imageUrl: null,
          isActive: true,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(expectedItems);

      // Act
      const result = await MenuService.searchMenuItems(query);

      // Assert
      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(expectedItems);
    });

    it('should throw error when search fails', async () => {
      // Arrange
      (prisma.menuItem.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.searchMenuItems('test')).rejects.toThrow('Failed to search menu items');
    });
  });

  describe('toggleMenuItemStatus', () => {
    it('should toggle menu item status from active to inactive', async () => {
      // Arrange
      const menuItemId = 1;
      const currentItem = { isActive: true };
      const updatedItem: MenuItem = {
        id: menuItemId,
        name: 'Pizza',
        description: null,
        price: 10.99,
        category: null,
        imageUrl: null,
        isActive: false,
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(currentItem);
      (prisma.menuItem.update as jest.Mock).mockResolvedValue(updatedItem);

      // Act
      const result = await MenuService.toggleMenuItemStatus(menuItemId);

      // Assert
      expect(prisma.menuItem.findUnique).toHaveBeenCalledWith({
        where: { id: menuItemId },
        select: { isActive: true },
      });
      expect(prisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: menuItemId },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
    });

    it('should throw error when menu item not found', async () => {
      // Arrange
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(MenuService.toggleMenuItemStatus(999)).rejects.toThrow('Menu item not found');
    });

    it('should throw error when update fails', async () => {
      // Arrange
      const currentItem = { isActive: true };
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(currentItem);
      (prisma.menuItem.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.toggleMenuItemStatus(1)).rejects.toThrow('Failed to toggle menu item status');
    });
  });

  describe('getPopularMenuItems', () => {
    it('should return popular menu items with stats', async () => {
      // Arrange
      const limit = 5;
      const popularItems = [
        {
          id: 1,
          name: 'Pizza',
          description: 'Delicious',
          price: 10.99,
          category: 'Main',
          imageUrl: null,
          isActive: true,
          createdBy: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            votes: 50,
            pollResults: 10,
          },
        },
      ];

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(popularItems);

      // Act
      const result = await MenuService.getPopularMenuItems(limit);

      // Assert
      expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
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
        take: limit,
      });
      expect(result[0].voteCount).toBe(50);
      expect(result[0].winCount).toBe(10);
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (prisma.menuItem.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.getPopularMenuItems()).rejects.toThrow('Failed to get popular menu items');
    });
  });

  describe('getCategories', () => {
    it('should return sorted categories from cache', async () => {
      // Arrange
      const expectedCategories = ['Appetizer', 'Dessert', 'Main Course'];

      (cacheService.getOrSet as jest.Mock).mockResolvedValue(expectedCategories);

      // Act
      const result = await MenuService.getCategories();

      // Assert
      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(expectedCategories);
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (cacheService.getOrSet as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Act & Assert
      await expect(MenuService.getCategories()).rejects.toThrow('Failed to get categories');
    });
  });

  describe('getMenuStats', () => {
    it('should return menu statistics successfully', async () => {
      // Arrange
      (prisma.menuItem.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85); // active

      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
        { category: 'Main' },
        { category: 'Dessert' },
        { category: 'Appetizer' },
      ]);

      (prisma.menuItem.aggregate as jest.Mock).mockResolvedValue({
        _avg: { price: 12.5 },
      });

      // Act
      const result = await MenuService.getMenuStats();

      // Assert
      expect(prisma.menuItem.count).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        total: 100,
        active: 85,
        categories: 3,
        averagePrice: 12.5,
      });
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (prisma.menuItem.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.getMenuStats()).rejects.toThrow('Failed to get menu stats');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update menu items status', async () => {
      // Arrange
      const ids = [1, 2, 3];
      const isActive = false;
      const updateResult = { count: 3 };

      (prisma.menuItem.updateMany as jest.Mock).mockResolvedValue(updateResult);

      // Act
      const result = await MenuService.bulkUpdateStatus(ids, isActive);

      // Assert
      expect(prisma.menuItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          isActive,
          updatedAt: expect.any(Date),
        },
      });
      expect(CacheInvalidator.invalidateMenu).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it('should throw error when operation fails', async () => {
      // Arrange
      (prisma.menuItem.updateMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(MenuService.bulkUpdateStatus([1], true)).rejects.toThrow('Failed to bulk update menu items');
    });
  });
});
