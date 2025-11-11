import { Request, Response } from 'express';
import { RecurringPollService } from '../../services/recurring-poll.service';
import { logger } from '../../utils/logger';

/**
 * Получение расписания группы
 */
export const getGroupSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(req.params.groupId);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(groupId)) {
      res.status(400).json({ success: false, error: 'Invalid group ID' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    const schedule = await RecurringPollService.getByGroupId(groupId);
    
    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    logger.error('Error getting group schedule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get schedule',
    });
  }
};

/**
 * Создание нового расписания
 */
export const createSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { groupId, daysOfWeek, timeOfDay, duration, selectedMenuItemIds } = req.body;

    // Валидация
    if (!groupId || !daysOfWeek || !timeOfDay || !duration) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: groupId, daysOfWeek, timeOfDay, duration',
      });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    const schedule = await RecurringPollService.createRecurring({
      groupId,
      daysOfWeek,
      timeOfDay,
      duration,
      selectedMenuItemIds: selectedMenuItemIds || null,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    logger.error('Error creating schedule:', error);
    
    let statusCode = 500;
    let errorMessage = 'Failed to create schedule';

    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('already has a recurring poll')) {
        statusCode = 409; // Conflict
      } else if (errorMessage.includes('Invalid time format') || errorMessage.includes('Duration must be')) {
        statusCode = 400; // Bad Request
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
export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const scheduleId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
      return;
    }

    // Получаем текущее расписание для проверки прав
    const existing = await RecurringPollService.getByGroupId(req.body.groupId);
    if (!existing || existing.id !== scheduleId) {
      res.status(404).json({ success: false, error: 'Schedule not found' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, existing.groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    const { daysOfWeek, timeOfDay, duration, selectedMenuItemIds, isEnabled } = req.body;

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
    logger.error('Error updating schedule:', error);
    
    let statusCode = 500;
    let errorMessage = 'Failed to update schedule';

    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('not found')) {
        statusCode = 404;
      } else if (errorMessage.includes('Invalid time format') || errorMessage.includes('Duration must be')) {
        statusCode = 400;
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
export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const scheduleId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
      return;
    }

    // Получаем расписание для проверки прав
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      res.status(400).json({ success: false, error: 'Group ID required' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    await RecurringPollService.deleteRecurring(scheduleId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    logger.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete schedule',
    });
  }
};

/**
 * Включение/выключение расписания
 */
export const toggleSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const scheduleId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
      return;
    }

    const { isEnabled, groupId } = req.body;

    if (typeof isEnabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'isEnabled must be boolean' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    const updated = await RecurringPollService.toggleEnabled(scheduleId, isEnabled);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error('Error toggling schedule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle schedule',
    });
  }
};

/**
 * Получение истории запусков
 */
export const getExecutionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const groupId = parseInt(req.params.groupId);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(groupId)) {
      res.status(400).json({ success: false, error: 'Invalid group ID' });
      return;
    }

    // Проверка прав доступа
    const hasAccess = await RecurringPollService.checkAdminAccess(userId, groupId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied. Admin rights required.' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 7;
    const history = await RecurringPollService.getExecutionHistory(groupId, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting execution history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history',
    });
  }
};
