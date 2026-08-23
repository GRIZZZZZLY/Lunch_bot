import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { UserService } from './user.service';
import { Prisma, Transaction, User, MenuItem } from '@prisma/client';
import { now, toLocaleDateString } from '../utils/date';
import { toNumber, formatCurrency, sumDecimals, multiply } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';
import { PollQueryService } from './poll-query.service';

function maskCardNumber(cardNumber: string): string {
  // Sprint 1: используем EncryptionService для обработки зашифрованных данных
  const { EncryptionService } = require('../utils/encryption');
  return EncryptionService.maskCardNumber(cardNumber);
}

// Локальные типы для замены any
interface TransactionWithUsers extends Transaction {
  fromUser: User;
  toUser: User;
  menuItem?: MenuItem | null;
}

interface ResponsibleTotals {
  totalOrder: number;
  responsibleShare: number;
  totalToReturn: number;
}

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

/**
 * Turning a resolved poll (winning dish per voter) into debts, and telling
 * everyone about it: the responsible person, each debtor, and the group chat.
 *
 * Split out of BudgetService (a god class covering payment state, order
 * costs, reminders, and queries besides this) — creates the Transaction rows
 * the payment state machine then transitions, but owns none of those
 * transitions itself.
 */
export class PollFlowService {
  /**
   * Обработка выбранного ответственного
   */
  static async processResponsibleSelected(
    pollId: number,
    responsibleUserId: number
  ): Promise<void> {
    logger.info('Processing responsible selected', {
      pollId,
      responsibleUserId,
    });

    // Phase 1: DB writes (atomic). If this throws, caller can retry safely —
    // transactions are idempotent on (pollId, fromUserId, toUserId, menuItemId).
    let transactions: Awaited<
      ReturnType<typeof PollFlowService.createTransactionsFromPoll>
    >;
    try {
      transactions = await this.createTransactionsFromPoll(
        pollId,
        responsibleUserId
      );
      logger.info('Transactions created', {
        pollId,
        count: transactions.length,
      });
    } catch (dbError) {
      logger.error('Failed to create transactions for poll', {
        pollId,
        dbError,
      });
      throw dbError;
    }

    // Phase 2: notifications (best-effort). DB state already committed; partial
    // notification failures recover via the daily debt reminder cron.
    try {
      await this.sendBudgetNotifications(
        pollId,
        responsibleUserId,
        transactions
      );
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
      const poll = (await PollQueryService.getPollById(pollId)) as any;
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
      return await prisma.$transaction(async tx => {
        const existingCount = await tx.transaction.count({ where: { pollId } });

        if (existingCount === 0 && transactionsData.length > 0) {
          await tx.transaction.createMany({ data: transactionsData });
        } else if (existingCount > 0) {
          logger.warn(
            'Transactions already exist for poll, skipping insert (idempotent retry)',
            { pollId, existingCount, attemptedCount: transactionsData.length }
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

      const poll = (await PollQueryService.getPollById(pollId)) as any;
      if (!poll?.result?.rouletteData) {
        throw new Error('Poll result data not found');
      }

      const resultData = JSON.parse(poll.result.rouletteData);

      const totalOrder = resultData.winners.reduce(
        (sum: number, w: any) =>
          sum + multiply(w.menuItemSnapshot.price, w.voteCount),
        0
      );

      const responsibleItem = resultData.winners.find((w: any) =>
        w.voters.some((v: any) => v.userId === responsibleUserId)
      );
      const responsibleShare = toNumber(
        responsibleItem?.menuItemSnapshot.price
      );

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
   * Получить итоговые суммы по заказу (instance wrapper)
   */
  async calculateTotals(pollId: number, responsibleUserId: number) {
    return PollFlowService.calculateTotals(pollId, responsibleUserId);
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
      // Без бота вся рассылка бессмысленна — не тратим запросы к БД.
      // Каждый из вызываемых ниже методов публичный и проверяет бота сам.
      if (!getBotInstance()) {
        logger.error('Bot instance not initialized');
        return;
      }

      // 1. Получить реквизиты ответственного
      const responsiblePaymentInfo =
        await UserService.getPaymentInfo(responsibleUserId);
      const responsible = await UserService.getUserById(responsibleUserId);

      if (!responsible) {
        logger.error('Responsible user not found', { responsibleUserId });
        return;
      }

      // 2. Рассчитать итоги
      const totals = await this.calculateTotals(pollId, responsibleUserId);

      // 3. Отправить ответственному
      await this.sendResponsibleNotification(
        pollId,
        responsible,
        transactions,
        totals
      );

      // 4. Отправить участникам с реквизитами
      for (const tx of transactions) {
        await this.sendDebtNotification(
          tx,
          responsible,
          responsiblePaymentInfo
        );
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
      const bot = getBotInstance();
      if (!bot) {
        logger.warn('Bot instance not initialized, skipping notification');
        return;
      }

      const poll = (await PollQueryService.getPollById(pollId)) as any;
      if (!poll?.result?.rouletteData) return;

      const resultData = JSON.parse(poll.result.rouletteData);
      const pending = transactions.filter(tx => tx.status === 'PENDING');

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
        const names = resultData.bringOwn.voters
          .map((v: any) => v.firstName)
          .join(', ');
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
        message += `Карта: ${maskCardNumber(paymentInfo.paymentCard)}\n`;
      }
      if (paymentInfo?.paymentPhone) {
        message += `Телефон: ${paymentInfo.paymentPhone}\n`;
      }
      if (paymentInfo?.paymentDetails) {
        message += `ℹ️ ${paymentInfo.paymentDetails}\n`;
      }

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: 'Все оплатили ✅',
              callback_data: `budget:all_paid:${pollId}`,
            },
          ],
          [
            {
              text: 'Напомнить должникам 🔔',
              callback_data: `budget:remind:${pollId}`,
            },
          ],
        ],
      };

      await bot.api.sendMessage(Number(responsible.telegramId), message, {
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
      const bot = getBotInstance();
      if (!bot) return;

      let message = `🍽️ *Результаты голосования*\n\n`;
      message += `Твой заказ: ${transaction.menuItem.name}\n`;
      message += `💰 *Твоя сумма: ${formatCurrency(transaction.amount)}*\n\n`;
      message += `👤 *Ответственный:* ${responsible.firstName}`;
      if (responsible.lastName) message += ` ${responsible.lastName}`;
      message += `\n\n`;

      // Реквизиты из профиля
      message += `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ:*\n\n`;

      if (responsiblePaymentInfo?.paymentCard) {
        const masked = maskCardNumber(responsiblePaymentInfo.paymentCard);
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
          [
            {
              text: 'Оплатил(а) ✅',
              callback_data: `budget:mark_paid:${transaction.id}`,
            },
          ],
        ],
      };

      await bot.api.sendMessage(
        Number(transaction.fromUser.telegramId),
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );

      logger.info('Debt notification sent', { transactionId: transaction.id });
    } catch (error) {
      logger.error('Error sending debt notification:', error);
    }
  }

  /**
   * Обновление сообщения в группе
   */
  static async updateGroupMessage(
    pollId: number,
    responsible: User,
    totals: any
  ): Promise<void> {
    try {
      const bot = getBotInstance();
      if (!bot) return;

      const poll = (await PollQueryService.getPollById(pollId)) as any;
      if (!poll?.result?.rouletteData) return;

      const resultData = JSON.parse(poll.result.rouletteData);
      const selection = await prisma.responsibleSelection.findUnique({
        where: { pollId },
      });

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
        await bot.api.editMessageText(
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
}
