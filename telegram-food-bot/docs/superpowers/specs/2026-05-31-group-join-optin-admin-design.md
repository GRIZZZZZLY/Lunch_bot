# Welcome-сообщение при добавлении бота: opt-in кнопка + авто-админ группы

**Дата:** 2026-05-31
**Ветка:** feature/store-run
**Статус:** Design approved, готов к плану

## Проблема

При добавлении бота в группу хотим:
1. Приветственное сообщение в чат с inline-кнопкой.
2. Кто нажал кнопку — гарантированно попадает в БД проекта и отмечается как «обедаю».
3. Кто добавил бота — автоматически становится администратором миниаппа **для своей группы** (не глобально).

## Контекст кодовой базы (что уже есть)

- `my_chat_member` хендлер уже шлёт welcome с одной `url`-кнопкой и синхронит TG-админов в БД — [backend/src/bot/events/group-events.ts:14-114](../../../backend/src/bot/events/group-events.ts).
- Участники группы уже пишутся в БД при вступлении через `chat_member` / `message:new_chat_members` (но эти события глохнут при включённом privacy mode → нужен надёжный fallback).
- `GroupMember.role` (CREATOR / ADMIN / MEMBER) уже в схеме — миграция **не нужна**.
- `GroupService.addMemberToGroup(groupId, userId, role='MEMBER')` — идемпотентен (восстанавливает вышедшего, но **затирает role** — нужен guard).
- `AdminService.toggleAdmin(userId, isAdmin, groupId)` уже пишет `role` через `setMemberRole`, защищает `CREATOR` от понижения.
- Фронт **уже** читает per-group роль: [CreatePollForm.tsx:138-284](../../../frontend/src/components/polls/CreatePollForm.tsx) — `groups.filter(g => g.role === 'ADMIN' || g.role === 'CREATOR')`, `canManagePolls = isAdmin || adminGroups.length > 0`.
- Глобальная админка (`/api/admin/*` — управление юзерами, долгами, cleanup) гейтится **отдельно** глобальным `User.isAdmin`. Per-group админ её **не** получает → это и есть нужная изоляция «только своя группа».

**Вывод:** инфраструктура per-group админа готова. Фича = тонкая прослойка в bot-слое. Без миграций БД, без правок фронта, без правок API-контроллеров.

## Решения (из брейншторма)

| Вопрос | Решение |
|---|---|
| Уровень админа | Per-group (только своя группа). Безопасно: глобальная админка остаётся за `isAdmin`. |
| Смысл клика по кнопке | Opt-in «я обедаю» + гарантированная регистрация в БД. |
| Механика кнопки | Две кнопки: callback (ловит клик) + url (открывает Mini App). `web_app`-кнопка в группах запрещена Telegram. |
| Роль добавившего | CREATOR (защищён от снятия, де-факто владелец). |

## Архитектура

Изменения только в bot-слое:

```
my_chat_member (бот добавлен)
  ├─ upsert группы (как сейчас)
  ├─ ctx.myChatMember.from → upsert юзера → addMemberToGroup(role=CREATOR)   ← НОВОЕ
  ├─ sync TG-админов: маппинг status→role (creator→CREATOR, admin→ADMIN)     ← УЛУЧШЕНО
  │    с guard «не понижать роль»
  ├─ setupMenuButtonForGroup (как сейчас)
  └─ welcome с ДВУМЯ кнопками                                                 ← ИЗМЕНЕНО

callbackQuery /^optin_<groupId>$/                                            ← НОВЫЙ хендлер
  ├─ ctx.callbackQuery.from → upsert юзера
  ├─ addMemberToGroup(groupId, userId)   (role=MEMBER, существующую не трогаем)
  ├─ participatesInPolls = true
  └─ answerCallbackQuery (тост «✅ ты в списке»)
```

### Компоненты

**1. `group-events.ts` — `my_chat_member` (правка)**

- После upsert группы: взять `ctx.myChatMember.from`. Если не бот — upsert юзера, `addMemberToGroup(group.id, user.id, 'CREATOR')`.
- Sync-цикл TG-админов: маппить `admin.status` → role (`'creator'→'CREATOR'`, `'administrator'→'ADMIN'`), вместо текущего дефолтного MEMBER.
- Guard «не понижать»: ввести хелпер (в `GroupService` или локально), который ставит роль только если новая «старше» текущей. Иерархия: `CREATOR > ADMIN > MEMBER`. Защищает от понижения при повторном добавлении бота / ресинке.
- Welcome-текст и клавиатура — две кнопки:
  - `{ text: '✅ Я обедаю', callback_data: 'optin_' + chat.id }`
  - `{ text: '🍽 Открыть Mini App', url: 'https://t.me/' + ctx.me.username + '?start=menu_' + chat.id }`

**2. Новый хендлер opt-in**

Файл: `backend/src/bot/handlers/group.handlers.ts` (новый) — функция `handleOptInButton(ctx)`.
- Парсит `groupId` из `optin_<groupId>`.
- `ctx.callbackQuery.from` → `UserService.upsertUser`.
- `GroupService.upsertGroup` (на случай пропущенного `my_chat_member`) → `addMemberToGroup(group.id, user.id)` (роль по умолчанию MEMBER; existing-роль не трогаем — `addMemberToGroup` для уже-активного участника ничего не меняет).
- `UserService` → `participatesInPolls = true` (использовать существующий метод обновления флага; если такого нет — `prisma.user.update`).
- `ctx.answerCallbackQuery({ text: '✅ Готово! Ты в списке обедающих' })`.
- Идемпотентно: повторный клик повторяет тост, без дублей в БД (`@@unique([groupId, userId])`).

**3. `bot.ts` — регистрация**

`bot.callbackQuery(/^optin_/, handleOptInButton)` рядом с остальными callbackQuery-регистрациями.

## Поток данных

```
Группа: бот добавлен
  → Telegram: my_chat_member (from = добавивший)
  → БД: Group upsert, GroupMember(добавивший, CREATOR), GroupMember(TG-админы, ADMIN/CREATOR)
  → Чат: welcome [✅ Я обедаю] [🍽 Открыть Mini App]

Участник жмёт [✅ Я обедаю]
  → Telegram: callback_query (from = кликнувший)
  → БД: User upsert, GroupMember(кликнувший, MEMBER), User.participatesInPolls=true
  → Тост: «✅ Готово! Ты в списке обедающих»

Добавивший открывает Mini App
  → /start menu_<groupId> → миниапп
  → группа в списке с role=CREATOR → доступно управление голосованиями этой группы
```

## Обработка ошибок / edge-cases

- `from.is_bot` (бота добавил другой бот) → скип назначения CREATOR.
- Бот добавлен как `member` vs `administrator` → оба ловятся (условие в хендлере уже покрывает).
- Guard «не понижать роль»: повторное добавление бота не сбрасывает CREATOR→ADMIN/MEMBER.
- Privacy mode ON → `chat_member`/`new_chat_members` молчат, но callback-кнопка работает всегда — это и есть надёжный путь регистрации.
- Ошибка в любом шаге callback → логируем, отвечаем `answerCallbackQuery` нейтральным текстом (не вешаем «часики» в Telegram).
- `addMemberToGroup` уже idempotent через `@@unique([groupId, userId])`.

## Тестирование

Backend (jest, текущие 258 должны остаться зелёными):
- `handleOptInButton`: upsert юзера + addMember + `participatesInPolls=true` + answerCallbackQuery вызван. Мок `ctx`, `UserService`, `GroupService`.
- Role-guard: при существующем CREATOR ресинк не понижает до ADMIN/MEMBER.
- `my_chat_member`: `from` получает CREATOR; `is_bot` from — скип.

Глобальная админка не трогается → отдельные тесты не нужны.

Ручной прогон: добавить бота в тест-группу → проверить welcome с 2 кнопками → нажать «Я обедаю» (другим аккаунтом) → проверить запись в БД + флаг → открыть миниапп добавившим → убедиться, что управление голосованиями группы доступно.

## Вне scope (YAGNI)

- Перевод редактирования меню / настроек группы на per-group роль (сейчас часть UI на глобальном `isAdmin`) — отдельная задача, не требуется для запроса.
- Глобальный `isAdmin` для добавившего — осознанно отклонён (риск: чужой человек получил бы контроль над всей системой).
- Счётчик/список «кто нажал» в самом сообщении группы — не запрашивалось.

## Файлы

- `backend/src/bot/events/group-events.ts` — правка `my_chat_member` (CREATOR, role-mapping+guard, две кнопки).
- `backend/src/bot/handlers/group.handlers.ts` — **новый**, `handleOptInButton`.
- `backend/src/bot/bot.ts` — регистрация `bot.callbackQuery(/^optin_/, ...)`.
- `backend/src/services/group.service.ts` — возможный хелпер `setMemberRoleNoDowngrade` (или guard инлайн).
- Тесты: `backend/src/**/*.test.ts` (новые/правки).
