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
import { telegramAuthMiddleware } from '../middleware/telegram-auth';

const router = Router();

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
router.post('/admin/award-xp', awardXP);
router.post('/admin/recalculate-ratings', recalculateRatings);

export default router;
