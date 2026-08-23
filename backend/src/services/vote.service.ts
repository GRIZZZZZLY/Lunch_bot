import { Vote, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import {
  CreateVoteData,
  VoteWithDetails,
  votePublicUserSelect,
} from '../types/poll.types';
import {
  VoteType,
  CreateVoteWithTypeData,
  VoteTypeStats,
} from '../types/vote.types';
import { GamificationService } from './gamification.service';
import {
  getXPReward,
  isMultiplierAvailable,
  calculateXPWithMultiplier,
  XP_MULTIPLIERS,
} from '../constants/xp-constants';
import { eventBus } from './event-bus.service';
import { menuItemIdsFromVoteGroups } from '../utils/vote-menu-items';
import { VoteNotFoundError, VotingError } from './vote.errors';

export class VoteService {
  private static async assertMenuItemsAllowedForPoll(
    tx: Prisma.TransactionClient,
    pollId: number,
    userId: number,
    menuItemIds: number[]
  ): Promise<void> {
    const uniqueIds = [...new Set(menuItemIds)];
    const poll = await tx.poll.findUnique({
      where: { id: pollId },
      select: {
        status: true,
        endedAt: true,
        groupId: true,
        selectedMenuItemIds: true,
      },
    });

    if (!poll) {
      throw new VotingError('Poll not found');
    }
    if (poll.status !== 'ACTIVE') {
      throw new VotingError('Poll is not active');
    }
    if (poll.endedAt && poll.endedAt < new Date()) {
      throw new VotingError('Poll has expired');
    }

    const [membership, participant] = await Promise.all([
      tx.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: poll.groupId,
            userId,
          },
        },
        select: { isActive: true },
      }),
      tx.pollParticipant.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId,
          },
        },
        select: { status: true },
      }),
    ]);

    if (!membership?.isActive || participant?.status !== 'EXPECTED') {
      throw new VotingError('User is not eligible to vote in this poll');
    }

    let selectedIds: number[] | null = null;
    if (poll.selectedMenuItemIds) {
      try {
        const parsed = JSON.parse(poll.selectedMenuItemIds);
        if (!Array.isArray(parsed)) {
          throw new VotingError('Poll menu configuration is invalid');
        }
        selectedIds = parsed.filter(
          (id): id is number => Number.isInteger(id) && id > 0
        );
      } catch {
        throw new VotingError('Poll menu configuration is invalid');
      }
    }

    if (
      selectedIds &&
      uniqueIds.some(menuItemId => !selectedIds.includes(menuItemId))
    ) {
      throw new VotingError('Menu item is not available for this poll');
    }

    const matchingItems = await tx.menuItem.count({
      where: {
        id: { in: uniqueIds },
        groupId: poll.groupId,
        isActive: true,
      },
    });

    if (matchingItems !== uniqueIds.length) {
      throw new VotingError('Menu item is not available for this poll');
    }
  }

  /**
   * Создание нового голоса (поддерживает множественный выбор)
   */
  static async createVote(data: CreateVoteData): Promise<Vote> {
    try {
      const { vote, created } = await prisma.$transaction(async tx => {
        await this.assertMenuItemsAllowedForPoll(tx, data.pollId, data.userId, [
          data.menuItemId,
        ]);
        const existingVote = await tx.vote.findFirst({
          where: {
            pollId: data.pollId,
            userId: data.userId,
            menuItemId: data.menuItemId,
          },
        });
        if (existingVote) {
          return { vote: existingVote, created: false };
        }

        const createdVote = await tx.vote.create({
          data: {
            pollId: data.pollId,
            userId: data.userId,
            menuItemId: data.menuItemId,
            voteType: VoteType.MENU_ITEM,
          },
        });
        return { vote: createdVote, created: true };
      });

      if (created) {
        await this.awardVoteXp(data.userId, data.pollId, data.menuItemId);

        eventBus.emit('poll_updated', {
          pollId: data.pollId,
          type: 'vote_added',
          userId: data.userId,
          timestamp: new Date().toISOString(),
        });
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
      const vote = await prisma.$transaction(async tx => {
        await this.assertMenuItemsAllowedForPoll(
          tx,
          data.pollId,
          data.userId,
          data.menuItemId ? [data.menuItemId] : []
        );
        return tx.vote.create({
          data: {
            pollId: data.pollId,
            userId: data.userId,
            voteType: data.voteType,
            menuItemId: data.menuItemId,
            customOption: data.customOption,
          },
        });
      });
      logger.info(
        `Vote created with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`
      );
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
  static async createMultipleVotes(
    pollId: number,
    userId: number,
    menuItemIds: number[]
  ): Promise<Vote[]> {
    try {
      if (!pollId || !userId || !menuItemIds || menuItemIds.length === 0) {
        throw new VotingError('Invalid parameters for multiple votes');
      }

      const uniqueMenuItemIds = [...new Set(menuItemIds)];

      logger.info(
        `Creating multiple votes: user ${userId} voting for ${uniqueMenuItemIds.length} items in poll ${pollId}`
      );

      // Атомарная операция: проверка существующих + вставка новых внутри транзакции.
      // Race-safe благодаря @@unique([pollId, userId, menuItemId]):
      // если параллельный запрос вставит тот же vote, БД бросит P2002 и транзакция откатится.
      // SQLite не поддерживает skipDuplicates в Prisma — полагаемся на фильтр + DB constraint.
      const { allVotes, newlyCreatedItemIds } = await prisma.$transaction(
        async tx => {
          await this.assertMenuItemsAllowedForPoll(
            tx,
            pollId,
            userId,
            uniqueMenuItemIds
          );

          const existingVotes = await tx.vote.findMany({
            where: {
              pollId,
              userId,
              menuItemId: { in: uniqueMenuItemIds },
            },
          });

          const existingItemIds = new Set(
            menuItemIdsFromVoteGroups(existingVotes)
          );

          const newMenuItemIds = uniqueMenuItemIds.filter(
            id => !existingItemIds.has(id)
          );

          if (newMenuItemIds.length > 0) {
            await tx.vote.createMany({
              data: newMenuItemIds.map(menuItemId => ({
                pollId,
                userId,
                menuItemId,
                voteType: VoteType.MENU_ITEM,
              })),
            });
          }

          const finalVotes = await tx.vote.findMany({
            where: {
              pollId,
              userId,
              menuItemId: { in: uniqueMenuItemIds },
            },
            orderBy: { createdAt: 'asc' },
          });

          const createdIds = finalVotes
            .filter(
              v => v.menuItemId !== null && !existingItemIds.has(v.menuItemId)
            )
            .map(v => v.menuItemId as number);

          return { allVotes: finalVotes, newlyCreatedItemIds: createdIds };
        }
      );

      // XP и события — вне транзакции, чтобы их сбои не откатывали голоса.
      if (newlyCreatedItemIds.length > 0) {
        await Promise.all(
          newlyCreatedItemIds.map(menuItemId =>
            this.awardVoteXp(userId, pollId, menuItemId)
          )
        );

        logger.info(
          `Multiple votes created: user ${userId} voted for ${newlyCreatedItemIds.length} new items in poll ${pollId}`
        );

        eventBus.emit('poll_updated', {
          pollId,
          type: 'vote_added',
          userId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info(
          `User ${userId} already voted for all selected items in poll ${pollId}`
        );
      }

      return allVotes;
    } catch (error) {
      logger.error('Error creating multiple votes:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create multiple votes');
    }
  }

  private static async awardVoteXp(
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
   * P1-4: Атомарная замена набора голосов пользователя в poll.
   *
   * Принимает целевой набор menuItemIds и одной транзакцией:
   *   1) Удаляет голоса за блюда, которых нет в новом наборе.
   *   2) Создаёт голоса за новые блюда (если их ещё нет).
   *   3) Возвращает финальный набор + список новосозданных id (для XP).
   *
   * Заменяет N+1 паттерн в vote.controller (toRemove.forEach(await delete) +
   * toAdd.forEach(await create)) на один round-trip к БД, race-safe.
   */
  static async replaceUserVotes(
    pollId: number,
    userId: number,
    menuItemIds: number[]
  ): Promise<{ votes: Vote[]; newlyCreatedItemIds: number[] }> {
    const uniqueMenuItemIds = [...new Set(menuItemIds)];

    const { allVotes, newlyCreatedItemIds } = await prisma.$transaction(
      async tx => {
        await this.assertMenuItemsAllowedForPoll(
          tx,
          pollId,
          userId,
          uniqueMenuItemIds
        );

        const existingVotes = await tx.vote.findMany({
          where: { pollId, userId, menuItemId: { not: null } },
          select: { menuItemId: true },
        });

        const existingIds = new Set(
          existingVotes
            .map(v => v.menuItemId)
            .filter((id): id is number => id !== null)
        );

        const targetSet = new Set(uniqueMenuItemIds);

        const toRemove = [...existingIds].filter(id => !targetSet.has(id));
        const toAdd = uniqueMenuItemIds.filter(id => !existingIds.has(id));

        if (toRemove.length > 0) {
          await tx.vote.deleteMany({
            where: { pollId, userId, menuItemId: { in: toRemove } },
          });
        }

        if (toAdd.length > 0) {
          await tx.vote.createMany({
            data: toAdd.map(menuItemId => ({
              pollId,
              userId,
              menuItemId,
              voteType: VoteType.MENU_ITEM,
            })),
          });
        }

        const finalVotes = await tx.vote.findMany({
          where: { pollId, userId, menuItemId: { not: null } },
          orderBy: { createdAt: 'asc' },
        });

        return { allVotes: finalVotes, newlyCreatedItemIds: toAdd };
      }
    );

    // XP и события — вне транзакции (их падение не должно откатить голоса).
    if (newlyCreatedItemIds.length > 0) {
      await Promise.all(
        newlyCreatedItemIds.map(menuItemId =>
          this.awardVoteXp(userId, pollId, menuItemId)
        )
      );
      eventBus.emit('poll_updated', {
        pollId,
        type: 'vote_added',
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(
      `replaceUserVotes: poll ${pollId} user ${userId} → ${allVotes.length} votes (new: ${newlyCreatedItemIds.length})`
    );

    return { votes: allVotes, newlyCreatedItemIds };
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
  static async deleteVote(
    pollId: number,
    userId: number,
    menuItemId: number
  ): Promise<void> {
    try {
      await prisma.vote.deleteMany({
        where: {
          pollId,
          userId,
          menuItemId,
        },
      });
      logger.info(
        `Vote deleted: user ${userId}, poll ${pollId}, item ${menuItemId}`
      );
    } catch (error) {
      logger.error('Error deleting vote:', error);
      throw new Error('Failed to delete vote');
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
   * Создание или обновление голоса
   */
  static async upsertVote(data: CreateVoteData): Promise<Vote> {
    try {
      const vote = await prisma.$transaction(async tx => {
        await this.assertMenuItemsAllowedForPoll(tx, data.pollId, data.userId, [
          data.menuItemId,
        ]);

        await tx.vote.deleteMany({
          where: {
            pollId: data.pollId,
            userId: data.userId,
          },
        });

        return tx.vote.create({
          data: {
            pollId: data.pollId,
            userId: data.userId,
            menuItemId: data.menuItemId,
            voteType: VoteType.MENU_ITEM,
          },
        });
      });

      logger.info(
        `Vote upserted: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`
      );

      eventBus.emit('poll_updated', {
        pollId: data.pollId,
        type: 'vote_changed',
        userId: data.userId,
        timestamp: new Date().toISOString(),
      });

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
      const vote = await prisma.$transaction(async tx => {
        await this.assertMenuItemsAllowedForPoll(
          tx,
          data.pollId,
          data.userId,
          data.menuItemId ? [data.menuItemId] : []
        );

        await tx.vote.deleteMany({
          where: {
            pollId: data.pollId,
            userId: data.userId,
          },
        });

        return tx.vote.create({
          data: {
            pollId: data.pollId,
            userId: data.userId,
            voteType: data.voteType,
            menuItemId: data.menuItemId,
            customOption: data.customOption,
          },
        });
      });

      logger.info(
        `Vote upserted with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`
      );

      eventBus.emit('poll_updated', {
        pollId: data.pollId,
        type: 'vote_changed',
        userId: data.userId,
        timestamp: new Date().toISOString(),
      });

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
        throw new VotingError('Poll not found');
      }
      if (poll.status !== 'ACTIVE') {
        throw new VotingError('Poll is not active');
      }

      // Удаляем ВСЕ голоса пользователя в этом poll
      await prisma.vote.deleteMany({
        where: {
          pollId,
          userId,
        },
      });

      logger.info(`Vote removed: user ${userId} from poll ${pollId}`);

      eventBus.emit('poll_updated', {
        pollId,
        type: 'vote_removed',
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new VoteNotFoundError();
        }
      }
      /* Доменный отказ пробрасывается как есть. Раньше он попадал в общий
         `throw new Error('Failed to remove vote')` ниже, то есть ветка 400 в
         контроллере была недостижима: «голосование уже закрыто» доезжало до
         клиента как 500. */
      if (error instanceof VotingError || error instanceof VoteNotFoundError) {
        throw error;
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

      logger.info(
        `Removed ${result.count} expired votes from ${pollIds.length} polls`
      );
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
