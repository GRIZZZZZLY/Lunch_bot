import { Poll, Vote, PollResult, Prisma, MenuItem, User } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import {
  CreatePollData,
  PollWithDetails,
  PollStats,
  votePublicUserSelect,
  VotePublicUser,
} from '../types/poll.types';
import { GroupService } from './group.service';
import { pollNotificationService } from './poll-notification.service';
import {
  cacheService,
  CACHE_KEYS,
  CACHE_TTL,
  CacheInvalidator,
} from './cache.service';
import { toNumber } from '../utils/decimal';
import {
  now,
  getStartOfToday,
  toISOString,
  calculatePollEndTime,
  isPollOver,
  pollEndsAt,
  getTimestamp,
  getMillisecondsDifference,
  subtractMinutes,
} from '../utils/date';
import { menuItemIdsFromVoteGroups } from '../utils/vote-menu-items';
import { buildMultiWinnerResult } from './poll-winners';
import {
  NoVotersError,
  PollAlreadyActiveError,
  PollAlreadyCompletedError,
  PollNotActiveError,
  PollNotFoundError,
  PollStateError,
} from './poll.errors';

// Тип Vote с включенными связями для корректной типизации
type VoteWithRelations = Vote & {
  menuItem: MenuItem | null;
  user: VotePublicUser;
};

export interface UpdatePollData {
  selectedMenuItemIds?: string | null;
  chatId?: bigint | null;
  messageId?: number | null;
  duration?: number;
}

/**
 * Связи итога голосования — ОДИН объект на обе ветки `savePollResult`
 * (обновление и создание). Раньше `include` был выписан в каждой ветке, а
 * возвращаемый тип стоял `Promise<any>`: расхождение форм между «первым
 * расчётом» и «повторным» ничего бы не сломало при компиляции, а бот и API
 * получали бы разные объекты от одного метода.
 */
const pollResultInclude = {
  poll: true,
  winnerMenuItem: true,
  responsibleUser: true,
} satisfies Prisma.PollResultInclude;

/** Итог голосования вместе с опросом, победившим блюдом и ответственным. */
export type PollResultWithDetails = Prisma.PollResultGetPayload<{
  include: typeof pollResultInclude;
}>;

/**
 * Полный итог: то же плюс группа и голоса опроса.
 *
 * Тип нужен именно объявленный, а не выведенный по месту: `getPollResult`
 * возвращал ЭТО, а в подписи стояло `Promise<PollResult>` — связи стирались
 * ещё в сервисе. Дальше `completePoll` отдавал результат наружу, и бот читал у
 * него `poll.title`; компилятор молчал, потому что читал через `any` в
 * клавиатуре, а в группе выходило «undefined» и падение на разметке.
 */
const pollResultDetailedInclude = {
  poll: {
    include: {
      group: true,
      votes: {
        include: {
          user: { select: votePublicUserSelect },
          menuItem: true,
        },
      },
    },
  },
  winnerMenuItem: true,
  responsibleUser: true,
} satisfies Prisma.PollResultInclude;

export type PollResultDetailed = Prisma.PollResultGetPayload<{
  include: typeof pollResultDetailedInclude;
}>;

/* Класс переехал в `poll.errors.ts` вместе с остальными доменными ошибками
   голосования: там он несёт свой статус и код, а не получает их от
   контроллера. Реэкспорт оставлен, потому что импорт из `poll.service`
   встречается в коде и в тестах. */
export { PollAlreadyActiveError } from './poll.errors';

export class PollService {
  /**
   * Создание нового голосования
   */
  static async createPoll(data: CreatePollData): Promise<Poll> {
    try {
      // Atomic: re-check no active poll exists for this group AND insert in same tx.
      // Without this, two concurrent createPoll requests can both pass the
      // controller-level guard and end up creating duplicate active polls.
      // Snapshot creation also moves inside the tx so an existing poll always
      // has its expected-voters set ready for auto-close-on-quorum.
      let stalePollId: number | null = null;

      const poll = await prisma.$transaction(async tx => {
        const existing = await tx.poll.findFirst({
          where: { groupId: data.groupId, status: 'ACTIVE' },
          select: { id: true, startedAt: true, duration: true, endedAt: true },
        });

        if (existing && !isPollOver(existing)) {
          throw new PollAlreadyActiveError(data.groupId, existing.id);
        }

        /* Строка `ACTIVE` с истёкшим сроком — не голосование, а мусор от
           пропущенного тика планировщика: в списке активных её уже нет, но
           частичный уникальный индекс polls_one_active_per_group не пустит
           вставку, пока она в этом статусе. Закрываем ЗДЕСЬ, в той же
           транзакции: иначе между отменой и вставкой пролезет конкурент.
           `endedAt` — момент, когда голосование фактически кончилось, а не
           «сейчас»: иначе в истории останется неверная длительность. */
        if (existing) {
          await tx.poll.updateMany({
            where: { id: existing.id, status: 'ACTIVE' },
            data: { status: 'CANCELLED', endedAt: pollEndsAt(existing) },
          });
          stalePollId = existing.id;
        }

        const newPoll = await tx.poll.create({
          data: {
            groupId: data.groupId,
            status: 'ACTIVE',
            duration: data.duration || 30,
            createdBy: data.createdBy,
            isMultiSelect: data.isMultiSelect ?? true,
            maxSelections: data.maxSelections ?? 3,
          },
        });

        // Inline snapshot creation so the EXPECTED/EXCLUDED rows commit with the poll.
        const members = await tx.groupMember.findMany({
          where: { groupId: data.groupId, isActive: true },
          include: {
            user: { select: { id: true, isActive: true } },
          },
        });

        const participantRows = members
          .filter(m => m.user.isActive)
          .map(m => ({
            pollId: newPoll.id,
            userId: m.user.id,
            status: m.participatesInPolls ? 'EXPECTED' : 'EXCLUDED',
          }));

        if (participantRows.length > 0) {
          await tx.pollParticipant.createMany({ data: participantRows });
        } else {
          logger.warn(
            `createPoll: no active members for poll ${newPoll.id} in group ${data.groupId}`
          );
        }

        return newPoll;
      });

      // Инвалидируем кэш активных голосований
      if (stalePollId !== null) {
        logger.warn(
          `createPoll: closed stale ACTIVE poll ${stalePollId} in group ${data.groupId} — its timer had elapsed`
        );
        void CacheInvalidator.invalidatePoll(stalePollId, data.groupId);
      }
      void CacheInvalidator.invalidatePoll(poll.id, poll.groupId);

      logger.info(`Poll created: ${poll.id} in group ${poll.groupId}`);
      return poll;
    } catch (error) {
      if (error instanceof PollAlreadyActiveError) throw error;
      // Гонка: партиал-уникальный индекс polls_one_active_per_group отдал P2002 —
      // другой конкурентный createPoll успел вставить ACTIVE poll между нашим
      // guard-SELECT и INSERT (транзакция при этом откатилась). Переводим в
      // доменную ошибку, чтобы контроллер вернул 400 POLL_ALREADY_ACTIVE.
      if ((error as { code?: string })?.code === 'P2002') {
        const existing = await prisma.poll.findFirst({
          where: { groupId: data.groupId, status: 'ACTIVE' },
          select: { id: true },
        });
        throw new PollAlreadyActiveError(data.groupId, existing?.id ?? -1);
      }
      logger.error('Error creating poll:', error);
      throw new Error('Failed to create poll');
    }
  }




  static async cancelPoll(
    pollId: number,
    cancelledBy: number,
    reason?: string
  ): Promise<Poll> {
    try {
      const transition = await prisma.poll.updateMany({
        where: { id: pollId, status: 'ACTIVE' },
        data: {
          status: 'CANCELLED',
          endedAt: now(),
        },
      });

      const poll = await prisma.poll.findUnique({ where: { id: pollId } });
      if (!poll) {
        throw new PollNotFoundError();
      }
      if (transition.count === 0) {
        if (poll.status === 'CANCELLED') {
          return poll;
        }
        throw new PollStateError('Only an active poll can be cancelled');
      }

      // Инвалидируем кэш активных голосований
      void CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      logger.info(
        `Cache invalidated for cancelled poll ${pollId} in group ${poll.groupId}`
      );

      // Отправляем уведомления об отмене
      const user = await prisma.user.findUnique({
        where: { id: cancelledBy },
      });

      if (user) {
        await pollNotificationService.sendPollCancelledNotifications(
          pollId,
          user,
          reason
        );
      }

      logger.info(`Poll cancelled: ${pollId} by user ${cancelledBy}`);
      return poll;
    } catch (error) {
      if (
        error instanceof Error &&
        ['Poll not found', 'Only an active poll can be cancelled'].includes(
          error.message
        )
      ) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new PollNotFoundError();
        }
      }
      logger.error('Error cancelling poll:', error);
      throw new Error('Failed to cancel poll');
    }
  }

  /**
   * Обновление голосования
   */
  static async updatePoll(pollId: number, data: UpdatePollData): Promise<Poll> {
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
  static async getPollResult(resultId: number): Promise<PollResultDetailed> {
    try {
      const result = await prisma.pollResult.findUnique({
        where: { id: resultId },
        include: pollResultDetailedInclude,
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
  static async getPollResultByPollId(
    pollId: number
  ): Promise<PollResult | null> {
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
              user: { select: votePublicUserSelect },
            },
          },
        },
      });

      if (!poll) {
        throw new PollNotFoundError();
      }

      // Получаем уникальных пользователей, которые голосовали
      const voters = Array.from(
        new Map(poll.votes.map(vote => [vote.userId, vote.user])).values()
      );

      if (voters.length === 0) {
        throw new NoVotersError();
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

      logger.info('Poll roulette completed', {
        pollId,
        userId: responsibleUser.id,
      });
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


  static async savePollResult(data: {
    pollId: number;
    winnerMenuItemId?: number;
    responsibleUserId: number;
    totalVotes: number;
    rouletteData?: string;
  }): Promise<PollResultWithDetails> {
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
          include: pollResultInclude,
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
          include: pollResultInclude,
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
