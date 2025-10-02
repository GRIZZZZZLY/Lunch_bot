import express from 'express';
import { userController } from '../controllers/user.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = express.Router();

/**
 * GET /api/user/me
 * Получение информации о текущем пользователе
 */
router.get('/me', telegramAuthMiddleware, userController.getCurrentUser);

/**
 * GET /api/user/payment-info
 * Получение платёжных данных текущего пользователя
 */
router.get(
  '/payment-info',
  telegramAuthMiddleware,
  userController.getPaymentInfo
);

/**
 * PUT /api/user/payment-info
 * Обновление платёжных данных
 */
router.put(
  '/payment-info',
  telegramAuthMiddleware,
  userController.updatePaymentInfo
);

/**
 * GET /api/user/groups
 * Получение списка групп где пользователь является админом
 */
router.get(
  '/groups',
  telegramAuthMiddleware,
  userController.getUserGroups
);

export default router;
