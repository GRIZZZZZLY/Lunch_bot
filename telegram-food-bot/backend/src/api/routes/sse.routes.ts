import { Router, Request, Response, NextFunction } from 'express';
import { SSEController } from '../controllers/sse.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

/**
 * Middleware: переносит токен из query string в Authorization header.
 *
 * EventSource API не поддерживает кастомные заголовки,
 * поэтому клиент передаёт JWT через ?token=...
 */
function sseTokenFromQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    if (!req.headers.authorization) {
      req.headers.authorization = `Bearer ${queryToken}`;
    }
  }
  next();
}

/**
 * GET /api/polls/:pollId/stream
 *
 * SSE endpoint для real-time обновлений poll.
 * Требует аутентификации (JWT через query string или Authorization header).
 * Исключён из rate-limit и compression (настроено в server.ts).
 */
router.get(
  '/polls/:pollId/stream',
  sseTokenFromQuery,
  telegramAuthMiddleware,
  SSEController.stream
);

export default router;
