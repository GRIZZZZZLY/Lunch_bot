import express from 'express';
import { menuController } from '../controllers/menu.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { groupAdminMiddleware } from '../middleware/group-admin';
import { validateMenuItemData } from '../middleware/validation';

const router = express.Router();

/**
 * GET /api/menu
 * Получение списка всех блюд
 */
router.get('/', telegramAuthMiddleware, menuController.getAllItems);

/**
 * GET /api/menu/active
 * Получение только активных блюд
 */
router.get('/active', telegramAuthMiddleware, menuController.getActiveItems);

/**
 * GET /api/menu/popular
 * Получение популярных блюд
 */
router.get('/popular', telegramAuthMiddleware, menuController.getPopularItems);

/**
 * GET /api/menu/stats
 * Получение статистики меню
 */
router.get('/stats', telegramAuthMiddleware, menuController.getMenuStats);

/**
 * GET /api/menu/search
 * Поиск блюд по запросу
 */
router.get('/search', telegramAuthMiddleware, menuController.searchItems);

/**
 * GET /api/menu/:id
 * Получение блюда по ID
 */
router.get('/:id', telegramAuthMiddleware, menuController.getItemById);

/**
 * POST /api/menu
 * Создание нового блюда (только админы)
 */
router.post(
  '/',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  validateMenuItemData,
  menuController.createItem
);

/**
 * PUT /api/menu/:id
 * Обновление блюда (только админы)
 */
router.put(
  '/:id',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  validateMenuItemData,
  menuController.updateItem
);

/**
 * PATCH /api/menu/:id/toggle
 * Переключение активности блюда (только админы)
 */
router.patch(
  '/:id/toggle',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  menuController.toggleItemStatus
);

/**
 * DELETE /api/menu/:id
 * Удаление блюда (только админы)
 */
router.delete(
  '/:id',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  menuController.deleteItem
);

/**
 * PATCH /api/menu/bulk-status
 * Массовое изменение статуса блюд (только админы)
 */
router.patch(
  '/bulk-status',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  menuController.bulkUpdateStatus
);

export default router;
