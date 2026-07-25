import { Router } from 'express';
import * as recurringPollController from '../controllers/recurring-poll.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { writeLimiter } from '../middleware/rate-limiter';

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
router.get('/:groupId', recurringPollController.getGroupSchedule);

/**
 * POST /api/recurring
 * Создание нового расписания
 */
router.post(
  '/',
  writeLimiter,
  recurringMutationIdempotency,
  recurringPollController.createSchedule
);

/**
 * PATCH /api/recurring/:id
 * Обновление расписания
 */
router.patch(
  '/:id',
  writeLimiter,
  recurringMutationIdempotency,
  recurringPollController.updateSchedule
);

/**
 * DELETE /api/recurring/:id
 * Удаление расписания
 */
router.delete(
  '/:id',
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
  writeLimiter,
  recurringMutationIdempotency,
  recurringPollController.toggleSchedule
);

/**
 * GET /api/recurring/:groupId/history
 * Получение истории запусков
 */
router.get('/:groupId/history', recurringPollController.getExecutionHistory);

export default router;
