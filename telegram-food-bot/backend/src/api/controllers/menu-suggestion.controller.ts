import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { MenuSuggestionService } from '../../services/menu-suggestion.service';
import { logger } from '../../utils/logger';

/**
 * Создать новое предложение блюда
 */
export async function createSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, description, price, category, imageUrl } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Название блюда обязательно' });
      return;
    }

    const suggestion = await MenuSuggestionService.createSuggestion({
      name: name.trim(),
      description: description?.trim(),
      price: price ? parseFloat(price) : undefined,
      category: category?.trim(),
      imageUrl: imageUrl?.trim(),
      suggestedBy: userId,
    });

    logger.info(`Suggestion created by user ${userId}: ${suggestion.id}`);

    res.status(201).json(suggestion);
  } catch (error) {
    logger.error('Error creating suggestion:', error);
    res.status(500).json({ error: 'Failed to create suggestion' });
  }
}

/**
 * Получить все предложения (с фильтрами)
 */
export async function getSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, limit, offset } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    // Обычные пользователи видят только свои предложения
    const filters: any = {};

    if (status) {
      filters.status = status as string;
    }

    if (!isAdmin) {
      filters.suggestedBy = userId;
    }

    if (limit) {
      filters.limit = parseInt(limit as string);
    }

    if (offset) {
      filters.offset = parseInt(offset as string);
    }

    const suggestions = await MenuSuggestionService.getSuggestions(filters);

    res.json(suggestions);
  } catch (error) {
    logger.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
}

/**
 * Получить предложение по ID
 */
export async function getSuggestionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const suggestion = await MenuSuggestionService.getSuggestionById(
      parseInt(id)
    );

    if (!suggestion) {
      res.status(404).json({ error: 'Suggestion not found' });
      return;
    }

    // Обычные пользователи видят только свои предложения
    if (!isAdmin && suggestion.suggestedBy !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(suggestion);
  } catch (error) {
    logger.error('Error getting suggestion:', error);
    res.status(500).json({ error: 'Failed to get suggestion' });
  }
}

/**
 * Одобрить предложение (только админ)
 */
export async function approveSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can approve suggestions' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await MenuSuggestionService.approveSuggestion(
      parseInt(id),
      userId
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json(result);
  } catch (error: any) {
    logger.error('Error approving suggestion:', error);
    res.status(500).json({ error: error.message || 'Failed to approve suggestion' });
  }
}

/**
 * Отклонить предложение (только админ)
 */
export async function rejectSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can reject suggestions' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const suggestion = await MenuSuggestionService.rejectSuggestion(
      parseInt(id),
      userId,
      reason
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json(suggestion);
  } catch (error: any) {
    logger.error('Error rejecting suggestion:', error);
    res.status(500).json({ error: error.message || 'Failed to reject suggestion' });
  }
}

/**
 * Получить статистику предложений (только админ)
 */
export async function getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can view stats' });
      return;
    }

    const stats = await MenuSuggestionService.getStats();

    res.json(stats);
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}

/**
 * Получить количество ожидающих предложений (только админ)
 */
export async function getPendingCount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can view pending count' });
      return;
    }

    const count = await MenuSuggestionService.getPendingCount();

    res.json({ count });
  } catch (error) {
    logger.error('Error getting pending count:', error);
    res.status(500).json({ error: 'Failed to get pending count' });
  }
}

/**
 * Удалить предложение (только админ, только отклонённые)
 */
export async function deleteSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.isAdmin;

    if (!isAdmin) {
      res.status(403).json({ error: 'Only admins can delete suggestions' });
      return;
    }

    await MenuSuggestionService.deleteSuggestion(parseInt(id));

    res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting suggestion:', error);
    res.status(500).json({ error: error.message || 'Failed to delete suggestion' });
  }
}
