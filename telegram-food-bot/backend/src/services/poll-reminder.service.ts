import { logger } from '../utils/logger';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { VoteService } from './vote.service';

interface ScheduledReminder {
  pollId: number;
  timers: {
    tenMinutes?: NodeJS.Timeout;
    twoMinutes?: NodeJS.Timeout;
    finalCall?: NodeJS.Timeout;
  };
}

/**
 * Сервис для планирования и отправки напоминаний о голосовании
 */
export class PollReminderService {
  private static reminders = new Map<number, ScheduledReminder>();
  private static botInstance: any = null;

  /**
   * Инициализация с инстансом бота
   */
  static initialize(bot: any): void {
    this.botInstance = bot;
    logger.info('PollReminderService initialized');
  }

  /**
   * Планирование напоминаний для нового голосования
   */
  static scheduleReminders(pollId: number, durationMinutes: number, chatId: bigint): void {
    // UX UPGRADE (Фаза 1.5): ОТКЛЮЧЕНО - вместо 3 сообщений используется 1 live-обновляемое
    // Основное сообщение обновляется каждую минуту с изменением emoji (⏰ → ⚠️ → 🔥)
    logger.info(`[UX] Reminder notifications DISABLED for poll ${pollId} (using live updates instead)`);
    
    // Сохраняем пустую запись для обратной совместимости
    this.reminders.set(pollId, { pollId, timers: {} });
  }

  /**
   * Отправка напоминания о голосовании
   */
  private static async sendReminderNotification(
    pollId: number,
    chatId: bigint,
    minutesRemaining: number
  ): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId);
      
      if (!poll || poll.status !== 'ACTIVE') {
        logger.warn(`Poll ${pollId} is not active, skipping reminder`);
        return;
      }

      const totalUsers = poll.votes?.length || 0;
      const uniqueVoters = new Set(poll.votes?.map(v => v.userId) || []).size;

      const message = 
        `⏰ **Осталось ${minutesRemaining} минут!**\n\n` +
        `🗳️ Голосование скоро завершится\n` +
        `👥 Уже проголосовало: ${uniqueVoters}\n\n` +
        `💡 Не забудь проголосовать, если еще не сделал этого!`;

      await this.botInstance.api.sendMessage(Number(chatId), message, {
        parse_mode: 'Markdown',
      });

      logger.info(`Sent ${minutesRemaining}-minute reminder for poll ${pollId}`);

      // Отправляем персональные напоминания непроголосовавшим (опционально)
      await this.sendPersonalReminders(pollId, minutesRemaining);

    } catch (error) {
      logger.error(`Error sending reminder notification for poll ${pollId}:`, error);
    }
  }

  /**
   * Финальное напоминание (последний шанс)
   */
  private static async sendFinalCallNotification(
    pollId: number,
    chatId: bigint
  ): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId);
      
      if (!poll || poll.status !== 'ACTIVE') {
        return;
      }

      const uniqueVoters = new Set(poll.votes?.map(v => v.userId) || []).size;

      const message =
        `🚨 *Последний шанс*\n` +
        `До конца голосования 30 секунд. Проголосовало: ${uniqueVoters}.`;

      await this.botInstance.api.sendMessage(Number(chatId), message, {
        parse_mode: 'Markdown',
      });

      logger.info(`Sent final call notification for poll ${pollId}`);

    } catch (error) {
      logger.error(`Error sending final call notification for poll ${pollId}:`, error);
    }
  }

  /**
   * Отправка персональных напоминаний непроголосовавшим пользователям
   */
  private static async sendPersonalReminders(
    pollId: number,
    minutesRemaining: number
  ): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId);
      if (!poll || !poll.group) return;

      // Получаем всех пользователей группы
      const groupMembers = await UserService.getUsersByGroupId(poll.group.id);
      
      // Фильтруем тех, кто еще не проголосовал
      const votedUserIds = new Set(poll.votes?.map(v => v.userId) || []);
      const notVotedUsers = groupMembers.filter((user: any) => !votedUserIds.has(user.id));

      // Отправляем персональные уведомления (максимум 50 за раз)
      const usersToNotify = notVotedUsers.slice(0, 50);
      
      for (const user of usersToNotify) {
        try {
          await this.botInstance.api.sendMessage(
            Number(user.telegramId),
            `👋 **Привет, ${user.firstName}!**\n\n` +
            `⏰ Осталось ${minutesRemaining} минут до окончания голосования\n` +
            `🗳️ Не забудь проголосовать!\n\n` +
            `💡 Нажми кнопку ниже, чтобы быстро проголосовать`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📱 Проголосовать', callback_data: `openpoll:${pollId}` }]
                ]
              }
            }
          );

          // Небольшая задержка между отправками
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (userError: any) {
          // Игнорируем ошибки (пользователь мог заблокировать бота)
          if (!userError.description?.includes('blocked')) {
            logger.warn(`Failed to send personal reminder to user ${user.id}:`, userError.description);
          }
        }
      }

      logger.info(`Sent personal reminders to ${usersToNotify.length} users for poll ${pollId}`);

    } catch (error) {
      logger.error(`Error sending personal reminders for poll ${pollId}:`, error);
    }
  }

  /**
   * Отмена всех напоминаний для голосования
   */
  static cancelReminders(pollId: number): void {
    const reminder = this.reminders.get(pollId);
    
    if (reminder) {
      // Очищаем все таймеры
      if (reminder.timers.tenMinutes) clearTimeout(reminder.timers.tenMinutes);
      if (reminder.timers.twoMinutes) clearTimeout(reminder.timers.twoMinutes);
      if (reminder.timers.finalCall) clearTimeout(reminder.timers.finalCall);
      
      this.reminders.delete(pollId);
      logger.info(`Cancelled reminders for poll ${pollId}`);
    }
  }

  /**
   * Отмена всех активных напоминаний (при остановке бота)
   */
  static cancelAllReminders(): void {
    for (const [pollId] of this.reminders) {
      this.cancelReminders(pollId);
    }
    logger.info('Cancelled all reminders');
  }

  /**
   * Получение информации об активных напоминаниях
   */
  static getActiveReminders(): number[] {
    return Array.from(this.reminders.keys());
  }
}
