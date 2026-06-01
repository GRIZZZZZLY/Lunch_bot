import { Request, Response } from 'express';
import { MenuService } from '../../services/menu.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { CreateMenuItemData, UpdateMenuItemData } from '../../types/menu.types';
import { toNumber } from '../../utils/decimal';

function serializeMenuItem(item: any): any {
  if (!item) return item;
  if (item.price === null || item.price === undefined) return item;
  return { ...item, price: toNumber(item.price) };
}

function resolveGroupId(req: Request): number | null {
  const raw = (req.query.groupId ?? req.body?.groupId) as string | number | undefined;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

export class MenuController {
  /**
   * GET /api/menu
   * Получение списка всех блюд
   */
  static async getAllItems(req: Request, res: Response): Promise<void> {
    try {
      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }
      const items = await MenuService.getAllMenuItems(groupId);

      res.json({
        success: true,
        data: items.map(serializeMenuItem),
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
      const user = (req as any).user;
      logger.info('🔍 [MenuController] getActiveItems called', {
        userId: user?.id,
        userTelegramId: user?.telegramId,
        hasAuthHeader: !!req.headers.authorization
      });

      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }

      const items = await MenuService.getActiveMenuItems(groupId);

      logger.info('✅ [MenuController] Active menu items retrieved', {
        count: items.length,
        items: items.map(i => ({ id: i.id, name: i.name, isActive: i.isActive }))
      });

      res.json({
        success: true,
        data: items.map(serializeMenuItem),
        count: items.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('❌ [MenuController] Error getting active menu items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active menu items',
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
      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }
      const items = await MenuService.getPopularMenuItems(limit, groupId);

      res.json({
        success: true,
        data: items.map(serializeMenuItem),
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
      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }
      const stats = await MenuService.getMenuStats(groupId);

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

      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }

      const items = await MenuService.searchMenuItems(query.trim(), groupId);

      res.json({
        success: true,
        data: items.map(serializeMenuItem),
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
      const id = parseInt(getParam(req.params, 'id'), 10);
      
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
        data: serializeMenuItem(item),
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
          isActive: data.isActive,
        },
      });

      // Добавляем createdBy из авторизованного пользователя
      const groupId = resolveGroupId(req);
      if (!groupId) {
        res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
        return;
      }
      const itemData = {
        ...data,
        createdBy: user.id,
        groupId,
      };

      const item = await MenuService.createMenuItem(itemData);

      logger.info('✅ MENU ITEM CREATED SUCCESSFULLY', {
        itemId: item.id,
        name: item.name,
        price: item.price === null || item.price === undefined ? item.price : toNumber(item.price),
        createdBy: user.id,
        createdByUsername: user.username,
      });

      res.status(201).json({
        success: true,
        data: serializeMenuItem(item),
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
      const id = parseInt(getParam(req.params, 'id'), 10);
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
        data: serializeMenuItem(item),
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
      const id = parseInt(getParam(req.params, 'id'), 10);
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
        data: serializeMenuItem(item),
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
      const id = parseInt(getParam(req.params, 'id'), 10);
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
}

export const menuController = MenuController;
