import { Vote, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateVoteData, VoteWithDetails } from '../types/poll.types';
import { VoteType, CreateVoteWithTypeData, VoteTypeStats } from '../types/vote.types';
import { GamificationService } from './gamification.service';
import { getXPReward, isMultiplierAvailable, calculateXPWithMultiplier, XP_MULTIPLIERS } from '../constants/xp-constants';

export class VoteService {
  /**
   * Создание нового голоса (поддерживает множественный выбор)
   */
  static async createVote(data: CreateVoteData): Promise<Vote> {
    try {
      // Проверяем, не голосовал ли уже за это блюдо
      const existingVote = await prisma.vote.findFirst({
        where: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
        },
      });

      if (existingVote) {
        logger.info(`User ${data.userId} already voted for item ${data.menuItemId} in poll ${data.pollId}`);
        return existingVote;
      }

      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
          voteType: VoteType.MENU_ITEM,
        },
      });
      logger.info(`Vote created: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`);

      // Sprint 6: XP интеграция за голосование
      try {
        const reward = getXPReward('VOTE');
        let xpAmount = reward.amount;

        // Проверяем множители
        const context = {
          isFirstVoteOfDay: await this.isFirstVoteOfDay(data.userId),
          isUnanimous: await this.isUnanimousVote(data.pollId),
          isCloseToDeadline: await this.isCloseToDeadline(data.pollId),
        };

        // Применяем доступные множители
        let finalXP: number = xpAmount;
        if (isMultiplierAvailable('FIRST_VOTE_OF_DAY', context)) {
          finalXP = calculateXPWithMultiplier(finalXP, 'FIRST_VOTE_OF_DAY');
          logger.info(`First vote of day bonus applied for user ${data.userId}`);
        }

        if (isMultiplierAvailable('UNANIMOUS_VOTE', context)) {
          finalXP = calculateXPWithMultiplier(finalXP, 'UNANIMOUS_VOTE');
          logger.info(`Unanimous vote bonus applied for poll ${data.pollId}`);
        }

        if (isMultiplierAvailable('CLOSE_POLL_DEADLINE', context)) {
          finalXP = calculateXPWithMultiplier(finalXP, 'CLOSE_POLL_DEADLINE');
          logger.info(`Close deadline bonus applied for poll ${data.pollId}`);
        }

        // Начисляем XP (округляем и приводим к допустимому типу)
        const roundedXP = Math.round(finalXP);
        await GamificationService.awardXP(
          data.userId,
          roundedXP as any, // Временно используем any для совместимости с типами
          reward.reason,
          reward.category,
          { pollId: data.pollId, menuItemId: data.menuItemId, baseAmount: reward.amount }
        );

        logger.info(`XP awarded: ${xpAmount} to user ${data.userId} for voting`);
      } catch (xpError) {
        logger.error('Failed to award XP for vote:', xpError);
        // Не прерываем основной процесс если XP не начислился
      }

      return vote;
    } catch (error) {
      logger.error('Error creating vote:', error);
      throw new Error('Failed to create vote');
    }
  }

  /**
   * Создание голоса с типом (MENU_ITEM, BRING_OWN, SKIP)
   */
  static async createVoteWithType(data: CreateVoteWithTypeData): Promise<Vote> {
    try {
      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          voteType: data.voteType,
          menuItemId: data.menuItemId,
          customOption: data.customOption,
        },
      });
      logger.info(`Vote created with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`);
      return vote;
    } catch (error) {
      logger.error('Error creating vote with type:', error);
      throw new Error('Failed to create vote with type');
    }
  }

  /**
   * Создание нескольких голосов за раз (множественный выбор)
   * Используется для голосования за несколько блюд одновременно
   */
  static async createMultipleVotes(pollId: number, userId: number, menuItemIds: number[]): Promise<Vote[]> {
    try {
      // Валидация входных данных
      if (!pollId || !userId || !menuItemIds || menuItemIds.length === 0) {
        throw new Error('Invalid parameters for multiple votes');
      }

      logger.info(`Creating multiple votes: user ${userId} voting for ${menuItemIds.length} items in poll ${pollId}`);

      // Проверяем, не голосовал ли уже пользователь за эти блюда
      const existingVotes = await prisma.vote.findMany({
        where: {
          pollId,
          userId,
          menuItemId: { in: menuItemIds },
        },
      });

      // Определяем, какие блюда ещё не проголосованы
      const existingItemIds = existingVotes.map(v => v.menuItemId!);
      const newMenuItemIds = menuItemIds.filter(id => !existingItemIds.includes(id));

      // Если все блюда уже проголосованы, возвращаем существующие голоса
      if (newMenuItemIds.length === 0) {
        logger.info(`User ${userId} already voted for all selected items in poll ${pollId}`);
        return existingVotes;
      }

      // Создаём новые голоса
      const newVotes = await Promise.all(
        newMenuItemIds.map(menuItemId =>
          this.createVote({
            pollId,
            userId,
            menuItemId,
          })
        )
      );

      logger.info(`Multiple votes created: user ${userId} voted for ${newVotes.length} new items in poll ${pollId}`);

      // Возвращаем все голоса (существующие + новые)
      return [...existingVotes, ...newVotes];
    } catch (error) {
      logger.error('Error creating multiple votes:', error);
      throw new Error('Failed to create multiple votes');
    }
  }

  /**
   * Получить все голоса пользователя в конкретном poll
   */
  static async getUserVotes(pollId: number, userId: number): Promise<Vote[]> {
    try {
      const votes = await prisma.vote.findMany({
        where: {
          pollId,
          userId,
          menuItemId: { not: null }, // Только голоса за блюда
        },
        include: {
          menuItem: true,
        },
      });
      return votes;
    } catch (error) {
      logger.error('Error getting user votes:', error);
      throw new Error('Failed to get user votes');
    }
  }

  /**
   * Удалить голос за конкретное блюдо
   */
  static async deleteVote(pollId: number, userId: number, menuItemId: number): Promise<void> {
    try {
      await prisma.vote.deleteMany({
        where: {
          pollId,
          userId,
          menuItemId,
        },
      });
      logger.info(`Vote deleted: user ${userId}, poll ${pollId}, item ${menuItemId}`);
    } catch (error) {
      logger.error('Error deleting vote:', error);
      throw new Error('Failed to delete vote');
    }
  }

  /**
   * Обновление существующего голоса (DEPRECATED - используйте createVote + deleteVote)
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
   * Получение детальной разбивки голосов по блюдам (ОПТИМИЗИРОВАНО с groupBy)
   */
  static async getVoteBreakdown(pollId: number): Promise<Array<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
    percentage: number;
    voters: Array<{ id: number; firstName: string; username?: string }>;
  }>> {
    try {
      // ✅ Используем groupBy для агрегации в БД вместо JS
      const voteGroups = await prisma.vote.groupBy({
        by: ['menuItemId'],
        where: {
          pollId,
          menuItemId: { not: null }, // Только голоса за блюда
        },
        _count: {
          menuItemId: true,
        },
      });

      const totalVotes = voteGroups.reduce((sum, g) => sum + g._count.menuItemId, 0);

      if (voteGroups.length === 0) {
        return [];
      }

      // Получаем информацию о блюдах и голосующих параллельно
      const menuItemIds = voteGroups.map(g => g.menuItemId!);
      
      // Фильтруем ID для запроса в БД (исключаем специальные ID как -1)
      const realMenuItemIds = menuItemIds.filter(id => id > 0);
      
      const [menuItems, voters] = await Promise.all([
        realMenuItemIds.length > 0 
          ? prisma.menuItem.findMany({
              where: { id: { in: realMenuItemIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        prisma.vote.findMany({
          where: {
            pollId,
            menuItemId: { in: menuItemIds },
          },
          select: {
            menuItemId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                username: true,
              },
            },
          },
        }),
      ]);

      // Группируем голосующих по блюдам
      const votersByMenuItem = new Map<number, Array<{
        id: number;
        firstName: string;
        username?: string;
      }>>();
      
      voters.forEach(vote => {
        if (!vote.menuItemId) return;
        const list = votersByMenuItem.get(vote.menuItemId) || [];
        list.push({
          id: vote.user.id,
          firstName: vote.user.firstName,
          username: vote.user.username || undefined,
        });
        votersByMenuItem.set(vote.menuItemId, list);
      });

      // Собираем результат
      return voteGroups
        .map(group => {
          const menuItem = menuItems.find(mi => mi.id === group.menuItemId);
          const voters = votersByMenuItem.get(group.menuItemId!) || [];
          
          // Обработка специальных опций (например, "Еда с собой" с id: -1)
          let menuItemName = menuItem?.name || 'Unknown';
          if (group.menuItemId === -1) {
            menuItemName = 'Еда с собой';
          }
          
          return {
            menuItemId: group.menuItemId!,
            menuItemName,
            votes: group._count.menuItemId,
            percentage: totalVotes > 0 ? Math.round((group._count.menuItemId / totalVotes) * 100) : 0,
            voters,
          };
        })
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
        select: { id: true, status: true, endedAt: true },
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

      // Удаляем старые голоса пользователя (для обратной совместимости с одиночным голосованием)
      await prisma.vote.deleteMany({
        where: {
          pollId: data.pollId,
          userId: data.userId,
        },
      });

      // Создаем новый голос
      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          menuItemId: data.menuItemId,
          voteType: VoteType.MENU_ITEM,
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
   * Создание или обновление голоса с типом
   */
  static async upsertVoteWithType(data: CreateVoteWithTypeData): Promise<Vote> {
    try {
      // Проверяем, что голосование активно
      const poll = await prisma.poll.findUnique({
        where: { id: data.pollId },
        select: { id: true, status: true, endedAt: true },
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

      // Удаляем старые голоса пользователя (для обратной совместимости)
      await prisma.vote.deleteMany({
        where: {
          pollId: data.pollId,
          userId: data.userId,
        },
      });

      // Создаем новый голос
      const vote = await prisma.vote.create({
        data: {
          pollId: data.pollId,
          userId: data.userId,
          voteType: data.voteType,
          menuItemId: data.menuItemId,
          customOption: data.customOption,
        },
      });

      logger.info(`Vote upserted with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`);
      return vote;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Error upserting vote with type:', error);
        throw error;
      }
      logger.error('Unknown error upserting vote with type:', error);
      throw new Error('Failed to upsert vote with type');
    }
  }

  /**
   * Получение статистики по типам голосов
   */
  static async getVoteTypeStats(pollId: number): Promise<VoteTypeStats> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        select: { voteType: true },
      });

      const stats: VoteTypeStats = {
        menuItemVotes: 0,
        bringOwnVotes: 0,
        skipVotes: 0,
        total: votes.length,
      };

      votes.forEach(vote => {
        switch (vote.voteType) {
          case VoteType.MENU_ITEM:
            stats.menuItemVotes++;
            break;
          case VoteType.BRING_OWN:
            stats.bringOwnVotes++;
            break;
          case VoteType.SKIP:
            stats.skipVotes++;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting vote type stats:', error);
      throw new Error('Failed to get vote type stats');
    }
  }

  /**
   * Получение голоса пользователя в голосовании (DEPRECATED - используйте getUserVotes)
   */
  static async getUserVoteInPoll(pollId: number, userId: number): Promise<Vote | null> {
    try {
      // Возвращаем первый голос пользователя (для обратной совместимости)
      const votes = await this.getUserVotes(pollId, userId);
      return votes.length > 0 ? votes[0] : null;
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
        select: { id: true, status: true },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }
      if (poll.status !== 'ACTIVE') {
        throw new Error('Poll is not active');
      }

      // Удаляем ВСЕ голоса пользователя в этом poll
      await prisma.vote.deleteMany({
        where: {
          pollId,
          userId,
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
        // Пропускаем голоса без блюда (BRING_OWN, SKIP)
        if (!vote.menuItemId || !vote.menuItem) return;

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

      return votes
        .filter(vote => vote.menuItem) // Фильтруем голоса с блюдами
        .map(vote => ({
          id: vote.user.id,
          telegramId: vote.user.telegramId,
          firstName: vote.user.firstName,
          lastName: vote.user.lastName || undefined,
          username: vote.user.username || undefined,
          votedFor: vote.menuItem!.name,
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
      const votes = await this.getUserVotes(pollId, userId);
      return votes.length > 0;
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
        if (!vote.menuItem) return; // Пропускаем голоса без блюда
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
   * Получение голосов пользователя с пагинацией (все голоса пользователя)
   */
  static async getUserVotesHistory(
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
            user: true,
            menuItem: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.vote.count({ where: { userId } }),
      ]);

      return { votes, total };
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
        // Пропускаем голоса без блюда (BRING_OWN, SKIP)
        if (!vote.menuItemId || !vote.menuItem) return;

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

  /**
   * Получение списка проголосовавших пользователей
   * (используется в RouletteService)
   */
  static async getVoters(pollId: number): Promise<Array<{
    userId: number;
    userName: string;
    menuItemName: string;
  }>> {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          menuItem: {
            select: {
              name: true,
            },
          },
        },
      });

      return votes
        .filter(vote => vote.menuItem) // Фильтруем голоса с блюдами
        .map(vote => ({
          userId: vote.user.id,
          userName: vote.user.firstName + (vote.user.lastName ? ` ${vote.user.lastName}` : ''),
          menuItemName: vote.menuItem!.name,
        }));
    } catch (error) {
      logger.error('Error getting voters:', error);
      throw new Error('Failed to get voters');
    }
  }

  /**
   * Получение самого популярного блюда в голосовании
   * (используется в RouletteService)
   */
  static async getMostPopularMenuItem(pollId: number): Promise<{
    menuItemId: number;
    menuItemName: string;
    votes: number;
  } | null> {
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

      if (votes.length === 0) {
        return null;
      }

      // Подсчитываем голоса за каждое блюдо
      const voteCount = new Map<number, { name: string; count: number }>();
      
      votes.forEach(vote => {
        // Пропускаем голоса без блюда (BRING_OWN, SKIP)
        if (!vote.menuItemId || !vote.menuItem) return;

        const existing = voteCount.get(vote.menuItemId) || { name: vote.menuItem.name, count: 0 };
        existing.count++;
        voteCount.set(vote.menuItemId, existing);
      });

      // Находим блюдо с максимальным количеством голосов
      let maxVotes = 0;
      let mostPopular: { menuItemId: number; menuItemName: string; votes: number } | null = null;

      voteCount.forEach((data, menuItemId) => {
        if (data.count > maxVotes) {
          maxVotes = data.count;
          mostPopular = {
            menuItemId,
            menuItemName: data.name,
            votes: data.count,
          };
        }
      });

      return mostPopular;
    } catch (error) {
      logger.error('Error getting most popular menu item:', error);
      return null;
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
