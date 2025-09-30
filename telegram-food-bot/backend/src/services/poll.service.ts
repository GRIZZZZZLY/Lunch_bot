import { Poll, Vote, PollResult, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreatePollData, PollWithDetails, PollStats } from '../types/poll.types';

export class PollService {
  /**
   * Создание нового голосования
   */
  static async createPoll(data: CreatePollData): Promise<Poll> {
    try {
      const poll = await prisma.poll.create({
        data: {
          groupId: data.groupId,
          status: 'ACTIVE',
          duration: data.duration || 30,
          createdBy: data.createdBy,
        },
      });

      logger.info(`Poll created: ${poll.id} in group ${poll.groupId}`);
      return poll;
    } catch (error) {
      logger.error('Error creating poll:', error);
      throw new Error('Failed to create poll');
    }
  }

  /**
   * Получение голосования по ID с деталями
   */
  static async getPollById(id: number): Promise<PollWithDetails | null> {
    try {
      return await prisma.poll.findUnique({
        where: { id },
        include: {
          group: true,
          votes: {
            include: {
              user: true,
              menuItem: true,
            },
          },
          result: {
            include: {
              winnerMenuItem: true,
              responsibleUser: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error getting poll by ID:', error);
      throw new Error('Failed to get poll');
    }
  }

  /**
   * Получение активного голосования в группе
   */
  static async getActivePollInGroup(groupId: number): Promise<Poll | null> {
    try {
      return await prisma.poll.findFirst({
        where: {
          groupId,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      logger.error('Error getting active poll in group:', error);
      throw new Error('Failed to get active poll');
    }
  }

  /**
   * Получение всех активных голосований
   */
  static async getActivePolls(): Promise<Poll[]> {
    try {
      return await prisma.poll.findMany({
        where: { status: 'ACTIVE' },
        include: {
          group: true,
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error getting active polls:', error);
      throw new Error('Failed to get active polls');
    }
  }

  /**
   * Завершение голосования
   */
  static async completePoll(pollId: number): Promise<PollResult> {
    try {
      // Получаем голосование с голосами
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            include: {
              menuItem: true,
              user: true,
            },
          },
        },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }
      if (poll.status !== 'ACTIVE') {
        throw new Error('Poll is already completed');
      }

      // Подсчитываем голоса
      const voteCount = new Map<number, { count: number; menuItem: any }>();
      poll.votes.forEach(vote => {
        const current = voteCount.get(vote.menuItemId) || { count: 0, menuItem: vote.menuItem };
        voteCount.set(vote.menuItemId, { count: current.count + 1, menuItem: vote.menuItem });
      });

      // Определяем победителя
      let winnerMenuItemId: number | null = null;
      let maxVotes = 0;

      for (const [itemId, data] of voteCount.entries()) {
        if (data.count > maxVotes) {
          maxVotes = data.count;
          winnerMenuItemId = itemId;
        }
      }

      // Завершаем голосование в транзакции
      const result = await prisma.$transaction(async (tx) => {
        // Обновляем статус голосования
        await tx.poll.update({
          where: { id: pollId },
          data: { 
            status: 'COMPLETED',
            endedAt: new Date()
          },
        });

        // Создаем результат голосования
        const pollResult = await tx.pollResult.create({
          data: {
            pollId,
            winnerMenuItemId,
            totalVotes: poll.votes.length,
            // isRouletteRun: false, // Field removed from schema
          },
        });

        return pollResult;
      });

      logger.info(`Poll completed: ${pollId}, winner: ${winnerMenuItemId}, total votes: ${poll.votes.length}`);
      
      // Возвращаем результат с деталями
      return await this.getPollResult(result.id);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error completing poll:', error);
        throw error;
      }
      logger.error('Unknown error completing poll:', error);
      throw new Error('Failed to complete poll');
    }
  }

  /**
   * Отмена голосования
   */
  static async cancelPoll(pollId: number): Promise<Poll> {
    try {
      const poll = await prisma.poll.update({
        where: { id: pollId },
        data: { status: 'COMPLETED' },
      });

      logger.info(`Poll cancelled: ${pollId}`);
      return poll;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Poll not found');
        }
      }
      logger.error('Error cancelling poll:', error);
      throw new Error('Failed to cancel poll');
    }
  }

  // MessageId больше не хранится в Poll, используйте контекст бота для хранения messageId

  /**
   * Получение результата голосования
   */
  static async getPollResult(resultId: number): Promise<PollResult> {
    try {
      const result = await prisma.pollResult.findUnique({
        where: { id: resultId },
        include: {
          poll: {
            include: {
              group: true,
              votes: {
                include: {
                  user: true,
                  menuItem: true,
                },
              },
            },
          },
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });

      if (!result) {
        throw new Error('Poll result not found');
      }

      return result;
    } catch (error) {
      logger.error('Error getting poll result:', error);
      throw new Error('Failed to get poll result');
    }
  }

  /**
   * Получение результатов голосования по poll ID
   */
  static async getPollResultByPollId(pollId: number): Promise<PollResult | null> {
    try {
      return await prisma.pollResult.findUnique({
        where: { pollId },
        include: {
          poll: {
            include: {
              group: true,
            },
          },
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });
    } catch (error) {
      logger.error('Error getting poll result by poll ID:', error);
      throw new Error('Failed to get poll result');
    }
  }

  /**
   * Запуск рулетки для выбора ответственного
   */
  static async runRoulette(pollId: number): Promise<PollResult> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Получаем уникальных пользователей, которые голосовали
      const voters = Array.from(
        new Map(poll.votes.map(vote => [vote.userId, vote.user])).values()
      );

      if (voters.length === 0) {
        throw new Error('No voters found');
      }

      // Случайно выбираем ответственного
      const randomIndex = Math.floor(Math.random() * voters.length);
      const responsibleUser = voters[randomIndex];

      // Обновляем результат голосования
      const result = await prisma.pollResult.update({
        where: { pollId },
        data: {
          responsibleUserId: responsibleUser.id,
          // isRouletteRun: true, // Field removed from schema
        },
        include: {
          poll: {
            include: {
              group: true,
            },
          },
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });

      logger.info(`Roulette completed for poll ${pollId}: selected user ${responsibleUser.id} (${responsibleUser.firstName})`);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error running roulette:', error);
        throw error;
      }
      logger.error('Unknown error running roulette:', error);
      throw new Error('Failed to run roulette');
    }
  }

  /**
   * Получение истории голосований
   */
  static async getPollHistory(
    groupId?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ polls: Poll[]; total: number }> {
    try {
      const where = {
        status: 'COMPLETED',
        ...(groupId && { groupId }),
      };

      const [polls, total] = await Promise.all([
        prisma.poll.findMany({
          where,
          include: {
            group: true,
            result: {
              include: {
                winnerMenuItem: true,
                responsibleUser: true,
              },
            },
            _count: {
              select: {
                votes: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.poll.count({ where }),
      ]);

      return { polls, total };
    } catch (error) {
      logger.error('Error getting poll history:', error);
      throw new Error('Failed to get poll history');
    }
  }

  /**
   * Получение статистики голосований
   */
  static async getPollStats(groupId?: number): Promise<PollStats> {
    try {
      const where = groupId ? { groupId } : {};

      const [totalPolls, activePolls, completedPolls, totalVotes] = await Promise.all([
        prisma.poll.count({ where }),
        prisma.poll.count({ where: { ...where, status: 'ACTIVE' } }),
        prisma.poll.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.vote.count({
          where: groupId ? {
            poll: { groupId }
          } : undefined
        }),
      ]);

      // Получаем среднее количество участников в голосовании
      const avgParticipants = await prisma.poll.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _avg: {
          id: true, // Это будет пересчитано ниже
        },
      });

      // Получаем данные для подсчета среднего количества участников
      const pollsWithVoteCounts = await prisma.poll.findMany({
        where: { ...where, status: 'COMPLETED' },
        include: {
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });

      const averageParticipants = completedPolls > 0 
        ? Math.round(pollsWithVoteCounts.reduce((sum, poll) => sum + poll._count.votes, 0) / completedPolls * 100) / 100
        : 0;

      return {
        totalPolls,
        activePolls,
        completedPolls,
        totalVotes,
        averageParticipants,
      };
    } catch (error) {
      logger.error('Error getting poll stats:', error);
      throw new Error('Failed to get poll stats');
    }
  }

  /**
   * Получение голосований с истекшим временем
   */
  static async getExpiredPolls(): Promise<Poll[]> {
    try {
      return await prisma.poll.findMany({
        where: {
          status: 'ACTIVE',
          startedAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });
    } catch (error) {
      logger.error('Error getting expired polls:', error);
      throw new Error('Failed to get expired polls');
    }
  }

  /**
   * Получение подробной статистики по голосованию
   */
  static async getPollVoteBreakdown(pollId: number): Promise<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
    percentage: number;
    voters: { id: number; firstName: string; username?: string }[];
  }[]> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            include: {
              user: true,
              menuItem: true,
            },
          },
        },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      const totalVotes = poll.votes.length;
      const breakdown = new Map();

      poll.votes.forEach(vote => {
        const key = vote.menuItemId;
        const existing = breakdown.get(key) || {
          menuItemId: vote.menuItemId,
          menuItemName: vote.menuItem.name,
          votes: 0,
          voters: [],
        };

        existing.votes += 1;
        existing.voters.push({
          id: vote.user.id,
          firstName: vote.user.firstName,
          username: vote.user.username,
        });

        breakdown.set(key, existing);
      });

      return Array.from(breakdown.values()).map(item => ({
        ...item,
        percentage: totalVotes > 0 ? Math.round((item.votes / totalVotes) * 100) : 0,
      })).sort((a, b) => b.votes - a.votes);
    } catch (error) {
      logger.error('Error getting poll vote breakdown:', error);
      throw new Error('Failed to get poll vote breakdown');
    }
  }
}
