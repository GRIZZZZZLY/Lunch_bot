import express from 'express';
import { authController } from '../controllers/auth.controller';
import { telegramAuthMiddleware, refreshTokenMiddleware } from '../middleware/telegram-auth';

const router = express.Router();

/**
 * POST /api/auth/validate
 * Валидация initData от Telegram WebApp
 */
router.post('/validate', authController.validateInitData);

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get('/me', telegramAuthMiddleware, authController.getCurrentUser);

/**
 * GET /api/auth/status
 * Проверка статуса авторизации
 */
router.get('/status', telegramAuthMiddleware, authController.getAuthStatus);

/**
 * POST /api/auth/refresh
 * Обновление токена авторизации
 * ✅ FIX: Используем refreshTokenMiddleware вместо telegramAuthMiddleware
 */
router.post('/refresh', refreshTokenMiddleware, authController.refreshAuth);

export default router;
