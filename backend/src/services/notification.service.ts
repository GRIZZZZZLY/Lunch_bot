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
  PollCancelledNotificationData,
  NotificationTemplate,
} from '../types/notification.types';
import { User } from '@prisma/client';
import { toNumber } from '../utils/decimal';
import { now } from '../utils/date';
import { createDirectLinkMiniAppUrl } from '../bot/keyboards/webapp.keyboard';

/**
 * Вспомогательная функция для множественного числа
 */
function getPluralForm(count: number, one: string, few: string, many: string): string {
  if (count % 10 === 1 && count % 100 !== 11) return one;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return few;
  return many;
}

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
        message += `\nрџ‘‰ РџСЂРѕРіРѕР»РѕСЃСѓР№ РІ С‡Р°С‚Рµ РіСЂСѓРїРїС‹!`;
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
        // Проверка на пустое голосование
        if (data.totalVotes === 0) {
          return `🍃 Никто не проголосовал. Все на диете? Запусти новое голосование.`;
        }
        
        let message = `🗳️ Голосование завершилось!\n\n`;
        message += `👥 Всего голосов: ${data.totalVotes}\n\n`;

        // Multi-Winner режим
        if (data.mode === 'multi-winner' && data.winners) {
          if (data.winners.length > 0) {
            message += `🍽️ *Кто что заказывает:*\n\n`;
            data.winners.forEach((winner, index) => {
              const voterCount = winner.voters?.length || 0;
              const votersText = getPluralForm(voterCount, 'человек', 'человека', 'человек');
              message += `${index + 1}. *${winner.menuItemName}* — ${voterCount} ${votersText}\n`;
              
              if (winner.voters && winner.voters.length > 0) {
                const displayVoters = winner.voters.slice(0, 3);
                const voterNames = displayVoters.map(v => v.firstName).join(', ');
                message += `   👤 ${voterNames}`;
                if (winner.voters.length > 3) {
                  message += ` и ещё ${winner.voters.length - 3}`;
                }
                message += `\n`;
              }
              message += `\n`;
            });
          }

          if (data.bringOwn && data.bringOwn.count > 0) {
            const bringOwnText = getPluralForm(data.bringOwn.count, 'человек', 'человека', 'человек');
            message += `🥪 *Принесу своё:* ${data.bringOwn.count} ${bringOwnText}\n`;
            if (data.bringOwn.voters && data.bringOwn.voters.length > 0) {
              const names = data.bringOwn.voters.slice(0, 3).map(v => v.firstName).join(', ');
              message += `   👤 ${names}`;
              if (data.bringOwn.voters.length > 3) {
                message += ` и ещё ${data.bringOwn.voters.length - 3}`;
              }
              message += `\n`;
            }
            message += `\n`;
          }

          if (data.skipped && data.skipped.count > 0) {
            const skippedText = getPluralForm(data.skipped.count, 'человек', 'человека', 'человек');
            message += `⏭️ *Пропустили:* ${data.skipped.count} ${skippedText}\n\n`;
          }

          message += `✅ Заказ оформлен!`;
        } 
        // Single-Winner режим
        else {
          if (data.winnerItem) {
            message += `🏆 *Победитель:* ${data.winnerItem.name}\n`;
            if (data.winnerItem.price) {
              message += `💰 Цена: ${toNumber(data.winnerItem.price).toFixed(2)} руб.\n`;
            }
          }

          if (data.topItems && data.topItems.length > 0) {
            message += `\n📊 *Топ блюд:*\n`;
            data.topItems.slice(0, 3).forEach((item, index) => {
              const emoji = ['🥇', '🥈', '🥉'][index] || '•';
              message += `${emoji} ${item.item.name} - ${item.votes} ${getPluralForm(item.votes, 'голос', 'голоса', 'голосов')} (${item.percentage}%)\n`;
            });
          }

          message += `\n🎲 Сейчас запустится рулетка для выбора ответственного...`;
        }

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
        let message = `🎉 *Поздравляем, ${data.winner.firstName}!*\n\n`;
        message += `Рулетка выбрала тебя ответственным за заказ.\n\n`;

        if (data.winnerItem) {
          message += `🍽️ Заказываем: ${data.winnerItem.name}\n`;
          if (data.winnerItem.price) {
            message += `💰 Цена: ${toNumber(data.winnerItem.price).toFixed(2)} руб.\n`;
          }
        }

        message += `👥 Участников: ${data.voters.length}\n`;

        message += `\n*Что дальше:*\n`;
        message += `1. Собери заказы у участников\n`;
        message += `2. Оформи и собери деньги\n`;

        message += `\nРеквизиты и суммы уже у всех в личке.`;

        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.URGENT,
    });

    // Шаблон для отмены голосования
    templates.set(NotificationType.POLL_CANCELLED, {
      type: NotificationType.POLL_CANCELLED,
      getTitle: (data: PollCancelledNotificationData) => '❌ Голосование отменено',
      getMessage: (data: PollCancelledNotificationData) => {
        let message = `❌ Голосование отменено администратором ${data.cancelledBy.firstName}\n\n`;
        
        if (data.reason) {
          message += `📝 Причина: ${data.reason}\n\n`;
        }
        
        message += `👥 Проголосовало: ${data.totalVotes} чел.\n`;
        
        if (data.voters.length > 0) {
          message += `\n✅ Участники:\n`;
          data.voters.slice(0, 10).forEach(v => {
            message += `• ${v.firstName}${v.lastName ? ` ${  v.lastName}` : ''}\n`;
          });
          
          if (data.voters.length > 10) {
            message += `... и еще ${data.voters.length - 10}\n`;
          }
        }
        
        return message;
      },
      parseMode: 'Markdown',
      priority: NotificationPriority.NORMAL,
    });

    // РЁР°Р±Р»РѕРЅ РґР»СЏ РЅР°РїРѕРјРёРЅР°РЅРёСЏ Рѕ Р·Р°РєР°Р·Рµ
    templates.set(NotificationType.ORDER_REMINDER, {
      type: NotificationType.ORDER_REMINDER,
      getTitle: () => 'вЏ° РќР°РїРѕРјРёРЅР°РЅРёРµ Рѕ Р·Р°РєР°Р·Рµ',
      getMessage: (data: any) => {
        let message = `вЏ° *РќР°РїРѕРјРёРЅР°РЅРёРµ!*\n\n`;
        message += `РќРµ Р·Р°Р±СѓРґСЊ СЃРґРµР»Р°С‚СЊ Р·Р°РєР°Р· РµРґС‹.\n`;
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
          sentAt: now(),
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
      userId: Number(data.winner.telegramId),
      type: NotificationType.ROULETTE_WINNER,
      priority: template.priority,
      message,
      parseMode: template.parseMode,
    });
  }

  /**
   * Уведомить ответственного за заказ после рулетки
   * (используется в poll.handlers.ts)
   */
  async notifyResponsible(pollId: number, responsibleUserId: number): Promise<NotificationResult> {
    try {
      // Получаем детали голосования и результата
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          result: {
            include: {
              winnerMenuItem: true,
              responsibleUser: true,
            },
          },
          group: true,
        },
      });

      if (!poll || !poll.result) {
        throw new Error('Poll or poll result not found');
      }

      // Получаем список проголосовавших
      const votes = await prisma.vote.findMany({
        where: { pollId },
        include: {
          user: true,
        },
      });

      const voters = votes.map(vote => ({
        id: vote.user.id,
        firstName: vote.user.firstName,
        username: vote.user.username,
      }));

      const notificationData: RouletteWinnerNotificationData = {
        winner: poll.result.responsibleUser as any,
        poll: poll as any,
        winnerItem: poll.result.winnerMenuItem || undefined,
        voters: votes.map(v => v.user) as any,
        totalVotes: poll.result.totalVotes,
      };

      return await this.sendRouletteWinnerNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify responsible user', { pollId, responsibleUserId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sentAt: now(),
      };
    }
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
   * Обёртка: отправить уведомления о завершении по pollId
   * Автоматически определяет тип (Single/Multi Winner) и форматирует данные
   */
  async sendPollCompletionNotifications(pollId: number): Promise<NotificationResult[]> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          result: { include: { winnerMenuItem: true } },
          votes: { include: { user: true, menuItem: true } },
          group: true,
        }
      });

      if (!poll || !poll.result) {
        throw new Error('Poll or result not found');
      }

      let resultData: any = null;
      let mode: 'single-winner' | 'multi-winner' = 'single-winner';
      
      if (poll.result.rouletteData) {
        try {
          resultData = typeof poll.result.rouletteData === 'string'
            ? JSON.parse(poll.result.rouletteData)
            : poll.result.rouletteData;
          if (resultData?.mode === 'multi-winner') {
            mode = 'multi-winner';
          }
        } catch (e) {
          logger.warn('Failed to parse rouletteData, using single-winner mode');
        }
      }

      let data: PollEndedNotificationData;

      if (mode === 'multi-winner' && resultData) {
        data = {
          pollId,
          mode: 'multi-winner',
          totalVotes: poll.result.totalVotes,
          groupTitle: poll.group.title,
          winners: resultData.winners,
          bringOwn: resultData.bringOwn,
          skipped: resultData.skipped,
          tieBreak: resultData.meta?.tieBreak,
        };
      } else {
        const votesByItem = new Map<number, number>();
        poll.votes.forEach(vote => {
          if (vote.menuItemId) {
            votesByItem.set(vote.menuItemId, (votesByItem.get(vote.menuItemId) || 0) + 1);
          }
        });

        const topItems = Array.from(votesByItem.entries())
          .map(([itemId, votes]) => {
            const item = poll.votes.find(v => v.menuItemId === itemId)?.menuItem;
            return item ? {
              item: {
                id: item.id,
                name: item.name,
                description: item.description || undefined,
                price: item.price ? toNumber(item.price) : undefined,
              },
              votes,
              percentage: Math.round((votes / poll.votes.length) * 100)
            } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b!.votes - a!.votes);

        data = {
          pollId,
          mode: 'single-winner',
          totalVotes: poll.result.totalVotes,
          groupTitle: poll.group.title,
          winnerItem: poll.result.winnerMenuItem ? {
            id: poll.result.winnerMenuItem.id,
            name: poll.result.winnerMenuItem.name,
            description: poll.result.winnerMenuItem.description || undefined,
            price: poll.result.winnerMenuItem.price ? toNumber(poll.result.winnerMenuItem.price) : undefined,
          } : undefined,
          topItems: topItems as any,
        };
      }

      const voterIds = Array.from(new Set(poll.votes.map(v => v.userId)));
      
      // Отправляем уведомления голосовавшим
      const results = await this.sendPollEndedNotification(voterIds, data);

      // Групповые сообщения отключены для снижения шума

      return results;

    } catch (error) {
      logger.error('Failed to send poll completion notifications', { pollId, error });
      throw error;
    }
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
   * Отправка уведомлений об отмене голосования
   */
  async sendPollCancelledNotifications(
    pollId: number,
    cancelledBy: User,
    reason?: string
  ): Promise<void> {
    try {
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          group: true,
          votes: {
            include: { user: true },
            distinct: ['userId']
          }
        }
      });

      if (!poll) {
        logger.warn(`Poll not found for cancelled notifications: ${pollId}`);
        return;
      }

      const voters = poll.votes.map(v => v.user);
      const template = this.templates.get(NotificationType.POLL_CANCELLED);

      if (!template || !this.bot) {
        logger.warn('Template or bot not available for cancelled notifications');
        return;
      }

      const data: PollCancelledNotificationData = {
        poll,
        cancelledBy,
        reason,
        totalVotes: voters.length,
        voters
      };

      // Групповые сообщения отключены для снижения шума

      // Отправляем личные уведомления всем голосовавшим
      for (const voter of voters) {
        try {
          await this.send({
            userId: Number(voter.telegramId),
            type: NotificationType.POLL_CANCELLED,
            message: template.getMessage(data),
            parseMode: template.parseMode,
            priority: NotificationPriority.NORMAL
          });
        } catch (error) {
          logger.error(`Error sending notification to user ${voter.id}:`, error);
        }
      }

      logger.info(`Poll cancelled notifications sent: ${pollId}, voters: ${voters.length}`);
    } catch (error) {
      logger.error('Error sending poll cancelled notifications:', error);
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

  // ==================================================================
  // STORE RUN notifications ("Иду в магазин")
  // ==================================================================

  /**
   * Уведомить всех членов группы (кроме инициатора) о новом магазинном забеге.
   * Отправляется в личку с web_app кнопкой + инструкцией про текстовый ответ.
   */
  async notifyGroupMembersAboutStoreRun(
    storeRunId: number,
  ): Promise<NotificationResult[]> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) {
      logger.warn('notifyGroupMembersAboutStoreRun: run not found', { storeRunId });
      return [];
    }

    const members = await prisma.groupMember.findMany({
      where: {
        groupId: storeRun.groupId,
        isActive: true,
        userId: { not: storeRun.initiatorId },
        // Удалёнщик (participatesInPolls=false) не в офисе — магазин ему не нужен ни в каком кейсе.
        user: {
          isActive: true,
          participatesInPolls: true,
        },
      },
      include: { user: true },
    });
    if (members.length === 0) {
      logger.warn('notifyGroupMembersAboutStoreRun: no eligible recipients', {
        storeRunId,
        groupId: storeRun.groupId,
      });
      return [];
    }
    if (!this.bot) {
      logger.error('notifyGroupMembersAboutStoreRun: bot not initialized', { storeRunId });
      return [];
    }

    const webappUrl = process.env.WEBAPP_URL ?? '';
    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const collectUntilStr = storeRun.collectUntil.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const message =
      `🛒 <b>${this.escapeHtml(initiatorName)}</b> идёт в «${this.escapeHtml(storeName)}»\n\n` +
      `Напиши что тебе взять — сбор до ${collectUntilStr}.\n\n` +
      `<i>Нажми «📱 Заполнить заказ», чтобы открыть список.</i>`;

    const replyMarkup = webappUrl
      ? {
          inline_keyboard: [
            [
              {
                text: '📱 Заполнить заказ',
                web_app: { url: `${webappUrl}?storeRunId=${storeRunId}` },
              },
            ],
          ],
        }
      : undefined;

    const results: NotificationResult[] = [];
    const dmRefs: Array<{ chatId: number; messageId: number }> = [];
    for (const member of members) {
      const tgId = Number(member.user.telegramId);
      const result = await this.send({
        userId: tgId,
        type: NotificationType.STORE_RUN_STARTED,
        priority: NotificationPriority.NORMAL,
        message,
        parseMode: 'HTML',
        replyMarkup,
      });
      if (!result.success) {
        logger.warn('Store run DM failed for user', {
          storeRunId,
          internalUserId: member.userId,
          telegramId: tgId,
          firstName: member.user.firstName,
          error: result.error,
        });
      }
      results.push(result);
      if (result.success && result.messageId != null) {
        dmRefs.push({ chatId: tgId, messageId: result.messageId });
      }
    }

    try {
      await prisma.storeRun.update({
        where: { id: storeRunId },
        data: { dmMessages: JSON.stringify(dmRefs) },
      });
    } catch (persistError: any) {
      logger.warn('notifyGroupMembersAboutStoreRun: failed to persist dmMessages', {
        storeRunId,
        error: persistError?.message ?? persistError,
      });
    }

    const successful = results.filter((r) => r.success).length;
    logger.info('Store run start notifications sent', {
      storeRunId,
      recipients: members.length,
      successful,
      failed: members.length - successful,
    });

    return results;
  }

  /**
   * Уведомить участников, уже добавивших позиции, что инициатор в магазине
   * и приём заказов закрыт.
   */
  async notifyShoppingStarted(storeRunId: number): Promise<NotificationResult[]> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) return [];

    const items = await prisma.storeItem.findMany({
      where: { storeRunId },
      select: { userId: true },
    });
    const participantIds = Array.from(
      new Set(items.map((i) => i.userId).filter((id) => id !== storeRun.initiatorId)),
    );
    if (participantIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { in: participantIds },
        isActive: true,
        participatesInPolls: true,
      },
      select: { id: true, telegramId: true, firstName: true },
    });
    if (users.length === 0) return [];
    if (!this.bot) {
      logger.error('notifyShoppingStarted: bot not initialized', { storeRunId });
      return [];
    }

    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const message =
      `🛍 <b>${this.escapeHtml(initiatorName)}</b> пошёл в «${this.escapeHtml(storeName)}».\n` +
      `Сбор заказов закрыт, скоро будут цены.`;

    const results: NotificationResult[] = [];
    for (const u of users) {
      const result = await this.send({
        userId: Number(u.telegramId),
        type: NotificationType.STORE_RUN_SHOPPING,
        priority: NotificationPriority.NORMAL,
        message,
        parseMode: 'HTML',
      });
      results.push(result);
    }

    logger.info('Store run shopping-started notifications sent', {
      storeRunId,
      recipients: users.length,
    });

    return results;
  }

  /**
   * Опубликовать сообщение о новом забеге в групповой чат.
   * web_app кнопки в группах запрещены, поэтому даём URL-deep-link
   * t.me/<bot>?start=storerun_<id> — он открывает личку, где /start
   * присылает web_app кнопку. Так о забеге узнают даже те, кто ещё ни разу
   * не писал боту в личку (DM-рассылка их не достанет).
   */
  async postStoreRunToGroup(storeRunId: number): Promise<NotificationResult> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: {
        initiator: true,
        group: { select: { telegramId: true } },
      },
    });
    if (!storeRun) {
      logger.warn('postStoreRunToGroup: run not found', { storeRunId });
      return { success: false, error: 'run_not_found', sentAt: new Date() };
    }
    if (!this.bot) {
      logger.error('postStoreRunToGroup: bot not initialized', { storeRunId });
      return { success: false, error: 'bot_not_initialized', sentAt: new Date() };
    }

    const initiatorName = storeRun.initiator.firstName;
    const storeName = storeRun.storeName;
    const collectUntilStr = storeRun.collectUntil.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const message =
      `🛒 <b>${this.escapeHtml(initiatorName)}</b> идёт в «${this.escapeHtml(storeName)}»\n\n` +
      `Напиши, что тебе взять — сбор заказов до ${collectUntilStr}.`;

    try {
      const sent = await this.bot.api.sendMessage(
        Number(storeRun.group.telegramId),
        message,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛒 Заказать',
                  url: createDirectLinkMiniAppUrl(`storerun_${storeRunId}`),
                },
              ],
            ],
          },
        },
      );
      try {
        await prisma.storeRun.update({
          where: { id: storeRunId },
          data: { groupMessageId: sent.message_id },
        });
      } catch (persistError: any) {
        logger.warn('postStoreRunToGroup: failed to persist groupMessageId', {
          storeRunId,
          error: persistError?.message ?? persistError,
        });
      }
      logger.info('Store run posted to group', { storeRunId, messageId: sent.message_id });
      return { success: true, messageId: sent.message_id, sentAt: new Date() };
    } catch (error: any) {
      logger.error('postStoreRunToGroup: failed to send', {
        storeRunId,
        groupTelegramId: String(storeRun.group.telegramId),
        error: error?.message ?? error,
      });
      return { success: false, error: error?.message ?? 'send_failed', sentAt: new Date() };
    }
  }

  /**
   * Уведомить инициатора, что приём заказов закрылся по таймеру.
   * При ручном старте инициатор сам нажал кнопку и так знает — этот метод
   * вызывается только из cron авто-закрытия.
   */
  async notifyInitiatorCollectionClosed(storeRunId: number): Promise<NotificationResult> {
    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      include: { initiator: true },
    });
    if (!storeRun) {
      return { success: false, error: 'run_not_found', sentAt: new Date() };
    }
    if (!this.bot) {
      logger.error('notifyInitiatorCollectionClosed: bot not initialized', { storeRunId });
      return { success: false, error: 'bot_not_initialized', sentAt: new Date() };
    }

    const itemsCount = await prisma.storeItem.count({ where: { storeRunId } });
    const webappUrl = process.env.WEBAPP_URL ?? '';
    const storeName = storeRun.storeName;

    const message =
      `🛍 Сбор заказов по «${this.escapeHtml(storeName)}» закрыт по таймеру.\n` +
      `Набралось позиций: ${itemsCount}. Открой список, иди в магазин и проставь цены.`;

    const replyMarkup = webappUrl
      ? {
          inline_keyboard: [
            [
              {
                text: '📱 Открыть список',
                web_app: { url: `${webappUrl}?storeRunId=${storeRunId}` },
              },
            ],
          ],
        }
      : undefined;

    return this.send({
      userId: Number(storeRun.initiator.telegramId),
      type: NotificationType.STORE_RUN_COLLECTION_CLOSED,
      priority: NotificationPriority.NORMAL,
      message,
      parseMode: 'HTML',
      replyMarkup,
    });
  }

  /**
   * Проверить, что бот состоит в целевой группе и может туда писать.
   * Используется как pre-check перед созданием забега: если бота выгнали
   * из группы, создавать забег бессмысленно — уведомление не доставится.
   * Возвращает false при любой неопределённости (бот не инициализирован,
   * группа не найдена, getChatMember упал с 403 «kicked»).
   */
  async botCanPostToGroup(groupId: number): Promise<boolean> {
    if (!this.bot) {
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
      const botId = this.bot.botInfo.id;
      const member = await this.bot.api.getChatMember(Number(group.telegramId), botId);
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

  /**
   * Удалить разосланные сообщения забега (групповой пост + личные приглашения).
   * Вызывается при отмене забега. Толерантен к ошибкам: сообщение могло быть
   * удалено вручную или устареть (>48ч) — такие падения логируем и пропускаем.
   */
  async deleteStoreRunMessages(storeRunId: number): Promise<void> {
    if (!this.bot) {
      logger.error('deleteStoreRunMessages: bot not initialized', { storeRunId });
      return;
    }

    const storeRun = await prisma.storeRun.findUnique({
      where: { id: storeRunId },
      select: {
        groupMessageId: true,
        dmMessages: true,
        group: { select: { telegramId: true } },
      },
    });
    if (!storeRun) {
      logger.warn('deleteStoreRunMessages: run not found', { storeRunId });
      return;
    }

    let deleted = 0;
    let failed = 0;

    if (storeRun.groupMessageId != null) {
      try {
        await this.bot.api.deleteMessage(
          Number(storeRun.group.telegramId),
          storeRun.groupMessageId,
        );
        deleted++;
      } catch (error: any) {
        failed++;
        logger.warn('deleteStoreRunMessages: group message delete failed', {
          storeRunId,
          error: error?.message ?? error,
        });
      }
    }

    if (storeRun.dmMessages) {
      let refs: Array<{ chatId: number; messageId: number }> = [];
      try {
        refs = JSON.parse(storeRun.dmMessages);
      } catch {
        logger.warn('deleteStoreRunMessages: invalid dmMessages JSON', { storeRunId });
        refs = [];
      }
      for (const ref of refs) {
        try {
          await this.bot.api.deleteMessage(ref.chatId, ref.messageId);
          deleted++;
        } catch (error: any) {
          failed++;
          logger.warn('deleteStoreRunMessages: dm delete failed', {
            storeRunId,
            chatId: ref.chatId,
            error: error?.message ?? error,
          });
        }
      }
    }

    logger.info('Store run messages cleaned up', { storeRunId, deleted, failed });
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export const notificationService = new NotificationService();



