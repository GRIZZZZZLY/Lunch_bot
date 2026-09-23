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
import {
  MaxSelectionsExceededError,
  SingleSelectionOnlyError,
  VoteNotFoundError,
  VotingError,
} from './vote.errors';
import { PollNotFoundError } from './poll.errors';
import { VoteQueryService } from './vote-query.service';
import { VoteXpService } from './vote-xp.service';

export class VoteService {
  /* Чтение вынесено в VoteQueryService (план закрытия, T6). Прежние имена
     остаются, пока потребители не переведены на новый модуль осознанно. */
  static getUserVotes = VoteQueryService.getUserVotes.bind(VoteQueryService);
  static getVoteBreakdown = VoteQueryService.getVoteBreakdown.bind(VoteQueryService);
  static getVoteTypeStats = VoteQueryService.getVoteTypeStats.bind(VoteQueryService);
  static getPollVotes = VoteQueryService.getPollVotes.bind(VoteQueryService);
  static getVoteCountByMenuItem = VoteQueryService.getVoteCountByMenuItem.bind(VoteQueryService);
  static getPollVoters = VoteQueryService.getPollVoters.bind(VoteQueryService);
  static hasUserVoted = VoteQueryService.hasUserVoted.bind(VoteQueryService);
  static getUserVoteStats = VoteQueryService.getUserVoteStats.bind(VoteQueryService);
  static getUserVotesHistory = VoteQueryService.getUserVotesHistory.bind(VoteQueryService);
  static getTopMenuItemsByVotes = VoteQueryService.getTopMenuItemsByVotes.bind(VoteQueryService);
  static getVoters = VoteQueryService.getVoters.bind(VoteQueryService);
  static getMostPopularMenuItem = VoteQueryService.getMostPopularMenuItem.bind(VoteQueryService);

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
        await VoteXpService.awardVoteXp(data.userId, data.pollId, data.menuItemId);

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
   * Подать голоса с проверкой правил самого голосования.
   *
   * Правила («одиночный выбор» и «не больше N блюд») жили в контроллере: он
   * читал голосование целиком, считал предел и отвечал 400. Считать предел —
   * не работа HTTP-слоя, и доказательство тому простое: тот же предел обязан
   * действовать для любого другого вызывающего, а не только для этого
   * эндпоинта.
   *
   * Голосование читается узким select'ом: нужны два поля, а не голоса с
   * блюдами и пользователями.
   */
  static async castVotes(
    pollId: number,
    userId: number,
    menuItemIds: number[]
  ): Promise<Vote[]> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { isMultiSelect: true, maxSelections: true },
    });

    if (!poll) {
      throw new PollNotFoundError();
    }

    /* `!== false`: у старых голосований поле пустое, и они считались
       множественными. Смена этого умолчания — отдельное решение. */
    const isMultiSelect = poll.isMultiSelect !== false;
    const maxSelections = isMultiSelect
      ? Math.max(1, Math.min(poll.maxSelections || 3, 3))
      : 1;

    /* Лимит действует на ИТОГ, а не на один запрос: повторный вызов с другими
       блюдами раньше добирал голоса сверх maxSelections, а одиночный режим
       обходился по одному блюду за запрос. Уже поданные голоса за те же блюда
       добором не считаются — createMultipleVotes их и так пропустит. */
    /* Считается размер МНОЖЕСТВА, а не длина массива: `[11, 11]` в одиночном
       режиме давал ложный отказ «только один выбор», хотя ниже
       `createMultipleVotes` набор всё равно дедуплицирует. Через HTTP сюда
       приходит уже множество, но правило по контракту метода обязано работать
       для любого вызывающего — иначе оно снова живёт в HTTP-слое. */
    const requestedItemIds = [...new Set(menuItemIds)];
    const alreadyVotedOthers = await prisma.vote.count({
      where: { pollId, userId, menuItemId: { notIn: requestedItemIds } },
    });
    const resulting = alreadyVotedOthers + requestedItemIds.length;

    if (!isMultiSelect && resulting > 1) {
      throw new SingleSelectionOnlyError();
    }
    if (resulting > maxSelections) {
      throw new MaxSelectionsExceededError(maxSelections);
    }

    return this.createMultipleVotes(pollId, userId, menuItemIds);
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
            VoteXpService.awardVoteXp(userId, pollId, menuItemId)
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
          VoteXpService.awardVoteXp(userId, pollId, menuItemId)
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
}
