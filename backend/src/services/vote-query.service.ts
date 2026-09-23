/**
 * Чтение голосов: списки, подсчёты, статистика.
 *
 * Вынесено из VoteService (план закрытия, T6), где в одном классе на 1400
 * строк жили чтение, правила, изменяющие операции и начисление XP. Методы
 * перенесены без изменений; VoteService отдаёт их под прежними именами.
 */
import { Vote, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { VoteWithDetails, votePublicUserSelect } from '../types/poll.types';
import { VoteType, VoteTypeStats } from '../types/vote.types';
import { menuItemIdsFromVoteGroups } from '../utils/vote-menu-items';

export class VoteQueryService {
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
   * Получение детальной разбивки голосов по блюдам (ОПТИМИЗИРОВАНО с groupBy)
   */
  static async getVoteBreakdown(pollId: number): Promise<
    Array<{
      menuItemId: number;
      menuItemName: string;
      votes: number;
      percentage: number;
      voters: Array<{ id: number; firstName: string; username?: string }>;
    }>
  > {
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

      const totalVotes = voteGroups.reduce(
        (sum, g) => sum + g._count.menuItemId,
        0
      );

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
      const votersByMenuItem = new Map<
        number,
        Array<{
          id: number;
          firstName: string;
          username?: string;
        }>
      >();

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
            percentage:
              totalVotes > 0
                ? Math.round((group._count.menuItemId / totalVotes) * 100)
                : 0,
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
   * Получение всех голосов в голосовании
   */
  static async getPollVotes(pollId: number): Promise<VoteWithDetails[]> {
    try {
      return await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: { select: votePublicUserSelect },
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
  static async getVoteCountByMenuItem(pollId: number): Promise<
    {
      menuItemId: number;
      menuItemName: string;
      votes: number;
    }[]
  > {
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
          count: 0,
        };
        voteCount.set(vote.menuItemId, {
          name: existing.name,
          count: existing.count + 1,
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
  static async getPollVoters(pollId: number): Promise<
    {
      id: number;
      telegramId: bigint;
      firstName: string;
      lastName?: string;
      username?: string;
      votedFor: string;
      votedAt: Date;
    }[]
  > {
    try {
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: { select: votePublicUserSelect },
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
      const [totalVotes, distinctPollVotes, favoriteMenuItemGroups, lastVote] =
        await Promise.all([
          prisma.vote.count({ where: { userId } }),
          prisma.vote.findMany({
            where: { userId },
            select: { pollId: true },
            distinct: ['pollId'],
          }),
          prisma.vote.groupBy({
            by: ['menuItemId'],
            where: {
              userId,
              menuItemId: { not: null },
            },
            _count: { menuItemId: true },
            orderBy: {
              _count: {
                menuItemId: 'desc',
              },
            },
            take: 5,
          }),
          prisma.vote.findFirst({
            where: { userId },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

      const pollsParticipated = distinctPollVotes.length;

      const favoriteMenuItemIds = menuItemIdsFromVoteGroups(
        favoriteMenuItemGroups
      );

      const favoriteMenuItemsData = await prisma.menuItem.findMany({
        where: { id: { in: favoriteMenuItemIds } },
        select: {
          id: true,
          name: true,
        },
      });

      const menuItemNames = new Map(
        favoriteMenuItemsData.map(item => [item.id, item.name])
      );

      const favoriteMenuItems = favoriteMenuItemGroups
        .filter(
          (group): group is typeof group & { menuItemId: number } =>
            group.menuItemId !== null
        )
        .map(group => ({
          name:
            menuItemNames.get(group.menuItemId) ||
            `Menu Item #${group.menuItemId}`,
          votes: group._count?.menuItemId || 0,
        }));

      const lastVoteDate = lastVote?.createdAt;

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
            user: { select: votePublicUserSelect },
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
   * Получение топ блюд по количеству голосов за период
   */
  static async getTopMenuItemsByVotes(
    days: number = 30,
    limit: number = 10,
    groupId?: number
  ): Promise<
    {
      menuItemId: number;
      menuItemName: string;
      totalVotes: number;
      uniqueVoters: number;
    }[]
  > {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const whereClause: Prisma.VoteWhereInput = {
        createdAt: {
          gte: dateFrom,
        },
        menuItemId: { not: null },
        ...(groupId && {
          poll: {
            groupId,
          },
        }),
      };

      const [voteGroups, uniqueVoterGroups] = await Promise.all([
        prisma.vote.groupBy({
          by: ['menuItemId'],
          where: whereClause,
          _count: { menuItemId: true },
          orderBy: {
            _count: {
              menuItemId: 'desc',
            },
          },
          take: limit,
        }),
        prisma.vote.groupBy({
          by: ['menuItemId', 'userId'],
          where: whereClause,
        }),
      ]);

      const menuItemIds = menuItemIdsFromVoteGroups(voteGroups);

      const menuItems = await prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const menuItemNames = new Map(
        menuItems.map(item => [item.id, item.name])
      );
      const uniqueVotersByMenuItem = new Map<number, number>();

      uniqueVoterGroups.forEach(group => {
        if (group.menuItemId === null) {
          return;
        }
        uniqueVotersByMenuItem.set(
          group.menuItemId,
          (uniqueVotersByMenuItem.get(group.menuItemId) || 0) + 1
        );
      });

      return voteGroups
        .filter(
          (group): group is typeof group & { menuItemId: number } =>
            group.menuItemId !== null
        )
        .map(group => ({
          menuItemId: group.menuItemId,
          menuItemName:
            menuItemNames.get(group.menuItemId) ||
            `Menu Item #${group.menuItemId}`,
          totalVotes: group._count?.menuItemId || 0,
          uniqueVoters: uniqueVotersByMenuItem.get(group.menuItemId) || 0,
        }));
    } catch (error) {
      logger.error('Error getting top menu items by votes:', error);
      throw new Error('Failed to get top menu items by votes');
    }
  }

  /**
   * Получение списка проголосовавших пользователей
   * (используется в RouletteService)
   */
  static async getVoters(pollId: number): Promise<
    Array<{
      userId: number;
      userName: string;
      menuItemName: string;
    }>
  > {
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
          userName:
            vote.user.firstName +
            (vote.user.lastName ? ` ${vote.user.lastName}` : ''),
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
      const [topGroup] = await prisma.vote.groupBy({
        by: ['menuItemId'],
        where: { pollId },
        _count: {
          menuItemId: true,
        },
        orderBy: {
          _count: {
            menuItemId: 'desc',
          },
        },
        take: 1,
      });

      if (!topGroup || topGroup.menuItemId === null) {
        return null;
      }

      const menuItem = await prisma.menuItem.findUnique({
        where: { id: topGroup.menuItemId },
        select: { name: true },
      });

      return {
        menuItemId: topGroup.menuItemId,
        menuItemName: menuItem?.name || `Menu Item #${topGroup.menuItemId}`,
        votes: topGroup._count.menuItemId,
      };
    } catch (error) {
      logger.error('Error getting most popular menu item:', error);
      return null;
    }
  }
}
