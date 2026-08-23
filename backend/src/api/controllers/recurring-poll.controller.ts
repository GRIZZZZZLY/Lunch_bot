import { Request, Response } from 'express';
import { RecurringPollService } from '../../services/recurring-poll.service';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';
import { respondIfInvalidInput } from '../middleware/validate';
import {
  createScheduleBody,
  recurringGroupIdParam,
  recurringHistoryQuery,
  recurringScheduleIdParam,
  toggleScheduleBody,
  updateScheduleBody,
} from '../schemas/recurring-poll';

/* Схемы уехали в `api/schemas/recurring-poll.ts` и подключены на маршрутах.
   Форма их не изменилась — здесь они и так работали; изменилось место
   проверки и то, что теперь провалидированы ещё `:groupId`, `:id` и
   `?limit`. */

/**
 * Получение расписания группы
 */
export const getGroupSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { groupId } = recurringGroupIdParam.get(req);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Читать расписание может любой участник группы: команде полезно знать,
    // когда стартует автоголосование. Менять его по-прежнему может только админ.
    const isMember = await GroupService.isUserGroupMember(userId, groupId);
    if (!isMember) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
      });
      return;
    }

    const schedule = await RecurringPollService.getByGroupId(groupId);

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error getting group schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get schedule',
    });
  }
};

/**
 * Создание нового расписания
 */
export const createSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { groupId, daysOfWeek, timeOfDay, duration, selectedMenuItemIds } =
      createScheduleBody.get(req);

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(
      userId,
      groupId
    );
    if (!hasAccess) {
      res
        .status(403)
        .json({
          success: false,
          error: 'Access denied. Admin rights required.',
        });
      return;
    }

    const schedule = await RecurringPollService.createRecurring({
      groupId,
      daysOfWeek,
      timeOfDay,
      duration,
      selectedMenuItemIds: selectedMenuItemIds ?? null,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error creating schedule:', error);

    let statusCode = 500;
    let errorMessage = 'Failed to create schedule';

    if (error instanceof Error) {
      if (error.message.includes('already has a recurring poll')) {
        statusCode = 409; // Conflict
        errorMessage = 'Group already has a recurring poll';
      } else if (
        error.message.includes('Invalid time format') ||
        error.message.includes('Duration must be')
      ) {
        statusCode = 400; // Bad Request
        errorMessage = 'Invalid schedule parameters';
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * Обновление расписания
 */
export const updateSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id: scheduleId } = recurringScheduleIdParam.get(req);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      groupId: bodyGroupId,
      daysOfWeek,
      timeOfDay,
      duration,
      selectedMenuItemIds,
      isEnabled,
    } = updateScheduleBody.get(req);

    // Получаем текущее расписание для проверки прав
    const existing = await RecurringPollService.getByGroupId(bodyGroupId);
    if (!existing || existing.id !== scheduleId) {
      res.status(404).json({ success: false, error: 'Schedule not found' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(
      userId,
      existing.groupId
    );
    if (!hasAccess) {
      res
        .status(403)
        .json({
          success: false,
          error: 'Access denied. Admin rights required.',
        });
      return;
    }

    const updated = await RecurringPollService.updateRecurring(scheduleId, {
      daysOfWeek,
      timeOfDay,
      duration,
      selectedMenuItemIds,
      isEnabled,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error updating schedule:', error);

    let statusCode = 500;
    let errorMessage = 'Failed to update schedule';

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'Schedule not found';
      } else if (
        error.message.includes('Invalid time format') ||
        error.message.includes('Duration must be')
      ) {
        statusCode = 400;
        errorMessage = 'Invalid schedule parameters';
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * Удаление расписания
 */
export const deleteSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id: scheduleId } = recurringScheduleIdParam.get(req);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const existing = await RecurringPollService.getById(scheduleId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Schedule not found' });
      return;
    }

    const hasAccess = await RecurringPollService.checkAdminAccess(
      userId,
      existing.groupId
    );
    if (!hasAccess) {
      res
        .status(403)
        .json({
          success: false,
          error: 'Access denied. Admin rights required.',
        });
      return;
    }

    await RecurringPollService.deleteRecurring(scheduleId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete schedule',
    });
  }
};

/**
 * Включение/выключение расписания
 */
export const toggleSchedule = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id: scheduleId } = recurringScheduleIdParam.get(req);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { isEnabled } = toggleScheduleBody.get(req);

    const existing = await RecurringPollService.getById(scheduleId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Schedule not found' });
      return;
    }

    const hasAccess = await RecurringPollService.checkAdminAccess(
      userId,
      existing.groupId
    );
    if (!hasAccess) {
      res
        .status(403)
        .json({
          success: false,
          error: 'Access denied. Admin rights required.',
        });
      return;
    }

    const updated = await RecurringPollService.toggleEnabled(
      scheduleId,
      isEnabled
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error toggling schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle schedule',
    });
  }
};

/**
 * Получение истории запусков
 */
export const getExecutionHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { groupId } = recurringGroupIdParam.get(req);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(
      userId,
      groupId
    );
    if (!hasAccess) {
      res
        .status(403)
        .json({
          success: false,
          error: 'Access denied. Admin rights required.',
        });
      return;
    }

    const { limit = 7 } = recurringHistoryQuery.get(req);
    const history = await RecurringPollService.getExecutionHistory(
      groupId,
      limit
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    if (respondIfInvalidInput(req, res, error)) return;
    logger.error('Error getting execution history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get history',
    });
  }
};
