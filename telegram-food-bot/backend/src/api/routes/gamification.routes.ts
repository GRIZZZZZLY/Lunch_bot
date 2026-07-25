/**
 * Gamification Routes - Sprint 6 Enhanced
 *
 * API routes for XP, levels, achievements, quests, and leaderboards
 */

import { Router } from 'express';
import {
  getUserStats,
  getUserAchievements,
  getUserQuests,
  getXPHistory,
  getLeaderboard,
  awardXP,
  recalculateRatings,
} from '../controllers/gamification.controller';
import {
  adminMiddleware,
  telegramAuthMiddleware,
} from '../middleware/telegram-auth';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { operationsApiMiddleware } from '../middleware/operations-api';
import { writeLimiter } from '../middleware/rate-limiter';

const router = Router();
const gamificationMutationIdempotency = createIdempotencyMiddleware({
  scope: 'gamification-maintenance',
  required: true,
});

// All routes require authentication
router.use(telegramAuthMiddleware);

// User routes
router.get('/user/stats', getUserStats);
router.get('/user/achievements', getUserAchievements);
router.get('/user/quests', getUserQuests);
router.get('/user/xp-history', getXPHistory);

// General routes
router.get('/leaderboard', getLeaderboard);

// Admin routes
router.post(
  '/admin/award-xp',
  adminMiddleware,
  operationsApiMiddleware,
  writeLimiter,
  gamificationMutationIdempotency,
  awardXP
);
router.post(
  '/admin/recalculate-ratings',
  adminMiddleware,
  operationsApiMiddleware,
  writeLimiter,
  gamificationMutationIdempotency,
  recalculateRatings
);

export default router;
