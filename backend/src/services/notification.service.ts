import { Bot } from 'grammy';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  NotificationType,
  NotificationPriority,
  NotificationData,
  NotificationResult,
  RouletteWinnerNotificationData,
  PollEndedNotificationData,
  PollStartedNotificationData,
  NotificationTemplate,
} from '../types/notification.types';

export class NotificationService {
  private bot: any | null = null;
  private templates: Map<NotificationType, NotificationTemplate>;

  constructor() {
    this.templates = this.initializeTemplates();
  }

  /**
   * Инициализация бота для отправки уведомлений
   */
  initialize(bot: any): void {
    this.bot = bot;
    logger.info('Notification service initialized');
  }

  /**
   * Инициализация шаблонов уведомлений
   */
  private initializeTemplates(): Map<NotificationType, NotificationTemplate> {
    const templates = new Map<NotificationType, NotificationTemplate>();

    // Шаблон для начала голосования
    templates.set(NotificationType.POLL_STARTED, {
      type: NotificationType.POLL_STARTED,
      getTitle: (data: PollStartedNotificationData) => '🗳️ Началось голосование!',
      getMessage: (data: PollStartedNotificationData) => {
        let message = `📢 В группе *${data.groupTitle}* началось новое голосование!\n\n`;
        message += `🍽️ Доступно блюд: ${data.menuItems.length}\n`;
        if (data.endTime) {
          message += `⏰ Завершится: ${this.formatDate(data.endTime)}\n`;
        }
        message += `\n👉 Проголосуйте в чате группы!`;
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.NORMAL,
    });

    // Шаблон для завершения голосования
    templates.set(NotificationType.POLL_ENDED, {
      type: NotificationType.POLL_ENDED,
      getTitle: (data: PollEndedNotificationData) => '✅ Голосование завершено!',
      getMessage: (data: PollEndedNotificationData) => {
        let message = `📊 Голосование завершилось!\n\n`;
        message += `👥 Всего голосов: ${data.totalVotes}\n\n`;

        if (data.winnerItem) {
          message += `🏆 *Победитель:* ${data.winnerItem.name}\n`;
          if (data.winnerItem.price) {
            message += `💰 Цена: ${data.winnerItem.price} руб.\n`;
          }
        }

        if (data.topItems && data.topItems.length > 0) {
          message += `\n📈 *Топ блюд:*\n`;
          data.topItems.slice(0, 3).forEach((item, index) => {
            const emoji = ['🥇', '🥈', '🥉'][index] || '•';
            message += `${emoji} ${item.item.name} - ${item.votes} голосов (${item.percentage}%)\n`;
          });
        }

        message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.HIGH,
    });

    // Шаблон для победителя рулетки
    templates.set(NotificationType.ROULETTE_WINNER, {
      type: NotificationType.ROULETTE_WINNER,
      getTitle: (data: RouletteWinnerNotificationData) => '🎉 Вы выбраны ответственным!',
      getMessage: (data: RouletteWinnerNotificationData) => {
        let message = `🎊 *Поздравляем, ${data.winner.firstName}!*\n\n`;
        message += `Рулетка выбрала вас ответственным за заказ еды.\n\n`;

        if (data.winnerItem) {
          message += `🍽️ *Заказываем:* ${data.winnerItem.name}\n`;
          if (data.winnerItem.price) {
            message += `💰 *Цена:* ${data.winnerItem.price} руб.\n`;
          }
          if (data.winnerItem.description) {
            message += `📝 ${data.winnerItem.description}\n`;
          }
        }

        message += `\n👥 *Количество участников:* ${data.voters.length}\n`;
        message += `📊 *Всего голосов:* ${data.totalVotes}\n`;

        if (data.orderDetails) {
          message += `\n📋 *Детали заказа:*\n`;
          if (data.orderDetails.restaurant) {
            message += `🏪 Ресторан: ${data.orderDetails.restaurant}\n`;
          }
          if (data.orderDetails.deliveryTime) {
            message += `⏰ Время доставки: ${this.formatDate(data.orderDetails.deliveryTime)}\n`;
          }
          if (data.orderDetails.budget) {
            message += `💵 Бюджет: ${data.orderDetails.budget} руб.\n`;
          }
        }

        message += `\n📝 *Следующие шаги:*\n`;
        message += `1️⃣ Свяжитесь с участниками\n`;
        message += `2️⃣ Соберите деньги\n`;
        message += `3️⃣ Сделайте заказ\n`;
        message += `4️⃣ Организуйте доставку\n`;

        message += `\n💪 Удачи! Все рассчитывают на вас!`;

        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.URGENT,
    });

    // Шаблон для напоминания о заказе
    templates.set(NotificationType.ORDER_REMINDER, {
      type: NotificationType.ORDER_REMINDER,
      getTitle: () => '⏰ Напоминание о заказе',
      getMessage: (data: any) => {
        let message = `⏰ *Напоминание!*\n\n`;
        message += `Не забудьте сделать заказ еды.\n`;
        if (data.deadline) {
          message += `⏱️ Крайний срок: ${this.formatDate(data.deadline)}\n`;
        }
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.NORMAL,
    });

    return templates;
  }

  /**
   * Отправить базовое уведомление
   */
  async send(data: NotificationData): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      if (!this.bot) {
        throw new Error('Bot not initialized');
      }

      // Проверяем, не заглушен ли пользователь
      const isMuted = await this.isUserMuted(data.userId);
      if (isMuted) {
        logger.info(`User ${data.userId} is muted, skipping notification`);
        return {
          success: false,
          error: 'User is muted',
          sentAt: new Date(),
        };
      }

      // Отправляем сообщение
      const result = await this.bot.api.sendMessage(
        data.userId,
        data.message,
        {
          parse_mode: data.parseMode,
          reply_markup: data.replyMarkup,
          disable_notification: data.disableNotification,
        }
      );

      const deliveryTime = Date.now() - startTime;

      logger.info('Notification sent', {
        userId: data.userId,
        type: data.type,
        messageId: result.message_id,
        deliveryTime: `${deliveryTime}ms`,
      });

      return {
        success: true,
        messageId: result.message_id,
        sentAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Failed to send notification', {
        userId: data.userId,
        type: data.type,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        sentAt: new Date(),
      };
    }
  }

  /**
   * Отправить уведомление о победителе рулетки
   */
  async sendRouletteWinnerNotification(
    data: RouletteWinnerNotificationData
  ): Promise<NotificationResult> {
    const template = this.templates.get(NotificationType.ROULETTE_WINNER);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    return this.send({
      userId: data.winner.id,
      type: NotificationType.ROULETTE_WINNER,
      priority: template.priority,
      message,
      parseMode: template.parseMode,
    });
  }

  /**
   * Отправить уведомление о завершении голосования
   */
  async sendPollEndedNotification(
    userIds: number[],
    data: PollEndedNotificationData
  ): Promise<NotificationResult[]> {
    const template = this.templates.get(NotificationType.POLL_ENDED);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    const results = await Promise.all(
      userIds.map((userId) =>
        this.send({
          userId,
          type: NotificationType.POLL_ENDED,
          priority: template.priority,
          message,
          parseMode: template.parseMode,
        })
      )
    );

    return results;
  }

  /**
   * Отправить уведомление о начале голосования
   */
  async sendPollStartedNotification(
    userIds: number[],
    data: PollStartedNotificationData
  ): Promise<NotificationResult[]> {
    const template = this.templates.get(NotificationType.POLL_STARTED);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    const results = await Promise.all(
      userIds.map((userId) =>
        this.send({
          userId,
          type: NotificationType.POLL_STARTED,
          priority: template.priority,
          message,
          parseMode: template.parseMode,
        })
      )
    );

    return results;
  }

  /**
   * Отправить кастомное уведомление
   */
  async sendCustomNotification(
    userId: number,
    message: string,
    options?: {
      title?: string;
      priority?: NotificationPriority;
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      replyMarkup?: any;
    }
  ): Promise<NotificationResult> {
    let fullMessage = message;
    if (options?.title) {
      fullMessage = `*${options.title}*\n\n${message}`;
    }

    return this.send({
      userId,
      type: NotificationType.CUSTOM,
      priority: options?.priority || NotificationPriority.NORMAL,
      message: fullMessage,
      parseMode: options?.parseMode || 'Markdown',
      replyMarkup: options?.replyMarkup,
    });
  }

  /**
   * Отправить уведомление нескольким пользователям
   */
  async sendBulkNotification(
    userIds: number[],
    message: string,
    options?: {
      type?: NotificationType;
      priority?: NotificationPriority;
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    }
  ): Promise<NotificationResult[]> {
    const results = await Promise.all(
      userIds.map((userId) =>
        this.send({
          userId,
          type: options?.type || NotificationType.CUSTOM,
          priority: options?.priority || NotificationPriority.NORMAL,
          message,
          parseMode: options?.parseMode || 'Markdown',
        })
      )
    );

    const successCount = results.filter((r) => r.success).length;
    logger.info(`Bulk notification sent to ${successCount}/${userIds.length} users`);

    return results;
  }

  /**
   * Проверить, заглушен ли пользователь
   */
  private async isUserMuted(userId: number): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });

      return !user?.isActive;
    } catch (error) {
      logger.error('Error checking if user is muted', { userId, error });
      return false;
    }
  }

  /**
   * Форматирование даты для сообщений
   */
  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    };

    return new Intl.DateTimeFormat('ru-RU', options).format(date);
  }

  /**
   * Получить статистику уведомлений
   */
  async getStats(): Promise<any> {
    // TODO: Implement statistics collection
    return {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
    };
  }
}

export const notificationService = new NotificationService();
