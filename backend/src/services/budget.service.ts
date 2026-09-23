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
import {
  OUTBOX_ENTITY_TRANSACTION,
  OutboxService,
  type PrismaTransactionClient,
} from './outbox.service';
import { OutboxWorkerService } from './outbox-worker.service';

interface PaymentInfo {
  paymentCard?: string | null;
  paymentPhone?: string | null;
  paymentDetails?: string | null;
}

type DebtWithPeople = Transaction & { fromUser: User; toUser: User };

/**
 * Упорядочить изменения долгов одного опроса.
 *
 * Решение «все оплатили» принимается внутри транзакции подтверждения. Две
 * одновременные транзакции, подтверждающие два последних долга, при READ
 * COMMITTED видят чужой долг ещё неподтверждённым — и итог не получает никто.
 * Блокировка строки опроса ставит их в очередь: вторая читает уже
 * зафиксированное состояние первой.
 *
 * Берётся ДО изменения долга, иначе две транзакции захватывали бы строки в
 * разном порядке. `FOR NO KEY UPDATE`, а не `FOR UPDATE`: второй конфликтует
 * с блокировками внешних ключей и задерживал бы, например, запись голосов.
 */
async function lockPollDebts(db: PrismaTransactionClient, pollId: number): Promise<void> {
  await db.$queryRaw`SELECT id FROM polls WHERE id = ${pollId} FOR NO KEY UPDATE`;
}

/** Сообщение о долге, присланное при расчёте заказа, — его правят, а не шлют новое. */
function debtMessageTarget(row: {
  debtMessageId: number | null;
  debtChatId: string | null;
}): { editChatId?: string; editMessageId?: number } {
  return row.debtMessageId && row.debtChatId
    ? { editChatId: row.debtChatId, editMessageId: row.debtMessageId }
    : {};
}

/** Должнику: оплата подтверждена. */
function enqueueDebtConfirmed(
  db: PrismaTransactionClient,
  row: DebtWithPeople
): Promise<number[]> {
  return OutboxService.enqueue(db, {
    entityType: OUTBOX_ENTITY_TRANSACTION,
    entityId: row.id,
    transitionVersion: row.transitionVersion,
    messageType: 'DEBT_CONFIRMED',
    recipients: [
      {
        chatId: String(row.fromUser.telegramId),
        payload: {
          payeeFirstName: row.toUser.firstName ?? '',
          amount: formatCurrency(row.amount),
          ...debtMessageTarget(row),
        },
      },
    ],
  });
}

/**
 * Сборщику: все оплатили.
 *
 * Событие привязано к долгу, чей переход закрыл список: если его
 * подтверждение отменят раньше доставки, итог устареет и не уйдёт.
 */
function enqueueAllConfirmed(
  db: PrismaTransactionClient,
  anchor: DebtWithPeople,
  debts: DebtWithPeople[],
  forced: boolean
): Promise<number[]> {
  return OutboxService.enqueue(db, {
    entityType: OUTBOX_ENTITY_TRANSACTION,
    entityId: anchor.id,
    transitionVersion: anchor.transitionVersion,
    messageType: 'DEBTS_ALL_CONFIRMED',
    recipients: [
      {
        chatId: String(anchor.toUser.telegramId),
        payload: {
          forced,
          total: formatCurrency(sumDecimals(debts.map(debt => debt.amount))),
          lines: debts.map(debt => ({
            name: debt.fromUser.firstName ?? '',
            amount: formatCurrency(debt.amount),
          })),
        },
      },
    ],
  });
}

/** Итог «все оплатили», если подтверждение закрыло последний долг сборщика. */
async function enqueueAllConfirmedIfComplete(
  db: PrismaTransactionClient,
  row: DebtWithPeople
): Promise<number[]> {
  const debts = await db.transaction.findMany({
    where: { pollId: row.pollId, toUserId: row.toUserId },
    include: { fromUser: true, toUser: true },
    orderBy: { id: 'asc' },
  });
  if (debts.some(debt => debt.status !== 'CONFIRMED')) return [];

  return enqueueAllConfirmed(db, row, debts, false);
}

export class BudgetService {
  /**
   * Отметить как оплаченное
   */
  static async markAsPaid(txId: number, actorUserId: number): Promise<DebtWithPeople> {
    try {
      /* Переход состояния и ЗАДАНИЕ на уведомление — в одной транзакции.
         Раньше уведомление жило только в памяти между записью и вызовом
         Telegram: падение процесса в этом окне теряло его без следа.
         Вызовов Telegram внутри транзакции нет — она держала бы соединение
         всё время сетевого запроса. */
      const { tx, outboxIds, transitioned } = await prisma.$transaction(
        async db => {
          const transition = await db.transaction.updateMany({
            where: {
              id: txId,
              fromUserId: actorUserId,
              status: 'PENDING',
            },
            data: {
              status: 'PAID',
              paidAt: now(),
              transitionVersion: { increment: 1 },
            },
          });
          const row = await db.transaction.findUnique({
            where: { id: txId },
            include: { fromUser: true, toUser: true, menuItem: true },
          });
          if (!row) throw new Error('Transaction not found');
          if (row.fromUserId !== actorUserId) throw new Error('Access denied');
          if (transition.count === 0) {
            if (row.status === 'PAID') {
              return { tx: row, outboxIds: [], transitioned: false };
            }
            if (row.status === 'CONFIRMED') {
              throw new Error('Cannot modify confirmed payment');
            }
            throw new Error('Transaction state changed');
          }

          const ids = await OutboxService.enqueue(db, {
            entityType: OUTBOX_ENTITY_TRANSACTION,
            entityId: txId,
            transitionVersion: row.transitionVersion,
            messageType: 'DEBT_MARKED_PAID',
            recipients: [
              {
                chatId: String(row.toUser.telegramId),
                payload: {
                  transactionId: txId,
                  debtorFirstName: row.fromUser.firstName ?? '',
                  amount: formatCurrency(row.amount),
                },
              },
            ],
          });

          return { tx: row, outboxIds: ids, transitioned: true };
        }
      );

      /* Повтор запроса: статус уже PAID, ничего не менялось — и второго
         уведомления быть не должно. */
      if (!transitioned) return tx;

      logger.info('Transaction marked as paid', { txId });
      BudgetService.emitDebtUpdated(tx);

      /* Немедленная попытка — БЕЗ ожидания. Задание уже сохранено, ответ
         клиенту не должен зависеть от времени ответа Telegram.

         Раньше здесь стоял `await`, и медленный Telegram давал ровно тот же
         ложный отказ, который закрывала изоляция сбоев: клиент обрывает
         запрос через 10 секунд (`api.service.ts`), человек видит «Request
         timeout», а отметка в базе уже стоит. Быстрый отказ был исправлен,
         медленный ответ — нет.

         Задание захватывается по id, поэтому обработчик его не продублирует,
         а при сбое или обрыве процесса — повторит сам. `deliverNow` не
         бросает, поэтому `void` здесь не прячет ошибку: она попадёт в журнал
         с категорией. */
      void OutboxWorkerService.deliverNow(outboxIds);

      return tx;
    } catch (error) {
      logger.error('Error marking as paid:', error);
      throw error;
    }
  }

  /**
   * Подтвердить оплату
   */
  static async confirmPayment(txId: number, actorUserId: number): Promise<DebtWithPeople> {
    try {
      const { tx, outboxIds, transitioned } = await prisma.$transaction(
        async db => {
          const target = await db.transaction.findUnique({
            where: { id: txId },
            select: { pollId: true },
          });
          if (!target) throw new Error('Transaction not found');
          if (target.pollId != null) await lockPollDebts(db, target.pollId);

          const transition = await db.transaction.updateMany({
            where: {
              id: txId,
              toUserId: actorUserId,
              status: 'PAID',
            },
            data: {
              status: 'CONFIRMED',
              confirmedAt: now(),
              transitionVersion: { increment: 1 },
            },
          });
          const row = await db.transaction.findUnique({
            where: { id: txId },
            include: { fromUser: true, toUser: true },
          });
          if (!row) throw new Error('Transaction not found');
          if (row.toUserId !== actorUserId) throw new Error('Access denied');
          if (transition.count === 0) {
            if (row.status === 'CONFIRMED') {
              return { tx: row, outboxIds: [], transitioned: false };
            }
            if (row.status === 'PENDING') {
              throw new Error('Cannot confirm unpaid transaction');
            }
            throw new Error('Transaction state changed');
          }

          const ids = await enqueueDebtConfirmed(db, row);
          /* «Все оплатили» решается здесь же, по состоянию внутри транзакции,
             а не отдельным шагом после уведомления должнику: сбой того
             уведомления раньше отменял и итог. Только долги опроса — у
             магазинного забега своя финализация. */
          if (row.pollId != null) {
            ids.push(...(await enqueueAllConfirmedIfComplete(db, row)));
          }

          return { tx: row, outboxIds: ids, transitioned: true };
        }
      );

      if (!transitioned) return tx;

      logger.info('Transaction confirmed', { txId });
      BudgetService.emitDebtUpdated(tx);
      void OutboxWorkerService.deliverNow(outboxIds);

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
  static async undoConfirmation(txId: number, actorUserId: number): Promise<DebtWithPeople> {
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

      const { tx, outboxIds } = await prisma.$transaction(async db => {
        /* Та же очередь, что у подтверждения: иначе одновременные «подтвердить
           последний» и «отменить другой» разошлись бы в решении, все ли
           оплатили. */
        if (existing.pollId != null) await lockPollDebts(db, existing.pollId);

        /* Тот же атомарный guard, что в confirmPayment: между проверкой и
           записью статус мог измениться (например, параллельная отмена). */
        const transition = await db.transaction.updateMany({
          where: { id: txId, toUserId: actorUserId, status: 'CONFIRMED' },
          data: {
            status: 'PAID',
            confirmedAt: null,
            transitionVersion: { increment: 1 },
          },
        });
        if (transition.count === 0) throw new Error('Transaction state changed');

        const row = await db.transaction.findUniqueOrThrow({
          where: { id: txId },
          include: { fromUser: true, toUser: true },
        });
        const ids = await OutboxService.enqueue(db, {
          entityType: OUTBOX_ENTITY_TRANSACTION,
          entityId: row.id,
          transitionVersion: row.transitionVersion,
          messageType: 'DEBT_CONFIRMATION_UNDONE',
          recipients: [
            {
              chatId: String(row.fromUser.telegramId),
              payload: {
                payeeFirstName: row.toUser.firstName ?? '',
                amount: formatCurrency(row.amount),
                ...debtMessageTarget(row),
              },
            },
          ],
        });

        return { tx: row, outboxIds: ids };
      });

      logger.info('Payment confirmation undone', { txId, actorUserId });
      BudgetService.emitDebtUpdated(tx);
      void OutboxWorkerService.deliverNow(outboxIds);

      return tx;
    } catch (error) {
      logger.error('Error undoing confirmation:', error);
      throw error;
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
      const { count, outboxIds } = await prisma.$transaction(async db => {
        await lockPollDebts(db, pollId);

        const transitioned = await db.transaction.updateManyAndReturn({
          where: {
            pollId,
            toUserId: responsibleUserId,
            status: { in: ['PENDING', 'PAID'] },
          },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now(),
            transitionVersion: { increment: 1 },
          },
          select: { id: true },
        });
        if (transitioned.length === 0) return { count: 0, outboxIds: [] };

        const debts = await db.transaction.findMany({
          where: { id: { in: transitioned.map(tx => tx.id) } },
          include: { fromUser: true, toUser: true },
          orderBy: { id: 'asc' },
        });

        /* Каждому должнику — своё задание: недоставленное одному не мешает
           остальным и не отменяет сводку сборщику. */
        const ids: number[] = [];
        for (const debt of debts) {
          ids.push(...(await enqueueDebtConfirmed(db, debt)));
        }
        ids.push(...(await enqueueAllConfirmed(db, debts[0], debts, true)));

        return { count: debts.length, outboxIds: ids };
      });

      if (count === 0) {
        logger.info('markAllPaidByResponsible: no pending transactions', {
          pollId,
        });
        return;
      }

      logger.info('All transactions confirmed by responsible', { pollId, count });
      void OutboxWorkerService.deliverNow(outboxIds);
    } catch (error) {
      logger.error('Error in markAllPaidByResponsible:', error);
      throw error;
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
      const { tx, outboxIds, transitioned } = await prisma.$transaction(
        async db => {
          const transition = await db.transaction.updateMany({
            where: {
              id: transactionId,
              fromUserId: actorUserId,
              status: 'PAID',
            },
            data: {
              status: 'PENDING',
              paidAt: null,
              confirmedAt: null,
              transitionVersion: { increment: 1 },
            },
          });
          const row = await db.transaction.findUnique({
            where: { id: transactionId },
            include: { fromUser: true, toUser: true },
          });
          if (!row) throw new Error('Transaction not found');
          if (row.fromUserId !== actorUserId) throw new Error('Access denied');
          if (transition.count === 0) {
            if (row.status === 'PENDING') {
              return { tx: row, outboxIds: [], transitioned: false };
            }
            if (row.status === 'CONFIRMED') {
              throw new Error('Cannot cancel confirmed payment');
            }
            throw new Error('Transaction state changed');
          }

          const ids = await OutboxService.enqueue(db, {
            entityType: OUTBOX_ENTITY_TRANSACTION,
            entityId: row.id,
            transitionVersion: row.transitionVersion,
            messageType: 'DEBT_MARK_CANCELLED',
            recipients: [
              {
                chatId: String(row.toUser.telegramId),
                payload: {
                  debtorFirstName: row.fromUser.firstName ?? '',
                  amount: formatCurrency(row.amount),
                },
              },
            ],
          });

          return { tx: row, outboxIds: ids, transitioned: true };
        }
      );

      if (!transitioned) return tx;

      logger.info('Transaction mark cancelled', { transactionId });
      BudgetService.emitDebtUpdated(tx);
      void OutboxWorkerService.deliverNow(outboxIds);

      return tx;
    } catch (error) {
      logger.error('Error canceling mark as paid:', error);
      throw error;
    }
  }

}
