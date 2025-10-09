import { Request, Response } from 'express';
import { MenuService } from '../../services/menu.service';
import { logger } from '../../utils/logger';
import { CreateMenuItemData, UpdateMenuItemData } from '../../types/menu.types';
import { prisma } from '../../database/client';

export class MenuController {
  /**
   * GET /api/menu
   * Получение списка всех блюд
   */
  static async getAllItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await MenuService.getAllMenuItems();

      res.json({
        success: true,
        data: items,
        count: items.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting all menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get menu items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/active
   * Получение только активных блюд
   */
  static async getActiveItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await MenuService.getActiveMenuItems();

      res.json({
        success: true,
        data: items,
        count: items.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting active menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active menu items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/categories
   * Получение списка категорий
   */
  static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await MenuService.getCategories();

      res.json({
        success: true,
        data: categories,
        count: categories.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get categories',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/popular
   * Получение популярных блюд
   */
  static async getPopularItems(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const items = await MenuService.getPopularMenuItems(limit);

      res.json({
        success: true,
        data: items,
        count: items.length,
        limit,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting popular menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular menu items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/stats
   * Получение статистики меню
   */
  static async getMenuStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await MenuService.getMenuStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting menu stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get menu stats',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/search
   * Поиск блюд по запросу
   */
  static async searchItems(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      
      if (!query || query.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters long',
          code: 'INVALID_QUERY'
        });
        return;
      }

      const items = await MenuService.searchMenuItems(query.trim());

      res.json({
        success: true,
        data: items,
        count: items.length,
        query: query.trim(),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error searching menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search menu items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/:id
   * Получение блюда по ID
   */
  static async getItemById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid item ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const item = await MenuService.getMenuItemById(id);
      
      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Menu item not found',
          code: 'ITEM_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: item,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting menu item by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get menu item',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/menu
   * Создание нового блюда
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateMenuItemData = req.body;
      const user = (req as any).user;

      logger.info('🔵 CREATE MENU ITEM REQUEST', {
        requestId: Date.now(),
        userId: user.id,
        username: user.username,
        data: {
          name: data.name,
          description: data.description?.substring(0, 50),
          price: data.price,
          category: data.category,
          isActive: data.isActive,
        },
      });

      // Добавляем createdBy из авторизованного пользователя
      const itemData = {
        ...data,
        createdBy: user.id,
      };

      const item = await MenuService.createMenuItem(itemData);

      logger.info('✅ MENU ITEM CREATED SUCCESSFULLY', {
        itemId: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        createdBy: user.id,
        createdByUsername: user.username,
      });

      res.status(201).json({
        success: true,
        data: item,
        message: 'Menu item created successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('❌ ERROR CREATING MENU ITEM', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as any).user?.id,
        requestBody: req.body,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create menu item',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PUT /api/menu/:id
   * Обновление блюда
   */
  static async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const data: UpdateMenuItemData = req.body;
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid item ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const item = await MenuService.updateMenuItem(id, data);

      logger.info('Menu item updated', {
        itemId: item.id,
        name: item.name,
        updatedBy: user.id,
      });

      res.json({
        success: true,
        data: item,
        message: 'Menu item updated successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error && error.message === 'Menu item not found') {
        res.status(404).json({
          success: false,
          error: 'Menu item not found',
          code: 'ITEM_NOT_FOUND'
        });
        return;
      }

      logger.error('Error updating menu item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update menu item',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PATCH /api/menu/:id/toggle
   * Переключение активности блюда
   */
  static async toggleItemStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid item ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const item = await MenuService.toggleMenuItemStatus(id);

      logger.info('Menu item status toggled', {
        itemId: item.id,
        name: item.name,
        newStatus: item.isActive,
        toggledBy: user.id,
      });

      res.json({
        success: true,
        data: item,
        message: `Menu item ${item.isActive ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error && error.message === 'Menu item not found') {
        res.status(404).json({
          success: false,
          error: 'Menu item not found',
          code: 'ITEM_NOT_FOUND'
        });
        return;
      }

      logger.error('Error toggling menu item status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle menu item status',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * DELETE /api/menu/:id
   * Удаление блюда
   */
  static async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid item ID',
          code: 'INVALID_ID'
        });
        return;
      }

      await MenuService.deleteMenuItem(id);

      logger.info('Menu item deleted', {
        itemId: id,
        deletedBy: user.id,
      });

      res.json({
        success: true,
        message: 'Menu item deleted successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error && error.message === 'Menu item not found') {
        res.status(404).json({
          success: false,
          error: 'Menu item not found',
          code: 'ITEM_NOT_FOUND'
        });
        return;
      }

      logger.error('Error deleting menu item:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete menu item',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PATCH /api/menu/bulk-status
   * Массовое изменение статуса блюд
   */
  static async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ids, isActive } = req.body;
      const user = (req as any).user;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid or empty IDs array',
          code: 'INVALID_IDS'
        });
        return;
      }

      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'isActive must be boolean',
          code: 'INVALID_STATUS'
        });
        return;
      }

      const updatedCount = await MenuService.bulkUpdateStatus(ids, isActive);

      logger.info('Bulk menu items status updated', {
        updatedCount,
        newStatus: isActive,
        updatedBy: user.id,
      });

      res.json({
        success: true,
        updatedCount,
        message: `${updatedCount} menu items ${isActive ? 'activated' : 'deactivated'} successfully`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error bulk updating menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update menu items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/menu/top-dish
   * Получить самое популярное блюдо (за последние 30 дней)
   */
  static async getTopDish(req: Request, res: Response): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      logger.info('[getTopDish] Fetching top dish for last 30 days');

      // Найти все голоса за последние 30 дней
      const votes = await prisma.vote.findMany({
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          },
          menuItemId: {
            not: null
          }
        },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              isActive: true
            }
          },
          rating: {
            select: {
              rating: true
            }
          }
        }
      });

      // Группировать по блюдам
      interface DishStat {
        dish: any;
        voteCount: number;
        likeCount: number;
        totalRatings: number;
      }

      const dishStats = votes.reduce((acc: Record<number, DishStat>, vote) => {
        if (!vote.menuItem) return acc;
        
        const dishId = vote.menuItem.id;
        
        if (!acc[dishId]) {
          acc[dishId] = {
            dish: vote.menuItem,
            voteCount: 0,
            likeCount: 0,
            totalRatings: 0
          };
        }
        
        acc[dishId].voteCount++;
        
        if (vote.rating) {
          acc[dishId].totalRatings++;
          if (vote.rating.rating === 'like') {
            acc[dishId].likeCount++;
          }
        }
        
        return acc;
      }, {} as Record<number, DishStat>);

      // Найти топ блюдо (по количеству голосов)
      const topDish = Object.values(dishStats)
        .filter((stat) => stat.dish.isActive) // только активные блюда
        .sort((a, b) => b.voteCount - a.voteCount)[0];

      if (!topDish) {
        logger.info('[getTopDish] No votes found, returning fallback dish');
        // Fallback: вернуть первое активное блюдо
        const fallbackDish = await prisma.menuItem.findFirst({
          where: { isActive: true }
        });

        if (!fallbackDish) {
          res.status(404).json({
            success: false,
            error: 'No dishes found',
            code: 'NO_DISHES'
          });
          return;
        }

        res.json({
          success: true,
          data: {
            id: fallbackDish.id,
            name: fallbackDish.name,
            description: fallbackDish.description,
            imageUrl: fallbackDish.imageUrl,
            rating: 0,
            popularityPercent: 0,
            voteCount: 0
          }
        });
        return;
      }

      // Вычислить рейтинг (из оценок)
      const rating = topDish.totalRatings > 0
        ? (topDish.likeCount / topDish.totalRatings) * 5
        : 4.5; // дефолт если нет оценок

      // Вычислить процент популярности
      const totalVotes = votes.length;
      const popularityPercent = Math.round((topDish.voteCount / totalVotes) * 100);

      logger.info(`[getTopDish] Top dish: ${topDish.dish.name} (${topDish.voteCount} votes, ${popularityPercent}%)`);

      res.json({
        success: true,
        data: {
          id: topDish.dish.id,
          name: topDish.dish.name,
          description: topDish.dish.description,
          imageUrl: topDish.dish.imageUrl,
          rating: Math.round(rating * 10) / 10, // округление до 1 знака
          popularityPercent,
          voteCount: topDish.voteCount
        }
      });

    } catch (error) {
      logger.error('Error getting top dish:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get top dish',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const menuController = MenuController;
