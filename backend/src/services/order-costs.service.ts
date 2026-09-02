import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { toNumber } from '../utils/decimal';

/**
 * Чтение расходов на заказ (доставка/сервис/чай) и разбивки по участникам.
 *
 * Запись расходов раньше жила здесь же (`setOrderCosts`), но авторизовалась
 * по `poll.result.responsibleUserId` — в мульти-победительном режиме туда
 * пишется `completedBy`, id последнего проголосовавшего, а не реальный
 * ответственный. Плюс пересчёт брал цену из `menuItem.price`, которого нет у
 * транзакций категорийных заказов, — долги обнулялись до долей доставки и
 * сервиса. Метод удалён; запись расходов теперь только через
 * `CategoryOrderService.updateCosts`, где ответственный проверяется по самой
 * категории.
 *
 * Split out of BudgetService (a god class covering payment state, poll
 * creation, reminders, and this) — pure Prisma queries with no shared state
 * or notification concerns.
 */
export class OrderCostsService {
  /**
   * Get order costs for a poll
   */
  async getOrderCosts(pollId: number) {
    try {
      return await prisma.pollOrderCosts.findUnique({
        where: { pollId },
      });
    } catch (error) {
      logger.error('Error getting order costs:', error);
      throw error;
    }
  }

  /**
   * Get detailed cost breakdown for a poll
   */
  async getPollCostBreakdown(pollId: number) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { pollId },
        include: {
          fromUser: true,
          menuItem: true,
        },
      });

      const orderCosts = await this.getOrderCosts(pollId);

      const participantIds = new Set<number>();
      const transactionBreakdowns = transactions.map(tx => {
        participantIds.add(tx.fromUserId);
        participantIds.add(tx.toUserId);

        const deliveryShare = toNumber(tx.deliveryShare);
        const serviceShare = toNumber(tx.serviceShare);
        const tipShare = toNumber(tx.tipShare);
        const totalAmount = toNumber(tx.amount);
        const menuItemPrice =
          tx.menuItem?.price != null ? toNumber(tx.menuItem.price) : null;
        const itemPrice =
          tx.itemPrice != null
            ? toNumber(tx.itemPrice)
            : (menuItemPrice ??
              Math.max(
                0,
                totalAmount - deliveryShare - serviceShare - tipShare
              ));

        return {
          transactionId: tx.id,
          userId: tx.fromUserId,
          userName: tx.fromUser.firstName,
          menuItemName: tx.menuItem?.name || 'Unknown',
          itemPrice,
          deliveryShare,
          serviceShare,
          tipShare,
          totalAmount,
          status: tx.status as 'PENDING' | 'PAID' | 'CONFIRMED',
        };
      });

      const totalItemsCost = transactionBreakdowns.reduce(
        (sum, tx) => sum + tx.itemPrice,
        0
      );
      const totalDeliveryCost = toNumber(orderCosts?.deliveryCost);
      const totalServiceFee = toNumber(orderCosts?.serviceFee);
      const totalTip = toNumber(orderCosts?.tip);
      const grandTotal =
        totalItemsCost + totalDeliveryCost + totalServiceFee + totalTip;

      return {
        pollId,
        totalItemsCost,
        totalDeliveryCost,
        totalServiceFee,
        totalTip,
        grandTotal,
        participantsCount: participantIds.size || transactions.length,
        transactions: transactionBreakdowns,
        orderCosts: orderCosts
          ? {
              id: orderCosts.id,
              pollId: orderCosts.pollId,
              deliveryCost: toNumber(orderCosts.deliveryCost),
              serviceFee: toNumber(orderCosts.serviceFee),
              tip: toNumber(orderCosts.tip),
              notes: orderCosts.notes,
              enteredBy: orderCosts.enteredBy,
              enteredAt: orderCosts.enteredAt.toISOString(),
              updatedAt: orderCosts.updatedAt.toISOString(),
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Error getting poll cost breakdown:', error);
      throw error;
    }
  }
}
