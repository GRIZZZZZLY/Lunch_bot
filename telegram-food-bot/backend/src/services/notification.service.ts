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
   * РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Р±РѕС‚Р° РґР»СЏ РѕС‚РїСЂР°РІРєРё СѓРІРµРґРѕРјР»РµРЅРёР№
   */
  initialize(bot: any): void {
    this.bot = bot;
    logger.info('Notification service initialized');
  }

  /**
   * РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ С€Р°Р±Р»РѕРЅРѕРІ СѓРІРµРґРѕРјР»РµРЅРёР№
   */
  private initializeTemplates(): Map<NotificationType, NotificationTemplate> {
    const templates = new Map<NotificationType, NotificationTemplate>();

    // РЁР°Р±Р»РѕРЅ РґР»СЏ РЅР°С‡Р°Р»Р° РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
    templates.set(NotificationType.POLL_STARTED, {
      type: NotificationType.POLL_STARTED,
      getTitle: (data: PollStartedNotificationData) => 'рџ—іпёЏ РќР°С‡Р°Р»РѕСЃСЊ РіРѕР»РѕСЃРѕРІР°РЅРёРµ!',
      getMessage: (data: PollStartedNotificationData) => {
        let message = `рџ“ў Р’ РіСЂСѓРїРїРµ *${data.groupTitle}* РЅР°С‡Р°Р»РѕСЃСЊ РЅРѕРІРѕРµ РіРѕР»РѕСЃРѕРІР°РЅРёРµ!\n\n`;
        message += `рџЌЅпёЏ Р”РѕСЃС‚СѓРїРЅРѕ Р±Р»СЋРґ: ${data.menuItems.length}\n`;
        if (data.endTime) {
          message += `вЏ° Р—Р°РІРµСЂС€РёС‚СЃСЏ: ${this.formatDate(data.endTime)}\n`;
        }
        message += `\nрџ‘‰ РџСЂРѕРіРѕР»РѕСЃСѓР№С‚Рµ РІ С‡Р°С‚Рµ РіСЂСѓРїРїС‹!`;
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.NORMAL,
    });

    // РЁР°Р±Р»РѕРЅ РґР»СЏ Р·Р°РІРµСЂС€РµРЅРёСЏ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
    templates.set(NotificationType.POLL_ENDED, {
      type: NotificationType.POLL_ENDED,
      getTitle: (data: PollEndedNotificationData) => 'вњ… Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р°РІРµСЂС€РµРЅРѕ!',
      getMessage: (data: PollEndedNotificationData) => {
        let message = `рџ“Љ Р“РѕР»РѕСЃРѕРІР°РЅРёРµ Р·Р°РІРµСЂС€РёР»РѕСЃСЊ!\n\n`;
        message += `рџ‘Ґ Р’СЃРµРіРѕ РіРѕР»РѕСЃРѕРІ: ${data.totalVotes}\n\n`;

        if (data.winnerItem) {
          message += `рџЏ† *РџРѕР±РµРґРёС‚РµР»СЊ:* ${data.winnerItem.name}\n`;
          if (data.winnerItem.price) {
            message += `рџ’° Р¦РµРЅР°: ${data.winnerItem.price} СЂСѓР±.\n`;
          }
        }

        if (data.topItems && data.topItems.length > 0) {
          message += `\nрџ“€ *РўРѕРї Р±Р»СЋРґ:*\n`;
          data.topItems.slice(0, 3).forEach((item, index) => {
            const emoji = ['рџҐ‡', 'рџҐ€', 'рџҐ‰'][index] || 'вЂў';
            message += `${emoji} ${item.item.name} - ${item.votes} РіРѕР»РѕСЃРѕРІ (${item.percentage}%)\n`;
          });
        }

        message += `\nрџЋІ РЎРµР№С‡Р°СЃ Р·Р°РїСѓСЃС‚РёС‚СЃСЏ СЂСѓР»РµС‚РєР° РґР»СЏ РІС‹Р±РѕСЂР° РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕРіРѕ...`;
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.HIGH,
    });

    // РЁР°Р±Р»РѕРЅ РґР»СЏ РїРѕР±РµРґРёС‚РµР»СЏ СЂСѓР»РµС‚РєРё
    templates.set(NotificationType.ROULETTE_WINNER, {
      type: NotificationType.ROULETTE_WINNER,
      getTitle: (data: RouletteWinnerNotificationData) => 'рџЋ‰ Р’С‹ РІС‹Р±СЂР°РЅС‹ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Рј!',
      getMessage: (data: RouletteWinnerNotificationData) => {
        let message = `рџЋЉ *РџРѕР·РґСЂР°РІР»СЏРµРј, ${data.winner.firstName}!*\n\n`;
        message += `Р СѓР»РµС‚РєР° РІС‹Р±СЂР°Р»Р° РІР°СЃ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Рј Р·Р° Р·Р°РєР°Р· РµРґС‹.\n\n`;

        if (data.winnerItem) {
          message += `рџЌЅпёЏ *Р—Р°РєР°Р·С‹РІР°РµРј:* ${data.winnerItem.name}\n`;
          if (data.winnerItem.price) {
            message += `рџ’° *Р¦РµРЅР°:* ${data.winnerItem.price} СЂСѓР±.\n`;
          }
          if (data.winnerItem.description) {
            message += `рџ“ќ ${data.winnerItem.description}\n`;
          }
        }

        message += `\nрџ‘Ґ *РљРѕР»РёС‡РµСЃС‚РІРѕ СѓС‡Р°СЃС‚РЅРёРєРѕРІ:* ${data.voters.length}\n`;
        message += `рџ“Љ *Р’СЃРµРіРѕ РіРѕР»РѕСЃРѕРІ:* ${data.totalVotes}\n`;

        if (data.orderDetails) {
          message += `\nрџ“‹ *Р”РµС‚Р°Р»Рё Р·Р°РєР°Р·Р°:*\n`;
          if (data.orderDetails.restaurant) {
            message += `рџЏЄ Р РµСЃС‚РѕСЂР°РЅ: ${data.orderDetails.restaurant}\n`;
          }
          if (data.orderDetails.deliveryTime) {
            message += `вЏ° Р’СЂРµРјСЏ РґРѕСЃС‚Р°РІРєРё: ${this.formatDate(data.orderDetails.deliveryTime)}\n`;
          }
          if (data.orderDetails.budget) {
            message += `рџ’µ Р‘СЋРґР¶РµС‚: ${data.orderDetails.budget} СЂСѓР±.\n`;
          }
        }

        message += `\nрџ“ќ *РЎР»РµРґСѓСЋС‰РёРµ С€Р°РіРё:*\n`;
        message += `1пёЏвѓЈ РЎРІСЏР¶РёС‚РµСЃСЊ СЃ СѓС‡Р°СЃС‚РЅРёРєР°РјРё\n`;
        message += `2пёЏвѓЈ РЎРѕР±РµСЂРёС‚Рµ РґРµРЅСЊРіРё\n`;
        message += `3пёЏвѓЈ РЎРґРµР»Р°Р№С‚Рµ Р·Р°РєР°Р·\n`;
        message += `4пёЏвѓЈ РћСЂРіР°РЅРёР·СѓР№С‚Рµ РґРѕСЃС‚Р°РІРєСѓ\n`;

        message += `\nрџ’Є РЈРґР°С‡Рё! Р’СЃРµ СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚ РЅР° РІР°СЃ!`;

        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.URGENT,
    });

    // РЁР°Р±Р»РѕРЅ РґР»СЏ РЅР°РїРѕРјРёРЅР°РЅРёСЏ Рѕ Р·Р°РєР°Р·Рµ
    templates.set(NotificationType.ORDER_REMINDER, {
      type: NotificationType.ORDER_REMINDER,
      getTitle: () => 'вЏ° РќР°РїРѕРјРёРЅР°РЅРёРµ Рѕ Р·Р°РєР°Р·Рµ',
      getMessage: (data: any) => {
        let message = `вЏ° *РќР°РїРѕРјРёРЅР°РЅРёРµ!*\n\n`;
        message += `РќРµ Р·Р°Р±СѓРґСЊС‚Рµ СЃРґРµР»Р°С‚СЊ Р·Р°РєР°Р· РµРґС‹.\n`;
        if (data.deadline) {
          message += `вЏ±пёЏ РљСЂР°Р№РЅРёР№ СЃСЂРѕРє: ${this.formatDate(data.deadline)}\n`;
        }
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.NORMAL,
    });

    return templates;
  }

  /**
   * РћС‚РїСЂР°РІРёС‚СЊ Р±Р°Р·РѕРІРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ
   */
  async send(data: NotificationData): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      if (!this.bot) {
        throw new Error('Bot not initialized');
      }

      // РџСЂРѕРІРµСЂСЏРµРј, РЅРµ Р·Р°РіР»СѓС€РµРЅ Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
      const isMuted = await this.isUserMuted(data.userId);
      if (isMuted) {
        logger.info(`User ${data.userId} is muted, skipping notification`);
        return {
          success: false,
          error: 'User is muted',
          sentAt: new Date(),
        };
      }

      // РћС‚РїСЂР°РІР»СЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ
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
   * РћС‚РїСЂР°РІРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ РїРѕР±РµРґРёС‚РµР»Рµ СЂСѓР»РµС‚РєРё
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
   * РћС‚РїСЂР°РІРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ Р·Р°РІРµСЂС€РµРЅРёРё РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
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
   * РћС‚РїСЂР°РІРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ РЅР°С‡Р°Р»Рµ РіРѕР»РѕСЃРѕРІР°РЅРёСЏ
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
   * РћС‚РїСЂР°РІРёС‚СЊ РєР°СЃС‚РѕРјРЅРѕРµ СѓРІРµРґРѕРјР»РµРЅРёРµ
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
   * РћС‚РїСЂР°РІРёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ РЅРµСЃРєРѕР»СЊРєРёРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј
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
   * РџСЂРѕРІРµСЂРёС‚СЊ, Р·Р°РіР»СѓС€РµРЅ Р»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ
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
   * Р¤РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґР°С‚С‹ РґР»СЏ СЃРѕРѕР±С‰РµРЅРёР№
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
   * РџРѕР»СѓС‡РёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ СѓРІРµРґРѕРјР»РµРЅРёР№
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
