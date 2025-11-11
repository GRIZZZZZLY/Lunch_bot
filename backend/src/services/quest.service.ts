/**
 * QuestService - Sprint 6 Enhanced
 *
 * Manages daily, weekly, random, and event quests
 * Handles quest assignment, progress tracking, and completion
 */

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { GamificationService } from './gamification.service';

interface QuestRequirement {
  type: 'vote_count' | 'win_count' | 'streak' | 'responsible' | 'payment' | 'custom';
  target: number;
  metadata?: Record<string, any>;
}

export class QuestService {
  /**
   * Assign daily quests to user
   * - 1 base daily quest (DAILY_VOTE)
   * - 3 random daily quests from pool
   */
  static async assignDailyQuests(userId: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if user already has daily quests for today
      const existingQuests = await prisma.userQuest.findMany({
        where: {
          userId,
          startedAt: {
            gte: today,
            lt: tomorrow,
          },
          status: 'ACTIVE',
        },
        include: { quest: true },
      });

      // Filter daily quests only
      const existingDailyQuests = existingQuests.filter((uq) => uq.quest.type === 'DAILY');

      if (existingDailyQuests.length > 0) {
        logger.info(`User ${userId} already has daily quests for today`);
        return;
      }

      // Get all DAILY quests
      const dailyQuests = await prisma.quest.findMany({
        where: { type: 'DAILY' },
      });

      if (dailyQuests.length === 0) {
        logger.warn('No daily quests found in database');
        return;
      }

      // Find base quest (DAILY_VOTE)
      const baseQuest = dailyQuests.find((q) => q.key === 'DAILY_VOTE');

      // Get 3 random quests (excluding base quest)
      const otherQuests = dailyQuests.filter((q) => q.key !== 'DAILY_VOTE');
      const randomQuests = this.getRandomItems(otherQuests, Math.min(3, otherQuests.length));

      // Combine base + random
      const questsToAssign = baseQuest ? [baseQuest, ...randomQuests] : randomQuests;

      // Create UserQuest records
      for (const quest of questsToAssign) {
        const requirement: QuestRequirement = JSON.parse(quest.requirement);
        await prisma.userQuest.create({
          data: {
            userId,
            questId: quest.id,
            status: 'ACTIVE',
            progress: 0,
            target: requirement.target,
            startedAt: today,
            expiresAt: tomorrow,
          },
        });
      }

      logger.info(`Assigned ${questsToAssign.length} daily quests to user ${userId}`);
    } catch (error) {
      logger.error('Error assigning daily quests:', error);
      throw error;
    }
  }

  /**
   * Assign weekly quests to user
   * - 2 weekly quests from pool
   */
  static async assignWeeklyQuests(userId: number): Promise<void> {
    try {
      const today = new Date();
      const startOfWeek = this.getStartOfWeek(today);
      const endOfWeek = this.getEndOfWeek(today);

      // Check if user already has weekly quests for this week
      const existingQuests = await prisma.userQuest.findMany({
        where: {
          userId,
          startedAt: {
            gte: startOfWeek,
            lt: endOfWeek,
          },
          status: 'ACTIVE',
        },
        include: { quest: true },
      });

      const existingWeeklyQuests = existingQuests.filter((uq) => uq.quest.type === 'WEEKLY');

      if (existingWeeklyQuests.length > 0) {
        logger.info(`User ${userId} already has weekly quests for this week`);
        return;
      }

      // Get all WEEKLY quests
      const weeklyQuests = await prisma.quest.findMany({
        where: { type: 'WEEKLY' },
      });

      if (weeklyQuests.length === 0) {
        logger.warn('No weekly quests found in database');
        return;
      }

      // Get 2 random weekly quests
      const randomQuests = this.getRandomItems(weeklyQuests, Math.min(2, weeklyQuests.length));

      // Create UserQuest records
      for (const quest of randomQuests) {
        const requirement: QuestRequirement = JSON.parse(quest.requirement);
        await prisma.userQuest.create({
          data: {
            userId,
            questId: quest.id,
            status: 'ACTIVE',
            progress: 0,
            target: requirement.target,
            startedAt: startOfWeek,
            expiresAt: endOfWeek,
          },
        });
      }

      logger.info(`Assigned ${randomQuests.length} weekly quests to user ${userId}`);
    } catch (error) {
      logger.error('Error assigning weekly quests:', error);
      throw error;
    }
  }

  /**
   * Update quest progress and complete if target reached
   */
  static async updateQuestProgress(
    userId: number,
    questKey: string,
    amount: number = 1
  ): Promise<void> {
    try {
      // Get quest by key
      const quest = await prisma.quest.findUnique({
        where: { key: questKey },
      });

      if (!quest) {
        logger.warn(`Quest not found: ${questKey}`);
        return;
      }

      // Get active user quest
      const userQuest = await prisma.userQuest.findFirst({
        where: {
          userId,
          questId: quest.id,
          status: 'ACTIVE',
        },
      });

      if (!userQuest) {
        return; // User doesn't have this quest active
      }

      const newProgress = Math.min(userQuest.progress + amount, userQuest.target);

      // Update progress
      await prisma.userQuest.update({
        where: { id: userQuest.id },
        data: { progress: newProgress },
      });

      // Check if completed
      if (newProgress >= userQuest.target) {
        await this.completeQuest(userId, userQuest.id);
      }

      logger.info(
        `Updated quest progress for user ${userId}: ${questKey} (${newProgress}/${userQuest.target})`
      );
    } catch (error) {
      logger.error('Error updating quest progress:', error);
      throw error;
    }
  }

  /**
   * Complete quest and award XP
   */
  static async completeQuest(userId: number, userQuestId: number): Promise<void> {
    try {
      const userQuest = await prisma.userQuest.findUnique({
        where: { id: userQuestId },
        include: { quest: true },
      });

      if (!userQuest || userQuest.status === 'COMPLETED') {
        return;
      }

      // Mark as completed
      await prisma.userQuest.update({
        where: { id: userQuestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Award XP
      await GamificationService.awardXP(
        userId,
        userQuest.quest.xpReward,
        `Выполнен квест: ${userQuest.quest.title}`,
        userQuest.quest.category as any,
        { questKey: userQuest.quest.key }
      );

      logger.info(`Quest completed: ${userQuest.quest.key} for user ${userId}`);
    } catch (error) {
      logger.error('Error completing quest:', error);
      throw error;
    }
  }

  /**
   * Get all active quests for user
   */
  static async getUserQuests(userId: number): Promise<any[]> {
    const userQuests = await prisma.userQuest.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        quest: true,
      },
      orderBy: [
        { quest: { type: 'asc' } }, // DAILY first, then WEEKLY
        { startedAt: 'desc' },
      ],
    });

    return userQuests.map((uq) => ({
      ...uq.quest,
      progress: uq.progress,
      target: uq.target,
      status: uq.status,
      startedAt: uq.startedAt,
      expiresAt: uq.expiresAt,
      progressPercent: Math.round((uq.progress / uq.target) * 100),
    }));
  }

  /**
   * Expire old quests that are past their expiration date
   */
  static async expireOldQuests(): Promise<void> {
    try {
      const now = new Date();

      const expiredCount = await prisma.userQuest.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lt: now,
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (expiredCount.count > 0) {
        logger.info(`Expired ${expiredCount.count} old quests`);
      }
    } catch (error) {
      logger.error('Error expiring old quests:', error);
      throw error;
    }
  }

  /**
   * Auto-assign quests for user (daily + weekly if needed)
   */
  static async autoAssignQuests(userId: number): Promise<void> {
    try {
      // Expire old quests first
      await this.expireOldQuests();

      // Check and assign daily quests
      await this.assignDailyQuests(userId);

      // Check and assign weekly quests
      const today = new Date().getDay();
      if (today === 1) {
        // Monday - assign weekly quests
        await this.assignWeeklyQuests(userId);
      }
    } catch (error) {
      logger.error('Error auto-assigning quests:', error);
      throw error;
    }
  }

  /**
   * Get quest completion stats for user
   */
  static async getQuestStats(userId: number): Promise<any> {
    const [totalCompleted, dailyCompleted, weeklyCompleted, activeQuests] = await Promise.all([
      prisma.userQuest.count({
        where: { userId, status: 'COMPLETED' },
      }),
      prisma.userQuest.count({
        where: {
          userId,
          status: 'COMPLETED',
          quest: { type: 'DAILY' },
        },
      }),
      prisma.userQuest.count({
        where: {
          userId,
          status: 'COMPLETED',
          quest: { type: 'WEEKLY' },
        },
      }),
      prisma.userQuest.count({
        where: {
          userId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      totalCompleted,
      dailyCompleted,
      weeklyCompleted,
      activeQuests,
    };
  }

  /**
   * Utility: Get start of week (Monday)
   */
  private static getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Utility: Get end of week (Sunday 23:59:59)
   */
  private static getEndOfWeek(date: Date): Date {
    const startOfWeek = this.getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    return endOfWeek;
  }

  /**
   * Utility: Get random items from array
   */
  private static getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

// Export singleton instance for backward compatibility
export const questService = {
  assignDailyQuests: async (userId: number) => QuestService.assignDailyQuests(userId),
  assignWeeklyQuests: async (userId: number) => QuestService.assignWeeklyQuests(userId),
  updateQuestProgress: async (userId: number, questKey: string, amount?: number) =>
    QuestService.updateQuestProgress(userId, questKey, amount),
  getUserQuests: async (userId: number) => QuestService.getUserQuests(userId),
  autoAssignQuests: async (userId: number) => QuestService.autoAssignQuests(userId),
};
