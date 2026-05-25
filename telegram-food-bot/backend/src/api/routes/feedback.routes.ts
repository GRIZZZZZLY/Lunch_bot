import { Router } from 'express';
import { feedbackController } from '../controllers/feedback.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { reminderLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

const feedbackIdempotency = createIdempotencyMiddleware({ scope: 'feedback' });

/**
 * @route POST /api/feedback
 * @desc Отправить обратную связь
 * @access Private — требует Telegram auth; rate-limited (10/час) чтобы не превратить
 *         endpoint в spam-канал к админскому Telegram. userId/username/firstName
 *         берутся из req.user, body этих полей игнорируется (anti-spoof).
 */
router.post(
  '/',
  telegramAuthMiddleware,
  reminderLimiter,
  feedbackIdempotency,
  feedbackController.send.bind(feedbackController)
);

export default router;
