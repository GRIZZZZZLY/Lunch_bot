import { Router } from 'express';
import { SSEController } from '../controllers/sse.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * GET /api/polls/:pollId/stream
 *
 * SSE endpoint для real-time обновлений poll.
 * Требует JWT в Authorization header. Токены в URL запрещены.
 * Исключён из rate-limit и compression (настроено в server.ts).
 */
router.get(
  '/polls/:pollId/stream',
  telegramAuthMiddleware,
  SSEController.stream
);

export default router;
