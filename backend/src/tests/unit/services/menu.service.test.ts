import { MenuService } from '../../../services/menu.service';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Мокаем Prisma клиент с jest-mock-extended
jest.mock('../../../database/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Мокаем логгер
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../../../database/client';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('MenuService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMenuItem', () => {
    it('should create a menu item successfully', async () => {
      const menuItemData = {
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 15.99,
        category: 'Main Course',
      };

      const expectedMenuItem = {
        id: 1,
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 15.99,
        category: 'Main Course',
        imageUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.menuItem.create.mockResolvedValue(expectedMenuItem);

      const result = await MenuService.createMenuItem(menuItemData);

      expect(mockPrisma.menuItem.create).toHaveBeenCalledWith({
        data: {
          name: menuItemData.name,
          description: menuItemData.description,
          price: menuItemData.price,
          category: menuItemData.category,
          imageUrl: undefined,
          isActive: true,
        },
      });

      expect(result).toEqual(expectedMenuItem);
      expect(logger.info).toHaveBeenCalledWith(
        `Menu item created: ${expectedMenuItem.id} (${expectedMenuItem.name})`
      );
    });

    it('should handle database error', async () => {
      const menuItemData = {
        name: 'Pizza',
        description: 'Delicious pizza',
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.menuItem.create.mockRejectedValue(dbError);

      await expect(MenuService.createMenuItem(menuItemData)).rejects.toThrow(
        'Failed to create menu item'
      );

      expect(logger.error).toHaveBeenCalledWith('Error creating menu item:', dbError);
    });
  });

  describe('getMenuItemById', () => {
    it('should return menu item when found', async () => {
      const itemId = 1;
      const expectedItem = {
        id: 1,
        name: 'Pizza',
        description: 'Delicious pizza',
        price: 15.99,
        category: 'Main Course',
        imageUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.menuItem.findUnique.mockResolvedValue(expectedItem);

      const result = await MenuService.getMenuItemById(itemId);

      expect(mockPrisma.menuItem.findUnique).toHaveBeenCalledWith({
        where: { id: itemId },
      });
      expect(result).toEqual(expectedItem);
    });

    it('should return null when item not found', async () => {
      const itemId = 999;
      mockPrisma.menuItem.findUnique.mockResolvedValue(null);

      const result = await MenuService.getMenuItemById(itemId);

      expect(result).toBeNull();
    });
  });

  describe('getActiveMenuItems', () => {
    it('should return only active menu items', async () => {
      const activeItems = [
        {
          id: 1,
          name: 'Pizza',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          name: 'Burger',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      mockPrisma.menuItem.findMany.mockResolvedValue(activeItems as any);

      const result = await MenuService.getActiveMenuItems();

      expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(activeItems);
    });
  });

  describe('searchMenuItems', () => {
    it('should search menu items by name and description', async () => {
      const query = 'pizza';
      const searchResults = [
        {
          id: 1,
          name: 'Pizza',
          description: 'Delicious pizza',
          isActive: true,
        },
      ];

      mockPrisma.menuItem.findMany.mockResolvedValue(searchResults as any);

      const result = await MenuService.searchMenuItems(query);

      expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(searchResults);
    });
  });

  describe('toggleMenuItemStatus', () => {
    it('should toggle item from active to inactive', async () => {
      const itemId = 1;
      const currentItem = { isActive: true };
      const updatedItem = {
        id: 1,
        name: 'Pizza',
        isActive: false,
        updatedAt: new Date(),
      };

      mockPrisma.menuItem.findUnique.mockResolvedValue(currentItem as any);
      mockPrisma.menuItem.update.mockResolvedValue(updatedItem as any);

      const result = await MenuService.toggleMenuItemStatus(itemId);

      expect(mockPrisma.menuItem.findUnique).toHaveBeenCalledWith({
        where: { id: itemId },
        select: { isActive: true },
      });

      expect(mockPrisma.menuItem.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(updatedItem);
      expect(logger.info).toHaveBeenCalledWith(
        `Menu item status toggled: ${itemId} -> ${updatedItem.isActive}`
      );
    });

    it('should throw error when item not found', async () => {
      const itemId = 999;
      mockPrisma.menuItem.findUnique.mockResolvedValue(null);

      await expect(MenuService.toggleMenuItemStatus(itemId)).rejects.toThrow(
        'Menu item not found'
      );
    });
  });

  describe('getMenuStats', () => {
    it('should return menu statistics', async () => {
      const categoriesResult = [
        { category: 'Main Course' },
        { category: 'Dessert' },
        { category: 'Drink' },
      ];
      const avgPriceResult = { _avg: { price: 12.5 } };

      mockPrisma.menuItem.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(45); // active

      mockPrisma.menuItem.findMany.mockResolvedValue(categoriesResult as any);
      mockPrisma.menuItem.aggregate.mockResolvedValue(avgPriceResult as any);

      const result = await MenuService.getMenuStats();

      expect(result).toEqual({
        total: 50,
        active: 45,
        categories: 3,
        averagePrice: 12.5,
      });
    });

    it('should handle zero average price', async () => {
      const avgPriceResult = { _avg: { price: null } };

      mockPrisma.menuItem.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);

      mockPrisma.menuItem.findMany.mockResolvedValue([]);
      mockPrisma.menuItem.aggregate.mockResolvedValue(avgPriceResult as any);

      const result = await MenuService.getMenuStats();

      expect(result.averagePrice).toBe(0);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple items status', async () => {
      const ids = [1, 2, 3];
      const isActive = false;
      const updateResult = { count: 3 };

      mockPrisma.menuItem.updateMany.mockResolvedValue(updateResult);

      const result = await MenuService.bulkUpdateStatus(ids, isActive);

      expect(mockPrisma.menuItem.updateMany).toHaveBeenCalledWith({
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

      expect(result).toBe(3);
      expect(logger.info).toHaveBeenCalledWith(
        `Bulk updated 3 menu items status to ${isActive}`
      );
    });
  });
});
