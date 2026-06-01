# Store Run — выбор целевой группы (per-group паритет с голосованием)

**Дата:** 2026-06-01
**Статус:** design approved, ожидает плана реализации
**Ветка:** `feature/store-run`

## Проблема

Бот стоит в нескольких группах. При запуске забега в магазин уведомление
уходит всегда в **одну** группу, независимо от намерения пользователя. Другую
группу выбрать из флоу забега нельзя.

### Диагноз (по логам прода + коду)

Все забеги в `rocket-lunch-bot-out.log` создаются с `groupId: 2`
(telegramId `-1002512649185`) — никогда с другим. Цепочка:

- `HomePage` считает `userGroupId = activePoll?.groupId || currentGroupId` и
  прокидывает в `ActiveStoreRunsSection` → `CreateStoreRunSheet`.
- `currentGroupId` берётся из `useCurrentGroup`, дефолтится в `groups[0].id`
  ([useCurrentGroup.ts:18](../../../frontend/src/hooks/useCurrentGroup.ts#L18)) и
  меняется только через селектор в шапке.
- [CreateStoreRunSheet.tsx](../../../frontend/src/components/store-run/CreateStoreRunSheet.tsx)
  **не имеет выбора группы** — только название магазина и таймер. Берёт
  единственный `groupId` из пропа вслепую.

Итог: каждый забег уходит в текущую выбранную группу из шапки. Когда бота
выгнали из группы 2 → `postStoreRunToGroup` падает с
`403 Forbidden: bot was kicked from the supergroup` → тихо, без ошибки
создателю. Вернули бота → снова работает.

**Бэкенд корректен per-tenant** (`notifyGroupMembersAboutStoreRun` и
`postStoreRunToGroup` используют `storeRun.groupId` / `group.telegramId`).
Дыра — в UI: он не даёт выбрать целевую группу и молча едет на глобальном
`currentGroupId`.

### Что уже работает

Голосование **уже** per-group: в
[CreatePollForm.tsx:425](../../../frontend/src/components/polls/CreatePollForm.tsx#L425)
есть выбор группы (`selectedGroupId`, список `adminGroups`, сабмит
`groupId: selectedGroupId`). Забег нужно привести к тому же паритету.

## Решения (подтверждены с пользователем)

1. **Выбор группы — селектор в окне забега** (не глобальный, не «во все сразу»).
2. **Блокировать создание**, если бота нет в целевой группе (pre-check членства
   бота перед созданием).
3. Охват — **только забег**. Голосование не трогаем.

## Дизайн

### 1. Frontend — селектор группы в окне забега

- В `CreateStoreRunSheet` добавить выбор группы.
- Источник списка — `useUserGroups()`: **все** группы, где пользователь —
  активный участник (забег НЕ админ-only, в отличие от опроса; ограничивать
  ролью не нужно).
- Селектор показывается только при `groups.length > 1`. При одной группе —
  скрыт, авто-выбор единственной.
- Дефолтное значение = `currentGroupId` из шапки, если он валиден в списке,
  иначе первая группа.
- UI — те же «чипы», что в `CreatePollForm` (консистентность). Состояние
  выбранной группы живёт внутри sheet.
- `ActiveStoreRunsSection` / `HomePage` передают в sheet `defaultGroupId`
  (текущая выбранная), а не «единственную истину».

### 2. Backend — pre-check членства бота

- Перед `StoreRunService.createStoreRun` проверить, что бот состоит в целевой
  группе: `bot.api.getChatMember(group.telegramId, botInfo.id)`, статус НЕ
  `left` и НЕ `kicked`.
- Если бот не в группе → новая `StoreRunError('BOT_NOT_IN_GROUP', …)` → HTTP
  409 с понятным сообщением. Забег не создаётся.
- Helper живёт на `notificationService` (там уже хранится инстанс `bot`):
  `botCanPostToGroup(groupId: number): Promise<boolean>`. Вызывается в
  `StoreRunController.createStoreRun` до обращения к сервису.
- Нужен id самого бота: `bot.botInfo.id` (grammy заполняет после `init`).

### 3. Data flow

```
Sheet (выбран groupId)
  → POST /api/store-runs { groupId, storeName, collectMinutes }
    → controller: botCanPostToGroup(groupId)?
        нет → 409 "Бот не в этой группе — добавь его в чат"
        да  → createStoreRun → fire-and-forget notify (как сейчас)
```

При ошибке pre-check sheet показывает сообщение, забег не создаётся.

### Edge cases

- Пользователь в 1 группе → селектор скрыт, авто-выбор.
- Пользователь в 0 групп → текущее предупреждение «Добавь бота в групповой чат».
- Бот в группе, но без права слать (`restricted`, `can_send_messages=false`) →
  редкий кейс; ловим на реальной отправке (остаётся лог в
  `postStoreRunToGroup`). Pre-check проверяет только факт членства.

### Затрагиваемые файлы

**Frontend:**
- `frontend/src/components/store-run/CreateStoreRunSheet.tsx` — селектор группы.
- `frontend/src/components/store-run/ActiveStoreRunsSection.tsx` — проброс
  `defaultGroupId`.
- `frontend/src/pages/HomePage.tsx` — передача дефолта (минимально).
- `frontend/src/hooks/queries/useStoreRunQueries.ts` — обработка кода ошибки
  `BOT_NOT_IN_GROUP` (если нужно отдельное сообщение).

**Backend:**
- `backend/src/services/store-run.service.ts` — новый код ошибки
  `BOT_NOT_IN_GROUP` в `StoreRunError`.
- `backend/src/services/notification.service.ts` — helper
  `botCanPostToGroup(groupId)`.
- `backend/src/api/controllers/store-run.controller.ts` — pre-check перед
  созданием, маппинг ошибки в 409.

## Тестирование

- **Backend (Jest):** unit на pre-check — бот в группе → создание идёт; бот
  `kicked`/`left` → `BOT_NOT_IN_GROUP`, забег не создан.
- **Frontend (Vitest):** sheet рендерит селектор при `groups.length > 1`,
  при сабмите шлёт выбранный `groupId`; при одной группе селектор скрыт.

## Вне охвата (YAGNI)

- Рассылка забега во все группы сразу.
- Изменение флоу голосования.
- Проверка тонких прав отправки (`restricted`) на этапе pre-check.
