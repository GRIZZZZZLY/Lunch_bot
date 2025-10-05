import { Vote, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CreateVoteData, VoteWithDetails } from '../types/poll.types';
import { VoteType, CreateVoteWithTypeData, VoteTypeStats } from '../types/vote.types';

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
          voteType: VoteType.MENU_ITEM,
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
      
      const [menuItems, voters] = await Promise.all([
        prisma.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          select: { id: true, name: true },
        }),
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
          return {
            menuItemId: group.menuItemId!,
            menuItemName: menuItem?.name || 'Unknown',
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
          voteType: VoteType.MENU_ITEM,
          updatedAt: new Date(),
        },
        create: {
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

      // Создаем или обновляем голос
      const vote = await prisma.vote.upsert({
        where: {
          pollId_userId: {
            pollId: data.pollId,
            userId: data.userId,
          },
        },
        update: {
          voteType: data.voteType,
          menuItemId: data.menuItemId,
          customOption: data.customOption,
          updatedAt: new Date(),
        },
        create: {
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
        select: { id: true, status: true },
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
      throw new Error('Failed to get most popular menu item');
    }
  }
}
