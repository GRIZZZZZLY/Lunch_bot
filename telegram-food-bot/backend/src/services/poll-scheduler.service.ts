import cron from 'node-cron';
import { logger } from '../utils/logger';
import { RecurringPollService } from './recurring-poll.service';

/**
 * Сервис для автоматического запуска голосований по расписанию
 * Проверяет каждую минуту наличие запланированных голосований
 */
export class PollSchedulerService {
  private static cronJob: cron.ScheduledTask | null = null;
  private static isRunning = false;
  private static botInstance: any = null;

  /**
   * Инициализация scheduler с bot instance
   */
  static initialize(bot: any): void {
    this.botInstance = bot;
    logger.info('PollSchedulerService bot instance initialized');
  }

  /**
   * Запуск scheduler (каждую минуту)
   */
  static start(): void {
    if (this.cronJob) {
      logger.warn('Poll scheduler already running');
      return;
    }

    // Проверяем каждую минуту (timezone: Europe/Moscow, UTC+3)
    this.cronJob = cron.schedule(
      '* * * * *', // Каждую минуту
      async () => {
        await this.checkAndExecuteSchedules();
      },
      {
        timezone: 'Europe/Moscow',
      }
    );

    logger.info('✅ Poll scheduler started (checking every minute, timezone: Europe/Moscow)');
  }

  /**
   * Остановка scheduler
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Poll scheduler stopped');
    }
  }

  /**
   * Проверка и выполнение запланированных голосований
   */
  private static async checkAndExecuteSchedules(): Promise<void> {
    // Предотвращаем параллельное выполнение
    if (this.isRunning) {
      logger.debug('Scheduler already running, skipping this tick');
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

      logger.debug('Checking schedules', {
        time: currentTime,
        day: currentDay,
      });

      // Получить все активные расписания
      const schedules = await RecurringPollService.getActiveSchedules();

      if (schedules.length === 0) {
        logger.debug('No active schedules found');
        return;
      }

      logger.info(`Found ${schedules.length} active schedule(s) to check`);

      // Проверяем каждое расписание
      for (const schedule of schedules) {
        try {
          const daysOfWeek = JSON.parse(schedule.daysOfWeek) as number[];

          // Проверка: подходит ли день недели
          if (!daysOfWeek.includes(currentDay)) {
            logger.debug('Skipping schedule - wrong day', {
              scheduleId: schedule.id,
              currentDay,
              allowedDays: daysOfWeek,
            });
            continue;
          }

          // Проверка: подходит ли время
          if (schedule.timeOfDay !== currentTime) {
            logger.debug('Skipping schedule - wrong time', {
              scheduleId: schedule.id,
              currentTime,
              scheduledTime: schedule.timeOfDay,
            });
            continue;
          }

          // Проверка: не выполняли ли уже сегодня
          if (schedule.lastRunAt) {
            const lastRun = new Date(schedule.lastRunAt);
            const isSameDay = 
              lastRun.getDate() === now.getDate() &&
              lastRun.getMonth() === now.getMonth() &&
              lastRun.getFullYear() === now.getFullYear();

            if (isSameDay) {
              logger.debug('Skipping schedule - already executed today', {
                scheduleId: schedule.id,
                lastRunAt: schedule.lastRunAt,
              });
              continue;
            }
          }

          // Все проверки пройдены - запускаем голосование
          logger.info('⚡ Executing scheduled poll', {
            scheduleId: schedule.id,
            groupId: schedule.groupId,
            groupTitle: schedule.group.title,
            timeOfDay: schedule.timeOfDay,
          });

          const result = await RecurringPollService.executeScheduledPoll(schedule.id);

          logger.info('Scheduled poll execution result', {
            scheduleId: schedule.id,
            success: result.success,
            status: result.status,
            pollId: result.pollId,
            message: result.message,
          });

          // Отправить уведомление админу
          if (this.botInstance) {
            await this.notifyAdmin(schedule, result);
          }
        } catch (error) {
          logger.error('Error processing schedule', {
            scheduleId: schedule.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Error in checkAndExecuteSchedules:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Отправка уведомления админу о результате выполнения
   */
  private static async notifyAdmin(
    schedule: any,
    result: { success: boolean; pollId?: number; status: string; message: string }
  ): Promise<void> {
    if (!this.botInstance) return;

    try {
      const adminTelegramId = Number(schedule.creator.telegramId);
      const groupTitle = schedule.group.title;

      if (result.success && result.pollId) {
        // Успешное создание
        await this.botInstance.api.sendMessage(
          adminTelegramId,
          `✅ *Автоматическое голосование создано!*\n\n` +
          `📍 Группа: ${groupTitle}\n` +
          `⏰ Время: ${schedule.timeOfDay}\n` +
          `🍽️ Блюд: ${schedule.selectedMenuItemIds ? JSON.parse(schedule.selectedMenuItemIds).length : 'все активные'}\n` +
          `⏱️ Длительность: ${schedule.duration} мин\n\n` +
          `Голосование #${result.pollId} активно!`,
          { parse_mode: 'Markdown' }
        );
      } else if (result.status === 'SKIPPED_CONFLICT') {
        // Пропущено - конфликт
        await this.botInstance.api.sendMessage(
          adminTelegramId,
          `⚠️ *Автоголосование пропущено*\n\n` +
          `📍 Группа: ${groupTitle}\n` +
          `❗ Причина: Уже есть активное голосование\n\n` +
          `Следующая попытка: ${RecurringPollService.getNextRunInfo(schedule)}`,
          { parse_mode: 'Markdown' }
        );
      } else if (result.status === 'FAILED_NO_MENU') {
        // Ошибка - меню пусто
        const webAppUrl = process.env.WEBAPP_URL || '';
        
        await this.botInstance.api.sendMessage(
          adminTelegramId,
          `❌ *Автоголосование не создано*\n\n` +
          `📍 Группа: ${groupTitle}\n` +
          `❗ Причина: Нет активных блюд в меню (минимум 2)\n\n` +
          `🔧 *Что делать:*\n` +
          `1. Добавьте блюда через Mini App → Меню\n` +
          `2. Или временно отключите автоголосования\n\n` +
          `Следующая попытка: ${RecurringPollService.getNextRunInfo(schedule)}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🍽️ Настроить меню', web_app: { url: `${webAppUrl}/menu` } },
                ],
                [
                  { text: '⏸️ Отключить авто', callback_data: `recurring:disable:${schedule.id}` },
                ],
              ],
            },
          }
        );
      } else if (result.status === 'FAILED_ERROR') {
        // Другая ошибка
        await this.botInstance.api.sendMessage(
          adminTelegramId,
          `❌ *Ошибка автоголосования*\n\n` +
          `📍 Группа: ${groupTitle}\n` +
          `❗ Ошибка: ${result.message}\n\n` +
          `Следующая попытка: ${RecurringPollService.getNextRunInfo(schedule)}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      logger.error('Error notifying admin:', error);
    }
  }

  /**
   * Обработка callback query для отключения расписания
   */
  static async handleDisableCallback(scheduleId: number): Promise<void> {
    try {
      await RecurringPollService.toggleEnabled(scheduleId, false);
      logger.info('Recurring poll disabled via callback', { scheduleId });
    } catch (error) {
      logger.error('Error disabling recurring poll:', error);
      throw error;
    }
  }
}
