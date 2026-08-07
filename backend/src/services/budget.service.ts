import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { eventBus } from './event-bus.service';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { Transaction, User } from '@prisma/client';
import { now } from '../utils/date';
import {
  toNumber,
  formatCurrency,
  sumDecimals,
  multiply,
} from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';

/** @deprecated No-op: bot is now accessed via the shared singleton in bot-instance.ts */
export function initializeBudgetServiceBot(_bot: unknown): void {}

// Helper used throughout this file — replaces the old `let botInstance: any = null`
function botInstance() {
  return getBotInstance();
}

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

export class BudgetService {
  /**
   * Отметить как оплаченное
   */
  static async markAsPaid(txId: number, actorUserId: number): Promise<any> {
    try {
      const transition = await prisma.transaction.updateMany({
        where: {
          id: txId,
          fromUserId: actorUserId,
          status: 'PENDING',
        },
        data: { status: 'PAID', paidAt: now() },
      });
      const tx = await prisma.transaction.findUnique({
        where: { id: txId },
        include: { fromUser: true, toUser: true, menuItem: true },
      });
      if (!tx) throw new Error('Transaction not found');
      if (tx.fromUserId !== actorUserId) throw new Error('Access denied');
      if (transition.count === 0) {
        if (tx.status === 'PAID') return tx;
        if (tx.status === 'CONFIRMED') {
          throw new Error('Cannot modify confirmed payment');
        }
        throw new Error('Transaction state changed');
      }

      logger.info('Transaction marked as paid', { txId });
      BudgetService.emitDebtUpdated(tx);

      // Уведомляем ответственного
      if (botInstance()) {
        await botInstance()!.api.sendMessage(
          Number(tx.toUser.telegramId),
          `💳 *Получена оплата!*\n\n${tx.fromUser.firstName} отметил(а) оплату ${formatCurrency(tx.amount)}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Подтвердить ✅',
                    callback_data: `budget:confirm:${txId}`,
                  },
                ],
              ],
            },
          }
        );
      }

      return tx;
    } catch (error) {
      logger.error('Error marking as paid:', error);
      throw error;
    }
  }

  /**
   * Подтвердить оплату
   */
  static async confirmPayment(txId: number, actorUserId: number): Promise<any> {
    try {
      const transition = await prisma.transaction.updateMany({
        where: {
          id: txId,
          toUserId: actorUserId,
          status: 'PAID',
        },
        data: { status: 'CONFIRMED', confirmedAt: now() },
      });
      const tx = await prisma.transaction.findUnique({
        where: { id: txId },
        include: { fromUser: true, toUser: true },
      });
      if (!tx) throw new Error('Transaction not found');
      if (tx.toUserId !== actorUserId) throw new Error('Access denied');
      if (transition.count === 0) {
        if (tx.status === 'CONFIRMED') return tx;
        if (tx.status === 'PENDING') {
          throw new Error('Cannot confirm unpaid transaction');
        }
        throw new Error('Transaction state changed');
      }

      logger.info('Transaction confirmed', { txId });
      BudgetService.emitDebtUpdated(tx);
      await BudgetService.notifyPaymentConfirmed(tx);

      // Проверяем, все ли оплатили (только для poll-транзакций; у store-run своя финализация)
      if (tx.pollId != null) {
        await this.checkAllPaid(tx.pollId, tx.toUserId);
      }

      return tx;
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /** Окно отмены подтверждения: сутки с момента подтверждения (решение владельца). */
  static readonly UNDO_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

  /**
   * Сообщить обеим сторонам, что долг сменил состояние.
   *
   * Адресат — люди, а не сущность: у магазинной транзакции опроса может не быть,
   * и привязать событие к pollId было бы нечем. Клиент по этому событию
   * перезапрашивает бюджет, поэтому payload держим минимальным — суммы и имена
   * ходят обычным ответом API, а не через поток.
   */
  private static emitDebtUpdated(tx: {
    id: number;
    fromUserId: number;
    toUserId: number;
    status: string;
  }): void {
    eventBus.emit('debt_updated', {
      transactionId: tx.id,
      status: tx.status as 'PENDING' | 'PAID' | 'CONFIRMED',
      audience: [tx.fromUserId, tx.toUserId],
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Edit the debtor's existing "debt" message into a confirmation, falling
   * back to a fresh DM if the original message is gone or unreachable.
   * Shared by confirmPayment (one transaction) and markAllPaidByResponsible
   * (a whole poll's worth) — same notification either way.
   */
  private static async notifyPaymentConfirmed(tx: any): Promise<void> {
    if (!botInstance()) return;

    const confirmedText =
      `✅ Оплата подтверждена!\n\n` +
      `${tx.toUser.firstName} подтвердил(а) получение ${formatCurrency(tx.amount)}\n\n` +
      `Спасибо! 🎉`;

    let edited = false;
    if (tx.debtMessageId && tx.debtChatId) {
      try {
        await botInstance()!.api.editMessageText(
          tx.debtChatId,
          tx.debtMessageId,
          confirmedText,
          { reply_markup: { inline_keyboard: [] } }
        );
        edited = true;
      } catch (e) {
        logger.warn('Could not edit debt message, sending new one', { txId: tx.id });
      }
    }
    if (!edited) {
      await botInstance()!.api.sendMessage(Number(tx.fromUser.telegramId), confirmedText);
    }
  }

  /**
   * Сначала правим СТАРОЕ сообщение о долге. При подтверждении оно
   * переписывается в «✅ Оплата подтверждена!», и после отмены висело в
   * чате должника, утверждая обратное новому уведомлению. Одно и то же
   * событие не должно оставлять в переписке два противоречащих факта.
   *
   * Сообщение «Все оплатили!» не трогаем: оно уходит самому сборщику —
   * тому, кто отмену и сделал, — и его message_id нигде не сохраняется.
   *
   * Должника уведомляем ОБЯЗАТЕЛЬНО отдельным сообщением — ему уже сказали
   * «оплата подтверждена», и молча вернуть долг было бы хуже самой ошибки.
   */
  private static async notifyConfirmationUndone(existing: any): Promise<void> {
    if (!botInstance()) return;

    const text =
      `↩️ Подтверждение оплаты отменено\n\n` +
      `${existing.toUser.firstName} отменил(а) подтверждение ${formatCurrency(existing.amount)}. ` +
      `Долг снова ждёт подтверждения — свяжитесь, если это ошибка.`;

    if (existing.debtMessageId && existing.debtChatId) {
      try {
        await botInstance()!.api.editMessageText(
          existing.debtChatId,
          existing.debtMessageId,
          text,
          { reply_markup: { inline_keyboard: [] } },
        );
      } catch (e) {
        logger.warn('Could not edit stale confirmation message on undo', { txId: existing.id });
      }
    }

    try {
      await botInstance()!.api.sendMessage(Number(existing.fromUser.telegramId), text);
    } catch (e) {
      logger.warn('Could not notify debtor about undone confirmation', { txId: existing.id });
    }
  }

  /**
   * Сборщик отменяет своё подтверждение и возвращает долг в PAID.
   *
   * Подтверждение необратимо закрывало долг: промах по кнопке в списке из восьми
   * человек означал недополученные деньги без способа исправить это в продукте.
   * Отменять может ТОЛЬКО получатель (toUserId) и только в течение суток —
   * иначе это переписывание истории задним числом.
   *
   * Должника уведомляем обязательно: ему уже сказали «оплата подтверждена», и
   * молча вернуть долг было бы хуже самой ошибки.
   */
  static async undoConfirmation(txId: number, actorUserId: number): Promise<any> {
    try {
      const existing = await prisma.transaction.findUnique({
        where: { id: txId },
        include: { fromUser: true, toUser: true },
      });
      if (!existing) throw new Error('Transaction not found');
      if (existing.toUserId !== actorUserId) throw new Error('Access denied');
      if (existing.status !== 'CONFIRMED') {
        throw new Error('Only a confirmed payment can be undone');
      }
      const confirmedAt = existing.confirmedAt?.getTime();
      if (
        confirmedAt == null ||
        Date.now() - confirmedAt > BudgetService.UNDO_CONFIRM_WINDOW_MS
      ) {
        throw new Error('Undo window has expired');
      }

      /* Тот же атомарный guard, что в confirmPayment: между проверкой и записью
         статус мог измениться (например, параллельная отмена). */
      const transition = await prisma.transaction.updateMany({
        where: { id: txId, toUserId: actorUserId, status: 'CONFIRMED' },
        data: { status: 'PAID', confirmedAt: null },
      });
      if (transition.count === 0) throw new Error('Transaction state changed');

      logger.info('Payment confirmation undone', { txId, actorUserId });
      BudgetService.emitDebtUpdated({ ...existing, status: 'PAID' });
      await BudgetService.notifyConfirmationUndone(existing);

      return prisma.transaction.findUnique({
        where: { id: txId },
        include: { fromUser: true, toUser: true },
      });
    } catch (error) {
      logger.error('Error undoing confirmation:', error);
      throw error;
    }
  }

  /**
   * Notify every debtor whose transaction was force-confirmed, then send the
   * responsible person a summary. `transactions` is guaranteed non-empty by
   * the caller.
   */
  private static async notifyAllPaidByResponsible(transactions: any[]): Promise<void> {
    if (botInstance()) {
      for (const tx of transactions) {
        await BudgetService.notifyPaymentConfirmed(tx);
      }
    }

    // Отправляем итоговое сообщение ответственному
    if (botInstance()) {
      const totalReceived = sumDecimals(transactions.map(tx => tx.amount));
      await botInstance()!.api.sendMessage(
        Number(transactions[0].toUser.telegramId),
        `🎊 *Все оплатили!*\n\n` +
          `Ты подтвердил оплату от всех участников\n\n` +
          `💰 Итого получено: ${totalReceived.toFixed(2)}₽\n\n` +
          `*Детали:*\n${transactions
            .map(
              tx =>
                `✅ ${tx.fromUser.firstName} — ${formatCurrency(tx.amount)}`
            )
            .join('\n')}\n\nСпасибо за организацию! 🙏`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  /**
   * Принудительно подтвердить все транзакции по pollId (кнопка "Все оплатили")
   */
  static async markAllPaidByResponsible(
    pollId: number,
    responsibleUserId: number
  ): Promise<void> {
    try {
      const transitioned = await prisma.transaction.updateManyAndReturn({
        where: {
          pollId,
          toUserId: responsibleUserId,
          status: { in: ['PENDING', 'PAID'] },
        },
        data: { status: 'CONFIRMED', confirmedAt: now() },
        select: { id: true },
      });

      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transitioned.map(tx => tx.id) } },
        include: { fromUser: true, toUser: true },
      });

      if (transactions.length === 0) {
        logger.info('markAllPaidByResponsible: no pending transactions', {
          pollId,
        });
        return;
      }

      logger.info('All transactions confirmed by responsible', {
        pollId,
        count: transactions.length,
      });

      await BudgetService.notifyAllPaidByResponsible(transactions);
    } catch (error) {
      logger.error('Error in markAllPaidByResponsible:', error);
      throw error;
    }
  }

  /**
   * Проверка "Все оплатили"
   */
  static async checkAllPaid(
    pollId: number,
    responsibleUserId: number
  ): Promise<void> {
    try {
      const allTx = await prisma.transaction.findMany({
        where: { pollId, toUserId: responsibleUserId },
        include: { fromUser: true, toUser: true },
      });

      const allConfirmed = allTx.every(tx => tx.status === 'CONFIRMED');

      if (allConfirmed && allTx.length > 0 && botInstance) {
        const totalReceived = sumDecimals(allTx.map(tx => tx.amount));

        await botInstance()!.api.sendMessage(
          Number(allTx[0].toUser.telegramId),
          `🎊 *Все оплатили!*\n\n` +
            `Все участники подтвердили оплату\n\n` +
            `💰 Получено: ${totalReceived.toFixed(2)}₽\n\n` +
            `*Подробности:*\n${allTx
              .map(
                tx =>
                  `✅ ${tx.fromUser.firstName} — ${formatCurrency(tx.amount)}`
              )
              .join('\n')}\n\nСпасибо за организацию! 🙏`,
          { parse_mode: 'Markdown' }
        );

        logger.info('All paid notification sent', { pollId });
      }
    } catch (error) {
      logger.error('Error checking all paid:', error);
    }
  }

  /**
   * Пометить транзакцию как оплаченную
   */
  async markAsPaid(transactionId: number, actorUserId: number) {
    return BudgetService.markAsPaid(transactionId, actorUserId);
  }

  /**
   * Подтвердить получение платежа
   */
  async confirmPayment(transactionId: number, actorUserId: number) {
    return BudgetService.confirmPayment(transactionId, actorUserId);
  }

  /**
   * Подтвердить все непогашенные платежи по заказу от имени ответственного.
   */
  async markAllPaidByResponsible(
    pollId: number,
    responsibleUserId: number
  ): Promise<void> {
    return BudgetService.markAllPaidByResponsible(pollId, responsibleUserId);
  }

  /**
   * Отменить пометку оплаты (вернуть в PENDING)
   */
  async cancelMarkAsPaid(transactionId: number, actorUserId: number) {
    try {
      const transition = await prisma.transaction.updateMany({
        where: {
          id: transactionId,
          fromUserId: actorUserId,
          status: 'PAID',
        },
        data: {
          status: 'PENDING',
          paidAt: null,
          confirmedAt: null,
        },
      });
      const tx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { fromUser: true, toUser: true },
      });
      if (!tx) throw new Error('Transaction not found');
      if (tx.fromUserId !== actorUserId) throw new Error('Access denied');
      if (transition.count === 0) {
        if (tx.status === 'PENDING') return tx;
        if (tx.status === 'CONFIRMED') {
          throw new Error('Cannot cancel confirmed payment');
        }
        throw new Error('Transaction state changed');
      }

      logger.info('Transaction mark cancelled', { transactionId });
      BudgetService.emitDebtUpdated(tx);

      // Уведомляем ответственного
      if (botInstance()) {
        await botInstance()!.api.sendMessage(
          Number(tx.toUser.telegramId),
          `⚠️ *Отменена отметка оплаты*\n\n${tx.fromUser.firstName} отменил(а) отметку оплаты ${tx.amount}₽`,
          { parse_mode: 'Markdown' }
        );
      }

      return tx;
    } catch (error) {
      logger.error('Error canceling mark as paid:', error);
      throw error;
    }
  }

}
