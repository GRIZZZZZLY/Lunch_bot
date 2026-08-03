import express from 'express';
import { CategoryOrderController } from '../controllers/category-order.controller';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { groupAdminMiddleware } from '../middleware/group-admin';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { writeLimiter } from '../middleware/rate-limiter';

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
  CategoryOrderController.getCategoryOrdersForPoll
);

router.get(
  '/polls/:pollId/category-orders/my',
  telegramAuthMiddleware,
  CategoryOrderController.getMyCategoryOrdersForPoll
);

/**
 * GET /api/category-orders/:id
 * Get a single CategoryOrder by ID
 */
router.get(
  '/category-orders/:id',
  telegramAuthMiddleware,
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
  CategoryOrderController.getProgress
);

/**
 * GET /api/category-orders/:id/participants
 * Get participants (users who voted for this category)
 */
router.get(
  '/category-orders/:id/participants',
  telegramAuthMiddleware,
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
  categoryOrderMutationIdempotency,
  CategoryOrderController.finalizeCalculation
);

router.post(
  '/category-orders/:id/volunteer',
  telegramAuthMiddleware,
  writeLimiter,
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
  categoryOrderMutationIdempotency,
  CategoryOrderController.updateCosts
);

/**
 * GET /api/order-items/:id/edit-history
 * История правок позиции: данные группы, поэтому право даёт роль в группе.
 * groupAdminMiddleware ждёт groupId в params, query или теле запроса.
 */
router.get(
  '/order-items/:id/edit-history',
  telegramAuthMiddleware,
  groupAdminMiddleware,
  CategoryOrderController.getEditHistory
);

/**
 * GET /api/category-orders/:id/order-items
 * Get all OrderItems for a CategoryOrder
 */
router.get(
  '/category-orders/:id/order-items',
  telegramAuthMiddleware,
  CategoryOrderController.getOrderItems
);

export default router;
