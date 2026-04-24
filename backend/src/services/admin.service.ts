import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { now } from '../utils/date';
import { getBotInstance } from '../bot/bot';
import { GroupService } from './group.service';
import { toNumber, sumDecimals } from '../utils/decimal';
import type { Prisma } from '@prisma/client';

type Decimal = Prisma.Decimal;

interface UserWithActivity {
  id: number;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Activity stats
  totalVotes: number;
  totalDebts: number;
  totalCredits: number;
  pendingDebts: number;
  lastActivity: Date | null;
}

interface DebtorInfo {
  userId: number;
  userName: string;
  telegramId: bigint;
  totalDebt: number;
  oldestDebt: Date | null;
  debtCount: number;
  debts: Array<{
    id: number;
    amount: Decimal;
    createdAt: Date;
    pollId: number | null;
    toUser: {
      id: number;
      firstName: string;
    };
  }>;
}

interface DebtStats {
  totalDebtors: number;
  totalDebtAmount: number;
  avgDebtPerUser: number;
  oldestDebtAge: number; // days
}

interface CleanupStats {
  oldPolls: {
    count30Days: number;
    count60Days: number;
    count90Days: number;
  };
  oldTransactions: {
    count30Days: number;
    count60Days: number;
    count90Days: number;
  };
}

export class AdminService {
  /**
   * Получение всех пользователей с их активностью
   */
  async getAllUsers(groupId: number): Promise<UserWithActivity[]> {
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { groupId },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

      if (memberships.length === 0) {
        return [];
      }

      const userIds = memberships.map((member) => member.userId);
      const membershipByUser = new Map(
        memberships.map((member) => [member.userId, member])
      );

      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              votes: { where: { poll: { groupId } } },
              debts: { where: { status: 'PENDING', poll: { groupId } } },
              credits: { where: { status: 'PENDING', poll: { groupId } } },
            },
          },
          votes: {
            where: { poll: { groupId } },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          debts: {
            where: { status: 'PENDING', poll: { groupId } },
            select: { amount: true },
          },
          credits: {
            where: { status: 'PENDING', poll: { groupId } },
            select: { amount: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return users.map((user) => {
        const membership = membershipByUser.get(user.id);
        const role = membership?.role || 'MEMBER';

        return {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: ['ADMIN', 'CREATOR'].includes(role),
          isActive: membership?.isActive ?? true,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          totalVotes: user._count.votes,
          totalDebts: user._count.debts,
          totalCredits: user._count.credits,
          pendingDebts: sumDecimals(user.debts.map(d => d.amount)),
          lastActivity: user.votes[0]?.createdAt || null,
        };
      });
    } catch (error) {
      logger.error('[AdminService] Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Получение статистики пользователя
   */
  async getUserStats(userId: number, groupId: number) {
    try {
      const member = await prisma.groupMember.findFirst({
        where: { userId, groupId },
        select: { id: true },
      });

      if (!member) {
        throw new Error('User not found in group');
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          _count: {
            select: {
              votes: { where: { poll: { groupId } } },
              debts: { where: { poll: { groupId } } },
              credits: { where: { poll: { groupId } } },
              createdPolls: { where: { groupId } },
            },
          },
          debts: {
            select: {
              amount: true,
              status: true,
            },
            where: { poll: { groupId } },
          },
          credits: {
            select: {
              amount: true,
              status: true,
            },
            where: { poll: { groupId } },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const pendingDebts = sumDecimals(
        user.debts.filter((d) => d.status === 'PENDING').map(d => d.amount)
      );

      const paidDebts = sumDecimals(
        user.debts.filter((d) => d.status === 'PAID').map(d => d.amount)
      );

      const pendingCredits = sumDecimals(
        user.credits.filter((c) => c.status === 'PENDING').map(c => c.amount)
      );

      const paidCredits = sumDecimals(
        user.credits.filter((c) => c.status === 'PAID').map(c => c.amount)
      );

      return {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName || ''}`.trim(),
        totalVotes: user._count.votes,
        totalDebts: user._count.debts,
        totalCredits: user._count.credits,
        createdPolls: user._count.createdPolls,
        pendingDebts,
        paidDebts,
        pendingCredits,
        paidCredits,
      };
    } catch (error) {
      logger.error('[AdminService] Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Назначение/снятие админ-прав
   */
  async toggleAdmin(userId: number, isAdmin: boolean, groupId: number) {
    try {
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member) {
        throw new Error('Group member not found');
      }

      if (!isAdmin && member.role === 'CREATOR') {
        return member;
      }

      const nextRole = isAdmin ? 'ADMIN' : 'MEMBER';
      const updated = await GroupService.setMemberRole(groupId, userId, nextRole);

      logger.info(
        `[AdminService] Group ${groupId} member ${userId} role changed to ${nextRole}`
      );
      return updated;
    } catch (error) {
      logger.error('[AdminService] Error toggling admin:', error);
      throw error;
    }
  }

  /**
   * Блокировка/разблокировка пользователя
   */
  async toggleActive(userId: number, isActive: boolean, groupId: number) {
    try {
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!member) {
        throw new Error('Group member not found');
      }

      if (isActive) {
        await GroupService.addMemberToGroup(groupId, userId, member.role);
      } else {
        await GroupService.removeMemberFromGroup(groupId, userId);
      }

      logger.info(
        `[AdminService] Group ${groupId} member ${userId} active status changed to ${isActive}`
      );
      return { ...member, isActive };
    } catch (error) {
      logger.error('[AdminService] Error toggling active:', error);
      throw error;
    }
  }

  /**
   * Получение всех должников
   */
  async getAllDebtors(groupId: number): Promise<DebtorInfo[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          groupMemberships: {
            some: { groupId },
          },
          debts: {
            some: {
              status: 'PENDING',
              poll: { groupId },
            },
          },
        },
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          lastName: true,
          debts: {
            where: { status: 'PENDING', poll: { groupId } },
            select: {
              id: true,
              amount: true,
              createdAt: true,
              pollId: true,
              toUser: {
                select: {
                  id: true,
                  firstName: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return users.map((user) => {
        const totalDebt = sumDecimals(user.debts.map(d => d.amount));
        const oldestDebt = user.debts[0]?.createdAt || null;

        return {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName || ''}`.trim(),
          telegramId: user.telegramId,
          totalDebt,
          oldestDebt,
          debtCount: user.debts.length,
          debts: user.debts,
        };
      });
    } catch (error) {
      logger.error('[AdminService] Error getting debtors:', error);
      throw error;
    }
  }

  /**
   * Статистика по задолженностям
   */
  async getDebtStats(groupId: number): Promise<DebtStats> {
    try {
      const pendingDebts = await prisma.transaction.findMany({
        where: { status: 'PENDING', poll: { groupId } },
        select: {
          amount: true,
          createdAt: true,
          fromUserId: true,
        },
      });

      const uniqueDebtors = new Set(pendingDebts.map((d) => d.fromUserId)).size;
      const totalAmount = sumDecimals(pendingDebts.map(d => d.amount));
      const avgDebt = uniqueDebtors > 0 ? totalAmount / uniqueDebtors : 0;

      const oldestDebt = pendingDebts.reduce(
        (oldest, debt) =>
          !oldest || debt.createdAt < oldest ? debt.createdAt : oldest,
        null as Date | null
      );

      const oldestDebtAge = oldestDebt
        ? Math.floor((Date.now() - oldestDebt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        totalDebtors: uniqueDebtors,
        totalDebtAmount: totalAmount,
        avgDebtPerUser: avgDebt,
        oldestDebtAge,
      };
    } catch (error) {
      logger.error('[AdminService] Error getting debt stats:', error);
      throw error;
    }
  }

  /**
   * Принудительное списание долга
   */
  async forgiveDebt(debtId: number, adminId: number, groupId: number) {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: debtId },
        select: { id: true, poll: { select: { groupId: true } } },
      });

      if (!transaction || transaction.poll?.groupId !== groupId) {
        throw new Error('Debt not found in group');
      }

      const updated = await prisma.transaction.update({
        where: { id: debtId },
        data: {
          status: 'FORGIVEN',
          paidAt: now(),
          confirmedAt: now(),
        },
      });

      logger.info(`[AdminService] Debt ${debtId} forgiven by admin ${adminId}`);
      return updated;
    } catch (error) {
      logger.error('[AdminService] Error forgiving debt:', error);
      throw error;
    }
  }

  /**
   * Отправка напоминаний всем должникам
   */
  async remindAllDebtors(groupId: number) {
    try {
      const bot = getBotInstance();
      if (!bot) {
        throw new Error('Bot instance not available');
      }

      const debtors = await this.getAllDebtors(groupId);
      let sent = 0;

      for (const debtor of debtors) {
        try {
          // Формируем текст напоминания
          const message = this.formatDebtReminderMessage(debtor);
          
          // Отправляем сообщение через Telegram Bot
          await bot.api.sendMessage(Number(debtor.telegramId), message, {
            parse_mode: 'Markdown',
          });
          
          // Обновляем счётчик напоминаний
          await prisma.transaction.updateMany({
            where: {
              fromUserId: debtor.userId,
              status: 'PENDING',
              poll: { groupId },
            },
            data: {
              reminderCount: { increment: 1 },
              lastReminderAt: now(),
            },
          });

          sent++;
          logger.info(`[AdminService] Reminder sent to user ${debtor.userId}`);
        } catch (error) {
          logger.error(`[AdminService] Failed to remind user ${debtor.userId}:`, error);
        }
      }

      return { sent, total: debtors.length };
    } catch (error) {
      logger.error('[AdminService] Error reminding all debtors:', error);
      throw error;
    }
  }

  /**
   * Форматирование сообщения напоминания о долге
   */
  private formatDebtReminderMessage(debtor: DebtorInfo): string {
    let message = `💰 *Напоминание о задолженности*\n\n`;
    message += `Привет, ${debtor.userName}!\n\n`;
    message += `У вас есть неоплаченные долги на общую сумму *${debtor.totalDebt.toFixed(2)}₽*\n\n`;
    
    if (debtor.debts.length > 0) {
      message += `📋 *Детали:*\n`;
      debtor.debts.forEach((debt, index) => {
        message += `${index + 1}. ${toNumber(debt.amount).toFixed(2)}₽ → ${debt.toUser.firstName}\n`;
      });
    }
    
    message += `\n⏰ Самый старый долг от ${this.formatDebtAge(debtor.oldestDebt?.toISOString() || null)}\n`;
    message += `\n💳 Пожалуйста, оплатите долги и отметьте их как оплаченные в приложении.`;
    
    return message;
  }

  /**
   * Форматирование возраста долга
   */
  private formatDebtAge(date: string | null): string {
    if (!date) return 'неизвестно';
    
    const debtDate = new Date(date);
    const now = new Date();
    const days = Math.floor((now.getTime() - debtDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'сегодня';
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} дней назад`;
    if (days < 30) return `${Math.floor(days / 7)} недель назад`;
    return `${Math.floor(days / 30)} месяцев назад`;
  }

  /**
   * Отправка напоминания конкретному должнику
   */
  async remindDebtor(debtId: number, groupId: number) {
    try {
      const bot = getBotInstance();
      if (!bot) {
        throw new Error('Bot instance not available');
      }

      const debt = await prisma.transaction.findUnique({
        where: { id: debtId },
        include: {
          fromUser: true,
          toUser: true,
          menuItem: true,
          poll: true,
        },
      });

      if (!debt || debt.poll?.groupId !== groupId) {
        throw new Error('Debt not found');
      }

      // Формируем текст напоминания
      const message = this.formatSingleDebtReminderMessage(debt);
      
      // Отправляем сообщение через Telegram Bot
      await bot.api.sendMessage(Number(debt.fromUser.telegramId), message, {
        parse_mode: 'Markdown',
      });

      // Обновляем счётчик
      await prisma.transaction.update({
        where: { id: debtId },
        data: {
          reminderCount: { increment: 1 },
          lastReminderAt: now(),
        },
      });

      logger.info(`[AdminService] Reminder sent for debt ${debtId}`);
    } catch (error) {
      logger.error('[AdminService] Error reminding debtor:', error);
      throw error;
    }
  }

  /**
   * Форматирование сообщения для одного долга
   */
  private formatSingleDebtReminderMessage(debt: any): string {
    let message = `💰 *Напоминание об оплате*\n\n`;
    message += `Привет! У вас есть неоплаченный долг:\n\n`;
    message += `💵 Сумма: *${toNumber(debt.amount).toFixed(2)}₽*\n`;
    message += `👤 Кредитор: ${debt.toUser.firstName} ${debt.toUser.lastName || ''}\n`;
    
    if (debt.menuItem) {
      message += `🍽️ За: ${debt.menuItem.name}\n`;
    }
    
    const daysOld = Math.floor((Date.now() - new Date(debt.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    message += `📅 Создан: ${daysOld} ${this.getDaysWord(daysOld)} назад\n`;
    
    message += `\n💳 Пожалуйста, оплатите и отметьте как оплаченное в приложении.`;
    
    return message;
  }

  /**
   * Склонение слова "день"
   */
  private getDaysWord(days: number): string {
    if (days % 10 === 1 && days % 100 !== 11) return 'день';
    if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return 'дня';
    return 'дней';
  }

  /**
   * Очистка старых завершённых голосований
   */
  async cleanupOldPolls(daysOld: number, groupId: number) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.poll.deleteMany({
        where: {
          status: 'COMPLETED',
          groupId,
          endedAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`[AdminService] Cleaned ${result.count} old polls (>${daysOld} days)`);
      return { deleted: result.count };
    } catch (error) {
      logger.error('[AdminService] Error cleaning old polls:', error);
      throw error;
    }
  }

  /**
   * Очистка старых оплаченных транзакций
   */
  async cleanupOldTransactions(daysOld: number, groupId: number) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.transaction.deleteMany({
        where: {
          status: { in: ['PAID', 'FORGIVEN'] },
          paidAt: {
            lt: cutoffDate,
          },
          poll: { groupId },
        },
      });

      logger.info(`[AdminService] Cleaned ${result.count} old transactions (>${daysOld} days)`);
      return { deleted: result.count };
    } catch (error) {
      logger.error('[AdminService] Error cleaning old transactions:', error);
      throw error;
    }
  }

  /**
   * Статистика для очистки
   */
  async getCleanupStats(groupId: number): Promise<CleanupStats> {
    try {
      const now = new Date();
      const date30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const date60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const date90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const [
        polls30,
        polls60,
        polls90,
        trans30,
        trans60,
        trans90,
      ] = await Promise.all([
        prisma.poll.count({
          where: { status: 'COMPLETED', groupId, endedAt: { lt: date30 } },
        }),
        prisma.poll.count({
          where: { status: 'COMPLETED', groupId, endedAt: { lt: date60 } },
        }),
        prisma.poll.count({
          where: { status: 'COMPLETED', groupId, endedAt: { lt: date90 } },
        }),
        prisma.transaction.count({
          where: {
            status: { in: ['PAID', 'FORGIVEN'] },
            paidAt: { lt: date30 },
            poll: { groupId },
          },
        }),
        prisma.transaction.count({
          where: {
            status: { in: ['PAID', 'FORGIVEN'] },
            paidAt: { lt: date60 },
            poll: { groupId },
          },
        }),
        prisma.transaction.count({
          where: {
            status: { in: ['PAID', 'FORGIVEN'] },
            paidAt: { lt: date90 },
            poll: { groupId },
          },
        }),
      ]);

      return {
        oldPolls: {
          count30Days: polls30,
          count60Days: polls60,
          count90Days: polls90,
        },
        oldTransactions: {
          count30Days: trans30,
          count60Days: trans60,
          count90Days: trans90,
        },
      };
    } catch (error) {
      logger.error('[AdminService] Error getting cleanup stats:', error);
      throw error;
    }
  }
}
