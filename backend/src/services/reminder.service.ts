import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { now } from '../utils/date';
import { toNumber } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';
import { Prisma } from '@prisma/client';
import { UserService, type PaymentInfo } from './user.service';
import { isPaymentLink, paymentCardLine, paymentLinkButton } from '../utils/payment-link';

/**
 * Транзакция со связями, нужными для рассылки напоминаний.
 *
 * У получателя платежа берётся только имя. Платёжные поля в базе зашифрованы,
 * и пока `toUser: true` тянул их сюда целиком, напоминание подставляло в текст
 * шифротекст — должник видел байты вместо реквизитов. Узкий `select` делает
 * эту ошибку невозможной структурно: расшифрованные значения приходят из
 * `UserService.getPaymentInfo`, и одноимённых полей-двойников рядом нет.
 */
type ReminderTransaction = Prisma.TransactionGetPayload<{
  include: {
    fromUser: true;
    toUser: { select: { id: true; firstName: true } };
    poll: { include: { group: true } };
  };
}>;

const reminderInclude = {
  fromUser: true,
  toUser: { select: { id: true, firstName: true } },
  poll: { include: { group: true } },
} satisfies Prisma.TransactionInclude;

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

/**
 * Классифицировать ошибку Telegram API
 */
function classifyTelegramError(error: any): {
  errorCode: SendReminderResult['errorCode'];
  reason: string;
} {
  const errorMessage = error?.message || error?.description || String(error);

  if (errorMessage.includes('bot was blocked by the user')) {
    return {
      errorCode: 'bot_blocked',
      reason: 'Пользователь заблокировал бота',
    };
  }

  if (
    errorMessage.includes("bot can't initiate conversation") ||
    errorMessage.includes('chat not found')
  ) {
    return {
      errorCode: 'no_chat',
      reason: 'Пользователь не начал чат с ботом',
    };
  }

  if (errorMessage.includes('user is deactivated')) {
    return {
      errorCode: 'user_deactivated',
      reason: 'Аккаунт пользователя деактивирован',
    };
  }

  return { errorCode: 'unknown', reason: 'Неизвестная ошибка отправки' };
}

/**
 * Manual payment reminders: one debtor, or every PENDING debtor of a poll.
 *
 * Split out of BudgetService (a god class covering payment state, poll
 * creation, order costs, and this) — self-contained Telegram delivery +
 * paymentReminder bookkeeping with no dependency on the payment state
 * machine beyond reading Transaction rows.
 */
export class ReminderService {
  /**
   * Доставка одного напоминания: валидация + текст + отправка в Telegram.
   * Не пишет в БД — запись/счётчик делает вызывающий (поштучно или пачкой).
   */
  private async deliverReminder(
    transaction: ReminderTransaction,
    requestingUserId: number,
    paymentInfo: PaymentInfo | null
  ): Promise<
    | { ok: true; message: string }
    | { ok: false; error: string; errorCode: SendReminderResult['errorCode'] }
  > {
    // Проверяем, что запрашивающий - это получатель платежа
    if (transaction.toUserId !== requestingUserId) {
      return {
        ok: false,
        error: 'Only creditor can send reminders',
        errorCode: 'unknown',
      };
    }

    // Один вызов, один const: между проверкой и отправкой бот может быть
    // снят (рестарт/тир-даун), поэтому повторный getBotInstance() запрещён.
    const bot = getBotInstance();
    if (!bot) {
      logger.error('Bot instance not initialized');
      return { ok: false, error: 'Bot not available', errorCode: 'unknown' };
    }

    // Формируем сообщение
    const amount = toNumber(transaction.amount).toFixed(2);
    const creditorName = transaction.toUser.firstName;
    const groupName = transaction.poll?.group?.title || 'группа';

    const paymentCard = paymentInfo?.paymentCard ?? null;

    /* Реквизиты выводятся через paymentCardLine: поле paymentCard давно
       содержит ссылку СБП, а подпись «Карта» под ней и врёт, и не помогает —
       перевести можно только кнопкой. Legacy-номер там же маскируется. */
    const message = `
💰 Напоминание об оплате

Привет! ${creditorName} напоминает о платеже:
💸 Сумма: ${amount}₽
📍 Заказ в ${groupName}

${paymentInfo?.paymentPhone ? `📱 СБП: ${paymentInfo.paymentPhone}` : ''}
${paymentCard ? paymentCardLine(paymentCard) : ''}

Отметь оплату в Mini App после перевода 👍
      `.trim();

    /* Кнопка появляется только у ссылки: пустой inline_keyboard Telegram не
       принимает, а других кнопок в напоминании нет. */
    const replyMarkup =
      paymentCard && isPaymentLink(paymentCard)
        ? { inline_keyboard: [[paymentLinkButton(paymentCard)]] }
        : null;

    // Отправляем уведомление
    try {
      await bot.api.sendMessage(
        Number(transaction.fromUser.telegramId),
        message,
        ...(replyMarkup ? ([{ reply_markup: replyMarkup }] as const) : [])
      );
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
  async sendReminder(
    transactionId: number,
    requestingUserId: number
  ): Promise<SendReminderResult> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: reminderInclude,
      });

      if (!transaction) {
        return {
          success: false,
          error: 'Transaction not found',
          errorCode: 'unknown',
        };
      }

      /* Реквизиты запрашиваются по вызывающему, а не по transaction.toUserId:
         совпадение этих двух id проверяет deliverReminder, и брать id из
         запроса значит не иметь возможности отдать чужие реквизиты вообще. */
      const paymentInfo = await UserService.getPaymentInfo(requestingUserId);

      const result = await this.deliverReminder(
        transaction,
        requestingUserId,
        paymentInfo
      );

      if (!result.ok) {
        return {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
        };
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

      logger.info('Reminder sent successfully', {
        transactionId,
        fromUserId: transaction.fromUserId,
      });
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
  async sendRemindersToAll(
    pollId: number,
    requestingUserId: number
  ): Promise<SendRemindersResult> {
    try {
      // Получаем все pending транзакции для этого poll (со всеми связями для рассылки)
      const transactions = await prisma.transaction.findMany({
        where: {
          pollId,
          toUserId: requestingUserId,
          status: 'PENDING',
        },
        include: reminderInclude,
      });

      /* Один запрос на всю рассылку: по `where` выше получатель платежа у всех
         транзакций один и тот же. Внутри цикла это был бы запрос на должника. */
      const paymentInfo = await UserService.getPaymentInfo(requestingUserId);

      const totalCount = transactions.length;
      let sentCount = 0;
      const failedUsers: FailedUser[] = [];
      const sentReminders: { transactionId: number; message: string }[] = [];

      for (const transaction of transactions) {
        const result = await this.deliverReminder(
          transaction,
          requestingUserId,
          paymentInfo
        );

        if (result.ok) {
          sentCount++;
          sentReminders.push({
            transactionId: transaction.id,
            message: result.message,
          });
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

  /**
   * Отправить напоминания всем PENDING должникам (кнопка "Напомнить должникам")
   * Статический враппер над instance-методом sendRemindersToAll
   */
  static async remindAllDebtors(
    pollId: number,
    responsibleUserId: number
  ): Promise<string> {
    try {
      const instance = new ReminderService();
      const result = await instance.sendRemindersToAll(
        pollId,
        responsibleUserId
      );

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
}
