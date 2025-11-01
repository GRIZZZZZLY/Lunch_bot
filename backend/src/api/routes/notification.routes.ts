import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * POST /api/notifications/remind-admin
 * Отправить напоминание администраторам о создании голосования
 */
router.post('/remind-admin', telegramAuthMiddleware, notificationController.remindAdmin);

export default router;
