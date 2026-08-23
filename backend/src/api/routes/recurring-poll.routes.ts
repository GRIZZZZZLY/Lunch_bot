import { Router } from 'express';
import * as recurringPollController from '../controllers/recurring-poll.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { writeLimiter } from '../middleware/rate-limiter';
import {
  createScheduleBody,
  recurringGroupIdParam,
  recurringHistoryQuery,
  recurringScheduleIdParam,
  toggleScheduleBody,
  updateScheduleBody,
} from '../schemas/recurring-poll';

const router = Router();
const recurringMutationIdempotency = createIdempotencyMiddleware({
  scope: 'recurring-poll',
  required: true,
});

// Все маршруты требуют аутентификации через Telegram
router.use(telegramAuthMiddleware);

/**
 * GET /api/recurring/:groupId
 * Получение расписания группы
 */
router.get(
  '/:groupId',
  recurringGroupIdParam.middleware,
  recurringPollController.getGroupSchedule
);

/**
 * POST /api/recurring
 * Создание нового расписания
 */
router.post(
  '/',
  writeLimiter,
  recurringMutationIdempotency,
  createScheduleBody.middleware,
  recurringPollController.createSchedule
);

/**
 * PATCH /api/recurring/:id
 * Обновление расписания
 */
router.patch(
  '/:id',
  recurringScheduleIdParam.middleware,
  writeLimiter,
  recurringMutationIdempotency,
  updateScheduleBody.middleware,
  recurringPollController.updateSchedule
);

/**
 * DELETE /api/recurring/:id
 * Удаление расписания
 */
router.delete(
  '/:id',
  recurringScheduleIdParam.middleware,
  writeLimiter,
  recurringMutationIdempotency,
  recurringPollController.deleteSchedule
);

/**
 * PATCH /api/recurring/:id/toggle
 * Включение/выключение расписания
 */
router.patch(
  '/:id/toggle',
  recurringScheduleIdParam.middleware,
  writeLimiter,
  recurringMutationIdempotency,
  toggleScheduleBody.middleware,
  recurringPollController.toggleSchedule
);

/**
 * GET /api/recurring/:groupId/history
 * Получение истории запусков
 */
router.get(
  '/:groupId/history',
  recurringGroupIdParam.middleware,
  recurringHistoryQuery.middleware,
  recurringPollController.getExecutionHistory
);

export default router;
