import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { notificationService } from '../../services/notification.service';

class NotificationController {
  /**
   * Напомнить администраторам о создании голосования
   * POST /api/notifications/remind-admin
   */
  async remindAdmin(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { groupId } = req.body;

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized' 
        });
      }

      if (!groupId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Group ID is required' 
        });
      }

      logger.info(`[NotificationController] Remind admin request from user ${userId} for group ${groupId}`);

      // Получаем информацию о пользователе
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      // Получаем группу
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return res.status(404).json({ 
          success: false, 
          error: 'Group not found' 
        });
      }

      // Проверяем cooldown (10 минут)
      const COOLDOWN_MINUTES = 10;
      const lastReminder = await prisma.$queryRaw<Array<{ createdAt: Date }>>`
        SELECT "createdAt" 
        FROM "AdminReminder" 
        WHERE "userId" = ${userId} 
          AND "groupId" = ${groupId}
          AND "createdAt" > NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
        ORDER BY "createdAt" DESC 
        LIMIT 1
      `;

      if (lastReminder && lastReminder.length > 0) {
        const minutesLeft = Math.ceil(
          (COOLDOWN_MINUTES * 60000 - (Date.now() - new Date(lastReminder[0].createdAt).getTime())) / 60000
        );
        return res.status(429).json({ 
          success: false, 
          error: `Подождите ${minutesLeft} минут${minutesLeft === 1 ? 'у' : minutesLeft < 5 ? 'ы' : ''} перед следующим напоминанием` 
        });
      }

      // Получаем всех администраторов группы
      const admins = await prisma.user.findMany({
        where: {
          isAdmin: true,
        },
      });

      if (admins.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'No admins found' 
        });
      }

      // Отправляем уведомления всем админам через Telegram bot API
      const userName = user.firstName || user.username || 'Пользователь';
      const message = `🔔 *Напоминание о голосовании*\n\n` +
        `Пользователь *${userName}* хочет кушать! 🍽️\n\n` +
        `Группа: *${group.title}*\n` +
        `Время: ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `Может пора создать голосование? 😊`;

      let sentCount = 0;
      const bot = (notificationService as any).bot;
      
      if (!bot) {
        logger.warn('[NotificationController] Bot not initialized');
        return res.status(500).json({ 
          success: false, 
          error: 'Notification service not ready' 
        });
      }

      for (const admin of admins) {
        try {
          await bot.api.sendMessage(
            admin.telegramId,
            message,
            { parse_mode: 'Markdown' }
          );
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send reminder to admin ${admin.id}:`, error);
        }
      }

      // Сохраняем запись о напоминании
      await prisma.$executeRaw`
        INSERT INTO "AdminReminder" ("userId", "groupId", "createdAt")
        VALUES (${userId}, ${groupId}, NOW())
      `;

      logger.info(`[NotificationController] Sent ${sentCount} reminders to admins`);

      return res.json({ 
        success: true, 
        data: { 
          sentCount,
          message: `Уведомление отправлено ${sentCount} администратор${sentCount === 1 ? 'у' : 'ам'}` 
        } 
      });

    } catch (error) {
      logger.error('[NotificationController] Error in remindAdmin:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }
}

export const notificationController = new NotificationController();
