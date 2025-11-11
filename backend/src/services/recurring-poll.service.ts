import { RecurringPoll, Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollService } from './poll.service';
import { MenuService } from './menu.service';
import { GroupService } from './group.service';
import { UserService } from './user.service';
import { isSameDay, addMinutes, format, addDays } from 'date-fns';

interface CreateRecurringPollData {
  groupId: number;
  daysOfWeek: number[]; // [1,2,3,4,5] for Mon-Fri
  timeOfDay: string; // "11:00"
  duration: number; // minutes
  selectedMenuItemIds?: number[] | null; // null = all active
  createdBy: number;
}

interface UpdateRecurringPollData {
  daysOfWeek?: number[];
  timeOfDay?: string;
  duration?: number;
  selectedMenuItemIds?: number[] | null;
  isEnabled?: boolean;
}

interface RecurringPollWithRelations extends RecurringPoll {
  group: {
    id: number;
    telegramId: bigint;
    title: string;
  };
  creator: {
    id: number;
    firstName: string;
    lastName: string | null;
    telegramId: bigint;
  };
}

type RunStatus = 'SUCCESS' | 'SKIPPED_CONFLICT' | 'FAILED_NO_MENU' | 'FAILED_BOT_REMOVED' | 'FAILED_ERROR';

let botInstance: any = null;

export function initializeRecurringPollServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('RecurringPollService bot instance initialized');
}

export class RecurringPollService {
  /**
   * Создание нового расписания
   */
  static async createRecurring(data: CreateRecurringPollData): Promise<RecurringPoll> {
    try {
      // Валидация
      if (data.daysOfWeek.length === 0) {
        throw new Error('At least one day must be selected');
      }

      if (!this.isValidTime(data.timeOfDay)) {
        throw new Error('Invalid time format. Use HH:MM');
      }

      if (data.duration < 5 || data.duration > 180) {
        throw new Error('Duration must be between 5 and 180 minutes');
      }

      // Проверка что группа существует
      const group = await prisma.group.findUnique({
        where: { id: data.groupId },
      });

      if (!group) {
        throw new Error('Group not found');
      }

      // Проверка что уже нет расписания для этой группы
      const existing = await prisma.recurringPoll.findUnique({
        where: { groupId: data.groupId },
      });

      if (existing) {
        throw new Error('Group already has a recurring poll schedule');
      }

      // Вычисляем nextRunAt
      const nextRun = this.calculateNextRun(
        data.daysOfWeek,
        data.timeOfDay
      );

      // Создаём расписание
      const recurring = await prisma.recurringPoll.create({
        data: {
          groupId: data.groupId,
          daysOfWeek: typeof data.daysOfWeek === 'string' 
            ? data.daysOfWeek 
            : JSON.stringify(data.daysOfWeek),
          timeOfDay: data.timeOfDay,
          duration: data.duration,
          selectedMenuItemIds: data.selectedMenuItemIds 
            ? (typeof data.selectedMenuItemIds === 'string'
                ? data.selectedMenuItemIds
                : JSON.stringify(data.selectedMenuItemIds))
            : null,
          createdBy: data.createdBy,
          nextRunAt: nextRun,
        },
      });

      logger.info('Recurring poll created', {
        id: recurring.id,
        groupId: recurring.groupId,
        daysOfWeek: data.daysOfWeek,
        timeOfDay: data.timeOfDay,
        nextRun: nextRun.toISOString(),
      });

      return recurring;
    } catch (error) {
      logger.error('Error creating recurring poll:', error);
      throw error;
    }
  }

  /**
   * Обновление расписания
   */
  static async updateRecurring(
    id: number,
    data: UpdateRecurringPollData
  ): Promise<RecurringPoll> {
    try {
      const existing = await prisma.recurringPoll.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Recurring poll not found');
      }

      // Парсим текущие дни если не обновляем
      const daysOfWeek = data.daysOfWeek || JSON.parse(existing.daysOfWeek);
      const timeOfDay = data.timeOfDay || existing.timeOfDay;

      // Валидация если обновляем время
      if (data.timeOfDay && !this.isValidTime(data.timeOfDay)) {
        throw new Error('Invalid time format. Use HH:MM');
      }

      // Валидация длительности
      if (data.duration !== undefined && (data.duration < 5 || data.duration > 180)) {
        throw new Error('Duration must be between 5 and 180 minutes');
      }

      // Пересчитываем nextRunAt если изменились дни или время
      let nextRunAt = existing.nextRunAt;
      if (data.daysOfWeek || data.timeOfDay) {
        nextRunAt = this.calculateNextRun(daysOfWeek, timeOfDay);
      }

      // Обновляем
      const updateData: Prisma.RecurringPollUpdateInput = {
        ...(data.daysOfWeek && { 
          daysOfWeek: typeof data.daysOfWeek === 'string'
            ? data.daysOfWeek
            : JSON.stringify(data.daysOfWeek)
        }),
        ...(data.timeOfDay && { timeOfDay: data.timeOfDay }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.selectedMenuItemIds !== undefined && {
          selectedMenuItemIds: data.selectedMenuItemIds
            ? (typeof data.selectedMenuItemIds === 'string'
                ? data.selectedMenuItemIds
                : JSON.stringify(data.selectedMenuItemIds))
            : null,
        }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        nextRunAt,
      };

      const updated = await prisma.recurringPoll.update({
        where: { id },
        data: updateData,
      });

      logger.info('Recurring poll updated', {
        id: updated.id,
        changes: Object.keys(data),
      });

      return updated;
    } catch (error) {
      logger.error('Error updating recurring poll:', error);
      throw error;
    }
  }

  /**
   * Удаление расписания
   */
  static async deleteRecurring(id: number): Promise<void> {
    try {
      await prisma.recurringPoll.delete({
        where: { id },
      });

      logger.info('Recurring poll deleted', { id });
    } catch (error) {
      logger.error('Error deleting recurring poll:', error);
      throw error;
    }
  }

  /**
   * Включение/выключение расписания
   */
  static async toggleEnabled(id: number, isEnabled: boolean): Promise<RecurringPoll> {
    try {
      const updated = await prisma.recurringPoll.update({
        where: { id },
        data: { isEnabled },
      });

      logger.info('Recurring poll toggled', { id, isEnabled });
      return updated;
    } catch (error) {
      logger.error('Error toggling recurring poll:', error);
      throw error;
    }
  }

  /**
   * Получение расписания группы
   */
  static async getByGroupId(groupId: number): Promise<RecurringPollWithRelations | null> {
    try {
      return await prisma.recurringPoll.findUnique({
        where: { groupId },
        include: {
          group: {
            select: {
              id: true,
              telegramId: true,
              title: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error getting recurring poll by group:', error);
      throw error;
    }
  }

  /**
   * Получение всех активных расписаний для scheduler
   */
  static async getActiveSchedules(): Promise<RecurringPollWithRelations[]> {
    try {
      const now = new Date();

      return await prisma.recurringPoll.findMany({
        where: {
          isEnabled: true,
          nextRunAt: {
            lte: now,
          },
        },
        include: {
          group: {
            select: {
              id: true,
              telegramId: true,
              title: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error getting active schedules:', error);
      throw error;
    }
  }

  /**
   * Выполнение запланированного голосования
   */
  static async executeScheduledPoll(recurringId: number): Promise<{
    success: boolean;
    pollId?: number;
    status: RunStatus;
    message: string;
  }> {
    try {
      const recurring = await prisma.recurringPoll.findUnique({
        where: { id: recurringId },
        include: {
          group: true,
          creator: true,
        },
      });

      if (!recurring) {
        throw new Error('Recurring poll not found');
      }

      logger.info('Executing scheduled poll', {
        recurringId,
        groupId: recurring.groupId,
        timeOfDay: recurring.timeOfDay,
      });

      // 1. Проверка: не запускали ли уже сегодня
      if (recurring.lastRunAt && isSameDay(recurring.lastRunAt, new Date())) {
        logger.warn('Recurring poll already executed today', { recurringId });
        return {
          success: false,
          status: 'SKIPPED_CONFLICT',
          message: 'Already executed today',
        };
      }

      // 2. Проверка: нет ли активного голосования
      const existingPoll = await PollService.getActivePollInGroup(recurring.groupId);
      if (existingPoll) {
        await this.updateRunStatus(recurringId, 'SKIPPED_CONFLICT', 'Active poll already exists');
        
        logger.warn('Skipped scheduled poll - active poll exists', {
          recurringId,
          existingPollId: existingPoll.id,
        });

        return {
          success: false,
          status: 'SKIPPED_CONFLICT',
          message: 'Group already has an active poll',
        };
      }

      // 3. Получить блюда для голосования
      let menuItemIds: number[];
      
      if (recurring.selectedMenuItemIds) {
        menuItemIds = JSON.parse(recurring.selectedMenuItemIds);
      } else {
        const activeItems = await MenuService.getActiveMenuItems();
        if (activeItems.length < 2) {
          await this.updateRunStatus(recurringId, 'FAILED_NO_MENU', 'Not enough active menu items');
          
          logger.warn('Skipped scheduled poll - no menu items', { recurringId });

          return {
            success: false,
            status: 'FAILED_NO_MENU',
            message: 'Not enough active menu items (minimum 2 required)',
          };
        }
        menuItemIds = activeItems.map(item => item.id);
      }

      // 4. Создать голосование
      const poll = await PollService.createPoll({
        groupId: recurring.groupId,
        duration: recurring.duration,
        createdBy: recurring.createdBy,
      });

      // Сохраняем selectedMenuItemIds в poll
      await prisma.poll.update({
        where: { id: poll.id },
        data: {
          selectedMenuItemIds: JSON.stringify(menuItemIds),
        },
      });

      // 5. Отправить сообщение в группу (если есть bot instance)
      if (botInstance) {
        try {
          const { createCompactPollMessage, createCompactPollKeyboard } = await import('../bot/keyboards/poll.keyboard');
          
          const message = createCompactPollMessage(poll, menuItemIds.length, 0);
          const keyboard = createCompactPollKeyboard(poll.id);

          const sentMessage = await botInstance.api.sendMessage(
            Number(recurring.group.telegramId),
            message,
            {
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            }
          );

          // Сохраняем messageId и chatId
          await prisma.poll.update({
            where: { id: poll.id },
            data: {
              messageId: sentMessage.message_id,
              chatId: recurring.group.telegramId,
            },
          });

          logger.info('Scheduled poll message sent', {
            pollId: poll.id,
            messageId: sentMessage.message_id,
          });
        } catch (sendError) {
          logger.error('Error sending scheduled poll message:', sendError);
          // Не прерываем выполнение - poll создан, просто сообщение не отправлено
        }
      }

      // 6. Запланировать напоминания и авто-завершение
      const { PollReminderService } = await import('./poll-reminder.service');
      PollReminderService.scheduleReminders(
        poll.id,
        recurring.duration,
        recurring.group.telegramId
      );

      // 7. Обновить статус выполнения
      await this.updateRunStatus(recurringId, 'SUCCESS', `Poll ${poll.id} created`);

      logger.info('Scheduled poll executed successfully', {
        recurringId,
        pollId: poll.id,
      });

      return {
        success: true,
        pollId: poll.id,
        status: 'SUCCESS',
        message: 'Poll created successfully',
      };
    } catch (error) {
      logger.error('Error executing scheduled poll:', error);
      
      await this.updateRunStatus(
        recurringId,
        'FAILED_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        success: false,
        status: 'FAILED_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Обновление статуса последнего запуска
   */
  private static async updateRunStatus(
    recurringId: number,
    status: RunStatus,
    message: string
  ): Promise<void> {
    try {
      const recurring = await prisma.recurringPoll.findUnique({
        where: { id: recurringId },
      });

      if (!recurring) return;

      const now = new Date();
      const daysOfWeek = JSON.parse(recurring.daysOfWeek);
      const nextRun = this.calculateNextRun(daysOfWeek, recurring.timeOfDay);

      await prisma.recurringPoll.update({
        where: { id: recurringId },
        data: {
          lastRunAt: now,
          lastRunStatus: status,
          lastRunMessage: message,
          nextRunAt: nextRun,
        },
      });
    } catch (error) {
      logger.error('Error updating run status:', error);
    }
  }

  /**
   * Вычисление следующего времени запуска
   */
  static calculateNextRun(daysOfWeek: number[], timeOfDay: string): Date {
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    // Проверяем сегодняшний день
    const todayScheduled = new Date(now);
    todayScheduled.setHours(hours, minutes, 0, 0);
    
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
    
    // Если сегодня подходящий день И время ещё не прошло
    if (daysOfWeek.includes(currentDay) && timeOfDay > currentTime) {
      return todayScheduled;
    }

    // Иначе начинаем с завтрашнего дня
    let nextDate = addDays(now, 1);
    nextDate.setHours(hours, minutes, 0, 0);

    // Ищем ближайший день из daysOfWeek
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = nextDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      if (daysOfWeek.includes(dayOfWeek)) {
        return nextDate;
      }
      
      nextDate = addDays(nextDate, 1);
    }

    // Fallback: если не нашли (не должно случиться)
    return addDays(now, 1);
  }

  /**
   * Получение истории запусков  }

  /**
   * Получение истории запусков (последние N дней)
   */
  static async getExecutionHistory(
    groupId: number,
    limit: number = 7
  ): Promise<Array<{
    date: Date;
    status: string;
    pollId?: number;
    voteCount?: number;
  }>> {
    try {
      // Получаем polls созданные автоматически за последние N дней
      const startDate = addDays(new Date(), -limit);

      const polls = await prisma.poll.findMany({
        where: {
          groupId,
          createdAt: {
            gte: startDate,
          },
          // TODO: добавить поле isAutomatic в Poll модель для фильтрации
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { votes: true },
          },
        },
        take: limit,
      });

      return polls.map(poll => ({
        date: poll.startedAt,
        status: poll.status,
        pollId: poll.id,
        voteCount: poll._count.votes,
      }));
    } catch (error) {
      logger.error('Error getting execution history:', error);
      return [];
    }
  }

  /**
   * Валидация формата времени HH:MM
   */
  private static isValidTime(time: string): boolean {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time);
  }

  /**
   * Получение всех расписаний (для админ-панели)
   */
  static async getAllSchedules(): Promise<RecurringPollWithRelations[]> {
    try {
      return await prisma.recurringPoll.findMany({
        include: {
          group: {
            select: {
              id: true,
              telegramId: true,
              title: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      logger.error('Error getting all schedules:', error);
      throw error;
    }
  }

  /**
   * Проверка прав доступа (пользователь админ группы)
   */
  static async checkAdminAccess(userId: number, groupId: number): Promise<boolean> {
    try {
      // Проверяем что пользователь суперадмин
      const user = await UserService.getUserById(userId);
      if (user?.isAdmin) {
        return true;
      }

      // Проверяем что пользователь админ в этой группе
      const member = await prisma.groupMember.findFirst({
        where: {
          userId,
          groupId,
          isActive: true,
          role: {
            in: ['ADMIN', 'CREATOR'],
          },
        },
      });

      return !!member;
    } catch (error) {
      logger.error('Error checking admin access:', error);
      return false;
    }
  }

  /**
   * Форматирование расписания для отображения
   */
  static formatSchedule(recurring: RecurringPoll): string {
    const daysOfWeek = JSON.parse(recurring.daysOfWeek) as number[];
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    let daysStr: string;
    if (daysOfWeek.length === 7) {
      daysStr = 'Каждый день';
    } else if (JSON.stringify(daysOfWeek) === JSON.stringify([1,2,3,4,5])) {
      daysStr = 'Пн-Пт';
    } else if (JSON.stringify(daysOfWeek) === JSON.stringify([6,0])) {
      daysStr = 'Выходные';
    } else {
      daysStr = daysOfWeek.map(d => dayNames[d]).join(', ');
    }

    return `${daysStr} в ${recurring.timeOfDay} (${recurring.duration} мин)`;
  }

  /**
   * Получение информации о следующем запуске
   */
  static getNextRunInfo(recurring: RecurringPoll): string {
    if (!recurring.nextRunAt) {
      return 'Не запланировано';
    }

    const now = new Date();
    const nextRun = new Date(recurring.nextRunAt);
    const diffMs = nextRun.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 1) {
      return `Через ${diffMinutes} мин`;
    } else if (diffHours < 24) {
      return `Через ${diffHours} ч`;
    } else {
      return format(nextRun, 'dd.MM в HH:mm');
    }
  }
}


