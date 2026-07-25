import { Request, Response } from 'express';
import { z } from 'zod';
import { RecurringPollService } from '../../services/recurring-poll.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const DaysOfWeekSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'At least one day must be selected')
  .max(7);

const TimeOfDaySchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'timeOfDay must be in HH:MM format')
  .refine(val => {
    const [h, m] = val.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, 'timeOfDay must be a valid time (00:00–23:59)');

const CreateScheduleSchema = z.object({
  groupId: z.number().int().positive('groupId must be a positive integer'),
  daysOfWeek: DaysOfWeekSchema,
  timeOfDay: TimeOfDaySchema,
  duration: z.number().int().min(1, 'duration must be at least 1 minute').max(1440),
  selectedMenuItemIds: z.array(z.number().int().positive()).nullable().optional(),
});

const UpdateScheduleSchema = z.object({
  groupId: z.number().int().positive('groupId must be a positive integer'),
  daysOfWeek: DaysOfWeekSchema.optional(),
  timeOfDay: TimeOfDaySchema.optional(),
  duration: z.number().int().min(1).max(1440).optional(),
  selectedMenuItemIds: z.array(z.number().int().positive()).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

/**
 * Получение расписания группы
 */
export const getGroupSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = parseInt(getParam(req.params, 'groupId'), 10);
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

    const parsed = CreateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { groupId, daysOfWeek, timeOfDay, duration, selectedMenuItemIds } = parsed.data;

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
      selectedMenuItemIds: selectedMenuItemIds ?? null,
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
    const scheduleId = parseInt(getParam(req.params, 'id'), 10);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
      return;
    }

    const parsed = UpdateScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { groupId: bodyGroupId, daysOfWeek, timeOfDay, duration, selectedMenuItemIds, isEnabled } = parsed.data;

    // Получаем текущее расписание для проверки прав
    const existing = await RecurringPollService.getByGroupId(bodyGroupId);
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
    const scheduleId = parseInt(getParam(req.params, 'id'), 10);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
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
    const scheduleId = parseInt(getParam(req.params, 'id'), 10);

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (isNaN(scheduleId)) {
      res.status(400).json({ success: false, error: 'Invalid schedule ID' });
      return;
    }

    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      res.status(400).json({ success: false, error: 'isEnabled must be boolean' });
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
    const groupId = parseInt(getParam(req.params, 'groupId'), 10);

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
