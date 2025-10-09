import { Request, Response } from 'express';
import { PollService } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { CreatePollData, CreateVoteData } from '../../types/poll.types';
import { createPollFromWebApp } from '../../services/poll.service.extensions';
import { prisma } from '../../database/client';
import { CacheInvalidator } from '../../services/cache.service';

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
        data: polls,
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
        data: result.polls,
        pagination: {
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
        data: stats,
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

      // Конвертируем BigInt в строки для JSON сериализации
      const pollData = {
        ...poll,
        chatId: poll.chatId ? poll.chatId.toString() : null,
        group: poll.group ? {
          ...poll.group,
          telegramId: poll.group.telegramId.toString(),
        } : undefined,
        votes: poll.votes?.map((vote: any) => ({
          ...vote,
          user: vote.user ? {
            ...vote.user,
            telegramId: vote.user.telegramId.toString(),
          } : undefined,
        })),
      };

      res.json({
        success: true,
        data: pollData,
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
        data: {
          result,
          breakdown,
        },
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
        data: {
          votes,
          summary: voteCount,
          totalVotes: votes.length,
        },
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
        data: poll,
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
        menuItems
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
        data: {
          pollId: result.pollId,
          messageId: result.messageId,
          groupTitle: group.title,
          duration: parsedDuration,
          menuItemsCount: menuItems.length
        },
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
        data: poll,
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
        data: result,
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

      const poll = await PollService.cancelPoll(id);

      logger.info('Poll cancelled via API', {
        pollId: id,
        cancelledBy: user.id,
      });

      res.json({
        success: true,
        data: poll,
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

      res.json({
        success: true,
        data: vote,
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
        data: result,
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
        data: popularItems,
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
   * GET /api/polls/my-last-vote
   * Получить последний голос текущего пользователя
   */
  static async getMyLastVote(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      logger.info(`[getMyLastVote] userId=${userId}`);

      // Найти последний голос пользователя
      const lastVote = await prisma.vote.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          poll: {
            select: {
              id: true,
              status: true,
              startedAt: true
            }
          },
          menuItem: {
            select: {
              id: true,
              name: true
            }
          },
          rating: {
            select: {
              rating: true
            }
          }
        }
      });

      if (!lastVote || !lastVote.menuItem) {
        logger.info(`[getMyLastVote] No votes found for userId=${userId}`);
        res.json({
          success: true,
          data: null
        });
        return;
      }

      res.json({
        success: true,
        data: {
          pollId: lastVote.pollId,
          pollTitle: 'Голосование на обед',
          menuItemId: lastVote.menuItem.id,
          menuItemName: lastVote.menuItem.name,
          votedAt: lastVote.createdAt.toISOString(),
          rating: lastVote.rating?.rating || null
        }
      });

    } catch (error) {
      logger.error('Error getting last vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get last vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/:pollId/rate
   * Оценить свой прошлый голос
   */
  static async rateVote(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const pollId = parseInt(req.params.pollId);
      const { rating } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!rating || !['like', 'dislike'].includes(rating)) {
        res.status(400).json({
          success: false,
          error: 'Invalid rating value',
          code: 'INVALID_RATING'
        });
        return;
      }

      logger.info(`[rateVote] userId=${userId}, pollId=${pollId}, rating=${rating}`);

      // Найти голос пользователя в этом голосовании
      const vote = await prisma.vote.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId
          }
        },
        include: {
          rating: true
        }
      });

      if (!vote) {
        res.status(404).json({
          success: false,
          error: 'Vote not found',
          code: 'VOTE_NOT_FOUND'
        });
        return;
      }

      // Проверить, не оценен ли уже
      if (vote.rating) {
        res.status(400).json({
          success: false,
          error: 'Vote already rated',
          code: 'ALREADY_RATED'
        });
        return;
      }

      // Создать оценку
      await prisma.voteRating.create({
        data: {
          voteId: vote.id,
          rating
        }
      });

      logger.info(`[rateVote] Rating saved: voteId=${vote.id}, rating=${rating}`);

      res.json({
        success: true,
        message: 'Rating saved'
      });

    } catch (error) {
      logger.error('Error rating vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to rate vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/polls/:pollId/my-vote-status
   * Проверить статус голоса текущего пользователя в голосовании
   */
  static async getMyVoteStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const pollId = parseInt(req.params.pollId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      logger.info(`[getMyVoteStatus] userId=${userId}, pollId=${pollId}`);

      // Найти голос пользователя
      const userVote = await prisma.vote.findUnique({
        where: {
          pollId_userId: {
            pollId,
            userId
          }
        },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!userVote || !userVote.menuItem) {
        res.json({
          success: true,
          data: {
            hasVoted: false
          }
        });
        return;
      }

      // Посчитать сколько других выбрали то же блюдо
      const sameChoiceCount = await prisma.vote.count({
        where: {
          pollId,
          menuItemId: userVote.menuItemId
        }
      });

      res.json({
        success: true,
        data: {
          hasVoted: true,
          votedItemId: userVote.menuItem.id,
          votedItemName: userVote.menuItem.name,
          votedAt: userVote.createdAt.toISOString(),
          sameChoiceCount
        }
      });

    } catch (error) {
      logger.error('Error getting vote status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vote status',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/:pollId/quick-vote
   * Быстрый голос (повторить прошлый выбор)
   */
  static async quickVote(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const pollId = parseInt(req.params.pollId);
      const { menuItemId } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!menuItemId || isNaN(menuItemId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid menuItemId',
          code: 'INVALID_MENU_ITEM_ID'
        });
        return;
      }

      logger.info(`[quickVote] userId=${userId}, pollId=${pollId}, menuItemId=${menuItemId}`);

      // Использовать существующий метод VoteService.createVote
      const voteData: CreateVoteData = {
        pollId,
        userId,
        menuItemId
      };

      const vote = await VoteService.createVote(voteData);

      // Инвалидация кэша
      const poll = await prisma.poll.findUnique({ where: { id: pollId } });
      if (poll) {
        CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      }

      logger.info(`[quickVote] Vote created: voteId=${vote.id}`);

      res.json({
        success: true,
        data: vote
      });

    } catch (error) {
      // Обработка ошибки "уже проголосовал"
      if (error instanceof Error && error.message.includes('already voted')) {
        res.status(400).json({
          success: false,
          error: 'Already voted in this poll',
          code: 'ALREADY_VOTED'
        });
        return;
      }

      logger.error('Error creating quick vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * POST /api/polls/:pollId/random-vote
   * Случайный голос (рулетка)
   */
  static async randomVote(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const pollId = parseInt(req.params.pollId);

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      logger.info(`[randomVote] userId=${userId}, pollId=${pollId}`);

      // Получить все активные блюда
      const menuItems = await MenuService.getActiveMenuItems();

      if (menuItems.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No menu items available',
          code: 'NO_MENU_ITEMS'
        });
        return;
      }

      // Выбрать случайное блюдо
      const randomIndex = Math.floor(Math.random() * menuItems.length);
      const selectedItem = menuItems[randomIndex];

      logger.info(`[randomVote] Selected random item: ${selectedItem.name} (id=${selectedItem.id})`);

      // Создать голос
      const voteData: CreateVoteData = {
        pollId,
        userId,
        menuItemId: selectedItem.id
      };

      const vote = await VoteService.createVote(voteData);

      // Инвалидация кэша
      const poll = await prisma.poll.findUnique({ where: { id: pollId } });
      if (poll) {
        CacheInvalidator.invalidatePoll(pollId, poll.groupId);
      }

      logger.info(`[randomVote] Vote created: voteId=${vote.id}`);

      res.json({
        success: true,
        data: vote
      });

    } catch (error) {
      if (error instanceof Error && error.message.includes('already voted')) {
        res.status(400).json({
          success: false,
          error: 'Already voted in this poll',
          code: 'ALREADY_VOTED'
        });
        return;
      }

      logger.error('Error creating random vote:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create random vote',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const pollController = PollController;
