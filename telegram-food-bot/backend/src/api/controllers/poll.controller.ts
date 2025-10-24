import { Request, Response } from 'express';
import { PollService } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { CreatePollData, CreateVoteData } from '../../types/poll.types';
import { createPollFromWebApp } from '../../services/poll.service.extensions';

/**
 * Converts BigInt values to strings and Date to ISO strings recursively in an object
 * This is needed because JSON.stringify can't serialize BigInt values
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

export class PollController {
  /**
   * GET /api/polls/active
   * Получение активных голосований
   */
  static async getActivePolls(req: Request, res: Response): Promise<void> {
    try {
      const polls = await PollService.getActivePolls();

      res.json({
        success: true,
        data: serializeBigInt(polls),
        count: polls.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting active polls:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active polls',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/history
   * Получение истории голосований
   */
  static async getPollHistory(req: Request, res: Response): Promise<void> {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (groupId && isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid groupId parameter',
          code: 'INVALID_GROUP_ID'
        });
        return;
      }

      const result = await PollService.getPollHistory(groupId, limit, offset);

      res.json({
        success: true,
        data: {
          polls: serializeBigInt(result.polls),
          total: result.total,
          limit,
          offset,
          hasNext: offset + limit < result.total,
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting poll history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll history',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/last-completed
   * Получение последнего завершённого голосования
   * Используется для функции "Повторить вчерашнее"
   */
  static async getLastCompleted(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;

      const poll = await PollService.getLastCompletedPoll(groupId);

      res.json({
        success: true,
        data: poll ? serializeBigInt(poll) : null,
      });
    } catch (error) {
      logger.error('Error getting last completed poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get last completed poll',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/polls/repeat/:id
   * Повторить голосование (создать копию)
   * Доступно только для админов
   */
  static async repeatPoll(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const pollId = parseInt(req.params.id);

      logger.info(`🔄 Repeating poll ${pollId} by user ${user.id}`);

      if (!pollId || isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_POLL_ID',
        });
        return;
      }

      // Получаем исходное голосование
      const sourcePoll = await PollService.getPollById(pollId);

      if (!sourcePoll) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND',
        });
        return;
      }

      logger.info(`✅ Source poll found: ${pollId}`, {
        groupId: sourcePoll.groupId,
        selectedMenuItemIds: sourcePoll.selectedMenuItemIds,
      });

      // Получаем выбранные menu items
      let selectedMenuItemIds: number[] = [];
      if (sourcePoll.selectedMenuItemIds) {
        try {
          selectedMenuItemIds = JSON.parse(sourcePoll.selectedMenuItemIds);
        } catch (error) {
          logger.error('Error parsing selectedMenuItemIds:', error);
        }
      }

      // Если нет выбранных items, берём все активные
      let menuItems = [];
      if (selectedMenuItemIds.length > 0) {
        logger.info(`📋 Loading ${selectedMenuItemIds.length} selected menu items`);
        menuItems = await MenuService.getMenuItemsByIds(selectedMenuItemIds);
      } else {
        logger.info('📋 Loading all active menu items');
        menuItems = await MenuService.getActiveMenuItems();
      }

      if (menuItems.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No menu items available',
          code: 'NO_MENU_ITEMS',
        });
        return;
      }

      logger.info(`✅ Loaded ${menuItems.length} menu items`);

      // Создаём новое голосование с отправкой в Telegram
      const result = await createPollFromWebApp({
        groupId: sourcePoll.groupId,
        duration: sourcePoll.duration,
        createdBy: user.id,
        menuItems,
        selectedMenuItemIds: selectedMenuItemIds.length > 0 ? selectedMenuItemIds : undefined,
      });

      logger.info(`✅ Poll ${pollId} repeated as poll ${result.pollId} by user ${user.id}`);

      // Получаем созданное голосование для ответа
      const newPoll = await PollService.getPollById(result.pollId);

      res.json({
        success: true,
        data: serializeBigInt(newPoll),
        message: 'Poll repeated and sent to Telegram group',
      });
    } catch (error) {
      logger.error('❌ Error repeating poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to repeat poll',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/polls/stats
   * Получение статистики голосований
   */
  static async getPollStats(req: Request, res: Response): Promise<void> {
    try {
      const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;

      if (groupId && isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid groupId parameter',
          code: 'INVALID_GROUP_ID'
        });
        return;
      }

      const stats = await PollService.getPollStats(groupId);

      res.json({
        success: true,
        data: serializeBigInt(stats),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting poll stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll stats',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/user-stats/my
   * Получение статистики текущего пользователя
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      const stats = await PollService.getUserParticipationStats(user.id);

      res.json({
        success: true,
        data: serializeBigInt(stats),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user stats',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/user-stats/:userId
   * Получение статистики конкретного пользователя (только админы)
   */
  static async getUserStatsByUserId(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          code: 'INVALID_USER_ID'
        });
        return;
      }

      const stats = await PollService.getUserParticipationStats(userId);

      res.json({
        success: true,
        data: serializeBigInt(stats),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting user stats by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user stats',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/:id
   * Получение информации о голосовании
   */
  static async getPollById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const poll = await PollService.getPollById(id);

      if (!poll) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      // Если есть selectedMenuItemIds, фильтруем голоса только по этим блюдам
      let filteredPoll = poll;
      if (poll.selectedMenuItemIds) {
        try {
          const selectedIds = JSON.parse(poll.selectedMenuItemIds);
          if (Array.isArray(selectedIds) && selectedIds.length > 0) {
            // Фильтруем голоса только по выбранным блюдам
            filteredPoll = {
              ...poll,
              votes: poll.votes.filter(vote => 
                vote.menuItemId && selectedIds.includes(vote.menuItemId)
              ),
            };
            logger.info(`Filtered poll ${id} votes`, { 
              totalVotes: poll.votes.length, 
              filteredVotes: filteredPoll.votes.length,
              selectedMenuItemIds: selectedIds
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse selectedMenuItemIds', { pollId: id, error: parseError });
        }
      }

      res.json({
        success: true,
        data: serializeBigInt(filteredPoll),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting poll by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/:id/results
   * Получение результатов голосования
   */
  static async getPollResults(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await PollService.getPollResultByPollId(id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: 'Poll results not found',
          code: 'RESULTS_NOT_FOUND'
        });
        return;
      }

      // Получаем детальную разбивку голосов
      const breakdown = await PollService.getPollVoteBreakdown(id);

      res.json({
        success: true,
        data: serializeBigInt({
          result,
          breakdown,
        }),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting poll results:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll results',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/:id/votes
   * Получение голосов по голосованию
   */
  static async getPollVotes(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const votes = await VoteService.getPollVotes(id);
      const voteCount = await VoteService.getVoteCountByMenuItem(id);

      res.json({
        success: true,
        data: serializeBigInt({
          votes,
          summary: voteCount,
          totalVotes: votes.length,
        }),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting poll votes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get poll votes',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls
   * Создание нового голосования
   */
  static async createPoll(req: Request, res: Response): Promise<void> {
    try {
      const data: CreatePollData = req.body;
      const user = (req as any).user;

      const poll = await PollService.createPoll(data);

      logger.info('Poll created via API', {
        pollId: poll.id,
        groupId: poll.groupId,
        createdBy: user.id,
      });

      res.status(201).json({
        success: true,
        data: serializeBigInt(poll),
        message: 'Poll created successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error creating poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create poll',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/create-from-webapp
   * Создание голосования из Mini App с отправкой в группу
   */
  static async createPollFromWebApp(req: Request, res: Response): Promise<void> {
    try {
      logger.info('🚀 START createPollFromWebApp');
      
      const { groupId, duration, selectedMenuItems, title } = req.body;
      const user = (req as any).user;

      // Детальное логирование для отладки
      logger.info('Creating poll from WebApp', {
        groupId,
        duration,
        selectedMenuItems,
        title,
        userId: user?.id,
        body: req.body
      });
      
      logger.info('📊 After initial logging, before validation');

      // Валидация
      if (!groupId || isNaN(parseInt(groupId))) {
        logger.warn('Invalid groupId', { groupId, type: typeof groupId });
        res.status(400).json({
          success: false,
          error: 'Invalid or missing groupId',
          code: 'INVALID_GROUP_ID'
        });
        return;
      }

      const parsedGroupId = parseInt(groupId);
      const parsedDuration = duration ? parseInt(duration) : 30;

      if (parsedDuration < 1 || parsedDuration > 1440) {
        res.status(400).json({
          success: false,
          error: 'Duration must be between 1 and 1440 minutes',
          code: 'INVALID_DURATION'
        });
        return;
      }

      // Проверяем существование группы
      const group = await GroupService.getGroupById(parsedGroupId);
      if (!group) {
        res.status(404).json({
          success: false,
          error: 'Group not found',
          code: 'GROUP_NOT_FOUND'
        });
        return;
      }

      // Проверяем активное голосование
      const existingPoll = await PollService.getActivePollInGroup(parsedGroupId);
      logger.info('✅ Checked existing poll', { exists: !!existingPoll });
      
      if (existingPoll) {
        logger.warn('❌ Group already has active poll');
        res.status(400).json({
          success: false,
          error: 'Group already has an active poll',
          code: 'POLL_ALREADY_ACTIVE'
        });
        return;
      }

      // Получаем блюда меню
      logger.info('🍽️ About to load menu items...');
      let menuItems;
      try {
        menuItems = await MenuService.getActiveMenuItems();
        logger.info('✅ Initial menu items loaded', { count: menuItems.length });
      } catch (menuError) {
        logger.error('❌ FAILED to load menu items', { error: menuError, message: menuError instanceof Error ? menuError.message : 'Unknown error' });
        throw menuError;
      }
      
      // Фильтруем по выбранным ID если указаны
      if (selectedMenuItems && Array.isArray(selectedMenuItems) && selectedMenuItems.length > 0) {
        const selectedIds = selectedMenuItems.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        logger.info('🔍 Filtering menu items', { 
          selectedIds, 
          selectedMenuItems,
          selectedIdsCount: selectedIds.length 
        });
        menuItems = menuItems.filter(item => selectedIds.includes(item.id));
        logger.info('✅ Filtered menu items', { 
          count: menuItems.length, 
          items: menuItems.map(i => ({ id: i.id, name: i.name })) 
        });
      }

      // Проверяем минимум блюд
      if (menuItems.length < 2) {
        logger.warn('❌ Not enough menu items', { 
          count: menuItems.length, 
          selectedMenuItems,
          availableMenuItems: menuItems.length
        });
        res.status(400).json({
          success: false,
          error: 'At least 2 active menu items required',
          code: 'NOT_ENOUGH_ITEMS'
        });
        return;
      }

      // Создаём голосование и отправляем в группу
      const result = await createPollFromWebApp({
        groupId: parsedGroupId,
        duration: parsedDuration,
        createdBy: user.id,
        title: title || undefined,
        menuItems,
        selectedMenuItemIds: menuItems.map(item => item.id) // Сохраняем IDs выбранных блюд
      });

      logger.info('Poll created from WebApp and sent to group', {
        pollId: result.pollId,
        groupId: parsedGroupId,
        createdBy: user.id,
        messageId: result.messageId,
        duration: parsedDuration
      });

      res.status(201).json({
        success: true,
        data: serializeBigInt({
          pollId: result.pollId,
          messageId: result.messageId,
          groupTitle: group.title,
          duration: parsedDuration,
          menuItemsCount: menuItems.length
        }),
        message: 'Poll created and sent to group successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error creating poll from WebApp:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Bot not initialized')) {
          res.status(503).json({
            success: false,
            error: 'Bot service is not available',
            code: 'BOT_NOT_AVAILABLE'
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create poll from WebApp',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/active/:groupId
   * Получение активного голосования в группе
   */
  static async getActivePollInGroup(req: Request, res: Response): Promise<void> {
    try {
      const groupId = parseInt(req.params.groupId);

      if (isNaN(groupId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid group ID',
          code: 'INVALID_GROUP_ID'
        });
        return;
      }

      const poll = await PollService.getActivePollInGroup(groupId);

      if (!poll) {
        res.status(404).json({
          success: false,
          error: 'No active poll in this group',
          code: 'NO_ACTIVE_POLL',
          data: null
        });
        return;
      }

      res.json({
        success: true,
        data: serializeBigInt(poll),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting active poll in group:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active poll',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PATCH /api/polls/:id/complete
   * Завершение голосования
   */
  static async completePoll(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await PollService.completePoll(id);

      logger.info('Poll completed via API', {
        pollId: id,
        completedBy: user.id,
        winnerItemId: result.winnerMenuItemId,
        totalVotes: result.totalVotes,
      });

      res.json({
        success: true,
        data: serializeBigInt(result),
        message: 'Poll completed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Poll not found') {
          res.status(404).json({
            success: false,
            error: 'Poll not found',
            code: 'POLL_NOT_FOUND'
          });
          return;
        }
        if (error.message === 'Poll is already completed') {
          res.status(400).json({
            success: false,
            error: 'Poll is already completed',
            code: 'POLL_ALREADY_COMPLETED'
          });
          return;
        }
      }

      logger.error('Error completing poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete poll',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PATCH /api/polls/:id/cancel
   * Отмена голосования
   */
  static async cancelPoll(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      // Получаем причину отмены из тела запроса (опционально)
      const { reason } = req.body || {};

      const poll = await PollService.cancelPoll(id, user.id, reason || 'Отменено через API');

      logger.info('Poll cancelled via API', {
        pollId: id,
        cancelledBy: user.id,
        reason: reason || 'Отменено через API'
      });

      res.json({
        success: true,
        data: serializeBigInt(poll),
        message: 'Poll cancelled successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error && error.message === 'Poll not found') {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      logger.error('Error cancelling poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel poll',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/:id/vote
   * Голосование за блюдо
   */
  static async vote(req: Request, res: Response): Promise<void> {
    try {
      const pollId = parseInt(req.params.id);
      const { menuItemId } = req.body;
      const user = (req as any).user;

      if (isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      if (!menuItemId || isNaN(parseInt(menuItemId))) {
        res.status(400).json({
          success: false,
          error: 'Invalid menu item ID',
          code: 'INVALID_MENU_ITEM_ID'
        });
        return;
      }

      const voteData: CreateVoteData = {
        pollId,
        userId: user.id,
        menuItemId: parseInt(menuItemId),
      };

      const vote = await VoteService.upsertVote(voteData);

      logger.info('Vote cast via API', {
        pollId,
        userId: user.id,
        menuItemId: vote.menuItemId,
        isUpdate: vote.updatedAt > vote.createdAt,
      });

      // Проверяем автозавершение после голосования
      try {
        const shouldAutoComplete = await PollService.checkAutoComplete(pollId);
        
        if (shouldAutoComplete) {
          logger.info(`Triggering auto-complete for poll ${pollId} (from API)`);
          
          // Завершаем голосование (multi-winner по умолчанию)
          await PollService.completePollMultiWinner(pollId, user.id, {
            minVotes: 1,
            tieBreakMethod: 'earliest'
          });
          
          logger.info(`Poll ${pollId} auto-completed successfully via API`);
        }
      } catch (autoCompleteError) {
        logger.error('Auto-complete check/execution failed:', autoCompleteError);
        // Не падаем, голос уже записан
      }

      res.json({
        success: true,
        data: serializeBigInt(vote),
        message: 'Vote cast successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error) {
        if (['Poll not found', 'Poll is not active', 'Poll has expired'].includes(error.message)) {
          res.status(400).json({
            success: false,
            error: error.message,
            code: 'POLL_ERROR'
          });
          return;
        }
      }

      logger.error('Error casting vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cast vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * DELETE /api/polls/:id/vote
   * Отмена голоса
   */
  static async removeVote(req: Request, res: Response): Promise<void> {
    try {
      const pollId = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      await VoteService.removeVote(pollId, user.id);

      logger.info('Vote removed via API', {
        pollId,
        userId: user.id,
      });

      res.json({
        success: true,
        message: 'Vote removed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Vote not found') {
          res.status(404).json({
            success: false,
            error: 'Vote not found',
            code: 'VOTE_NOT_FOUND'
          });
          return;
        }
        if (['Poll not found', 'Poll is not active'].includes(error.message)) {
          res.status(400).json({
            success: false,
            error: error.message,
            code: 'POLL_ERROR'
          });
          return;
        }
      }

      logger.error('Error removing vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/:id/roulette
   * Запуск рулетки для выбора ответственного
   */
  static async runRoulette(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID'
        });
        return;
      }

      const result = await PollService.runRoulette(id);

      logger.info('Roulette run via API', {
        pollId: id,
        runBy: user.id,
        selectedUserId: result.responsibleUserId,
      });

      res.json({
        success: true,
        data: serializeBigInt(result),
        message: 'Roulette completed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Poll not found') {
          res.status(404).json({
            success: false,
            error: 'Poll not found',
            code: 'POLL_NOT_FOUND'
          });
          return;
        }
        if (error.message === 'No voters found') {
          res.status(400).json({
            success: false,
            error: 'No voters found for roulette',
            code: 'NO_VOTERS'
          });
          return;
        }
      }

      logger.error('Error running roulette:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run roulette',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/popular-items
   * Получение популярных блюд
   */
  static async getPopularItems(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter',
          code: 'INVALID_LIMIT'
        });
        return;
      }

      const popularItems = await MenuService.getPopularMenuItems(limit);

      res.json({
        success: true,
        data: serializeBigInt(popularItems),
        count: popularItems.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error getting popular items:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular items',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PATCH /api/polls/:id/complete-multi
   * Завершение голосования с множественными победителями
   * 
   * @access Admin only
   */
  static async completePollMultiWinner(req: Request, res: Response): Promise<void> {
    try {
      // Feature flag check
      const { FEATURES } = await import('../../config/features');
      if (!FEATURES.MULTI_WINNER_VOTING) {
        res.status(503).json({
          success: false,
          error: 'Multi-Winner Voting is currently disabled',
          code: 'FEATURE_DISABLED',
        });
        return;
      }

      const pollId = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(pollId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid poll ID',
          code: 'INVALID_ID',
        });
        return;
      }

      if (!user.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
          code: 'FORBIDDEN',
        });
        return;
      }

      const {
        minVotes = 1,
        maxWinners = null,
        tieBreakMethod = 'earliest'
      } = req.body;

      // Валидация minVotes
      if (typeof minVotes !== 'number' || minVotes < 0 || minVotes > 100) {
        res.status(400).json({
          success: false,
          error: 'minVotes must be a number between 0 and 100',
          code: 'INVALID_PARAMS',
        });
        return;
      }

      // Валидация maxWinners
      if (maxWinners !== null) {
        if (typeof maxWinners !== 'number' || maxWinners < 1 || maxWinners > 50) {
          res.status(400).json({
            success: false,
            error: 'maxWinners must be null or a number between 1 and 50',
            code: 'INVALID_PARAMS',
          });
          return;
        }
      }

      // Валидация tieBreakMethod
      if (!['earliest', 'alphabetical'].includes(tieBreakMethod)) {
        res.status(400).json({
          success: false,
          error: 'tieBreakMethod must be "earliest" or "alphabetical"',
          code: 'INVALID_PARAMS',
        });
        return;
      }

      const result = await PollService.completePollMultiWinner(
        pollId,
        user.id,
        { minVotes, maxWinners, tieBreakMethod }
      );

      const resultData = JSON.parse(result.rouletteData || '{}');

      logger.info('Poll completed with multi-winner via API', {
        pollId,
        completedBy: user.id,
        winnersCount: resultData.winners?.length || 0,
        params: { minVotes, maxWinners, tieBreakMethod },
      });

      res.json({
        success: true,
        data: serializeBigInt({
          pollResult: result,
          resultData,
        }),
        message: 'Poll completed with multi-winner mode successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      logger.error('Error completing poll multi-winner:', error);

      if (error.message === 'Poll not found') {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'NOT_FOUND',
        });
      } else if (error.message.includes('already completed')) {
        res.status(400).json({
          success: false,
          error: 'Poll is already completed',
          code: 'ALREADY_COMPLETED',
        });
      } else if (error.message.includes('not active')) {
        res.status(400).json({
          success: false,
          error: 'Poll is not active',
          code: 'NOT_ACTIVE',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  }
}

export const pollController = PollController;
