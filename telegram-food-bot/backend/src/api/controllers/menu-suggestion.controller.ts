import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { MenuSuggestionService } from '../../services/menu-suggestion.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

/**
 * Создать новое предложение блюда
 */
export async function createSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, description, price, imageUrl, groupId: rawGroupId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Название блюда обязательно',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const groupId = rawGroupId ? parseInt(String(rawGroupId), 10) : NaN;
    if (!rawGroupId || isNaN(groupId)) {
      res.status(400).json({
        success: false,
        error: 'groupId обязателен',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestion = await MenuSuggestionService.createSuggestion({
      name: name.trim(),
      description: description?.trim(),
      price: price ? parseFloat(price) : undefined,
      imageUrl: imageUrl?.trim(),
      suggestedBy: userId,
      groupId,
    });

    logger.info(`Suggestion created by user ${userId}: ${suggestion.id}`);

    res.status(201).json({
      success: true,
      data: suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error creating suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create suggestion',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Получить все предложения (с фильтрами)
 */
export async function getSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, limit, offset, groupId: rawGroupId } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Обычные пользователи видят только свои предложения
    const filters: any = {};

    if (status) {
      filters.status = status as string;
    }

    if (!isAdmin) {
      filters.suggestedBy = userId;
    }

    // groupId опционален: если передан — фильтруем по группе; без него админ видит все группы
    if (rawGroupId) {
      const parsedGroupId = parseInt(rawGroupId as string, 10);
      if (!isNaN(parsedGroupId)) {
        filters.groupId = parsedGroupId;
      }
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    if (offset) {
      filters.offset = parseInt(offset as string);
    }

    const suggestions = await MenuSuggestionService.getSuggestions(filters);

    res.json({
      success: true,
      data: suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Получить предложение по ID
 */
export async function getSuggestionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestion = await MenuSuggestionService.getSuggestionById(
      parseInt(id, 10)
    );

    if (!suggestion) {
      res.status(404).json({
        success: false,
        error: 'Suggestion not found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Обычные пользователи видят только свои предложения
    if (!isAdmin && suggestion.suggestedBy !== userId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting suggestion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestion',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Одобрить предложение (только админ)
 */
export async function approveSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only admins can approve suggestions',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await MenuSuggestionService.approveSuggestion(
      parseInt(id, 10),
      userId
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error approving suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve suggestion',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Отклонить предложение (только админ)
 */
export async function rejectSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const { reason } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only admins can reject suggestions',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestion = await MenuSuggestionService.rejectSuggestion(
      parseInt(id, 10),
      userId,
      reason
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json({
      success: true,
      data: suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject suggestion',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Получить статистику предложений (только админ)
 */
export async function getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only admins can view stats',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const stats = await MenuSuggestionService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Получить количество ожидающих предложений (только админ)
 */
export async function getPendingCount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only admins can view pending count',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const count = await MenuSuggestionService.getPendingCount();

    res.json({
      success: true,
      data: { count },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting pending count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending count',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Удалить предложение (только админ, только отклонённые)
 */
export async function deleteSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only admins can delete suggestions',
        code: 'FORBIDDEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await MenuSuggestionService.deleteSuggestion(parseInt(id, 10));

    res.status(200).json({
      success: true,
      message: 'Suggestion deleted',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error deleting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete suggestion',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}
