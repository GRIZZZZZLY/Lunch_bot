/**
 * Действия ПОСЛЕ фиксации доменной операции.
 *
 * Отметка оплаты, подтверждение и их отмены пишут статус в PostgreSQL, а уже
 * потом сообщают об этом в Telegram. Раньше сбой отправки пробрасывался
 * наверх, и клиент получал ошибку на операции, которая на самом деле уже
 * сохранена: интерфейс откатывал оптимистическое изменение, а после
 * перезагрузки показывал новый статус. Повтор запроса видел сохранённый
 * статус и завершался успехом, не отправив уведомление повторно.
 *
 * Поэтому доставка отделена от самой операции: `runAfterCommit` никогда не
 * бросает, а возвращает признак доставки. Утверждать «участник уведомлён»
 * можно только по `true`.
 *
 * Границы: сюда заворачивается ТОЛЬКО то, что происходит после успешной
 * записи. Ошибки валидации, доступа и записи в БД должны идти наружу как
 * прежде — их клиенту знать обязательно.
 */
import { logger } from './logger';

/**
 * `permanent` — повтор той же отправки тому же адресату не поможет
 * (бот заблокирован, чата нет). `transient` — поможет: Telegram недоступен,
 * лимит, сеть.
 */
export type DeliveryErrorCategory =
  | 'blocked_by_recipient'
  | 'bad_request'
  | 'rate_limited'
  | 'telegram_unavailable'
  | 'network'
  | 'unknown';

export interface DeliveryFailure {
  category: DeliveryErrorCategory;
  /** Постоянная ошибка адресата: повторять бессмысленно. */
  permanent: boolean;
  /** `error_code` Telegram, если он есть. */
  errorCode?: number;
  /** `parameters.retry_after` Telegram, в секундах. */
  retryAfterSeconds?: number;
  /** Код сетевой ошибки Node (`ECONNRESET` и подобные). */
  networkCode?: string;
}

/**
 * Только код вида `ECONNRESET`. Ограничение формой, а не доверием: в
 * `message` сетевой ошибки может лежать URL запроса, а в нём — токен бота.
 * В журнал уходит лишь то, что этой форме соответствует.
 */
const SAFE_NETWORK_CODE = /^[A-Z][A-Z0-9_]{2,31}$/;

interface TelegramErrorShape {
  error_code?: unknown;
  parameters?: { retry_after?: unknown } | null;
  code?: unknown;
  name?: unknown;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Разобрать ошибку доставки на безопасную для журнала диагностику.
 *
 * Ни `message`, ни `description`, ни стек сюда не попадают: их содержимое
 * приходит извне, а `description` к тому же вырезается фильтром логгера.
 */
export function classifyDeliveryError(error: unknown): DeliveryFailure {
  const shape = (error ?? {}) as TelegramErrorShape;
  const errorCode = asNumber(shape.error_code);
  const retryAfterSeconds = asNumber(shape.parameters?.retry_after);

  const rawNetworkCode = typeof shape.code === 'string' ? shape.code : undefined;
  const networkCode =
    rawNetworkCode && SAFE_NETWORK_CODE.test(rawNetworkCode)
      ? rawNetworkCode
      : undefined;

  if (errorCode === 403) {
    return { category: 'blocked_by_recipient', permanent: true, errorCode };
  }
  if (errorCode === 400) {
    return { category: 'bad_request', permanent: true, errorCode };
  }
  if (errorCode === 429) {
    return {
      category: 'rate_limited',
      permanent: false,
      errorCode,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    };
  }
  if (errorCode !== undefined && errorCode >= 500) {
    return { category: 'telegram_unavailable', permanent: false, errorCode };
  }
  if (networkCode) {
    return { category: 'network', permanent: false, networkCode };
  }
  return {
    category: 'unknown',
    permanent: false,
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

/**
 * Выполнить действие после фиксации операции и никогда не бросить.
 *
 * @param action Постоянная метка места в коде. В журнал идёт как есть,
 *   поэтому внешний текст сюда передавать нельзя.
 * @param meta Идентификаторы операции для журнала (`txId`, `pollId`, ...).
 * @returns `true`, если действие выполнено; `false`, если сорвалось.
 */
export async function runAfterCommit(
  action: string,
  meta: Record<string, unknown>,
  run: () => Promise<unknown>
): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    const failure = classifyDeliveryError(error);
    const message = `Post-commit action failed: ${action}`;
    const details = { ...meta, ...failure };
    /* Постоянный отказ адресата — ожидаемая часть жизни бота (человек его
       заблокировал), это warn. Недоступность Telegram, лимит и сеть значат,
       что уведомление потеряно из-за инфраструктуры, — это error. */
    if (failure.permanent) {
      logger.warn(message, details);
    } else {
      logger.error(message, details);
    }
    return false;
  }
}
