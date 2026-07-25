import { Request, Response } from 'express';
import { z } from 'zod';
import { VoteService } from '../../services/vote.service';
import { PollService } from '../../services/poll.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

/**
 * Vote Controller
 * Обработка голосований с поддержкой множественного выбора
 * Sprint 1: Добавлена Zod валидация
 */

// Zod схемы валидации
const CreateMultipleVotesSchema = z.object({
  pollId: z.number().int().positive('pollId must be a positive integer'),
  menuItemIds: z.array(z.number().int().positive()).min(0).max(20, 'Maximum 20 items allowed'),
});

const DeleteVoteParamsSchema = z.object({
  pollId: z.string().regex(/^\d+$/, 'pollId must be numeric').transform(Number),
  menuItemId: z.string().regex(/^\d+$/, 'menuItemId must be numeric').transform(Number),
});

const PollIdParamsSchema = z.object({
  pollId: z.string().regex(/^\d+$/, 'pollId must be numeric').transform(Number),
});

async function requirePollAccess(req: Request, res: Response, pollId: number): Promise<boolean> {
  const user = req.user as { id?: number; isAdmin?: boolean } | undefined;

  if (!user?.id) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  const pollGroupId = await PollService.getPollGroupId(pollId);
  if (!pollGroupId) {
    res.status(404).json({
      success: false,
      error: 'Poll not found',
      code: 'POLL_NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  if (user.isAdmin) {
    return true;
  }

  const hasAccess = await GroupService.isUserGroupMember(user.id, pollGroupId);
  if (!hasAccess) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  return true;
}

/**
 * POST /api/votes/multiple
 * Создать/обновить голоса (множественный выбор)
 * Body: { pollId, menuItemIds: number[] }
 */
export async function createMultipleVotes(req: Request, res: Response): Promise<void> {
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

    // Валидация входных данных с Zod
    const parseResult = CreateMultipleVotesSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { pollId, menuItemIds } = parseResult.data;
    const uniqueMenuItemIds = [...new Set(menuItemIds)];

    const hasAccess = await requirePollAccess(req, res, pollId);
    if (!hasAccess) return;

    const poll = await PollService.getPollById(pollId);
    if (!poll) {
      res.status(404).json({
        success: false,
        error: 'Poll not found',
        code: 'POLL_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const isMultiSelectMode = poll.isMultiSelect !== false;
    const maxAllowedSelections = isMultiSelectMode
      ? Math.max(1, Math.min(poll.maxSelections || 3, 3))
      : 1;

    if (!isMultiSelectMode && uniqueMenuItemIds.length > 1) {
      res.status(400).json({
        success: false,
        error: 'This poll allows only single selection',
        code: 'SINGLE_SELECTION_ONLY',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (uniqueMenuItemIds.length > maxAllowedSelections) {
      res.status(400).json({
        success: false,
        error: `Maximum ${maxAllowedSelections} selections allowed`,
        code: 'MAX_SELECTIONS_EXCEEDED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // P1-4: атомарная замена набора голосов через одну Prisma-транзакцию.
    // Раньше: N+1 (N delete + M create + 2 read), не race-safe относительно
    // параллельных голосов того же пользователя. Теперь — один round-trip.
    const { votes: updatedVotes } = await VoteService.replaceUserVotes(
      pollId,
      userId,
      uniqueMenuItemIds,
    );

    // Проверяем кворум — все ли ожидаемые проголосовали (авто-закрытие).
    // Не блокируем ответ клиенту, если кворум-чек упал.
    try {
      await PollService.checkQuorumAndComplete(pollId);
    } catch (error) {
      logger.error(`[VoteController] checkQuorumAndComplete failed for poll ${pollId}:`, error);
    }

    res.json({
      success: true,
      votes: updatedVotes,
      message: `Votes updated: ${uniqueMenuItemIds.length} selected`,
    });
  } catch (error: any) {
    logger.error('[VoteController] Error creating multiple votes:', error);
    if (
      error instanceof Error &&
      [
        'Poll not found',
        'Poll is not active',
        'Poll has expired',
        'Menu item is not available for this poll',
        'Poll menu configuration is invalid',
      ].includes(error.message)
    ) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'POLL_ERROR',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create votes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

/**
 * GET /api/votes/:pollId/user
 * Получить голоса текущего пользователя
 */
export async function getUserVotes(req: Request, res: Response): Promise<void> {
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

    // Валидация params с Zod
    const parseResult = PollIdParamsSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid pollId parameter',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { pollId } = parseResult.data;

    const hasAccess = await requirePollAccess(req, res, pollId);
    if (!hasAccess) return;

    const votes = await VoteService.getUserVotes(pollId, userId);

    res.json({
      success: true,
      votes,
      menuItemIds: votes.map(v => v.menuItemId).filter(Boolean),
    });
  } catch (error: any) {
    logger.error('[VoteController] Error getting user votes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get votes',
    });
  }
}

/**
 * DELETE /api/votes/:pollId/item/:menuItemId
 * Удалить голос за конкретное блюдо
 */
export async function deleteVote(req: Request, res: Response): Promise<void> {
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

    // Валидация params с Zod
    const parseResult = DeleteVoteParamsSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { pollId, menuItemId } = parseResult.data;

    const hasAccess = await requirePollAccess(req, res, pollId);
    if (!hasAccess) return;

    await VoteService.deleteVote(pollId, userId, menuItemId);

    res.json({
      success: true,
      message: 'Vote removed',
    });
  } catch (error: any) {
    logger.error('[VoteController] Error deleting vote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vote',
    });
  }
}
