import { Request, Response } from 'express';
import { PollService, PollAlreadyActiveError } from '../../services/poll.service';
import { VoteService } from '../../services/vote.service';
import { MenuService } from '../../services/menu.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { CreatePollData, CreateVoteData } from '../../types/poll.types';
import { createPollFromWebApp } from '../../services/poll.service.extensions';
import { BotNotInitializedError } from '../../bot/bot-instance';
import { calculatePollEndTime } from '../../utils/date';
import { serializeBigInt } from '../../utils/serialize';
import { requireAuthUser } from '../middleware/require-auth-user';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  cancelPollBody,
  completeMultiWinnerBody,
  createPollBody,
  createPollFromWebAppBody,
  pollGroupIdParam,
  pollGroupQuery,
  pollHistoryQuery,
  pollIdParam,
  pollUserIdParam,
  popularItemsQuery,
  voteBody,
  voteMultipleBody,
} from '../schemas/poll';

async function requireGroupMember(
  req: Request,
  res: Response,
  groupId: number
): Promise<boolean> {
  const user = requireAuthUser(req, res);
  if (!user) return false;

  const hasAccess = await GroupService.isUserGroupMember(user.id, groupId);
  if (!hasAccess) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return false;
  }

  return true;
}

async function requireGroupAdmin(
  req: Request,
  res: Response,
  groupId: number
): Promise<boolean> {
  const user = requireAuthUser(req, res);
  if (!user) return false;

  const hasAccess = await GroupService.isUserGroupAdmin(user.id, groupId);
  if (!hasAccess) {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN',
    });
    return false;
  }

  return true;
}

/* `parseOptionalGroupId` жил здесь и разбирал `?groupId=` руками. Его убрала
   валидация на уровне роутера: испорченный параметр теперь не доходит до
   контроллера, а `groupScopedQuery` отдаёт либо число, либо `undefined` —
   третьего состояния «параметр есть, но мусор» больше нет. */

async function getAccessibleGroupIds(
  req: Request,
  res: Response
): Promise<number[] | undefined | null> {
  const user = requireAuthUser(req, res);
  if (!user) return null;

  /* undefined означало «фильтра нет, видно всё» и выдавалось по глобальному
     флагу. Теперь выборка всегда сужена до групп самого человека: администратор
     отвечает за свою группу, а не за все. */
  const memberships = await GroupService.getGroupsForUser(user.id, true);
  const groupIds = memberships.map(member => member.groupId);
  return Array.from(new Set(groupIds));
}

export class PollController {
  /**
   * GET /api/polls/active
   * Получение активных голосований
   */
  static async getActivePolls(req: Request, res: Response): Promise<void> {
    try {
      const groupIds = await getAccessibleGroupIds(req, res);
      if (groupIds === null) return;

      const polls = await PollService.getActivePolls(groupIds);
      
      // Добавляем вычисленное endTime для каждого активного голосования
      const pollsWithEndTime = polls.map(poll => {
        const endTime = poll.endedAt || calculatePollEndTime(poll.startedAt, poll.duration);
        return {
          ...poll,
          endTime: endTime.toISOString(), // Добавляем вычисленное время окончания
        };
      });

      res.json({
        success: true,
        data: serializeBigInt(pollsWithEndTime),
        count: pollsWithEndTime.length,
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
      const { groupId, limit = 20, offset = 0 } = pollHistoryQuery.get(req);

      const groupIds = await getAccessibleGroupIds(req, res);
      if (groupIds === null) return;

      let result;
      if (groupId) {
        const hasAccess = await requireGroupMember(req, res, groupId);
        if (!hasAccess) return;
        result = await PollService.getPollHistory(groupId, limit, offset);
      } else {
        result = await PollService.getPollHistory(groupIds, limit, offset);
      }

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { groupId } = pollGroupQuery.get(req);

      const groupIds = await getAccessibleGroupIds(req, res);
      if (groupIds === null) return;

      if (groupId) {
        const hasAccess = await requireGroupMember(req, res, groupId);
        if (!hasAccess) return;
      }

      const poll = await PollService.getLastCompletedPoll(groupId ?? groupIds);

      res.json({
        success: true,
        data: poll ? serializeBigInt(poll) : null,
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error getting last completed poll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get last completed poll',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/polls/today-completed/:groupId
   * Получение последнего завершённого голосования сегодня
   */
  static async getTodayCompletedPoll(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = pollGroupIdParam.get(req);

      const hasAccess = await requireGroupMember(req, res, groupId);
      if (!hasAccess) return;

      const poll = await PollService.getTodayCompletedPoll(groupId);
      
      res.json({
        success: true,
        data: poll ? serializeBigInt(poll) : null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error in getTodayCompletedPoll:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch today completed poll',
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
      const user = requireAuthUser(req, res);
      if (!user) return;
      const { id: pollId } = pollIdParam.get(req);

      logger.info(`🔄 Repeating poll ${pollId} by user ${user.id}`);

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

      const hasAccess = await requireGroupAdmin(req, res, sourcePoll.groupId);
      if (!hasAccess) return;

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
        menuItems = await MenuService.getActiveMenuItems(sourcePoll.groupId);
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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { groupId } = pollGroupQuery.get(req);

      const groupIds = await getAccessibleGroupIds(req, res);
      if (groupIds === null) return;

      let stats;
      if (groupId) {
        const hasAccess = await requireGroupMember(req, res, groupId);
        if (!hasAccess) return;
        stats = await PollService.getPollStats(groupId);
      } else {
        stats = await PollService.getPollStats(groupIds);
      }

      res.json({
        success: true,
        data: serializeBigInt(stats),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const user = requireAuthUser(req, res);
      if (!user) return;

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
      const { userId } = pollUserIdParam.get(req);

      const stats = await PollService.getUserParticipationStats(userId);

      res.json({
        success: true,
        data: serializeBigInt(stats),
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);

      const poll = await PollService.getPollById(id);

      if (!poll) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, poll.groupId);
      if (!hasAccess) return;

      // Добавляем вычисленное endTime для активного голосования
      const endTime = poll.endedAt || calculatePollEndTime(poll.startedAt, poll.duration);
      const pollWithEndTime = {
        ...poll,
        endTime: endTime.toISOString(), // Добавляем вычисленное время окончания
      };

      // Если есть selectedMenuItemIds, фильтруем голоса только по этим блюдам
      let filteredPoll = pollWithEndTime;
      if (poll.selectedMenuItemIds) {
        try {
          const selectedIds = JSON.parse(poll.selectedMenuItemIds);
          if (Array.isArray(selectedIds) && selectedIds.length > 0) {
            const selectedIdSet = new Set(selectedIds);
            // Фильтруем голоса только по выбранным блюдам
            filteredPoll = {
              ...pollWithEndTime,
              votes: poll.votes.filter(vote =>
                vote.menuItemId && selectedIdSet.has(vote.menuItemId)
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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);

      const pollGroupId = await PollService.getPollGroupId(id);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, pollGroupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);

      const pollGroupId = await PollService.getPollGroupId(id);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, pollGroupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { groupId } = createPollBody.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const hasAccess = await requireGroupAdmin(req, res, groupId);
      if (!hasAccess) return;

      /* Тело уже разобрано контрактом, поэтому `req.body` здесь — его
         результат: объявленные поля приведены к типам, незаявленные
         (`selectedMenuItemIds` и прочее) сохранены как есть. */
      const pollData = {
        ...(req.body as CreatePollData),
        groupId,
        createdBy: user.id, // Всегда используем ID аутентифицированного пользователя
      };

      const poll = await PollService.createPoll(pollData);

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
      if (respondIfInvalidInput(req, res, error)) return;
      if (error instanceof PollAlreadyActiveError) {
        logger.warn('createPoll race resolved by service-level guard', {
          groupId: error.groupId,
          existingPollId: error.existingPollId,
        });
        res.status(400).json({
          success: false,
          error: 'Group already has an active poll',
          code: error.code,
        });
        return;
      }
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
      const {
        groupId,
        duration,
        selectedMenuItems,
        title,
        isMultiSelect,
        maxSelections,
      } = createPollFromWebAppBody.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      logger.info('Creating poll from WebApp', {
        groupId,
        duration,
        isMultiSelect,
        maxSelections,
        userId: user?.id,
        selectedItemsCount: Array.isArray(selectedMenuItems)
          ? selectedMenuItems.length
          : 0,
      });

      /* Диапазон `duration` (1..1440) и обязательность `groupId` проверяет
         схема на роутере — сюда доходит уже разобранное. Значение по умолчанию
         остаётся здесь: это бизнес-правило, а не валидация. */
      const parsedGroupId = groupId;
      const parsedDuration = duration ?? 30;

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

      const parsedIsMultiSelect = isMultiSelect ?? true;
      /* `|| 3`, а не `?? 3`: ноль здесь исторически означал «не задано», и
         менять это заодно с переносом валидации было бы тихой сменой поведения. */
      const parsedMaxSelections = parsedIsMultiSelect
        ? Math.max(1, Math.min(maxSelections || 3, 3))
        : 1;

      const hasAccess = await requireGroupAdmin(req, res, parsedGroupId);
      if (!hasAccess) return;

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
        menuItems = await MenuService.getActiveMenuItems(parsedGroupId);
        logger.info('✅ Initial menu items loaded', { count: menuItems.length });
      } catch (menuError) {
        logger.error('❌ FAILED to load menu items', { error: menuError, message: menuError instanceof Error ? menuError.message : 'Unknown error' });
        throw menuError;
      }
      
      // Фильтруем по выбранным ID если указаны
      if (selectedMenuItems && selectedMenuItems.length > 0) {
        const selectedIds = selectedMenuItems;
        const selectedIdSet = new Set(selectedIds);
        logger.info('🔍 Filtering menu items', {
          selectedIds,
          selectedMenuItems,
          selectedIdsCount: selectedIds.length
        });
        menuItems = menuItems.filter(item => selectedIdSet.has(item.id));
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
        selectedMenuItemIds: menuItems.map(item => item.id), // Сохраняем IDs выбранных блюд
        isMultiSelect: parsedIsMultiSelect,
        maxSelections: parsedMaxSelections,
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
      if (respondIfInvalidInput(req, res, error)) return;
      logger.error('Error creating poll from WebApp:', error);
      
      if (error instanceof PollAlreadyActiveError) {
        logger.warn('createPollFromWebApp race resolved by service-level guard', {
          groupId: error.groupId,
          existingPollId: error.existingPollId,
        });
        res.status(400).json({
          success: false,
          error: 'Group already has an active poll',
          code: error.code,
        });
        return;
      }

      if (error instanceof BotNotInitializedError) {
        res.status(503).json({
          success: false,
          error: 'Bot service is not available',
          code: 'BOT_NOT_AVAILABLE'
        });
        return;
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
      const { groupId } = pollGroupIdParam.get(req);

      const hasAccess = await requireGroupMember(req, res, groupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(id);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(id);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

      // Причина отмены опциональна; её тип и длину проверяет схема тела.
      const { reason } = cancelPollBody.get(req);

      const poll = await PollService.cancelPoll(id, user.id, reason || 'Отменено через API');

      logger.info('Poll cancelled via API', {
        pollId: id,
        cancelledBy: user.id,
      });

      res.json({
        success: true,
        data: serializeBigInt(poll),
        message: 'Poll cancelled successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      if (error instanceof Error && error.message === 'Poll not found') {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }
      if (
        error instanceof Error &&
        error.message === 'Only an active poll can be cancelled'
      ) {
        res.status(409).json({
          success: false,
          error: error.message,
          code: 'INVALID_POLL_STATE',
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
      const { id: pollId } = pollIdParam.get(req);
      const { menuItemId } = voteBody.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, pollGroupId);
      if (!hasAccess) return;

      const voteData: CreateVoteData = {
        pollId,
        userId: user.id,
        menuItemId,
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
      if (respondIfInvalidInput(req, res, error)) return;
      if (error instanceof Error) {
        if ([
          'Poll not found',
          'Poll is not active',
          'Poll has expired',
          'Menu item is not available for this poll',
          'Poll menu configuration is invalid',
          'User is not eligible to vote in this poll',
          'User is not eligible to vote in this poll',
        ].includes(error.message)) {
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
   * POST /api/polls/:id/vote-multiple
   * Голосование за несколько блюд одновременно (множественный выбор)
   */
  static async voteMultiple(req: Request, res: Response): Promise<void> {
    try {
      const { id: pollId } = pollIdParam.get(req);
      const { menuItemIds } = voteMultipleBody.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      // Дубли убираются здесь: это не валидация, а нормализация выбора.
      const numericMenuItemIds = [...new Set(menuItemIds)];

      const pollGroupId = await PollService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, pollGroupId);
      if (!hasAccess) return;

      const poll = await PollService.getPollById(pollId);
      if (!poll) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const isMultiSelectMode = poll.isMultiSelect !== false;
      const maxAllowedSelections = isMultiSelectMode
        ? Math.max(1, Math.min(poll.maxSelections || 3, 3))
        : 1;

      if (!isMultiSelectMode && numericMenuItemIds.length > 1) {
        res.status(400).json({
          success: false,
          error: 'This poll allows only single selection',
          code: 'SINGLE_SELECTION_ONLY'
        });
        return;
      }

      if (numericMenuItemIds.length > maxAllowedSelections) {
        res.status(400).json({
          success: false,
          error: `Maximum ${maxAllowedSelections} selections allowed`,
          code: 'MAX_SELECTIONS_EXCEEDED'
        });
        return;
      }

      // Создаём множественные голоса
      const votes = await VoteService.createMultipleVotes(pollId, user.id, numericMenuItemIds);

      logger.info('Multiple votes cast via API', {
        pollId,
        userId: user.id,
        itemsCount: votes.length,
        menuItemIds: votes.map(v => v.menuItemId),
      });

      // Проверяем автозавершение после голосования
      try {
        const shouldAutoComplete = await PollService.checkAutoComplete(pollId);
        
        if (shouldAutoComplete) {
          logger.info(`Triggering auto-complete for poll ${pollId} (from multi-vote API)`);
          
          // Завершаем голосование (multi-winner по умолчанию)
          await PollService.completePollMultiWinner(pollId, user.id, {
            minVotes: 1,
            tieBreakMethod: 'earliest'
          });
          
          logger.info(`Poll ${pollId} auto-completed successfully via multi-vote API`);
        }
      } catch (autoCompleteError) {
        logger.error('Auto-complete check/execution failed:', autoCompleteError);
        // Не падаем, голоса уже записаны
      }

      res.json({
        success: true,
        data: votes.map(vote => serializeBigInt(vote)),
        message: `Successfully voted for ${votes.length} items`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
      if (error instanceof Error) {
        if ([
          'Poll not found',
          'Poll is not active',
          'Poll has expired',
          'Invalid parameters for multiple votes',
          'Menu item is not available for this poll',
          'Poll menu configuration is invalid',
        ].includes(error.message)) {
          res.status(400).json({
            success: false,
            error: error.message,
            code: 'POLL_ERROR'
          });
          return;
        }
      }

      logger.error('Error casting multiple votes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cast multiple votes',
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
      const { id: pollId } = pollIdParam.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupMember(req, res, pollGroupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { id } = pollIdParam.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(id);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND'
        });
        return;
      }

      const hasAccess = await requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

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
      if (respondIfInvalidInput(req, res, error)) return;
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
      const { groupId, limit = 10 } = popularItemsQuery.get(req);

      const hasAccess = await requireGroupMember(req, res, groupId);
      if (!hasAccess) return;

      const popularItems = await MenuService.getPopularMenuItems(limit, groupId);

      res.json({
        success: true,
        data: serializeBigInt(popularItems),
        count: popularItems.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      if (respondIfInvalidInput(req, res, error)) return;
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

      const { id: pollId } = pollIdParam.get(req);
      const user = requireAuthUser(req, res);
      if (!user) return;

      const pollGroupId = await PollService.getPollGroupId(pollId);
      if (!pollGroupId) {
        res.status(404).json({
          success: false,
          error: 'Poll not found',
          code: 'POLL_NOT_FOUND',
        });
        return;
      }

      const hasAccess = await requireGroupAdmin(req, res, pollGroupId);
      if (!hasAccess) return;

      /* Диапазоны и допустимые значения проверяет схема тела; здесь остаются
         только значения по умолчанию — это поведение, а не валидация. */
      const body = completeMultiWinnerBody.get(req);
      const minVotes = body.minVotes ?? 1;
      const maxWinners = body.maxWinners ?? null;
      const tieBreakMethod = body.tieBreakMethod ?? 'earliest';

      const result = await PollService.completePollMultiWinner(
        pollId,
        user.id,
        { minVotes, maxWinners, tieBreakMethod }
      );

      const resultData = typeof result.rouletteData === 'string'
        ? JSON.parse(result.rouletteData)
        : result.rouletteData || {};

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
      if (respondIfInvalidInput(req, res, error)) return;
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
