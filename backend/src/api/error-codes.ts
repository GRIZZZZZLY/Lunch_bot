/**
 * Словарь машиночитаемых кодов ошибок API — один на весь проект.
 *
 * Зачем тип, а не соглашение. Код ошибки — это ЧАСТЬ КОНТРАКТА: фронт по нему
 * выбирает текст для пользователя (`frontend-new/src/lib/apiError.ts`). Пока
 * коды были строковыми литералами в 80 местах, происходило три вещи:
 *
 * 1. **Синонимы.** `FORBIDDEN` / `ACCESS_DENIED` / `OPERATIONS_ACCESS_DENIED`
 *    для одного события; `VALIDATION_ERROR` / `INVALID_REQUEST` /
 *    `INVALID_BODY` / `INVALID_PARAMS` / `INVALID_REQUEST_BODY` — тоже.
 * 2. **Опечатка проходила молча** — новый код просто не находил текста.
 * 3. **39 из 80 кодов фронт не знал вовсе**, и пользователь вместо причины
 *    видел запасной текст вызывающего кода. Это измерено, не предположено.
 *
 * Тип закрывает (1) и (2): новый код не скомпилируется, пока не внесён сюда.
 * Пункт (3) закрывает тест `__tests__/unit/api/error-codes.test.ts`, который
 * сверяет этот union со словарём текстов фронтенда и падает на коде без
 * сообщения.
 *
 * ЧТО НЕЛЬЗЯ МЕНЯТЬ. Коды аутентификации (`INVALID_TOKEN`, `USER_NOT_ACTIVE`,
 * `TOKEN_EXPIRED`, `MISSING_TOKEN`, `INVALID_TOKEN_TYPE`, `NOT_AUTHENTICATED`)
 * зафиксированы тестами `telegram-auth.middleware.test.ts` и на них построена
 * переавторизация на клиенте. Переименование = сломанный вход.
 */

/** Аутентификация: кто ты. */
export const AUTH_CODES = [
  'UNAUTHORIZED',
  'NOT_AUTHENTICATED',
  'INVALID_TOKEN',
  'INVALID_TOKEN_TYPE',
  'TOKEN_EXPIRED',
  'MISSING_TOKEN',
  'INVALID_INIT_DATA',
  'MISSING_INIT_DATA',
  'MISSING_TELEGRAM_DATA',
  'USER_NOT_ACTIVE',
  'REFRESH_TOKEN_REPLAY',
  'SECURITY_VIOLATION',
  'AUTH_SERVICE_UNAVAILABLE',
  'AVATAR_AUTH_REQUIRED',
  'AVATAR_SIG_INVALID',
] as const;

/** Авторизация: можно ли тебе. */
export const ACCESS_CODES = [
  'FORBIDDEN',
  'ACCESS_DENIED',
  'OPERATIONS_ACCESS_DENIED',
  'NOT_MEMBER',
  'NOT_ADMIN',
] as const;

/** Проверка входных данных. */
export const VALIDATION_CODES = [
  'VALIDATION_ERROR',
  /* Отдельно от VALIDATION_ERROR намеренно: это «тело запроса не разобралось»
     (битый JSON, оборванный запрос), а не «поле не прошло проверку». Разница
     видна пользователю — во втором случае можно назвать поле. Закреплено
     тестом error-handler.test.ts, который эта задача менять не должна. */
  'INVALID_REQUEST_BODY',
  'INVALID_ID',
  'INVALID_IDS',
  'TOO_MANY_IDS',
  'INVALID_GROUP_ID',
  'MISSING_GROUP_ID',
  'INVALID_POLL_ID',
  'INVALID_USER_ID',
  'INVALID_MENU_ITEM_ID',
  'INVALID_MENU_ITEM_IDS',
  'INVALID_DEBT_ID',
  'INVALID_LIMIT',
  'INVALID_PAGE',
  'INVALID_QUERY',
  'INVALID_STATUS',
  'INVALID_DURATION',
  'INVALID_PAYMENT_INFO',
  'PAYLOAD_TOO_LARGE',
  /* Приходит из union-типа `StoreRunError`, а не литералом в контроллере —
     `store-run.controller` пишет `code: err.code`. Ровно на этом код однажды
     сочли мёртвым и убрали у него текст на фронте, хотя клиент получал его
     как 400. Третий способ доставки кода в ответ, и его теперь тоже проверяет
     тест. */
  'INVALID_INPUT',
] as const;

/** Ресурс не найден. Раздельные коды намеренно: фронт даёт разный текст. */
export const NOT_FOUND_CODES = [
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'POLL_NOT_FOUND',
  'USER_NOT_FOUND',
  'GROUP_NOT_FOUND',
  'ITEM_NOT_FOUND',
  'VOTE_NOT_FOUND',
  'RESULTS_NOT_FOUND',
] as const;

/** Состояние домена не позволяет операцию. */
export const STATE_CODES = [
  'POLL_ALREADY_ACTIVE',
  'POLL_ALREADY_COMPLETED',
  'ALREADY_COMPLETED',
  'INVALID_POLL_STATE',
  'NOT_ACTIVE',
  'NO_ACTIVE_POLL',
  'NO_MENU_ITEMS',
  'NOT_ENOUGH_ITEMS',
  'NO_VOTERS',
  'SINGLE_SELECTION_ONLY',
  'MAX_SELECTIONS_EXCEEDED',
  'VOLUNTEER_NOT_AVAILABLE',
  'UNDO_WINDOW_EXPIRED',
  'WRONG_STATUS',
  'ACTIVE_RUN_EXISTS',
  'BOT_NOT_IN_GROUP',
  'DUPLICATE_ENTRY',
  'FINALIZATION_ERROR',
  /* Два кода расчёта по категории. `FINALIZATION_ERROR` рядом с ними остаётся
     и означает теперь только настоящий сбой закрытия расчёта: до задачи 08 им
     отвечали и на «не все заполнили позиции», и на «суммы вне диапазона», и на
     падение базы — все три как 500, потому что контроллер ловил любую ошибку
     расчёта одним `catch`. Разделение нужно фронту: у первых двух пользователь
     может что-то сделать, у третьего — нет. */
  'CALCULATION_COMPLETED',
  'CALCULATION_NOT_READY',
  'POLL_ERROR',
] as const;

/** Ограничители частоты. */
export const RATE_LIMIT_CODES = [
  'RATE_LIMIT_EXCEEDED',
  'AUTH_RATE_LIMIT',
  'VOTE_RATE_LIMIT',
  'POLL_CREATION_LIMIT',
  'REMINDER_RATE_LIMIT',
  'CONNECTION_LIMIT',
] as const;

/** Идемпотентность повторных отправок. */
export const IDEMPOTENCY_CODES = [
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_INVALID',
  'IDEMPOTENCY_INFLIGHT',
  'IDEMPOTENCY_UNAVAILABLE',
] as const;

/** Инфраструктура и служебное. */
export const INFRA_CODES = [
  'INTERNAL_ERROR',
  'NOT_IMPLEMENTED',
  'FEATURE_DISABLED',
  'BOT_NOT_AVAILABLE',
] as const;

/**
 * Коды классов ошибок из `utils/error.ts`.
 *
 * Отдельная группа, потому что попадают они сюда иначе: не литералом в
 * контроллере, а конструктором класса, унаследованного от `BaseError`. А
 * `error-handler` для любого `BaseError` отдаёт наружу его `code` как есть
 * (`error-handler.ts:91`) — то есть эти коды видит клиент, хотя `grep code:`
 * их не находит.
 *
 * Это был слепой участок словаря, и он не теоретический: `AuthorizationError`
 * бросается из `cors.ts` при отказе по Origin, то есть один из этих кодов
 * доходил до клиента уже сегодня — без текста на фронте.
 *
 * ЭТИ КОДЫ СОЗНАТЕЛЬНО НЕ СВЕДЕНЫ к каноническим, хотя часть из них —
 * синонимы (`AUTHENTICATION_ERROR`≈`UNAUTHORIZED`,
 * `AUTHORIZATION_ERROR`≈`FORBIDDEN`, `NOT_FOUND_ERROR`≈`NOT_FOUND`,
 * `RATE_LIMIT_ERROR`≈`RATE_LIMIT_EXCEEDED`). Причины две, и обе весомее
 * аккуратности словаря:
 *
 * 1. `AuthorizationError` бросается из `cors.ts`, то есть `AUTHORIZATION_ERROR`
 *    уходит клиенту УЖЕ СЕЙЧАС. Переименование — смена контракта, а задача 03
 *    прямо запрещает менять коды.
 * 2. Эти коды закреплены тестами `utils/error.test.ts` и
 *    `middleware/error-handler.test.ts`, причём второй задача велит не менять
 *    вовсе. Попытка переименования была сделана и откачена: 11 упавших тестов
 *    — это и есть тот контракт, который они охраняют.
 *
 * Поэтому пробел закрывается ТЕКСТАМИ на фронте, а не переименованием: у
 * пользователя появляется причина, а форма ответа остаётся прежней. Сведение
 * синонимов — отдельное решение, и делать его надо вместе с фронтом.
 */
export const DOMAIN_ERROR_CODES = [
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'NOT_FOUND_ERROR',
  'CONFLICT_ERROR',
  'RATE_LIMIT_ERROR',
  'DATABASE_ERROR',
  'BOT_ERROR',
  'INSUFFICIENT_PERMISSIONS',
  'INVALID_CALLBACK_DATA',
  'MENU_EMPTY',
  'USER_ALREADY_VOTED',
] as const;

export const API_ERROR_CODES = [
  ...AUTH_CODES,
  ...ACCESS_CODES,
  ...VALIDATION_CODES,
  ...NOT_FOUND_CODES,
  ...STATE_CODES,
  ...RATE_LIMIT_CODES,
  ...IDEMPOTENCY_CODES,
  ...INFRA_CODES,
  ...DOMAIN_ERROR_CODES,
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * Синонимы, которые СВЕДЕНЫ к одному коду. Ключ — снятый код, значение — тот,
 * что остался. Сведение безопасно ровно потому, что фронт давал обоим ОДИН И
 * ТОТ ЖЕ текст, то есть для пользователя ничего не изменилось.
 *
 * Таблица не мертвая документация: тест
 * `__tests__/unit/api/error-codes.test.ts` требует, чтобы ни один снятый код
 * не вернулся в `backend/src`.
 */
export const RETIRED_CODE_ALIASES: Record<string, ApiErrorCode> = {
  INVALID_REQUEST: 'VALIDATION_ERROR',
  INVALID_BODY: 'VALIDATION_ERROR',
  INVALID_PARAMS: 'VALIDATION_ERROR',
};

/** Проверка во время выполнения — для мест, где код приходит строкой. */
export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === 'string' &&
    (API_ERROR_CODES as readonly string[]).includes(value)
  );
}
