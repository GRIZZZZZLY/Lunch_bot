import { Poll, Vote, PollResult, Prisma, MenuItem, User } from '@prisma/client';
import { LRUCache } from 'lru-cache';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreatePollData, PollWithDetails, PollStats } from '../types/poll.types';
import { createPollKeyboard, createPollMessage } from '../bot/keyboards/poll.keyboard';
import { GroupService } from './group.service';
import { NotificationService } from './notification.service';
import { cacheService, CACHE_KEYS, CACHE_TTL, CacheInvalidator } from './cache.service';
import {
  now,
  getStartOfToday,
  toISOString,
  calculatePollEndTime,
  getTimestamp,
  getMillisecondsDifference,
  subtractMinutes,
} from '../utils/date';

// Тип Vote с включенными связями для корректной типизации
type VoteWithRelations = Vote & {
  menuItem: MenuItem | null;
  user: User;
};

// Bot instance будет инициализирован из bot.ts
let botInstance: any = null;

export function initializePollServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('PollService bot instance initialized');
}

// Константы для кеширования
const MEMBER_COUNT_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 часа
const MEMBER_COUNT_CACHE_MAX = 500; // Максимум 500 групп в кеше

// Тип для записи в кеше
interface MemberCountCacheEntry {
  count: number;
  source: 'telegram_api' | 'history';
}

// LRU-кэш количества участников групп (с автоматическим TTL и ограничением размера)
const memberCountCache = new LRUCache<number, MemberCountCacheEntry>({
  max: MEMBER_COUNT_CACHE_MAX,
  ttl: MEMBER_COUNT_CACHE_TTL,
  updateAgeOnGet: false, // Не обновляем TTL при чтении
  updateAgeOnHas: false,
});

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
   * Получение последнего завершённого голосования сегодня в группе
   */
  static async getTodayCompletedPoll(groupId: number): Promise<PollWithDetails | null> {
    try {
      const today = getStartOfToday();
      
      logger.info(`🔍 getTodayCompletedPoll: groupId=${groupId}, today=${today.toISOString()}`);

      const poll = await prisma.poll.findFirst({
        where: {
          groupId,
          status: 'COMPLETED',
          endedAt: {
            gte: today,
          },
        },
        orderBy: {
          endedAt: 'desc',
        },
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

      if (poll) {
        logger.info(`✅ Found completed poll TODAY: id=${poll.id}, endedAt=${poll.endedAt?.toISOString()}`);
        return poll;
      }
      
      // Если сегодня нет завершённых - берём последнее вообще
      logger.info('❌ No completed poll found today, fetching last completed poll...');
      
      const lastPoll = await prisma.poll.findFirst({
        where: {
          groupId,
          status: 'COMPLETED',
        },
        orderBy: {
          endedAt: 'desc',
        },
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
      
      if (lastPoll) {
        logger.info(`✅ Found LAST completed poll: id=${lastPoll.id}, endedAt=${lastPoll.endedAt?.toISOString()}`);
      }

      return lastPoll;
    } catch (error) {
      logger.error('Error getting today completed poll:', error);
      throw new Error('Failed to get today completed poll');
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
      
      // Фильтруем и автоматически закрываем истекшие голосования
      const nowDate = now();
      const activePolls = [];
      const expiredPollIds: number[] = [];

      for (const poll of polls) {
        const endsAt = poll.endedAt || calculatePollEndTime(poll.startedAt, poll.duration);
        const isActive = endsAt > nowDate;
        logger.info(`Poll ${poll.id}: ends=${toISOString(endsAt)}, now=${toISOString(nowDate)}, active=${isActive}`);
        
        if (isActive) {
          activePolls.push(poll);
        } else {
          // Голосование истекло - закрываем автоматически
          expiredPollIds.push(poll.id);
          logger.info(`⏰ Poll ${poll.id} expired, auto-closing...`);
        }
      }
      
      // Закрываем истекшие голосования синхронно с проверкой статуса (fix race condition)
      if (expiredPollIds.length > 0) {
        try {
          // Используем транзакцию для атомарного обновления
          await prisma.$transaction(async (tx) => {
            // Проверяем статус каждого poll перед обновлением
            const stillActivePolls = await tx.poll.findMany({
              where: {
                id: { in: expiredPollIds },
                status: 'ACTIVE', // Только если всё ещё активен
              },
              select: { id: true },
            });

            const idsToClose = stillActivePolls.map(p => p.id);
            
            if (idsToClose.length > 0) {
              await tx.poll.updateMany({
                where: { id: { in: idsToClose } },
                data: {
                  status: 'COMPLETED',
                  endedAt: now(),
                },
              });
              logger.info(`✅ Auto-closed ${idsToClose.length} expired polls: ${idsToClose.join(', ')}`);
            }
          });
        } catch (err) {
          logger.error(`❌ Failed to auto-close expired polls:`, err);
        }
      }
      
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
   * Использует транзакцию с проверкой статуса для предотвращения race condition
   */
  static async completePoll(pollId: number): Promise<PollResult> {
    try {
      // Используем транзакцию для атомарной операции (fix race condition)
      const result = await prisma.$transaction(async (tx) => {
        // 1. Получаем голосование с блокировкой и проверяем статус внутри транзакции
        const poll = await tx.poll.findUnique({
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
        
        // Проверка статуса ВНУТРИ транзакции - ключевое исправление
        if (poll.status !== 'ACTIVE') {
          throw new Error(`Poll is already ${poll.status.toLowerCase()}`);
        }

        // 2. Подсчитываем голоса
        const voteCount = new Map<number, { count: number; menuItem: any }>();
        poll.votes.forEach(vote => {
          if (!vote.menuItemId || !vote.menuItem) return;
          
          const current = voteCount.get(vote.menuItemId) || { count: 0, menuItem: vote.menuItem };
          voteCount.set(vote.menuItemId, { count: current.count + 1, menuItem: vote.menuItem });
        });

        // 3. Определяем победителя
        let winnerMenuItemId: number | null = null;
        let maxVotes = 0;

        for (const [itemId, data] of voteCount.entries()) {
          if (data.count > maxVotes) {
            maxVotes = data.count;
            winnerMenuItemId = itemId;
          }
        }

        // 4. Обновляем статус голосования
        await tx.poll.update({
          where: { id: pollId },
          data: {
            status: 'COMPLETED',
            endedAt: now(),
          },
        });

        // 5. Создаем результат голосования
        const pollResult = await tx.pollResult.create({
          data: {
            pollId,
            winnerMenuItemId,
            totalVotes: poll.votes.length,
            responsibleUserId: poll.createdBy,
          },
        });

        // Сохраняем данные poll для использования после транзакции
        return { pollResult, poll };
      });

      const { pollResult, poll } = result;

      // Инвалидируем кэш после завершения голосования
      CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      
      logger.info(`Poll completed: ${pollId}, winner: ${pollResult.winnerMenuItemId}, total votes: ${poll.votes.length}`);

      // Sprint 6: XP интеграция за создание опроса
      try {
        const { GamificationService } = await import('./gamification.service.js');
        const { getXPReward } = await import('../constants/xp-constants.js');
        const reward = getXPReward('CREATE_POLL');
        await GamificationService.awardXP(
          poll.createdBy,
          reward.amount,
          reward.reason,
          reward.category,
          { pollId, participants: poll.votes.length }
        );
        logger.info(`XP awarded: ${reward.amount} to user ${poll.createdBy} for creating poll`);
      } catch (xpError) {
        logger.error('Failed to award XP for poll creation:', xpError);
        // Не прерываем основной процесс
      }
      
      // Отправляем уведомления участникам (single winner)
      try {
        const { notificationService } = await import('./notification.service.js');
        await notificationService.sendPollCompletionNotifications(pollId);
        logger.info(`Completion notifications sent for poll ${pollId}`);
      } catch (notifError) {
        logger.error('Error sending completion notifications:', notifError);
      }
      
      // Возвращаем результат с деталями
      return await this.getPollResult(pollResult.id);
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
  static async cancelPoll(
    pollId: number,
    cancelledBy: number,
    reason?: string
  ): Promise<Poll> {
    try {
      const poll = await prisma.poll.update({
        where: { id: pollId },
        data: {
          status: 'CANCELLED',
          endedAt: now()
        },
      });

      // Инвалидируем кэш активных голосований
      CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      logger.info(`Cache invalidated for cancelled poll ${pollId} in group ${poll.groupId}`);

      // Отправляем уведомления об отмене
      const user = await prisma.user.findUnique({
        where: { id: cancelledBy }
      });

      if (user) {
        const { notificationService } = await import('./notification.service.js');
        await notificationService.sendPollCancelledNotifications(
          pollId,
          user,
          reason
        );
      }

      logger.info(`Poll cancelled: ${pollId} by user ${cancelledBy}`, { reason });
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
      if (error instanceof Error && error.message === 'Poll result not found') {
        throw error;
      }
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
  ): Promise<{ polls: any[]; total: number }> {
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
            createdBy: true,
            messageId: true,
            chatId: true,
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
   * Получение последнего завершённого голосования
   * Используется для функции "Повторить вчерашнее"
   */
  static async getLastCompletedPoll(groupId?: number): Promise<Poll | null> {
    try {
      const where: Prisma.PollWhereInput = {
        status: 'COMPLETED',
        ...(groupId && { groupId }),
      };

      const poll = await prisma.poll.findFirst({
        where,
        orderBy: { endedAt: 'desc' },
        include: {
          group: true,
        },
      });

      return poll;
    } catch (error) {
      logger.error('Error getting last completed poll:', error);
      throw error;
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
   * Получение статистики участия пользователя
   */
  static async getUserParticipationStats(userId: number): Promise<{
    totalVotes: number;
    totalPolls: number;
    participationRate: number;
    favoriteItems: Array<{
      itemId: number;
      itemName: string;
      voteCount: number;
      percentage: number;
    }>;
    recentActivity: Array<{
      pollId: number;
      pollTitle: string;
      votedAt: string;
      itemName: string;
    }>;
  }> {
    try {
      // 1. Подсчет общего количества голосов пользователя
      const totalVotes = await prisma.vote.count({
        where: { userId }
      });

      // 2. Подсчет завершенных голосований
      const totalPolls = await prisma.poll.count({
        where: { status: 'COMPLETED' }
      });

      // 3. Расчет процента участия
      const participationRate = totalPolls > 0 
        ? Math.round((totalVotes / totalPolls) * 100) 
        : 0;

      // 4. Любимые блюда (топ 5 по количеству голосов)
      const votesByItem = await prisma.vote.groupBy({
        by: ['menuItemId'],
        where: { userId, menuItemId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      });

      const menuItemIds = votesByItem
        .map(v => v.menuItemId)
        .filter((id): id is number => id !== null);

      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } }
      });

      const favoriteItems = votesByItem.map(vote => {
        const item = menuItems.find(m => m.id === vote.menuItemId);
        return {
          itemId: vote.menuItemId!,
          itemName: item?.name || 'Unknown',
          voteCount: vote._count.id,
          percentage: totalVotes > 0 
            ? Math.round((vote._count.id / totalVotes) * 100) 
            : 0
        };
      });

      // 5. Последняя активность (последние 10 голосов)
      const recentVotes = await prisma.vote.findMany({
        where: { userId },
        include: {
          poll: { select: { id: true } },
          menuItem: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      const recentActivity = recentVotes.map(vote => ({
        pollId: vote.pollId,
        pollTitle: 'Голосование на обед',
        votedAt: toISOString(vote.createdAt),
        itemName: vote.menuItem?.name || 'Unknown'
      }));

      return {
        totalVotes,
        totalPolls,
        participationRate,
        favoriteItems,
        recentActivity
      };
    } catch (error) {
      logger.error('Error getting user participation stats:', error);
      throw new Error('Failed to get user participation stats');
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
          startedAt: { lte: subtractMinutes(now(), 30) },
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
        // Skip votes without menuItemId or menuItem
        if (!vote.menuItemId || !vote.menuItem) return;
        
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
      if (error instanceof Error && error.message === 'Poll not found') {
        throw error;
      }
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

  /**
   * Завершение голосования с множественными победителями
   * 
   * @param pollId - ID голосования
   * @param completedBy - User ID админа
   * @param options - Параметры завершения
   * @returns PollResult с MultiWinnerResultData в rouletteData
   */
  static async completePollMultiWinner(
    pollId: number,
    completedBy: number,
    options?: {
      minVotes?: number;
      maxWinners?: number | null;
      tieBreakMethod?: 'earliest' | 'alphabetical';
    }
  ): Promise<PollResult> {
    const { 
      minVotes = 1, 
      maxWinners = null, 
      tieBreakMethod = 'earliest' 
    } = options || {};

    try {
      // 1. Получаем poll с votes и relations
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            include: {
              user: true,
              menuItem: true,
            },
          },
          group: true,
        },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      // Идемпотентность: Если уже завершено - вернуть существующий результат
      if (poll.status === 'COMPLETED') {
        const existingResult = await prisma.pollResult.findUnique({
          where: { pollId },
          include: {
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });

        if (existingResult) {
          logger.info(`Poll ${pollId} already completed, returning existing result`);
          return existingResult;
        }
      }

      if (poll.status !== 'ACTIVE') {
        throw new Error('Poll is not active');
      }

      // 2. Группируем голоса по типу
      const menuItemVotes = new Map<number, VoteWithRelations[]>();
      const bringOwnVotes: VoteWithRelations[] = [];
      const skippedVotes: VoteWithRelations[] = [];

      poll.votes.forEach(vote => {
        if (vote.voteType === 'MENU_ITEM' && vote.menuItemId && vote.menuItem) {
          if (!menuItemVotes.has(vote.menuItemId)) {
            menuItemVotes.set(vote.menuItemId, []);
          }
          menuItemVotes.get(vote.menuItemId)!.push(vote);
        } else if (vote.voteType === 'BRING_OWN') {
          bringOwnVotes.push(vote);
        } else if (vote.voteType === 'SKIP') {
          skippedVotes.push(vote);
        }
      });

      // 3. Формируем winners с фильтрацией minVotes
      let winners = Array.from(menuItemVotes.entries())
        .filter(([_, votes]) => votes.length >= minVotes)
        .map(([itemId, votes]) => {
          const menuItem = votes[0].menuItem!;

          return {
            menuItemId: itemId,
            menuItemName: menuItem.name,
            menuItemSnapshot: {
              price: menuItem.price ?? undefined,
              category: menuItem.category ?? undefined,
              imageUrl: menuItem.imageUrl ?? undefined,
            },
            voterIds: votes.map(v => v.userId),
            voters: votes.map(v => ({
              userId: v.user.id,
              firstName: v.user.firstName,
              lastName: v.user.lastName ?? undefined,
              username: v.user.username ?? undefined,
            })),
            voteCount: votes.length,
            votedAt: votes.map(v => toISOString(v.createdAt)),
          };
        })
        .sort((a, b) => b.voteCount - a.voteCount);

      // Ограничиваем maxWinners
      if (maxWinners && maxWinners > 0) {
        winners = winners.slice(0, maxWinners);
      }

      // 4. Тай-брейк: Определяем primaryWinner
      let primaryWinnerId: number | null = null;
      let tieBreak: any = undefined;

      if (winners.length > 0) {
        const maxVotes = winners[0].voteCount;
        const topWinners = winners.filter(w => w.voteCount === maxVotes);

        if (topWinners.length === 1) {
          primaryWinnerId = topWinners[0].menuItemId;
        } else {
          if (tieBreakMethod === 'earliest') {
            const earliest = topWinners.reduce((prev, curr) => {
              const prevTime = getTimestamp(new Date(prev.votedAt[0]));
              const currTime = getTimestamp(new Date(curr.votedAt[0]));
              return currTime < prevTime ? curr : prev;
            });
            primaryWinnerId = earliest.menuItemId;
          } else if (tieBreakMethod === 'alphabetical') {
            const sorted = [...topWinners].sort((a, b) =>
              a.menuItemName.localeCompare(b.menuItemName, 'ru')
            );
            primaryWinnerId = sorted[0].menuItemId;
          }

          tieBreak = {
            method: tieBreakMethod,
            appliedTo: topWinners.map(w => w.menuItemId),
            reason: `${topWinners.length} блюд с ${maxVotes} голосами`,
          };

          logger.info(`Tie-break applied for poll ${pollId}`, {
            method: tieBreakMethod,
            topWinners: topWinners.map(w => ({ id: w.menuItemId, name: w.menuItemName })),
            selected: primaryWinnerId,
          });
        }
      }

      // 5. Формируем bringOwn и skipped группы
      const bringOwnGroup = {
        voterIds: bringOwnVotes.map(v => v.userId),
        voters: bringOwnVotes.map(v => ({
          userId: v.user.id,
          firstName: v.user.firstName,
          lastName: v.user.lastName ?? undefined,
          username: v.user.username ?? undefined,
        })),
        count: bringOwnVotes.length,
      };

      const skippedGroup = {
        voterIds: skippedVotes.map(v => v.userId),
        voters: skippedVotes.map(v => ({
          userId: v.user.id,
          firstName: v.user.firstName,
          lastName: v.user.lastName ?? undefined,
          username: v.user.username ?? undefined,
        })),
        count: skippedVotes.length,
      };

      // 6. Собираем MultiWinnerResultData
      const resultData = {
        version: 1,
        mode: 'multi-winner' as const,
        winners,
        bringOwn: bringOwnGroup,
        skipped: skippedGroup,
        meta: {
          primaryWinnerId,
          tieBreak,
          completedAt: toISOString(now()),
          completedBy,
          params: { minVotes, maxWinners },
        },
      };

      // 7. Транзакция: Обновляем poll + создаем result
      const result = await prisma.$transaction(async (tx) => {
        await tx.poll.update({
          where: { id: pollId },
          data: {
            status: 'COMPLETED',
            endedAt: now(),
          },
        });

        return await tx.pollResult.create({
          data: {
            pollId,
            winnerMenuItemId: primaryWinnerId,
            totalVotes: poll.votes.length,
            responsibleUserId: completedBy,
            rouletteData: JSON.stringify(resultData),
          },
          include: {
            winnerMenuItem: true,
            responsibleUser: true,
          },
        });
      });

      // 8. Инвалидируем кэш
      CacheInvalidator.invalidatePoll(pollId, poll.groupId);

      logger.info(`Poll ${pollId} completed with multi-winner mode`, {
        winnersCount: winners.length,
        bringOwnCount: bringOwnVotes.length,
        skippedCount: skippedVotes.length,
        primaryWinnerId,
        totalVotes: poll.votes.length,
      });

      // Отправляем уведомления участникам (multi-winner)
      try {
        const { notificationService } = await import('./notification.service.js');
        await notificationService.sendPollCompletionNotifications(pollId);
        logger.info(`Completion notifications sent for poll ${pollId} (multi-winner)`);
      } catch (notifError) {
        logger.error('Error sending completion notifications:', notifError);
      }

      // 🚀 ИНТЕГРАЦИЯ: Запускаем выбор ответственного
      try {
        const { ResponsibleService } = await import('./responsible.service.js');
        await ResponsibleService.startResponsibleSelection(pollId);
        logger.info(`Responsible selection started for poll ${pollId}`);
      } catch (responsibleError) {
        logger.error('Error starting responsible selection:', responsibleError);
      }

      return result;

    } catch (error) {
      logger.error('Error completing poll with multi-winner:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to complete poll with multi-winner mode');
    }
  }

  /**
   * Получение ожидаемого количества участников с LRU-кэшем
   * Приоритеты: 1) Кэш (с автоматическим TTL), 2) Telegram API, 3) Settings, 4) История
   * 
   * Использует LRU-cache для предотвращения утечки памяти (макс. 500 групп, TTL 2 часа)
   */
  private static async getExpectedParticipants(
    groupId: number,
    groupTelegramId: bigint,
    settings: any
  ): Promise<{ count: number; source: string }> {
    // 1️⃣ Проверяем LRU-кэш (автоматически проверяет TTL)
    const cached = memberCountCache.get(groupId);
    if (cached) {
      logger.debug(`Using cached member count for group ${groupId}: ${cached.count} (${cached.source})`);
      return { count: cached.count, source: `cached_${cached.source}` };
    }
    
    // 2️⃣ Получаем из Telegram API
    const realCount = await GroupService.getRealMemberCount(
      groupTelegramId.toString(),
      botInstance
    );
    
    if (realCount !== null) {
      // Сохраняем в LRU-кэш (автоматически вытеснит старые записи)
      memberCountCache.set(groupId, {
        count: realCount,
        source: 'telegram_api',
      });
      
      logger.info(`📊 Updated member count for group ${groupId}: ${realCount} (from Telegram API)`);
      
      // Сохраняем в БД асинхронно (не ждем)
      GroupService.updateGroupSettings(groupId, {
        ...settings,
        expectedParticipants: realCount,
      }).catch(err => logger.error('Error saving expectedParticipants:', err));
      
      return { count: realCount, source: 'telegram_api' };
    }
    
    // 3️⃣ Fallback к настройкам или истории
    let fallbackCount: number;
    let fallbackSource: 'telegram_api' | 'history';
    
    if (settings.expectedParticipants) {
      fallbackCount = settings.expectedParticipants;
      fallbackSource = 'history'; // Считаем настройки как "history" для типизации
    } else {
      fallbackCount = await GroupService.getActiveParticipants(groupId);
      fallbackSource = 'history';
    }
    
    // Сохраняем fallback в LRU-кэш
    memberCountCache.set(groupId, {
      count: fallbackCount,
      source: fallbackSource,
    });
    
    logger.warn(`⚠️ Using fallback member count for group ${groupId}: ${fallbackCount} (${fallbackSource})`);
    
    return { count: fallbackCount, source: fallbackSource };
  }

  /**
   * Проверка условий для автоматического завершения голосования
   */
  static async checkAutoComplete(pollId: number): Promise<boolean> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            select: { userId: true },
            distinct: ['userId']
          },
          group: true
        }
      });

      if (!poll || poll.status !== 'ACTIVE') {
        return false;
      }

      // Получаем настройки группы
      const settings = await GroupService.getGroupSettings(poll.groupId);

      if (!settings.autoCompleteEnabled) {
        logger.info(`Auto-complete disabled for group ${poll.groupId}`);
        return false;
      }

      // Определяем ожидаемое количество участников с использованием кэша
      const { count: expectedParticipants, source } = await this.getExpectedParticipants(
        poll.groupId,
        poll.group.telegramId,
        settings
      );

      const currentVotes = poll.votes.length;
      
      // DEBUG: Показать конкретных пользователей, которые проголосовали
      const voterIds = poll.votes.map(v => v.userId);
      logger.info(`🔍 DEBUG: Poll ${pollId} voters:`, { voterIds });

      // Вычисляем прогресс
      const timeElapsed = getMillisecondsDifference(now(), poll.startedAt);
      const totalTime = poll.duration * 60 * 1000;
      const timeProgress = timeElapsed / totalTime;
      const voteProgress = currentVotes / expectedParticipants;

      logger.info(`Auto-complete check for poll ${pollId}:`, {
        currentVotes,
        expectedParticipants,
        voteProgress: `${Math.round(voteProgress * 100)}%`,
        timeProgress: `${Math.round(timeProgress * 100)}%`,
        source,
        voterIds
      });

      // ✅ Условие 1: Все проголосовали (100% явка)
      if (voteProgress >= 1.0) {
        logger.info(`✅ Auto-completing poll ${pollId}: 100% participation (${currentVotes}/${expectedParticipants})`);
        return true;
      }

      // ✅ Условие 2: Время истекло - обрабатывается автоматически таймером

      return false;
    } catch (error) {
      logger.error('Error checking auto-complete:', error);
      return false;
    }
  }

}