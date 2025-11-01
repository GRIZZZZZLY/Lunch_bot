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
              message += `💰 Цена: ${data.winnerItem.price} руб.\n`;
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
            message += `• ${v.firstName}${v.lastName ? ' ' + v.lastName : ''}\n`;
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
        sentAt: new Date(),
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
          resultData = JSON.parse(poll.result.rouletteData);
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
                price: item.price || undefined,
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
            price: poll.result.winnerMenuItem.price || undefined,
          } : undefined,
          topItems: topItems as any,
        };
      }

      const voterIds = Array.from(new Set(poll.votes.map(v => v.userId)));
      
      // Отправляем уведомления голосовавшим
      const results = await this.sendPollEndedNotification(voterIds, data);

      // Отправляем уведомление в группу
      if (poll.chatId && this.bot) {
        try {
          const template = this.templates.get(NotificationType.POLL_ENDED);
          if (template) {
            await this.bot.api.sendMessage(
              Number(poll.chatId),
              template.getMessage(data),
              { parse_mode: template.parseMode }
            );
            logger.info(`Completion notification sent to group ${poll.chatId}`);
          }
        } catch (error) {
          logger.error('Error sending completion notification to group:', error);
        }
      }

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

      // Отправляем в группу
      if (poll.chatId) {
        try {
          await this.bot.api.sendMessage(
            poll.chatId,
            template.getMessage(data),
            { parse_mode: template.parseMode }
          );
          logger.info(`Cancelled notification sent to group ${poll.chatId}`);
        } catch (error) {
          logger.error('Error sending cancelled notification to group:', error);
        }
      }

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
}

export const notificationService = new NotificationService();



