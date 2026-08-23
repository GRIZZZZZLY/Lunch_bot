/**
 * Чтение голосований.
 *
 * Вынесено из `poll.service.ts` (1770 строк): чтения не меняют состояние, не
 * участвуют в транзакциях и нужны почти каждому вызывающему — контроллеру, боту,
 * планировщику. Держать их в одном классе с завершением голосования означало,
 * что любой, кому нужен один `getPollById`, тянет за собой весь файл вместе с
 * транзакциями, уведомлениями и подсчётом победителей.
 *
 * Здесь же живёт кэш активных голосований: ключ и TTL — свойство чтения, а не
 * записи. Сброс делает `CacheInvalidator` из тех методов, которые состояние
 * меняют.
 */
import { Poll, Prisma } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollWithDetails, votePublicUserSelect } from '../types/poll.types';
import { cacheService, CACHE_KEYS, CACHE_TTL } from './cache.service';
import { calculatePollEndTime, getStartOfToday, now } from '../utils/date';

/** Голосование с группой, голосами и итогами — форма для экранов приложения. */
const pollWithDetailsInclude = {
  group: true,
  votes: {
    include: {
      user: { select: votePublicUserSelect },
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
    select: { votes: true },
  },
} satisfies Prisma.PollInclude;

/** Фильтр по группе: одна, список или все. */
function groupFilter(groupId?: number | number[]): Prisma.PollWhereInput {
  if (Array.isArray(groupId)) return { groupId: { in: groupId } };

  return groupId ? { groupId } : {};
}

export class PollQueryService {
  /**
   * Голосование по id со всеми деталями.
   */
  static async getPollById(id: number): Promise<PollWithDetails | null> {
    try {
      return await prisma.poll.findUnique({
        where: { id },
        include: pollWithDetailsInclude,
      });
    } catch (error) {
      logger.error('Error getting poll by ID:', error);
      throw new Error('Failed to get poll');
    }
  }

  /**
   * Группа голосования — то, по чему проверяются права.
   *
   * Отдельный запрос из одного поля, а не `getPollById`: проверка доступа
   * вызывается на каждый запрос к голосованию, и тянуть ради неё голоса с
   * пользователями и блюдами незачем.
   */
  static async getPollGroupId(id: number): Promise<number | null> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id },
        select: { groupId: true },
      });

      return poll?.groupId ?? null;
    } catch (error) {
      logger.error('Error getting poll group ID:', error);
      throw new Error('Failed to get poll');
    }
  }

  /**
   * Последнее завершённое сегодня голосование, а если сегодня не было — вообще
   * последнее завершённое.
   *
   * Второй запрос — не «на всякий случай»: экран «что было на обед» не должен
   * быть пустым с утра, до первого голосования дня.
   */
  static async getTodayCompletedPoll(
    groupId: number
  ): Promise<PollWithDetails | null> {
    try {
      const completedToday = await prisma.poll.findFirst({
        where: {
          groupId,
          status: 'COMPLETED',
          endedAt: { gte: getStartOfToday() },
        },
        orderBy: { endedAt: 'desc' },
        include: pollWithDetailsInclude,
      });

      if (completedToday) return completedToday;

      return await prisma.poll.findFirst({
        where: { groupId, status: 'COMPLETED' },
        orderBy: { endedAt: 'desc' },
        include: pollWithDetailsInclude,
      });
    } catch (error) {
      logger.error('Error getting today completed poll:', error);
      throw new Error('Failed to get today completed poll');
    }
  }

  /**
   * Активное голосование группы (через кэш).
   */
  static async getActivePollInGroup(groupId: number): Promise<Poll | null> {
    try {
      return await cacheService.getOrSet(
        CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId),
        async () =>
          prisma.poll.findFirst({
            where: { groupId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
          }),
        CACHE_TTL.ACTIVE_POLLS
      );
    } catch (error) {
      logger.error('Error getting active poll in group:', error);
      throw new Error('Failed to get active poll');
    }
  }

  /**
   * Активные голосования (через кэш, TTL 30 с).
   *
   * Сброс идёт через `CacheInvalidator.invalidatePoll()` / `.invalidateVote()`.
   * На пиковой нагрузке кэш полностью убирает повторные тяжёлые `findMany` с
   * голосами, пользователями и блюдами.
   */
  static async getActivePolls(groupIds?: number[]) {
    try {
      if (groupIds && groupIds.length === 0) {
        return [];
      }

      return await cacheService.getOrSet(
        this.activePollsCacheKey(groupIds),
        () => this.fetchActivePollsRaw(groupIds),
        CACHE_TTL.ACTIVE_POLLS
      );
    } catch (error) {
      logger.error('Error getting active polls:', error);
      throw error;
    }
  }

  /**
   * Ключ кэша активных голосований.
   *
   * Для нескольких групп ключ собирается из ОТСОРТИРОВАННОГО списка: иначе
   * `[5,7]` и `[7,5]` — два разных ключа с одинаковым содержимым, то есть
   * промах кэша на каждый второй запрос.
   */
  private static activePollsCacheKey(groupIds?: number[]): string {
    if (groupIds === undefined) return CACHE_KEYS.ACTIVE_POLLS;
    if (groupIds.length === 1) {
      return CACHE_KEYS.ACTIVE_POLLS_GROUP(groupIds[0]);
    }

    const stable = [...groupIds].sort((a, b) => a - b).join('_');
    return `${CACHE_KEYS.ACTIVE_POLLS}_${stable}`;
  }

  /**
   * Активные голосования из БД, без истёкших по таймеру.
   *
   * Истёкшие отфильтрованы БЕЗ побочных эффектов: закрывает их планировщик
   * (`cancelExpiredPolls`), а не чтение — иначе один GET менял бы состояние.
   */
  private static async fetchActivePollsRaw(groupIds?: number[]) {
    const polls = await prisma.poll.findMany({
      where: {
        status: 'ACTIVE',
        ...(groupIds ? { groupId: { in: groupIds } } : {}),
      },
      include: {
        group: {
          select: { id: true, title: true, telegramId: true },
        },
        votes: {
          select: {
            id: true,
            pollId: true,
            userId: true,
            menuItemId: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
            menuItem: {
              select: { id: true, name: true, description: true, price: true },
            },
          },
        },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const nowDate = now();
    const active = polls.filter(poll => {
      const endsAt =
        poll.endedAt || calculatePollEndTime(poll.startedAt, poll.duration);
      return endsAt > nowDate;
    });

    if (active.length !== polls.length) {
      logger.debug(
        `Active polls: ${polls.length - active.length} of ${polls.length} excluded as expired`
      );
    }

    /* chatId — BigInt: JSON.stringify на нём падает, поэтому строка. */
    return active.map(poll => ({
      ...poll,
      chatId: poll.chatId ? poll.chatId.toString() : null,
    }));
  }

  /**
   * История завершённых голосований, страницами.
   *
   * Голоса с участниками и блюдами включены намеренно: из них экран статистики
   * считает лидерборд и «профиль обеда», иначе это N+1 запросов с фронта.
   */
  static async getPollHistory(
    groupId?: number | number[],
    limit: number = 20,
    offset: number = 0
  ) {
    try {
      if (Array.isArray(groupId) && groupId.length === 0) {
        return { polls: [], total: 0 };
      }

      const where: Prisma.PollWhereInput = {
        status: 'COMPLETED',
        ...groupFilter(groupId),
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
              select: { id: true, title: true, telegramId: true },
            },
            result: {
              select: {
                id: true,
                totalVotes: true,
                createdAt: true,
                winnerMenuItem: {
                  select: { id: true, name: true, price: true, imageUrl: true },
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
            votes: {
              select: {
                id: true,
                userId: true,
                menuItemId: true,
                createdAt: true,
                user: {
                  select: { id: true, firstName: true, username: true },
                },
                menuItem: {
                  select: { id: true, name: true },
                },
              },
            },
            _count: { select: { votes: true } },
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
   * Последнее завершённое голосование — для «повторить вчерашнее».
   */
  static async getLastCompletedPoll(
    groupId?: number | number[]
  ): Promise<Poll | null> {
    try {
      if (Array.isArray(groupId) && groupId.length === 0) {
        return null;
      }

      return await prisma.poll.findFirst({
        where: { status: 'COMPLETED', ...groupFilter(groupId) },
        orderBy: { endedAt: 'desc' },
        include: { group: true },
      });
    } catch (error) {
      logger.error('Error getting last completed poll:', error);
      throw error;
    }
  }
}

/**
 * Формы ответов чтения.
 *
 * Объявлены через `Awaited<ReturnType<…>>`, а не как `any[]` (так было до
 * разрезания): состав полей задаёт сам запрос, и дублировать его руками — верный
 * способ разойтись с ним при первой правке `select`.
 */
export type ActivePollSummary = Awaited<
  ReturnType<typeof PollQueryService.getActivePolls>
>[number];

export type PollHistoryEntry = Awaited<
  ReturnType<typeof PollQueryService.getPollHistory>
>['polls'][number];
