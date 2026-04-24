import express from 'express';
import { CategoryOrderController } from '../controllers/category-order.controller';
import {
  telegramAuthMiddleware,
  adminMiddleware,
} from '../middleware/telegram-auth';

const router = express.Router();

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
  CategoryOrderController.saveOrderItem
);

/**
 * DELETE /api/order-items/:id
 * Delete an OrderItem
 */
router.delete(
  '/order-items/:id',
  telegramAuthMiddleware,
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
  CategoryOrderController.finalizeCalculation
);

router.post(
  '/category-orders/:id/volunteer',
  telegramAuthMiddleware,
  CategoryOrderController.volunteerForCategory
);

/**
 * PUT /api/category-orders/:id/costs
 * Update additional costs
 */
router.put(
  '/category-orders/:id/costs',
  telegramAuthMiddleware,
  CategoryOrderController.updateCosts
);

/**
 * GET /api/order-items/:id/edit-history
 * Get edit history (admin only)
 */
router.get(
  '/order-items/:id/edit-history',
  telegramAuthMiddleware,
  adminMiddleware,
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
