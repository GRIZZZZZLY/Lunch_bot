# Per-Group Dish Create + Menu Group Label — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a dish into several of THEIR groups at once (one independent copy per group), show which group the Menu page is displaying, and make the activity toggle's group scope explicit.

**Architecture:** Approach 1 — copies on create. No schema change. Backend `POST /menu` takes `groupIds: number[]`, asserts admin on every group (all-or-nothing) via the existing `GroupService.assertAdmin`, then creates one `MenuItem` per group with `createManyAndReturn`. Frontend create form offers a multi-select of the user's ADMIN groups (filtered by `UserGroup.role`), the Menu page header shows/switches the current group, and per-group activity reuses the existing `isActive` toggle.

**Tech Stack:** TypeScript, Express, Prisma 7.3 (Postgres), Zod, React, React Query, Zustand, Jest (backend, mocked Prisma), Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-06-02-per-group-dish-create-design.md`

---

## File Structure

- `backend/src/services/menu.service.ts` — new `createMenuItemForGroups`.
- `backend/src/api/middleware/validation.ts` — create schema uses `groupIds`.
- `backend/src/api/controllers/menu.controller.ts` — `createItem` multi-group.
- `backend/src/api/routes/menu.routes.ts` — drop `groupAdminMiddleware` from `POST /`.
- `frontend/src/lib/groups.ts` — `getAdminGroups` pure helper.
- `frontend/src/services/menu.service.ts` — `createItem(data, groupIds)` → returns `MenuItem[]`.
- `frontend/src/hooks/queries/useMenuQueries.ts` — `useCreateMenuItem` takes `{ data, groupIds }`.
- `frontend/src/components/menu/MenuForm.tsx` — admin-group multi-select (create mode) + explicit activity label.
- `frontend/src/pages/MenuPage.tsx` — group header/switcher + wire multi-group create.
- Tests: `backend/src/__tests__/unit/services/menu-multigroup.service.test.ts`, `frontend/src/lib/groups.test.ts`.

**Task ordering note:** The frontend service, mutation, form, and page changes are mutually dependent — changing the mutation signature alone would break `MenuPage`'s type-check. They are therefore shipped together in one task (Task 3) so every commit type-checks. Task 1 (backend) and Task 2 (pure helper) are independent and ship first.

**Backend tests without a DB:** Jest `globalSetup` does a real `prisma db push --force-reset`. All backend tests here mock Prisma, so bypass it with a throwaway no-op setup created once:
```bash
cd backend && printf 'module.exports = async () => {};\n' > .noop-global-setup.js
```
Backend test-run steps pass `--globalSetup=./.noop-global-setup.js`. NEVER `git add` it; the final task deletes it.

---

## Task 1: Backend — create dish into multiple groups

**Files:**
- Modify: `backend/src/services/menu.service.ts`
- Modify: `backend/src/api/middleware/validation.ts`
- Modify: `backend/src/api/controllers/menu.controller.ts`
- Modify: `backend/src/api/routes/menu.routes.ts`
- Test: `backend/src/__tests__/unit/services/menu-multigroup.service.test.ts`

- [ ] **Step 1: Create the no-op global setup helper (if missing)**

Run:
```bash
cd backend && printf 'module.exports = async () => {};\n' > .noop-global-setup.js
```

- [ ] **Step 2: Write the failing service test**

Create `backend/src/__tests__/unit/services/menu-multigroup.service.test.ts`:

```typescript
import { MenuService } from '../../../services/menu.service';
import { GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    menuItem: { createManyAndReturn: jest.fn() },
    groupMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/cache.service', () => ({
  CacheInvalidator: { invalidateMenu: jest.fn() },
  cacheService: { getOrSet: jest.fn() },
  CACHE_KEYS: { MENU_ITEMS_ACTIVE: 'menu_items_active' },
  CACHE_TTL: { MENU_ITEMS_ACTIVE: 300 },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

const USER = 7;
const BASE = { name: 'Пицца', description: undefined, price: 500, imageUrl: undefined, isActive: true };

// admin only of group 1
function adminOfGroup1() {
  prisma.groupMember.findFirst.mockImplementation(({ where }: any) =>
    Promise.resolve(where.groupId === 1 ? { id: 1 } : null),
  );
}

describe('MenuService.createMenuItemForGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one copy per group when the user is admin of all', async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 }); // admin of any group
    prisma.menuItem.createManyAndReturn.mockResolvedValue([
      { id: 10, groupId: 1, name: 'Пицца' },
      { id: 11, groupId: 2, name: 'Пицца' },
    ]);

    const result = await MenuService.createMenuItemForGroups(BASE, USER, [1, 2]);

    expect(result).toHaveLength(2);
    const arg = prisma.menuItem.createManyAndReturn.mock.calls[0][0];
    expect(arg.data).toHaveLength(2);
    expect(arg.data.map((d: any) => d.groupId).sort()).toEqual([1, 2]);
    expect(arg.data.every((d: any) => d.createdBy === USER)).toBe(true);
  });

  it('creates nothing and throws if the user is not admin of one of the groups', async () => {
    adminOfGroup1();
    await expect(MenuService.createMenuItemForGroups(BASE, USER, [1, 2])).rejects.toBeInstanceOf(
      GroupAccessError,
    );
    expect(prisma.menuItem.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('dedupes group ids', async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
    prisma.menuItem.createManyAndReturn.mockResolvedValue([{ id: 10, groupId: 1 }]);

    await MenuService.createMenuItemForGroups(BASE, USER, [1, 1]);

    const arg = prisma.menuItem.createManyAndReturn.mock.calls[0][0];
    expect(arg.data).toHaveLength(1);
  });

  it('throws when groupIds is empty', async () => {
    await expect(MenuService.createMenuItemForGroups(BASE, USER, [])).rejects.toThrow();
    expect(prisma.menuItem.createManyAndReturn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/menu-multigroup.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — `createMenuItemForGroups` is not a function.

- [ ] **Step 4: Implement `createMenuItemForGroups`**

In `backend/src/services/menu.service.ts`, add this method to the `MenuService` class (right after the existing `createMenuItem`). `GroupService`, `CacheInvalidator`, `logger`, `prisma`, and `MenuItem` are already imported.

```typescript
/**
 * Создать блюдо сразу в нескольких группах (Approach 1: независимые копии).
 * Проверяет права админа по КАЖДОЙ группе ДО создания (all-or-nothing): если
 * пользователь не админ хотя бы одной — не создаём ничего. Возвращает копии.
 */
static async createMenuItemForGroups(
  data: { name: string; description?: string; price?: number; imageUrl?: string; isActive?: boolean },
  actingUserId: number,
  groupIds: number[],
): Promise<MenuItem[]> {
  const uniqueGroupIds = [...new Set(groupIds)];
  if (uniqueGroupIds.length === 0) {
    throw new Error('At least one group is required');
  }

  // Сперва проверяем права на ВСЕ группы — иначе частичное создание.
  for (const groupId of uniqueGroupIds) {
    await GroupService.assertAdmin(actingUserId, groupId);
  }

  const created = await prisma.menuItem.createManyAndReturn({
    data: uniqueGroupIds.map((groupId) => ({
      name: data.name,
      description: data.description,
      price: data.price,
      imageUrl: data.imageUrl,
      isActive: data.isActive ?? true,
      createdBy: actingUserId,
      groupId,
    })),
  });

  for (const groupId of uniqueGroupIds) {
    CacheInvalidator.invalidateMenu(groupId);
  }

  logger.info('Menu item created in groups', {
    count: created.length,
    groupIds: uniqueGroupIds,
    createdBy: actingUserId,
  });
  return created;
}
```

- [ ] **Step 5: Run the service test to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/menu-multigroup.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (4 tests).

- [ ] **Step 6: Switch the create validation schema to `groupIds`**

In `backend/src/api/middleware/validation.ts`, replace `createMenuItemSchema` and the `updateMenuItemSchema` line with:

```typescript
const createMenuItemSchema = z.object({
  // Multi-group create: одна или несколько админских групп пользователя.
  groupIds: z.array(z.number().int().positive('Group ID must be positive')).min(1, 'At least one group is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional().or(z.literal('')),
  price: z.number().min(0, 'Price cannot be negative').optional(),
  imageUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

// На обновлении групп нет — редактирование пер-копийное (одна группа).
const updateMenuItemSchema = createMenuItemSchema.partial().omit({ groupIds: true });
```

- [ ] **Step 7: Rewrite the controller `createItem` for multi-group**

In `backend/src/api/controllers/menu.controller.ts`, replace the `createItem` handler with:

```typescript
static async createItem(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const groupIds: number[] = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
    if (groupIds.length === 0) {
      res.status(400).json({ success: false, error: 'groupIds is required', code: 'MISSING_GROUP_ID' });
      return;
    }

    const items = await MenuService.createMenuItemForGroups(
      {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        imageUrl: req.body.imageUrl,
        isActive: req.body.isActive,
      },
      user.id,
      groupIds,
    );

    logger.info('Menu items created', { count: items.length, by: user.id });
    res.status(201).json({
      success: true,
      data: items.map(serializeMenuItem),
      count: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendMenuError(res, error, 'Failed to create menu item', 'INTERNAL_ERROR');
  }
}
```

`sendMenuError` maps `GroupAccessError` → 403 (already present). If `CreateMenuItemData` is now unused in this file, remove it from the top-of-file import (keep `UpdateMenuItemData`) to avoid a tsc unused-import error. If `resolveGroupId` is now unused (only `createItem` used it), remove that helper too — but FIRST grep the file: it may still be used by read handlers; only remove if genuinely unused.

- [ ] **Step 8: Drop `groupAdminMiddleware` from the create route**

In `backend/src/api/routes/menu.routes.ts`, change the `POST /` route (authorization now per-group inside the service):

```typescript
router.post(
  '/',
  telegramAuthMiddleware,
  validateMenuItemData,
  menuController.createItem
);
```

Leave the other routes (`PUT /:id`, `PATCH /:id/toggle`, `DELETE /:id`, `PATCH /bulk-status`) unchanged. If `groupAdminMiddleware` is now imported-but-unused, keep the import only if other routes still use it (they do) — no change to the import.

- [ ] **Step 9: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS. Fix any unused-import error per Step 7.

- [ ] **Step 10: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/menu.service.ts telegram-food-bot/backend/src/api/middleware/validation.ts telegram-food-bot/backend/src/api/controllers/menu.controller.ts telegram-food-bot/backend/src/api/routes/menu.routes.ts telegram-food-bot/backend/src/__tests__/unit/services/menu-multigroup.service.test.ts && git commit -m "feat(menu): create dish into multiple admin groups (POST /menu groupIds[])

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend — admin-groups helper (TDD)

**Files:**
- Create: `frontend/src/lib/groups.ts`
- Test: `frontend/src/lib/groups.test.ts`

- [ ] **Step 1: Write the failing Vitest test**

Create `frontend/src/lib/groups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAdminGroups } from './groups';
import type { UserGroup } from '../types/auth.types';

const g = (id: number, role: UserGroup['role']): UserGroup => ({
  id,
  title: `G${id}`,
  role,
  isActive: true,
});

describe('getAdminGroups', () => {
  it('keeps only ADMIN and CREATOR groups', () => {
    const groups = [g(1, 'CREATOR'), g(2, 'ADMIN'), g(3, 'MEMBER')];
    expect(getAdminGroups(groups).map((x) => x.id)).toEqual([1, 2]);
  });

  it('returns empty when the user admins nothing', () => {
    expect(getAdminGroups([g(1, 'MEMBER')])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(getAdminGroups([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd frontend && npx vitest run src/lib/groups.test.ts
```
Expected: FAIL — `./groups` / `getAdminGroups` does not exist.

- [ ] **Step 3: Implement the helper**

Create `frontend/src/lib/groups.ts`:

```typescript
import type { UserGroup } from '../types/auth.types';

/**
 * Группы, где текущий пользователь — админ группы (ADMIN или CREATOR).
 * Используется для мультивыбора при создании блюда: чужие группы не показываем.
 * Глобальный User.isAdmin здесь НЕ учитывается — доступ к группе только по роли.
 */
export function getAdminGroups(groups: UserGroup[]): UserGroup[] {
  return groups.filter((group) => group.role === 'ADMIN' || group.role === 'CREATOR');
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd frontend && npx vitest run src/lib/groups.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/frontend/src/lib/groups.ts telegram-food-bot/frontend/src/lib/groups.test.ts && git commit -m "feat(menu-fe): getAdminGroups helper (admin-only group list)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend — wire multi-group create (service + mutation + form + page)

All four files change together so the type-check passes at commit time.

**Files:**
- Modify: `frontend/src/services/menu.service.ts`
- Modify: `frontend/src/hooks/queries/useMenuQueries.ts`
- Modify: `frontend/src/components/menu/MenuForm.tsx`
- Modify: `frontend/src/pages/MenuPage.tsx`

- [ ] **Step 1: Service `createItem` → multi-group**

In `frontend/src/services/menu.service.ts`, replace the `createItem` method:

```typescript
async createItem(data: CreateMenuItemData, groupIds: number[]): Promise<ApiResponse<MenuItem[]>> {
  try {
    logger.debug('[MenuService] createItem called', {
      useMockApi: USE_MOCK_API,
      hasToken: !!apiService.getToken(),
      groupIds,
    });

    if (USE_MOCK_API) {
      const { mockApiService } = await import('./mockApi.service');
      const single = await mockApiService.createMenuItem(data);
      return { ...single, data: single.data ? [single.data] : [] } as ApiResponse<MenuItem[]>;
    }

    return await apiService.post<MenuItem[]>('/menu', { ...data, groupIds });
  } catch (error) {
    logger.error('[MenuService] createItem error:', error);
    throw error;
  }
}
```

- [ ] **Step 2: Mutation `useCreateMenuItem` → `{ data, groupIds }`**

In `frontend/src/hooks/queries/useMenuQueries.ts`, replace `useCreateMenuItem`:

```typescript
export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (vars: { data: CreateMenuItemData; groupIds: number[] }) => {
      const response = await menuService.createItem(vars.data, vars.groupIds);
      if (!response.success) {
        throw new Error(response.error || 'Failed to create menu item');
      }
      return response.data;
    },
    onSuccess: () => {
      // Создание могло затронуть несколько групп — сбрасываем весь menu-кэш.
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });
      toast.success('Menu item created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
};
```

If `useCurrentGroup` import becomes unused in this file after the change, remove it (keep it if other mutations in the file still use it — grep first).

- [ ] **Step 3: MenuForm — `groupIds` + group multi-select (create mode) + explicit activity label**

In `frontend/src/components/menu/MenuForm.tsx`:

(a) Replace the props + form-data interfaces:

```typescript
export interface MenuFormProps {
  onSubmit: (data: MenuFormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  item?: MenuItem; // For edit mode
  /** Admin groups available for multi-create (create mode only). */
  adminGroups?: { id: number; title: string }[];
  /** Group pre-checked by default in create mode. */
  defaultGroupId?: number | null;
}

export interface MenuFormData {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive: boolean;
  groupIds: number[];
}
```

(b) Accept the new props in the component signature:

```typescript
export const MenuForm: React.FC<MenuFormProps> = ({
  onSubmit,
  onClose,
  loading = false,
  item,
  adminGroups = [],
  defaultGroupId = null,
}) => {
```

(c) Initialize `groupIds` in form state:

```typescript
const [formData, setFormData] = useState<MenuFormData>({
  name: item?.name ?? '',
  description: item?.description ?? '',
  price: item?.price ?? undefined,
  imageUrl: item?.imageUrl ?? '',
  isActive: item?.isActive ?? true,
  groupIds: defaultGroupId != null ? [defaultGroupId] : [],
});
```

(d) Add a toggle helper next to the other handlers:

```typescript
const toggleGroup = (groupId: number) => {
  setFormData((prev) => {
    const has = prev.groupIds.includes(groupId);
    return {
      ...prev,
      groupIds: has ? prev.groupIds.filter((id) => id !== groupId) : [...prev.groupIds, groupId],
    };
  });
};
```

(e) In `handleSubmit`, after the existing `validateForm()` failure check, block create with no group:

```typescript
if (!item && formData.groupIds.length === 0) {
  showAlert('Выбери хотя бы одну группу');
  return;
}
```

(f) Render the selector ONLY in create mode with >1 admin group, just above the activity toggle `GlassCard`:

```tsx
{!item && adminGroups.length > 1 && (
  <GlassCard intensityLevel="medium">
    <GlassCardContent className="p-4 space-y-3">
      <Label className="text-base font-semibold text-foreground">В группах</Label>
      <p className="text-sm text-muted-foreground">Блюдо будет создано в каждой выбранной группе</p>
      <div className="space-y-2">
        {adminGroups.map((group) => (
          <div key={group.id} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{group.title}</span>
            <Switch
              checked={formData.groupIds.includes(group.id)}
              onCheckedChange={() => toggleGroup(group.id)}
            />
          </div>
        ))}
      </div>
    </GlassCardContent>
  </GlassCard>
)}
```

(g) Make the activity label explicit — replace the activity `Label`/description text:

```tsx
<Label htmlFor="isActive" className="text-base font-semibold text-foreground">
  Активно
</Label>
<p className="text-sm text-muted-foreground">
  Участвует в голосованиях группы
</p>
```

- [ ] **Step 4: MenuPage — group switcher header + admin groups + send groupIds**

In `frontend/src/pages/MenuPage.tsx`:

(a) Add imports near the existing ones:

```typescript
import { useCurrentGroup } from '../hooks/useCurrentGroup';
import { getAdminGroups } from '../lib/groups';
```

(b) Inside the component, derive group data:

```typescript
const { currentGroupId, groups, currentGroup } = useCurrentGroup();
const setCurrentGroupId = useAppStore((state) => state.setCurrentGroupId);
const adminGroups = getAdminGroups(groups);
```

(c) Replace the header title block (`<h1>Меню</h1>` + the count `<p>`) — keep the surrounding flex container and the admin "+" button:

```tsx
<div>
  <h1 className="text-2xl font-bold text-foreground">Меню</h1>
  {groups.length > 1 ? (
    <select
      value={currentGroupId ?? ''}
      onChange={(e) => setCurrentGroupId(Number(e.target.value))}
      className="mt-0.5 bg-transparent text-sm text-muted-foreground focus:outline-none"
      aria-label="Выбрать группу"
    >
      {groups.map((grp) => (
        <option key={grp.id} value={grp.id}>{grp.title}</option>
      ))}
    </select>
  ) : (
    <p className="text-sm text-muted-foreground">{currentGroup?.title ?? ''}</p>
  )}
</div>
```

(d) Pass admin groups + default to the create form:

```tsx
<MenuForm
  onSubmit={handleCreateItem}
  onClose={() => setShowCreateForm(false)}
  loading={isCreating}
  adminGroups={adminGroups.map((grp) => ({ id: grp.id, title: grp.title }))}
  defaultGroupId={currentGroupId}
/>
```

(e) Replace `handleCreateItem` to pass `{ data, groupIds }` (the mutation's success payload is now `MenuItem[]`):

```typescript
const handleCreateItem = async (formData: MenuFormData) => {
  haptic.impact();
  trackEvent(ANALYTICS_EVENTS.MENU_ITEM_CREATE_STARTED);

  const { groupIds, ...data } = formData;
  createItemMutation(
    { data, groupIds },
    {
      onSuccess: (items) => {
        haptic.notification('success');
        addNotification({
          type: 'success',
          message: `Блюдо добавлено${items && items.length > 1 ? ` в ${items.length} групп` : ''}`,
          duration: 3000,
        });
        refetchMenu();
        setShowCreateForm(false);
        trackEvent(ANALYTICS_EVENTS.MENU_ITEM_CREATED, { count: items?.length ?? 0 });
      },
      onError: () => {
        haptic.notification('error');
        addNotification({ type: 'error', message: 'Ошибка при добавлении блюда', duration: 3000 });
      },
    },
  );
};
```

(`MenuFormData` imported in MenuPage now includes `groupIds`. Ensure `MenuFormData` is imported from `../components/menu/MenuForm`.)

- [ ] **Step 5: Type-check the frontend**

Run:
```bash
cd frontend && npm run type-check
```
Expected: PASS (no errors). Fix any remaining mismatches (mutation variable shape, `items` param type, the `ANALYTICS_EVENTS.MENU_ITEM_CREATED` payload type) until clean.

- [ ] **Step 6: Build the frontend**

Run:
```bash
cd frontend && npm run build
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/frontend/src/services/menu.service.ts telegram-food-bot/frontend/src/hooks/queries/useMenuQueries.ts telegram-food-bot/frontend/src/components/menu/MenuForm.tsx telegram-food-bot/frontend/src/pages/MenuPage.tsx && git commit -m "feat(menu-fe): multi-group create selector + menu group switcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Verification + cleanup

**Files:** none (verification only)

- [ ] **Step 1: Backend build + the new unit suite**

Run:
```bash
cd backend && npm run build && npx jest src/__tests__/unit/services/menu-multigroup.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: build clean; 4/4 tests pass.

- [ ] **Step 2: Frontend type-check + build + helper test**

Run:
```bash
cd frontend && npm run type-check && npm run build && npx vitest run src/lib/groups.test.ts
```
Expected: type-check clean; build clean; 3/3 helper tests pass.

- [ ] **Step 3: Remove the throwaway no-op setup**

Run:
```bash
cd backend && rm -f .noop-global-setup.js
```
Confirm not staged: `git status --short backend/.noop-global-setup.js` shows nothing.

- [ ] **Step 4: Final status check**

Run:
```bash
cd e:/Launch_bot && git status --short
```
Confirm only intended changes are committed and no stray `.noop-global-setup.js` remains.

---

## Done criteria

- `POST /menu` accepts `groupIds[]`, creates one copy per group, asserts admin per group (all-or-nothing → 403 + nothing created if any group is not the user's). Backend build green, 4/4 unit tests pass.
- Create form shows a multi-select of ONLY the user's admin groups (when >1) with the current group pre-checked; single-admin-group users see no selector and create in their one group.
- Activity toggle label is explicit ("Активно / Участвует в голосованиях группы").
- Menu page header shows the current group and (multi-group) switches it, reloading that group's menu.
- Frontend type-check + build green; helper unit test passes.
- No schema/migration. No `.noop-global-setup.js` committed.
- Deploy via the established flow (push → discard VPS `dist/index.html` → `update-vps.sh` → health). No migration.
```
