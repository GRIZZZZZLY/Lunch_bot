/**
 * Человеческие тексты ошибок API.
 *
 * Перехватчик в `api.service` реджектит обычным объектом `{ error, code,
 * status, message? }`, а не `Error`, поэтому раньше до пользователя доходил
 * только запасной текст вида «Не удалось создать закупку» — причина терялась.
 * Сообщения бэкенда в основном английские, так что переводим их по коду;
 * русский текст с сервера (например от middleware идемпотентности) отдаём как
 * есть, а на неизвестный код показываем запасной текст вызывающего кода.
 *
 * ЭТОТ СЛОВАРЬ ПОЛНЫЙ, И ЭТО ПРОВЕРЯЕТСЯ. Раньше он покрывал 41 код из 80:
 * остальные молча падали в запасной текст, то есть пользователь видел «не
 * удалось», хотя сервер назвал причину. Теперь
 * `backend/src/__tests__/unit/api/error-codes.test.ts` сверяет ключи ниже с
 * union `ApiErrorCode` в `backend/src/api/error-codes.ts` и падает, если
 * бэкенд начал отдавать код без текста. Добавляете код на сервере — добавьте
 * строку здесь, иначе тест не пройдёт.
 */

const BY_CODE: Record<string, string> = {
  // Идемпотентность и повторные отправки
  IDEMPOTENCY_INFLIGHT: 'Запрос уже обрабатывается — подождите пару секунд.',
  IDEMPOTENCY_UNAVAILABLE: 'Сервис временно недоступен. Повторите через минуту.',
  IDEMPOTENCY_KEY_REQUIRED: 'Приложение устарело. Закройте и откройте его заново.',
  IDEMPOTENCY_KEY_INVALID: 'Приложение устарело. Закройте и откройте его заново.',

  // Голосования
  POLL_ALREADY_ACTIVE: 'В этой группе уже идёт голосование.',
  POLL_ALREADY_COMPLETED: 'Голосование уже завершено.',
  ALREADY_COMPLETED: 'Голосование уже завершено.',
  POLL_NOT_FOUND: 'Голосование не найдено — возможно, оно уже завершилось.',
  POLL_ERROR: 'С голосованием что-то не так. Обновите страницу.',
  INVALID_POLL_STATE: 'Действие недоступно на текущем этапе голосования.',
  NOT_ACTIVE: 'Голосование уже не активно.',
  NO_ACTIVE_POLL: 'В группе нет активного голосования.',
  NO_MENU_ITEMS: 'В меню нет активных блюд.',
  NO_VOTERS: 'Никто не проголосовал.',
  RESULTS_NOT_FOUND: 'Результаты пока не готовы.',
  VOTE_NOT_FOUND: 'Голос не найден — возможно, он уже снят.',
  SINGLE_SELECTION_ONLY: 'В этом голосовании можно выбрать только один вариант.',
  MAX_SELECTIONS_EXCEEDED: 'Выбрано больше вариантов, чем разрешено.',
  INVALID_MENU_ITEM_IDS: 'Часть блюд недоступна. Обновите меню.',
  INVALID_MENU_ITEM_ID: 'Это блюдо недоступно. Обновите меню.',
  VOTE_RATE_LIMIT: 'Слишком часто голосуете. Подождите немного.',
  POLL_CREATION_LIMIT: 'Слишком часто создаёте голосования. Подождите немного.',
  NOT_ENOUGH_ITEMS: 'Для голосования нужно минимум два активных блюда в меню.',
  GROUP_NOT_FOUND: 'Группа не найдена — проверьте, что бот ещё в чате.',
  INVALID_DURATION: 'Недопустимая длительность голосования.',
  BOT_NOT_AVAILABLE: 'Бот сейчас недоступен. Попробуйте через минуту.',

  // Закупки и категорийные заказы
  ACTIVE_RUN_EXISTS: 'У вас уже есть активная закупка.',
  WRONG_STATUS: 'Действие недоступно на текущем этапе закупки.',
  BOT_NOT_IN_GROUP: 'Бот не добавлен в группу — добавьте его и повторите.',
  ITEM_NOT_FOUND: 'Позиция не найдена — возможно, её уже удалили.',
  VOLUNTEER_NOT_AVAILABLE:
    'Категорию уже кто-то взял, либо вы в ней не участвуете.',
  FINALIZATION_ERROR: 'Не удалось закрыть расчёт. Проверьте суммы и повторите.',
  DUPLICATE_ENTRY: 'Такая запись уже есть.',

  // Долги
  UNDO_WINDOW_EXPIRED: 'Отменить подтверждение можно только в течение суток.',

  // Доступ
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  ACCESS_DENIED: 'Доступ запрещён: нужны права администратора группы.',
  OPERATIONS_ACCESS_DENIED: 'Служебный доступ запрещён.',
  NOT_MEMBER: 'Вы не состоите в этой группе.',
  NOT_ADMIN: 'Нужны права администратора группы.',
  USER_NOT_ACTIVE: 'Профиль отключён. Обратитесь к администратору группы.',
  UNAUTHORIZED: 'Сессия истекла. Закройте и откройте приложение заново.',
  NOT_AUTHENTICATED: 'Сессия истекла. Закройте и откройте приложение заново.',
  INVALID_TOKEN: 'Сессия истекла. Закройте и откройте приложение заново.',
  INVALID_TOKEN_TYPE: 'Сессия истекла. Закройте и откройте приложение заново.',
  TOKEN_EXPIRED: 'Сессия истекла. Закройте и откройте приложение заново.',
  MISSING_TOKEN: 'Сессия истекла. Закройте и откройте приложение заново.',
  REFRESH_TOKEN_REPLAY:
    'Вход был выполнен повторно. Закройте и откройте приложение заново.',
  INVALID_INIT_DATA: 'Telegram не подтвердил вход. Переоткройте приложение.',
  MISSING_INIT_DATA: 'Telegram не передал данные входа. Переоткройте приложение.',
  MISSING_TELEGRAM_DATA: 'Telegram не передал данные входа. Переоткройте приложение.',
  /* auth.controller отдаёт его при 500 «Server misconfiguration» — это не
     отказ по безопасности, а незаданный секрет на сервере. */
  SECURITY_VIOLATION: 'Сервер настроен неверно. Сообщите администратору.',
  AUTH_SERVICE_UNAVAILABLE: 'Вход временно недоступен. Попробуйте через минуту.',
  AUTH_RATE_LIMIT: 'Слишком много попыток входа. Подождите немного.',
  AVATAR_AUTH_REQUIRED: 'Ссылка на аватар устарела. Обновите страницу.',
  AVATAR_SIG_INVALID: 'Ссылка на аватар устарела. Обновите страницу.',

  // Данные запроса
  VALIDATION_ERROR: 'Проверьте заполненные поля.',
  /* Приходит из StoreRunError — не литералом, а через union-тип. Однажды был
     сочтён мёртвым и остался без текста; см. backend/src/api/error-codes.ts. */
  INVALID_INPUT: 'Проверьте заполненные поля.',
  INVALID_REQUEST_BODY: 'Проверьте заполненные поля.',
  MISSING_GROUP_ID: 'Не выбрана группа.',
  INVALID_GROUP_ID: 'Не выбрана группа.',
  INVALID_ID: 'Некорректный идентификатор.',
  INVALID_IDS: 'Некорректный список идентификаторов.',
  TOO_MANY_IDS: 'Слишком много элементов в запросе.',
  INVALID_POLL_ID: 'Некорректный идентификатор голосования.',
  INVALID_USER_ID: 'Некорректный идентификатор пользователя.',
  INVALID_DEBT_ID: 'Некорректный идентификатор долга.',
  INVALID_LIMIT: 'Некорректное число элементов на странице.',
  INVALID_PAGE: 'Некорректный номер страницы.',
  /* Единственный источник — поиск по меню: «минимум 2 символа». Это ошибка,
     которую пользователь может исправить сам, и текст должен это говорить. */
  INVALID_QUERY: 'Для поиска нужно минимум 2 символа.',
  INVALID_STATUS: 'Некорректный статус.',
  INVALID_PAYMENT_INFO: 'Проверьте реквизиты: карта или телефон заполнены неверно.',
  PAYLOAD_TOO_LARGE: 'Слишком большой запрос.',

  // Не найдено
  NOT_FOUND: 'Не найдено — возможно, данные уже изменились.',
  ROUTE_NOT_FOUND: 'Приложение обратилось к несуществующему адресу. Обновите страницу.',
  USER_NOT_FOUND: 'Пользователь не найден.',

  /* Коды из классов `backend/src/utils/error.ts`. Наружу выходят не литералом
     в контроллере, а через `error-handler`, который отдаёт `code` любого
     BaseError как есть — например `AUTHORIZATION_ERROR` при отказе CORS. Это
     синонимы кодов выше, и они НЕ сведены намеренно: переименование сменило бы
     контракт (см. комментарий в backend/src/api/error-codes.ts). Тексты
     совпадают с текстами канонических кодов — для пользователя разницы нет. */
  AUTHENTICATION_ERROR: 'Сессия истекла. Закройте и откройте приложение заново.',
  AUTHORIZATION_ERROR: 'Недостаточно прав для этого действия.',
  NOT_FOUND_ERROR: 'Не найдено — возможно, данные уже изменились.',
  CONFLICT_ERROR: 'Данные изменились. Обновите страницу и повторите.',
  RATE_LIMIT_ERROR: 'Слишком много запросов. Подождите немного.',
  DATABASE_ERROR: 'Ошибка на сервере. Попробуйте ещё раз.',
  BOT_ERROR: 'Бот не смог выполнить действие. Попробуйте ещё раз.',
  INSUFFICIENT_PERMISSIONS: 'Недостаточно прав для этого действия.',
  INVALID_CALLBACK_DATA: 'Кнопка устарела. Обновите сообщение в чате.',
  MENU_EMPTY: 'Меню пустое — добавьте блюда.',
  USER_ALREADY_VOTED: 'Вы уже проголосовали.',

  // Инфраструктура
  RATE_LIMIT_EXCEEDED: 'Слишком много запросов. Подождите немного.',
  REMINDER_RATE_LIMIT: 'Напоминание уже отправлено. Подождите немного.',
  CONNECTION_LIMIT: 'Слишком много открытых вкладок приложения.',
  INTERNAL_ERROR: 'Ошибка на сервере. Попробуйте ещё раз.',
  NOT_IMPLEMENTED: 'Раздел пока не готов.',
  FEATURE_DISABLED: 'Функция отключена.',
  /* Приходит не от сервера, а от перехватчика в api.service, когда запрос не
     дошёл вовсе. В union бэкенда его поэтому нет и быть не должно. */
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

/**
 * Коды, для которых текст СЕРВЕРА точнее словарного.
 *
 * Ограничители частоты присылают в `message` русскую фразу с конкретным
 * временем ожидания — «Подождите час», «Подождите 15 минут»
 * (`backend/src/api/middleware/rate-limiter.ts`). Словарная запись сказала бы
 * «подождите немного», человек повторил бы сразу и снова упёрся. Поэтому для
 * них серверный текст проверяется ПЕРВЫМ, а запись в `BY_CODE` остаётся
 * подстраховкой на случай, если `message` не пришёл.
 */
const SERVER_TEXT_WINS = new Set([
  'AUTH_RATE_LIMIT',
  'POLL_CREATION_LIMIT',
  'REMINDER_RATE_LIMIT',
  'VOTE_RATE_LIMIT',
  'RATE_LIMIT_EXCEEDED',
]);

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

  /* Для ограничителей частоты серверный текст несёт время ожидания — он точнее
     словарного, поэтому идёт первым. */
  if (code && SERVER_TEXT_WINS.has(code)) {
    for (const field of ['message', 'error'] as const) {
      const value = readString(source, field);
      if (value && CYRILLIC.test(value)) return value;
    }
  }

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
