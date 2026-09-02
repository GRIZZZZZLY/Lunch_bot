import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  NotificationType,
  NotificationPriority,
  NotificationResult,
  RouletteWinnerNotificationData,
  PollEndedNotificationData,
  PollStartedNotificationData,
  PollCancelledNotificationData,
} from '../types/notification.types';
import { User } from '@prisma/client';
import { toNumber } from '../utils/decimal';
import { now } from '../utils/date';
import { getBotInstance } from '../bot/bot-instance';
import { notificationTemplates } from './notification.templates';
import { notificationService } from './notification.service';

/**
 * Уведомления домена «голосования»: старт, завершение, отмена, победитель
 * рулетки.
 *
 * Выделено из `notification.service.ts`, где вместе с этим лежал ещё и домен
 * магазинных забегов. Общего у них было ровно две вещи — `send` и
 * экранирование, — и обе теперь приходят извне: транспорт импортируется,
 * тексты живут в `notification.templates.ts`.
 *
 * Состояния у класса нет: бот берётся из общего синглтона, шаблоны — из
 * модульной константы. Поэтому неважно, работать через экспортируемый
 * `pollNotificationService` или создать свой экземпляр, и разрез сервиса не
 * размножил ни кэш, ни ссылку на бота.
 */
export class PollNotificationService {
  /**
   * Отправить уведомление о победителе рулетки
   */
  async sendRouletteWinnerNotification(
    data: RouletteWinnerNotificationData
  ): Promise<NotificationResult> {
    const template = notificationTemplates.get(NotificationType.ROULETTE_WINNER);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    return notificationService.send({
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
        winner: poll.result.responsibleUser,
        poll,
        winnerItem: poll.result.winnerMenuItem || undefined,
        voters: votes.map(v => v.user),
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
   * Отправить уведомление о завершении голосования
   * @param userIds Telegram chat id получателей (не User.id)
   */
  async sendPollEndedNotification(
    userIds: number[],
    data: PollEndedNotificationData
  ): Promise<NotificationResult[]> {
    const template = notificationTemplates.get(NotificationType.POLL_ENDED);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    const results = await Promise.all(
      userIds.map((userId) =>
        notificationService.send({
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

      /* notificationService.send ждёт Telegram chat id, а не User.id — см. комментарий
         в isUserMuted. Отмена голосования ниже уже передаёт telegramId; здесь было
         то же самое, только со внутренним id, и уведомление не доходило никому. */
      const voterIds = Array.from(
        new Set(poll.votes.map(v => Number(v.user.telegramId)))
      );

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
   * Отправить уведомление о начале голосования
   */
  async sendPollStartedNotification(
    userIds: number[],
    data: PollStartedNotificationData
  ): Promise<NotificationResult[]> {
    const template = notificationTemplates.get(NotificationType.POLL_STARTED);
    if (!template) {
      throw new Error('Template not found');
    }

    const message = template.getMessage(data);

    const results = await Promise.all(
      userIds.map((userId) =>
        notificationService.send({
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
      const template = notificationTemplates.get(NotificationType.POLL_CANCELLED);

      if (!template || !getBotInstance()) {
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
          await notificationService.send({
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
}

export const pollNotificationService = new PollNotificationService();
