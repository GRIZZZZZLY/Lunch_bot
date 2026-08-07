import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { toNumber } from '../utils/decimal';

/**
 * Delivery/service/tip costs entered by the responsible person after a poll
 * closes, and the per-participant breakdown derived from them.
 *
 * Split out of BudgetService (a god class covering payment state, poll
 * creation, reminders, and this) — pure Prisma queries with no shared state
 * or notification concerns.
 */
export class OrderCostsService {
  /**
   * Set order costs (delivery, service, tips) for a poll
   * Only the responsible person can set costs
   */
  async setOrderCosts(
    pollId: number,
    userId: number,
    costs: {
      deliveryCost: number;
      serviceFee: number;
      tip: number;
      notes?: string;
    }
  ) {
    try {
      // Verify user is the responsible person for this poll
      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: {
          result: true,
          responsibleSelection: true,
        },
      });

      if (!poll) {
        throw new Error('Poll not found');
      }

      const responsibleUserId =
        poll.result?.responsibleUserId ||
        poll.responsibleSelection?.selectedUserId;

      if (responsibleUserId !== userId) {
        throw new Error('Only responsible person can set order costs');
      }

      // Atomic: upsert costs + recalculate all transactions in a single tx.
      // Without this, a crash between upsert and recalc leaves costs saved but
      // transactions still at old amounts (silent state drift seen by users).
      const orderCosts = await prisma.$transaction(async tx => {
        const upserted = await tx.pollOrderCosts.upsert({
          where: { pollId },
          create: {
            pollId,
            deliveryCost: costs.deliveryCost,
            serviceFee: costs.serviceFee,
            tip: costs.tip,
            notes: costs.notes,
            enteredBy: userId,
          },
          update: {
            deliveryCost: costs.deliveryCost,
            serviceFee: costs.serviceFee,
            tip: costs.tip,
            notes: costs.notes,
          },
        });

        const transactions = await tx.transaction.findMany({
          where: { pollId },
          include: { menuItem: true },
        });

        if (transactions.length > 0) {
          // Делёж считаем на ВСЕХ участников (знаменатель неизменный), чтобы
          // сумма расходов сходилась: заплатившие уже внесли свою долю при оплате.
          const participantIds = new Set<number>();
          transactions.forEach(transaction => {
            if (typeof transaction.fromUserId === 'number') {
              participantIds.add(transaction.fromUserId);
            }
            if (typeof transaction.toUserId === 'number') {
              participantIds.add(transaction.toUserId);
            }
          });

          const participantsCount = participantIds.size || transactions.length;
          const deliveryShare =
            toNumber(upserted.deliveryCost) / participantsCount;
          const serviceShare =
            toNumber(upserted.serviceFee) / participantsCount;
          const tipShare = toNumber(upserted.tip) / participantsCount;

          // Пересчитываем только ещё не оплаченные долги. PAID/CONFIRMED
          // замораживаем — сумма уже рассчитанного долга не должна меняться
          // задним числом, если ответственный позже правит расходы.
          const pendingTransactions = transactions.filter(
            transaction => transaction.status === 'PENDING'
          );
          for (const transaction of pendingTransactions) {
            const itemPrice = toNumber(transaction.menuItem?.price);
            const newAmount =
              itemPrice + deliveryShare + serviceShare + tipShare;
            await tx.transaction.update({
              where: { id: transaction.id },
              data: {
                itemPrice,
                deliveryShare,
                serviceShare,
                tipShare,
                amount: newAmount,
              },
            });
          }
        }

        return upserted;
      });

      logger.info('Order costs set and transactions recalculated atomically', {
        pollId,
        orderCosts,
      });

      return orderCosts;
    } catch (error) {
      logger.error('Error setting order costs:', error);
      throw error;
    }
  }

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
