import { Request, Response } from 'express';
import { VoteService } from '../../services/vote.service';
import { logger } from '../../utils/logger';

/**
 * Vote Controller
 * Обработка голосований с поддержкой множественного выбора
 */

/**
 * POST /api/votes/multiple
 * Создать/обновить голоса (множественный выбор)
 * Body: { pollId, menuItemIds: number[] }
 */
export async function createMultipleVotes(req: Request, res: Response): Promise<void> {
  try {
    const { pollId, menuItemIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    if (!pollId || !Array.isArray(menuItemIds)) {
      res.status(400).json({
        success: false,
        error: 'pollId and menuItemIds array required',
      });
      return;
    }

    // 1. Получаем текущие голоса пользователя
    const currentVotes = await VoteService.getUserVotes(pollId, userId);
    const currentMenuItemIds = currentVotes.map(v => v.menuItemId!);

    // 2. Определяем, какие голоса добавить, а какие удалить
    const toAdd = menuItemIds.filter(id => !currentMenuItemIds.includes(id));
    const toRemove = currentMenuItemIds.filter(id => !menuItemIds.includes(id));

    // 3. Удаляем голоса за неотмеченные блюда
    for (const menuItemId of toRemove) {
      await VoteService.deleteVote(pollId, userId, menuItemId);
      logger.info(`Removed vote: user ${userId}, poll ${pollId}, item ${menuItemId}`);
    }

    // 4. Добавляем голоса за новые блюда
    for (const menuItemId of toAdd) {
      await VoteService.createVote({
        pollId,
        userId,
        menuItemId,
      });
      logger.info(`Added vote: user ${userId}, poll ${pollId}, item ${menuItemId}`);
    }

    // 5. Возвращаем обновленный список голосов
    const updatedVotes = await VoteService.getUserVotes(pollId, userId);

    res.json({
      success: true,
      votes: updatedVotes,
      message: `Votes updated: ${menuItemIds.length} selected`,
    });
  } catch (error: any) {
    logger.error('[VoteController] Error creating multiple votes:', error);
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
    const { pollId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const votes = await VoteService.getUserVotes(parseInt(pollId), userId);

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
    const { pollId, menuItemId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    await VoteService.deleteVote(parseInt(pollId), userId, parseInt(menuItemId));

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
