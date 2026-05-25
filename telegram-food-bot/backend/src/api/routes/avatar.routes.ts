import { Router } from 'express';
import { getAvatarByFileId } from '../controllers/avatar.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * Avatar Routes
 *
 * @route GET /api/avatar/:fileId - Загрузить аватарку по file_id
 * @access Private — требует Telegram auth. Иначе endpoint работает как открытый
 *         passthrough к Telegram getFile (DoS-вектор + риск открытой проксии
 *         содержимого по утёкшим file_id).
 *         Rate-limit обеспечивает app-level generalLimiter (100 req/min/user).
 */
router.get('/:fileId', telegramAuthMiddleware, getAvatarByFileId);

export default router;
