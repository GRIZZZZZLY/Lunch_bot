/**
 * HTTP-слой голосований.
 *
 * Что здесь есть и чего здесь нет
 * -------------------------------
 * Handler делает три вещи: читает УЖЕ разобранный вход (контракты из
 * `schemas/poll.ts`), проверяет доступ, вызывает сервис и сериализует ответ.
 * Всё остальное — не здесь:
 *
 * - разбор и валидация входа — контракт на маршруте (`middleware/validate.ts`);
 * - ответ на ошибку — `middleware/error-handler.ts`. Handler'ы НЕ ловят
 *   исключения: Express 5 сам передаёт отказ асинхронного обработчика в
 *   обработчик ошибок, а статус и код несут сами классы ошибок
 *   (`services/poll.errors.ts`, `services/vote.errors.ts`, `api/http.errors.ts`).
 *   Раньше на каждый handler приходилось 5–8 строк `catch` + `res.status(500)`,
 *   и они расходились между собой: за одну и ту же ситуацию разные эндпоинты
 *   отдавали разные коды;
 * - бизнес-сценарий — в сервисе. Признак нарушения: handler, который знает
 *   порядок нескольких вызовов сервисов.
 *
 * Сериализация остаётся транспортом: `serializeBigInt` вызывается ЗДЕСЬ и
 * только здесь (`telegramId` в Prisma — BigInt). Если утащить её в сервис,
 * сервис начнёт отдавать строки там, где вызывающему нужны числа.
 */
import { Request, Response } from 'express';
import { PollService } from '../../services/poll.service';
import {
  PollAlreadyActiveError,
  PollNotFoundError,
} from '../../services/poll.errors';
import { VoteService } from '../../services/vote.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { CreatePollData, CreateVoteData } from '../../types/poll.types';
import {
  createPollForGroup,
  repeatPoll,
} from '../../services/poll-creation.service';
import { serializeBigInt } from '../../utils/serialize';
import { menuItemIdsFromVoteGroups } from '../../utils/vote-menu-items';
import { FEATURES } from '../../config/features';
import {
  filterVotesToSelection,
  parseRouletteData,
  withEndTime,
} from './poll.view';
import { requireAuthUserOrThrow } from '../middleware/require-auth-user';
import {
  accessibleGroupIds,
  assertGroupAdmin,
  assertGroupMember,
  assertPollAdmin,
  assertPollMember,
  groupScope,
} from '../access/poll-access';
import {
  AccessDeniedError,
  FeatureDisabledError,
  HttpError,
  withLegacyCode,
} from '../http.errors';
import { PollQueryService } from '../../services/poll-query.service';
import {
  cancelPollBody,
  completeMultiWinnerBody,
  createPollBody,
  createPollFromWebAppBody,
  pollGroupIdParam,
  pollGroupQuery,
  pollHistoryQuery,
  pollIdParam,
  pollUserIdParam,
  popularItemsQuery,
  voteBody,
  voteMultipleBody,
} from '../schemas/poll';
import { PollStatsService } from '../../services/poll-stats.service';
import { PollCompletionService } from '../../services/poll-completion.service';

/**
 * Исторические коды `PATCH /polls/:id/complete-multi`.
 *
 * Тот же сбой этот эндпоинт называет иначе, чем остальные, и у обоих кодов на
 * фронте свой текст. Подробности и причина, почему это не сводится здесь, —
 * в `withLegacyCode`.
 */
const MULTI_WINNER_LEGACY_CODES = {
  POLL_NOT_FOUND: 'NOT_FOUND',
  POLL_ALREADY_COMPLETED: 'ALREADY_COMPLETED',
} as const;

/**
 * Параметры завершения с несколькими победителями.
 *
 * Диапазоны и допустимые значения проверяет схема тела; здесь остаются только
 * значения по умолчанию — это поведение продукта, а не валидация.
 */
function multiWinnerParams(req: Request): {
  minVotes: number;
  maxWinners: number | null;
  tieBreakMethod: 'earliest' | 'alphabetical';
} {
  const body = completeMultiWinnerBody.get(req);

  return {
    minVotes: body.minVotes ?? 1,
    maxWinners: body.maxWinners ?? null,
    tieBreakMethod: body.tieBreakMethod ?? 'earliest',
  };
}

export class PollController {
  /**
   * GET /api/polls/active
   * Активные голосования во всех группах человека
   */
  static async getActivePolls(req: Request, res: Response): Promise<void> {
    const groupIds = await accessibleGroupIds(req);
    const polls = await PollQueryService.getActivePolls(groupIds);
    const pollsWithEndTime = polls.map(withEndTime);

    res.json({
      success: true,
      data: serializeBigInt(pollsWithEndTime),
      count: pollsWithEndTime.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/history
   * История голосований с постраничной выдачей
   */
  static async getPollHistory(req: Request, res: Response): Promise<void> {
    const { groupId, limit = 20, offset = 0 } = pollHistoryQuery.get(req);

    const scope = await groupScope(req, groupId);
    const result = await PollQueryService.getPollHistory(scope, limit, offset);

    res.json({
      success: true,
      data: {
        polls: serializeBigInt(result.polls),
        total: result.total,
        limit,
        offset,
        hasNext: offset + limit < result.total,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/last-completed
   * Последнее завершённое голосование — для «повторить вчерашнее»
   */
  static async getLastCompleted(req: Request, res: Response): Promise<void> {
    const { groupId } = pollGroupQuery.get(req);

    const scope = await groupScope(req, groupId);
    const poll = await PollQueryService.getLastCompletedPoll(scope);

    res.json({
      success: true,
      data: poll ? serializeBigInt(poll) : null,
    });
  }

  /**
   * GET /api/polls/today-completed/:groupId
   * Последнее голосование, завершённое сегодня
   */
  static async getTodayCompletedPoll(req: Request, res: Response): Promise<void> {
    const { groupId } = pollGroupIdParam.get(req);

    await assertGroupMember(req, groupId);
    const poll = await PollQueryService.getTodayCompletedPoll(groupId);

    res.json({
      success: true,
      data: poll ? serializeBigInt(poll) : null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls/repeat/:id
   * Повторить голосование: создать такое же и отправить в группу
   */
  static async repeatPoll(req: Request, res: Response): Promise<void> {
    const { id: pollId } = pollIdParam.get(req);
    const { user } = await assertPollAdmin(req, pollId);

    const poll = await repeatPoll(pollId, user.id);

    logger.info(`Poll ${pollId} repeated as poll ${poll?.id} by user ${user.id}`);

    res.json({
      success: true,
      data: serializeBigInt(poll),
      message: 'Poll repeated and sent to Telegram group',
    });
  }

  /**
   * GET /api/polls/stats
   * Статистика голосований по доступным группам
   */
  static async getPollStats(req: Request, res: Response): Promise<void> {
    const { groupId } = pollGroupQuery.get(req);

    const scope = await groupScope(req, groupId);
    const stats = await PollStatsService.getPollStats(scope);

    res.json({
      success: true,
      data: serializeBigInt(stats),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/user-stats/my
   * Своя статистика участия
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    const user = requireAuthUserOrThrow(req);

    const stats = await PollStatsService.getUserParticipationStats(user.id);

    res.json({
      success: true,
      data: serializeBigInt(stats),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/user-stats/:userId
   * Статистика участия конкретного человека (доступ — на маршруте)
   */
  static async getUserStatsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = pollUserIdParam.get(req);

    const stats = await PollStatsService.getUserParticipationStats(userId);

    res.json({
      success: true,
      data: serializeBigInt(stats),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/:id
   * Голосование целиком: с расчётным временем окончания и своими голосами
   */
  static async getPollById(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    const user = requireAuthUserOrThrow(req);

    const poll = await PollQueryService.getPollById(id);
    if (!poll) throw new PollNotFoundError();

    if (!(await GroupService.isUserGroupMember(user.id, poll.groupId))) {
      throw new AccessDeniedError();
    }

    res.json({
      success: true,
      data: serializeBigInt(filterVotesToSelection(withEndTime(poll), id)),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/:id/results
   * Итоги голосования вместе с разбивкой голосов
   */
  static async getPollResults(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    await assertPollMember(req, id);

    const result = await PollService.getPollResultByPollId(id);
    if (!result) {
      throw new HttpError('Poll results not found', 404, 'RESULTS_NOT_FOUND');
    }

    const breakdown = await PollStatsService.getPollVoteBreakdown(id);

    res.json({
      success: true,
      data: serializeBigInt({ result, breakdown }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/:id/votes
   * Голоса голосования и сводка по блюдам
   */
  static async getPollVotes(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    await assertPollMember(req, id);

    const votes = await VoteService.getPollVotes(id);
    const summary = await VoteService.getVoteCountByMenuItem(id);

    res.json({
      success: true,
      data: serializeBigInt({ votes, summary, totalVotes: votes.length }),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/:id/my-votes
   * Свои голоса в голосовании — только блюда, за которые голосовал вызывающий.
   *
   * Отдельно от `/:id/votes`: тому нужна вся картина группы, а Mini App
   * спрашивает ровно «что выбрал я», чтобы отметить строку талона. Отсутствие
   * голоса — не ошибка, а пустой массив: «я не голосовал» такой же законный
   * ответ, как и сам голос.
   */
  static async getMyVotes(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    const { user } = await assertPollMember(req, id);

    const votes = await VoteService.getUserVotes(id, user.id);

    res.json({
      success: true,
      data: { menuItemIds: menuItemIdsFromVoteGroups(votes) },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls
   * Создание голосования
   */
  static async createPoll(req: Request, res: Response): Promise<void> {
    const { groupId } = createPollBody.get(req);
    const user = await assertGroupAdmin(req, groupId);

    /* Тело уже разобрано контрактом, поэтому `req.body` здесь — его результат:
       объявленные поля приведены к типам, незаявленные (`selectedMenuItemIds`
       и прочее) сохранены как есть. */
    const poll = await PollService.createPoll({
      ...(req.body as CreatePollData),
      groupId,
      createdBy: user.id, // Всегда автор запроса, а не поле из тела.
    });

    logger.info('Poll created via API', {
      pollId: poll.id,
      groupId: poll.groupId,
      createdBy: user.id,
    });

    res.status(201).json({
      success: true,
      data: serializeBigInt(poll),
      message: 'Poll created successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls/create-from-webapp
   * Создание голосования из Mini App с отправкой в группу
   */
  static async createPollFromWebApp(req: Request, res: Response): Promise<void> {
    const {
      groupId,
      duration,
      selectedMenuItems,
      title,
      isMultiSelect,
      maxSelections,
    } = createPollFromWebAppBody.get(req);
    const user = await assertGroupAdmin(req, groupId);

    const result = await createPollForGroup({
      groupId,
      createdBy: user.id,
      duration,
      selectedMenuItems,
      title,
      isMultiSelect,
      maxSelections,
    });

    logger.info('Poll created from WebApp and sent to group', {
      pollId: result.pollId,
      groupId,
      createdBy: user.id,
      messageId: result.messageId,
      duration: result.duration,
    });

    res.status(201).json({
      success: true,
      data: serializeBigInt(result),
      message: 'Poll created and sent to group successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/active/:groupId
   * Активное голосование конкретной группы
   */
  static async getActivePollInGroup(req: Request, res: Response): Promise<void> {
    const { groupId } = pollGroupIdParam.get(req);
    await assertGroupMember(req, groupId);

    const poll = await PollQueryService.getActivePollInGroup(groupId);
    if (!poll) {
      /* `data: null` рядом с кодом — часть ответа, на которую смотрит фронт. */
      throw new HttpError('No active poll in this group', 404, 'NO_ACTIVE_POLL', {
        data: null,
      });
    }

    res.json({
      success: true,
      data: serializeBigInt(poll),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * PATCH /api/polls/:id/complete
   * Завершение голосования одним победителем
   */
  static async completePoll(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    const { user } = await assertPollAdmin(req, id);

    const result = await PollCompletionService.completePoll(id);

    logger.info('Poll completed via API', {
      pollId: id,
      completedBy: user.id,
      winnerItemId: result.winnerMenuItemId,
      totalVotes: result.totalVotes,
    });

    res.json({
      success: true,
      data: serializeBigInt(result),
      message: 'Poll completed successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * PATCH /api/polls/:id/cancel
   * Отмена голосования
   */
  static async cancelPoll(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    const { user } = await assertPollAdmin(req, id);

    // Причина необязательна; её тип и длину проверяет схема тела.
    const { reason } = cancelPollBody.get(req);

    const poll = await PollService.cancelPoll(
      id,
      user.id,
      reason || 'Отменено через API'
    );

    logger.info('Poll cancelled via API', { pollId: id, cancelledBy: user.id });

    res.json({
      success: true,
      data: serializeBigInt(poll),
      message: 'Poll cancelled successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls/:id/vote
   * Голос за одно блюдо
   */
  static async vote(req: Request, res: Response): Promise<void> {
    const { id: pollId } = pollIdParam.get(req);
    const { menuItemId } = voteBody.get(req);
    const { user } = await assertPollMember(req, pollId);

    const voteData: CreateVoteData = { pollId, userId: user.id, menuItemId };
    const vote = await VoteService.upsertVote(voteData);

    logger.info('Vote cast via API', {
      pollId,
      userId: user.id,
      menuItemId: vote.menuItemId,
      isUpdate: vote.updatedAt > vote.createdAt,
    });

    await PollCompletionService.completeIfQuorumReached(pollId, user.id);

    res.json({
      success: true,
      data: serializeBigInt(vote),
      message: 'Vote cast successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls/:id/vote-multiple
   * Голос за несколько блюд сразу
   */
  static async voteMultiple(req: Request, res: Response): Promise<void> {
    const { id: pollId } = pollIdParam.get(req);
    const { menuItemIds } = voteMultipleBody.get(req);
    const { user } = await assertPollMember(req, pollId);

    // Дубли убираются здесь: это не валидация, а нормализация выбора.
    const votes = await VoteService.castVotes(pollId, user.id, [
      ...new Set(menuItemIds),
    ]);

    logger.info('Multiple votes cast via API', {
      pollId,
      userId: user.id,
      itemsCount: votes.length,
      menuItemIds: votes.map(vote => vote.menuItemId),
    });

    await PollCompletionService.completeIfQuorumReached(pollId, user.id);

    res.json({
      success: true,
      data: votes.map(vote => serializeBigInt(vote)),
      message: `Successfully voted for ${votes.length} items`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * DELETE /api/polls/:id/vote
   * Снятие своего голоса
   */
  static async removeVote(req: Request, res: Response): Promise<void> {
    const { id: pollId } = pollIdParam.get(req);
    const { user } = await assertPollMember(req, pollId);

    await VoteService.removeVote(pollId, user.id);

    logger.info('Vote removed via API', { pollId, userId: user.id });

    res.json({
      success: true,
      message: 'Vote removed successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /api/polls/:id/roulette
   * Рулетка: кто идёт за заказом
   */
  static async runRoulette(req: Request, res: Response): Promise<void> {
    const { id } = pollIdParam.get(req);
    const { user } = await assertPollAdmin(req, id);

    const result = await PollService.runRoulette(id);

    logger.info('Roulette run via API', {
      pollId: id,
      runBy: user.id,
      selectedUserId: result.responsibleUserId,
    });

    res.json({
      success: true,
      data: serializeBigInt(result),
      message: 'Roulette completed successfully',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/polls/popular-items
   * Популярные блюда группы
   */
  static async getPopularItems(req: Request, res: Response): Promise<void> {
    const { groupId, limit = 10 } = popularItemsQuery.get(req);
    await assertGroupMember(req, groupId);

    const popularItems = await MenuService.getPopularMenuItems(limit, groupId);

    res.json({
      success: true,
      data: serializeBigInt(popularItems),
      count: popularItems.length,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * PATCH /api/polls/:id/complete-multi
   * Завершение с несколькими победителями (только администратор группы)
   */
  static async completePollMultiWinner(
    req: Request,
    res: Response
  ): Promise<void> {
    /* Статический импорт: тесты меняют поле в этом же объекте, а динамический
       импорт «чтобы флаг читался позже» ничего не давал — модуль всё равно
       кэшируется после первого обращения. */
    if (!FEATURES.MULTI_WINNER_VOTING) {
      throw new FeatureDisabledError('Multi-Winner Voting is currently disabled');
    }

    const { id: pollId } = pollIdParam.get(req);
    const { user } = await assertPollAdmin(req, pollId);
    const params = multiWinnerParams(req);

    const result = await PollCompletionService.completePollMultiWinner(
      pollId,
      user.id,
      params
    ).catch((error: unknown) => {
      throw withLegacyCode(error, MULTI_WINNER_LEGACY_CODES);
    });

    const resultData = parseRouletteData(result.rouletteData);

    logger.info('Poll completed with multi-winner via API', {
      pollId,
      completedBy: user.id,
      winnersCount: resultData.winners?.length || 0,
      params,
    });

    res.json({
      success: true,
      data: serializeBigInt({ pollResult: result, resultData }),
      message: 'Poll completed with multi-winner mode successfully',
      timestamp: new Date().toISOString(),
    });
  }
}

export const pollController = PollController;
