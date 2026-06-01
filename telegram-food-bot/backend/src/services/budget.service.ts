import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { Prisma, Transaction, User, MenuItem, StoreItem } from '@prisma/client';

// Локальные типы для замены any
interface TransactionWithUsers extends Transaction {
  fromUser: User;
  toUser: User;
  menuItem?: MenuItem | null;
}

// Транзакция со связями, нужными для рассылки напоминаний
type ReminderTransaction = Prisma.TransactionGetPayload<{
  include: { fromUser: true; toUser: true; poll: { include: { group: true } } };
}>;

interface ResponsibleTotals {
  totalOrder: number;
  responsibleShare: number;
  totalToReturn: number;
}
import { now, toLocaleDateString } from '../utils/date';
import { toNumber, formatCurrency, sumDecimals, multiply } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';

/** @deprecated No-op: bot is now accessed via the shared singleton in bot-instance.ts */
export function initializeBudgetServiceBot(_bot: unknown): void {}

// Helper used throughout this file — replaces the old `let botInstance: any = null`
function botInstance() { return getBotInstance(); }

// Типы для результатов отправки напоминаний
interface SendReminderResult {
  success: boolean;
  error?: string;
  errorCode?: 'bot_blocked' | 'no_chat' | 'user_deactivated' | 'unknown';
}

interface FailedUser {
  id: number;
  firstName: string;
  lastName?: string;
  reason: string;
  errorCode: 'bot_blocked' | 'no_chat' | 'user_deactivated' | 'unknown';
}

interface SendRemindersResult {
  sentCount: number;
  failedCount: number;
  totalCount: number;
  failedUsers: FailedUser[];
}

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

/**
 * Классифицировать ошибку Telegram API
 */
function classifyTelegramError(error: any): { errorCode: SendReminderResult['errorCode']; reason: string } {
  const errorMessage = error?.message || error?.description || String(error);
  
  if (errorMessage.includes('bot was blocked by the user')) {
    return { errorCode: 'bot_blocked', reason: 'Пользователь заблокировал бота' };
  }
  
  if (errorMessage.includes("bot can't initiate conversation") || errorMessage.includes('chat not found')) {
    return { errorCode: 'no_chat', reason: 'Пользователь не начал чат с ботом' };
  }
  
  if (errorMessage.includes('user is deactivated')) {
    return { errorCode: 'user_deactivated', reason: 'Аккаунт пользователя деактивирован' };
  }
  
  return { errorCode: 'unknown', reason: 'Неизвестная ошибка отправки' };
}

export class BudgetService {
  private async filterTransactionsByActiveMembers(
    transactions: Array<Transaction & { poll?: { groupId?: number | null } | null }>,
    relatedUser: 'from' | 'to'
  ) {
    const groupIds = Array.from(
      new Set(transactions.map((tx) => tx.poll?.groupId).filter(Boolean))
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
    memberships.forEach((member) => {
      const existing = membershipByGroup.get(member.groupId) || new Set<number>();
      existing.add(member.userId);
      membershipByGroup.set(member.groupId, existing);
    });

    return transactions.filter((transaction) => {
      const groupId = transaction.poll?.groupId;
      if (!groupId) return true;

      const groupMembers = membershipByGroup.get(groupId);
      if (!groupMembers) {
        return true;
      }

      const relatedUserId =
        relatedUser === 'from'
          ? transaction.fromUserId
          : transaction.toUserId;

      return groupMembers.has(relatedUserId);
    });
  }
  /**
   * Обработка выбранного ответственного
   */
  static async processResponsibleSelected(pollId: number, responsibleUserId: number): Promise<void> {
    logger.info('Processing responsible selected', { pollId, responsibleUserId });

    // Phase 1: DB writes (atomic). If this throws, caller can retry safely —
    // transactions are idempotent on (pollId, fromUserId, toUserId, menuItemId).
    let transactions: Awaited<ReturnType<typeof BudgetService.createTransactionsFromPoll>>;
    try {
      transactions = await this.createTransactionsFromPoll(pollId, responsibleUserId);
      logger.info('Transactions created', { pollId, count: transactions.length });
    } catch (dbError) {
      logger.error('Failed to create transactions for poll', { pollId, dbError });
      throw dbError;
    }

    // Phase 2: notifications (best-effort). DB state already committed; partial
    // notification failures recover via the daily debt reminder cron.
    try {
      await this.sendBudgetNotifications(pollId, responsibleUserId, transactions);
      logger.info('Budget notifications sent', { pollId });
    } catch (notifError) {
      logger.error('Budget notifications partially failed (DB state OK)', {
        pollId,
        notifError,
      });
    }
  }

  /**
   * Создание транзакций из голосования
   */
  static async createTransactionsFromPoll(
    pollId: number,
    responsibleUserId: number
  ): Promise<Transaction[]> {
    try {
      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) {
        throw new Error('Poll result data not found');
      }

      const resultData = JSON.parse(poll.result.rouletteData);
      const transactionsData: Prisma.TransactionCreateManyInput[] = [];

      // Для каждого winner создаем транзакции
      for (const winner of resultData.winners) {
        const price = toNumber(winner.menuItemSnapshot.price);

        for (const voter of winner.voters) {
          // Ответственный не платит себе
          if (voter.userId === responsibleUserId) continue;

          transactionsData.push({
            pollId,
            fromUserId: voter.userId,
            toUserId: responsibleUserId,
            amount: price,
            menuItemId: winner.menuItemId,
            status: 'PENDING',
          });
        }
      }

      // Idempotency: if processResponsibleSelected is retried (network glitch,
      // worker re-run), don't double-insert. Skip insert if any tx already exists
      // for this poll. Atomic check inside a Prisma transaction.
      return await prisma.$transaction(async (tx) => {
        const existingCount = await tx.transaction.count({ where: { pollId } });

        if (existingCount === 0 && transactionsData.length > 0) {
          await tx.transaction.createMany({ data: transactionsData });
        } else if (existingCount > 0) {
          logger.warn(
            'Transactions already exist for poll, skipping insert (idempotent retry)',
            { pollId, existingCount, attemptedCount: transactionsData.length },
          );
        }

        return await tx.transaction.findMany({
          where: { pollId },
          include: {
            fromUser: true,
            toUser: true,
            menuItem: true,
          },
        });
      });
    } catch (error) {
      logger.error('Error creating transactions:', error);
      throw error;
    }
  }

  /**
   * Расчет итоговых сумм
   */
  static async calculateTotals(pollId: number, responsibleUserId: number) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { pollId, toUserId: responsibleUserId },
      });

      const totalToReturn = sumDecimals(transactions.map(tx => tx.amount));

      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) {
        throw new Error('Poll result data not found');
      }

      const resultData = JSON.parse(poll.result.rouletteData);

      const totalOrder = resultData.winners.reduce(
        (sum: number, w: any) => sum + multiply(w.menuItemSnapshot.price, w.voteCount),
        0
      );

      const responsibleItem = resultData.winners.find((w: any) =>
        w.voters.some((v: any) => v.userId === responsibleUserId)
      );
      const responsibleShare = toNumber(responsibleItem?.menuItemSnapshot.price);

      return {
        totalOrder,
        totalToReturn,
        responsibleShare,
        netCost: responsibleShare,
      };
    } catch (error) {
      logger.error('Error calculating totals:', error);
      throw error;
    }
  }

  /**
   * Отправка уведомлений с реквизитами
   */
  static async sendBudgetNotifications(
    pollId: number,
    responsibleUserId: number,
    transactions: any[]
  ): Promise<void> {
    try {
      if (!botInstance) {
        logger.error('Bot instance not initialized');
        return;
      }

      // 1. Получить реквизиты ответственного
      const responsiblePaymentInfo = await UserService.getPaymentInfo(responsibleUserId);
      const responsible = await UserService.getUserById(responsibleUserId);

      if (!responsible) {
        logger.error('Responsible user not found', { responsibleUserId });
        return;
      }

      // 2. Рассчитать итоги
      const totals = await this.calculateTotals(pollId, responsibleUserId);

      // 3. Отправить ответственному
      await this.sendResponsibleNotification(pollId, responsible, transactions, totals);

      // 4. Отправить участникам с реквизитами
      for (const tx of transactions) {
        await this.sendDebtNotification(tx, responsible, responsiblePaymentInfo);
      }

      // 5. Обновить группу
      await this.updateGroupMessage(pollId, responsible, totals);
    } catch (error) {
      logger.error('Error sending budget notifications:', error);
    }
  }

  /**
   * Уведомление ответственному
   */
  static async sendResponsibleNotification(
    pollId: number,
    responsible: User,
    transactions: TransactionWithUsers[],
    totals: ResponsibleTotals
  ): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) return;

      const resultData = JSON.parse(poll.result.rouletteData);
      const pending = transactions.filter((tx) => tx.status === 'PENDING');

      let message = `🎉 *Ты оформляешь заказ!*\n\n`;

      // Кто что заказывает
      message += `🍽️ *Заказ:*\n`;
      resultData.winners.forEach((w: any, i: number) => {
        const voterNames = w.voters.map((v: any) => v.firstName).join(', ');
        const total = multiply(w.menuItemSnapshot.price, w.voteCount);
        message += `${i + 1}. ${w.menuItemName} — ${w.voteCount} чел. (${total.toFixed(2)}₽)\n`;
        message += `   • ${voterNames}\n\n`;
      });

      if (resultData.bringOwn.count > 0) {
        const names = resultData.bringOwn.voters.map((v: any) => v.firstName).join(', ');
        message += `🥪 Своё: ${names}\n\n`;
      }

      // Финансы
      message += `💵 *Деньги:*\n\n`;
      message += `Сумма заказа: ${totals.totalOrder.toFixed(2)}₽\n`;
      message += `Твоя доля: ${totals.responsibleShare.toFixed(2)}₽\n`;
      message += `Вернут тебе: ${totals.totalToReturn.toFixed(2)}₽\n\n`;

      // Кто должен перевести
      if (pending.length > 0) {
        message += `💳 *Ждём перевод:* ⏰ ожидается\n\n`;
        pending.forEach((tx: any, i: number) => {
          message += `${i + 1}. ${tx.fromUser.firstName} → ${formatCurrency(tx.amount)}\n`;
          if (tx.fromUser.username) {
            message += `   📱 @${tx.fromUser.username}\n`;
          }
          message += `   ${tx.fromUser.firstName} — ⏰ ожидается\n\n`;
        });
      }

      // Ваши реквизиты
      message += `📌 *Твои реквизиты* (участники их уже видят):\n`;
      const paymentInfo = await UserService.getPaymentInfo(responsible.id);
      if (paymentInfo?.paymentCard) {
        message += `Карта: ${this.maskCardNumber(paymentInfo.paymentCard)}\n`;
      }
      if (paymentInfo?.paymentPhone) {
        message += `Телефон: ${paymentInfo.paymentPhone}\n`;
      }
      if (paymentInfo?.paymentDetails) {
        message += `ℹ️ ${paymentInfo.paymentDetails}\n`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Все оплатили ✅', callback_data: `budget:all_paid:${pollId}` }],
          [{ text: 'Напомнить должникам 🔔', callback_data: `budget:remind:${pollId}` }],
        ],
      };

      await botInstance()!.api.sendMessage(Number(responsible.telegramId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info('Responsible notification sent', { userId: responsible.id });
    } catch (error) {
      logger.error('Error sending responsible notification:', error);
    }
  }

  /**
   * Уведомление участнику с реквизитами
   */
  static async sendDebtNotification(
    transaction: any,
    responsible: User,
    responsiblePaymentInfo: PaymentInfo | null
  ): Promise<void> {
    try {
      if (!botInstance) return;

      let message = `🍽️ *Результаты голосования*\n\n`;
      message += `Твой заказ: ${transaction.menuItem.name}\n`;
      message += `💰 *Твоя сумма: ${formatCurrency(transaction.amount)}*\n\n`;
      message += `👤 *Ответственный:* ${responsible.firstName}`;
      if (responsible.lastName) message += ` ${responsible.lastName}`;
      message += `\n\n`;

      // Реквизиты из профиля
      message += `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ:*\n\n`;

      if (responsiblePaymentInfo?.paymentCard) {
        const masked = this.maskCardNumber(responsiblePaymentInfo.paymentCard);
        message += `💳 Карта: ${masked}\n`;
      }

      if (responsiblePaymentInfo?.paymentPhone) {
        message += `📱 Телефон: ${responsiblePaymentInfo.paymentPhone} (СБП)\n`;
      }

      if (responsiblePaymentInfo?.paymentDetails) {
        message += `ℹ️ ${responsiblePaymentInfo.paymentDetails}\n`;
      }

      message += `\n💬 Комментарий: Обед ${toLocaleDateString(now())}\n`;
      message += `⏰ Ожидаем заказ`;

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Оплатил(а) ✅', callback_data: `budget:mark_paid:${transaction.id}` }],
        ],
      };

      await botInstance()!.api.sendMessage(Number(transaction.fromUser.telegramId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info('Debt notification sent', { transactionId: transaction.id });
    } catch (error) {
      logger.error('Error sending debt notification:', error);
    }
  }

  /**
   * Обновление сообщения в группе
   */
  static async updateGroupMessage(pollId: number, responsible: User, totals: any): Promise<void> {
    try {
      if (!botInstance) return;

      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) return;

      const resultData = JSON.parse(poll.result.rouletteData);
      const selection = await prisma.responsibleSelection.findUnique({ where: { pollId } });

      let message = `✅ *Голосование завершено!*\n\n`;
      message += `🎯 *Ответственный:* ${responsible.firstName}\n\n`;

      message += `📊 *ЗАКАЗЫ:*\n`;
      resultData.winners.forEach((w: any) => {
        const total = multiply(w.menuItemSnapshot.price, w.voteCount);
        message += `• ${w.menuItemName} — ${w.voteCount} чел. (${total.toFixed(2)}₽)\n`;
      });

      if (resultData.bringOwn.count > 0) {
        message += `🥪 Принесут своё — ${resultData.bringOwn.count} чел.\n`;
      }

      message += `\n💰 *Общая сумма: ${totals.totalOrder.toFixed(2)}₽*\n`;
      message += `👥 Участников: ${resultData.winners.reduce((s: number, w: any) => s + w.voteCount, 0)}\n\n`;
      message += `_Детали и реквизиты отправлены всем в личные сообщения._`;

      if (selection?.messageId && selection.chatId) {
        await botInstance()!.api.editMessageText(
          Number(selection.chatId),
          selection.messageId,
          message,
          { parse_mode: 'Markdown' }
        );
      }

      logger.info('Group message updated', { pollId });
    } catch (error) {
      logger.error('Error updating group message:', error);
    }
  }

  /**
   * Отметить как оплаченное
   */
  static async markAsPaid(txId: number, telegramId: number): Promise<any> {
    try {
      // ✅ FIX: Проверяем текущий статус - нельзя понизить CONFIRMED
      const currentTx = await prisma.transaction.findUnique({
        where: { id: txId },
        select: { status: true },
      });

      if (!currentTx) throw new Error('Transaction not found');
      if (currentTx.status === 'CONFIRMED') throw new Error('Cannot modify confirmed payment');
      if (currentTx.status === 'PAID') {
        return await prisma.transaction.findUnique({
          where: { id: txId },
          include: { fromUser: true, toUser: true, menuItem: true },
        });
      }

      const tx = await prisma.transaction.update({
        where: { id: txId },
        data: { status: 'PAID', paidAt: now() },
        include: { fromUser: true, toUser: true, menuItem: true },
      });

      logger.info('Transaction marked as paid', { txId });

      // Уведомляем ответственного
      if (botInstance()) {
        await botInstance()!.api.sendMessage(
          Number(tx.toUser.telegramId),
          `💳 *Получена оплата!*\n\n${tx.fromUser.firstName} отметил(а) оплату ${formatCurrency(tx.amount)}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: 'Подтвердить ✅', callback_data: `budget:confirm:${txId}` }]],
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
  static async confirmPayment(txId: number): Promise<any> {
    try {
      // ✅ FIX: Проверяем что транзакция в статусе PAID
      const currentTx = await prisma.transaction.findUnique({
        where: { id: txId },
        select: { status: true },
      });

      if (!currentTx) throw new Error('Transaction not found');
      if (currentTx.status === 'CONFIRMED') {
        return await prisma.transaction.findUnique({
          where: { id: txId },
          include: { fromUser: true, toUser: true },
        });
      }
      if (currentTx.status === 'PENDING') throw new Error('Cannot confirm unpaid transaction');

      const tx = await prisma.transaction.update({
        where: { id: txId },
        data: { status: 'CONFIRMED', confirmedAt: now() },
        include: { fromUser: true, toUser: true },
      });

      logger.info('Transaction confirmed', { txId });

      // Уведомляем участника — редактируем существующее долговое сообщение если есть,
      // иначе отправляем новое
      if (botInstance()) {
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
            logger.warn('Could not edit debt message on confirm, sending new one', { txId });
          }
        }
        if (!edited) {
          await botInstance()!.api.sendMessage(
            Number(tx.fromUser.telegramId),
            confirmedText
          );
        }
      }

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

  /**
   * Принудительно подтвердить все транзакции по pollId (кнопка "Все оплатили")
   */
  static async markAllPaidByResponsible(pollId: number, responsibleUserId: number): Promise<void> {
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          pollId,
          toUserId: responsibleUserId,
          status: { in: ['PENDING', 'PAID'] },
        },
        include: { fromUser: true, toUser: true },
      });

      if (transactions.length === 0) {
        logger.info('markAllPaidByResponsible: no pending transactions', { pollId });
        return;
      }

      // Подтверждаем все транзакции одним запросом вместо N последовательных update
      await prisma.transaction.updateMany({
        where: { id: { in: transactions.map(tx => tx.id) } },
        data: { status: 'CONFIRMED', confirmedAt: now() },
      });

      // Уведомляем каждого должника (Telegram неизбежно O(n))
      if (botInstance()) {
        for (const tx of transactions) {
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
              logger.warn('Could not edit debt message on markAllPaid', { txId: tx.id });
            }
          }
          if (!edited) {
            await botInstance()!.api.sendMessage(
              Number(tx.fromUser.telegramId),
              confirmedText
            );
          }
        }
      }

      logger.info('All transactions confirmed by responsible', { pollId, count: transactions.length });

      // Отправляем итоговое сообщение ответственному
      if (botInstance && transactions.length > 0) {
        const totalReceived = sumDecimals(transactions.map(tx => tx.amount));
        await botInstance()!.api.sendMessage(
          Number(transactions[0].toUser.telegramId),
          `🎊 *Все оплатили!*\n\n` +
          `Ты подтвердил оплату от всех участников\n\n` +
          `💰 Итого получено: ${totalReceived.toFixed(2)}₽\n\n` +
          `*Детали:*\n` +
          transactions.map(tx => `✅ ${tx.fromUser.firstName} — ${formatCurrency(tx.amount)}`).join('\n') +
          `\n\nСпасибо за организацию! 🙏`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      logger.error('Error in markAllPaidByResponsible:', error);
      throw error;
    }
  }

  /**
   * Отправить напоминания всем PENDING должникам (кнопка "Напомнить должникам")
   * Статический враппер над instance-методом sendRemindersToAll
   */
  static async remindAllDebtors(pollId: number, responsibleUserId: number): Promise<string> {
    try {
      const instance = new BudgetService();
      const result = await instance.sendRemindersToAll(pollId, responsibleUserId);

      if (result.totalCount === 0) {
        return '✅ Все уже оплатили — напоминать некому!';
      }

      let reply = `🔔 Напоминания отправлены: ${result.sentCount} из ${result.totalCount}`;
      if (result.failedCount > 0) {
        const names = result.failedUsers.map(u => u.firstName).join(', ');
        reply += `\n⚠️ Не удалось отправить: ${names}`;
      }
      return reply;
    } catch (error) {
      logger.error('Error in remindAllDebtors:', error);
      throw error;
    }
  }

  /**
   * Проверка "Все оплатили"
   */
  static async checkAllPaid(pollId: number, responsibleUserId: number): Promise<void> {
    try {
      const allTx = await prisma.transaction.findMany({
        where: { pollId, toUserId: responsibleUserId },
        include: { fromUser: true, toUser: true },
      });

      const allConfirmed = allTx.every((tx) => tx.status === 'CONFIRMED');

      if (allConfirmed && allTx.length > 0 && botInstance) {
        const totalReceived = sumDecimals(allTx.map(tx => tx.amount));

        await botInstance()!.api.sendMessage(
          Number(allTx[0].toUser.telegramId),
          `🎊 *Все оплатили!*\n\n` +
            `Все участники подтвердили оплату\n\n` +
            `💰 Получено: ${totalReceived.toFixed(2)}₽\n\n` +
            `*Подробности:*\n${ 
            allTx.map((tx) => `✅ ${tx.fromUser.firstName} — ${formatCurrency(tx.amount)}`).join('\n') 
            }\n\nСпасибо за организацию! 🙏`,
          { parse_mode: 'Markdown' }
        );

        logger.info('All paid notification sent', { pollId });
      }
    } catch (error) {
      logger.error('Error checking all paid:', error);
    }
  }

  /**
   * Маскирование номера карты
   * Sprint 1: Используем EncryptionService для обработки зашифрованных данных
   */
  private static maskCardNumber(cardNumber: string): string {
    // Импортируем динамически чтобы избежать циклических зависимостей
    const { EncryptionService } = require('../utils/encryption');
    return EncryptionService.maskCardNumber(cardNumber);
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
          fromUser: true, // Кто должен (сам пользователь)
          toUser: true,   // Кому должен
          menuItem: true,
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
          fromUser: true,
          menuItem: true,
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
   * Пометить транзакцию как оплаченную
   */
  async markAsPaid(transactionId: number) {
    try {
      // Получаем транзакцию чтобы взять telegramId
      const tx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { fromUser: true },
      });
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      return BudgetService.markAsPaid(transactionId, Number(tx.fromUser.telegramId));
    } catch (error) {
      logger.error('Error marking as paid:', error);
      throw error;
    }
  }

  /**
   * Подтвердить получение платежа
   */
  async confirmPayment(transactionId: number) {
    return BudgetService.confirmPayment(transactionId);
  }

  /**
   * Отменить пометку оплаты (вернуть в PENDING)
   */
  async cancelMarkAsPaid(transactionId: number) {
    try {
      // ✅ FIX: Проверяем текущий статус - нельзя отменить подтверждённый платёж
      const currentTx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { status: true },
      });

      if (!currentTx) {
        throw new Error('Transaction not found');
      }

      if (currentTx.status === 'CONFIRMED') {
        throw new Error('Cannot cancel confirmed payment');
      }

      if (currentTx.status === 'PENDING') {
        logger.warn('Transaction already in PENDING status', { transactionId });
        return await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { fromUser: true, toUser: true },
        });
      }

      const tx = await prisma.transaction.update({
        where: { id: transactionId },
        data: { 
          status: 'PENDING', 
          paidAt: null,
          // ✅ FIX: Очищаем confirmedAt при отмене
          confirmedAt: null,
        },
        include: { fromUser: true, toUser: true },
      });

      logger.info('Transaction mark cancelled', { transactionId });

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
      const debts = transactions.filter((tx) => tx.fromUserId === userId);
      const credits = transactions.filter((tx) => tx.toUserId === userId);

      const totalSpent = sumDecimals(debts.map(tx => tx.amount));
      const totalReceived = sumDecimals(credits.map(tx => tx.amount));
      const balance = totalReceived - totalSpent;

      const confirmedDebts = debts.filter((tx) => tx.status === 'CONFIRMED');
      const averagePerOrder = confirmedDebts.length > 0 
        ? totalSpent / confirmedDebts.length 
        : 0;

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
        pendingOrders: debts.filter((tx) => tx.status === 'PENDING').length,
        topDishes,
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Получить итоговые суммы по заказу (instance wrapper)
   */
  async calculateTotals(pollId: number, responsibleUserId: number) {
    return BudgetService.calculateTotals(pollId, responsibleUserId);
  }

  /**
   * Доставка одного напоминания: валидация + текст + отправка в Telegram.
   * Не пишет в БД — запись/счётчик делает вызывающий (поштучно или пачкой).
   */
  private async deliverReminder(
    transaction: ReminderTransaction,
    requestingUserId: number
  ): Promise<
    | { ok: true; message: string }
    | { ok: false; error: string; errorCode: SendReminderResult['errorCode'] }
  > {
    // Проверяем, что запрашивающий - это получатель платежа
    if (transaction.toUserId !== requestingUserId) {
      return { ok: false, error: 'Only creditor can send reminders', errorCode: 'unknown' };
    }

    if (!botInstance) {
      logger.error('Bot instance not initialized');
      return { ok: false, error: 'Bot not available', errorCode: 'unknown' };
    }

    // Формируем сообщение
    const amount = toNumber(transaction.amount).toFixed(2);
    const creditorName = transaction.toUser.firstName;
    const groupName = transaction.poll?.group?.title || 'группа';

    const message = `
💰 Напоминание об оплате

Привет! ${creditorName} напоминает о платеже:
💸 Сумма: ${amount}₽
📍 Заказ в ${groupName}

${transaction.toUser.paymentPhone ? `📱 СБП: ${transaction.toUser.paymentPhone}` : ''}
${transaction.toUser.paymentCard ? `💳 Карта: ${transaction.toUser.paymentCard}` : ''}

Отметь оплату в Mini App после перевода 👍
      `.trim();

    // Отправляем уведомление
    try {
      await botInstance()!.api.sendMessage(Number(transaction.fromUser.telegramId), message);
      return { ok: true, message };
    } catch (sendError: any) {
      // Классифицируем ошибку Telegram API
      const { errorCode, reason } = classifyTelegramError(sendError);
      logger.warn('Failed to send reminder via Telegram', {
        transactionId: transaction.id,
        userId: transaction.fromUserId,
        errorCode,
        reason,
        originalError: sendError.message,
      });
      return { ok: false, error: reason, errorCode };
    }
  }

  /**
   * Отправить напоминание должнику
   */
  async sendReminder(transactionId: number, requestingUserId: number): Promise<SendReminderResult> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          fromUser: true,
          toUser: true,
          poll: {
            include: {
              group: true,
            },
          },
        },
      });

      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found',
          errorCode: 'unknown',
        };
      }

      const result = await this.deliverReminder(transaction, requestingUserId);

      if (!result.ok) {
        return { success: false, error: result.error, errorCode: result.errorCode };
      }

      // Сохраняем запись о напоминании
      await prisma.paymentReminder.create({
        data: {
          transactionId: transaction.id,
          type: 'MANUAL',
          sentBy: requestingUserId,
          message: result.message,
        },
      });

      // Обновляем счетчик напоминаний
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          reminderCount: { increment: 1 },
          lastReminderAt: now(),
        },
      });

      logger.info('Reminder sent successfully', { transactionId, fromUserId: transaction.fromUserId });
      return { success: true };
    } catch (error) {
      logger.error('Error in sendReminder:', error);
      return {
        success: false,
        error: 'Internal error',
        errorCode: 'unknown',
      };
    }
  }

  /**
   * Отправить напоминания всем должникам (для ответственного)
   */
  async sendRemindersToAll(pollId: number, requestingUserId: number): Promise<SendRemindersResult> {
    try {
      // Получаем все pending транзакции для этого poll (со всеми связями для рассылки)
      const transactions = await prisma.transaction.findMany({
        where: {
          pollId,
          toUserId: requestingUserId,
          status: 'PENDING',
        },
        include: {
          fromUser: true,
          toUser: true,
          poll: {
            include: {
              group: true,
            },
          },
        },
      });

      const totalCount = transactions.length;
      let sentCount = 0;
      const failedUsers: FailedUser[] = [];
      const sentReminders: { transactionId: number; message: string }[] = [];

      for (const transaction of transactions) {
        const result = await this.deliverReminder(transaction, requestingUserId);

        if (result.ok) {
          sentCount++;
          sentReminders.push({ transactionId: transaction.id, message: result.message });
        } else {
          failedUsers.push({
            id: transaction.fromUser.id,
            firstName: transaction.fromUser.firstName,
            lastName: transaction.fromUser.lastName || undefined,
            reason: result.error || 'Неизвестная ошибка',
            errorCode: result.errorCode || 'unknown',
          });
        }
      }

      // Пачкой: запись напоминаний + единый инкремент счётчиков для успешных
      if (sentReminders.length > 0) {
        await prisma.paymentReminder.createMany({
          data: sentReminders.map(r => ({
            transactionId: r.transactionId,
            type: 'MANUAL' as const,
            sentBy: requestingUserId,
            message: r.message,
          })),
        });

        await prisma.transaction.updateMany({
          where: { id: { in: sentReminders.map(r => r.transactionId) } },
          data: {
            reminderCount: { increment: 1 },
            lastReminderAt: now(),
          },
        });
      }

      const failedCount = failedUsers.length;

      logger.info('Reminders sent to all', {
        pollId,
        totalCount,
        sentCount,
        failedCount,
        failedUserIds: failedUsers.map(u => u.id),
      });

      return {
        sentCount,
        failedCount,
        totalCount,
        failedUsers,
      };
    } catch (error) {
      logger.error('Error sending reminders to all:', error);
      throw error;
    }
  }

  // ============================================
  // COST SPLITTING METHODS
  // ============================================

  /**
   * Set order costs (delivery, service, tips) for a poll
   * Only the responsible person can set costs
   */
  async setOrderCosts(
    pollId: number,
    userId: number,
    costs: { deliveryCost: number; serviceFee: number; tip: number; notes?: string }
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

      const responsibleUserId = poll.result?.responsibleUserId || poll.responsibleSelection?.selectedUserId;

      if (responsibleUserId !== userId) {
        throw new Error('Only responsible person can set order costs');
      }

      // Atomic: upsert costs + recalculate all transactions in a single tx.
      // Without this, a crash between upsert and recalc leaves costs saved but
      // transactions still at old amounts (silent state drift seen by users).
      const orderCosts = await prisma.$transaction(async (tx) => {
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
          const participantsCount = transactions.length;
          const deliveryShare = toNumber(upserted.deliveryCost) / participantsCount;
          const serviceShare = toNumber(upserted.serviceFee) / participantsCount;
          const tipShare = toNumber(upserted.tip) / participantsCount;

          for (const transaction of transactions) {
            const itemPrice = toNumber(transaction.menuItem?.price);
            const newAmount = itemPrice + deliveryShare + serviceShare + tipShare;
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

      logger.info('Order costs set and transactions recalculated atomically', { pollId, orderCosts });

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

      const transactionBreakdowns = transactions.map((tx) => ({
        transactionId: tx.id,
        userId: tx.fromUserId,
        userName: tx.fromUser.firstName,
        menuItemName: tx.menuItem?.name || 'Unknown',
        itemPrice: toNumber(tx.itemPrice),
        deliveryShare: toNumber(tx.deliveryShare),
        serviceShare: toNumber(tx.serviceShare),
        tipShare: toNumber(tx.tipShare),
        totalAmount: toNumber(tx.amount),
        status: tx.status as 'PENDING' | 'PAID' | 'CONFIRMED',
      }));

      const totalItemsCost = transactionBreakdowns.reduce((sum, tx) => sum + tx.itemPrice, 0);
      const totalDeliveryCost = toNumber(orderCosts?.deliveryCost);
      const totalServiceFee = toNumber(orderCosts?.serviceFee);
      const totalTip = toNumber(orderCosts?.tip);
      const grandTotal = totalItemsCost + totalDeliveryCost + totalServiceFee + totalTip;

      return {
        pollId,
        totalItemsCost,
        totalDeliveryCost,
        totalServiceFee,
        totalTip,
        grandTotal,
        participantsCount: transactions.length,
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

  /**
   * Создать транзакции по завершённому магазинному забегу.
   * Одна транзакция на каждый StoreItem со статусом BOUGHT.
   * Позиции инициатора (он сам себе купил) пропускаются — долга нет.
   * Идемпотентно: если для данного storeRunId транзакции уже есть — возвращает существующие.
   */
  static async createTransactionsForStoreRun(
    storeRunId: number,
  ): Promise<Transaction[]> {
    try {
      const storeRun = await prisma.storeRun.findUnique({
        where: { id: storeRunId },
        include: {
          items: true,
        },
      });
      if (!storeRun) {
        throw new Error(`Store run ${storeRunId} not found`);
      }

      const existing = await prisma.transaction.findMany({
        where: { storeRunId },
      });
      if (existing.length > 0) {
        logger.info('Store run transactions already exist, skipping', {
          storeRunId,
          count: existing.length,
        });
        return existing;
      }

      const boughtItems = storeRun.items.filter(
        (item: StoreItem) =>
          item.status === 'BOUGHT' &&
          item.price != null &&
          item.userId !== storeRun.initiatorId,
      );

      if (boughtItems.length === 0) {
        logger.info('No billable items for store run', { storeRunId });
        return [];
      }

      const created: Transaction[] = [];
      for (const item of boughtItems) {
        const amount = item.price as Prisma.Decimal;
        const tx = await prisma.transaction.create({
          data: {
            storeRunId,
            storeItemId: item.id,
            fromUserId: item.userId,
            toUserId: storeRun.initiatorId,
            amount,
            itemPrice: amount,
            status: 'PENDING',
          },
        });
        created.push(tx);
      }

      logger.info('Store run transactions created', {
        storeRunId,
        count: created.length,
        initiatorId: storeRun.initiatorId,
      });

      return created;
    } catch (error) {
      logger.error('Error creating transactions for store run:', error);
      throw error;
    }
  }

  // ==================================================================
  // STORE RUN settlement notifications ("Иду в магазин" → расчёт)
  // ==================================================================

  /**
   * Разослать долговые уведомления после финализации забега.
   * Один забег → по транзакции на каждый купленный товар; здесь группируем
   * по должнику, чтобы человек платил одним переводом за весь свой заказ.
   * Каждому должнику — ЛС с позициями, суммой и реквизитами инициатора;
   * инициатору — сводка кто сколько должен.
   */
  static async notifyStoreRunSettled(storeRunId: number): Promise<void> {
    try {
      if (!botInstance()) {
        logger.error('notifyStoreRunSettled: bot not initialized', { storeRunId });
        return;
      }

      const storeRun = await prisma.storeRun.findUnique({
        where: { id: storeRunId },
        include: { initiator: true },
      });
      if (!storeRun) return;

      const transactions = await prisma.transaction.findMany({
        where: { storeRunId, status: 'PENDING' },
        include: { fromUser: true, storeItem: true },
      });
      if (transactions.length === 0) {
        logger.info('notifyStoreRunSettled: no pending transactions', { storeRunId });
        return;
      }

      const initiator = storeRun.initiator;
      const paymentInfo = await UserService.getPaymentInfo(initiator.id);

      type SrunTx = (typeof transactions)[number];
      const byDebtor = new Map<number, SrunTx[]>();
      for (const tx of transactions) {
        const arr = byDebtor.get(tx.fromUserId) ?? [];
        arr.push(tx);
        byDebtor.set(tx.fromUserId, arr);
      }

      for (const [, txs] of byDebtor) {
        await this.sendStoreRunDebtNotification(storeRun, txs, initiator, paymentInfo);
      }

      await this.sendStoreRunCreditorSummary(storeRun, transactions, byDebtor);

      logger.info('Store run settle notifications sent', {
        storeRunId,
        debtors: byDebtor.size,
        transactions: transactions.length,
      });
    } catch (error) {
      logger.error('Error sending store run settle notifications:', error);
    }
  }

  /** ЛС должнику: позиции + сумма + реквизиты инициатора + кнопка «Оплатил». */
  private static async sendStoreRunDebtNotification(
    storeRun: any,
    txs: any[],
    initiator: User,
    paymentInfo: PaymentInfo | null,
  ): Promise<void> {
    try {
      if (!botInstance() || txs.length === 0) return;
      const debtor = txs[0].fromUser;
      const total = sumDecimals(txs.map((t) => t.amount));

      let message = `🛒 *Заказ из «${storeRun.storeName}» собран*\n\n`;
      message += `*Твои позиции:*\n`;
      for (const t of txs) {
        const name = t.storeItem?.name ?? 'позиция';
        message += `• ${name} — ${formatCurrency(t.amount)}\n`;
      }
      message += `\n💰 *К оплате: ${formatCurrency(total)}*\n`;
      message += `👤 *Кому:* ${initiator.firstName}`;
      if (initiator.lastName) message += ` ${initiator.lastName}`;
      message += `\n\n`;

      if (paymentInfo?.paymentCard || paymentInfo?.paymentPhone || paymentInfo?.paymentDetails) {
        message += `💳 *Реквизиты:*\n`;
        if (paymentInfo.paymentCard) {
          message += `💳 Карта: ${this.maskCardNumber(paymentInfo.paymentCard)}\n`;
        }
        if (paymentInfo.paymentPhone) {
          message += `📱 Телефон: ${paymentInfo.paymentPhone} (СБП)\n`;
        }
        if (paymentInfo.paymentDetails) {
          message += `ℹ️ ${paymentInfo.paymentDetails}\n`;
        }
      } else {
        message += `_${initiator.firstName} не заполнил реквизиты — уточни перевод лично._\n`;
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Оплатил(а) ✅', callback_data: `budget:srun_paid:${storeRun.id}` }],
        ],
      };

      await botInstance()!.api.sendMessage(Number(debtor.telegramId), message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      logger.info('Store run debt notification sent', {
        storeRunId: storeRun.id,
        debtorId: debtor.id,
        items: txs.length,
      });
    } catch (error) {
      logger.error('Error sending store run debt notification:', error);
    }
  }

  /** ЛС инициатору: сводка «кто сколько должен». */
  private static async sendStoreRunCreditorSummary(
    storeRun: any,
    transactions: any[],
    byDebtor: Map<number, any[]>,
  ): Promise<void> {
    try {
      if (!botInstance()) return;
      const total = sumDecimals(transactions.map((t) => t.amount));

      let message = `🛍 *Забег «${storeRun.storeName}» закрыт*\n\n`;
      message += `Разослал участникам суммы и твои реквизиты.\n\n`;
      message += `💰 *Тебе вернут: ${formatCurrency(total)}*\n\n`;
      message += `*Ждём перевод:*\n`;
      for (const [, txs] of byDebtor) {
        const debtor = txs[0].fromUser;
        const sub = sumDecimals(txs.map((t) => t.amount));
        message += `• ${debtor.firstName} — ${formatCurrency(sub)}\n`;
      }

      await botInstance()!.api.sendMessage(Number(storeRun.initiator.telegramId), message, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('Error sending store run creditor summary:', error);
    }
  }

  /**
   * Должник отметил оплату всего своего магазинного заказа (callback budget:srun_paid).
   * Переводит все его PENDING-транзакции забега в PAID и шлёт инициатору
   * одно уведомление с кнопкой подтверждения.
   */
  static async markStoreRunPaidByDebtor(
    storeRunId: number,
    debtorTelegramId: number,
  ): Promise<{ count: number; total: string } | null> {
    const debtor = await prisma.user.findFirst({
      where: { telegramId: BigInt(debtorTelegramId) },
    });
    if (!debtor) return null;

    const txs = await prisma.transaction.findMany({
      where: { storeRunId, fromUserId: debtor.id, status: 'PENDING' },
      include: { toUser: true },
    });
    if (txs.length === 0) return null;

    await prisma.transaction.updateMany({
      where: { storeRunId, fromUserId: debtor.id, status: 'PENDING' },
      data: { status: 'PAID', paidAt: now() },
    });

    const total = sumDecimals(txs.map((t) => t.amount));
    const initiator = txs[0].toUser;

    if (botInstance()) {
      await botInstance()!.api.sendMessage(
        Number(initiator.telegramId),
        `💳 *Получена оплата по магазину!*\n\n${debtor.firstName} отметил(а) оплату ${formatCurrency(total)}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Подтвердить ✅',
                  callback_data: `budget:srun_confirm:${storeRunId}:${debtor.id}`,
                },
              ],
            ],
          },
        },
      );
    }

    logger.info('Store run debt marked paid by debtor', {
      storeRunId,
      debtorId: debtor.id,
      count: txs.length,
    });
    return { count: txs.length, total: formatCurrency(total) };
  }

  /**
   * Инициатор подтвердил получение оплаты от должника (callback budget:srun_confirm).
   * Переводит PENDING/PAID транзакции этого должника в CONFIRMED и уведомляет его.
   * Возвращает 'forbidden', если подтверждает не инициатор забега.
   */
  static async confirmStoreRunByDebtor(
    storeRunId: number,
    debtorUserId: number,
    confirmerTelegramId: number,
  ): Promise<{ count: number } | { error: 'no_tx' | 'forbidden' }> {
    const txs = await prisma.transaction.findMany({
      where: {
        storeRunId,
        fromUserId: debtorUserId,
        status: { in: ['PENDING', 'PAID'] },
      },
      include: { fromUser: true, toUser: true },
    });
    if (txs.length === 0) return { error: 'no_tx' };

    const initiator = txs[0].toUser;
    if (Number(initiator.telegramId) !== confirmerTelegramId) {
      return { error: 'forbidden' };
    }

    await prisma.transaction.updateMany({
      where: {
        storeRunId,
        fromUserId: debtorUserId,
        status: { in: ['PENDING', 'PAID'] },
      },
      data: { status: 'CONFIRMED', confirmedAt: now() },
    });

    const debtor = txs[0].fromUser;
    const total = sumDecimals(txs.map((t) => t.amount));

    if (botInstance()) {
      await botInstance()!.api.sendMessage(
        Number(debtor.telegramId),
        `✅ Оплата подтверждена!\n\n${initiator.firstName} подтвердил(а) получение ${formatCurrency(total)}\n\nСпасибо! 🎉`,
      );
    }

    logger.info('Store run debt confirmed by initiator', {
      storeRunId,
      debtorId: debtorUserId,
      count: txs.length,
    });
    return { count: txs.length };
  }
}
