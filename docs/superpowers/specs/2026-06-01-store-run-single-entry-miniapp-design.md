# Store Run — единый путь заполнения заказа (Mini App)

**Дата:** 2026-06-01
**Ветка:** main
**Статус:** дизайн утверждён, готов к плану

## Проблема

Групповое сообщение «🛒 Иду в магазин» содержит кнопку «Заказать», которая через
`t.me/<bot>?start=storerun_<id>` ведёт в **личку бота** (промежуточный шаг), а не
открывает Mini App для заполнения заказа сразу.

Параллельно существует второй путь ввода — текстом в ЛС бота («Кола, Сникерс»
через запятую), который парсится и пишется в БД. Два способа ввода = дублирование
поверхности и неоднозначный UX.

## Решение

**Один способ заполнения заказа участником — Mini App.** Групповая кнопка
открывает Mini App напрямую (Telegram Direct Link). Текстовый ввод в ЛС
удаляется полностью.

Обоснование выбора (зафиксировано с пользователем): один источник правды,
структурированный ввод (количество, заметки, удаление/редактирование позиций),
предсказуемый UX. Сознательно жертвуем «быстрым вводом не открывая аппу».

## Ключевой факт инфраструктуры (уже готово, менять не нужно)

- `frontend/src/App.tsx` уже маршрутит `initDataUnsafe.start_param`,
  начинающийся с `storerun_`, в `/store-run/:id` (Direct Link Mini App).
- `backend/src/api/controllers/auth.controller.ts:resolveGroupIdFromStartParam`
  уже резолвит префикс `storerun_` → авто-добавляет пользователя в группу при
  запуске Mini App по ссылке.
- `backend/src/bot/keyboards/webapp.keyboard.ts:createDirectLinkMiniAppUrl(startParam)`
  строит `https://t.me/<BOT_USERNAME>/<shortName>?startapp=<startParam>`.
- `ParticipantView` (Mini App) читает `run.items` — структурированный список
  «Мой заказ» с формой добавления (название + количество + заметка) и удалением.

То есть весь приёмный конец Direct Link уже соединён; правится только источник
кнопки и удаляется текстовый путь.

## Изменения

### Backend

1. **Групповая кнопка → Mini App напрямую.**
   Файл: `backend/src/services/notification.service.ts`, метод `postStoreRunToGroup`.
   Заменить URL кнопки с `https://t.me/${botUsername}?start=storerun_${id}` на
   `createDirectLinkMiniAppUrl(\`storerun_${storeRunId}\`)`.
   Импортировать `createDirectLinkMiniAppUrl` из
   `../bot/keyboards/webapp.keyboard`. Локальную переменную `botUsername` в этом
   методе удалить (станет неиспользуемой).

2. **DM-рассылка — убрать инструкцию про текст.**
   Файл: `backend/src/services/notification.service.ts`, метод
   `notifyGroupMembersAboutStoreRun`. Удалить строку
   «*Или просто ответь мне сообщением: что взять, через запятую.*» из `message`.
   Кнопку web_app «📱 Заполнить заказ» оставить (web_app работает в личных чатах).

3. **Удалить текстовый стек ввода.**
   - Удалить файл `backend/src/bot/handlers/store-run.handlers.ts` целиком
     (`handleStoreRunTextMessage`, `handleStoreRunAddToCallback`, pending-кэш,
     `addParsedItemsToRun`, `pluralize`, `setInterval` очистки кэша).
   - `backend/src/bot/bot.ts`: удалить динамический импорт + вызов
     `handleStoreRunTextMessage` в обработчике текстовых сообщений (≈ строки
     182-183 и окружающий блок, если он становится пустым) и блок callback
     `storerun_addto:` (≈ строки 247-257).
   - `backend/src/services/store-run.service.ts`: удалить осиротевшие
     `findCollectingRunsForParticipant`, `parseTextOrder`, тип `ParsedOrderLine`
     и более не используемые константы (`PARSE_MAX_POSITIONS` — проверить, что не
     используется в других методах; `ACTIVE_STATUSES` оставить — нужен другим
     методам).

4. **`/start storerun_<id>`** в `backend/src/bot/commands/start.ts` — **оставить
   без изменений**. Безвредный fallback, тоже открывает Mini App; существовал до
   текущих работ.

### Frontend

Изменений нет.

## Сквозной поток (после изменений)

```
Группа: «🛒 X идёт в «КБ»»  [🛒 Заказать]
   │  (url = t.me/<bot>/<app>?startapp=storerun_<id>)
   ▼
Mini App запускается, start_param = storerun_<id>
   │  POST /api/auth/validate → auth.controller авто-добавляет в группу
   │  App.tsx: navigate(/store-run/<id>)
   ▼
StoreRunPage → ParticipantView: форма «Мой заказ» (название/кол-во/заметка)
   │  addItems → POST /api/store-runs/:id/items → StoreItem в БД
   ▼
Инициатор завершает забег (settle) → долговые DM (уже реализовано)
```

DM-рассылка участникам (office-сотрудники, `participatesInPolls=true`) остаётся
как персональный пинок с той же web_app кнопкой.

## Edge cases

- **Нет BOT_USERNAME / shortName в env.** `createDirectLinkMiniAppUrl` использует
  `process.env.BOT_USERNAME` (fallback `rocket_lunch_bot`) и
  `botConfig.miniApp.shortName`. Уже используется групповым welcome-сообщением →
  в проде присутствует.
- **Пользователь пишет боту текст.** После удаления хендлера текст не
  потребляется store-run логикой — бот его игнорирует (как и любой другой
  свободный текст). Поведение намеренное.
- **Старые ссылки `?start=storerun_`.** Продолжают работать через handler в
  start.ts (открывают Mini App кнопкой).

## Верификация

- `cd backend && npx tsc --noEmit` → EXIT 0 (после удаления методов нет
  висячих ссылок/импортов).
- Тестов на удаляемые методы нет (проверено grep'ом: `parseTextOrder`,
  `findCollectingRunsForParticipant`, `handleStoreRunTextMessage` встречаются
  только в самих удаляемых файлах + bot.ts).
- Ручная проверка в проде: групповая кнопка открывает Mini App сразу на забеге;
  заполнение заказа через форму; набор текста боту не создаёт позиций.

## Вне scope

- Редизайн стратегии уведомлений (групповой пост + DM одновременно) — оставляем
  как есть.
- Жёсткий блок добавления позиций для `participatesInPolls=false` на уровне
  `addItemsBulk` — отдельное решение, здесь не трогаем.
