# Group Isolation Security Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 5 confirmed cross-group access-control holes so a user can only read/write data of groups they actually belong to.

**Architecture:** Authorization is enforced through `GroupService` authz primitives (Approach B — `GroupService` is the single authz authority). Writes scope by the resource's real `groupId` inside the service; reads assert membership at the controller boundary (internal trusted callers like bot/poll must NOT be gated, so read services keep their current signatures). The global `isAdmin` super-admin bypass is removed from all group-scoped checks; only per-group role (`group_members`) decides. The separate global admin panel is untouched.

**Tech Stack:** TypeScript, Express, Prisma 7.3 (Postgres), grammY (Telegram), Jest (ts-jest) with mocked Prisma.

**Spec:** `docs/superpowers/specs/2026-06-02-group-isolation-security-design.md`

---

## Conscious deviation from spec

The spec said "read services take `userId` + assertMember". Caller analysis shows read methods (`getActiveMenuItems`, `getPopularMenuItems`, `getMenuStats`) have 5+ internal callers (`bot/commands/startpoll.ts`, `bot/commands/menu.ts`, `api/controllers/poll.controller.ts`, `services/recurring-poll.service.ts`) that have no requesting-user. Gating those would break them. Therefore **read membership is asserted in the menu controller** (calling `GroupService.assertMember`), leaving read service signatures unchanged. Write methods are called only by `menu.controller`, so write scoping goes into the service as designed.

---

## File Structure

- `backend/src/services/group.service.ts` — add `GroupAccessError`, `assertMember`, `assertAdmin`, `verifyTelegramMembership`, `addMemberFromStartParam`.
- `backend/src/api/controllers/auth.controller.ts` — verified join via `addMemberFromStartParam`.
- `backend/src/services/menu.service.ts` — write methods take `actingUserId`, assert admin on the item's real group, scope writes by `groupId`, never re-parent.
- `backend/src/api/controllers/menu.controller.ts` — pass `user.id` to writes; assert membership before reads; map `GroupAccessError` → 403.
- `backend/src/api/middleware/validation.ts` — drop `groupId` from the update schema.
- `backend/src/services/store-run.service.ts` — `getStoreRunById(id, requestingUserId)` membership gate; race-free `autoCloseExpired`.
- `backend/src/api/controllers/store-run.controller.ts` — pass `user.id`.
- Tests: `backend/src/__tests__/unit/services/group-access.test.ts`, `menu-authz.service.test.ts`, `store-run-authz.service.test.ts`, `store-run-autoclose.service.test.ts`, `auth-join.controller.test.ts`.

**Note on running unit tests without a database:** Jest `globalSetup` does a real `prisma db push --force-reset` against Postgres. All tasks mock Prisma, so bypass it with a throwaway no-op global setup:

```bash
cd backend
printf 'module.exports = async () => {};\n' > .noop-global-setup.js
```

Every test-run step uses `--globalSetup=./.noop-global-setup.js`. The file is deleted in the final task and must NEVER be `git add`-ed.

---

## Task 1: GroupService authz primitives

**Files:**
- Modify: `backend/src/services/group.service.ts`
- Test: `backend/src/__tests__/unit/services/group-access.test.ts`

- [ ] **Step 1: Create the no-op global setup helper (once for the whole plan)**

Run:
```bash
cd backend && printf 'module.exports = async () => {};\n' > .noop-global-setup.js
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/__tests__/unit/services/group-access.test.ts`:

```typescript
import { GroupService, GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    groupMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const getChatMember = jest.fn();
jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(() => ({ api: { getChatMember } })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('GroupService authz primitives', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('assertMember', () => {
    it('passes for an active member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
      await expect(GroupService.assertMember(7, 42)).resolves.toBeUndefined();
    });

    it('throws GroupAccessError(NOT_MEMBER) for a non-member', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);
      await expect(GroupService.assertMember(7, 42)).rejects.toMatchObject({
        name: 'GroupAccessError',
        code: 'NOT_MEMBER',
      });
    });
  });

  describe('assertAdmin', () => {
    it('passes for a group admin', async () => {
      prisma.groupMember.findFirst.mockResolvedValue({ id: 1 });
      await expect(GroupService.assertAdmin(7, 42)).resolves.toBeUndefined();
    });

    it('throws GroupAccessError(NOT_ADMIN) for a non-admin', async () => {
      prisma.groupMember.findFirst.mockResolvedValue(null);
      await expect(GroupService.assertAdmin(7, 42)).rejects.toMatchObject({
        name: 'GroupAccessError',
        code: 'NOT_ADMIN',
      });
    });
  });

  describe('verifyTelegramMembership', () => {
    it('returns true when Telegram status is member/admin/creator', async () => {
      getChatMember.mockResolvedValue({ status: 'member' });
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(true);
    });

    it('returns false (fail closed) when status is left', async () => {
      getChatMember.mockResolvedValue({ status: 'left' });
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(false);
    });

    it('returns false (fail closed) when getChatMember throws', async () => {
      getChatMember.mockRejectedValue(new Error('Bad Request: user not found'));
      await expect(GroupService.verifyTelegramMembership(100n, 200n)).resolves.toBe(false);
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/group-access.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — `GroupAccessError` / `assertMember` / `assertAdmin` / `verifyTelegramMembership` not exported.

- [ ] **Step 4: Implement the primitives**

In `backend/src/services/group.service.ts`, add this import near the top imports:

```typescript
import { getBotInstance } from '../bot/bot-instance';
```

Add the error class ABOVE `export class GroupService {`:

```typescript
/**
 * Группо-ориентированный отказ доступа. Маппится контроллерами в HTTP 403.
 * Намеренно НЕ учитывает глобальный isAdmin — доступ к данным группы решает
 * только роль в group_members.
 */
export class GroupAccessError extends Error {
  constructor(
    public code: 'NOT_MEMBER' | 'NOT_ADMIN',
    message: string,
  ) {
    super(message);
    this.name = 'GroupAccessError';
  }
}
```

Add these methods inside `GroupService` (e.g. after `isUserGroupAdmin`):

```typescript
/**
 * Бросает GroupAccessError('NOT_MEMBER'), если пользователь не активный
 * участник группы. Без обхода по глобальному isAdmin.
 */
static async assertMember(userId: number, groupId: number): Promise<void> {
  const ok = await this.isUserGroupMember(userId, groupId);
  if (!ok) {
    throw new GroupAccessError('NOT_MEMBER', 'You are not a member of this group');
  }
}

/**
 * Бросает GroupAccessError('NOT_ADMIN'), если пользователь не админ группы.
 * Без обхода по глобальному isAdmin.
 */
static async assertAdmin(userId: number, groupId: number): Promise<void> {
  const ok = await this.isUserGroupAdmin(userId, groupId);
  if (!ok) {
    throw new GroupAccessError('NOT_ADMIN', 'Group admin access required');
  }
}

/**
 * Источник истины о членстве — Telegram. true только если пользователь
 * реально в группе (creator/administrator/member). FAIL CLOSED: при любой
 * ошибке или отсутствии бота возвращает false (членство не подтверждено).
 */
static async verifyTelegramMembership(
  groupTelegramId: bigint,
  userTelegramId: bigint,
): Promise<boolean> {
  const bot = getBotInstance();
  if (!bot) {
    logger.warn('verifyTelegramMembership: bot not initialized — fail closed', {
      groupTelegramId: groupTelegramId.toString(),
    });
    return false;
  }
  try {
    const member = await bot.api.getChatMember(
      Number(groupTelegramId),
      Number(userTelegramId),
    );
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (err) {
    logger.warn('verifyTelegramMembership: getChatMember failed — fail closed', {
      groupTelegramId: groupTelegramId.toString(),
      userTelegramId: userTelegramId.toString(),
      err,
    });
    return false;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/group-access.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/group.service.ts telegram-food-bot/backend/src/__tests__/unit/services/group-access.test.ts && git commit -m "feat(security): GroupService authz primitives (assertMember/assertAdmin/verifyTelegramMembership)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: F1 — verified group join via start_param

**Files:**
- Modify: `backend/src/services/group.service.ts` (add `addMemberFromStartParam`)
- Modify: `backend/src/api/controllers/auth.controller.ts`
- Test: `backend/src/__tests__/unit/services/group-access.test.ts` (extend)

- [ ] **Step 1: Add the failing test**

Append to `backend/src/__tests__/unit/services/group-access.test.ts` a new `describe` (inside the top-level describe). First extend the prisma mock at the top of the file to include `groupMember.upsert` — change the `jest.mock('../../../database/client', ...)` block to:

```typescript
jest.mock('../../../database/client', () => ({
  prisma: {
    groupMember: { findFirst: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
  },
}));
```

Then add:

```typescript
describe('addMemberFromStartParam', () => {
  const group = { id: 42, telegramId: 100n };
  const user = { id: 7, telegramId: 200n };

  it('adds membership when Telegram verifies the user', async () => {
    getChatMember.mockResolvedValue({ status: 'member' });
    prisma.groupMember.findUnique.mockResolvedValue(null);
    prisma.groupMember.upsert.mockResolvedValue({ id: 1, groupId: 42, userId: 7 });

    const result = await GroupService.addMemberFromStartParam(group, user);

    expect(result).toBe(true);
    expect(prisma.groupMember.upsert).toHaveBeenCalledTimes(1);
  });

  it('does NOT add membership when Telegram says the user is not in the group', async () => {
    getChatMember.mockResolvedValue({ status: 'left' });

    const result = await GroupService.addMemberFromStartParam(group, user);

    expect(result).toBe(false);
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/group-access.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — `addMemberFromStartParam` is not a function.

- [ ] **Step 3: Implement `addMemberFromStartParam`**

Add to `GroupService` (after `verifyTelegramMembership`):

```typescript
/**
 * Безопасное добавление участника по start_param: сперва проверяем членство
 * в Telegram, и только при подтверждении пишем group_members. Не подтверждён
 * — членство не создаём (возвращаем false), запрос вызывающего не падает.
 */
static async addMemberFromStartParam(
  group: { id: number; telegramId: bigint },
  user: { id: number; telegramId: bigint },
): Promise<boolean> {
  const verified = await this.verifyTelegramMembership(group.telegramId, user.telegramId);
  if (!verified) {
    logger.warn('start_param join rejected: not a Telegram member', {
      userId: user.id,
      groupId: group.id,
    });
    return false;
  }
  await this.addMemberToGroup(group.id, user.id);
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/group-access.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (9 tests).

- [ ] **Step 5: Wire it into auth.controller.ts**

In `backend/src/api/controllers/auth.controller.ts`, replace the start_param block (the one calling `GroupService.addMemberToGroup(groupId, user.id)`) with:

```typescript
// Auto-add membership when launched via group deep-link — ONLY if Telegram
// confirms the user is actually in that group (no self-granted membership).
const startParam = params.get('start_param');
if (startParam) {
  const groupId = await resolveGroupIdFromStartParam(startParam);
  if (groupId) {
    try {
      const group = await GroupService.getGroupById(groupId);
      if (group) {
        const added = await GroupService.addMemberFromStartParam(
          { id: group.id, telegramId: group.telegramId },
          { id: user.id, telegramId: user.telegramId },
        );
        if (added) {
          logger.info('Verified membership via start_param', { userId: user.id, groupId });
        }
      }
    } catch (err) {
      logger.warn('Membership auto-add failed', { userId: user.id, groupId, err });
    }
  }
}
```

(`user` here already carries `telegramId` — it is the validated Telegram user. `getGroupById` returns a `Group` with `telegramId`.)

- [ ] **Step 6: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS (no tsc output).

- [ ] **Step 7: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/group.service.ts telegram-food-bot/backend/src/api/controllers/auth.controller.ts telegram-food-bot/backend/src/__tests__/unit/services/group-access.test.ts && git commit -m "fix(security): F1 — verify Telegram membership before start_param join

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: F2 — menu writes scoped to the item's real group

**Files:**
- Modify: `backend/src/services/menu.service.ts` (`updateMenuItem`, `deleteMenuItem`, `toggleMenuItemStatus`, `bulkUpdateStatus`)
- Modify: `backend/src/api/middleware/validation.ts` (update schema drops `groupId`)
- Modify: `backend/src/api/controllers/menu.controller.ts` (pass `user.id`; map `GroupAccessError`)
- Test: `backend/src/__tests__/unit/services/menu-authz.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/unit/services/menu-authz.service.test.ts`:

```typescript
import { MenuService } from '../../../services/menu.service';
import { GroupAccessError } from '../../../services/group.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    menuItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    groupMember: { findFirst: jest.fn() },
    vote: { updateMany: jest.fn() },
    pollResult: { updateMany: jest.fn() },
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

// admin of group A (groupId=1), item belongs to group B (groupId=2)
const ADMIN_A = 7;
const ITEM_IN_B = { id: 777, groupId: 2 };

function mockAdminOf(groupId: number) {
  // isUserGroupAdmin → findFirst returns truthy only for the admin's own group
  prisma.groupMember.findFirst.mockImplementation(({ where }: any) =>
    Promise.resolve(where.groupId === 1 ? { id: 1 } : null),
  );
}

describe('MenuService write authorization (F2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminOf(1);
  });

  it('updateMenuItem: admin of A cannot edit an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue(ITEM_IN_B);
    await expect(
      MenuService.updateMenuItem(777, { name: 'hacked', groupId: 1 } as any, ADMIN_A),
    ).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('updateMenuItem: admin of own group succeeds, groupId is NOT moved', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ id: 555, groupId: 1 });
    prisma.menuItem.update.mockResolvedValue({ id: 555, groupId: 1, name: 'ok' });

    await MenuService.updateMenuItem(555, { name: 'ok', groupId: 2 } as any, ADMIN_A);

    const arg = prisma.menuItem.update.mock.calls[0][0];
    // scoped by id + groupId
    expect(arg.where).toEqual({ id: 555, groupId: 1 });
    // groupId stripped from data — no re-parenting
    expect(arg.data.groupId).toBeUndefined();
  });

  it('deleteMenuItem: admin of A cannot delete an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ ...ITEM_IN_B, _count: { votes: 0, pollResults: 0 } });
    await expect(MenuService.deleteMenuItem(777, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.delete).not.toHaveBeenCalled();
  });

  it('toggleMenuItemStatus: admin of A cannot toggle an item of B', async () => {
    prisma.menuItem.findUnique.mockResolvedValue({ isActive: true, groupId: 2 });
    await expect(MenuService.toggleMenuItemStatus(777, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('bulkUpdateStatus: rejects if any id belongs to a non-admin group', async () => {
    prisma.menuItem.findMany.mockResolvedValue([{ id: 10, groupId: 1 }, { id: 11, groupId: 2 }]);
    await expect(MenuService.bulkUpdateStatus([10, 11], false, ADMIN_A)).rejects.toBeInstanceOf(GroupAccessError);
    expect(prisma.menuItem.updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/menu-authz.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — methods don't accept `actingUserId` / no authz.

- [ ] **Step 3: Implement scoped writes in menu.service.ts**

Add this import near the top of `backend/src/services/menu.service.ts`:

```typescript
import { GroupService } from './group.service';
```

Replace `updateMenuItem`:

```typescript
static async updateMenuItem(
  id: number,
  data: UpdateMenuItemData,
  actingUserId: number,
): Promise<MenuItem> {
  try {
    const existing = await prisma.menuItem.findUnique({
      where: { id },
      select: { groupId: true },
    });
    if (!existing) {
      throw new Error('Menu item not found');
    }
    await GroupService.assertAdmin(actingUserId, existing.groupId);

    // groupId никогда не меняем через update — запрет переноса блюда в чужую группу.
    const { groupId: _ignored, ...safeData } = data as UpdateMenuItemData & { groupId?: number };

    const menuItem = await prisma.menuItem.update({
      where: { id, groupId: existing.groupId },
      data: {
        ...safeData,
        updatedAt: new Date(),
      },
    });

    CacheInvalidator.invalidateMenu(menuItem.groupId);
    logger.info(`Menu item updated: ${menuItem.id} (${menuItem.name})`);
    return menuItem;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Menu item not found');
    }
    if (error instanceof Error && error.name === 'GroupAccessError') throw error;
    logger.error('Error updating menu item:', error);
    throw new Error('Failed to update menu item');
  }
}
```

Note: `prisma.menuItem.update({ where: { id, groupId } })` requires `where` to accept the composite. `MenuItemWhereUniqueInput` accepts `id` plus additional non-unique filters in Prisma — confirmed available. If tsc complains, use `updateMany({ where: { id, groupId }, data })` then re-fetch; but prefer the unique-with-filter form.

Replace `deleteMenuItem` signature + add the guard at the top (keep existing cleanup logic):

```typescript
static async deleteMenuItem(id: number, actingUserId: number): Promise<void> {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
      include: { _count: { select: { votes: true, pollResults: true } } },
    });
    if (!menuItem) {
      throw new Error('Menu item not found');
    }
    await GroupService.assertAdmin(actingUserId, menuItem.groupId);

    if (menuItem._count.votes > 0 || menuItem._count.pollResults > 0) {
      await prisma.vote.updateMany({ where: { menuItemId: id }, data: { menuItemId: null } });
      await prisma.pollResult.updateMany({ where: { winnerMenuItemId: id }, data: { winnerMenuItemId: null } });
    }

    await prisma.menuItem.delete({ where: { id, groupId: menuItem.groupId } });
    CacheInvalidator.invalidateMenu(menuItem.groupId);
    logger.info(`Menu item deleted: ${id}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'GroupAccessError') throw error;
    logger.error('Error deleting menu item:', error);
    throw new Error('Failed to delete menu item');
  }
}
```

Replace `toggleMenuItemStatus`:

```typescript
static async toggleMenuItemStatus(id: number, actingUserId: number): Promise<MenuItem> {
  try {
    const currentItem = await prisma.menuItem.findUnique({
      where: { id },
      select: { isActive: true, groupId: true },
    });
    if (!currentItem) {
      throw new Error('Menu item not found');
    }
    await GroupService.assertAdmin(actingUserId, currentItem.groupId);

    const updated = await prisma.menuItem.update({
      where: { id, groupId: currentItem.groupId },
      data: { isActive: !currentItem.isActive },
    });
    CacheInvalidator.invalidateMenu(currentItem.groupId);
    return updated;
  } catch (error) {
    if (error instanceof Error && error.name === 'GroupAccessError') throw error;
    logger.error('Error toggling menu item status:', error);
    throw new Error('Failed to toggle menu item status');
  }
}
```

Replace `bulkUpdateStatus`:

```typescript
static async bulkUpdateStatus(
  ids: number[],
  isActive: boolean,
  actingUserId: number,
): Promise<number> {
  try {
    const items = await prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { groupId: true },
    });
    const uniqueGroupIds = [...new Set(items.map((i) => i.groupId))];
    // Все затронутые группы должны быть админскими для вызывающего.
    for (const groupId of uniqueGroupIds) {
      await GroupService.assertAdmin(actingUserId, groupId);
    }

    const result = await prisma.menuItem.updateMany({
      where: { id: { in: ids }, groupId: { in: uniqueGroupIds } },
      data: { isActive, updatedAt: new Date() },
    });

    for (const groupId of uniqueGroupIds) {
      CacheInvalidator.invalidateMenu(groupId);
    }
    return result.count;
  } catch (error) {
    if (error instanceof Error && error.name === 'GroupAccessError') throw error;
    logger.error('Error bulk updating menu items:', error);
    throw new Error('Failed to bulk update menu items');
  }
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/menu-authz.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (5 tests).

- [ ] **Step 5: Drop `groupId` from the update schema**

In `backend/src/api/middleware/validation.ts`, replace:

```typescript
const updateMenuItemSchema = createMenuItemSchema.partial();
```

with:

```typescript
// На обновлении groupId запрещён — блюдо нельзя перенести в другую группу.
const updateMenuItemSchema = createMenuItemSchema.partial().omit({ groupId: true });
```

- [ ] **Step 6: Pass `user.id` to writes in menu.controller.ts**

In `backend/src/api/controllers/menu.controller.ts`, update the four write call-sites:

- `updateItem`: `const item = await MenuService.updateMenuItem(id, data, user.id);`
- `toggleItemStatus`: `const item = await MenuService.toggleMenuItemStatus(id, user.id);`
- `deleteItem`: `await MenuService.deleteMenuItem(id, user.id);`
- `bulkUpdateStatus`: `const updatedCount = await MenuService.bulkUpdateStatus(ids, isActive, user.id);`

Each of these handlers already reads `const user = (req as any).user;`.

- [ ] **Step 7: Map `GroupAccessError` → 403 in every menu controller catch**

Add this import at the top of `menu.controller.ts`:

```typescript
import { GroupAccessError } from '../../services/group.service';
```

Add this helper just below the imports (above `export class MenuController`):

```typescript
function sendMenuError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  fallbackCode: string,
): void {
  if (error instanceof GroupAccessError) {
    res.status(403).json({ success: false, error: error.message, code: error.code });
    return;
  }
  logger.error(`${fallbackCode}:`, error);
  res.status(500).json({ success: false, error: fallbackMessage, code: fallbackCode });
}
```

In each write handler's `catch` block (`updateItem`, `toggleItemStatus`, `deleteItem`, `bulkUpdateStatus`), replace the existing `logger.error(...)` + `res.status(500)...` body with a single call, e.g. for `updateItem`:

```typescript
} catch (error) {
  sendMenuError(res, error, 'Failed to update menu item', 'INTERNAL_ERROR');
}
```

Use the matching fallback message/code already present in each handler (`'Failed to toggle menu item status'`, `'Failed to delete menu item'`, `'Failed to bulk update menu items'`).

- [ ] **Step 8: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS. (If tsc rejects `where: { id, groupId }` on `update`/`delete`, switch that single call to `updateMany`/`deleteMany` with the same `where` and re-fetch the row for the return value.)

- [ ] **Step 9: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/menu.service.ts telegram-food-bot/backend/src/api/middleware/validation.ts telegram-food-bot/backend/src/api/controllers/menu.controller.ts telegram-food-bot/backend/src/__tests__/unit/services/menu-authz.service.test.ts && git commit -m "fix(security): F2 — scope menu writes to item's real group, forbid re-parenting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: F3 — menu reads gated by membership (controller boundary)

**Files:**
- Modify: `backend/src/api/controllers/menu.controller.ts` (read handlers)
- Test: `backend/src/__tests__/unit/controllers/menu-read-authz.controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/unit/controllers/menu-read-authz.controller.test.ts`:

```typescript
import { MenuController } from '../../../api/controllers/menu.controller';
import { GroupAccessError } from '../../../services/group.service';

const assertMember = jest.fn();
jest.mock('../../../services/group.service', () => ({
  GroupService: { assertMember: (...a: any[]) => assertMember(...a) },
  GroupAccessError: class GroupAccessError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = 'GroupAccessError';
    }
  },
}));

const getActiveMenuItems = jest.fn();
jest.mock('../../../services/menu.service', () => ({
  MenuService: { getActiveMenuItems: (...a: any[]) => getActiveMenuItems(...a) },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('MenuController.getActiveItems membership gate (F3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when the user is not a member of the requested group', async () => {
    assertMember.mockRejectedValue(new GroupAccessError('NOT_MEMBER', 'not a member'));
    const req: any = { query: { groupId: '42' }, body: {}, user: { id: 7 }, headers: {} };
    const res = mockRes();

    await MenuController.getActiveItems(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(getActiveMenuItems).not.toHaveBeenCalled();
  });

  it('returns the menu when the user IS a member', async () => {
    assertMember.mockResolvedValue(undefined);
    getActiveMenuItems.mockResolvedValue([{ id: 1, name: 'Pizza', price: null }]);
    const req: any = { query: { groupId: '42' }, body: {}, user: { id: 7 }, headers: {} };
    const res = mockRes();

    await MenuController.getActiveItems(req, res);

    expect(assertMember).toHaveBeenCalledWith(7, 42);
    expect(res.json).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/controllers/menu-read-authz.controller.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — `getActiveItems` does not call `assertMember`; no 403 path.

- [ ] **Step 3: Add membership gate to read handlers**

Ensure `menu.controller.ts` imports `GroupService` (add to the existing group.service import):

```typescript
import { GroupService, GroupAccessError } from '../../services/group.service';
```

In each `groupId`-based read handler (`getAllItems`, `getActiveItems`, `getPopularItems`, `getMenuStats`, `searchItems`), insert immediately after `groupId` is resolved and validated, before the `MenuService` call:

```typescript
const user = (req as any).user;
try {
  await GroupService.assertMember(user.id, groupId);
} catch (error) {
  sendMenuError(res, error, 'Failed to get menu items', 'INTERNAL_ERROR');
  return;
}
```

(`getActiveItems` already declares `user`; reuse it instead of redeclaring.)

For `getItemById` (keyed by item id, not groupId), insert after the item is loaded and the not-found check, before responding:

```typescript
try {
  await GroupService.assertMember((req as any).user.id, item.groupId);
} catch (error) {
  sendMenuError(res, error, 'Failed to get menu item', 'INTERNAL_ERROR');
  return;
}
```

Also convert each read handler's existing `catch` to use `sendMenuError(res, error, <existing message>, <existing code>)` so a `GroupAccessError` thrown elsewhere still yields 403.

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/controllers/menu-read-authz.controller.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/api/controllers/menu.controller.ts telegram-food-bot/backend/src/__tests__/unit/controllers/menu-read-authz.controller.test.ts && git commit -m "fix(security): F3 — gate menu reads by group membership

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: F4 — store-run detail gated by membership

**Files:**
- Modify: `backend/src/services/store-run.service.ts` (`getStoreRunById`)
- Modify: `backend/src/api/controllers/store-run.controller.ts` (`getStoreRun`)
- Test: `backend/src/__tests__/unit/services/store-run-authz.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/unit/services/store-run-authz.service.test.ts`:

```typescript
import { StoreRunService, StoreRunError } from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: { storeRun: { findUnique: jest.fn() }, groupMember: { findFirst: jest.fn() } },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('StoreRunService.getStoreRunById membership gate (F4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws FORBIDDEN when the requesting user is not a member of the run group', async () => {
    prisma.storeRun.findUnique.mockResolvedValue({ id: 123, groupId: 9, items: [] });
    prisma.groupMember.findFirst.mockResolvedValue(null); // not a member

    await expect(StoreRunService.getStoreRunById(123, 7)).rejects.toMatchObject({
      name: 'StoreRunError',
      code: 'FORBIDDEN',
    });
  });

  it('returns the run when the requesting user is a member', async () => {
    const run = { id: 123, groupId: 9, items: [] };
    prisma.storeRun.findUnique.mockResolvedValue(run);
    prisma.groupMember.findFirst.mockResolvedValue({ id: 1 }); // member

    await expect(StoreRunService.getStoreRunById(123, 7)).resolves.toEqual(run);
  });

  it('returns null when the run does not exist (no membership check needed)', async () => {
    prisma.storeRun.findUnique.mockResolvedValue(null);
    await expect(StoreRunService.getStoreRunById(123, 7)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/store-run-authz.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — `getStoreRunById` takes one arg, no membership check.

- [ ] **Step 3: Implement the gate**

Add this import near the top of `backend/src/services/store-run.service.ts`:

```typescript
import { GroupService } from './group.service';
```

Replace `getStoreRunById`:

```typescript
static async getStoreRunById(id: number, requestingUserId: number) {
  const run = await prisma.storeRun.findUnique({
    where: { id },
    include: {
      initiator: true,
      items: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      group: { select: { id: true, telegramId: true, title: true } },
    },
  });
  if (!run) return null;

  const isMember = await GroupService.isUserGroupMember(requestingUserId, run.groupId);
  if (!isMember) {
    throw new StoreRunError('FORBIDDEN', 'Not a member of this group');
  }
  return run;
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/store-run-authz.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (3 tests).

- [ ] **Step 5: Pass `user.id` from the controller**

In `backend/src/api/controllers/store-run.controller.ts`, in `getStoreRun`, change:

```typescript
const run = await StoreRunService.getStoreRunById(id);
```

to:

```typescript
const run = await StoreRunService.getStoreRunById(id, user.id);
```

(`user` is already resolved via `getAuthUser(req)` above; `sendStoreRunError` already maps `StoreRunError('FORBIDDEN')` → 403.)

- [ ] **Step 6: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/store-run.service.ts telegram-food-bot/backend/src/api/controllers/store-run.controller.ts telegram-food-bot/backend/src/__tests__/unit/services/store-run-authz.service.test.ts && git commit -m "fix(security): F4 — gate store-run detail by group membership

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: F5 — race-free autoclose

**Files:**
- Modify: `backend/src/services/store-run.service.ts` (`autoCloseExpired`)
- Test: `backend/src/__tests__/unit/services/store-run-autoclose.service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/unit/services/store-run-autoclose.service.test.ts`:

```typescript
import { StoreRunService } from '../../../services/store-run.service';

jest.mock('../../../database/client', () => ({
  prisma: { storeRun: { updateManyAndReturn: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() } },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require('../../../database/client');

describe('StoreRunService.autoCloseExpired (F5 race-free)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a single conditional returning update guarded by status=COLLECTING', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([{ id: 5 }, { id: 8 }]);

    const ids = await StoreRunService.autoCloseExpired();

    expect(ids).toEqual([5, 8]);
    expect(prisma.storeRun.updateManyAndReturn).toHaveBeenCalledTimes(1);
    const arg = prisma.storeRun.updateManyAndReturn.mock.calls[0][0];
    expect(arg.where.status).toBe('COLLECTING');
    expect(arg.data.status).toBe('SHOPPING');
    // must NOT do the old read-then-blind-update pair
    expect(prisma.storeRun.updateMany).not.toHaveBeenCalled();
  });

  it('returns [] when nothing matched', async () => {
    prisma.storeRun.updateManyAndReturn.mockResolvedValue([]);
    await expect(StoreRunService.autoCloseExpired()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/store-run-autoclose.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: FAIL — current code calls `findMany` + `updateMany`.

- [ ] **Step 3: Implement the race-free version**

In `backend/src/services/store-run.service.ts`, replace `autoCloseExpired`:

```typescript
static async autoCloseExpired(): Promise<number[]> {
  // Один атомарный условный апдейт: статус меняется ТОЛЬКО если на момент записи
  // строка ещё 'COLLECTING'. Забег, отменённый между чтением и записью, не
  // попадёт под обновление (нет гонки findMany→updateMany, нет «воскрешения»
  // отменённого забега и ложных уведомлений). Возвращаются только реально
  // обновлённые строки.
  const now = new Date();
  const closed = await prisma.storeRun.updateManyAndReturn({
    where: { status: 'COLLECTING', collectUntil: { lt: now } },
    data: { status: 'SHOPPING', shoppingAt: now },
    select: { id: true },
  });
  const ids = closed.map((r) => r.id);
  if (ids.length > 0) {
    logger.info('Store runs auto-closed to SHOPPING', { count: ids.length, ids });
  }
  return ids;
}
```

- [ ] **Step 4: Run to verify it passes**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/store-run-autoclose.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS. (If tsc reports `updateManyAndReturn` does not exist on the Prisma client, regenerate with `npm run db:generate` first; it ships for Postgres in Prisma 7.3. If still unavailable, wrap a `$transaction([updateMany(where status+expiry), ...])` is NOT sufficient — instead keep the single `updateManyAndReturn`; do not fall back to the racy pair.)

- [ ] **Step 6: Commit**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/services/store-run.service.ts telegram-food-bot/backend/src/__tests__/unit/services/store-run-autoclose.service.test.ts && git commit -m "fix(security): F5 — race-free autoclose via guarded updateManyAndReturn

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full verification + cleanup

**Files:** none (verification only)

- [ ] **Step 1: Remove `isAdmin` group-scoped bypass from groupAdminMiddleware**

In `backend/src/api/middleware/group-admin.ts`, delete the line:

```typescript
if (user.isAdmin === true) { next(); return; }
```

Rationale: per decision, the global super-admin must not cross group boundaries. The service layer is authoritative; the middleware is now a pure per-group-admin early gate. (The separate global admin panel uses its own middleware and is unaffected.)

- [ ] **Step 2: Type-check the backend**

Run:
```bash
cd backend && npm run build
```
Expected: PASS.

- [ ] **Step 3: Run all new unit suites together**

Run:
```bash
cd backend && npx jest src/__tests__/unit/services/group-access.test.ts src/__tests__/unit/services/menu-authz.service.test.ts src/__tests__/unit/controllers/menu-read-authz.controller.test.ts src/__tests__/unit/services/store-run-authz.service.test.ts src/__tests__/unit/services/store-run-autoclose.service.test.ts --globalSetup=./.noop-global-setup.js
```
Expected: PASS (all suites).

- [ ] **Step 4: Remove the throwaway no-op setup**

Run:
```bash
cd backend && rm -f .noop-global-setup.js
```
Confirm it is not staged: `git status --short backend/.noop-global-setup.js` shows nothing.

- [ ] **Step 5: Commit the middleware change**

```bash
cd e:/Launch_bot && git add telegram-food-bot/backend/src/api/middleware/group-admin.ts && git commit -m "fix(security): remove global super-admin bypass from group-scoped middleware

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- All 5 findings have a passing unit test proving the fix (F1 verified join, F2 cross-group write denied + no re-parent, F3 read denied for non-member, F4 store-run denied for non-member, F5 cancelled run not revived).
- `npm run build` (backend) is green.
- No global `isAdmin` bypass remains in any group-scoped path.
- `.noop-global-setup.js` is deleted and never committed.
- Deploy follows the established flow (push `feature/store-run` → discard VPS `dist/index.html` → `update-vps.sh` → verify health + HEAD). No migration in this plan.
