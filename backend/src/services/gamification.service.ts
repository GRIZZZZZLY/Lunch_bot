/**
 * GamificationService - Sprint 6 Enhanced
 *
 * Manages XP, levels, achievements, ratings, and streaks
 * Uses new UserStats model with multi-category ratings
 */

import { prisma } from '../database/client';
import { logger } from '../utils/logger';

interface AchievementRequirement {
  type: 'stat_gte' | 'stat_lte' | 'level' | 'streak' | 'custom';
  stat?: string;
  value?: number;
  logic?: string;
}

export class GamificationService {
  /**
   * Calculate level from total XP using exponential formula
   * Formula: XP for level N = 100 * N^1.5
   */
  static calculateLevel(totalXP: number): number {
    if (totalXP <= 0) return 1;

    // Reverse formula: level = (XP / 100)^(1/1.5) = (XP / 100)^(2/3)
    const level = Math.floor(Math.pow(totalXP / 100, 2 / 3));
    return Math.max(1, level);
  }

  /**
   * Calculate XP required for a specific level
   */
  static xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Get rank title based on level
   */
  static getRankTitle(level: number): string {
    if (level >= 25) return 'Гранд-мастер';
    if (level >= 20) return 'Легенда';
    if (level >= 15) return 'Мастер';
    if (level >= 10) return 'Эксперт';
    if (level >= 5) return 'Гурман';
    return 'Новичок';
  }

  /**
   * Award XP to user and update level
   * @returns Updated user stats and whether leveled up
   */
  static async awardXP(
    userId: number,
    amount: number,
    reason: string,
    category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    metadata?: Record<string, any>
  ): Promise<{ stats: any; leveledUp: boolean; oldLevel: number; newLevel: number }> {
    try {
      // Get current season (if exists). Inlined to avoid cycle with SeasonService.
      const currentSeason = await prisma.season.findFirst({
        where: { isActive: true },
        orderBy: { number: 'desc' },
      });
      
      // Get or create user stats
      let stats = await prisma.userStats.findUnique({
        where: { userId },
      });

      if (!stats) {
        stats = await prisma.userStats.create({
          data: { userId },
        });
      }

      const oldLevel = stats.level;
      const newTotalXP = stats.totalXP + amount;
      const newLevel = this.calculateLevel(newTotalXP);
      const newRank = this.getRankTitle(newLevel);
      const leveledUp = newLevel > oldLevel;

      // Create XP history record with season link
      await prisma.xPHistory.create({
        data: {
          userId,
          amount,
          reason,
          category,
          seasonId: currentSeason?.id || null, // Link to current season
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
      });

      // Update user stats
      const updatedStats = await prisma.userStats.update({
        where: { userId },
        data: {
          totalXP: newTotalXP,
          level: newLevel,
          rank: newRank,
        },
      });

      // If leveled up, trigger achievement check
      if (leveledUp) {
        await this.checkAchievements(userId);
        logger.info(`User ${userId} leveled up from ${oldLevel} to ${newLevel}!`);
      }

      logger.info(`Awarded ${amount} XP to user ${userId}: ${reason}`);

      return {
        stats: updatedStats,
        leveledUp,
        oldLevel,
        newLevel,
      };
    } catch (error) {
      logger.error('Error awarding XP:', error);
      throw error;
    }
  }

  /**
   * Update category-specific rating
   */
  static async updateRating(
    userId: number,
    category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    amount: number
  ): Promise<void> {
    const fieldMap = {
      GASTRO: 'gastroRating',
      RESPONSIBLE: 'responsibleRating',
      SOCIAL: 'socialRating',
      EXPLORER: 'explorerRating',
    };

    const field = fieldMap[category];

    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        [field]: amount,
      },
      update: {
        [field]: { increment: amount },
      },
    });
  }

  /**
   * Update user streak for daily voting
   */
  static async updateStreak(userId: number): Promise<void> {
    try {
      const stats = await prisma.userStats.findUnique({
        where: { userId },
      });

      if (!stats) {
        // First vote ever
        await prisma.userStats.create({
          data: {
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastVoteDate: new Date(),
          },
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastVote = stats.lastVoteDate ? new Date(stats.lastVoteDate) : null;
      lastVote?.setHours(0, 0, 0, 0);

      let newStreak = stats.currentStreak;

      if (!lastVote) {
        // First vote ever
        newStreak = 1;
      } else {
        const daysDiff = Math.floor(
          (today.getTime() - lastVote.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
          // Already voted today
          return;
        } else if (daysDiff === 1) {
          // Consecutive day
          newStreak++;

          // Bonus XP for streak milestones
          if (newStreak % 7 === 0) {
            await this.awardXP(
              userId,
              50,
              `Серия ${newStreak} дней!`,
              'SOCIAL',
              { streakMilestone: newStreak }
            );
          }
        } else {
          // Streak broken
          newStreak = 1;
        }
      }

      await prisma.userStats.update({
        where: { userId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, stats.longestStreak),
          lastVoteDate: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating streak:', error);
      throw error;
    }
  }

  /**
   * Increment a specific stat counter
   */
  static async incrementStat(
    userId: number,
    stat: string,
    amount: number = 1
  ): Promise<void> {
    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        [stat]: amount,
      },
      update: {
        [stat]: { increment: amount },
      },
    });
  }

  /**
   * Check and unlock achievements for user
   */
  static async checkAchievements(userId: number): Promise<void> {
    try {
      const stats = await prisma.userStats.findUnique({
        where: { userId },
        include: {
          user: {
            include: {
              achievements: {
                include: { achievement: true },
              },
            },
          },
        },
      });

      if (!stats) return;

      // Get all active achievements
      const allAchievements = await prisma.achievement.findMany({
        where: { isActive: true },
      });

      // Check each achievement
      for (const achievement of allAchievements) {
        // Skip if already unlocked
        const alreadyUnlocked = stats.user.achievements.some(
          (ua) => ua.achievementId === achievement.id
        );
        if (alreadyUnlocked) continue;

        // Parse requirement
        const req: AchievementRequirement = typeof achievement.requirement === 'string'
          ? JSON.parse(achievement.requirement)
          : achievement.requirement;

        // Check if requirement met
        const unlocked = this.checkAchievementRequirement(stats, req);

        if (unlocked) {
          await this.unlockAchievement(userId, achievement.id);
        }
      }
    } catch (error) {
      logger.error('Error checking achievements:', error);
      throw error;
    }
  }

  /**
   * Check if achievement requirement is met
   */
  private static checkAchievementRequirement(
    stats: any,
    requirement: AchievementRequirement
  ): boolean {
    const { type, stat, value } = requirement;

    switch (type) {
      case 'stat_gte':
        return stat ? stats[stat] >= (value || 0) : false;
      case 'stat_lte':
        return stat ? stats[stat] <= (value || 0) : false;
      case 'level':
        return stats.level >= (value || 0);
      case 'streak':
        return stats.currentStreak >= (value || 0);
      case 'custom':
        // Custom logic handled separately
        return false;
      default:
        return false;
    }
  }

  /**
   * Unlock achievement for user
   */
  static async unlockAchievement(
    userId: number,
    achievementId: number
  ): Promise<void> {
    try {
      const achievement = await prisma.achievement.findUnique({
        where: { id: achievementId },
      });

      if (!achievement) return;

      // Create user achievement
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          progress: 100,
        },
      });

      // Award XP
      await this.awardXP(
        userId,
        achievement.xpReward,
        `Получена ачивка: ${achievement.title}`,
        achievement.category as any,
        { achievementKey: achievement.key }
      );

      logger.info(`Achievement unlocked: ${achievement.key} for user ${userId}`);
    } catch (error) {
      // Ignore duplicate key errors (already unlocked)
      if (!(error as any).code?.includes('UNIQUE')) {
        logger.error('Error unlocking achievement:', error);
      }
    }
  }

  /**
   * Get leaderboard for a specific category
   * @param seasonId - Filter by season (null = all-time, undefined = current season if exists)
   */
  static async getLeaderboard(
    category: 'TOTAL' | 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    limit: number = 10,
    groupId?: number,
    seasonId?: number | null
  ): Promise<any[]> {
    // If seasonId is provided (not undefined), use season-based leaderboard
    if (seasonId !== undefined) {
      return this.getSeasonBasedLeaderboard(category, limit, groupId, seasonId);
    }

    // Otherwise use all-time leaderboard (current behavior)
    const orderBy: any = {};

    switch (category) {
      case 'TOTAL':
        orderBy.totalXP = 'desc';
        break;
      case 'GASTRO':
        orderBy.gastroRating = 'desc';
        break;
      case 'RESPONSIBLE':
        orderBy.responsibleRating = 'desc';
        break;
      case 'SOCIAL':
        orderBy.socialRating = 'desc';
        break;
      case 'EXPLORER':
        orderBy.explorerRating = 'desc';
        break;
    }

    // If groupId provided, filter by group members
    const where = groupId
      ? {
          user: {
            groupMemberships: {
              some: {
                groupId,
                isActive: true,
              },
            },
          },
        }
      : {};

    const leaderboard = await prisma.userStats.findMany({
      take: limit,
      where,
      orderBy,
      select: {
        userId: true,
        totalXP: true,
        level: true,
        rank: true,
        gastroRating: true,
        responsibleRating: true,
        socialRating: true,
        explorerRating: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    // Add position/rank
    return leaderboard.map((entry, index) => ({
      position: index + 1,
      ...entry,
    }));
  }

  /**
   * Get season-based leaderboard (calculates from XPHistory)
   */
  private static async getSeasonBasedLeaderboard(
    category: 'TOTAL' | 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER',
    limit: number,
    groupId?: number,
    seasonId?: number | null
  ): Promise<any[]> {
    try {
      // If seasonId is null, use all-time. If undefined, use current season.
      let actualSeasonId: number | null = null;
      if (seasonId === null) {
        actualSeasonId = null; // All-time
      } else if (seasonId === undefined) {
        const currentSeason = await prisma.season.findFirst({
          where: { isActive: true },
          orderBy: { number: 'desc' },
        });
        actualSeasonId = currentSeason?.id || null;
      } else {
        actualSeasonId = seasonId;
      }

      // Build XP history filter
      const xpWhere: any = actualSeasonId ? { seasonId: actualSeasonId } : {};

      if (groupId) {
        xpWhere.user = {
          groupMemberships: {
            some: {
              groupId,
              isActive: true,
            },
          },
        };
      }
      
      // Filter by category if not TOTAL
      if (category !== 'TOTAL') {
        xpWhere.category = category;
      }

      // Group XP by user
      const xpByUser = await prisma.xPHistory.groupBy({
        by: ['userId'],
        where: xpWhere,
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: limit,
      });

      // Get user details
      const userIds = xpByUser.map(x => x.userId);
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
        take: limit,
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      // Build leaderboard
      const leaderboard = xpByUser
        .filter(x => userMap.has(x.userId))
        .slice(0, limit)
        .map((x, index) => {
          const user = userMap.get(x.userId)!;
          const totalXP = x._sum.amount || 0;
          const level = this.calculateLevel(totalXP);
          const rank = this.getRankTitle(level);

          return {
            position: index + 1,
            userId: user.id,
            totalXP,
            level,
            rank,
            gastroRating: category === 'GASTRO' ? totalXP : 0,
            responsibleRating: category === 'RESPONSIBLE' ? totalXP : 0,
            socialRating: category === 'SOCIAL' ? totalXP : 0,
            explorerRating: category === 'EXPLORER' ? totalXP : 0,
            user,
          };
        });

      return leaderboard;
    } catch (error) {
      logger.error('Error getting season-based leaderboard:', error);
      return [];
    }
  }

  /**
   * Get user stats with additional calculations
   */
  static async getUserStats(userId: number): Promise<any> {
    const stats = await prisma.userStats.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    if (!stats) {
      // Create default stats
      return await prisma.userStats.create({
        data: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });
    }

    // Calculate XP progress to next level
    const currentLevelXP = this.xpForLevel(stats.level);
    const nextLevelXP = this.xpForLevel(stats.level + 1);
    const xpProgress = stats.totalXP - currentLevelXP;
    const xpRequired = nextLevelXP - currentLevelXP;
    const progressPercent = Math.round((xpProgress / xpRequired) * 100);

    return {
      ...stats,
      xpProgress,
      xpRequired,
      progressPercent,
    };
  }

  /**
   * Calculate all ratings based on current stats
   */
  static async recalculateRatings(userId: number): Promise<void> {
    const stats = await prisma.userStats.findUnique({
      where: { userId },
    });

    if (!stats) return;

    // Gastro rating: (wins × 10) + (participated × 2) + (categoriesTried × 20)
    const gastroRating =
      stats.pollsWon * 10 +
      stats.pollsParticipated * 2 +
      stats.categoriesTried * 20;

    // Responsible rating: (times × 50) + (volunteer × 100) + (ordersOnTime × 30)
    const responsibleRating =
      stats.timesResponsible * 50 +
      stats.timesVolunteer * 100 +
      stats.ordersReceived * 30;

    // Social rating: (currentStreak × 20) + (longestStreak × 10) + (paymentsOnTime × 15) + (referrals × 100)
    const socialRating =
      stats.currentStreak * 20 +
      stats.longestStreak * 10 +
      stats.paymentsOnTime * 15 +
      stats.referralsCount * 100;

    // Explorer rating: (newDishes × 10) + (categories × 50) + (menuItemsAdded × 30)
    const explorerRating =
      stats.newDishesDiscovered * 10 +
      stats.categoriesTried * 50 +
      stats.menuItemsAdded * 30;

    await prisma.userStats.update({
      where: { userId },
      data: {
        gastroRating,
        responsibleRating,
        socialRating,
        explorerRating,
      },
    });
  }

  /**
   * Get XP history for user
   */
  static async getXPHistory(
    userId: number,
    limit: number = 50
  ): Promise<any[]> {
    return await prisma.xPHistory.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all achievements with user's unlock status
   */
  static async getAchievementsWithStatus(userId: number): Promise<any[]> {
    const [allAchievements, userAchievements] = await Promise.all([
      prisma.achievement.findMany({
        where: { isActive: true, isHidden: false },
        orderBy: [{ rarity: 'asc' }, { id: 'asc' }],
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true, unlockedAt: true },
      }),
    ]);

    const unlockedMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt])
    );

    return allAchievements.map((achievement) => ({
      ...achievement,
      unlocked: unlockedMap.has(achievement.id),
      unlockedAt: unlockedMap.get(achievement.id),
    }));
  }
}

// Export singleton instance for backward compatibility
export const gamificationService = {
  getUserProgress: async (userId: number) => GamificationService.getUserStats(userId),
  addXP: async (userId: number, amount: number, reason?: string) =>
    GamificationService.awardXP(userId, amount, reason || 'unknown', 'SOCIAL'),
  checkAchievements: async (userId: number) => GamificationService.checkAchievements(userId),
  getLeaderboard: async (limit?: number, groupId?: number) =>
    GamificationService.getLeaderboard('TOTAL', limit, groupId),
};
