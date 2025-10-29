import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollService } from './poll.service';
import { UserService } from './user.service';
import { Prisma, Transaction, User } from '@prisma/client';

let botInstance: any = null;

export function initializeBudgetServiceBot(bot: any): void {
  botInstance = bot;
  logger.info('BudgetService bot instance initialized');
}

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

export class BudgetService {
  /**
   * Обработка выбранного ответственного
   */
  static async processResponsibleSelected(pollId: number, responsibleUserId: number): Promise<void> {
    try {
      logger.info('Processing responsible selected', { pollId, responsibleUserId });

      // 1. Создаем транзакции
      const transactions = await this.createTransactionsFromPoll(pollId, responsibleUserId);

      logger.info('Transactions created', { pollId, count: transactions.length });

      // 2. Отправляем уведомления с реквизитами
      await this.sendBudgetNotifications(pollId, responsibleUserId, transactions);

      logger.info('Budget notifications sent', { pollId });
    } catch (error) {
      logger.error('Error processing responsible selected:', error);
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
        const price = winner.menuItemSnapshot.price || 0;

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

      if (transactionsData.length > 0) {
        await prisma.transaction.createMany({ data: transactionsData });
      }

      // Возвращаем с relations
      return await prisma.transaction.findMany({
        where: { pollId },
        include: {
          fromUser: true,
          toUser: true,
          menuItem: true,
        },
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

      const totalToReturn = transactions.reduce((sum, tx) => sum + tx.amount, 0);

      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) {
        throw new Error('Poll result data not found');
      }

      const resultData = JSON.parse(poll.result.rouletteData);

      const totalOrder = resultData.winners.reduce(
        (sum: number, w: any) => sum + (w.menuItemSnapshot.price || 0) * w.voteCount,
        0
      );

      const responsibleItem = resultData.winners.find((w: any) =>
        w.voters.some((v: any) => v.userId === responsibleUserId)
      );
      const responsibleShare = responsibleItem?.menuItemSnapshot.price || 0;

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
    transactions: any[],
    totals: any
  ): Promise<void> {
    try {
      const poll = await PollService.getPollById(pollId) as any;
      if (!poll?.result?.rouletteData) return;

      const resultData = JSON.parse(poll.result.rouletteData);
      const pending = transactions.filter((tx) => tx.status === 'PENDING');

      let message = `🎉 *Вы выбраны ответственным за заказ!*\n\n`;
      message += `📋 *ДЕТАЛИ ЗАКАЗА:*\n\n`;

      // Кто что заказывает
      message += `🍽️ *Заказы:*\n`;
      resultData.winners.forEach((w: any, i: number) => {
        const voterNames = w.voters.map((v: any) => v.firstName).join(', ');
        const total = (w.menuItemSnapshot.price || 0) * w.voteCount;
        message += `${i + 1}. ${w.menuItemName} — ${w.voteCount} чел. (${total}₽)\n`;
        message += `   • ${voterNames}\n\n`;
      });

      if (resultData.bringOwn.count > 0) {
        const names = resultData.bringOwn.voters.map((v: any) => v.firstName).join(', ');
        message += `🥪 *Принесут своё:* ${names}\n\n`;
      }

      // Финансы
      message += `💵 *ФИНАНСЫ:*\n\n`;
      message += `Общая сумма: ${totals.totalOrder}₽\n`;
      message += `Ваша доля: ${totals.responsibleShare}₽\n`;
      message += `Вернут вам: ${totals.totalToReturn}₽\n\n`;

      // Кто должен перевести
      if (pending.length > 0) {
        message += `💳 *ПЕРЕВОДЫ ОЖИДАЮТСЯ ОТ:*\n\n`;
        pending.forEach((tx: any, i: number) => {
          message += `${i + 1}. ${tx.fromUser.firstName} → ${tx.amount}₽\n`;
          if (tx.fromUser.username) {
            message += `   📱 @${tx.fromUser.username}\n`;
          }
          message += `   Status: ⏰ Ожидается\n\n`;
        });
      }

      // Ваши реквизиты
      message += `📌 *ВАШИ РЕКВИЗИТЫ:*\n`;
      const paymentInfo = await UserService.getPaymentInfo(responsible.id);
      if (paymentInfo?.paymentCard) {
        message += `💳 Карта: ${this.maskCardNumber(paymentInfo.paymentCard)}\n`;
      }
      if (paymentInfo?.paymentPhone) {
        message += `📱 Телефон: ${paymentInfo.paymentPhone}\n`;
      }
      if (paymentInfo?.paymentDetails) {
        message += `ℹ️ ${paymentInfo.paymentDetails}\n`;
      }
      message += `_(Участники уже получили их)_\n\n`;

      message += `⏰ Заказ на обед`;

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Все оплатили ✅', callback_data: `budget:all_paid:${pollId}` }],
          [{ text: 'Напомнить должникам 🔔', callback_data: `budget:remind:${pollId}` }],
        ],
      };

      await botInstance.api.sendMessage(Number(responsible.telegramId), message, {
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
      message += `Ваш заказ: ${transaction.menuItem.name}\n`;
      message += `💰 *Ваша сумма: ${transaction.amount}₽*\n\n`;
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

      message += `\n💬 Комментарий: Обед ${new Date().toLocaleDateString('ru')}\n`;
      message += `⏰ Ожидаем заказ`;

      const keyboard = {
        inline_keyboard: [
          [{ text: 'Оплатил(а) ✅', callback_data: `budget:mark_paid:${transaction.id}` }],
        ],
      };

      await botInstance.api.sendMessage(Number(transaction.fromUser.telegramId), message, {
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
        const total = (w.menuItemSnapshot.price || 0) * w.voteCount;
        message += `• ${w.menuItemName} — ${w.voteCount} чел. (${total}₽)\n`;
      });

      if (resultData.bringOwn.count > 0) {
        message += `🥪 Принесут своё — ${resultData.bringOwn.count} чел.\n`;
      }

      message += `\n💰 *Общая сумма: ${totals.totalOrder}₽*\n`;
      message += `👥 Участников: ${resultData.winners.reduce((s: number, w: any) => s + w.voteCount, 0)}\n\n`;
      message += `_Детали и реквизиты отправлены всем в личные сообщения._`;

      if (selection?.messageId && selection.chatId) {
        await botInstance.api.editMessageText(
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
      const tx = await prisma.transaction.update({
        where: { id: txId },
        data: { status: 'PAID', paidAt: new Date() },
        include: { fromUser: true, toUser: true, menuItem: true },
      });

      logger.info('Transaction marked as paid', { txId });

      // Уведомляем ответственного
      if (botInstance) {
        await botInstance.api.sendMessage(
          Number(tx.toUser.telegramId),
          `💳 *Получена оплата!*\n\n${tx.fromUser.firstName} отметил(а) оплату ${tx.amount}₽`,
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
      const tx = await prisma.transaction.update({
        where: { id: txId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
        include: { fromUser: true, toUser: true },
      });

      logger.info('Transaction confirmed', { txId });

      // Уведомляем участника
      if (botInstance) {
        await botInstance.api.sendMessage(
          Number(tx.fromUser.telegramId),
          `✅ *Оплата подтверждена!*\n\n${tx.toUser.firstName} подтвердил(а) получение ${tx.amount}₽\n\nСпасибо! 🎉`,
          { parse_mode: 'Markdown' }
        );
      }

      // Проверяем, все ли оплатили
      await this.checkAllPaid(tx.pollId, tx.toUserId);

      return tx;
    } catch (error) {
      logger.error('Error confirming payment:', error);
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
        const totalReceived = allTx.reduce((sum, tx) => sum + tx.amount, 0);

        await botInstance.api.sendMessage(
          Number(allTx[0].toUser.telegramId),
          `🎊 *Все оплатили!*\n\n` +
            `Все участники подтвердили оплату\n\n` +
            `💰 Получено: ${totalReceived}₽\n\n` +
            `*Подробности:*\n` +
            allTx.map((tx) => `✅ ${tx.fromUser.firstName} — ${tx.amount}₽`).join('\n') +
            `\n\nСпасибо за организацию! 🙏`,
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
   */
  private static maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return cardNumber;
    const lastFour = cleaned.slice(-4);
    return `**** **** **** ${lastFour}`;
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
  async getUserDebts(userId: number, status?: 'PENDING' | 'PAID' | 'CONFIRMED') {
    try {
      const where: any = { fromUserId: userId };
      if (status) {
        where.status = status;
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

      return debts;
    } catch (error) {
      logger.error('Error getting user debts:', error);
      throw error;
    }
  }

  /**
   * Получить все кредиты пользователя (кто ему должен)
   */
  async getUserCredits(userId: number, status?: 'PENDING' | 'PAID' | 'CONFIRMED') {
    try {
      const where: any = { toUserId: userId };
      if (status) {
        where.status = status;
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

      return credits;
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
      const tx = await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'PENDING', paidAt: null },
        include: { fromUser: true, toUser: true },
      });

      logger.info('Transaction mark cancelled', { transactionId });

      // Уведомляем ответственного
      if (botInstance) {
        await botInstance.api.sendMessage(
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

      const totalSpent = debts.reduce((sum, tx) => sum + tx.amount, 0);
      const totalReceived = credits.reduce((sum, tx) => sum + tx.amount, 0);
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
        acc[key].total += tx.amount;
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
}
