# Карта системы Rocket Lunch

Актуально на 26 июля 2026 года. Карта составлена по фактическим точкам
подключения в `backend/src/api/server.ts`, `backend/src/bot/bot.ts`,
`backend/src/index.ts` и по файлам маршрутов.

## Границы доверия

1. Telegram передаёт `initData` клиенту. Сервер самостоятельно проверяет HMAC,
   возраст данных и получает пользователя из базы.
2. Mini App обращается к `/api/*` с короткоживущим JWT. Идентификаторы из
   параметров и тела не являются доказательством принадлежности.
3. PostgreSQL — источник истины для ролей, членства, состояний и денег.
4. Redis обязателен в production для ключей идемпотентности, одноразовых
   refresh-токенов и распределённых блокировок.
5. Telegram Bot API и платёжные события считаются повторно доставляемыми и
   потенциально временно недоступными.
6. Обратный прокси завершает TLS. Приложение доверяет ровно числу прокси,
   заданному `TRUST_PROXY`.

## Состав приложения

- `frontend-new/` — единственный выпускаемый интерфейс React/Vite.
- `backend/` — Express API, бот Grammy, плановые задания и Prisma.
- PostgreSQL — пользователи, группы, членство, меню, голосования, заказы,
  долги, платежи, опыт и сезоны.
- Redis — идемпотентность, блокировки, одноразовые refresh-токены и кэш.
- SSE `GET /api/polls/:pollId/stream` — поток обновлений голосования с JWT в
  заголовке `Authorization`; токен в строке запроса не принимается.
- Prometheus — `/api/metrics`, `/api/metrics/detailed`, `/api/metrics/sse`;
  доступ только аутентифицированному глобальному администратору.

## Режимы процесса

| `PROCESS_ROLE` | HTTP API | Бот | Плановые задания |
|---|---:|---:|---:|
| `api` | да | нет | нет |
| `bot` | нет | да | да |
| `full` | да | да | да |

В режиме webhook требуется `full`, HTTPS-адрес и секрет
`X-Telegram-Bot-Api-Secret-Token`. В режиме polling сервер не удаляет ожидающие
обновления при запуске.

## Инвентаризация HTTP

Все пути ниже имеют префикс `/api`, кроме `/health*` и `/webhook`.

| Область и префикс | Маршруты |
|---|---|
| Состояние `/health` | `GET /`, `GET /ready`, `GET /live` |
| Авторизация `/auth` | `POST /validate`, `GET /me`, `GET /status`, `POST /refresh` |
| Пользователь `/user` | `GET /me`, `GET /payment-info`, `PUT /payment-info`, `GET /groups`, `GET /:userId/avatar`, `POST /avatars/batch` |
| Аватар `/avatar` | `GET /:fileId` |
| Меню `/menu` | `GET /`, `/active`, `/popular`, `/stats`, `/search`, `/:id`; `POST /`; `PUT /:id`; `PATCH /:id/toggle`, `/bulk-status`; `DELETE /:id` |
| Предложения `/suggestions` | `POST /`; `GET /`, `/stats`, `/pending-count`, `/:id`; `POST /:id/approve`, `/:id/reject`; `DELETE /:id` |
| Голосования `/polls` | `GET /`, `/active`, `/history`, `/stats`, `/user-stats/my`, `/user-stats/:userId`, `/popular-items`, `/last-completed`, `/today-completed/:groupId`, `/:id`, `/:id/results`, `/:id/votes`, `/active/:groupId`; `POST /`, `/create-from-webapp`, `/repeat/:id`, `/:id/vote`, `/:id/vote-multiple`, `/:id/roulette`; `PATCH /:id/complete`, `/:id/complete-multi`, `/:id/cancel`; `DELETE /:id/vote` |
| Голоса `/votes` | `POST /multiple`; `GET /:pollId/user`; `DELETE /:pollId/item/:menuItemId` |
| Повторения `/recurring` | `GET /:groupId`, `/:groupId/history`; `POST /`; `PATCH /:id`, `/:id/toggle`; `DELETE /:id` |
| Бюджет `/budget` | `GET /debts`, `/credits`, `/stats`, `/poll-totals/:pollId`, `/order-costs/:pollId`, `/poll-breakdown/:pollId`; `POST /mark-paid`, `/confirm-payment`, `/cancel-mark`, `/mark-all-paid`, `/send-reminder`, `/send-reminders-all` |
| Заказы по категориям | `GET /polls/:pollId/category-orders`, `/polls/:pollId/category-orders/my`, `/category-orders/:id`, `/:id/progress`, `/:id/participants`, `/:id/order-items`, `/order-items/:id/edit-history`; `POST /category-orders/:id/order-items`, `/:id/finalize`, `/:id/volunteer`; `PUT /category-orders/:id/costs`; `DELETE /order-items/:id` |
| Походы в магазин `/store-runs` | `GET /active`, `/:id`; `POST /`, `/:id/items`, `/:id/items/:itemId/price`, `/:id/start-shopping`, `/:id/settle`, `/:id/cancel`; `PATCH /:id/items/:itemId`; `DELETE /:id/items/:itemId` |
| Магазины группы `/groups` | `GET /:groupId/stores`; `PATCH /:groupId/stores/:id`; `DELETE /:groupId/stores/:id` |
| Товары пользователя `/user/item-presets` | `GET /`; `PATCH /:id`; `DELETE /:id` |
| Уведомления `/notifications` | `POST /remind-admin`; `GET /cooldown/:groupId` |
| Пожертвования `/donations` | `POST /stars` |
| Обратная связь `/feedback` | `POST /` |
| Игровая система `/gamification` | `GET /user/stats`, `/user/achievements`, `/user/quests`, `/user/xp-history`, `/leaderboard`; служебные `POST /admin/award-xp`, `/admin/recalculate-ratings` |
| Сезоны `/seasons` | `GET /`, `/current`, `/current/stats/:userId`, `/:id`, `/:id/leaderboard`, `/:id/stats/:userId`; служебные `POST /rotate`, `/create` |
| Аналитика `/insights` | `GET /budget`, `/budget/:userId`, `/categories` |
| Администрирование `/admin` | `GET /users`, `/users/:userId/stats`, `/polls/:pollId/participants`, `/debtors`, `/debt-stats`, `/cleanup/stats`, `/reminder-settings/:groupId`, `/notification-settings/:groupId`; `PUT /users/:userId/admin`, `/:userId/active`, `/:userId/participates-in-polls`, `/polls/:pollId/participants/:userId`, `/reminder-settings/:groupId`, `/notification-settings/:groupId`; `POST /debts/:debtId/forgive`, `/debts/remind-all`, `/debts/:debtId/remind`; `DELETE /cleanup/old-polls`, `/cleanup/old-transactions` |
| Диагностика `/test` | пять искусственных ошибок; подключаются только вне production |

`/api/stats` — совместимый ответ `NOT_IMPLEMENTED`, без данных. Неизвестные
`/api/*` возвращают единообразный `404 problem+json`, а не HTML приложения.

## Telegram

### Команды

- `/start` — регистрация/обновление пользователя, привязка группы и безопасные
  ссылки Mini App.
- `/help`, `/menu`, `/app` — справка и открытие Mini App.

### Callback-запросы

- `openpoll`, `optin`;
- `cancel_poll`, `run_roulette`, `complete_poll`;
- `volunteer`, `volunteer_category`;
- бюджет: `mark_paid`, `confirm`, `srun_paid`, `srun_confirm`, `all_paid`,
  `remind`;
- `recurring:disable:<id>`;
- справочные callback.

Изменяющие callback повторно получают пользователя, объект, группу и роль из
PostgreSQL. Завершение, отмена, рулетка и отключение расписания требуют роли
администратора именно группы объекта.

### События и платежи

- `my_chat_member`, `chat_member`, `message:new_chat_members` синхронизируют
  членство и активность группы.
- `pre_checkout_query` проверяет валюту, сумму и payload.
- `successful_payment` сохраняет уникальные идентификаторы Telegram и повторно
  доставленное событие не начисляет результат второй раз.
- `POST /webhook` существует только в webhook-режиме и проверяет секрет
  сравнением с постоянным временем.

## Плановые задания и блокировки

| Задание | Частота | Защита нескольких экземпляров |
|---|---|---|
| Повторяющиеся голосования | каждую минуту | PostgreSQL advisory lock и дневной ключ выполнения |
| Напоминания о долгах | ежедневно в 10:00 | Redis lock с владельцем и TTL |
| Автозакрытие походов | обычно каждую минуту | Redis lock и условные переходы состояния |
| Сверка групп Telegram | каждые 6 часов | Redis lock |

Снятие Redis-блокировки выполняется Lua-операцией «удалить, только если значение
совпадает», поэтому истёкшая блокировка нового владельца не удаляется старым
процессом.

## Основные данные и связи

- `User` ↔ `GroupMember` ↔ `Group`: активность и роль проверяются на каждой
  групповой операции.
- `Poll` принадлежит одной группе; выбранные блюда и участники проверяются
  относительно этой группы.
- `Vote` уникален в допустимой комбинации голосования, пользователя и блюда.
- `CategoryOrder`, `OrderItem`, `Transaction` и `StoreRun` переходят между
  состояниями условными обновлениями и транзакциями.
- деньги хранятся целыми минимальными единицами/Decimal по существующей модели;
  контроллеры ограничивают знак, диапазон и допустимость нуля.
- `XPHistory.idempotencyKey` уникален; `UserStats.totalXP` увеличивается атомарно.

## Найденные дубли и совместимость

- Исторически голосование имело маршруты и в `/polls/:id/vote*`, и в
  `/votes/*`. Они оставлены для совместимости, но используют один слой правил.
- `GET /polls/`, `/polls/history` также совместимы по назначению.
- Старый `/api/stats` не дублирует рабочую аналитику: он явно отвечает
  `NOT_IMPLEMENTED`.
- сервер раздаёт `frontend-new`; это единственное поддерживаемое значение
  `FRONTEND_DIR` — прежний каталог `frontend` удалён окончательно 2026-08-22
  (исходники ушли раньше, последними оставались пять неотслеживаемых `.env`),
  и деплой отвергает любое другое значение.
