import { Router } from 'express';
import { createMultipleVotes, getUserVotes, deleteVote } from '../controllers/vote.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

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

router.post('/multiple', createMultipleVotes);
router.get('/:pollId/user', getUserVotes);
router.delete('/:pollId/item/:menuItemId', deleteVote);

export default router;
