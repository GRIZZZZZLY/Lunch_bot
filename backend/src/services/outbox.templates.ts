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
          : {
              replyMarkup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Подтвердить ✅',
                      callback_data: `budget:confirm:${transactionId}`,
                    },
                  ],
                ],
              },
            }),
      };
    }

    default:
      return null;
  }
}
