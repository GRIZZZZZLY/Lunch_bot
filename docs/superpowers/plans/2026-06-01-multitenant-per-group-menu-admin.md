# Per-group Menu + Per-group Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать бота много-арендным — у каждой Telegram-группы своё меню и свой админ; добавивший бота управляет только своей группой; глобальный `User.isAdmin` остаётся супер-админом над всеми группами.

**Architecture:** На `MenuItem`/`MenuSuggestion` добавляется `groupId` (NOT NULL). Меню/предложки фильтруются по группе, кэш — per-group. Гейтинг group-scoped эндпоинтов переезжает с глобального `adminMiddleware` на новый `groupAdminMiddleware` (`user.isAdmin || isUserGroupAdmin`). Фронт получает селектор групп (`currentGroupId` в zustand) и хук `useIsGroupAdmin()`, заменяющий group-scoped проверки `user.isAdmin`. Существующее глобальное меню при миграции обнуляется.

**Tech Stack:** Prisma (PostgreSQL), Express, Grammy, Jest (backend), React + Zustand + React Query + Vite (frontend), TypeScript strict.

**Spec:** [docs/superpowers/specs/2026-06-01-multitenant-per-group-menu-admin-design.md](../specs/2026-06-01-multitenant-per-group-menu-admin-design.md)

---

## File Structure

**Backend — создаём:**
- `backend/src/api/middleware/group-admin.ts` — `groupAdminMiddleware` (резолв groupId + per-group/super-admin проверка).
- `backend/prisma/migrations/<ts>_per_group_menu/migration.sql` — ручная миграция: обнуление меню + `groupId` NOT NULL.
- `backend/src/api/middleware/__tests__/group-admin.test.ts` — тест middleware.

**Backend — меняем:**
- `backend/prisma/schema.prisma` — `groupId` на `MenuItem`, `MenuSuggestion`; обратные связи на `Group`.
- `backend/src/types/menu.types.ts` — `groupId` в `CreateMenuItemData`.
- `backend/src/services/menu.service.ts` — все методы принимают/фильтруют `groupId`; per-group кэш-ключи.
- `backend/src/api/controllers/menu.controller.ts` — резолв `groupId` из запроса, проброс в сервис.
- `backend/src/api/routes/menu.routes.ts` — write-роуты на `groupAdminMiddleware`.
- `backend/src/services/menu-suggestion.service.ts` — `groupId` в create/list/approve.
- `backend/src/api/controllers/menu-suggestion.controller.ts` — проброс `groupId`.
- `backend/src/api/routes/menu-suggestion.routes.ts` — модерация на `groupAdminMiddleware`.
- `backend/src/services/user.service.ts` (или group-эндпоинт) — список групп юзера c `role`.
- `backend/src/api/controllers/poll.controller.ts` — убрать дефолт `groupId || 1` (если есть на бэке).
- Тесты: `menu.service.test.ts`, fixtures.

**Frontend — создаём:**
- `frontend/src/hooks/useCurrentGroup.ts` — резолв `currentGroupId` (store + дефолт из групп юзера).
- `frontend/src/hooks/useIsGroupAdmin.ts` — `user.isAdmin || role(currentGroup) ∈ {ADMIN,CREATOR}`.
- `frontend/src/components/layout/GroupSelector.tsx` — выпадающий список групп.

**Frontend — меняем:**
- `frontend/src/store/useAppStore.ts` — `currentGroupId` + persist.
- `frontend/src/types/auth.types.ts` — тип группы с `role`.
- `frontend/src/services/menu.service.ts` — `groupId` в запросах меню.
- `frontend/src/hooks/queries/useUserQueries.ts` — тип `UserGroup` с `role`.
- `frontend/src/components/layout/Header.tsx` — вставка `GroupSelector`.
- ~13 файлов с group-scoped `user?.isAdmin` → `useIsGroupAdmin()` (sweep, Phase 3).

---

## PHASE 1 — Backend: per-group меню (данные + сервис + API + кэш)

### Task 1.1: Схема — `groupId` на MenuItem и MenuSuggestion

**Files:**
- Modify: `backend/prisma/schema.prisma` (модели `MenuItem` ~L80, `MenuSuggestion` ~L322, `Group` ~L60)

- [ ] **Step 1: Добавить связи в модель `Group`**

В модель `Group` (после строки `storeRuns  StoreRun[]`) добавить:

```prisma
  menuItems        MenuItem[]
  menuSuggestions  MenuSuggestion[]
```

- [ ] **Step 2: Добавить `groupId` в `MenuItem`**

В модель `MenuItem`: после `createdBy Int @map("created_by")` добавить поле, после `creator User ...` добавить связь, в конце — индекс:

```prisma
  groupId      Int           @map("group_id")
  // ...
  group        Group         @relation(fields: [groupId], references: [id], onDelete: Cascade)
  // ...
  @@index([groupId, isActive])
```

- [ ] **Step 3: Добавить `groupId` в `MenuSuggestion`**

В модель `MenuSuggestion`: после `suggestedBy Int @map("suggested_by")` добавить поле, добавить связь и индекс:

```prisma
  groupId           Int       @map("group_id")
  // ...
  group     Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  // ...
  @@index([groupId, status])
```

- [ ] **Step 4: Проверить валидность схемы**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): add groupId to MenuItem and MenuSuggestion"
```

---

### Task 1.2: Ручная миграция — обнуление меню + NOT NULL `groupId`

**Files:**
- Create: `backend/prisma/migrations/<TS>_per_group_menu/migration.sql`

> Деструктивно. Локально БД dev, на проде — бэкап перед deploy (Phase 4).

- [ ] **Step 1: Создать папку миграции**

```bash
cd backend
TS=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TS}_per_group_menu
echo "created prisma/migrations/${TS}_per_group_menu"
```

- [ ] **Step 2: Написать `migration.sql`**

В `prisma/migrations/<TS>_per_group_menu/migration.sql`:

```sql
-- Снять FK-ссылки на удаляемые блюда (история голосований остаётся без названия)
UPDATE "votes" SET "menu_item_id" = NULL WHERE "menu_item_id" IS NOT NULL;
UPDATE "poll_results" SET "winner_menu_item_id" = NULL WHERE "winner_menu_item_id" IS NOT NULL;

-- Обнулить меню и предложки (решение: все группы с нуля)
DELETE FROM "menu_suggestions";
DELETE FROM "menu_items";

-- Добавить group_id (таблицы пусты → NOT NULL безопасен)
ALTER TABLE "menu_items" ADD COLUMN "group_id" INTEGER NOT NULL;
ALTER TABLE "menu_suggestions" ADD COLUMN "group_id" INTEGER NOT NULL;

-- FK + индексы
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_suggestions"
  ADD CONSTRAINT "menu_suggestions_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "menu_items_group_id_is_active_idx" ON "menu_items"("group_id", "is_active");
CREATE INDEX "menu_suggestions_group_id_status_idx" ON "menu_suggestions"("group_id", "status");
```

- [ ] **Step 3: Применить локально и сгенерировать клиент**

```bash
cd backend
npx prisma migrate resolve --applied "<TS>_per_group_menu" 2>/dev/null || true
npx prisma db execute --file prisma/migrations/<TS>_per_group_menu/migration.sql --schema prisma/schema.prisma
npx prisma generate
```

Expected: миграция применяется без ошибок, `Generated Prisma Client`.

- [ ] **Step 4: Проверить статус миграций**

Run: `cd backend && npx prisma migrate status`
Expected: `Database schema is up to date!` (или список с нашей миграцией как applied).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/migrations
git commit -m "feat(migration): wipe global menu, add NOT NULL group_id"
```

---

### Task 1.3: Типы — `groupId` в `CreateMenuItemData`

**Files:**
- Modify: `backend/src/types/menu.types.ts:1-8`

- [ ] **Step 1: Добавить поле**

```ts
export interface CreateMenuItemData {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
  createdBy: number; // Required field
  groupId: number;   // Required: блюдо принадлежит конкретной группе
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: ошибки появятся в `menu.service.ts`/`menu.controller.ts` (ожидаемо — чиним в Task 1.4/1.5). Зафиксируй, что других файлов в ошибках нет.

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/menu.types.ts
git commit -m "feat(types): groupId in CreateMenuItemData"
```

---

### Task 1.4: `MenuService` — фильтрация по `groupId` + per-group кэш (TDD)

**Files:**
- Modify: `backend/src/services/menu.service.ts`
- Test: `backend/src/services/__tests__/menu.service.test.ts`

- [ ] **Step 1: Обновить helper фикстуры в тесте**

В `menu.service.test.ts`, в `createMockMenuItem` (overrides ~L62-82) добавить поле:

```ts
      createdBy: 1,
      groupId: 1,   // NEW
```

- [ ] **Step 2: Написать падающий тест на per-group выборку**

Добавить в `menu.service.test.ts` (в describe для getActiveMenuItems):

```ts
describe('getActiveMenuItems (per-group)', () => {
  it('запрашивает только блюда указанной группы', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([createMockMenuItem({ groupId: 7 })]);
    // cacheService.getOrSet должен вызвать фабрику (cache miss)
    (cacheService.getOrSet as jest.Mock).mockImplementation(async (_k: string, fn: any) => fn());

    await MenuService.getActiveMenuItems(7);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, groupId: 7 } })
    );
  });

  it('использует per-group ключ кэша', async () => {
    (cacheService.getOrSet as jest.Mock).mockResolvedValue([]);
    await MenuService.getActiveMenuItems(7);
    expect(cacheService.getOrSet).toHaveBeenCalledWith(
      'menu_items_active:7', expect.any(Function), 300
    );
  });
});
```

- [ ] **Step 3: Запустить — убедиться что падает**

Run: `cd backend && npm test -- menu.service.test.ts`
Expected: FAIL (getActiveMenuItems пока без аргумента / ключ без суффикса).

- [ ] **Step 4: Реализовать per-group в `menu.service.ts`**

Изменить сигнатуры и тела (минимально):

```ts
// createMenuItem: пробросить groupId
const menuItem = await prisma.menuItem.create({
  data: {
    name: data.name,
    description: data.description,
    price: data.price,
    imageUrl: data.imageUrl,
    isActive: data.isActive ?? true,
    createdBy: data.createdBy,
    groupId: data.groupId,            // NEW
  },
});
CacheInvalidator.invalidateMenu(data.groupId);   // см. Step 6

// getActiveMenuItems(groupId: number)
static async getActiveMenuItems(groupId: number): Promise<MenuItem[]> {
  const items = await cacheService.getOrSet(
    `${CACHE_KEYS.MENU_ITEMS_ACTIVE}:${groupId}`,
    async () => prisma.menuItem.findMany({
      where: { isActive: true, groupId },
      select: { id:true,name:true,description:true,price:true,imageUrl:true,isActive:true,createdBy:true,createdAt:true,updatedAt:true, groupId:true },
      orderBy: { name: 'asc' },
    }),
    CACHE_TTL.MENU
  );
  return items;
}

// getAllMenuItems(groupId: number) → where: { groupId }
// searchMenuItems(query, groupId) → where: { ...OR, isActive:true, groupId }
// getMenuStats(groupId) → все count/aggregate с where groupId
// getPopularMenuItems(limit, groupId) → where: { isActive:true, groupId }
```

Для `updateMenuItem`/`toggleMenuItemStatus`/`deleteMenuItem`/`bulkUpdateStatus`: после операции инвалидировать кэш конкретной группы. Эти методы получают `id`; чтобы узнать группу — после fetch элемента взять `item.groupId` и вызвать `CacheInvalidator.invalidateMenu(item.groupId)`.

- [ ] **Step 5: Обновить `CacheInvalidator.invalidateMenu` под группу**

В `backend/src/services/cache.service.ts` сделать `invalidateMenu` принимающим `groupId`:

```ts
static invalidateMenu(groupId: number): void {
  void cacheService.del(`${MENU_ACTIVE_KEY}:${groupId}`);
}
```

(Имя константы ключа подставь фактическое из cache.service.ts, совпадающее с `CACHE_KEYS.MENU_ITEMS_ACTIVE`. Если ключ хранится как локальная константа — экспортировать/переиспользовать одно значение, чтобы service и invalidator формировали идентичный ключ.)

- [ ] **Step 6: Запустить тесты — зелёные**

Run: `cd backend && npm test -- menu.service.test.ts`
Expected: PASS (включая два новых теста).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/menu.service.ts backend/src/services/cache.service.ts backend/src/services/__tests__/menu.service.test.ts
git commit -m "feat(menu): per-group filtering and cache keys"
```

---

### Task 1.5: `MenuController` — резолв `groupId` из запроса

**Files:**
- Modify: `backend/src/api/controllers/menu.controller.ts`

> GET-чтение: `groupId` из `req.query.groupId`. POST/PUT/etc: из `req.body.groupId` или `req.query.groupId`. Хелпер общий.

- [ ] **Step 1: Добавить хелпер резолва в начало класса/файла**

```ts
function resolveGroupId(req: Request): number | null {
  const raw = (req.query.groupId ?? req.body?.groupId) as string | number | undefined;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}
```

- [ ] **Step 2: Применить в чтениях**

В `getAllItems`, `getActiveItems`, `getPopularItems`, `getMenuStats`, `searchItems`:

```ts
const groupId = resolveGroupId(req);
if (!groupId) {
  res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
  return;
}
const items = await MenuService.getActiveMenuItems(groupId); // и аналогично для остальных
```

- [ ] **Step 3: Применить в `createItem`**

```ts
const groupId = resolveGroupId(req);
if (!groupId) { res.status(400).json({ success:false, error:'groupId is required', code:'MISSING_GROUP_ID' }); return; }
const itemData = { ...data, createdBy: user.id, groupId };
const item = await MenuService.createMenuItem(itemData);
```

(`update/toggle/delete/bulk` работают по `id`; группа выясняется в сервисе по самому элементу — отдельный groupId в запросе не обязателен. Но `groupAdminMiddleware` для них требует groupId — см. Task 2.2: для этих роутов middleware берёт groupId из тела/квери, фронт его передаёт.)

- [ ] **Step 4: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: чисто по menu.controller (ошибки могут остаться в suggestion — чиним в Task 1.6).

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/controllers/menu.controller.ts
git commit -m "feat(menu-api): resolve groupId from request"
```

---

### Task 1.6: MenuSuggestion — `groupId` в create/list/approve

**Files:**
- Modify: `backend/src/services/menu-suggestion.service.ts`
- Modify: `backend/src/api/controllers/menu-suggestion.controller.ts`

- [ ] **Step 1: Расширить DTO/фильтры**

```ts
export interface CreateSuggestionDTO {
  name: string; description?: string; price?: number; imageUrl?: string;
  suggestedBy: number;
  groupId: number;   // NEW
}
export interface SuggestionFilters {
  status?: string; suggestedBy?: number; groupId?: number; limit?: number; offset?: number;  // groupId NEW
}
```

- [ ] **Step 2: Проброс в `createSuggestion`**

В `prisma.menuSuggestion.create` добавить `groupId: data.groupId`.

- [ ] **Step 3: Фильтр в `getSuggestions`**

В `where` добавить `...(filters.groupId ? { groupId: filters.groupId } : {})`.

- [ ] **Step 4: `approveSuggestion` создаёт MenuItem с `groupId`**

При создании MenuItem из предложки прокинуть `groupId` из самой предложки (сначала прочитать suggestion → взять `suggestion.groupId`).

- [ ] **Step 5: Контроллер — резолв groupId**

В `menu-suggestion.controller.ts` для create взять `groupId` из `req.body.groupId` (валидация как в Task 1.5); для list — из `req.query.groupId`. Approve — берёт группу из самой предложки, доп. параметр не нужен.

- [ ] **Step 6: Type-check весь backend**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 ошибок.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/menu-suggestion.service.ts backend/src/api/controllers/menu-suggestion.controller.ts
git commit -m "feat(suggestions): per-group create/list/approve"
```

---

### Task 1.7: Убрать авто-сид глобального меню

**Files:**
- Modify: места вызова `seedMenu()` (искать grep'ом)

- [ ] **Step 1: Найти все вызовы сида**

Run: `cd backend && grep -rn "seedMenu\|seed-menu\|clearMenu" src/ prisma/ --include=*.ts`
Expected: список вызовов.

- [ ] **Step 2: Убрать авто-вызов при старте**

Если `seedMenu()` вызывается при старте сервера/бота — удалить вызов (новые группы стартуют пустыми). Ручной скрипт `npm run db:seed` оставить, но он теперь требует groupId — пометить как устаревший комментарием в `seed-menu.ts` (без переписывания, если не вызывается автоматически — YAGNI).

- [ ] **Step 3: Type-check + быстрый прогон тестов**

Run: `cd backend && npx tsc --noEmit && npm test -- menu`
Expected: 0 ошибок, меню-тесты зелёные.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(seed): drop auto-seed of global menu"
```

---

## PHASE 2 — Backend: per-group админ-гейтинг + группы с ролями

### Task 2.1: `groupAdminMiddleware` (TDD)

**Files:**
- Create: `backend/src/api/middleware/group-admin.ts`
- Test: `backend/src/api/middleware/__tests__/group-admin.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { groupAdminMiddleware } from '../group-admin';
import { GroupService } from '../../../services/group.service';

jest.mock('../../../services/group.service');

const mkRes = () => {
  const res: any = {}; res.status = jest.fn(() => res); res.json = jest.fn(() => res); return res;
};

describe('groupAdminMiddleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('пускает супер-админа без проверки группы', async () => {
    const req: any = { user: { id: 1, isAdmin: true }, query: { groupId: '5' }, params: {}, body: {} };
    const next = jest.fn();
    await groupAdminMiddleware(req, mkRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('пускает per-group админа', async () => {
    (GroupService.isUserGroupAdmin as jest.Mock).mockResolvedValue(true);
    const req: any = { user: { id: 2, isAdmin: false }, query: { groupId: '5' }, params: {}, body: {} };
    const next = jest.fn();
    await groupAdminMiddleware(req, mkRes(), next);
    expect(GroupService.isUserGroupAdmin).toHaveBeenCalledWith(2, 5);
    expect(next).toHaveBeenCalled();
  });

  it('403 для не-админа группы', async () => {
    (GroupService.isUserGroupAdmin as jest.Mock).mockResolvedValue(false);
    const req: any = { user: { id: 3, isAdmin: false }, query: { groupId: '5' }, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('400 если groupId отсутствует', async () => {
    const req: any = { user: { id: 3, isAdmin: false }, query: {}, params: {}, body: {} };
    const res = mkRes(); const next = jest.fn();
    await groupAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd backend && npm test -- group-admin.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Реализовать middleware**

```ts
import { Request, Response, NextFunction } from 'express';
import { GroupService } from '../../services/group.service';
import { logger } from '../../utils/logger';

function resolveGroupId(req: Request): number | null {
  const raw = (req.params?.groupId ?? req.query?.groupId ?? (req.body && req.body.groupId)) as
    | string | number | undefined;
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

export async function groupAdminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ success: false, error: 'User not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    if (user.isAdmin === true) { next(); return; }  // супер-админ override

    const groupId = resolveGroupId(req);
    if (!groupId) {
      res.status(400).json({ success: false, error: 'groupId is required', code: 'MISSING_GROUP_ID' });
      return;
    }
    const isAdmin = await GroupService.isUserGroupAdmin(user.id, groupId);
    if (!isAdmin) {
      res.status(403).json({ success: false, error: 'Group admin access required', code: 'ACCESS_DENIED' });
      return;
    }
    next();
  } catch (error) {
    logger.error('groupAdminMiddleware error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}
```

- [ ] **Step 4: Запустить — зелёные**

Run: `cd backend && npm test -- group-admin.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/middleware/group-admin.ts backend/src/api/middleware/__tests__/group-admin.test.ts
git commit -m "feat(auth): groupAdminMiddleware (per-group + super-admin)"
```

---

### Task 2.2: Развесить `groupAdminMiddleware` на write-роуты меню и предложки

**Files:**
- Modify: `backend/src/api/routes/menu.routes.ts`
- Modify: `backend/src/api/routes/menu-suggestion.routes.ts`

- [ ] **Step 1: Меню — заменить `adminMiddleware` на `groupAdminMiddleware`**

В `menu.routes.ts` импорт:

```ts
import { telegramAuthMiddleware } from '../middleware/telegram-auth';
import { groupAdminMiddleware } from '../middleware/group-admin';
```

Заменить `adminMiddleware` на `groupAdminMiddleware` в роутах POST `/`, PUT `/:id`, PATCH `/:id/toggle`, DELETE `/:id`, PATCH `/bulk-status`. (GET-роуты остаются на `telegramAuthMiddleware`.)

- [ ] **Step 2: Предложка — модерация на `groupAdminMiddleware`**

В `menu-suggestion.routes.ts`: роуты подтверждения/отклонения предложки (approve/reject) перевести на `groupAdminMiddleware`. Создание предложки (любой участник) — оставить на `telegramAuthMiddleware`.

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 ошибок.

- [ ] **Step 4: Прогнать все backend-тесты**

Run: `cd backend && npm test`
Expected: всё зелёное (поправить упавшие тесты роутов меню/предложки, если они мокали `adminMiddleware` — переключить мок на `groupAdminMiddleware`, передавать `groupId` в запросах).

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/routes/menu.routes.ts backend/src/api/routes/menu-suggestion.routes.ts
git commit -m "feat(routes): per-group admin gating for menu + suggestion writes"
```

---

### Task 2.3: Эндпоинт списка групп юзера с `role`

**Files:**
- Modify: контроллер/сервис за `userService.getUserGroups()` (фронт уже его дёргает — найти бэкенд-реализацию)

- [ ] **Step 1: Найти бэкенд за `getUserGroups`**

Run: `cd backend && grep -rn "getGroupsForUser\|/groups" src/api/`
Expected: роут (вероятно `GET /api/user/groups`) + контроллер.

- [ ] **Step 2: Убедиться что ответ включает `role` и `isActive`**

`GroupService.getGroupsForUser(userId)` уже возвращает `GroupMember` с `include: { group: true }` и полем `role`. Контроллер должен сериализовать в форму:

```ts
{ id: group.id, title: group.title, role: member.role, isActive: group.isActive }
```

Если контроллер уже отдаёт `role` — задача no-op, зафиксировать. Если нет — добавить `role` в маппинг.

- [ ] **Step 3: Супер-админ видит все группы**

Если `req.user.isAdmin` — вернуть все активные группы (через `GroupService.getAllActiveGroups()` или аналог; роль для них = `'ADMIN'`/`'CREATOR'` синтетически, чтобы гейтинг на фронте пускал). Если такого метода нет — добавить простой `prisma.group.findMany({ where:{ isActive:true } })`.

- [ ] **Step 4: Type-check + тест (если есть user-роуты тест)**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(groups): return role (+ all groups for super-admin) in user groups endpoint"
```

---

### Task 2.4: Убрать хардкод `groupId` в создании голосования (бэкенд)

**Files:**
- Modify: `backend/src/api/controllers/poll.controller.ts` (createPoll)

- [ ] **Step 1: Найти дефолт groupId**

Run: `cd backend && grep -n "groupId" src/api/controllers/poll.controller.ts | grep -i "|| 1\|?? 1\|default"`
Expected: либо есть хардкод (убрать), либо нет (тогда no-op — фронт шлёт реальный groupId).

- [ ] **Step 2: Требовать groupId в createPoll**

Если есть фолбэк `groupId || 1` — заменить на валидацию: при отсутствии валидного `groupId` → 400 `MISSING_GROUP_ID`. Перед созданием убедиться, что меню-айтемы принадлежат этой группе (опционально, если есть проверка selectedMenuItemIds).

- [ ] **Step 3: Type-check + тесты polls**

Run: `cd backend && npx tsc --noEmit && npm test -- poll`
Expected: 0 ошибок, тесты зелёные.

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/controllers/poll.controller.ts
git commit -m "fix(polls): require explicit groupId on poll creation"
```

---

## PHASE 3 — Frontend: селектор групп + group-scoped гейтинг

### Task 3.1: Типы групп + store `currentGroupId`

**Files:**
- Modify: `frontend/src/types/auth.types.ts`
- Modify: `frontend/src/store/useAppStore.ts`
- Modify: `frontend/src/hooks/queries/useUserQueries.ts`

- [ ] **Step 1: Тип группы с ролью**

В `auth.types.ts` добавить:

```ts
export type GroupRole = 'CREATOR' | 'ADMIN' | 'MEMBER';
export interface UserGroup {
  id: number;
  title: string;
  role: GroupRole;
  isActive: boolean;
}
```

- [ ] **Step 2: `currentGroupId` в store**

В `useAppStore.ts` интерфейс `AppState` + действие:

```ts
  currentGroupId: number | null;
  setCurrentGroupId: (id: number | null) => void;
```

В `create(...)`: дефолт `currentGroupId: null`, экшен `setCurrentGroupId: (id) => set({ currentGroupId: id })`. В конфиге `persist` добавить `currentGroupId` в `partialize` (если partialize используется), чтобы выбор сохранялся.

- [ ] **Step 3: Типизировать `useUserGroups` как `UserGroup[]`**

В `useUserQueries.ts` указать тип результата `useQuery<UserGroup[]>` и проверить, что `userService.getUserGroups()` типизирован на `ApiResponse<UserGroup[]>`.

- [ ] **Step 4: Type-check**

Run: `cd frontend && npm run type-check`
Expected: 0 ошибок (или только в местах, которые правим далее).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/auth.types.ts frontend/src/store/useAppStore.ts frontend/src/hooks/queries/useUserQueries.ts
git commit -m "feat(fe): UserGroup type + currentGroupId store"
```

---

### Task 3.2: Хуки `useCurrentGroup` + `useIsGroupAdmin`

**Files:**
- Create: `frontend/src/hooks/useCurrentGroup.ts`
- Create: `frontend/src/hooks/useIsGroupAdmin.ts`

- [ ] **Step 1: `useCurrentGroup`**

```ts
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useUserGroups } from './queries/useUserQueries';
import type { UserGroup } from '../types/auth.types';

export function useCurrentGroup(): { currentGroupId: number | null; groups: UserGroup[]; currentGroup: UserGroup | null } {
  const currentGroupId = useAppStore((s) => s.currentGroupId);
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  const { data: groups = [] } = useUserGroups();

  useEffect(() => {
    if (groups.length === 0) return;
    const valid = currentGroupId != null && groups.some((g) => g.id === currentGroupId);
    if (!valid) setCurrentGroupId(groups[0].id);
  }, [groups, currentGroupId, setCurrentGroupId]);

  const currentGroup = groups.find((g) => g.id === currentGroupId) ?? null;
  return { currentGroupId, groups, currentGroup };
}
```

- [ ] **Step 2: `useIsGroupAdmin`**

```ts
import { useAuth } from './useAuth';
import { useCurrentGroup } from './useCurrentGroup';

export function useIsGroupAdmin(): boolean {
  const { user } = useAuth();
  const { currentGroup } = useCurrentGroup();
  if (user?.isAdmin) return true;                       // супер-админ
  return currentGroup?.role === 'ADMIN' || currentGroup?.role === 'CREATOR';
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useCurrentGroup.ts frontend/src/hooks/useIsGroupAdmin.ts
git commit -m "feat(fe): useCurrentGroup + useIsGroupAdmin hooks"
```

---

### Task 3.3: `menuService` — передаёт `groupId`

**Files:**
- Modify: `frontend/src/services/menu.service.ts`

- [ ] **Step 1: Прокинуть groupId в запросы**

Все методы меню принимают `groupId` и шлют его как query/body:

```ts
async getActiveItems(groupId: number) {
  return apiService.get<MenuItem[]>(`/menu/active?groupId=${groupId}`);
}
async getAllItems(groupId: number) { return apiService.get<MenuItem[]>(`/menu?groupId=${groupId}`); }
async createItem(data: CreateMenuItemInput, groupId: number) {
  return apiService.post<MenuItem>('/menu', { ...data, groupId });
}
async updateItem(id: number, data: UpdateMenuItemInput, groupId: number) {
  return apiService.put<MenuItem>(`/menu/${id}?groupId=${groupId}`, { ...data, groupId });
}
async toggleItem(id: number, groupId: number) { return apiService.patch(`/menu/${id}/toggle?groupId=${groupId}`, { groupId }); }
async deleteItem(id: number, groupId: number) { return apiService.delete(`/menu/${id}?groupId=${groupId}`); }
```

(Точные имена методов взять из текущего файла; добавить параметр `groupId` к каждому. `MenuItem` интерфейс — добавить `groupId: number`.)

- [ ] **Step 2: Обновить вызовы в хуках/компонентах меню**

Run: `cd frontend && grep -rn "menuService\.\|menu.service" src/ --include=*.ts --include=*.tsx`
Передать `currentGroupId` (из `useCurrentGroup`) во все вызовы. Query-ключи React Query для меню сделать per-group: `['menu','active', groupId]`.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npm run type-check`
Expected: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/menu.service.ts frontend/src/
git commit -m "feat(fe): menu requests carry groupId, per-group query keys"
```

---

### Task 3.4: Компонент `GroupSelector` + вставка в Header

**Files:**
- Create: `frontend/src/components/layout/GroupSelector.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: `GroupSelector`**

```tsx
import { useCurrentGroup } from '../../hooks/useCurrentGroup';
import { useAppStore } from '../../store/useAppStore';

export function GroupSelector() {
  const { groups, currentGroupId } = useCurrentGroup();
  const setCurrentGroupId = useAppStore((s) => s.setCurrentGroupId);
  if (groups.length <= 1) return null;            // одна группа — селектор не нужен
  return (
    <select
      value={currentGroupId ?? ''}
      onChange={(e) => setCurrentGroupId(Number(e.target.value))}
      className="text-sm bg-transparent border rounded px-2 py-1"
      aria-label="Выбрать группу"
    >
      {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
    </select>
  );
}
```

- [ ] **Step 2: Вставить в `Header.tsx`**

Импортировать и отрендерить `<GroupSelector />` в правой части хедера (рядом с админ-бейджем, ~L34-40).

- [ ] **Step 3: Type-check + dev-сборка**

Run: `cd frontend && npm run type-check && npm run build`
Expected: 0 ошибок, сборка успешна.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/GroupSelector.tsx frontend/src/components/layout/Header.tsx
git commit -m "feat(fe): group selector in header"
```

---

### Task 3.5: Sweep — group-scoped `user?.isAdmin` → `useIsGroupAdmin()`

**Files (group-scoped, из разведки):**
- `frontend/src/pages/MenuPage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/components/menu/VirtualMenuList.tsx` (проп `isAdmin`)
- `frontend/src/components/polls/ActivePollWidget.tsx`
- `frontend/src/components/polls/SimplePollCard.tsx`
- `frontend/src/components/polls/RecurringPollBadge.tsx`
- `frontend/src/components/voting/InlineVotingCard.tsx`
- `frontend/src/components/budget/BudgetWidgetWithCalculator.tsx`
- `frontend/src/components/home/HomeEmptyStateCard.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/hooks/useSuggestions.ts`

**НЕ трогать (чисто супер-админ):**
- `frontend/src/pages/AdminDashboardPage.tsx` (список всех юзеров/групп)
- `frontend/src/components/admin/UserManagementCard.tsx` (toggle isAdmin)
- `frontend/src/services/admin.service.ts`, `user.service.ts`, `mockApi.service.ts`

- [ ] **Step 1: Перечислить все вхождения**

Run: `cd frontend && grep -rn "isAdmin" src/ --include=*.tsx --include=*.ts`
Expected: полный список; сверить с разбивкой выше.

- [ ] **Step 2: Заменять по файлу (паттерн)**

В каждом group-scoped файле: добавить `const isGroupAdmin = useIsGroupAdmin();` и заменить `user?.isAdmin` → `isGroupAdmin` в местах, отвечающих за group-функции (создание/редактирование меню, управление голосованием, модерация предложки). Пример (MenuPage):

```tsx
// было: {user?.isAdmin && (<AddMenuItemButton/>)}
const isGroupAdmin = useIsGroupAdmin();
// стало: {isGroupAdmin && (<AddMenuItemButton/>)}
```

Для компонентов, принимающих `isAdmin` пропом (`VirtualMenuList`, `HomeEmptyStateCard`) — передавать `isGroupAdmin` из родителя, проп не переименовывать.

> Делать по одному файлу = один коммит. После каждого — `npm run type-check`.

- [ ] **Step 3: Убрать хардкод `groupId || 1` в создании голосования (фронт)**

В `frontend/src/hooks/usePolls.ts:226` заменить `groupId: data.groupId || 1` на обязательный `data.groupId` из `currentGroupId`; вызовы `createPoll` передают `currentGroupId`. Аналогично `userGroups[0]?.id` в HomePage заменить на `currentGroupId` из `useCurrentGroup`.

- [ ] **Step 4: Финальный type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: 0 ошибок, сборка успешна.

- [ ] **Step 5: Commit (по файлам или одним)**

```bash
git add frontend/src/
git commit -m "feat(fe): group-scoped admin gating via useIsGroupAdmin"
```

---

## PHASE 4 — Раскатка

### Task 4.1: Финальная проверка локально

- [ ] **Step 1: Бэкенд — все тесты**

Run: `cd backend && npm test`
Expected: всё зелёное.

- [ ] **Step 2: Фронт — type-check + build**

Run: `cd frontend && npm run type-check && npm run build`
Expected: 0 ошибок, успешная сборка.

- [ ] **Step 3: Ручной прогон (PROD-DEV или dev)**

Сценарии (см. критерии успеха в spec):
1. Новая группа → добавивший видит «Добавить блюдо», меню пустое.
2. Создал блюдо в группе A → в группе B его нет (переключить селектором).
3. Не-админ группы не видит админ-кнопок; супер-админ видит всё.

- [ ] **Step 4: Commit (если были правки)**

```bash
git add -A && git commit -m "test(multitenant): manual verification fixes" || echo "nothing to commit"
```

---

### Task 4.2: Прод-миграция + деплой

> ⚠️ Деструктивно: обнуляет меню офиса + `menu_item_id` прошлых голосований. Подтверждено владельцем.

- [ ] **Step 1: Бэкап прод-БД**

На VPS: снять дамп PostgreSQL (`pg_dump`) перед миграцией. Сохранить дату/путь.

- [ ] **Step 2: Применить миграцию на проде**

`migrate deploy` подхватит `<TS>_per_group_menu`. Убедиться, что в SQL только то, что в Task 1.2 (data-wipe + column add).

- [ ] **Step 3: Деплой кода**

Запустить `./update-vps.sh` (учесть известные грабли: devDeps выпиливаются → build; см. memory `project_vps_deploy_gotchas`).

- [ ] **Step 4: Smoke на проде**

- Health-эндпоинт жив; бот online.
- Завести меню заново в группе офиса.
- Проверить: новая тестовая группа стартует пустой; добавивший — админ своей группы.

- [ ] **Step 5: Commit/push финал**

```bash
git push origin main
```

---

## Self-Review (выполнено при написании)

- **Покрытие спеки:** A (данные/миграция) → Task 1.1–1.2; убрать сид → 1.7. B (per-group + super-admin) → 2.1–2.3. C (селектор + гейтинг + groupId proboros) → 3.1–3.5; кэш per-group → 1.4. D (фазы/раскатка) → Phase 4. Все 6 критериев успеха адресованы.
- **Типы:** `groupId: number` консистентно во всех слоях; `UserGroup`/`GroupRole` едины (auth.types.ts) и используются в хуках/селекторе; `groupAdminMiddleware` имя совпадает в routes (2.2) и middleware (2.1); ключ кэша `menu_items_active:<groupId>` одинаков в service и invalidator (1.4 Step 5).
- **Открытые места (требуют чтения текущего кода исполнителем):** точная константа ключа кэша в `cache.service.ts`; существующий контроллер за `getUserGroups` (Task 2.3); наличие/отсутствие бэкенд-дефолта `groupId` (Task 2.4) — каждое оформлено как «найти grep'ом → применить», без слепых допущений.
- **Деструктив:** изолирован в Task 1.2 (локально) и 4.2 (прод, с бэкапом).
