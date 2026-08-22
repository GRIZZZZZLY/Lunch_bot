import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { GroupService } from '../../services/group.service';
import { notificationService } from '../../services/notification.service';
import { getParam } from '../../utils/request-params';

class NotificationController {
  /**
   * Напомнить администраторам о создании голосования
   * POST /api/notifications/remind-admin
   */
  async remindAdmin(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const groupId = Number(req.body.groupId);

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized' 
        });
      }

      if (!Number.isInteger(groupId) || groupId <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid group ID is required'
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

      if (!(await GroupService.isUserGroupMember(userId, group.id))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
      }

      // Проверяем cooldown (30 минут) - ОБЩИЙ для всей группы
      const COOLDOWN_MINUTES = 30;
      const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);
      const lastReminder = await prisma.adminReminder.findFirst({
        where: {
          groupId, // Убрали проверку userId - теперь cooldown общий для всей группы
          createdAt: {
            gt: cooldownTime,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: true, // Включаем информацию о пользователе для сообщения
        },
      });

      if (lastReminder) {
        const minutesLeft = Math.ceil(
          (COOLDOWN_MINUTES * 60000 - (Date.now() - new Date(lastReminder.createdAt).getTime())) / 60000
        );
        const reminderUserName = lastReminder.user.firstName || lastReminder.user.username || 'Другой пользователь';
        return res.status(429).json({ 
          success: false, 
          error: `${reminderUserName} уже отправил напоминание. Подожди ${minutesLeft} минут${minutesLeft === 1 ? 'у' : minutesLeft < 5 ? 'ы' : ''} перед следующим`,
          cooldownEndsAt: new Date(new Date(lastReminder.createdAt).getTime() + COOLDOWN_MINUTES * 60 * 1000).toISOString(),
          minutesLeft,
        });
      }

      // Получаем всех администраторов группы
      const adminMemberships = await prisma.groupMember.findMany({
        where: {
          groupId: group.id,
          isActive: true,
          role: { in: ['ADMIN', 'CREATOR'] },
        },
        include: { user: true },
      });
      const admins = adminMemberships
        .map(membership => membership.user)
        .filter(admin => admin.isActive);

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
      await prisma.adminReminder.create({
        data: {
          userId,
          groupId,
        },
      });

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

  /**
   * Получить статус cooldown для группы
   * GET /api/notifications/cooldown/:groupId
   */
  async getCooldownStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const requestingUser = req.user;
      const groupId = parseInt(getParam(req.params, 'groupId'), 10);

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized' 
        });
      }

      if (!Number.isInteger(groupId) || groupId <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid group ID' 
        });
      }

      if (
        !(await GroupService.isUserGroupMember(userId, groupId))
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        });
      }

      const COOLDOWN_MINUTES = 30;
      const cooldownTime = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000);
      
      const lastReminder = await prisma.adminReminder.findFirst({
        where: {
          groupId,
          createdAt: {
            gt: cooldownTime,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: true,
        },
      });

      if (lastReminder) {
        const endsAt = new Date(new Date(lastReminder.createdAt).getTime() + COOLDOWN_MINUTES * 60 * 1000);
        const secondsLeft = Math.ceil((endsAt.getTime() - Date.now()) / 1000);
        const minutesLeft = Math.ceil(secondsLeft / 60);
        
        return res.json({
          success: true,
          data: {
            isActive: true,
            cooldownEndsAt: endsAt.toISOString(),
            secondsLeft,
            minutesLeft,
            lastReminderBy: {
              id: lastReminder.user.id,
              name: lastReminder.user.firstName || lastReminder.user.username || 'Пользователь',
            },
          },
        });
      }

      return res.json({
        success: true,
        data: {
          isActive: false,
          cooldownEndsAt: null,
          secondsLeft: 0,
          minutesLeft: 0,
          lastReminderBy: null,
        },
      });

    } catch (error) {
      logger.error('[NotificationController] Error in getCooldownStatus:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }
}

export const notificationController = new NotificationController();
