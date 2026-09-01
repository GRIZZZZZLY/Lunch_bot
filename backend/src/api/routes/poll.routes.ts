import express from 'express';
import { pollController } from '../controllers/poll.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { requireGroupAdminOverUser } from '../middleware/authorization';
import {
  voteLimiter,
  pollCreationLimiter,
  heavyOperationLimiter,
} from '../middleware/rate-limiter';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
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

/**
 * Порядок валидации в цепочке — не вопрос вкуса:
 *
 * - контракты `params`/`query` идут СРАЗУ после аутентификации, потому что
 *   middleware авторизации ниже сами читают `req.params` и с `NaN` пошли бы в
 *   базу за несуществующим ресурсом;
 * - контракт `body` идёт ПОСЛЕ идемпотентности: ключ считается по исходному
 *   телу, и если валидация переписала бы тело раньше, повтор с другим телом
 *   попал бы в тот же слот.
 *
 * Валидируется то, что контроллер действительно читает. `query` без контракта
 * на маршруте означает «контроллер не читает query», а не «забыли».
 */
const router = express.Router();
const pollMutationIdempotency = createIdempotencyMiddleware({
  scope: 'poll',
  required: true,
});
const pollVoteIdempotency = createIdempotencyMiddleware({
  scope: 'poll-vote',
  required: true,
});

/**
 * GET /api/polls
 * Получение всех голосований с фильтрацией
 */
router.get(
  '/',
  telegramAuthMiddleware,
  pollHistoryQuery.middleware,
  pollController.getPollHistory
);

/**
 * GET /api/polls/active
 * Получение активных голосований
 */
router.get('/active', telegramAuthMiddleware, pollController.getActivePolls);

/**
 * GET /api/polls/history
 * Получение истории голосований
 */
router.get(
  '/history',
  telegramAuthMiddleware,
  pollHistoryQuery.middleware,
  pollController.getPollHistory
);

/**
 * GET /api/polls/stats
 * Получение статистики голосований
 */
router.get(
  '/stats',
  telegramAuthMiddleware,
  pollGroupQuery.middleware,
  heavyOperationLimiter,
  pollController.getPollStats
);

/**
 * GET /api/polls/user-stats/my
 * Получение статистики текущего пользователя
 */
router.get(
  '/user-stats/my',
  telegramAuthMiddleware,
  pollController.getUserStats
);

/**
 * GET /api/polls/user-stats/:userId
 * Получение статистики конкретного пользователя (только админы)
 */
/* Статистика чужого человека — данные его группы, поэтому право на неё даёт
   роль в группе. Проверяются ДВА условия: вызывающий администрирует группу И
   целевой пользователь в ней состоит. Прежний `requireGroupAdmin` проверял
   только первое, поэтому администратор любой группы получал статистику любого
   пользователя, прислав свой `groupId`. */
router.get(
  '/user-stats/:userId',
  telegramAuthMiddleware,
  pollUserIdParam.middleware,
  requireGroupAdminOverUser,
  pollController.getUserStatsByUserId
);

/**
 * GET /api/polls/popular-items
 * Получение популярных блюд
 */
router.get(
  '/popular-items',
  telegramAuthMiddleware,
  popularItemsQuery.middleware,
  pollController.getPopularItems
);

/**
 * GET /api/polls/last-completed
 * Получение последнего завершённого голосования
 * Используется для функции "Повторить вчерашнее"
 */
router.get(
  '/last-completed',
  telegramAuthMiddleware,
  pollGroupQuery.middleware,
  pollController.getLastCompleted
);

/**
 * GET /api/polls/today-completed/:groupId
 * Получение последнего завершённого голосования сегодня в группе
 */
router.get(
  '/today-completed/:groupId',
  telegramAuthMiddleware,
  pollGroupIdParam.middleware,
  pollController.getTodayCompletedPoll
);

/**
 * POST /api/polls/repeat/:id
 * Повторить голосование (создать копию с теми же параметрами)
 * Доступно только для админов
 */
router.post(
  '/repeat/:id',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollMutationIdempotency,
  pollController.repeatPoll
);

/**
 * GET /api/polls/:id
 * Получение информации о голосовании
 */
router.get(
  '/:id',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollController.getPollById
);

/**
 * GET /api/polls/:id/results
 * Получение результатов голосования
 */
router.get(
  '/:id/results',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollController.getPollResults
);

/**
 * GET /api/polls/:id/votes
 * Получение голосов по голосованию
 */
router.get(
  '/:id/votes',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollController.getPollVotes
);

/**
 * GET /api/polls/:id/my-votes
 * Свои голоса в голосовании (Mini App отмечает ими выбранную строку)
 */
router.get(
  '/:id/my-votes',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollController.getMyVotes
);

/**
 * POST /api/polls
 * Создание нового голосования (только админы)
 */
router.post(
  '/',
  telegramAuthMiddleware,
  pollCreationLimiter,
  pollMutationIdempotency,
  createPollBody.middleware,
  pollController.createPoll
);

/**
 * POST /api/polls/create-from-webapp
 * Создание голосования из Mini App с отправкой в группу
 */
router.post(
  '/create-from-webapp',
  telegramAuthMiddleware,
  pollCreationLimiter,
  pollMutationIdempotency,
  createPollFromWebAppBody.middleware,
  pollController.createPollFromWebApp
);

/**
 * GET /api/polls/active/:groupId
 * Получение активного голосования в группе
 */
router.get(
  '/active/:groupId',
  telegramAuthMiddleware,
  pollGroupIdParam.middleware,
  pollController.getActivePollInGroup
);

/**
 * PATCH /api/polls/:id/complete
 * Завершение голосования (только админы)
 */
router.patch(
  '/:id/complete',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollMutationIdempotency,
  pollController.completePoll
);

/**
 * PATCH /api/polls/:id/complete-multi
 * Завершение голосования с множественными победителями (только админы)
 */
router.patch(
  '/:id/complete-multi',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollMutationIdempotency,
  completeMultiWinnerBody.middleware,
  pollController.completePollMultiWinner
);

/**
 * PATCH /api/polls/:id/cancel
 * Отмена голосования (только админы)
 */
router.patch(
  '/:id/cancel',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollMutationIdempotency,
  cancelPollBody.middleware,
  pollController.cancelPoll
);

/**
 * POST /api/polls/:id/vote
 * Голосование за блюдо
 */
router.post(
  '/:id/vote',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  voteLimiter,
  pollVoteIdempotency,
  voteBody.middleware,
  pollController.vote
);

/**
 * POST /api/polls/:id/vote-multiple
 * Голосование за несколько блюд одновременно (множественный выбор)
 */
router.post(
  '/:id/vote-multiple',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  voteLimiter,
  pollVoteIdempotency,
  voteMultipleBody.middleware,
  pollController.voteMultiple
);

/**
 * DELETE /api/polls/:id/vote
 * Отмена голоса
 */
router.delete(
  '/:id/vote',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollVoteIdempotency,
  pollController.removeVote
);

/**
 * POST /api/polls/:id/roulette
 * Запуск рулетки для выбора ответственного (только админы)
 */
router.post(
  '/:id/roulette',
  telegramAuthMiddleware,
  pollIdParam.middleware,
  pollMutationIdempotency,
  pollController.runRoulette
);

export default router;
