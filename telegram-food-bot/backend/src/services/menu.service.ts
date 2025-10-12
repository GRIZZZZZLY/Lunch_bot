import { MenuItem, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateMenuItemData, UpdateMenuItemData, MenuItemWithStats } from '../types/menu.types';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheInvalidator } from './cache.service';

export class MenuService {
  /**
   * Создание нового блюда (с инвалидацией кэша)
   */
  static async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      const menuItem = await prisma.menuItem.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          imageUrl: data.imageUrl,
          isActive: data.isActive ?? true,
          createdBy: data.createdBy,
        },
      });

      // Инвалидируем кэш меню
      CacheInvalidator.invalidateMenu();

      logger.info(`Menu item created: ${menuItem.id} (${menuItem.name})`);
      return menuItem;
    } catch (error) {
      logger.error('Error creating menu item:', error);
      throw new Error('Failed to create menu item');
    }
  }

  /**
   * Получение блюда по ID
   */
  static async getMenuItemById(id: number): Promise<MenuItem | null> {
    try {
      return await prisma.menuItem.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Error getting menu item by ID:', error);
      throw new Error('Failed to get menu item');
    }
  }

  /**
   * Обновление блюда (с инвалидацией кэша)
   */
  static async updateMenuItem(id: number, data: UpdateMenuItemData): Promise<MenuItem> {
    try {
      const menuItem = await prisma.menuItem.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      // Инвалидируем кэш меню
      CacheInvalidator.invalidateMenu();

      logger.info(`Menu item updated: ${menuItem.id} (${menuItem.name})`);
      return menuItem;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Menu item not found');
        }
      }
      logger.error('Error updating menu item:', error);
      throw new Error('Failed to update menu item');
    }
  }

  /**
   * Удаление блюда (с инвалидацией кэша)
   * Проверяет наличие связанных голосов и результатов перед удалением
   */
  static async deleteMenuItem(id: number): Promise<void> {
    try {
      // Проверяем есть ли связанные голоса или результаты
      const menuItem = await prisma.menuItem.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              votes: true,
              pollResults: true,
            },
          },
        },
      });

      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      // Если есть связанные данные, сначала очищаем их
      if (menuItem._count.votes > 0 || menuItem._count.pollResults > 0) {
        logger.info(`Menu item ${id} has related data, cleaning up...`, {
          votes: menuItem._count.votes,
          pollResults: menuItem._count.pollResults,
        });

        // Удаляем связанные голоса (set menuItemId to null)
        await prisma.vote.updateMany({
          where: { menuItemId: id },
          data: { menuItemId: null },
        });

        // Удаляем связанные результаты голосований (set winnerMenuItemId to null)
        await prisma.pollResult.updateMany({
          where: { winnerMenuItemId: id },
          data: { winnerMenuItemId: null },
        });
      }

      // Теперь можно безопасно удалить блюдо
      await prisma.menuItem.delete({
        where: { id },
      });

      // Инвалидируем кэш меню
      CacheInvalidator.invalidateMenu();

      logger.info(`Menu item deleted: ${id}`, {
        cleanedVotes: menuItem._count.votes,
        cleanedResults: menuItem._count.pollResults,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Menu item not found') {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Menu item not found');
        }
        if (error.code === 'P2003') {
          throw new Error('Cannot delete menu item: it is referenced by other records');
        }
      }
      logger.error('Error deleting menu item:', error);
      throw new Error('Failed to delete menu item');
    }
  }

  /**
   * Получение всех блюд
   */
  static async getAllMenuItems(): Promise<MenuItem[]> {
    try {
      return await prisma.menuItem.findMany({
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
      });
    } catch (error) {
      logger.error('Error getting all menu items:', error);
      throw new Error('Failed to get menu items');
    }
  }

  /**
   * Получение блюд по списку ID
   * Используется для "Повторить вчерашнее"
   */
  static async getMenuItemsByIds(ids: number[]): Promise<MenuItem[]> {
    try {
      if (!ids || ids.length === 0) {
        return [];
      }

      return await prisma.menuItem.findMany({
        where: {
          id: { in: ids },
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Error getting menu items by IDs:', error);
      throw new Error('Failed to get menu items by IDs');
    }
  }

  /**
   * Получение активных блюд (С КЭШИРОВАНИЕМ)
   */
  static async getActiveMenuItems(): Promise<MenuItem[]> {
    try {
      return await cacheService.getOrSet(
        CACHE_KEYS.MENU_ITEMS_ACTIVE,
        async () => {
          return await prisma.menuItem.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              category: true,
              imageUrl: true,
              isActive: true,
              createdBy: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: 'asc' },
          });
        },
        CACHE_TTL.MENU
      );
    } catch (error) {
      logger.error('Error getting active menu items:', error);
      throw new Error('Failed to get active menu items');
    }
  }

  /**
   * Получение блюд по категории (С КЭШИРОВАНИЕМ)
   */
  static async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    try {
      return await cacheService.getOrSet(
        CACHE_KEYS.MENU_ITEMS_BY_CATEGORY(category),
        async () => {
          return await prisma.menuItem.findMany({
            where: {
              category,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              category: true,
              imageUrl: true,
              isActive: true,
              createdBy: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: 'asc' },
          });
        },
        CACHE_TTL.MENU
      );
    } catch (error) {
      logger.error('Error getting menu items by category:', error);
      throw new Error('Failed to get menu items by category');
    }
  }

  /**
   * Поиск блюд по названию
   */
  static async searchMenuItems(query: string): Promise<MenuItem[]> {
    try {
      return await prisma.menuItem.findMany({
        where: {
          OR: [
            {
              name: {
                contains: query,
              },
            },
            {
              description: {
                contains: query,
              },
            },
          ],
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Error searching menu items:', error);
      throw new Error('Failed to search menu items');
    }
  }

  /**
   * Переключение статуса активности блюда (с инвалидацией кэша)
   */
  static async toggleMenuItemStatus(id: number): Promise<MenuItem> {
    try {
      // Сначала получаем текущий статус
      const currentItem = await prisma.menuItem.findUnique({
        where: { id },
        select: { isActive: true },
      });

      if (!currentItem) {
        throw new Error('Menu item not found');
      }

      // Переключаем статус
      const menuItem = await prisma.menuItem.update({
        where: { id },
        data: {
          isActive: !currentItem.isActive,
          updatedAt: new Date(),
        },
      });

      // Инвалидируем кэш меню
      CacheInvalidator.invalidateMenu();

      logger.info(`Menu item status toggled: ${id} -> ${menuItem.isActive}`);
      return menuItem;
    } catch (error) {
      if (error instanceof Error && error.message === 'Menu item not found') {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Menu item not found');
        }
      }
      logger.error('Error toggling menu item status:', error);
      throw new Error('Failed to toggle menu item status');
    }
  }

  /**
   * Получение популярных блюд с статистикой
   */
  static async getPopularMenuItems(limit: number = 10): Promise<MenuItemWithStats[]> {
    try {
      const popularItems = await prisma.menuItem.findMany({
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

      return popularItems.map(item => ({
        ...item,
        voteCount: item._count.votes,
        winCount: item._count.pollResults,
      }));
    } catch (error) {
      logger.error('Error getting popular menu items:', error);
      throw new Error('Failed to get popular menu items');
    }
  }

  /**
   * Получение всех категорий (С КЭШИРОВАНИЕМ)
   */
  static async getCategories(): Promise<string[]> {
    try {
      return await cacheService.getOrSet(
        'menu_categories',
        async () => {
          const categories = await prisma.menuItem.findMany({
            where: {
              category: { not: null },
              isActive: true,
            },
            select: { category: true },
            distinct: ['category'],
          });

          return categories
            .map(item => item.category!)
            .filter(Boolean)
            .sort();
        },
        CACHE_TTL.MENU
      );
    } catch (error) {
      logger.error('Error getting categories:', error);
      throw new Error('Failed to get categories');
    }
  }

  /**
   * Получение статистики меню
   */
  static async getMenuStats(): Promise<{
    total: number;
    active: number;
    categories: number;
    averagePrice: number;
  }> {
    try {
      const [total, active, categoriesResult, avgPriceResult] = await Promise.all([
        prisma.menuItem.count(),
        prisma.menuItem.count({ where: { isActive: true } }),
        prisma.menuItem.findMany({
          where: { category: { not: null } },
          select: { category: true },
          distinct: ['category'],
        }),
        prisma.menuItem.aggregate({
          where: {
            price: { not: null },
            isActive: true,
          },
          _avg: { price: true },
        }),
      ]);

      const categories = categoriesResult.length;
      const averagePrice = avgPriceResult._avg.price || 0;

      return {
        total,
        active,
        categories,
        averagePrice: Math.round(averagePrice * 100) / 100,
      };
    } catch (error) {
      logger.error('Error getting menu stats:', error);
      throw new Error('Failed to get menu stats');
    }
  }

  /**
   * Массовое обновление статуса блюд (с инвалидацией кэша)
   */
  static async bulkUpdateStatus(ids: number[], isActive: boolean): Promise<number> {
    try {
      const result = await prisma.menuItem.updateMany({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          isActive,
          updatedAt: new Date(),
        },
      });

      // Инвалидируем кэш меню
      CacheInvalidator.invalidateMenu();

      logger.info(`Bulk updated ${result.count} menu items status to ${isActive}`);
      return result.count;
    } catch (error) {
      logger.error('Error bulk updating menu items:', error);
      throw new Error('Failed to bulk update menu items');
    }
  }
}
