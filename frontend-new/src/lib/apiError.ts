/**
 * Человеческие тексты ошибок API.
 *
 * Перехватчик в `api.service` реджектит обычным объектом `{ error, code,
 * status, message? }`, а не `Error`, поэтому раньше до пользователя доходил
 * только запасной текст вида «Не удалось создать закупку» — причина терялась.
 * Сообщения бэкенда в основном английские, так что переводим их по коду;
 * русский текст с сервера (например от middleware идемпотентности) отдаём как
 * есть, а на неизвестный код показываем запасной текст вызывающего кода.
 */

const BY_CODE: Record<string, string> = {
  // Идемпотентность и повторные отправки
  IDEMPOTENCY_INFLIGHT: 'Запрос уже обрабатывается — подождите пару секунд.',
  IDEMPOTENCY_UNAVAILABLE: 'Сервис временно недоступен. Повторите через минуту.',
  IDEMPOTENCY_KEY_REQUIRED: 'Приложение устарело. Закройте и откройте его заново.',
  IDEMPOTENCY_KEY_INVALID: 'Приложение устарело. Закройте и откройте его заново.',

  // Голосования
  POLL_ALREADY_ACTIVE: 'В этой группе уже идёт голосование.',
  POLL_NOT_FOUND: 'Голосование не найдено — возможно, оно уже завершилось.',
  POLL_ERROR: 'С голосованием что-то не так. Обновите страницу.',
  SINGLE_SELECTION_ONLY: 'В этом голосовании можно выбрать только один вариант.',
  MAX_SELECTIONS_EXCEEDED: 'Выбрано больше вариантов, чем разрешено.',
  INVALID_MENU_ITEM_IDS: 'Часть блюд недоступна. Обновите меню.',
  VOTE_RATE_LIMIT: 'Слишком часто голосуете. Подождите немного.',

  // Закупки
  ACTIVE_RUN_EXISTS: 'У вас уже есть активная закупка.',
  WRONG_STATUS: 'Действие недоступно на текущем этапе закупки.',
  BOT_NOT_IN_GROUP: 'Бот не добавлен в группу — добавьте его и повторите.',
  ITEM_NOT_FOUND: 'Позиция не найдена — возможно, её уже удалили.',

  // Доступ
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  ACCESS_DENIED: 'Доступ запрещён: нужны права администратора группы.',
  NOT_MEMBER: 'Вы не состоите в этой группе.',
  USER_NOT_ACTIVE: 'Профиль отключён. Обратитесь к администратору группы.',
  UNAUTHORIZED: 'Сессия истекла. Закройте и откройте приложение заново.',
  NOT_AUTHENTICATED: 'Сессия истекла. Закройте и откройте приложение заново.',
  INVALID_TOKEN: 'Сессия истекла. Закройте и откройте приложение заново.',
  INVALID_TOKEN_TYPE: 'Сессия истекла. Закройте и откройте приложение заново.',
  TOKEN_EXPIRED: 'Сессия истекла. Закройте и откройте приложение заново.',
  MISSING_TOKEN: 'Сессия истекла. Закройте и откройте приложение заново.',
  INVALID_INIT_DATA: 'Telegram не подтвердил вход. Переоткройте приложение.',
  MISSING_TELEGRAM_DATA: 'Telegram не передал данные входа. Переоткройте приложение.',

  // Данные запроса
  VALIDATION_ERROR: 'Проверьте заполненные поля.',
  INVALID_INPUT: 'Проверьте заполненные поля.',
  INVALID_REQUEST: 'Проверьте заполненные поля.',
  INVALID_REQUEST_BODY: 'Проверьте заполненные поля.',
  INVALID_BODY: 'Проверьте заполненные поля.',
  INVALID_PARAMS: 'Проверьте заполненные поля.',
  MISSING_GROUP_ID: 'Не выбрана группа.',
  INVALID_GROUP_ID: 'Не выбрана группа.',
  PAYLOAD_TOO_LARGE: 'Слишком большой запрос.',

  // Инфраструктура
  NOT_FOUND: 'Не найдено — возможно, данные уже изменились.',
  RATE_LIMIT_EXCEEDED: 'Слишком много запросов. Подождите немного.',
  CONNECTION_LIMIT: 'Слишком много открытых вкладок приложения.',
  INTERNAL_ERROR: 'Ошибка на сервере. Попробуйте ещё раз.',
  NETWORK_ERROR: 'Нет связи с сервером. Проверьте интернет.',
};

const BY_STATUS: Record<number, string> = {
  401: BY_CODE.UNAUTHORIZED,
  403: BY_CODE.FORBIDDEN,
  404: BY_CODE.NOT_FOUND,
  409: BY_CODE.IDEMPOTENCY_INFLIGHT,
  413: BY_CODE.PAYLOAD_TOO_LARGE,
  429: BY_CODE.RATE_LIMIT_EXCEEDED,
  500: BY_CODE.INTERNAL_ERROR,
  502: BY_CODE.INTERNAL_ERROR,
  503: BY_CODE.IDEMPOTENCY_UNAVAILABLE,
  504: BY_CODE.INTERNAL_ERROR,
};

const CYRILLIC = /[А-Яа-яЁё]/;

function readString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/** Достаёт понятную причину из ответа API; `fallback` — на совсем неизвестный случай. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (!err || typeof err !== 'object') return fallback;

  // Голый axios-error (если он проскочил мимо перехватчика) прячет тело в response.data.
  const raw = err as Record<string, unknown>;
  const body = (raw.response as { data?: unknown } | undefined)?.data;
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : raw;

  const code = readString(source, 'code');
  if (code && BY_CODE[code]) return BY_CODE[code];

  // Русский текст с сервера информативнее общей формулировки по статусу.
  for (const field of ['message', 'error'] as const) {
    const value = readString(source, field);
    if (value && CYRILLIC.test(value)) return value;
  }

  const status = source.status;
  if (typeof status === 'number' && BY_STATUS[status]) return BY_STATUS[status];

  return fallback;
}
