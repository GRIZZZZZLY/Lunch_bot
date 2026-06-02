# Group Isolation Security Hardening — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan
**Branch:** `feature/store-run`
**Scope:** Close 5 confirmed cross-group access-control vulnerabilities in the multi-tenant backend.

---

## Background

The bot moved from single-tenant to multi-tenant (per-group menu, per-group admin via `groupAdminMiddleware`). A security audit found 5 group-isolation holes. All 5 were re-verified against current code (see Findings). The audit incorrectly marked F2 as refuted; manual verification confirms it is a real P1.

## Goals

- A user can only read/write data of groups they actually belong to.
- Group membership cannot be self-granted from a client-supplied `start_param`.
- A group admin cannot touch another group's resources (no write, no delete, no move, no read leak).
- A cancelled store run can never be revived by the autoclose job.

## Non-goals (explicitly out of scope)

- The **global admin panel** (`admin.routes`, `make-admin`, `AdminDashboard`, `isAdmin` flag) is NOT changed here. Its full removal/rework is a separate spec.
- Frontend changes beyond what a 403/404 response naturally produces.
- PostgreSQL/infra changes.

## Key decisions (from brainstorming)

1. **F1 membership verification:** use Telegram `getChatMember` as source of truth.
2. **Rollout:** all 5 findings in one spec / one plan / one deploy.
3. **Structure:** Approach **B** — the **service layer is the authoritative enforcement point**. Existing `groupAdminMiddleware` stays as a cheap early gate (defense-in-depth) but is NOT relied upon for correctness.
4. **Super-admin in group-scoped authz:** the global `isAdmin` bypass is **removed from all group-scoped checks**. Only the per-group role (member / admin in `group_members`) decides access to group data. (The separate global admin panel keeps its own `isAdmin` auth — untouched.)

So the authorization actor for group-scoped service methods is simply `userId: number`. There is no super-admin shortcut in these paths.

---

## Findings (all CONFIRMED)

| # | Sev | Vulnerability | Root cause |
|---|-----|---------------|------------|
| F1 | P1 | `start_param` auto-joins user into any group | `validateInitData` → `addMemberToGroup` with zero Telegram-side verification |
| F2 | P1 | Group admin can modify/delete/**move** another group's menu item | `groupAdminMiddleware` authorizes by request-body `groupId`; service writes by `id` alone; update schema keeps `groupId` so `...data` can re-parent the item |
| F3 | P2 | Menu reads leak any group's menu by `groupId`/`id` | GET routes have only `telegramAuthMiddleware`, no membership check |
| F4 | P2 | Store-run details readable by id by any authed user | `getStoreRunById(id)` returns everything, no membership check |
| F5 | P2 | Autoclose can revert a CANCELLED run to SHOPPING | `findMany(COLLECTING)` then `updateMany(where id in ids)` without re-checking status |

---

## Design

### Shared primitives (`GroupService`)

```
class GroupAccessError extends Error {
  // code: 'NOT_MEMBER' | 'NOT_ADMIN' | 'NOT_VERIFIED'
  // maps to HTTP 403
}

GroupService.assertMember(userId, groupId): Promise<void>
  // throws GroupAccessError('NOT_MEMBER') unless isUserGroupMember(userId, groupId)

GroupService.assertAdmin(userId, groupId): Promise<void>
  // throws GroupAccessError('NOT_ADMIN') unless isUserGroupAdmin(userId, groupId)

GroupService.verifyTelegramMembership(groupTelegramId, userTelegramId): Promise<boolean>
  // bot.api.getChatMember; true iff status in {member, administrator, creator}
  // FAIL CLOSED: returns false on API error / missing bot / 'left' / 'kicked'
```

`isUserGroupMember` and `isUserGroupAdmin` already exist (`group.service.ts`) and check `group_members` — no global flag involved. `assert*` wrap them. None of the `assert*` honor `isAdmin`.

A central Express error mapper (or per-controller catch) turns `GroupAccessError` into:
`res.status(403).json({ success: false, error: <message>, code: <code> })`.

### F1 — verified join

- New `GroupService.addMemberFromStartParam(group, user)`:
  1. `verified = await verifyTelegramMembership(group.telegramId, user.telegramId)`
  2. if `verified` → `addMemberToGroup(group.id, user.id)`
  3. else → log warn, **do nothing** (no membership row created).
- `validateInitData` (`auth.controller.ts`) loads the group (needs `telegramId`) and calls `addMemberFromStartParam` instead of `addMemberToGroup`.
- `addMemberToGroup` stays as the low-level trusted primitive, used only from verified Telegram chat events.
- The auth request itself still succeeds; an unverified user simply has no membership, so downstream `assertMember` gates deny group data with 403.

### F2 — menu writes scoped to the item's real group

For `updateMenuItem`, `deleteMenuItem`, `toggleMenuItemStatus`, `bulkUpdateStatus` in `menu.service.ts`:
- Add `userId` parameter.
- Load the target item(s) to get the real `groupId` (for bulk: load all `ids`, collect their groups).
- `await GroupService.assertAdmin(userId, item.groupId)` for each affected group.
- Scope the write: `where: { id, groupId: item.groupId }` (and bulk: `where: { id: { in: ids }, groupId }`).
- **Strip `groupId` from the update payload** — items cannot be re-parented. (Also drop `groupId` in the update branch of `updateMenuItemSchema` / controller.)
- Controllers pass `req.user.id`.

`groupAdminMiddleware` is kept on these routes but its `isAdmin` early-bypass is removed (group-scoped). It is no longer authoritative.

### F3 — menu reads gated by membership

For `getAllMenuItems`, `getActiveItems`, `getPopularItems`, `getMenuStats`, `searchItems` (take `groupId`):
- Add `userId`, call `assertMember(userId, groupId)` before returning.

For `getItemById(id)`:
- Load item, then `assertMember(userId, item.groupId)`; else 403/404.
- Controllers pass `req.user.id`.

### F4 — store-run detail gated by membership

- `getStoreRunById(id, userId)`: after `findUnique`, `assertMember(userId, run.groupId)`; on failure surface `StoreRunError('FORBIDDEN')` (→ existing store-run error mapping) or 404 to avoid existence oracle.
- Controller passes `getAuthUser(req).id`.

### F5 — race-free autoclose

Replace the `findMany` + `updateMany` pair with a single atomic returning update:

```
const closed = await prisma.storeRun.updateManyAndReturn({
  where: { status: 'COLLECTING', collectUntil: { lt: now } },
  data: { status: 'SHOPPING', shoppingAt: now },
});
// use closed[].id for notifications
```

`updateManyAndReturn` (Prisma 7, Postgres) updates and returns only the rows that actually matched `status: 'COLLECTING'` at write time. A run cancelled between read and write is excluded — no revival, no false notifications, safe under concurrent job instances.

---

## Behavior changes (intended)

- A global `isAdmin` user who is NOT a member/admin of group X can no longer read or modify group X's menu/store-runs via the Mini App API. (Admin panel routes unaffected.)
- Opening a Mini App deep link for a group the user isn't actually in no longer makes them a member; group data returns 403.
- Cross-group menu edit/delete/move now returns 403.
- Store-run detail for a foreign run returns 403/404.

## Testing (unit, mocked Prisma + mocked `bot.api.getChatMember`, no DB)

Use the established pattern: `jest.mock('../../../database/client')`, mock bot instance, run via noop-globalSetup override.

- **F1:** verified status → membership created; `left`/`kicked`/API-error → no membership.
- **F2:** admin of A editing/deleting item of B → `GroupAccessError`; admin of A editing own item → ok; `groupId` in update body is ignored (item not moved).
- **F3:** non-member reading group menu / item → 403; member → ok.
- **F4:** non-member fetching foreign run → 403/404; member → ok.
- **F5:** run cancelled between snapshot and update is not reverted (updateManyAndReturn excludes it).

`tsc --noEmit` (backend) green. Full Jest requires local Postgres (globalSetup) — run if available; unit suites run standalone with noop-globalSetup.

## Files touched (estimate)

- `backend/src/services/group.service.ts` — `GroupAccessError`, `assertMember`, `assertAdmin`, `verifyTelegramMembership`, `addMemberFromStartParam`.
- `backend/src/api/controllers/auth.controller.ts` — verified join.
- `backend/src/services/menu.service.ts` — write scoping + read gating (`userId` params).
- `backend/src/api/controllers/menu.controller.ts` — pass `userId`, drop `groupId` from update body.
- `backend/src/api/middleware/group-admin.ts` — remove `isAdmin` group-scoped bypass.
- `backend/src/api/middleware/validation.ts` — drop `groupId` from update schema.
- `backend/src/services/store-run.service.ts` — `getStoreRunById(id, userId)` gate + race-free `autoCloseExpired`.
- `backend/src/api/controllers/store-run.controller.ts` — pass `userId`.
- Central error mapping for `GroupAccessError` (server error handler or per-controller).
- Tests: 5 unit specs (one per finding) under `backend/src/__tests__/unit/`.

## Open risks

- `getChatMember` adds one Telegram API call on first auth per group; acceptable (only when `start_param` present and membership not yet recorded — can short-circuit if already a member).
- Removing the `isAdmin` group bypass may surprise a global admin who managed group menus via the Mini App. Per decision, intended.
- `updateManyAndReturn` must be supported by the installed Prisma/Postgres (Prisma 7.3 + Postgres — yes). Verify at implementation.
