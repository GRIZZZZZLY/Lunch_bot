# Дизайн: много-арендность — per-group меню + per-group админ

**Дата:** 2026-06-01
**Ветка:** feature/store-run
**Статус:** Утверждён, готов к планированию

## Проблема

Бот спроектирован одно-офисным (single-tenant). После добавления бота в **новую** группу другим пользователем выявлено два дефекта:

1. **Нет прав админа.** Хендлер `my_chat_member` ([group-events.ts:61](../../../backend/src/bot/events/group-events.ts)) выдаёт добавившему бота роль `GroupMember.role=CREATOR`, но **никогда не ставит `User.isAdmin=true`**. Админка Mini App гейтится **только на глобальный `User.isAdmin`** (бэк — `adminMiddleware` в [telegram-auth.ts:268](../../../backend/src/api/middleware/telegram-auth.ts); фронт — `user.isAdmin` в ~40 местах). Итог: добавивший не видит админ-функций.
2. **Меню не пустое.** `MenuItem` — глобальная модель без `groupId` ([schema.prisma:80](../../../backend/prisma/schema.prisma)). Меню одно на весь бот; новая группа видит меню исходного офиса. «Пустое меню на группу» невозможно без `groupId`.

Корень — single-tenant архитектура. Оба требования = **много-арендность**: каждая группа изолирована (своё меню, свой админ).

## Утверждённые решения (развилки)

| Развилка | Решение |
|----------|---------|
| Права добавившего бота | **Админ только своей группы** (per-group gating) |
| Модель меню | **Своё меню на группу** (groupId на MenuItem) |
| «Текущая группа» в Mini App | **Селектор групп** (юзер выбирает среди своих групп) |
| Существующее глобальное меню | **Обнулить** (стереть, все группы с нуля, включая офис) |
| Глобальный супер-админ | **Оставить** (`User.isAdmin` = override над всеми группами) |

## Архитектура

### A. Модель данных + миграция

**Изменения схемы (`prisma/schema.prisma`):**
- `MenuItem` → `groupId Int @map("group_id")`, FK на `Group` (`onDelete: Cascade`), `NOT NULL`. Индекс `@@index([groupId, isActive])`.
- `MenuSuggestion` → `groupId Int @map("group_id")`, FK на `Group` (`onDelete: Cascade`), `NOT NULL`. Индекс `@@index([groupId, status])`.
- `Group` → обратные связи `menuItems MenuItem[]`, `menuSuggestions MenuSuggestion[]`.

**Миграция-обнуление (порядок важен — снять FK перед удалением):**
1. `UPDATE votes SET menu_item_id = NULL;`
2. `UPDATE poll_results SET winner_menu_item_id = NULL;`
3. `DELETE FROM menu_suggestions;`
4. `DELETE FROM menu_items;`
5. `ALTER TABLE menu_items ADD COLUMN group_id ... NOT NULL` + FK + индекс.
6. `ALTER TABLE menu_suggestions ADD COLUMN group_id ... NOT NULL` + FK + индекс.

История прошлых голосований остаётся, но без названия блюда-победителя (принято осознанно).

**Сид:** убрать авто-наполнение глобального меню. Новая группа стартует пустой. (Скрипт `db:seed` оставить опциональным/нерелевантным; не вызывать автоматически.)

### B. Модель админа (per-group + супер-админ)

- `User.isAdmin` = **глобальный супер-админ**. Override: проходит ЛЮБУЮ per-group проверку. Для владельца. Глобальные эндпоинты (выдать isAdmin другому, список всех юзеров/групп) остаются на `adminMiddleware`.
- Per-group админ = `GroupMember.role ∈ {ADMIN, CREATOR}` через существующий `GroupService.isUserGroupAdmin(userId, groupId)`.
- **Новый middleware `groupAdminMiddleware`:** резолвит `groupId` из `req.query.groupId` / `req.params.groupId` / `req.body.groupId`; пускает если `user.isAdmin === true` **или** `isUserGroupAdmin(user.id, groupId) === true`; иначе 403. При отсутствии `groupId` → 400.
- **Добавивший бота получает `CREATOR`** (уже реализовано) → автоматически становится per-group админом. **Проблема 1 чинится гейтингом, без раздачи `isAdmin`.**

**Эндпоинты под `groupAdminMiddleware`** (group-scoped): меню CRUD, модерация предложки, управление голосованиями/участниками, group-scoped budget-действия. **Под прежним `adminMiddleware`** (глобальные): toggle `User.isAdmin`, список всех пользователей, список всех групп.

### C. Селектор групп + гейтинг фронта

- **Эндпоинт `GET /api/groups/my`** → массив `{ id, title, role, isActive }` групп юзера (из `GroupService.getGroupsForUser` + роль). Супер-админ (`user.isAdmin`) видит все активные группы.
- **Zustand `useAppStore`:** поле `currentGroupId` (+ persist в localStorage). Дефолт — первая группа юзера; восстанавливается из persist.
- **Компонент селектора** в Header (или Home): список групп юзера, выбор → меняет `currentGroupId`. Если группа одна — селектор скрыт/не-интерактивен.
- **Проброс контекста:** все group-scoped запросы (меню, голосования, предложка) берут `currentGroupId` вместо `userGroups[0]?.id` / хардкода `groupId || 1` ([usePolls.ts:226](../../../frontend/src/hooks/usePolls.ts)).
- **Хук `useIsGroupAdmin()`** = `!!user?.isAdmin || (роль юзера в currentGroup ∈ {ADMIN, CREATOR})`. Роль берётся из `/api/groups/my`. Заменяет ~40 callsite'ов `user?.isAdmin` (механически) для group-scoped UI. Чисто-супер-админские места (toggle isAdmin, all-users) остаются на `user?.isAdmin`.
- **Кэш меню per-group:** ключ `CACHE_KEYS.MENU_ITEMS_ACTIVE` → суффикс `:${groupId}`; инвалидация при изменении меню — по конкретной группе.

### D. Фазы раскатки

1. **Ф1 — Бэкенд данные/меню:** схема (`groupId` на MenuItem/MenuSuggestion) + миграция-обнуление + `menu.service`/`menu.controller`/`menu.routes` на `groupId` + per-group кэш + убрать глобальный сид.
2. **Ф2 — Бэкенд админ:** `groupAdminMiddleware` + развесить на group-scoped роуты + `GET /api/groups/my` с ролями + drop хардкода `groupId || 1` в poll-создании.
3. **Ф3 — Фронт:** `currentGroupId` в store + селектор групп + `useIsGroupAdmin` + проброс `currentGroupId` во все group-scoped запросы.
4. **Ф4 — Раскатка:** убрать сид-вызовы, обновить тесты, миграция на проде (**= обнуление меню офиса; подтверждено**), деплой через `update-vps.sh`.

## Риски и принятые компромиссы

- **Обнуление трёт меню текущего офиса** — владелец заводит блюда заново. Принято.
- **История голосований без названий блюд** (`menu_item_id=NULL`) — принято.
- **Много правок фронта** (`|| 1`, `userGroups[0]`, ~40 `user.isAdmin`) — механические, но объёмные; риск пропустить callsite → проверка grep'ом.
- **Кэш меню per-group** — забыть суффикс группы = утечка меню между группами; покрыть тестом.
- **Прод-миграция деструктивна** — бэкап БД перед `migrate deploy` обязателен.

## Критерии успеха

1. Новый юзер добавляет бота в свою группу → получает `CREATOR` → видит админ-функции (меню/голосования) **только своей группы** в Mini App.
2. Новая группа стартует с **пустым** меню; админ/юзеры группы наполняют его (создание + предложка) — видно только в этой группе.
3. Блюда/предложки одной группы **не видны** в другой.
4. Владелец (`User.isAdmin`) видит и управляет **всеми** группами + глобальными действиями.
5. Селектор групп переключает контекст меню/голосований/админки.
6. Бэкенд-тесты зелёные (с учётом новой per-group семантики).
