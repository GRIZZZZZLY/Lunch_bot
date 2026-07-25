/**
 * Gamification Controller - Sprint 6 Enhanced
 *
 * API endpoints for XP, levels, achievements, quests, and leaderboards
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { GamificationService } from '../../services/gamification.service';
import { GroupService } from '../../services/group.service';
import { QuestService } from '../../services/quest.service';
import { logger } from '../../utils/logger';

/**
 * GET /api/gamification/user/stats
 * Get current user's stats (XP, level, rank, ratings, progress)
 */
export async function getUserStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await GamificationService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
}

/**
 * GET /api/gamification/user/achievements
 * Get all achievements with user's unlock status
 */
export async function getUserAchievements(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const achievements =
      await GamificationService.getAchievementsWithStatus(userId);

    res.json({
      success: true,
      data: achievements,
    });
  } catch (error) {
    logger.error('Error getting user achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
}

/**
 * GET /api/gamification/user/quests
 * Get user's active quests
 */
export async function getUserQuests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Auto-assign quests if needed
    await QuestService.autoAssignQuests(userId);

    // Get active quests
    const quests = await QuestService.getUserQuests(userId);

    // Get quest stats
    const stats = await QuestService.getQuestStats(userId);

    res.json({
      success: true,
      data: {
        quests,
        stats,
      },
    });
  } catch (error) {
    logger.error('Error getting user quests:', error);
    res.status(500).json({ error: 'Failed to get quests' });
  }
}

/**
 * GET /api/gamification/user/xp-history
 * Get user's XP history
 */
export async function getXPHistory(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const history = await GamificationService.getXPHistory(userId, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting XP history:', error);
    res.status(500).json({ error: 'Failed to get XP history' });
  }
}

/**
 * GET /api/gamification/leaderboard
 * Get leaderboard for a specific category
 * Query params: category (TOTAL|GASTRO|RESPONSIBLE|SOCIAL|EXPLORER), limit, groupId
 */
export async function getLeaderboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const category = (req.query.category as string) || 'TOTAL';
    const limit = parseInt(req.query.limit as string) || 10;
    const groupId = req.query.groupId
      ? parseInt(req.query.groupId as string, 10)
      : NaN;

    // Validate category
    const validCategories = [
      'TOTAL',
      'GASTRO',
      'RESPONSIBLE',
      'SOCIAL',
      'EXPLORER',
    ];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    if (!Number.isInteger(groupId) || groupId <= 0) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
      });
      return;
    }

    if (
      !req.user?.isAdmin &&
      !(await GroupService.isUserGroupMember(userId, groupId))
    ) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
      return;
    }

    const leaderboard = await GamificationService.getLeaderboard(
      category as any,
      limit,
      groupId
    );

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}

/**
 * POST /api/gamification/admin/award-xp
 * Award XP to a user (admin only)
 * Body: { userId, amount, reason, category }
 */
export async function awardXP(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const adminUser = req.user;

    if (!adminUser?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { userId, amount, reason, category } = req.body;
    const validCategories = ['GASTRO', 'RESPONSIBLE', 'SOCIAL', 'EXPLORER'];

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      amount > 100_000 ||
      typeof reason !== 'string' ||
      reason.trim().length < 1 ||
      reason.trim().length > 300 ||
      !validCategories.includes(category)
    ) {
      res.status(400).json({ error: 'Invalid XP award parameters' });
      return;
    }

    const idempotencyKey = req.header('idempotency-key');
    const result = await GamificationService.awardXP(
      userId,
      amount,
      reason.trim(),
      category,
      { source: 'operations-api' },
      idempotencyKey ? `operations-xp:${userId}:${idempotencyKey}` : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error awarding XP:', error);
    res.status(500).json({ error: 'Failed to award XP' });
  }
}

/**
 * POST /api/gamification/admin/recalculate-ratings
 * Recalculate ratings for a user (admin only)
 * Body: { userId }
 */
export async function recalculateRatings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const adminUser = req.user;

    if (!adminUser?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }

    await GamificationService.recalculateRatings(userId);

    res.json({
      success: true,
      message: 'Ratings recalculated successfully',
    });
  } catch (error) {
    logger.error('Error recalculating ratings:', error);
    res.status(500).json({ error: 'Failed to recalculate ratings' });
  }
}
