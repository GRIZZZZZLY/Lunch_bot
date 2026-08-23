/**
 * Статистика голосований.
 *
 * Третья часть, вынесенная из `poll.service.ts` (задача 06). Признак, по
 * которому она отделена от чтений: здесь не «отдать запись», а посчитать —
 * агрегаты по группе, участие человека, разбивка голосов по блюдам. У этих
 * методов свои запросы (`count`, `groupBy`), своя цена и свой единственный
 * потребитель — экраны статистики.
 */
import { Prisma } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollStats, votePublicUserSelect } from '../types/poll.types';
import { toISOString } from '../utils/date';
import { menuItemIdsFromVoteGroups } from '../utils/vote-menu-items';
import { PollNotFoundError } from './poll.errors';

export interface UserParticipationStats {
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
}

export interface VoteBreakdownEntry {
  menuItemId: number;
  menuItemName: string;
  votes: number;
  percentage: number;
  voters: { id: number; firstName: string; username?: string }[];
}

const EMPTY_STATS: PollStats = {
  totalPolls: 0,
  activePolls: 0,
  completedPolls: 0,
  totalVotes: 0,
  averageParticipants: 0,
};

/** Фильтр по группе: одна, список или все. */
function groupFilter(groupId?: number | number[]): Prisma.PollWhereInput {
  if (Array.isArray(groupId)) return { groupId: { in: groupId } };

  return groupId ? { groupId } : {};
}

export class PollStatsService {
  /**
   * Сводка по голосованиям: сколько всего, сколько идёт, сколько завершено.
   *
   * Пустой список групп — это «человек не состоит ни в одной группе», и ответ
   * на него нули, а не выборка по всем группам. Раньше пустой массив
   * превращался в фильтр `{}`, то есть в статистику всего продукта.
   */
  static async getPollStats(groupId?: number | number[]): Promise<PollStats> {
    try {
      if (Array.isArray(groupId) && groupId.length === 0) {
        return { ...EMPTY_STATS };
      }

      const where: Prisma.PollWhereInput = groupFilter(groupId);
      const voteWhere = Array.isArray(groupId)
        ? { poll: { groupId: { in: groupId } } }
        : groupId
          ? { poll: { groupId } }
          : undefined;

      const [totalPolls, activePolls, completedPolls, totalVotes] =
        await Promise.all([
          prisma.poll.count({ where }),
          prisma.poll.count({ where: { ...where, status: 'ACTIVE' } }),
          prisma.poll.count({ where: { ...where, status: 'COMPLETED' } }),
          prisma.vote.count({ where: voteWhere }),
        ]);

      return {
        totalPolls,
        activePolls,
        completedPolls,
        totalVotes,
        averageParticipants: await this.averageParticipants(
          where,
          completedPolls
        ),
      };
    } catch (error) {
      logger.error('Error getting poll stats:', error);
      throw new Error('Failed to get poll stats');
    }
  }

  /** Среднее число проголосовавших на завершённое голосование, до сотых. */
  private static async averageParticipants(
    where: Prisma.PollWhereInput,
    completedPolls: number
  ): Promise<number> {
    if (completedPolls === 0) return 0;

    const polls = await prisma.poll.findMany({
      where: { ...where, status: 'COMPLETED' },
      include: { _count: { select: { votes: true } } },
    });

    const votes = polls.reduce((sum, poll) => sum + poll._count.votes, 0);
    return Math.round((votes / completedPolls) * 100) / 100;
  }

  /**
   * Участие человека: сколько голосовал, любимые блюда, последняя активность.
   *
   * `participationRate` считается от ВСЕХ завершённых голосований продукта, а не
   * от голосований его групп. Это заметный перекос для человека в одной группе
   * из нескольких, и он остался таким при переносе намеренно: его исправление
   * меняет цифру в профиле, то есть продуктовое решение, а не рефакторинг.
   */
  static async getUserParticipationStats(
    userId: number
  ): Promise<UserParticipationStats> {
    try {
      const [totalVotes, totalPolls] = await Promise.all([
        prisma.vote.count({ where: { userId } }),
        prisma.poll.count({ where: { status: 'COMPLETED' } }),
      ]);

      return {
        totalVotes,
        totalPolls,
        participationRate:
          totalPolls > 0 ? Math.round((totalVotes / totalPolls) * 100) : 0,
        favoriteItems: await this.favoriteItems(userId, totalVotes),
        recentActivity: await this.recentActivity(userId),
      };
    } catch (error) {
      logger.error('Error getting user participation stats:', error);
      throw new Error('Failed to get user participation stats');
    }
  }

  /** Пять блюд, за которые человек голосовал чаще всего. */
  private static async favoriteItems(
    userId: number,
    totalVotes: number
  ): Promise<UserParticipationStats['favoriteItems']> {
    const votesByItem = await prisma.vote.groupBy({
      by: ['menuItemId'],
      where: { userId, menuItemId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIdsFromVoteGroups(votesByItem) } },
    });

    return votesByItem.map(vote => ({
      itemId: vote.menuItemId!,
      /* Блюдо могли удалить из меню — голос остаётся, название теряется. */
      itemName: menuItems.find(item => item.id === vote.menuItemId)?.name ?? 'Unknown',
      voteCount: vote._count.id,
      percentage:
        totalVotes > 0 ? Math.round((vote._count.id / totalVotes) * 100) : 0,
    }));
  }

  /** Последние десять голосов человека. */
  private static async recentActivity(
    userId: number
  ): Promise<UserParticipationStats['recentActivity']> {
    const recentVotes = await prisma.vote.findMany({
      where: { userId },
      include: {
        poll: { select: { id: true } },
        menuItem: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return recentVotes.map(vote => ({
      pollId: vote.pollId,
      pollTitle: 'Голосование на обед',
      votedAt: toISOString(vote.createdAt),
      itemName: vote.menuItem?.name ?? 'Unknown',
    }));
  }

  /**
   * Разбивка голосов по блюдам: кто за что голосовал и в каких долях.
   *
   * Голоса без блюда («принесу своё», «пропускаю», удалённое блюдо) в разбивку
   * не попадают, но в знаменатель процентов входят: доля считается от всех
   * голосов голосования, иначе сумма процентов давала бы 100% при половине
   * воздержавшихся.
   */
  static async getPollVoteBreakdown(
    pollId: number
  ): Promise<VoteBreakdownEntry[]> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          votes: {
            include: {
              user: { select: votePublicUserSelect },
              menuItem: true,
            },
          },
        },
      });

      if (!poll) {
        throw new PollNotFoundError();
      }

      const totalVotes = poll.votes.length;
      const byItem = new Map<number, Omit<VoteBreakdownEntry, 'percentage'>>();

      for (const vote of poll.votes) {
        if (!vote.menuItemId || !vote.menuItem) continue;

        const entry = byItem.get(vote.menuItemId) ?? {
          menuItemId: vote.menuItemId,
          menuItemName: vote.menuItem.name,
          votes: 0,
          voters: [],
        };

        entry.votes += 1;
        entry.voters.push({
          id: vote.user.id,
          firstName: vote.user.firstName,
          username: vote.user.username ?? undefined,
        });

        byItem.set(vote.menuItemId, entry);
      }

      return Array.from(byItem.values())
        .map(entry => ({
          ...entry,
          percentage:
            totalVotes > 0 ? Math.round((entry.votes / totalVotes) * 100) : 0,
        }))
        .sort((a, b) => b.votes - a.votes);
    } catch (error) {
      if (error instanceof PollNotFoundError) throw error;

      logger.error('Error getting poll vote breakdown:', error);
      throw new Error('Failed to get poll vote breakdown');
    }
  }
}
