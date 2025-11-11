/**
 * Insights Routes - Budget Analytics
 * Sprint 6: Вариант 2 (Оптимальный)
 */

import { Router } from 'express';
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import {
  getBudgetInsights,
  getBudgetInsightsByUserId,
  getCategoryInsights,
} from '../controllers/insights.controller';

const router = Router();

// Все routes защищены Telegram authentication
router.use(telegramAuthMiddleware);

/**
 * GET /api/insights/budget
 * Получить аналитику бюджета для текущего пользователя
 */
router.get('/budget', getBudgetInsights);

/**
 * GET /api/insights/budget/:userId
 * Получить аналитику бюджета для конкретного пользователя
 * Access: сам пользователь или админ
 */
router.get('/budget/:userId', getBudgetInsightsByUserId);

/**
 * GET /api/insights/categories
 * Получить статистику по категориям блюд
 */
router.get('/categories', getCategoryInsights);

export default router;
