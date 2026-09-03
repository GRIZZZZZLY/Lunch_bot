import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { toNumber, sumDecimals } from '../utils/decimal';
import { Transaction, Prisma } from '@prisma/client';
import { EncryptionService } from '../utils/encryption';

interface RawPaymentFields {
  paymentPhone: string | null;
  paymentCard: string | null;
  paymentDetails: string | null;
}

type DecryptedPaymentInfo = RawPaymentFields;

/* Явный include вместо инлайна в вызове — нужен как `typeof`, чтобы вывести
   точный тип результата `findMany` через `Prisma.TransactionGetPayload`.
   Без этого у `getUserDebts` не было явного возвращаемого типа (нарушение
   AGENTS.md про публичные методы сервисов), а компилятор при отсутствии
   аннотации схлопывал тип в объединение по обеим return-веткам функции и
   терял `toUser` там, где он объединению не соответствовал. */
const debtsInclude = {
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
} satisfies Prisma.TransactionInclude;

/* Тип результата `getUserDebts`. Расшифровка не меняет форму полей
   (paymentPhone/paymentCard/paymentDetails остаются `string | null`) —
   меняются только значения, поэтому отдельный тип "с расшифрованным toUser"
   не нужен, этого типа достаточно для обеих return-веток метода. */
type DebtWithPayee = Prisma.TransactionGetPayload<{
  include: typeof debtsInclude;
}>;

/**
 * Расшифровать платёжные реквизиты получателя. `EncryptionService.decrypt`
 * сам разбирается с legacy-записями (текст без `:` — открытый, возвращается
 * как есть), поэтому здесь никакой отдельной ветки для старых данных не
 * нужно — только защита от пустых полей, decrypt('') бросать не должен.
 */
function decryptPaymentFields(user: RawPaymentFields): DecryptedPaymentInfo {
  return {
    paymentPhone: user.paymentPhone
      ? EncryptionService.decrypt(user.paymentPhone)
      : user.paymentPhone,
    paymentCard: user.paymentCard
      ? EncryptionService.decrypt(user.paymentCard)
      : user.paymentCard,
    paymentDetails: user.paymentDetails
      ? EncryptionService.decrypt(user.paymentDetails)
      : user.paymentDetails,
  };
}

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
  /* Дженерик, а не фиксированный `Transaction & {...}`: и `getUserDebts`, и
     `getUserCredits` объявляют собственный явный возвращаемый тип (с разным
     набором связей), и этот приватный метод должен возвращать РОВНО тот тип,
     что получил, а не сужать его до общего знаменателя `Transaction`. Проверено:
     после того как `getUserDebts` получил явную аннотацию `Promise<DebtWithPayee[]>`,
     фиксированная сигнатура здесь ломала компиляцию (TS2322 — результат метода
     переставал соответствовать `DebtWithPayee[]`), то есть дженерик не костыль
     вокруг отсутствующей аннотации, а необходимое условие при уже присутствующей. */
  private async filterTransactionsByActiveMembers<
    T extends Transaction & { poll?: { groupId?: number | null } | null },
  >(transactions: T[], relatedUser: 'from' | 'to'): Promise<T[]> {
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
  ): Promise<DebtWithPayee[]> {
    try {
      const where: Prisma.TransactionWhereInput = { fromUserId: userId };
      if (status) {
        where.status = status;
      } else if (activeOnly) {
        where.status = { in: ['PENDING', 'PAID'] };
      }

      const debts = await prisma.transaction.findMany({
        where,
        include: debtsInclude,
        orderBy: { createdAt: 'desc' },
      });

      /* Запись шифрует paymentCard/paymentPhone/paymentDetails
         (UserService.updatePaymentInfo), а этот запрос брал их сырыми прямо из
         базы — должник на экране бюджета видел шифротекст вместо ссылки СБП и
         номера телефона получателя, платёж по ним сделать было невозможно.
         Декрипт — работа процессора, не базы: расшифровываем уже полученные
         поля здесь, без похода в БД, и один раз на получателя (debt.toUser.id),
         а не в цикле по долгам, где один и тот же получатель часто повторяется. */
      const decryptedByToUserId = new Map<number, DecryptedPaymentInfo>();
      const decryptedDebts: DebtWithPayee[] = debts.map(debt => {
        if (!debt.toUser) {
          return debt;
        }
        let decrypted = decryptedByToUserId.get(debt.toUser.id);
        if (!decrypted) {
          decrypted = decryptPaymentFields(debt.toUser);
          decryptedByToUserId.set(debt.toUser.id, decrypted);
        }
        return { ...debt, toUser: { ...debt.toUser, ...decrypted } };
      });

      if (!activeOnly) {
        return decryptedDebts;
      }

      return await this.filterTransactionsByActiveMembers(decryptedDebts, 'to');
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
