import express from 'express';
import { pollController } from '../controllers/poll.controller';
import { telegramAuthMiddleware, adminMiddleware } from '../middleware/telegram-auth';

const router = express.Router();

/**
 * GET /api/polls
 * Получение всех голосований с фильтрацией
 */
router.get('/', telegramAuthMiddleware, pollController.getPollHistory);

/**
 * GET /api/polls/active
 * Получение активных голосований
 */
router.get('/active', telegramAuthMiddleware, pollController.getActivePolls);

/**
 * GET /api/polls/history
 * Получение истории голосований
 */
router.get('/history', telegramAuthMiddleware, pollController.getPollHistory);

/**
 * GET /api/polls/stats
 * Получение статистики голосований
 */
router.get('/stats', telegramAuthMiddleware, pollController.getPollStats);

/**
 * GET /api/polls/user-stats/my
 * Получение статистики текущего пользователя
 */
router.get('/user-stats/my', telegramAuthMiddleware, pollController.getUserStats);

/**
 * GET /api/polls/user-stats/:userId
 * Получение статистики конкретного пользователя (только админы)
 */
router.get('/user-stats/:userId', telegramAuthMiddleware, adminMiddleware, pollController.getUserStatsByUserId);

/**
 * GET /api/polls/popular-items
 * Получение популярных блюд
 */
router.get('/popular-items', telegramAuthMiddleware, pollController.getPopularItems);

/**
 * GET /api/polls/last-completed
 * Получение последнего завершённого голосования
 * Используется для функции "Повторить вчерашнее"
 */
router.get('/last-completed', telegramAuthMiddleware, pollController.getLastCompleted);

/**
 * POST /api/polls/repeat/:id
 * Повторить голосование (создать копию с теми же параметрами)
 * Доступно только для админов
 */
router.post('/repeat/:id', telegramAuthMiddleware, adminMiddleware, pollController.repeatPoll);

/**
 * GET /api/polls/:id
 * Получение информации о голосовании
 */
router.get('/:id', telegramAuthMiddleware, pollController.getPollById);

/**
 * GET /api/polls/:id/results
 * Получение результатов голосования
 */
router.get('/:id/results', telegramAuthMiddleware, pollController.getPollResults);

/**
 * GET /api/polls/:id/votes
 * Получение голосов по голосованию
 */
router.get('/:id/votes', telegramAuthMiddleware, pollController.getPollVotes);

/**
 * POST /api/polls
 * Создание нового голосования (только админы)
 */
router.post(
  '/',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.createPoll
);

/**
 * POST /api/polls/create-from-webapp
 * Создание голосования из Mini App с отправкой в группу
 */
router.post(
  '/create-from-webapp',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.createPollFromWebApp
);

/**
 * GET /api/polls/active/:groupId
 * Получение активного голосования в группе
 */
router.get(
  '/active/:groupId',
  telegramAuthMiddleware,
  pollController.getActivePollInGroup
);

/**
 * PATCH /api/polls/:id/complete
 * Завершение голосования (только админы)
 */
router.patch(
  '/:id/complete',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.completePoll
);

/**
 * PATCH /api/polls/:id/complete-multi
 * Завершение голосования с множественными победителями (только админы)
 */
router.patch(
  '/:id/complete-multi',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.completePollMultiWinner
);

/**
 * PATCH /api/polls/:id/cancel
 * Отмена голосования (только админы)
 */
router.patch(
  '/:id/cancel',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.cancelPoll
);

/**
 * POST /api/polls/:id/vote
 * Голосование за блюдо
 */
router.post(
  '/:id/vote',
  telegramAuthMiddleware,
  pollController.vote
);

/**
 * DELETE /api/polls/:id/vote
 * Отмена голоса
 */
router.delete(
  '/:id/vote',
  telegramAuthMiddleware,
  pollController.removeVote
);

/**
 * POST /api/polls/:id/roulette
 * Запуск рулетки для выбора ответственного (только админы)
 */
router.post(
  '/:id/roulette',
  telegramAuthMiddleware,
  adminMiddleware,
  pollController.runRoulette
);

export default router;
