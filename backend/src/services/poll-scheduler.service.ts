import cron, { type ScheduledTask } from 'node-cron';
import { Client } from 'pg';
import { logger } from '../utils/logger';
import { RecurringPollService } from './recurring-poll.service';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { PollCompletionService } from './poll-completion.service';

/**
 * Ключ Postgres advisory-lock для single-instance гарантии scheduler'а.
 * Только один процесс, удерживающий этот сессионный лок, поднимает cron —
 * остальные (orphan/дубль-деплой) не плодят параллельные автоголосования.
 * Держать в синхроне с тестом scheduler-poll.integration.test.ts.
 */
export const SCHEDULER_ADVISORY_LOCK_KEY = 918273645;

/**
 * Сервис для автоматического запуска голосований по расписанию
 * Проверяет каждую минуту наличие запланированных голосований
 */
export class PollSchedulerService {
  private static cronJob: ScheduledTask | null = null;
  private static isRunning = false;
  private static botInstance: any = null;
  // Выделенное соединение, удерживающее advisory-lock на время жизни процесса.
  private static lockClient: Client | null = null;

  /**
   * Инициализация scheduler с bot instance
   */
  static initialize(bot: any): void {
    this.botInstance = bot;
    logger.info('PollSchedulerService bot instance initialized');
  }

  /**
   * Запуск scheduler (каждую минуту).
   * Поднимает cron только если удалось захватить advisory-lock — иначе тихо
   * уступает другому процессу (защита от дубль-запуска, инцидент 2026-07-20).
   */
  static async start(): Promise<void> {
    if (this.cronJob) {
      logger.warn('Poll scheduler already running');
      return;
    }

    const acquired = await this.acquireSingletonLock();
    if (!acquired) {
      logger.warn(
        'Poll scheduler not started: another instance holds the advisory lock'
      );
      return;
    }

    // Проверяем каждую минуту (timezone: Europe/Moscow, UTC+3)
    this.cronJob = cron.schedule(
      '* * * * *', // Каждую минуту
      async () => {
        await this.checkAndExecuteSchedules();
        await this.closeExpiredPolls();
      },
      {
        timezone: 'Europe/Moscow',
      }
    );

    logger.info(
      '✅ Poll scheduler started (checking every minute, timezone: Europe/Moscow)'
    );
  }

  /**
   * Остановка scheduler + освобождение advisory-lock.
   */
  static async stop(): Promise<void> {
    if (this.cronJob) {
      void this.cronJob.stop();
      this.cronJob = null;
      logger.info('Poll scheduler stopped');
    }

    if (this.lockClient) {
      try {
        await this.lockClient.query('SELECT pg_advisory_unlock($1)', [
          SCHEDULER_ADVISORY_LOCK_KEY,
        ]);
      } catch {
        /* соединение могло уже отвалиться — лок снимется сам при разрыве */
      }
      try {
        await this.lockClient.end();
      } catch {
        /* ignore */
      }
      this.lockClient = null;
    }
  }

  /**
   * Пытается захватить сессионный advisory-lock на выделенном соединении.
   * true  — лок наш (или уже держим); false — держит другой процесс.
   * При ошибке/отсутствии DATABASE_URL — fail-open (доступность важнее; основную
   * защиту от дублей дают уник-индекс polls_one_active_per_group и деплой-гигиена).
   */
  private static async acquireSingletonLock(): Promise<boolean> {
    if (this.lockClient) return true;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.error(
        'acquireSingletonLock: DATABASE_URL not set; running without single-instance guard'
      );
      return true;
    }

    const client = new Client({ connectionString: databaseUrl });
    client.on('error', err => logger.error('Scheduler lock client error', err));

    try {
      await client.connect();
      const res = await client.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [SCHEDULER_ADVISORY_LOCK_KEY]
      );
      if (res.rows[0]?.locked === true) {
        this.lockClient = client; // держим соединение → держим лок
        return true;
      }
      await client.end();
      return false;
    } catch (err) {
      logger.error(
        'acquireSingletonLock failed; running without single-instance guard',
        err
      );
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      return true;
    }
  }

  /**
   * Тихо отменяет голосования с истёкшим таймером (вариант B — без постинга
   * результатов в группу). Обёртка с try/catch, чтобы сбой не рвал cron-тик.
   */
  private static async closeExpiredPolls(): Promise<void> {
    try {
      const n = await PollCompletionService.cancelExpiredPolls();
      if (n > 0)
        logger.info(`Poll scheduler: auto-cancelled ${n} expired poll(s)`);
    } catch (error) {
      logger.error('Poll scheduler: cancelExpiredPolls failed', error);
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

          const result = await RecurringPollService.executeScheduledPoll(
            schedule.id
          );

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
    result: {
      success: boolean;
      pollId?: number;
      status: string;
      message: string;
    }
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
                  {
                    text: '🍽️ Настроить меню',
                    web_app: { url: `${webAppUrl}/menu` },
                  },
                ],
                [
                  {
                    text: '⏸️ Отключить авто',
                    callback_data: `recurring:disable:${schedule.id}`,
                  },
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
  static async handleDisableCallback(
    scheduleId: number,
    telegramUserId: number
  ): Promise<boolean> {
    try {
      const schedule = await RecurringPollService.getById(scheduleId);
      const user = await UserService.getUserByTelegramId(
        BigInt(telegramUserId)
      );
      if (
        !schedule ||
        !user ||
        !(await RecurringPollService.checkAdminAccess(
          user.id,
          schedule.groupId
        ))
      ) {
        return false;
      }

      await RecurringPollService.toggleEnabled(scheduleId, false);
      logger.info('Recurring poll disabled via callback', { scheduleId });
      return true;
    } catch (error) {
      logger.error('Error disabling recurring poll:', error);
      throw error;
    }
  }
}
