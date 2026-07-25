import { Router } from 'express';
import { createMultipleVotes, getUserVotes, deleteVote } from '../controllers/vote.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { voteLimiter } from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

// G0-8: дедупликация двойных POST'ов (double-tap по кнопке голосования).
const voteIdempotency = createIdempotencyMiddleware({
  scope: 'vote',
  required: true,
});

/**
 * Vote Routes - Multiple Vote Support
 * 
 * @route POST /api/votes/multiple - Create/update multiple votes
 * @route GET /api/votes/:pollId/user - Get user votes for poll
 * @route DELETE /api/votes/:pollId/item/:menuItemId - Remove specific vote
 */

// All routes require authentication
router.use(telegramAuthMiddleware);

router.post('/multiple', voteLimiter, voteIdempotency, createMultipleVotes);
router.get('/:pollId/user', getUserVotes);
router.delete('/:pollId/item/:menuItemId', voteLimiter, deleteVote);

export default router;
