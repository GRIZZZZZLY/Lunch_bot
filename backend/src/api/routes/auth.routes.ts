import express from 'express';
import { authController } from '../controllers/auth.controller';
import { telegramAuthMiddleware, refreshTokenMiddleware } from '../middleware/telegram-auth';
import { authLimiter } from '../middleware/rate-limiter';

const router = express.Router();

router.post('/validate', authLimiter, authController.validateInitData);

router.get('/me', telegramAuthMiddleware, authController.getCurrentUser);

router.get('/status', telegramAuthMiddleware, authController.getAuthStatus);

router.post('/refresh', authLimiter, refreshTokenMiddleware, authController.refreshAuth);

export default router;
