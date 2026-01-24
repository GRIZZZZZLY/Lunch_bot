import { Router } from 'express';
import { createMultipleVotes, getUserVotes, deleteVote } from '../controllers/vote.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { voteLimiter } from '../middleware/rate-limiter';

const router = Router();

/**
 * Vote Routes - Multiple Vote Support
 * 
 * @route POST /api/votes/multiple - Create/update multiple votes
 * @route GET /api/votes/:pollId/user - Get user votes for poll
 * @route DELETE /api/votes/:pollId/item/:menuItemId - Remove specific vote
 */

// All routes require authentication
router.use(telegramAuthMiddleware);

router.post('/multiple', voteLimiter, createMultipleVotes);
router.get('/:pollId/user', getUserVotes);
router.delete('/:pollId/item/:menuItemId', voteLimiter, deleteVote);

export default router;
