import { MenuItem, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateMenuItemData, UpdateMenuItemData, MenuItemWithStats } from '../types/menu.types';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheInvalidator } from './cache.service';
import { toNumber } from '../utils/decimal';
import { GroupService } from './group.service';

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
          imageUrl: data.imageUrl,
          isActive: data.isActive ?? true,
          createdBy: data.createdBy,
          groupId: data.groupId,
        },
      });

      // Инвалидируем кэш меню группы
      CacheInvalidator.invalidateMenu(data.groupId);

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
  static async updateMenuItem(
    id: number,
    data: UpdateMenuItemData,
    actingUserId: number,
  ): Promise<MenuItem> {
    try {
      const existing = await prisma.menuItem.findUnique({
        where: { id },
        select: { groupId: true },
      });
      if (!existing) {
        throw new Error('Menu item not found');
      }
      await GroupService.assertAdmin(actingUserId, existing.groupId);

      // groupId никогда не меняем через update — запрет переноса блюда в чужую группу.
      const { groupId: _ignored, ...safeData } = data as UpdateMenuItemData & { groupId?: number };

      const menuItem = await prisma.menuItem.update({
        where: { id, groupId: existing.groupId },
        data: {
          ...safeData,
          updatedAt: new Date(),
        },
      });

      CacheInvalidator.invalidateMenu(menuItem.groupId);
      logger.info(`Menu item updated: ${menuItem.id} (${menuItem.name})`);
      return menuItem;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('Menu item not found');
      }
      if (error instanceof Error && error.name === 'GroupAccessError') throw error;
      if (error instanceof Error && error.message === 'Menu item not found') throw error;
      logger.error('Error updating menu item:', error);
      throw new Error('Failed to update menu item');
    }
  }

  /**
   * Удаление блюда (с инвалидацией кэша)
   * Проверяет наличие связанных голосов и результатов перед удалением
   */
  static async deleteMenuItem(id: number, actingUserId: number): Promise<void> {
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
      await GroupService.assertAdmin(actingUserId, menuItem.groupId);

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
        where: { id, groupId: menuItem.groupId },
      });

      // Инвалидируем кэш меню группы
      CacheInvalidator.invalidateMenu(menuItem.groupId);

      logger.info(`Menu item deleted: ${id}`, {
        cleanedVotes: menuItem._count.votes,
        cleanedResults: menuItem._count.pollResults,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'GroupAccessError') throw error;
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
   * Получение всех блюд группы
   */
  static async getAllMenuItems(groupId: number): Promise<MenuItem[]> {
    try {
      return await prisma.menuItem.findMany({
        where: { groupId },
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
   * Получение активных блюд группы (С КЭШИРОВАНИЕМ)
   */
  static async getActiveMenuItems(groupId: number): Promise<MenuItem[]> {
    try {
      logger.info('🔍 [MenuService] getActiveMenuItems called', { groupId });

      const cacheKey = `${CACHE_KEYS.MENU_ITEMS_ACTIVE}:${groupId}`;

      const items = await cacheService.getOrSet(
        cacheKey,
        async () => {
          logger.info('🔍 [MenuService] Fetching from DB (cache miss)', { groupId });
          const dbItems = await prisma.menuItem.findMany({
            where: { isActive: true, groupId },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              imageUrl: true,
              isActive: true,
              createdBy: true,
              groupId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { name: 'asc' },
          });
          logger.info('✅ [MenuService] DB query result', {
            count: dbItems.length,
            items: dbItems.slice(0, 3).map(i => i.name)
          });
          return dbItems;
        },
        CACHE_TTL.MENU
      );

      logger.info('✅ [MenuService] Returning items', { count: items.length });
      return items;
    } catch (error) {
      logger.error('❌ [MenuService] Error getting active menu items:', error);
      throw new Error('Failed to get active menu items');
    }
  }


  /**
   * Поиск блюд по названию в рамках группы
   */
  static async searchMenuItems(query: string, groupId: number): Promise<MenuItem[]> {
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
          groupId,
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
  static async toggleMenuItemStatus(id: number, actingUserId: number): Promise<MenuItem> {
    try {
      // Сначала получаем текущий статус и groupId
      const currentItem = await prisma.menuItem.findUnique({
        where: { id },
        select: { isActive: true, groupId: true },
      });

      if (!currentItem) {
        throw new Error('Menu item not found');
      }
      await GroupService.assertAdmin(actingUserId, currentItem.groupId);

      // Переключаем статус
      const menuItem = await prisma.menuItem.update({
        where: { id, groupId: currentItem.groupId },
        data: {
          isActive: !currentItem.isActive,
          updatedAt: new Date(),
        },
      });

      // Инвалидируем кэш меню группы
      CacheInvalidator.invalidateMenu(currentItem.groupId);

      logger.info(`Menu item status toggled: ${id} -> ${menuItem.isActive}`);
      return menuItem;
    } catch (error) {
      if (error instanceof Error && error.name === 'GroupAccessError') throw error;
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
   * Получение популярных блюд с статистикой в рамках группы
   */
  static async getPopularMenuItems(limit: number = 10, groupId: number): Promise<MenuItemWithStats[]> {
    try {
      const popularItems = await prisma.menuItem.findMany({
        where: { isActive: true, groupId },
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
        price: item.price ? toNumber(item.price) : null,
        voteCount: item._count.votes,
        winCount: item._count.pollResults,
      })) as MenuItemWithStats[];
    } catch (error) {
      logger.error('Error getting popular menu items:', error);
      throw new Error('Failed to get popular menu items');
    }
  }



  /**
   * Получение статистики меню группы
   */
  static async getMenuStats(groupId: number): Promise<{
    total: number;
    active: number;
    averagePrice: number;
  }> {
    try {
      const [total, active, avgPriceResult] = await Promise.all([
        prisma.menuItem.count({ where: { groupId } }),
        prisma.menuItem.count({ where: { isActive: true, groupId } }),
        prisma.menuItem.aggregate({
          where: {
            price: { not: null },
            isActive: true,
            groupId,
          },
          _avg: { price: true },
        }),
      ]);

      const averagePrice = toNumber(avgPriceResult._avg.price);

      return {
        total,
        active,
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
  static async bulkUpdateStatus(
    ids: number[],
    isActive: boolean,
    actingUserId: number,
  ): Promise<number> {
    try {
      const items = await prisma.menuItem.findMany({
        where: { id: { in: ids } },
        select: { groupId: true },
      });
      const uniqueGroupIds = [...new Set(items.map((i) => i.groupId))];
      // Все затронутые группы должны быть админскими для вызывающего.
      for (const groupId of uniqueGroupIds) {
        await GroupService.assertAdmin(actingUserId, groupId);
      }

      const result = await prisma.menuItem.updateMany({
        where: { id: { in: ids }, groupId: { in: uniqueGroupIds } },
        data: { isActive, updatedAt: new Date() },
      });

      for (const groupId of uniqueGroupIds) {
        CacheInvalidator.invalidateMenu(groupId);
      }

      logger.info(`Bulk updated ${result.count} menu items status to ${isActive}`);
      return result.count;
    } catch (error) {
      if (error instanceof Error && error.name === 'GroupAccessError') throw error;
      logger.error('Error bulk updating menu items:', error);
      throw new Error('Failed to bulk update menu items');
    }
  }
}
