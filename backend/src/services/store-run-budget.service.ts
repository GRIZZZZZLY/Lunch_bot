import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { Prisma, Transaction, User, StoreItem } from '@prisma/client';
import { now } from '../utils/date';
import { formatCurrency, sumDecimals } from '../utils/decimal';
import { getBotInstance } from '../bot/bot-instance';
import { UserService } from './user.service';

function botInstance() {
  return getBotInstance();
}

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

function maskCardNumber(cardNumber: string): string {
  // Sprint 1: используем EncryptionService для обработки зашифрованных данных
  const { EncryptionService } = require('../utils/encryption');
  return EncryptionService.maskCardNumber(cardNumber);
}

/**
 * Долги и оплаты по магазинным забегам ("Иду в магазин").
 *
 * Отдельный домен от BudgetService (долги по обеденным голосованиям):
 * своя сущность (StoreRun/StoreItem вместо Poll), свой поток уведомлений,
 * никакого общего состояния с поллом кроме модели Transaction.
 */
export class StoreRunBudgetService {
  /**
   * Создать транзакции по завершённому магазинному забегу.
   * Одна транзакция на каждый StoreItem со статусом BOUGHT.
   * Позиции инициатора (он сам себе купил) пропускаются — долга нет.
   * Идемпотентно: если для данного storeRunId транзакции уже есть — возвращает существующие.
   */
  static async createTransactionsForStoreRun(
    storeRunId: number,
    db: Prisma.TransactionClient = prisma
  ): Promise<Transaction[]> {
    try {
      const storeRun = await db.storeRun.findUnique({
        where: { id: storeRunId },
        include: {
          items: true,
        },
      });
      if (!storeRun) {
        throw new Error(`Store run ${storeRunId} not found`);
      }

      const boughtItems = storeRun.items.filter(
        (item: StoreItem) =>
          item.status === 'BOUGHT' &&
          item.price != null &&
          item.userId !== storeRun.initiatorId
      );

      if (boughtItems.length === 0) {
        logger.info('No billable items for store run', { storeRunId });
        return [];
      }

      const data = boughtItems.map(item => {
        const amount = item.price as Prisma.Decimal;
        return {
          storeRunId,
          storeItemId: item.id,
          fromUserId: item.userId,
          toUserId: storeRun.initiatorId,
          amount,
          itemPrice: amount,
          status: 'PENDING',
        };
      });

      // skipDuplicates + уникальный индекс (storeRunId, storeItemId) делают
      // создание идемпотентным даже при конкурентном вызове (двойной клик
      // «завершить забег»). findMany после вставки гарантирует, что вернётся
      // полный набор транзакций забега независимо от того, кто их создал.
      await db.transaction.createMany({ data, skipDuplicates: true });
      const created = await db.transaction.findMany({
        where: { storeRunId },
      });

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
        logger.error('notifyStoreRunSettled: bot not initialized', {
          storeRunId,
        });
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
        logger.info('notifyStoreRunSettled: no pending transactions', {
          storeRunId,
        });
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
        await this.sendStoreRunDebtNotification(
          storeRun,
          txs,
          initiator,
          paymentInfo
        );
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
    paymentInfo: PaymentInfo | null
  ): Promise<void> {
    try {
      if (!botInstance() || txs.length === 0) return;
      const debtor = txs[0].fromUser;
      const total = sumDecimals(txs.map(t => t.amount));

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

      if (
        paymentInfo?.paymentCard ||
        paymentInfo?.paymentPhone ||
        paymentInfo?.paymentDetails
      ) {
        message += `💳 *Реквизиты:*\n`;
        if (paymentInfo.paymentCard) {
          message += `💳 Карта: ${maskCardNumber(paymentInfo.paymentCard)}\n`;
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
          [
            {
              text: 'Оплатил(а) ✅',
              callback_data: `budget:srun_paid:${storeRun.id}`,
            },
          ],
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
    byDebtor: Map<number, any[]>
  ): Promise<void> {
    try {
      if (!botInstance()) return;
      const total = sumDecimals(transactions.map(t => t.amount));

      let message = `🛍 *Забег «${storeRun.storeName}» закрыт*\n\n`;
      message += `Разослал участникам суммы и твои реквизиты.\n\n`;
      message += `💰 *Тебе вернут: ${formatCurrency(total)}*\n\n`;
      message += `*Ждём перевод:*\n`;
      for (const [, txs] of byDebtor) {
        const debtor = txs[0].fromUser;
        const sub = sumDecimals(txs.map(t => t.amount));
        message += `• ${debtor.firstName} — ${formatCurrency(sub)}\n`;
      }

      await botInstance()!.api.sendMessage(
        Number(storeRun.initiator.telegramId),
        message,
        {
          parse_mode: 'Markdown',
        }
      );
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
    debtorTelegramId: number
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

    const total = sumDecimals(txs.map(t => t.amount));
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
        }
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
    confirmerTelegramId: number
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
    const total = sumDecimals(txs.map(t => t.amount));

    if (botInstance()) {
      await botInstance()!.api.sendMessage(
        Number(debtor.telegramId),
        `✅ Оплата подтверждена!\n\n${initiator.firstName} подтвердил(а) получение ${formatCurrency(total)}\n\nСпасибо! 🎉`
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
