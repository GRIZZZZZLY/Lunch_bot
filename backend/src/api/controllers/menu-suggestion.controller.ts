import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { MenuSuggestionService } from '../../services/menu-suggestion.service';
import { GroupAccessError, GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

function resolveGroupId(req: AuthenticatedRequest): number | null {
  const raw = (req.params?.groupId ??
    req.query?.groupId ??
    req.body?.groupId) as string | number | undefined;
  const groupId = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof groupId === 'number' && Number.isFinite(groupId) && groupId > 0
    ? groupId
    : null;
}

function sendSuggestionError(
  res: Response,
  error: unknown,
  fallbackMessage: string
): void {
  if (error instanceof GroupAccessError) {
    res.status(403).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.error(fallbackMessage, error);
  res.status(500).json({
    success: false,
    error: fallbackMessage,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Создать новое предложение блюда
 */
export async function createSuggestion(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      name,
      description,
      price,
      imageUrl,
      groupId: rawGroupId,
    } = req.body;
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
    sendSuggestionError(res, error, 'Failed to create suggestion');
  }
}

/**
 * Получить все предложения (с фильтрами)
 */
export async function getSuggestions(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { status, limit, offset, groupId: rawGroupId } = req.query;
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

    const filters: any = {};

    if (status) {
      filters.status = status as string;
    }

    const parsedGroupId = rawGroupId ? parseInt(rawGroupId as string, 10) : NaN;
    const groupId = Number.isFinite(parsedGroupId) && parsedGroupId > 0 ? parsedGroupId : null;

    /* Чужие предложения видит админ ГРУППЫ — тем же правилом, что approve и
       reject, и тем же, по которому интерфейс рисует кнопки модерации.
       Глобальный users.is_admin здесь не при чём: по нему админ группы получал
       только свои предложения и пустую очередь, а глобальный админ без роли —
       чужие предложения из всех групп сразу.
       Без groupId группу не с чем сверить, поэтому отдаём только свои. */
    if (groupId) {
      filters.groupId = groupId;
      const moderates = await GroupService.isUserGroupAdmin(userId, groupId);
      if (!moderates) {
        filters.suggestedBy = userId;
      }
    } else {
      filters.suggestedBy = userId;
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
export async function getSuggestionById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
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

    /* Раньше здесь пускал глобальный флаг users.is_admin, тогда как список
       предложений (getSuggestions) уже спрашивал роль в группе. Две системы
       прав на одном ресурсе расходились молча: администратор группы без
       глобального флага видел очередь модерации, но получал 403 на любом чужом
       предложении, а глобальный администратор без членства читал предложения
       ЛЮБОЙ группы — groupId в этом пути не проверялся вовсе.
       Теперь источник один: своё предложение или роль администратора в группе
       этого предложения. */
    const moderates = await GroupService.isUserGroupAdmin(
      userId,
      suggestion.groupId
    );

    if (!moderates && suggestion.suggestedBy !== userId) {
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
export async function approveSuggestion(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const userId = req.user?.id;
    const groupId = resolveGroupId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await MenuSuggestionService.approveSuggestion(
      parseInt(id, 10),
      userId,
      groupId
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(res, error, 'Failed to approve suggestion');
  }
}

/**
 * Отклонить предложение (только админ)
 */
export async function rejectSuggestion(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const { reason } = req.body;
    const userId = req.user?.id;
    const groupId = resolveGroupId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestion = await MenuSuggestionService.rejectSuggestion(
      parseInt(id, 10),
      userId,
      reason,
      groupId
    );

    // Отправить уведомление пользователю (опционально через бота)
    // TODO: Integrate with notification service

    res.json({
      success: true,
      data: suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(res, error, 'Failed to reject suggestion');
  }
}

/**
 * Получить статистику предложений (только админ)
 */
export async function getStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const groupId = resolveGroupId(req);

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const stats = await MenuSuggestionService.getStats(groupId);

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
export async function getPendingCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const groupId = resolveGroupId(req);

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const count = await MenuSuggestionService.getPendingCount(groupId);

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
export async function deleteSuggestion(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const id = getParam(req.params, 'id');
    const userId = req.user?.id;
    const groupId = resolveGroupId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: 'groupId is required',
        code: 'MISSING_GROUP_ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await MenuSuggestionService.deleteSuggestion(parseInt(id, 10), userId, groupId);

    res.status(200).json({
      success: true,
      message: 'Suggestion deleted',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(res, error, 'Failed to delete suggestion');
  }
}
