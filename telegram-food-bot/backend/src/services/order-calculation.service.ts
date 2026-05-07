import { OrderItem, OrderItemEditLog, Transaction } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CategoryOrderService } from './category-order.service';
import { UserService } from './user.service';
import { toNumber, formatCurrency, sumDecimals } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';

/** @deprecated No-op: bot is now accessed via the shared singleton */
export function initializeOrderCalculationServiceBot(_bot: unknown): void {}

function botInstance() { return getBotInstance(); }

export interface SaveOrderItemData {
  categoryOrderId: number;
  userId: number;
  itemName: string;
  price: number;
  notes?: string;
  enteredBy: number;
}

export interface UpdateOrderItemData {
  itemName?: string;
  price?: number;
  notes?: string;
  editedBy: number;
  reason?: string;
}

export interface CalculationProgress {
  total: number;
  filled: number;
  isComplete: boolean;
  percentage: number;
}

export class OrderCalculationService {
  /**
   * Save or update an OrderItem (autosave with edit logging)
   */
  static async saveOrderItem(data: SaveOrderItemData): Promise<OrderItem> {
    try {
      // Check if OrderItem already exists for this user in this category
      const existing = await prisma.orderItem.findUnique({
        where: {
          categoryOrderId_userId: {
            categoryOrderId: data.categoryOrderId,
            userId: data.userId,
          },
        },
      });

      let orderItem: OrderItem;

      if (existing) {
        // Update existing item and log changes
        await this.logChanges(
          existing.id,
          existing,
          {
            itemName: data.itemName,
            price: data.price as any,
            notes: data.notes,
          },
          data.enteredBy
        );

        orderItem = await prisma.orderItem.update({
          where: { id: existing.id },
          data: {
            itemName: data.itemName,
            price: data.price as any,
            notes: data.notes,
            updatedAt: new Date(),
          },
        });

        logger.info(`Updated OrderItem ${orderItem.id} for user ${data.userId}`);
      } else {
        // Create new item
        orderItem = await prisma.orderItem.create({
          data: {
            categoryOrderId: data.categoryOrderId,
            userId: data.userId,
            itemName: data.itemName,
            price: data.price as any,
            notes: data.notes,
            enteredBy: data.enteredBy,
          },
        });

        logger.info(`Created OrderItem ${orderItem.id} for user ${data.userId}`);
      }

      // Recalculate totals
      await CategoryOrderService.recalculateTotals(data.categoryOrderId);

      return orderItem;
    } catch (error) {
      logger.error('Error saving order item:', error);
      throw new Error('Failed to save order item');
    }
  }

  /**
   * Delete an OrderItem
   */
  static async deleteOrderItem(orderItemId: number): Promise<void> {
    try {
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        select: { categoryOrderId: true },
      });

      if (!orderItem) {
        throw new Error('OrderItem not found');
      }

      await prisma.orderItem.delete({
        where: { id: orderItemId },
      });

      // Recalculate totals
      await CategoryOrderService.recalculateTotals(orderItem.categoryOrderId);

      logger.info(`Deleted OrderItem ${orderItemId}`);
    } catch (error) {
      logger.error('Error deleting order item:', error);
      throw new Error('Failed to delete order item');
    }
  }

  /**
   * Get calculation progress for a CategoryOrder
   */
  static async getProgress(
    categoryOrderId: number
  ): Promise<CalculationProgress> {
    try {
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        select: {
          participantCount: true,
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      if (!categoryOrder) {
        throw new Error('CategoryOrder not found');
      }

      const total = categoryOrder.participantCount;
      const filled = categoryOrder._count.orderItems;
      const isComplete = filled === total && total > 0;
      const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

      return {
        total,
        filled,
        isComplete,
        percentage,
      };
    } catch (error) {
      logger.error('Error getting progress:', error);
      throw new Error('Failed to get progress');
    }
  }

  /**
   * Finalize calculation and create transactions
   */
  static async finalizeCalculation(
    categoryOrderId: number
  ): Promise<{
    transactionsCreated: number;
    participantCount: number;
    orderItemsCount: number;
  }> {
    try {
      const categoryOrder = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrderId },
        include: {
          orderItems: {
            include: {
              user: true,
            },
          },
          poll: true,
        },
      });

      if (!categoryOrder) {
        throw new Error('CategoryOrder not found');
      }

      // Verify all participants have OrderItems
      const progress = await this.getProgress(categoryOrderId);
      if (!progress.isComplete) {
        throw new Error(
          `Cannot finalize: only ${progress.filled}/${progress.total} orders filled`
        );
      }

      const responsibleUserId = categoryOrder.responsibleUserId;
      if (responsibleUserId === null) {
        throw new Error('Responsible user is not selected yet');
      }
      const participantCount = categoryOrder.participantCount;
      const orderItemsCount = categoryOrder.orderItems.length;

      // Calculate per-person additional costs
      const deliveryShare =
        toNumber(categoryOrder.deliveryCost) / participantCount;
      const serviceShare = toNumber(categoryOrder.serviceFee) / participantCount;
      const tipShare = toNumber(categoryOrder.tip) / participantCount;

      // Build transaction payloads for batch insert (N+1 → single createMany)
      const txData = categoryOrder.orderItems
        .filter((orderItem: any) => orderItem.userId !== responsibleUserId)
        .map((orderItem: any) => {
          const itemPrice = toNumber(orderItem.price);
          const totalAmount = itemPrice + deliveryShare + serviceShare + tipShare;
          return {
            pollId: categoryOrder.pollId,
            fromUserId: orderItem.userId,
            toUserId: responsibleUserId,
            amount: totalAmount,
            categoryOrderId: categoryOrder.id,
            itemPrice,
            deliveryShare,
            serviceShare,
            tipShare,
            status: 'PENDING' as const,
          };
        });

      // Atomic: insert all transactions + flip CategoryOrder status in one tx.
      // Idempotency: if any transactions for this categoryOrder exist, skip insert.
      // Crash anywhere → both insert and status flip rolled back together.
      const transactions = await prisma.$transaction(async (tx) => {
        const existingCount = await tx.transaction.count({
          where: { categoryOrderId: categoryOrder.id },
        });

        if (existingCount === 0 && txData.length > 0) {
          await tx.transaction.createMany({ data: txData });
        } else if (existingCount > 0) {
          logger.warn(
            'Transactions already exist for CategoryOrder, skipping insert (idempotent retry)',
            { categoryOrderId: categoryOrder.id, existingCount, attemptedCount: txData.length },
          );
        }

        const inserted = await tx.transaction.findMany({
          where: { categoryOrderId: categoryOrder.id },
        });

        // Status update inside same tx — atomic with insert.
        await tx.categoryOrder.update({
          where: { id: categoryOrder.id },
          data: { calculationStatus: 'COMPLETED' },
        });

        return inserted;
      });

      logger.info(
        `Atomic finalize for CategoryOrder ${categoryOrderId}: ${transactions.length} transactions + status=COMPLETED committed`,
      );

      // Notifications outside tx — DB state already committed, partial fails recoverable.
      await this.sendDebtNotifications(categoryOrder, transactions);

      logger.info(
        `Finalized calculation for CategoryOrder ${categoryOrderId}: ${transactions.length} transactions created`
      );

      return {
        transactionsCreated: transactions.length,
        participantCount,
        orderItemsCount,
      };
    } catch (error) {
      logger.error('Error finalizing calculation:', error);
      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to finalize calculation');
    }
  }

  /**
   * Send debt notifications to participants
   */
  private static async sendDebtNotifications(
    categoryOrder: any,
    transactions: Transaction[]
  ): Promise<void> {
    try {
      if (!botInstance) {
        logger.warn('Bot instance not initialized, skipping debt notifications');
        return;
      }

      const responsiblePaymentCache = new Map<number, {
        paymentCard?: string | null;
        paymentPhone?: string | null;
      } | null>();

      // Load stored participant waiting-message IDs for this category order
      const coRecord = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrder.id },
        select: { participantMessages: true },
      });
      const participantMsgs: Record<string, { messageId: number; chatId: string }> =
        coRecord?.participantMessages
          ? JSON.parse(coRecord.participantMessages)
          : {};

      for (const transaction of transactions) {
        const user = await prisma.user.findUnique({
          where: { id: transaction.fromUserId },
          select: {
            telegramId: true,
            firstName: true,
          },
        });

        if (!user) {
          continue;
        }

        const responsible = await prisma.user.findUnique({
          where: { id: transaction.toUserId },
          select: {
            firstName: true,
            username: true,
            paymentCard: true,
            paymentPhone: true,
          },
        });

        if (!responsible) {
          continue;
        }

        let paymentInfo = responsiblePaymentCache.get(transaction.toUserId);
        if (paymentInfo === undefined) {
          paymentInfo = await UserService.getPaymentInfo(transaction.toUserId);
          responsiblePaymentCache.set(transaction.toUserId, paymentInfo);
        }

        if (!paymentInfo?.paymentCard && !paymentInfo?.paymentPhone) {
          logger.warn('Responsible has no payment details', {
            responsibleId: transaction.toUserId,
            categoryOrderId: categoryOrder.id,
          });
        }

        const message = this.formatDebtNotificationMessage(
          categoryOrder.category,
          transaction,
          responsible,
          paymentInfo
        );

        const payButton = {
          inline_keyboard: [[{
            text: '✅ Оплатил(а)',
            callback_data: `budget:mark_paid:${transaction.id}`,
          }]],
        };

        const waitingMsg = participantMsgs[transaction.fromUserId.toString()];

        let debtMessageId: number | null = null;
        let debtChatId: string | null = null;

        if (waitingMsg) {
          // Edit the existing "⏳ Ожидаем расчёт" message instead of sending a new one
          try {
            await botInstance()!.api.editMessageText(
              waitingMsg.chatId,
              waitingMsg.messageId,
              message,
              { reply_markup: payButton }
            );
            debtMessageId = waitingMsg.messageId;
            debtChatId = waitingMsg.chatId;
            logger.info(
              `Edited waiting message for user ${transaction.fromUserId} (msgId=${waitingMsg.messageId})`
            );
          } catch (editErr) {
            // Fallback: send a new message if edit fails (e.g. message too old)
            logger.warn(`Failed to edit waiting message, sending new one`, { editErr });
            const sentMsg = await botInstance()!.api.sendMessage(
              user.telegramId.toString(),
              message,
              { reply_markup: payButton }
            );
            debtMessageId = sentMsg.message_id;
            debtChatId = user.telegramId.toString();
          }
        } else {
          // No waiting message stored — send new
          const sentMsg = await botInstance()!.api.sendMessage(
            user.telegramId.toString(),
            message,
            { reply_markup: payButton }
          );
          debtMessageId = sentMsg.message_id;
          debtChatId = user.telegramId.toString();
        }

        // Store debt message ID on transaction for future edits (status updates)
        if (debtMessageId && debtChatId) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { debtMessageId, debtChatId },
          });
        }

        logger.info(
          `Sent debt notification to user ${transaction.fromUserId} for ${formatCurrency(transaction.amount)}`
        );
      }
    } catch (error) {
      logger.error('Error sending debt notifications:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Format debt notification message
   */
  private static formatDebtNotificationMessage(
    category: string,
    transaction: Transaction,
    responsible: any,
    paymentInfo: { paymentCard?: string | null; paymentPhone?: string | null } | null
  ): string {
    const breakdown = [];
    
    if (transaction.itemPrice) {
      breakdown.push(`Блюдо: ${toNumber(transaction.itemPrice).toFixed(2)}₽`);
    }
    if (transaction.deliveryShare) {
      breakdown.push(`Доставка: ${toNumber(transaction.deliveryShare).toFixed(2)}₽`);
    }
    if (transaction.serviceShare) {
      breakdown.push(`Сервис: ${toNumber(transaction.serviceShare).toFixed(2)}₽`);
    }
    if (transaction.tipShare) {
      breakdown.push(`Чаевые: ${toNumber(transaction.tipShare).toFixed(2)}₽`);
    }

    let message = `💳 Ваш заказ (${category}) оформлен!\n\n`;
    message += `Сумма к оплате: ${formatCurrency(transaction.amount)}\n\n`;
    message += `Детали:\n${breakdown.join('\n')}\n\n`;
    message += `Оплатить ${responsible.firstName}:\n`;

    if (paymentInfo?.paymentCard) {
      message += `💳 Карта: ${paymentInfo.paymentCard}\n`;
    }
    if (paymentInfo?.paymentPhone) {
      message += `📱 Телефон: ${paymentInfo.paymentPhone}\n`;
    }

    const usernameTag = responsible.username
      ? `@${responsible.username}`
      : 'тега нет(('
    message += `📱 Тег в Telegram: ${usernameTag}\n`;

    return message;
  }

  /**
   * Log changes to OrderItem for transparency
   */
  private static async logChanges(
    orderItemId: number,
    oldItem: OrderItem,
    newData: Partial<OrderItem>,
    editedBy: number
  ): Promise<void> {
    try {
      const logs: Array<{
        orderItemId: number;
        editedBy: number;
        fieldChanged: string;
        oldValue: string | null;
        newValue: string | null;
      }> = [];

      if (newData.itemName && newData.itemName !== oldItem.itemName) {
        logs.push({
          orderItemId,
          editedBy,
          fieldChanged: 'itemName',
          oldValue: oldItem.itemName,
          newValue: newData.itemName,
        });
      }

      if (newData.price !== undefined && (newData.price as any) !== toNumber(oldItem.price as any)) {
        logs.push({
          orderItemId,
          editedBy,
          fieldChanged: 'price',
          oldValue: toNumber(oldItem.price).toString(),
          newValue: newData.price.toString(),
        });
      }

      if (newData.notes !== undefined && newData.notes !== oldItem.notes) {
        logs.push({
          orderItemId,
          editedBy,
          fieldChanged: 'notes',
          oldValue: oldItem.notes,
          newValue: newData.notes,
        });
      }

      if (logs.length > 0) {
        await prisma.orderItemEditLog.createMany({
          data: logs,
        });

        logger.info(
          `Logged ${logs.length} changes to OrderItem ${orderItemId}`
        );
      }
    } catch (error) {
      logger.error('Error logging changes:', error);
      // Don't throw - logging is not critical for operation
    }
  }

  /**
   * Get edit history for an OrderItem (admin only)
   */
  static async getEditHistory(
    orderItemId: number
  ): Promise<OrderItemEditLog[]> {
    try {
      const logs = await prisma.orderItemEditLog.findMany({
        where: { orderItemId },
        include: {
          editor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      return logs;
    } catch (error) {
      logger.error('Error getting edit history:', error);
      throw new Error('Failed to get edit history');
    }
  }

  /**
   * Get all OrderItems for a CategoryOrder
   */
  static async getOrderItems(categoryOrderId: number): Promise<OrderItem[]> {
    try {
      const items = await prisma.orderItem.findMany({
        where: { categoryOrderId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: {
          userId: 'asc',
        },
      });

      return items;
    } catch (error) {
      logger.error('Error getting order items:', error);
      throw new Error('Failed to get order items');
    }
  }
}
