import { Router } from 'express';
import { getAvatarByFileId } from '../controllers/avatar.controller';
import { avatarAccessMiddleware } from '../middleware/avatar-signature';

const router = Router();

/**
 * Avatar Routes
 *
 * @route GET /api/avatar/:fileId?exp=&sig= — proxy к Telegram getFile.
 * @access Защищается HMAC-подписью URL (выдаётся бэкендом через signAvatarUrl).
 *         <img src> в HTML не может нести Bearer header, поэтому
 *         telegramAuthMiddleware ломал img-загрузку. Подпись неугадываема
 *         (HMAC-SHA256 + JWT_SECRET) и имеет TTL (24h).
 *         Bearer-fallback оставлен для админских/devtools-кейсов.
 *         Rate-limit обеспечивает app-level generalLimiter.
 */
router.get('/:fileId', avatarAccessMiddleware, getAvatarByFileId);

export default router;
