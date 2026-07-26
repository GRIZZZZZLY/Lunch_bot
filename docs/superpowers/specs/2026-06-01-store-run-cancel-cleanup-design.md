# Store Run — очистка сообщений при отмене

**Дата:** 2026-06-01
**Статус:** design approved, ожидает плана реализации
**Ветка:** `main`

## Проблема

При отмене забега (`cancel`, доступна только в статусе `COLLECTING`) сейчас
ничего не происходит с разосланными сообщениями:

- Групповой пост «🛒 <Имя> идёт в «<магазин>» … сбор заказов до <время>»
  остаётся висеть в чате с живой кнопкой «🛒 Заказать».
- Личные приглашения у участников («📱 Заполнить заказ») остаются с кнопкой,
  ведущей в отменённый забег.

Причина: `StoreRunController.cancel` → `StoreRunService.cancelStoreRun` только
проставляет `status = CANCELLED`. `message_id` разосланных сообщений **нигде не
сохраняется** — в модели `StoreRun` нет соответствующих полей, поэтому удалить
их нечем.

## Решение (подтверждено пользователем)

При отмене забега удалять **оба** типа сообщений: групповой пост И личные
приглашения у всех, кому они пришли. Для этого начать сохранять их `message_id`
при отправке.

Прецедент хранения id рассылки: `CategoryOrder.participantMessages` (JSON
`{userId: {messageId, chatId}}`).

## Дизайн

### 1. Схема (`StoreRun`) — нужна миграция

Добавить два поля:

```prisma
groupMessageId Int?    @map("group_message_id")  // id группового поста
dmMessages     String? @map("dm_messages")       // JSON: [{ chatId, messageId }]
```

`dmMessages` — JSON-массив объектов `{ chatId: number, messageId: number }` по
успешно доставленным личным приглашениям.

Миграцию сгенерировать через `prisma migrate diff` и положить в
`prisma/migrations/` (по workflow из CLAUDE.md), т.к. на VPS работает
`migrate deploy`.

### 2. Сохранять message_id при отправке

Обе рассылки запускаются fire-and-forget из `StoreRunController.createStoreRun`.

- `notificationService.postStoreRunToGroup(storeRunId)` уже возвращает
  `messageId`. После успешной отправки записать его в
  `storeRun.groupMessageId`.
- `notificationService.notifyGroupMembersAboutStoreRun(storeRunId)` шлёт ЛС
  через `this.send(...)`, который возвращает `NotificationResult` с `messageId`.
  Собрать пары `{ chatId, messageId }` по успешным отправкам и записать JSON в
  `storeRun.dmMessages`.

Каждая запись — отдельный `prisma.storeRun.update` в конце своего метода (методы
независимы, гонок между ними по разным полям нет).

### 3. Удаление при отмене

Новый метод `notificationService.deleteStoreRunMessages(storeRunId)`:

1. Загрузить забег с `group.telegramId`, `groupMessageId`, `dmMessages`.
2. Если бот не инициализирован → лог error, выход.
3. Если есть `groupMessageId` → `bot.api.deleteMessage(Number(group.telegramId),
   groupMessageId)` в try/catch (игнорировать ошибку).
4. Если есть `dmMessages` → распарсить JSON, для каждого `{ chatId, messageId }`
   вызвать `bot.api.deleteMessage(chatId, messageId)` в try/catch (игнорировать).
5. Логировать агрегат (сколько удалено/не удалось).

`StoreRunController.cancel`: после успешного `cancelStoreRun` дёрнуть
`deleteStoreRunMessages(id)` fire-and-forget (`.catch(log)`), как остальные
notify-вызовы в контроллере.

### 4. Крайние случаи

- Сообщение уже удалено вручную / старше 48 часов → `deleteMessage` бросает
  ошибку → ловим, игнорируем (забеги короткие, ≤30 мин, отмена в `COLLECTING` —
  почти всегда в пределах лимита Telegram).
- `groupMessageId` / `dmMessages` пустые (пост не прошёл, бота не было в группе,
  никому не доставилось) → соответствующий шаг пропускается.
- `dmMessages` содержит мусор / не парсится → лог warn, пропустить ЛС-часть.
- Гонка: отмена раньше, чем async-рассылка успела записать `groupMessageId`
  (окно в миллисекунды сразу после создания) → пост может осиротеть. Принимаем
  как маловероятный край.

### Затрагиваемые файлы

**Backend:**
- `backend/prisma/schema.prisma` — два поля в `StoreRun`.
- `backend/prisma/migrations/<ts>_store_run_message_ids/migration.sql` — новая
  миграция.
- `backend/src/services/notification.service.ts` — запись `groupMessageId` в
  `postStoreRunToGroup`, запись `dmMessages` в
  `notifyGroupMembersAboutStoreRun`, новый метод `deleteStoreRunMessages`.
- `backend/src/api/controllers/store-run.controller.ts` — вызов
  `deleteStoreRunMessages` в `cancel`.
- `backend/src/services/__tests__/notification.service.test.ts` — тесты на
  `deleteStoreRunMessages`.

**Frontend:** не меняется.

## Тестирование

Backend unit (Jest, мок prisma + фейковый bot):
- `deleteStoreRunMessages` вызывает `deleteMessage` для группового поста и для
  каждого ЛС из `dmMessages`.
- Терпит выброс из `deleteMessage` (одно падение не мешает остальным).
- Пропускает, когда `groupMessageId`/`dmMessages` отсутствуют.
- Не падает на невалидном JSON в `dmMessages`.

## Вне охвата (YAGNI)

- «Протухание» текста группового поста после старта шопинга / settle.
- Courtesy-уведомление «забег отменён» (по выбору пользователя — просто удаляем
  сообщения).
- Удаление сообщений при других переходах статуса (только `cancel`).
