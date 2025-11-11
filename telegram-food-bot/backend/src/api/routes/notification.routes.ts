import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * POST /api/notifications/remind-admin
 * Отправить напоминание администраторам о создании голосования
 */
router.post('/remind-admin', telegramAuthMiddleware, notificationController.remindAdmin);

/**
 * GET /api/notifications/cooldown/:groupId
 * Получить статус cooldown для группы
 */
router.get('/cooldown/:groupId', telegramAuthMiddleware, notificationController.getCooldownStatus);

export default router;
