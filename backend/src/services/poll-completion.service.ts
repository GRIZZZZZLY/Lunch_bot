/**
 * Завершение голосования.
 *
 * Четвёртая часть, вынесенная из `poll.service.ts` (задача 06), и самая
 * опасная: здесь транзакции. Правило, которое нельзя нарушать при любой
 * дальнейшей нарезке — проверка статуса и переход `ACTIVE → COMPLETED` живут
 * ВНУТРИ одной транзакции. Комментарий в исходном коде говорил об этом прямо:
 * так была починена гонка, когда два одновременных запроса создавали два
 * комплекта итогов. Извлечённые части поэтому принимают `tx` параметром и
 * никогда не берут глобальный `prisma`.
 *
 * Второе: пост-обработка (опыт, уведомления, заказы по категориям) вынесена ЗА
 * транзакцию и не имеет права её отменить. Голосование уже завершено; падение
 * уведомления — это не причина откатывать результат.
 *
 * Импорты статические. Раньше здесь стояли семь `await import('./x.service.js')`
 * «против циклического импорта», но цикла нет: ни `poll-notification.service`,
 * ни `category-order.service`, ни `gamification.service` не импортируют сервисы
 * голосования — ни напрямую, ни через свои зависимости. Проверяется это не на
 * глаз: `npm run knip` включает поиск циклов.
 */
import { Prisma, PollResult } from '@prisma/client';

import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { votePublicUserSelect } from '../types/poll.types';
import { now } from '../utils/date';
import { CacheInvalidator } from './cache.service';
import { GroupService } from './group.service';
import { PollService, type PollResultDetailed } from './poll.service';
import { buildMultiWinnerResult } from './poll-winners';
import {
  PollAlreadyCompletedError,
  PollNotActiveError,
  PollNotFoundError,
  PollStateError,
} from './poll.errors';
import { pollNotificationService } from './poll-notification.service';
import { GamificationService } from './gamification.service';
import { getXPReward } from '../constants/xp-constants';
import { CategoryOrderService } from './category-order.service';
import { MultiCategoryResponsibleService } from './multi-category-responsible.service';

export interface MultiWinnerOptions {
  minVotes?: number;
  maxWinners?: number | null;
  tieBreakMethod?: 'earliest' | 'alphabetical';
}

/** Голоса с участниками и блюдами — то, из чего считаются победители. */
const votesWithDetails = {
  votes: {
    include: {
      user: { select: votePublicUserSelect },
      menuItem: true,
    },
  },
} satisfies Prisma.PollInclude;

export class PollCompletionService {
  /**
   * Завершить голосование с одним победителем.
   *
   * Победителем становится блюдо с наибольшим числом голосов; при равенстве —
   * то, которое встретилось первым. Голосования с несколькими победителями
   * считает `completePollMultiWinner`, и это разные продуктовые режимы, а не
   * две реализации одного.
   *
   * Возвращается ПОЛНЫЙ итог (`PollResultDetailed`): со опросом, группой,
   * голосами, победившим блюдом и ответственным. В подписи стоял голый
   * `PollResult`, хотя связи возвращались всегда — и бот, читавший `poll.title`
   * у этого значения, компилятором не проверялся.
   */
  static async completePoll(pollId: number): Promise<PollResultDetailed> {
    try {
      const { pollResult, poll } = await prisma.$transaction(tx =>
        this.completeSingleWinnerInTransaction(tx, pollId)
      );

      void CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      logger.info(
        `Poll completed: ${pollId}, winner: ${pollResult.winnerMenuItemId}, total votes: ${poll.votes.length}`
      );

      await this.awardPollCreationXp(pollId, poll.createdBy, poll.votes.length);
      await this.notifyCompletion(pollId);

      return await PollService.getPollResult(pollResult.id);
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
   * Тело завершения: всё, что обязано быть атомарным.
   *
   * Статус проверяется здесь, а не до транзакции: проверка снаружи ничего не
   * гарантирует — между ней и записью успевает пройти второй запрос.
   */
  private static async completeSingleWinnerInTransaction(
    tx: Prisma.TransactionClient,
    pollId: number
  ) {
    const poll = await tx.poll.findUnique({
      where: { id: pollId },
      include: votesWithDetails,
    });

    if (!poll) {
      throw new PollNotFoundError();
    }

    if (poll.status !== 'ACTIVE') {
      const message = `Poll is already ${poll.status.toLowerCase()}`;
      /* «Уже завершено» — свой код: у него отдельный текст на фронте.
         Остальные состояния (отменено) — конфликт состояния, то есть 409. */
      throw poll.status === 'COMPLETED'
        ? new PollAlreadyCompletedError(message)
        : new PollStateError(message);
    }

    const winnerMenuItemId = singleWinnerFrom(poll.votes);

    const transition = await tx.poll.updateMany({
      where: { id: pollId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', endedAt: now() },
    });
    if (transition.count !== 1) {
      throw new Error('Poll state changed during completion');
    }

    const pollResult = await tx.pollResult.create({
      data: {
        pollId,
        winnerMenuItemId,
        totalVotes: poll.votes.length,
        responsibleUserId: poll.createdBy,
      },
    });

    return { pollResult, poll };
  }

  /**
   * Завершить голосование с несколькими победителями.
   *
   * Идемпотентно: повторный вызов на завершённом голосовании отдаёт
   * существующий результат, а не второй комплект итогов.
   */
  static async completePollMultiWinner(
    pollId: number,
    completedBy: number,
    options?: MultiWinnerOptions
  ): Promise<PollResult> {
    const {
      minVotes = 1,
      maxWinners = null,
      tieBreakMethod = 'earliest',
    } = options || {};

    try {
      const loaded = await this.loadPollForMultiWinner(pollId);
      if ('alreadyCompleted' in loaded) return loaded.alreadyCompleted;

      const poll = loaded.poll;

      const { resultData, primaryWinnerId, tieBreak } = buildMultiWinnerResult(
        poll.votes,
        { minVotes, maxWinners, tieBreakMethod, completedBy, completedAt: now() }
      );

      if (tieBreak) {
        logger.info(`Tie-break applied for poll ${pollId}`, {
          method: tieBreak.method,
          appliedTo: tieBreak.appliedTo,
          selected: primaryWinnerId,
        });
      }

      const result = await prisma.$transaction(tx =>
        this.persistMultiWinnerResult(tx, {
          pollId,
          completedBy,
          primaryWinnerId,
          totalVotes: poll.votes.length,
          rouletteData: JSON.stringify(resultData),
        })
      );

      void CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      logger.info(`Poll ${pollId} completed with multi-winner mode`, {
        winnersCount: resultData.winners.length,
        bringOwnCount: resultData.bringOwn.count,
        skippedCount: resultData.skipped.count,
        primaryWinnerId,
        totalVotes: poll.votes.length,
      });

      await this.notifyCompletion(pollId);
      await this.startCategoryOrders(pollId);

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
   * Прочитать голосование и решить, есть ли что считать.
   *
   * Три исхода: голосования нет (404), оно уже завершено и результат есть
   * (идемпотентный ответ — считать нечего), либо оно активно и его голоса можно
   * подсчитать. Отдельный метод, потому что «уже завершено» — не ошибка, и
   * различать его исключением значило бы бросать ошибку на нормальном пути.
   */
  private static async loadPollForMultiWinner(pollId: number): Promise<
    | { alreadyCompleted: PollResult }
    | {
        poll: NonNullable<
          Awaited<
            ReturnType<
              typeof prisma.poll.findUnique<{
                where: { id: number };
                include: typeof votesWithDetails & { group: true };
              }>
            >
          >
        >;
      }
  > {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { ...votesWithDetails, group: true },
    });

    if (!poll) {
      throw new PollNotFoundError();
    }

    if (poll.status === 'COMPLETED') {
      const existing = await this.existingResult(pollId);
      if (existing) {
        logger.info(
          `Poll ${pollId} already completed, returning existing result`
        );
        return { alreadyCompleted: existing };
      }
    }

    if (poll.status !== 'ACTIVE') {
      throw new PollNotActiveError();
    }

    return { poll };
  }

  /** Итоги уже посчитаны — записать их, если голосование всё ещё активно. */
  private static async persistMultiWinnerResult(
    tx: Prisma.TransactionClient,
    data: {
      pollId: number;
      completedBy: number;
      primaryWinnerId: number | null;
      totalVotes: number;
      rouletteData: string;
    }
  ): Promise<PollResult> {
    const current = await tx.poll.findUnique({
      where: { id: data.pollId },
      select: { status: true },
    });

    if (!current) {
      throw new PollNotFoundError();
    }

    if (current.status === 'COMPLETED') {
      /* Гонка: пока считались победители, голосование закрыл кто-то другой.
         Его результат и есть ответ; своего второго комплекта не создаём. */
      const existing = await tx.pollResult.findUnique({
        where: { pollId: data.pollId },
        include: { winnerMenuItem: true, responsibleUser: true },
      });
      if (existing) return existing;

      throw new PollAlreadyCompletedError();
    }

    if (current.status !== 'ACTIVE') {
      throw new PollNotActiveError();
    }

    const transition = await tx.poll.updateMany({
      where: { id: data.pollId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', endedAt: now() },
    });
    if (transition.count !== 1) {
      throw new Error('Poll state changed during completion');
    }

    return await tx.pollResult.create({
      data: {
        pollId: data.pollId,
        winnerMenuItemId: data.primaryWinnerId,
        totalVotes: data.totalVotes,
        responsibleUserId: data.completedBy,
        rouletteData: data.rouletteData,
      },
      include: { winnerMenuItem: true, responsibleUser: true },
    });
  }

  private static async existingResult(
    pollId: number
  ): Promise<PollResult | null> {
    return await prisma.pollResult.findUnique({
      where: { pollId },
      include: { winnerMenuItem: true, responsibleUser: true },
    });
  }

  /**
   * Закрыть голосование, если проголосовали все ожидаемые участники.
   *
   * Правило жило в контроллере голосований (`autoCompleteIfQuorumReached`),
   * то есть действовало только для одного эндпоинта и проверялось через HTTP.
   * Сбой закрытия не должен отменять уже поданный голос — поэтому исключение
   * здесь гасится: голос записан, а закрытие голосования — отдельное следствие.
   *
   * ВНИМАНИЕ: это НЕ то же самое, что `checkQuorumAndComplete`. Тот закрывает
   * голосование в режиме одного победителя и вызывается из другого пути подачи
   * голоса. Два пути подачи голоса закрывают голосование по-разному — расхождение
   * зафиксировано в `tech_debt/06`, и сводить их надо продуктовым решением.
   */
  static async completeIfQuorumReached(
    pollId: number,
    completedBy: number
  ): Promise<boolean> {
    try {
      if (!(await this.checkAutoComplete(pollId))) return false;

      logger.info(`Auto-completing poll ${pollId} (quorum reached)`);
      await this.completePollMultiWinner(pollId, completedBy, {
        minVotes: 1,
        tieBreakMethod: 'earliest',
      });
      return true;
    } catch (error) {
      logger.error('Auto-complete check/execution failed:', error);
      return false;
    }
  }

  /**
   * Проголосовали ли все ожидаемые участники — с учётом настройки группы.
   *
   * Кворум считается по СНИМКУ ожидаемых участников (`poll_participants`,
   * `status = EXPECTED`), снятому при создании голосования, а не по эвристике из
   * истории или Telegram API. Прежний подход для новой группы без истории давал
   * «ожидается 1 человек», и голосование закрывалось после первого же голоса.
   */
  static async checkAutoComplete(pollId: number): Promise<boolean> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        select: { status: true, groupId: true },
      });

      if (!poll || poll.status !== 'ACTIVE') return false;

      const settings = await GroupService.getGroupSettings(poll.groupId);
      if (!settings.autoCompleteEnabled) {
        logger.info(`Auto-complete disabled for group ${poll.groupId}`);
        return false;
      }

      return await this.allExpectedVoted(pollId, 'checkAutoComplete');
    } catch (error) {
      logger.error('Error checking auto-complete:', error);
      return false;
    }
  }

  /**
   * Проверить кворум и закрыть голосование с ОДНИМ победителем.
   *
   * Второй путь автозакрытия, оставшийся от подачи голоса через
   * `vote.controller` и админский эндпоинт. Настройку группы
   * `autoCompleteEnabled` он, в отличие от `checkAutoComplete`, не смотрит.
   */
  static async checkQuorumAndComplete(pollId: number): Promise<boolean> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { status: true },
    });
    if (!poll || poll.status !== 'ACTIVE') return false;

    if (!(await this.allExpectedVoted(pollId, 'checkQuorumAndComplete'))) {
      return false;
    }

    logger.info(`Poll ${pollId}: quorum reached, auto-completing`);
    try {
      await this.completePoll(pollId);
      return true;
    } catch (error) {
      /* Гонка: два голоса одновременно собрали кворум, и второй вызов упёрся
         в проверку статуса внутри транзакции. Это не сбой. */
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('Poll is already')) {
        logger.debug(
          `checkQuorumAndComplete: poll ${pollId} already completed by concurrent caller`
        );
        return false;
      }
      logger.error(
        `checkQuorumAndComplete: failed to auto-complete poll ${pollId}`,
        error
      );
      return false;
    }
  }

  /**
   * Все ли ожидаемые участники проголосовали.
   *
   * Пустой снимок НЕ считается кворумом: иначе голосование в группе, где никого
   * не ожидают, закрывалось бы сразу после создания.
   */
  private static async allExpectedVoted(
    pollId: number,
    caller: string
  ): Promise<boolean> {
    const expected = await prisma.pollParticipant.findMany({
      where: { pollId, status: 'EXPECTED' },
      select: { userId: true },
    });

    if (expected.length === 0) {
      logger.warn(
        `${caller}: poll ${pollId} has no EXPECTED participants — not auto-closing`
      );
      return false;
    }

    const voters = await prisma.vote.findMany({
      where: { pollId },
      select: { userId: true },
      distinct: ['userId'],
    });
    const voted = new Set(voters.map(vote => vote.userId));

    return expected.every(participant => voted.has(participant.userId));
  }

  /**
   * Тихо отменить голосования, у которых истёк таймер, но кворум не собрался.
   *
   * Без `completePoll` — значит без постинга итогов и рулетки в группу (решение
   * владельца). Иначе такие голосования висят `ACTIVE` вечно: из активного
   * списка они спрятаны фильтром по времени, а создание нового блокируют.
   * Идемпотентно: `updateMany` с гейтом по статусу.
   *
   * Срок жизни — `ended_at`, если он проставлен, иначе `started_at` плюс
   * `duration` минут (то же правило, что у `pollEndsAt` в чтении), то есть
   * отбор просроченных — сравнение колонки с колонкой, и `where` у Prisma его
   * не выражает. Раньше отбор шёл в JS, а из базы забирались ВСЕ активные
   * голосования: планировщик каждую минуту вытаскивал по строке на каждую
   * живую группу, чтобы почти всегда ничего не сделать. Теперь фильтр в SQL —
   * приходят только просроченные.
   *
   * `COALESCE` здесь обязателен: без него строка с проставленным `ended_at` и
   * статусом `ACTIVE` для чтения уже закончилась (её не видно в списке), а для
   * планировщика ещё нет — и она блокировала создание нового голосования до
   * `started_at + duration`, то есть иногда вечно.
   *
   * Момент сравнения передаётся числом (epoch ms), а не `Date`: колонка
   * `started_at` — это `timestamp(3)` БЕЗ зоны, куда Prisma пишет UTC. Параметр
   * типа `Date` приезжает в запрос как `timestamptz`, и сравнение с ним
   * приводит колонку к зоне сессии — на сервере с местной зоной граница
   * поехала бы на несколько часов. `to_timestamp(...) at time zone 'UTC'`
   * даёт ровно ту же ненумерованную шкалу, в которой лежат данные.
   *
   * Диалект PostgreSQL: рабочая, тестовая и локальная БД — одна и та же.
   */
  static async cancelExpiredPolls(at: Date = new Date()): Promise<number> {
    const expired = await prisma.$queryRaw<
      Array<{ id: number; groupId: number; endsAt: Date }>
    >`
      SELECT id,
             group_id AS "groupId",
             COALESCE(ended_at, started_at + (duration * INTERVAL '1 minute')) AS "endsAt"
      FROM polls
      WHERE status = 'ACTIVE'
        AND COALESCE(ended_at, started_at + (duration * INTERVAL '1 minute'))
            <= to_timestamp(${at.getTime()}::bigint / 1000.0) at time zone 'UTC'
    `;

    /* Обновление построчное намеренно, и это не N+1 по недосмотру:
       `where: { id, status: 'ACTIVE' }` — оптимистичная блокировка, а `count`
       говорит, не закрыл ли голосование кто-то другой между выборкой и
       записью. Батч по всем id вернул бы одно общее число и не сказал бы, у
       каких голосований чистить кэш и что писать в лог. Строк здесь единицы —
       ровно просроченные. */
    let cancelled = 0;
    for (const poll of expired) {
      /* `endedAt` — момент, когда голосование ФАКТИЧЕСКИ кончилось, а не время
         тика: пропущенный тик (простой, рестарт, ручной запуск через сутки)
         иначе запишет в историю длительность в сутки вместо тридцати минут. */
      const result = await prisma.poll.updateMany({
        where: { id: poll.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED', endedAt: poll.endsAt },
      });

      if (result.count > 0) {
        cancelled += 1;
        void CacheInvalidator.invalidatePoll(poll.id, poll.groupId);
        logger.info(
          `Auto-cancelled expired poll ${poll.id} (group ${poll.groupId}) — timer elapsed, no quorum`
        );
      }
    }

    return cancelled;
  }

  /** Опыт автору голосования. Сбой не отменяет завершение. */
  private static async awardPollCreationXp(
    pollId: number,
    createdBy: number,
    participants: number
  ): Promise<void> {
    try {
      const reward = getXPReward('CREATE_POLL');
      await GamificationService.awardXP(
        createdBy,
        reward.amount,
        reward.reason,
        reward.category,
        { pollId, participants },
        `poll-create:${pollId}:${createdBy}`
      );
      logger.info(
        `XP awarded: ${reward.amount} to user ${createdBy} for creating poll`
      );
    } catch (error) {
      logger.error('Failed to award XP for poll creation:', error);
    }
  }

  /** Уведомления участникам. Сбой не отменяет завершение. */
  private static async notifyCompletion(pollId: number): Promise<void> {
    try {
      await pollNotificationService.sendPollCompletionNotifications(pollId);
      logger.info(`Completion notifications sent for poll ${pollId}`);
    } catch (error) {
      logger.error('Error sending completion notifications:', error);
    }
  }

  /**
   * Заказы по категориям и выбор ответственных — следующий шаг сценария обеда.
   * Сбой не отменяет завершение: голосование уже закрыто.
   */
  private static async startCategoryOrders(pollId: number): Promise<void> {
    try {
      const categoryOrders =
        await CategoryOrderService.createCategoryOrders(pollId);
      logger.info(
        `Created ${categoryOrders.length} CategoryOrders for poll ${pollId}`
      );

      await MultiCategoryResponsibleService.startMultiCategorySelection(pollId);
      logger.info(
        `Multi-category responsible selection started for poll ${pollId}`
      );
    } catch (error) {
      logger.error('Error in category order creation/selection:', error);
    }
  }
}

/**
 * Победитель в режиме одного победителя: больше всех голосов, при равенстве —
 * первый встреченный. Голоса без блюда не считаются.
 */
function singleWinnerFrom(
  votes: Array<{ menuItemId: number | null; menuItem: unknown }>
): number | null {
  const counts = new Map<number, number>();

  for (const vote of votes) {
    if (!vote.menuItemId || !vote.menuItem) continue;
    counts.set(vote.menuItemId, (counts.get(vote.menuItemId) ?? 0) + 1);
  }

  let winner: number | null = null;
  let maxVotes = 0;
  for (const [menuItemId, count] of counts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      winner = menuItemId;
    }
  }

  return winner;
}
