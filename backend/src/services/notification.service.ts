import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  NotificationType,
  NotificationPriority,
  NotificationData,
  NotificationResult,
} from '../types/notification.types';
import { now } from '../utils/date';
import { getBotInstance } from '../bot/bot-instance';

/**
 * Транспорт уведомлений: одна точка, через которую проект говорит с Telegram.
 *
 * Здесь осталось только то, что не знает предметной области, — отправка
 * одному и многим, проверка заглушения и счётчики. Домены переехали:
 * голосования в `poll-notification.service.ts`, магазинные забеги в
 * `store-run-notification.service.ts`. До разреза оба жили тут же и не
 * пересекались ничем, кроме `send`: ~550 строк про закупки приехали в файл
 * про опросы по признаку «уведомления же».
 *
 * Ссылку на бота сервис не хранит. Своё поле `this.bot` плюс `initialize(bot)`
 * были ПЯТОЙ реализацией одного и того же хранилища в проекте, и она давала
 * тихий отказ: `poll.handlers.ts` создавал сервис через
 * `new NotificationService()`, `initialize` на этом экземпляре никто не
 * вызывал, и уведомление ответственному за заказ каждый раз возвращало
 * `success: false, error: 'Bot not initialized'` — в логах это выглядело как
 * ошибка доставки, а не как отсутствие бота.
 *
 * Теперь бот берётся из `bot/bot-instance`. Экземпляр читается в локальную
 * `const` один раз на операцию: между проверкой и вызовом он не может
 * обнулиться (та же причина, по которой в задаче 01 сняли не проверки, а
 * повторные чтения).
 */
export class NotificationService {
  /**
   * Отправить базовое уведомление
   */
  async send(data: NotificationData): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      const bot = getBotInstance();
      if (!bot) {
        throw new Error('Bot not initialized');
      }

      // Проверяем, не заглушен ли пользователь
      const isMuted = await this.isUserMuted(data.userId);
      if (isMuted) {
        logger.info(`User ${data.userId} is muted, skipping notification`);
        return {
          success: false,
          error: 'User is muted',
          sentAt: now(),
        };
      }

      // Отправляем сообщение
      const result = await bot.api.sendMessage(
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
        sentAt: now(),
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
        sentAt: now(),
      };
    }
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
    // userId здесь — Telegram chat ID (тот же, что уйдёт в bot.api.sendMessage),
    // а НЕ внутренний User.id. Раньше lookup шёл по `id: userId` и для всех
    // вызовов с настоящим telegramId (>10^8) возвращал null, из-за чего
    // `!user?.isActive` = `!undefined` = true → каждое уведомление молча
    // считалось "muted" и не отправлялось.
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(userId) },
        select: { isActive: true },
      });
      if (!user) {
        // Нет такого пользователя в нашей БД — не муть, пусть bot.api отвечает за себя.
        return false;
      }
      return !user.isActive;
    } catch (error) {
      logger.error('Error checking if user is muted', { userId, error });
      return false;
    }
  }

  /**
   * Получить статистику уведомлений
   */
  async getStats(): Promise<{
    paymentReminders: number;
    pollNotifications: number;
    totalReminders: number;
  }> {
    try {
      // Считаем payment reminders
      const paymentRemindersCount = await prisma.paymentReminder.count();
      
      // Считаем admin reminders (poll notifications)
      const adminRemindersCount = await prisma.adminReminder.count();
      
      return {
        paymentReminders: paymentRemindersCount,
        pollNotifications: adminRemindersCount,
        totalReminders: paymentRemindersCount + adminRemindersCount,
      };
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      return {
        paymentReminders: 0,
        pollNotifications: 0,
        totalReminders: 0,
      };
    }
  }

  /**
   * Проверить, что бот состоит в целевой группе и может туда писать.
   * Используется как pre-check перед созданием забега: если бота выгнали
   * из группы, создавать забег бессмысленно — уведомление не доставится.
   * Возвращает false при любой неопределённости (бот не инициализирован,
   * группа не найдена, getChatMember упал с 403 «kicked»).
   *
   * Остался в транспорте, хотя план относил его к домену забегов: это вопрос
   * «доставим ли мы вообще в этот чат», и спрашивают его оба домена —
   * `store-run.controller` перед созданием забега и `recurring-poll.service`
   * перед постановкой регулярного голосования. В домене забегов он заставил
   * бы домен опросов импортировать чужой сервис.
   */
  async botCanPostToGroup(groupId: number): Promise<boolean> {
    const bot = getBotInstance();
    if (!bot) {
      logger.error('botCanPostToGroup: bot not initialized', { groupId });
      return false;
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { telegramId: true },
    });
    if (!group) {
      logger.warn('botCanPostToGroup: group not found', { groupId });
      return false;
    }

    try {
      const botId = bot.botInfo.id;
      const member = await bot.api.getChatMember(Number(group.telegramId), botId);
      return member.status !== 'left' && member.status !== 'kicked';
    } catch (error: any) {
      logger.warn('botCanPostToGroup: membership check failed', {
        groupId,
        telegramId: String(group.telegramId),
        error: error?.message ?? error,
      });
      return false;
    }
  }
}

export const notificationService = new NotificationService();
