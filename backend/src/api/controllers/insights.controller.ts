/**
 * Insights Controller - Budget Analytics
 * Sprint 6: Вариант 2 (Оптимальный)
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { InsightsService } from '../../services/insights.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

/**
 * GET /api/insights/budget
 * Получить аналитику бюджета для текущего пользователя
 */
export async function getBudgetInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const insights = await InsightsService.getBudgetInsights(userId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    logger.error('Error getting budget insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get budget insights',
    });
  }
}

/**
 * GET /api/insights/budget/:userId
 * Получить аналитику бюджета для конкретного пользователя (admin или сам пользователь)
 */
export async function getBudgetInsightsByUserId(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const requestingUserId = req.user?.id;
    const targetUserId = parseInt(getParam(req.params, 'userId'), 10);

    if (!requestingUserId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(targetUserId)) {
      res.status(400).json({ success: false, error: 'Invalid user ID' });
      return;
    }

    // Проверяем права доступа (только сам пользователь или админ)
    if (requestingUserId !== targetUserId && !req.user?.isAdmin) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const insights = await InsightsService.getBudgetInsights(targetUserId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    logger.error('Error getting budget insights by user ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get budget insights',
    });
  }
}

/**
 * GET /api/insights/categories
 * Получить статистику по категориям блюд
 */
export async function getCategoryInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const insights = await InsightsService.getCategoryInsights(userId);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    logger.error('Error getting category insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category insights',
    });
  }
}
