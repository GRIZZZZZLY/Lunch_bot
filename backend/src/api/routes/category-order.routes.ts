import express from 'express';
import { CategoryOrderController } from '../controllers/category-order.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import {
  requireCategoryOrderParticipant,
  requireCategoryOrderPollAccess,
  requireCategoryOrderResponsible,
  requireOrderItemGroupAdmin,
  requirePollAccess,
} from '../middleware/authorization';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { writeLimiter } from '../middleware/rate-limiter';

/**
 * Порядок middleware здесь не косметический: все проверки авторизации читают
 * `req.user`, поэтому обязаны стоять ПОСЛЕ `telegramAuthMiddleware`.
 *
 * Соответствие «маршрут → правило» взято из матрицы авторизации
 * (`tech_debt/04-auth-matrix.md`), а не подобрано по смыслу пути. Два места
 * намеренно оставлены в контроллере, и это записано у них в комментариях:
 *
 * - `DELETE /order-items/:id` — здесь `:id` это ПОЗИЦИЯ, а не категорийный
 *   заказ; middleware по `:id` проверял бы не ту сущность;
 * - проверка «позицию можно создать только участнику категории» в
 *   `saveOrderItem` — она про пользователя из ТЕЛА запроса, а не про
 *   вызывающего, и в middleware разобранного тела ещё нет.
 */
const router = express.Router();
const categoryOrderMutationIdempotency = createIdempotencyMiddleware({
  scope: 'category-order',
  required: true,
});

/**
 * GET /api/polls/:pollId/category-orders
 * Get all CategoryOrders for a poll
 */
router.get(
  '/polls/:pollId/category-orders',
  telegramAuthMiddleware,
  requirePollAccess,
  CategoryOrderController.getCategoryOrdersForPoll
);

router.get(
  '/polls/:pollId/category-orders/my',
  telegramAuthMiddleware,
  requirePollAccess,
  CategoryOrderController.getMyCategoryOrdersForPoll
);

/**
 * GET /api/category-orders/:id
 * Get a single CategoryOrder by ID
 */
router.get(
  '/category-orders/:id',
  telegramAuthMiddleware,
  requireCategoryOrderParticipant,
  CategoryOrderController.getCategoryOrder
);

/**
 * POST /api/category-orders/:id/order-items
 * Save or update an OrderItem (autosave)
 */
router.post(
  '/category-orders/:id/order-items',
  telegramAuthMiddleware,
  writeLimiter,
  requireCategoryOrderResponsible(
    'Only responsible user can edit order items'
  ),
  categoryOrderMutationIdempotency,
  CategoryOrderController.saveOrderItem
);

/**
 * DELETE /api/order-items/:id
 * Delete an OrderItem
 */
router.delete(
  '/order-items/:id',
  telegramAuthMiddleware,
  writeLimiter,
  categoryOrderMutationIdempotency,
  CategoryOrderController.deleteOrderItem
);

/**
 * GET /api/category-orders/:id/progress
 * Get calculation progress
 */
router.get(
  '/category-orders/:id/progress',
  telegramAuthMiddleware,
  requireCategoryOrderParticipant,
  CategoryOrderController.getProgress
);

/**
 * GET /api/category-orders/:id/participants
 * Get participants (users who voted for this category)
 */
router.get(
  '/category-orders/:id/participants',
  telegramAuthMiddleware,
  requireCategoryOrderResponsible(),
  CategoryOrderController.getParticipants
);

/**
 * POST /api/category-orders/:id/finalize
 * Finalize calculation and create transactions
 */
router.post(
  '/category-orders/:id/finalize',
  telegramAuthMiddleware,
  writeLimiter,
  requireCategoryOrderResponsible(
    'Only responsible user can finalize calculation'
  ),
  categoryOrderMutationIdempotency,
  CategoryOrderController.finalizeCalculation
);

router.post(
  '/category-orders/:id/volunteer',
  telegramAuthMiddleware,
  writeLimiter,
  requireCategoryOrderPollAccess,
  categoryOrderMutationIdempotency,
  CategoryOrderController.volunteerForCategory
);

/**
 * PUT /api/category-orders/:id/costs
 * Update additional costs
 */
router.put(
  '/category-orders/:id/costs',
  telegramAuthMiddleware,
  writeLimiter,
  requireCategoryOrderResponsible(
    'Only responsible user can update costs'
  ),
  categoryOrderMutationIdempotency,
  CategoryOrderController.updateCosts
);

/**
 * GET /api/order-items/:id/edit-history
 *
 * История правок позиции — данные группы, поэтому право даёт роль в группе.
 * Но группа берётся ИЗ САМОЙ ПОЗИЦИИ, а не из запроса: прежний
 * `requireGroupAdmin` читал `groupId` из query и никак не связывал его с
 * ресурсом, поэтому администратор своей группы получал историю правок чужой,
 * прислав её `orderItemId` со своим `groupId`.
 */
router.get(
  '/order-items/:id/edit-history',
  telegramAuthMiddleware,
  requireOrderItemGroupAdmin,
  CategoryOrderController.getEditHistory
);

/**
 * GET /api/category-orders/:id/order-items
 * Get all OrderItems for a CategoryOrder
 */
router.get(
  '/category-orders/:id/order-items',
  telegramAuthMiddleware,
  requireCategoryOrderResponsible(),
  CategoryOrderController.getOrderItems
);

export default router;
