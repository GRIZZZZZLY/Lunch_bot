/**
 * Начисление XP за голос — последствие голосования, а не его часть.
 *
 * Вынесено из VoteService (план закрытия, T6). Вызывается после фиксации
 * голоса и само гасит свои ошибки: сбой начисления не отменяет голос.
 */
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { GamificationService } from './gamification.service';
import {
  getXPReward,
  isMultiplierAvailable,
  calculateXPWithMultiplier,
} from '../constants/xp-constants';

export class VoteXpService {
  static async awardVoteXp(
    userId: number,
    pollId: number,
    menuItemId: number
  ): Promise<void> {
    try {
      const reward = getXPReward('VOTE');
      const xpAmount = reward.amount;

      const context = {
        isFirstVoteOfDay: await this.isFirstVoteOfDay(userId),
        isUnanimous: await this.isUnanimousVote(pollId),
        isCloseToDeadline: await this.isCloseToDeadline(pollId),
      };

      let finalXP: number = xpAmount;
      if (isMultiplierAvailable('FIRST_VOTE_OF_DAY', context)) {
        finalXP = calculateXPWithMultiplier(finalXP, 'FIRST_VOTE_OF_DAY');
        logger.info(`First vote of day bonus applied for user ${userId}`);
      }

      if (isMultiplierAvailable('UNANIMOUS_VOTE', context)) {
        finalXP = calculateXPWithMultiplier(finalXP, 'UNANIMOUS_VOTE');
        logger.info(`Unanimous vote bonus applied for poll ${pollId}`);
      }

      if (isMultiplierAvailable('CLOSE_POLL_DEADLINE', context)) {
        finalXP = calculateXPWithMultiplier(finalXP, 'CLOSE_POLL_DEADLINE');
        logger.info(`Close deadline bonus applied for poll ${pollId}`);
      }

      const roundedXP = Math.round(finalXP);
      await GamificationService.awardXP(
        userId,
        roundedXP,
        reward.reason,
        reward.category,
        { pollId, menuItemId, baseAmount: reward.amount },
        `vote:${pollId}:${userId}:${menuItemId}`
      );

      logger.info(`XP awarded: ${xpAmount} to user ${userId} for voting`);
    } catch (xpError) {
      logger.error('Failed to award XP for vote:', xpError);
    }
  }

  /**
   * Проверить, является ли это первым голосом пользователя за сегодня
   */
  private static async isFirstVoteOfDay(userId: number): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const voteCount = await prisma.vote.count({
        where: {
          userId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // Проверяем, что это первый голос за сегодня (только что созданный)
      return voteCount === 1;
    } catch (error) {
      logger.error('Error checking first vote of day:', error);
      return false;
    }
  }

  /**
   * Проверить, является ли голосование единогласным (все проголосовали за одно блюдо)
   */
  private static async isUnanimousVote(pollId: number): Promise<boolean> {
    try {
      const votes = await prisma.vote.findMany({
        where: {
          pollId,
          menuItemId: { not: null },
        },
        distinct: ['menuItemId'],
      });

      // Единогласным считаем, если все голоса за одно блюдо
      return votes.length <= 1;
    } catch (error) {
      logger.error('Error checking unanimous vote:', error);
      return false;
    }
  }

  /**
   * Проверить, голосование происходит в последний час до дедлайна
   */
  private static async isCloseToDeadline(pollId: number): Promise<boolean> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: { duration: true, createdAt: true },
      });

      if (!poll) return false;

      const deadline = new Date(poll.createdAt);
      deadline.setMinutes(deadline.getMinutes() + poll.duration);

      const now = new Date();
      const oneHourFromDeadline = new Date(deadline);
      oneHourFromDeadline.setHours(oneHourFromDeadline.getHours() - 1);

      return now >= oneHourFromDeadline && now < deadline;
    } catch (error) {
      logger.error('Error checking close to deadline:', error);
      return false;
    }
  }
}
