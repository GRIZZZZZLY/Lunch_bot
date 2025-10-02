import { Vote, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateVoteData, VoteWithDetails } from '../types/poll.types';

export class VoteService {
  /**
   * РЎРѕР·РґР°РЅРёРµ РЅРѕРІРѕРіРѕ РіРѕР»РѕСЃР°
   */
  static async createVote(data: CreateVoteData): Promise<Vote> {
    try {
      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
        },
      });
      logger.info(`Vote created: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`);
      return vote;
    } catch (error) {
      logger.error('Error creating vote:', error);
      throw new Error('Failed to create vote');
    }
  }

  /**
   * РћР±РЅРѕРІР»РµРЅРёРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ РіРѕР»РѕСЃР°
   */
  static async updateVote(voteId: number, menuItemId: number): Promise<Vote> {
    try {
      const vote = await prisma.vote.update({
        where: { id: voteId },
        data: {
          menuItemId,
          updatedAt: new Date(),
        },
      });
      logger.info(`Vote updated: vote ${voteId} changed to item ${menuItemId}`);
      return vote;
    } catch (error) {
      logger.error('Error updating vote:', error);
      throw new Error('Failed to update vote');
    }
  }

  /**
   * РџРѕР»СѓС‡РµРЅРёРµ РґРµС‚Р°Р»СЊРЅРѕР№ СЂР°Р·Р±РёРІРєРё РіРѕР»РѕСЃРѕРІ РїРѕ Р±Р»СЋРґР°Рј
   */
  static async getVoteBreakdown(pollId: number): Promise<Array<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
    percentage: number;
    voters: Array<{ id: number; firstName: string; username?: string }>;
  }>> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              username: true,
            },
          },
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const totalVotes = votes.length;
      const breakdown = new Map<number, {
        menuItemName: string;
        votes: number;
        voters: Array<{ id: number; firstName: string; username?: string }>;
      }>();

      votes.forEach(vote => {
        const existing = breakdown.get(vote.menuItemId) || {
          menuItemName: vote.menuItem.name,
          votes: 0,
          voters: [],
        };
        existing.votes++;
        existing.voters.push({
          id: vote.user.id,
          firstName: vote.user.firstName,
          username: vote.user.username || undefined,
        });
        breakdown.set(vote.menuItemId, existing);
      });

      return Array.from(breakdown.entries())
        .map(([menuItemId, data]) => ({
          menuItemId,
          menuItemName: data.menuItemName,
          votes: data.votes,
          percentage: totalVotes > 0 ? Math.round((data.votes / totalVotes) * 100) : 0,
          voters: data.voters,
        }))
        .sort((a, b) => b.votes - a.votes);
    } catch (error) {
      logger.error('Error getting vote breakdown:', error);
      throw new Error('Failed to get vote breakdown');
    }
  }
  /**
   * Создание или обновление голоса
   */
  static async upsertVote(data: CreateVoteData): Promise<Vote> {
    try {
      // Проверяем, что голосование активно
      const poll = await prisma.poll.findUnique({
        where: { id: data.pollId },
        where: { status: 'ACTIVE' }, select: { id: true, status: true, endedAt: true },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }
      if (poll.status !== 'ACTIVE') {
        throw new Error('Poll is not active');
      }

      // Проверяем, не истекло ли время голосования
      if (poll.endedAt && poll.endedAt < new Date()) {
        throw new Error('Poll has expired');
      }

      // Создаем или обновляем голос
      const vote = await prisma.vote.upsert({
        where: {
          pollId_userId: {
            pollId: data.pollId,
            userId: data.userId,
          },
        },
        update: {
          menuItemId: data.menuItemId,
          updatedAt: new Date(),
        },
        create: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
        },
      });

      logger.info(`Vote upserted: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`);
      return vote;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error upserting vote:', error);
        throw error;
      }
      logger.error('Unknown error upserting vote:', error);
      throw new Error('Failed to upsert vote');
    }
  }

  /**
   * Получение голоса пользователя в голосовании
   */
  static async getUserVoteInPoll(pollId: number, userId: number): Promise<Vote | null> {
    try {
      return await prisma.vote.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId,
          },
        },
        include: {
          menuItem: true,
        },
      });
    } catch (error) {
      logger.error('Error getting user vote in poll:', error);
      throw new Error('Failed to get user vote');
    }
  }

  /**
   * Удаление голоса пользователя
   */
  static async removeVote(pollId: number, userId: number): Promise<void> {
    try {
      // Проверяем, что голосование активно
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        where: { status: 'ACTIVE' }, select: { id: true, status: true },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }
      if (poll.status !== 'ACTIVE') {
        throw new Error('Poll is not active');
      }

      await prisma.vote.delete({
        where: {
          pollId_userId: {
            pollId,
            userId,
          },
        },
      });

      logger.info(`Vote removed: user ${userId} from poll ${pollId}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Vote not found');
        }
      }
      logger.error('Error removing vote:', error);
      throw new Error('Failed to remove vote');
    }
  }

  /**
   * Получение всех голосов в голосовании
   */
  static async getPollVotes(pollId: number): Promise<VoteWithDetails[]> {
    try {
      return await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: true,
          menuItem: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error getting poll votes:', error);
      throw new Error('Failed to get poll votes');
    }
  }

  /**
   * Подсчет голосов по блюдам в голосовании
   */
  static async getVoteCountByMenuItem(pollId: number): Promise<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
  }[]> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Подсчитываем голоса
      const voteCount = new Map<number, { name: string; count: number }>();

      votes.forEach(vote => {
        const existing = voteCount.get(vote.menuItemId) || { 
          name: vote.menuItem.name, 
          count: 0 
        };
        voteCount.set(vote.menuItemId, { 
          name: existing.name, 
          count: existing.count + 1 
        });
      });

      // Преобразуем в массив и сортируем по количеству голосов
      return Array.from(voteCount.entries())
        .map(([menuItemId, data]) => ({
          menuItemId,
          menuItemName: data.name,
          votes: data.count,
        }))
        .sort((a, b) => b.votes - a.votes);
    } catch (error) {
      logger.error('Error getting vote count by menu item:', error);
      throw new Error('Failed to get vote count by menu item');
    }
  }

  /**
   * Получение всех пользователей, проголосовавших в голосовании
   */
  static async getPollVoters(pollId: number): Promise<{
    id: number;
    telegramId: bigint;
    firstName: string;
    lastName?: string;
    username?: string;
    votedFor: string;
    votedAt: Date;
  }[]> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: true,
          menuItem: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return votes.map(vote => ({
        id: vote.user.id,
        telegramId: vote.user.telegramId,
        firstName: vote.user.firstName,
        lastName: vote.user.lastName,
        username: vote.user.username,
        votedFor: vote.menuItem.name,
        votedAt: vote.createdAt,
      }));
    } catch (error) {
      logger.error('Error getting poll voters:', error);
      throw new Error('Failed to get poll voters');
    }
  }

  /**
   * Проверка, голосовал ли пользователь в голосовании
   */
  static async hasUserVoted(pollId: number, userId: number): Promise<boolean> {
    try {
      const vote = await prisma.vote.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId,
          },
        },
      });

      return vote !== null;
    } catch (error) {
      logger.error('Error checking if user voted:', error);
      return false;
    }
  }

  /**
   * Получение статистики голосов пользователя
   */
  static async getUserVoteStats(userId: number): Promise<{
    totalVotes: number;
    pollsParticipated: number;
    favoriteMenuItems: { name: string; votes: number }[];
    lastVoteDate?: Date;
  }> {
    try {
      const [totalVotes, votes] = await Promise.all([
        prisma.vote.count({ where: { userId } }),
        prisma.vote.findMany({
          where: { userId },
          include: {
            menuItem: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const pollsParticipated = new Set(votes.map(v => v.pollId)).size;
      
      // Подсчитываем любимые блюда
      const menuItemCount = new Map<string, number>();
      votes.forEach(vote => {
        const name = vote.menuItem.name;
        menuItemCount.set(name, (menuItemCount.get(name) || 0) + 1);
      });

      const favoriteMenuItems = Array.from(menuItemCount.entries())
        .map(([name, votes]) => ({ name, votes }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 5);

      const lastVoteDate = votes.length > 0 ? votes[0].createdAt : undefined;

      return {
        totalVotes,
        pollsParticipated,
        favoriteMenuItems,
        lastVoteDate,
      };
    } catch (error) {
      logger.error('Error getting user vote stats:', error);
      throw new Error('Failed to get user vote stats');
    }
  }

  /**
   * Получение голосов пользователя с пагинацией
   */
  static async getUserVotes(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    votes: VoteWithDetails[];
    total: number;
  }> {
    try {
      const [votes, total] = await Promise.all([
        prisma.vote.findMany({
          where: { userId },
          include: {
            poll: {
              include: {
                group: {
                  select: {
                    title: true,
                  },
                },
              },
            },
            menuItem: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.vote.count({ where: { userId } }),
      ]);

      return { votes: votes as VoteWithDetails[], total };
    } catch (error) {
      logger.error('Error getting user votes:', error);
      throw new Error('Failed to get user votes');
    }
  }

  /**
   * Массовое удаление голосов (для завершенных голосований)
   */
  static async removeExpiredVotes(pollIds: number[]): Promise<number> {
    try {
      if (pollIds.length === 0) {
        return 0;
      }

      const result = await prisma.vote.deleteMany({
        where: {
          pollId: {
            in: pollIds,
          },
          poll: {
            status: 'COMPLETED',
            createdAt: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // старше 30 дней
            },
          },
        },
      });

      logger.info(`Removed ${result.count} expired votes from ${pollIds.length} polls`);
      return result.count;
    } catch (error) {
      logger.error('Error removing expired votes:', error);
      throw new Error('Failed to remove expired votes');
    }
  }

  /**
   * Получение топ блюд по количеству голосов за период
   */
  static async getTopMenuItemsByVotes(
    days: number = 30,
    limit: number = 10,
    groupId?: number
  ): Promise<{
    menuItemId: number;
    menuItemName: string;
    totalVotes: number;
    uniqueVoters: number;
  }[]> {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const votes = await prisma.vote.findMany({
        where: {
          createdAt: {
            gte: dateFrom,
          },
          ...(groupId && {
            poll: {
              groupId,
            },
          }),
        },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Подсчитываем статистику
      const stats = new Map<number, {
        name: string;
        votes: number;
        voters: Set<number>;
      }>();

      votes.forEach(vote => {
        const existing = stats.get(vote.menuItemId) || {
          name: vote.menuItem.name,
          votes: 0,
          voters: new Set<number>(),
        };

        existing.votes++;
        existing.voters.add(vote.userId);
        
        stats.set(vote.menuItemId, existing);
      });

      // Преобразуем в результат
      return Array.from(stats.entries())
        .map(([menuItemId, data]) => ({
          menuItemId,
          menuItemName: data.name,
          totalVotes: data.votes,
          uniqueVoters: data.voters.size,
        }))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting top menu items by votes:', error);
      throw new Error('Failed to get top menu items by votes');
    }
  }
}
