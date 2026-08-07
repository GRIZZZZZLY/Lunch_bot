import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { toNumber, sumDecimals } from '../utils/decimal';
import { Transaction } from '@prisma/client';

/**
 * Read-only lookups over Transaction rows: a user's debts/credits, a single
 * transaction (for access checks), and aggregate stats.
 *
 * Split out of BudgetService (a god class covering payment state, poll
 * creation, order costs, and reminders besides this) — plain Prisma queries
 * with no notification or state-transition concerns.
 */
export class BudgetQueryService {
  /**
   * Скрыть долг/кредит участника, вышедшего из группы заказа.
   *
   * Магазинные забеги (storeRun, без poll) не фильтруются — своей группы
   * не имеют, а долг по ним не привязан к членству.
   */
  private async filterTransactionsByActiveMembers(
    transactions: Array<
      Transaction & { poll?: { groupId?: number | null } | null }
    >,
    relatedUser: 'from' | 'to'
  ) {
    const groupIds = Array.from(
      new Set(transactions.map(tx => tx.poll?.groupId).filter(Boolean))
    ) as number[];

    if (groupIds.length === 0) {
      return transactions;
    }

    const memberships = await prisma.groupMember.findMany({
      where: {
        groupId: { in: groupIds },
        isActive: true,
      },
      select: { groupId: true, userId: true },
    });

    if (memberships.length === 0) {
      return transactions;
    }

    const membershipByGroup = new Map<number, Set<number>>();
    memberships.forEach(member => {
      const existing =
        membershipByGroup.get(member.groupId) || new Set<number>();
      existing.add(member.userId);
      membershipByGroup.set(member.groupId, existing);
    });

    return transactions.filter(transaction => {
      const groupId = transaction.poll?.groupId;
      if (!groupId) return true;

      const groupMembers = membershipByGroup.get(groupId);
      if (!groupMembers) {
        return true;
      }

      const relatedUserId =
        relatedUser === 'from' ? transaction.fromUserId : transaction.toUserId;

      return groupMembers.has(relatedUserId);
    });
  }

  /**
   * Получить транзакцию по ID (для проверки прав доступа)
   */
  async getTransactionById(transactionId: number) {
    try {
      return await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          status: true,
        },
      });
    } catch (error) {
      logger.error('Error getting transaction by ID:', error);
      throw error;
    }
  }

  /**
   * Получить все долги пользователя
   */
  async getUserDebts(
    userId: number,
    status?: 'PENDING' | 'PAID' | 'CONFIRMED',
    activeOnly: boolean = false
  ) {
    try {
      const where: any = { fromUserId: userId };
      if (status) {
        where.status = status;
      } else if (activeOnly) {
        where.status = { in: ['PENDING', 'PAID'] };
      }

      const debts = await prisma.transaction.findMany({
        where,
        include: {
          /* Явные select вместо `true`. `include: { user: true }` возвращает ВСЕ
             колонки User, включая paymentCard / paymentPhone / paymentDetails —
             реквизиты уезжали клиенту в обе стороны, в том числе там, где они не
             нужны. Здесь список СВОИХ долгов, поэтому реквизиты получателя
             отдаём осознанно: именно по ним человек и переводит деньги, а право
             их видеть даёт сам факт непогашенного долга (where: fromUserId = я).
             Свои собственные реквизиты в этом ответе не нужны. */
          fromUser: { select: { id: true, firstName: true, username: true } },
          toUser: {
            select: {
              id: true,
              firstName: true,
              username: true,
              paymentPhone: true,
              paymentCard: true,
              paymentDetails: true,
            },
          },
          menuItem: true,
          // За что долг: обеденная транзакция несёт блюдо, магазинная — забег.
          // Без этого строка бюджета показывала только имя и сумму.
          storeRun: { select: { id: true, storeName: true } },
          poll: {
            include: {
              group: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeOnly) {
        return debts;
      }

      return await this.filterTransactionsByActiveMembers(debts, 'to');
    } catch (error) {
      logger.error('Error getting user debts:', error);
      throw error;
    }
  }

  /**
   * Получить все кредиты пользователя (кто ему должен)
   */
  async getUserCredits(
    userId: number,
    status?: 'PENDING' | 'PAID' | 'CONFIRMED',
    activeOnly: boolean = false
  ) {
    try {
      const where: any = { toUserId: userId };
      if (status) {
        where.status = status;
      } else if (activeOnly) {
        where.status = { in: ['PENDING', 'PAID'] };
      }

      const credits = await prisma.transaction.findMany({
        where,
        include: {
          /* Только имя должника. Раньше `fromUser: true` отдавал сборщику КАРТУ
             и ТЕЛЕФОН должника — они здесь не нужны ни для чего: деньги идут в
             обратную сторону. См. getUserDebts про обратный случай. */
          fromUser: { select: { id: true, firstName: true, username: true } },
          menuItem: true,
          // См. getUserDebts: за что долг — блюдо или магазин.
          storeRun: { select: { id: true, storeName: true } },
          poll: {
            include: {
              group: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeOnly) {
        return credits;
      }

      return await this.filterTransactionsByActiveMembers(credits, 'from');
    } catch (error) {
      logger.error('Error getting user credits:', error);
      throw error;
    }
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats(userId: number, from?: Date, to?: Date) {
    try {
      const where: any = {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      };

      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = from;
        if (to) where.createdAt.lte = to;
      }

      const transactions = await prisma.transaction.findMany({
        where,
        include: { menuItem: true },
      });

      // Расчет статистики
      const debts = transactions.filter(tx => tx.fromUserId === userId);
      const credits = transactions.filter(tx => tx.toUserId === userId);

      const totalSpent = sumDecimals(debts.map(tx => tx.amount));
      const totalReceived = sumDecimals(credits.map(tx => tx.amount));
      const balance = totalReceived - totalSpent;

      const confirmedDebts = debts.filter(tx => tx.status === 'CONFIRMED');
      const averagePerOrder =
        confirmedDebts.length > 0 ? totalSpent / confirmedDebts.length : 0;

      // Количество раз был ответственным
      const timesResponsible = await prisma.responsibleSelection.count({
        where: { selectedUserId: userId },
      });

      // Топ блюд
      const dishStats = debts.reduce((acc: any, tx) => {
        if (!tx.menuItem) return acc;
        const key = tx.menuItem.name;
        if (!acc[key]) {
          acc[key] = { name: key, count: 0, total: 0 };
        }
        acc[key].count++;
        acc[key].total += toNumber(tx.amount);
        return acc;
      }, {});

      const topDishes = Object.values(dishStats)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5);

      return {
        totalSpent,
        totalReceived,
        balance,
        averagePerOrder: Math.round(averagePerOrder),
        timesResponsible,
        totalOrders: debts.length,
        confirmedOrders: confirmedDebts.length,
        pendingOrders: debts.filter(tx => tx.status === 'PENDING').length,
        topDishes,
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }
}
