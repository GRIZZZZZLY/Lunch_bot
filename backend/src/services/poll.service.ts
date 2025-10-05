import { Poll, Vote, PollResult, Prisma, MenuItem } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreatePollData, PollWithDetails, PollStats } from '../types/poll.types';
import { createPollKeyboard, createPollMessage } from '../bot/keyboards/poll.keyboard';
import { GroupService } from './group.service';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheInvalidator } from './cache.service';

// Bot instance будет инициализирован из bot.ts
let botInstance: any = null;

export function initializePollServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('PollService bot instance initialized');
}

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

      // Инвалидируем кэш активных голосований
      CacheInvalidator.invalidatePoll(poll.id, poll.groupId);

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
   * Получение активного голосования в группе (С КЭШИРОВАНИЕМ)
   */
  static async getActivePollInGroup(groupId: number): Promise<Poll | null> {
    try {
      return await cacheService.getOrSet(
        CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId),
        async () => {
          return await prisma.poll.findFirst({
            where: {
              groupId,
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
          });
        },
        CACHE_TTL.ACTIVE_POLLS
      );
    } catch (error) {
      logger.error('Error getting active poll in group:', error);
      throw new Error('Failed to get active poll');
    }
  }

  /**
   * Получение всех активных голосований (С КЭШИРОВАНИЕМ)
   */
  static async getActivePolls(): Promise<any[]> {
    try {
      logger.info('🔍 Fetching active polls...');
      
      const polls = await prisma.poll.findMany({
        where: { status: 'ACTIVE' },
        include: {
          group: true,
          votes: {
            include: {
              user: true,
              menuItem: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      logger.info(`📊 Found ${polls.length} polls with ACTIVE status`);
      
      // Фильтруем голосования с валидными данными
      const now = new Date();
      const activePolls = polls.filter((poll) => {
        const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
        const isActive = endsAt > now;
        logger.info(`Poll ${poll.id}: ends=${endsAt.toISOString()}, now=${now.toISOString()}, active=${isActive}`);
        return isActive;
      });
      
      logger.info(`✅ Returning ${activePolls.length} active polls`);
      
      // Convert BigInt to string for JSON serialization
      const serializedPolls = activePolls.map(poll => ({
        ...poll,
        chatId: poll.chatId ? poll.chatId.toString() : null,
      }));
      
      return serializedPolls;
    } catch (error: any) {
      logger.error('❌ Error getting active polls:', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
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
        // responsibleUserId будет обновлен после запуска рулетки
        const pollResult = await tx.pollResult.create({
          data: {
            pollId,
            winnerMenuItemId,
            totalVotes: poll.votes.length,
            responsibleUserId: poll.createdBy, // Временно используем создателя, обновится после рулетки
          },
        });

        return pollResult;
      });

      // Инвалидируем кэш после завершения голосования
      CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      
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

  /**
   * Обновление голосования
   */
  static async updatePoll(pollId: number, data: Partial<Poll>): Promise<Poll> {
    try {
      const poll = await prisma.poll.update({
        where: { id: pollId },
        data,
      });

      logger.info(`Poll updated: ${pollId}`);
      return poll;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('Poll not found');
        }
      }
      logger.error('Error updating poll:', error);
      throw new Error('Failed to update poll');
    }
  }

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
   * Получение истории голосований (ОПТИМИЗИРОВАНО с select)
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
          select: {
            id: true,
            groupId: true,
            status: true,
            duration: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            updatedAt: true,
            group: {
              select: {
                id: true,
                title: true,
                telegramId: true,
              },
            },
            result: {
              select: {
                id: true,
                totalVotes: true,
                createdAt: true,
                winnerMenuItem: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    imageUrl: true,
                  },
                },
                responsibleUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    telegramId: true,
                  },
                },
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
  /**
   * РЎРѕС…СЂР°РЅРµРЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚Р° СЂСѓР»РµС‚РєРё
   */
  static async savePollResult(data: {
    pollId: number;
    winnerMenuItemId?: number;
    responsibleUserId: number;
    totalVotes: number;
    rouletteData?: string;
  }): Promise<any> {
    try {
      const existing = await prisma.pollResult.findUnique({
        where: { pollId: data.pollId },
      });

      if (existing) {
        const result = await prisma.pollResult.update({
          where: { pollId: data.pollId },
          data: {
            responsibleUserId: data.responsibleUserId,
            rouletteData: data.rouletteData,
          },
          include: {
            poll: true,
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });
        logger.info(`Poll result updated for poll ${data.pollId}`);
        return result;
      } else {
        const result = await prisma.pollResult.create({
          data: {
            pollId: data.pollId,
            winnerMenuItemId: data.winnerMenuItemId,
            responsibleUserId: data.responsibleUserId,
            totalVotes: data.totalVotes,
          },
          include: {
            poll: true,
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });
        logger.info(`Poll result created for poll ${data.pollId}`);
        return result;
      }
    } catch (error) {
      logger.error('Error saving poll result:', error);
      throw new Error('Failed to save poll result');
    }
  }

}