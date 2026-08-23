/**
 * Отказы HTTP-слоя как типы — то, что контроллер решает сам.
 *
 * Доменные сбои живут в `services/*.errors.ts`; здесь то, что не является
 * сбоем сервиса: нет аутентификации, нет прав на группу, ресурс не найден,
 * функция выключена флагом. Раньше каждый такой случай был блоком
 * `res.status(...).json({ success: false, error, code })` — по 5–7 строк в
 * handler'е, и статус с кодом выбирались на месте, то есть расходились
 * (`FORBIDDEN` против `ACCESS_DENIED` за одно и то же).
 *
 * Ответ формирует `error-handler`, поэтому статус и код объявлены ОДИН раз —
 * здесь. Коды взяты из `api/error-codes.ts`, у каждого уже есть текст на фронте.
 */
import { BaseError } from '../utils/error';
import type { ApiErrorCode } from './error-codes';

/**
 * Ошибка с произвольным статусом, кодом и дополнительными полями ответа.
 *
 * `extensions` нужны не «на будущее»: `GET /api/polls/active/:groupId` отдаёт
 * при отсутствии голосования `data: null` рядом с кодом, и фронт это читает.
 * Без сквозной передачи полей перевод handler'а на `next(err)` тихо убрал бы
 * `data` из тела.
 */
export class HttpError extends BaseError {
  public readonly extensions?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: ApiErrorCode,
    extensions?: Record<string, unknown>,
  ) {
    super(message, statusCode, code);
    this.extensions = extensions;
  }
}

/** Нет аутентификации. Код прежний: на него опирается переавторизация фронта. */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** Аутентификация есть, прав на эту группу нет. */
export class AccessDeniedError extends HttpError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** Функция выключена флагом — это не ошибка запроса, а состояние сервера. */
export class FeatureDisabledError extends HttpError {
  constructor(message: string) {
    super(message, 503, 'FEATURE_DISABLED');
  }
}

/**
 * Подменить код ошибки на исторический для КОНКРЕТНОГО эндпоинта.
 *
 * Зачем это вообще нужно. Одна и та же ситуация у разных эндпоинтов названа
 * разными кодами: `PATCH /polls/:id/complete` отдаёт `POLL_NOT_FOUND`, а
 * `PATCH /polls/:id/complete-multi` — `NOT_FOUND`, и у обоих кодов на фронте
 * СВОЙ текст для пользователя. Когда статус выбирал контроллер по тексту
 * сообщения, расхождение было незаметно; после типизации сервисных ошибок код
 * стал один — то есть переход сменил бы текст, который читает человек.
 *
 * Свести синонимы надо, но вместе с фронтом и отдельным решением (задача 03),
 * а не побочным эффектом рефакторинга. До тех пор код переводится обратно —
 * ровно в одном месте и с этой ссылкой, чтобы таблица не расползлась.
 */
export function withLegacyCode(
  error: unknown,
  codes: Partial<Record<ApiErrorCode, ApiErrorCode>>,
): unknown {
  if (!(error instanceof BaseError)) return error;

  const legacy = codes[error.code as ApiErrorCode];
  if (!legacy) return error;

  return new HttpError(error.message, error.statusCode, legacy);
}
