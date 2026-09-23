/**
 * Текст сообщений очереди уведомлений — данные, а не код.
 *
 * По образцу `notification.templates.ts`: экранирование подставляемых данных
 * живёт ЗДЕСЬ, в шаблоне, а не в транспорте. Транспорт не знает, где в строке
 * разметка, а где данные, и применить `escapeMarkdown` ко всей строке нельзя —
 * сам `*жирный*` шаблона перестал бы быть разметкой.
 *
 * Текст собирается в момент ОТПРАВКИ, из данных, сохранённых в момент
 * события. Имя человека могло измениться за время, пока задание лежало в
 * очереди, но событие описывает то, что произошло тогда, — подставлять
 * сегодняшнее имя значило бы переписывать историю.
 */
import type { InlineKeyboardMarkup } from 'grammy/types';

import { escapeMarkdown } from '../utils/telegram-html';
import type { OutboxMessageType } from './outbox.service';

/** Готовое к отправке сообщение. */
export interface RenderedOutboxMessage {
  text: string;
  parseMode?: 'Markdown';
  replyMarkup?: InlineKeyboardMarkup;
  /**
   * Сообщение, которое нужно ПЕРЕПИСАТЬ этим текстом, — обычно сообщение о
   * долге, присланное при расчёте заказа. `alsoSend: false` — правка вместо
   * нового сообщения, новое уходит, только если правка не удалась.
   * `alsoSend: true` — правка устаревшего текста И новое сообщение: человеку
   * нужно заметить событие, а не найти его в старой переписке.
   */
  edit?: { chatId: string; messageId: number; alsoSend: boolean };
}

/**
 * Данные события. Хранятся в `OutboxEvent.payload`, поэтому читаются как
 * `unknown`: в очереди могут лежать задания, поставленные ПРЕЖНЕЙ версией
 * кода, и падать на них нельзя.
 */
function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Цель правки из payload, если событие её несёт. */
function editTarget(
  payload: Record<string, unknown>,
  alsoSend: boolean
): RenderedOutboxMessage['edit'] {
  const chatId = str(payload, 'editChatId');
  const messageId = num(payload, 'editMessageId');
  return chatId && messageId !== null ? { chatId, messageId, alsoSend } : undefined;
}

/** Кнопка подтверждения. Права и статус сервер проверяет заново при нажатии. */
function confirmButton(callbackData: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: 'Подтвердить ✅', callback_data: callbackData }]] };
}

/** Строки «✅ Имя — сумма» для итога «Все оплатили». */
function paidLines(payload: Record<string, unknown>): string {
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return lines
    .map(line => {
      const row = line && typeof line === 'object' ? (line as Record<string, unknown>) : {};
      return `✅ ${escapeMarkdown(str(row, 'name'))} — ${escapeMarkdown(str(row, 'amount'))}`;
    })
    .join('\n');
}

/**
 * Собрать сообщение по типу события.
 *
 * `null` — тип неизвестен этой версии кода. Такое задание не отправляется и
 * не считается ошибкой доставки: это откат кода, а не сбой Telegram.
 */
export function renderOutboxMessage(
  messageType: string,
  rawPayload: unknown
): RenderedOutboxMessage | null {
  const payload: Record<string, unknown> =
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {};

  switch (messageType as OutboxMessageType) {
    case 'DEBT_MARKED_PAID': {
      const transactionId = num(payload, 'transactionId');
      return {
        text:
          `💳 *Получена оплата!*\n\n` +
          `${escapeMarkdown(str(payload, 'debtorFirstName'))} отметил(а) оплату ` +
          `${escapeMarkdown(str(payload, 'amount'))}`,
        parseMode: 'Markdown',
        /* Кнопка ведёт к подтверждению. Права и текущий статус долга сервер
           проверяет заново при нажатии: сообщение могло пролежать в чате
           долго, и его кнопка доказательством ничего не является. */
        ...(transactionId === null
          ? {}
          : { replyMarkup: confirmButton(`budget:confirm:${transactionId}`) }),
      };
    }

    case 'STORE_RUN_MARKED_PAID': {
      const storeRunId = num(payload, 'storeRunId');
      const debtorId = num(payload, 'debtorId');
      return {
        text:
          `💳 *Получена оплата по магазину!*\n\n` +
          `${escapeMarkdown(str(payload, 'debtorFirstName'))} отметил(а) оплату ` +
          `${escapeMarkdown(str(payload, 'amount'))}`,
        parseMode: 'Markdown',
        ...(storeRunId === null || debtorId === null
          ? {}
          : { replyMarkup: confirmButton(`budget:srun_confirm:${storeRunId}:${debtorId}`) }),
      };
    }

    case 'DEBT_MARK_CANCELLED':
      return {
        text:
          `⚠️ *Отменена отметка оплаты*\n\n` +
          `${escapeMarkdown(str(payload, 'debtorFirstName'))} отменил(а) отметку оплаты ` +
          `${escapeMarkdown(str(payload, 'amount'))}`,
        parseMode: 'Markdown',
      };

    /* Без разметки, как и прежде: имя подставляется как есть. */
    case 'DEBT_CONFIRMED':
      return {
        text:
          `✅ Оплата подтверждена!\n\n` +
          `${str(payload, 'payeeFirstName')} подтвердил(а) получение ${str(payload, 'amount')}\n\n` +
          `Спасибо! 🎉`,
        edit: editTarget(payload, false),
      };

    /* Старое «оплата подтверждена» переписывается, и должник получает новое
       сообщение: ему уже сказали, что долг закрыт, и молча вернуть долг было
       бы хуже самой ошибки. */
    case 'DEBT_CONFIRMATION_UNDONE':
      return {
        text:
          `↩️ Подтверждение оплаты отменено\n\n` +
          `${str(payload, 'payeeFirstName')} отменил(а) подтверждение ${str(payload, 'amount')}. ` +
          `Долг снова ждёт подтверждения — свяжитесь, если это ошибка.`,
        edit: editTarget(payload, true),
      };

    case 'DEBTS_ALL_CONFIRMED': {
      const forced = payload.forced === true;
      const total = escapeMarkdown(str(payload, 'total'));
      return {
        text: forced
          ? `🎊 *Все оплатили!*\n\nТы подтвердил оплату от всех участников\n\n` +
            `💰 Итого получено: ${total}\n\n*Детали:*\n${paidLines(payload)}\n\n` +
            `Спасибо за организацию! 🙏`
          : `🎊 *Все оплатили!*\n\nВсе участники подтвердили оплату\n\n` +
            `💰 Получено: ${total}\n\n*Подробности:*\n${paidLines(payload)}\n\n` +
            `Спасибо за организацию! 🙏`,
        parseMode: 'Markdown',
      };
    }

    default:
      return null;
  }
}
