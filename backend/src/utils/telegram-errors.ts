/**
 * Почему Telegram не доставил сообщение пользователю в личку.
 *
 * Всё, кроме `unknown`, — отказ навсегда: повтор той же отправки его не
 * исправит, пока человек сам не разблокирует бота или не начнёт с ним чат.
 * `unknown` — всё остальное, включая временные сбои (429, 5xx, сеть).
 */
export type TelegramSendErrorCode =
  | 'bot_blocked'
  | 'no_chat'
  | 'user_deactivated'
  | 'unknown';

export function classifyTelegramError(error: unknown): {
  errorCode: TelegramSendErrorCode;
  reason: string;
} {
  const e = error as { message?: string; description?: string } | null | undefined;
  const errorMessage = e?.message || e?.description || String(error);

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
