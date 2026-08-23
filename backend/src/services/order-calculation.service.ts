import { OrderItem, OrderItemEditLog, Transaction } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { CategoryOrderService } from './category-order.service';
import { UserService } from './user.service';
import { toNumber, formatCurrency } from '../utils/decimal';
import { BaseError } from '../utils/error';
import { getBotInstance } from '../bot/bot-instance';
import {
  CalculationNotReadyError,
  CalculationStateChangedError,
  CategoryOrderNotFoundError,
  MAX_ADDITIONAL_COST,
  MAX_ORDER_ITEM_PRICE,
  OrderInputError,
  OrderItemNotFoundError,
} from './category-order.errors';

/**
 * Пропустить наши доменные ошибки наружу как есть.
 *
 * То же, что в `category-order.service.ts`, и по той же причине: `catch` каждого
 * метода подменял «позиции нет» и «расчёт закрыть нельзя» на «Failed to …», а
 * контроллер превращал это в 500. Осмысленный отказ и сбой базы должны
 * различаться клиентом.
 */
function rethrowDomainError(error: unknown): void {
  if (error instanceof BaseError) {
    throw error;
  }
}

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
    const itemName = data.itemName.trim();
    const notes = data.notes?.trim() || undefined;

    if (!itemName) {
      throw new OrderInputError('Item name is required');
    }

    if (
      !Number.isFinite(data.price) ||
      data.price <= 0 ||
      data.price > MAX_ORDER_ITEM_PRICE
    ) {
      throw new OrderInputError(
        `Price must be between 0 and ${MAX_ORDER_ITEM_PRICE}`
      );
    }

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
            itemName,
            price: data.price as any,
            notes,
          },
          data.enteredBy
        );

        orderItem = await prisma.orderItem.update({
          where: { id: existing.id },
          data: {
            itemName,
            price: data.price as any,
            notes,
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
            itemName,
            price: data.price as any,
            notes,
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
      rethrowDomainError(error);
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
        throw new OrderItemNotFoundError();
      }

      await prisma.orderItem.delete({
        where: { id: orderItemId },
      });

      // Recalculate totals
      await CategoryOrderService.recalculateTotals(orderItem.categoryOrderId);

      logger.info(`Deleted OrderItem ${orderItemId}`);
    } catch (error) {
      logger.error('Error deleting order item:', error);
      rethrowDomainError(error);
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
        throw new CategoryOrderNotFoundError();
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
      rethrowDomainError(error);
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
        throw new CategoryOrderNotFoundError();
      }

      const participantIds = await CategoryOrderService.getParticipants(
        categoryOrderId
      );
      const expectedParticipantIds = new Set(participantIds);
      const actualParticipantIds = new Set(
        categoryOrder.orderItems.map(orderItem => orderItem.userId)
      );
      const hasUnexpectedUsers = [...actualParticipantIds].some(
        userId => !expectedParticipantIds.has(userId)
      );
      const hasMissingUsers = [...expectedParticipantIds].some(
        userId => !actualParticipantIds.has(userId)
      );

      if (
        expectedParticipantIds.size === 0 ||
        hasUnexpectedUsers ||
        hasMissingUsers ||
        actualParticipantIds.size !== expectedParticipantIds.size ||
        categoryOrder.participantCount !== expectedParticipantIds.size
      ) {
        throw new CalculationNotReadyError(
          'Cannot finalize: order items must exactly match category participants'
        );
      }

      const responsibleUserId = categoryOrder.responsibleUserId;
      if (responsibleUserId === null) {
        throw new CalculationNotReadyError('Responsible user is not selected yet');
      }
      const participantCount = expectedParticipantIds.size;
      const orderItemsCount = categoryOrder.orderItems.length;

      const additionalCosts = [
        toNumber(categoryOrder.deliveryCost),
        toNumber(categoryOrder.serviceFee),
        toNumber(categoryOrder.tip),
      ];
      if (
        additionalCosts.some(
          value =>
            !Number.isFinite(value) ||
            value < 0 ||
            value > MAX_ADDITIONAL_COST
        )
      ) {
        throw new OrderInputError('Additional costs are outside the allowed range');
      }
      if (
        categoryOrder.orderItems.some(orderItem => {
          const value = toNumber(orderItem.price);
          return (
            !Number.isFinite(value) ||
            value <= 0 ||
            value > MAX_ORDER_ITEM_PRICE
          );
        })
      ) {
        throw new OrderInputError('Order item price is outside the allowed range');
      }

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
      const result = await prisma.$transaction(async (tx) => {
        const transition = await tx.categoryOrder.updateMany({
          where: {
            id: categoryOrder.id,
            calculationStatus: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          data: {
            calculationStatus: 'COMPLETED',
            calculationCompletedAt: new Date(),
          },
        });

        if (transition.count === 1 && txData.length > 0) {
          await tx.transaction.createMany({
            data: txData,
            skipDuplicates: true,
          });
        }

        const inserted = await tx.transaction.findMany({
          where: { categoryOrderId: categoryOrder.id },
        });

        if (transition.count === 0) {
          const current = await tx.categoryOrder.findUnique({
            where: { id: categoryOrder.id },
            select: { calculationStatus: true },
          });
          if (current?.calculationStatus !== 'COMPLETED') {
            throw new CalculationStateChangedError();
          }
        }

        return { transactions: inserted, transitioned: transition.count === 1 };
      });
      const { transactions, transitioned } = result;

      logger.info(
        `Atomic finalize for CategoryOrder ${categoryOrderId}: ${transactions.length} transactions + status=COMPLETED committed`,
      );

      // Notifications outside tx — DB state already committed, partial fails recoverable.
      if (transitioned) {
        await this.sendDebtNotifications(categoryOrder, transactions);
      }

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
      // Один вызов, один const: рассылка идёт в цикле, повторный
      // getBotInstance() между итерациями мог бы отдать уже снятого бота.
      const bot = getBotInstance();
      if (!bot) {
        logger.warn('Bot instance not initialized, skipping debt notifications');
        return;
      }

      // Load stored participant waiting-message IDs for this category order
      const coRecord = await prisma.categoryOrder.findUnique({
        where: { id: categoryOrder.id },
        select: { participantMessages: true },
      });
      const participantMsgs: Record<string, { messageId: number; chatId: string }> =
        coRecord?.participantMessages
          ? JSON.parse(coRecord.participantMessages)
          : {};

      // Предзагрузка должников и ответственных одним запросом каждый (вместо 2N findUnique)
      const debtorIds = [...new Set(transactions.map(t => t.fromUserId))];
      const responsibleIds = [...new Set(transactions.map(t => t.toUserId))];

      const debtorMap = new Map(
        (await prisma.user.findMany({
          where: { id: { in: debtorIds } },
          select: { id: true, telegramId: true, firstName: true },
        })).map(u => [u.id, u])
      );
      // Платёжные поля здесь не выбираются намеренно: в базе они зашифрованы,
      // а в сообщение идёт расшифрованный вариант из paymentInfoMap. Держать
      // рядом два одноимённых поля, из которых одно — шифротекст, значит
      // однажды подставить в сообщение шифротекст.
      const responsibleMap = new Map(
        (await prisma.user.findMany({
          where: { id: { in: responsibleIds } },
          select: { id: true, firstName: true, username: true },
        })).map(u => [u.id, u])
      );

      // Раньше платёжные данные тянулись внутри цикла — запрос на каждого
      // ответственного (кэш в Map спасал только от повторов внутри одной
      // рассылки). Ответственных единицы, но запрос всё равно был лишним.
      const paymentInfoMap = await UserService.getPaymentInfoMany(responsibleIds);

      // Накопленные обновления message_id — выполним пачкой после рассылки
      const messageIdUpdates: Array<{ id: number; debtMessageId: number; debtChatId: string }> = [];

      for (const transaction of transactions) {
        const user = debtorMap.get(transaction.fromUserId);

        if (!user) {
          continue;
        }

        const responsible = responsibleMap.get(transaction.toUserId);

        if (!responsible) {
          continue;
        }

        const paymentInfo = paymentInfoMap.get(transaction.toUserId) ?? null;

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
            await bot.api.editMessageText(
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
            const sentMsg = await bot.api.sendMessage(
              user.telegramId.toString(),
              message,
              { reply_markup: payButton }
            );
            debtMessageId = sentMsg.message_id;
            debtChatId = user.telegramId.toString();
          }
        } else {
          // No waiting message stored — send new
          const sentMsg = await bot.api.sendMessage(
            user.telegramId.toString(),
            message,
            { reply_markup: payButton }
          );
          debtMessageId = sentMsg.message_id;
          debtChatId = user.telegramId.toString();
        }

        // Store debt message ID on transaction for future edits (status updates)
        if (debtMessageId && debtChatId) {
          messageIdUpdates.push({ id: transaction.id, debtMessageId, debtChatId });
        }

        logger.info(
          `Sent debt notification to user ${transaction.fromUserId} for ${formatCurrency(transaction.amount)}`
        );
      }

      // Пачкой сохраняем привязку message_id к транзакциям (вне критического
      // пути рассылки). $transaction — для согласованности: либо привязки всех
      // должников сохранены, либо ни одной, без частичного состояния.
      if (messageIdUpdates.length > 0) {
        await prisma.$transaction(
          messageIdUpdates.map(u =>
            prisma.transaction.update({
              where: { id: u.id },
              data: { debtMessageId: u.debtMessageId, debtChatId: u.debtChatId },
            })
          )
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

    let message = `💳 Твой заказ (${category}) оформлен!\n\n`;
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
      : 'тег не указан'
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

      if (newData.price !== undefined && (newData.price as any) !== toNumber(oldItem.price)) {
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
  /**
   * Какому категорийному заказу принадлежит позиция; `null` — позиции нет.
   *
   * Нужно ровно для одного: `DELETE /api/order-items/:id` получает id ПОЗИЦИИ,
   * а право на удаление принадлежит ответственному за ЗАКАЗ. Поэтому проверка
   * доступа там не может стоять на маршруте — сначала надо выяснить заказ.
   * Вынесено из контроллера, где стояло прямым обращением к Prisma.
   */
  static async getCategoryOrderIdForItem(
    orderItemId: number
  ): Promise<number | null> {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: { categoryOrderId: true },
    });

    return orderItem?.categoryOrderId ?? null;
  }

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
