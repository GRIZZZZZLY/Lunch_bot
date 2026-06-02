import { Request, Response } from 'express';
import { MenuService } from '../../services/menu.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';
import { UpdateMenuItemData } from '../../types/menu.types';
import { toNumber } from '../../utils/decimal';
import { GroupService, GroupAccessError } from '../../services/group.service';

function serializeMenuItem(item: any): any {
  if (!item) return item;
  if (item.price === null || item.price === undefined) return item;
  return { ...item, price: toNumber(item.price) };
}

function sendMenuError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
): void {
  if (error instanceof GroupAccessError) {
    res.status(403).json({ success: false, error: error.message, code: error.code });
    return;
  }
  logger.error(`${fallbackCode}:`, error);
  res.status(500).json({ success: false, error: fallbackMessage, code: fallbackCode });
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
      const user = (req as any).user;
      try {
        await GroupService.assertMember(user.id, groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to get menu items', 'INTERNAL_ERROR');
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
      sendMenuError(res, error, 'Failed to get menu items', 'INTERNAL_ERROR');
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

      try {
        await GroupService.assertMember(user.id, groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to get active menu items', 'INTERNAL_ERROR');
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
      sendMenuError(res, error, 'Failed to get active menu items', 'INTERNAL_ERROR');
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
      const user = (req as any).user;
      try {
        await GroupService.assertMember(user.id, groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to get popular menu items', 'INTERNAL_ERROR');
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
      sendMenuError(res, error, 'Failed to get popular menu items', 'INTERNAL_ERROR');
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
      const user = (req as any).user;
      try {
        await GroupService.assertMember(user.id, groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to get menu stats', 'INTERNAL_ERROR');
        return;
      }

      const stats = await MenuService.getMenuStats(groupId);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      sendMenuError(res, error, 'Failed to get menu stats', 'INTERNAL_ERROR');
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

      const user = (req as any).user;
      try {
        await GroupService.assertMember(user.id, groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to search menu items', 'INTERNAL_ERROR');
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
      sendMenuError(res, error, 'Failed to search menu items', 'INTERNAL_ERROR');
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

      try {
        await GroupService.assertMember((req as any).user.id, item.groupId);
      } catch (error) {
        sendMenuError(res, error, 'Failed to get menu item', 'INTERNAL_ERROR');
        return;
      }

      res.json({
        success: true,
        data: serializeMenuItem(item),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      sendMenuError(res, error, 'Failed to get menu item', 'INTERNAL_ERROR');
    }
  }

  /**
   * POST /api/menu
   * Создание нового блюда
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const groupIds: number[] = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
      if (groupIds.length === 0) {
        res.status(400).json({ success: false, error: 'groupIds is required', code: 'MISSING_GROUP_ID' });
        return;
      }

      const items = await MenuService.createMenuItemForGroups(
        {
          name: req.body.name,
          description: req.body.description,
          price: req.body.price,
          imageUrl: req.body.imageUrl,
          isActive: req.body.isActive,
        },
        user.id,
        groupIds,
      );

      logger.info('Menu items created', { count: items.length, by: user.id });
      res.status(201).json({
        success: true,
        data: items.map(serializeMenuItem),
        count: items.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      sendMenuError(res, error, 'Failed to create menu item', 'INTERNAL_ERROR');
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

      const item = await MenuService.updateMenuItem(id, data, user.id);

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

      sendMenuError(res, error, 'Failed to update menu item', 'INTERNAL_ERROR');
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

      const item = await MenuService.toggleMenuItemStatus(id, user.id);

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

      sendMenuError(res, error, 'Failed to toggle menu item status', 'INTERNAL_ERROR');
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

      await MenuService.deleteMenuItem(id, user.id);

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

      sendMenuError(res, error, 'Failed to delete menu item', 'INTERNAL_ERROR');
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

      const updatedCount = await MenuService.bulkUpdateStatus(ids, isActive, user.id);

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
      sendMenuError(res, error, 'Failed to bulk update menu items', 'INTERNAL_ERROR');
    }
  }
}

export const menuController = MenuController;
