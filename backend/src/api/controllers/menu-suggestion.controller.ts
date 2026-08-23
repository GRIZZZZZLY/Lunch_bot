import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/api.types';
import { MenuSuggestionService } from '../../services/menu-suggestion.service';
import { GroupAccessError, GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { collapseRepeatedValue, respondIfInvalidInput } from '../middleware/validate';
import {
  createSuggestionBody,
  rejectSuggestionBody,
  suggestionIdParam,
  suggestionsQuery,
} from '../schemas/menu-suggestion';

/**
 * Единственный разбор параметра, оставшийся в этом контроллере.
 *
 * Он не про форму значения — форму в каждом источнике проверяют контракты, — а
 * про ПОРЯДОК источников: `params`, потом `query`, потом `body`. Это правило
 * домена (фронт присылает `groupId` по-разному на разных экранах), и схема по
 * одному источнику его выразить не может.
 */
function resolveGroupId(req: AuthenticatedRequest): number | null {
  /* `collapseRepeatedValue` — не украшение: `?groupId=5&groupId=5` приходит
     массивом, а `parseInt(['5','5'])` возвращал 5 только по случайности
     (массив приводится к строке `'5,5'`). Тип здесь `unknown`, потому что три
     источника несут три разных типа: контракт тела уже привёл значение к числу,
     а query и params остаются строками. */
  const raw: unknown = collapseRepeatedValue(
    req.params?.groupId ?? req.query?.groupId ?? (req.body as { groupId?: unknown })?.groupId
  );
  if (raw === undefined || raw === null || raw === '') return null;

  const groupId = Number(raw);
  return Number.isInteger(groupId) && groupId > 0 ? groupId : null;
}

function sendSuggestionError(
  req: AuthenticatedRequest,
  res: Response,
  error: unknown,
  fallbackMessage: string
): void {
  /* Иначе невалидное тело уехало бы клиенту как 500: этот helper — общий
     выход по ошибке для четырёх handler'ов. */
  if (respondIfInvalidInput(req, res, error)) return;

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

    /* Обязательность name и groupId, обрезка пробелов и разбор price — в
       схеме. Здесь остаётся только вызов сервиса. */
    const { name, description, price, imageUrl, groupId } =
      createSuggestionBody.get(req);

    const suggestion = await MenuSuggestionService.createSuggestion({
      name,
      description,
      price,
      imageUrl,
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
    if (respondIfInvalidInput(req, res, error)) return;
    sendSuggestionError(req, res, error, 'Failed to create suggestion');
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
    const { status, limit, offset, groupId } = suggestionsQuery.get(req);
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
      filters.status = status;
    }

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

    if (limit !== undefined) {
      filters.limit = limit;
    }

    if (offset !== undefined) {
      filters.offset = offset;
    }

    const suggestions = await MenuSuggestionService.getSuggestions(filters);

    res.json({
      success: true,
      data: suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
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
    const { id } = suggestionIdParam.get(req);
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

    const suggestion = await MenuSuggestionService.getSuggestionById(id);

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
    if (respondIfInvalidInput(req, res, error)) return;
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
    const { id } = suggestionIdParam.get(req);
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
      id,
      userId,
      groupId
    );

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(req, res, error, 'Failed to approve suggestion');
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
    const { id } = suggestionIdParam.get(req);
    const { reason } = rejectSuggestionBody.get(req);
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
      id,
      userId,
      reason,
      groupId
    );

    res.json({
      success: true,
      data: suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(req, res, error, 'Failed to reject suggestion');
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
    if (respondIfInvalidInput(req, res, error)) return;
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
    if (respondIfInvalidInput(req, res, error)) return;
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
    const { id } = suggestionIdParam.get(req);
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

    await MenuSuggestionService.deleteSuggestion(id, userId, groupId);

    res.status(200).json({
      success: true,
      message: 'Suggestion deleted',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    sendSuggestionError(req, res, error, 'Failed to delete suggestion');
  }
}
