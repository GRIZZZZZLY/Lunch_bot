# Per-Group Dish Creation + Menu Group Label — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan
**Branch:** `feature/store-run`
**Scope:** (1) Show which group's menu the Menu page displays; (2) let an admin of several groups create a dish into multiple of THEIR groups at once; (3) make per-group activity explicit. No data-model change.

---

## Background

Multi-tenant bot: each `MenuItem` belongs to exactly one group (`groupId`, required) and already has an `isActive` boolean that is editable both in the create/edit form (`MenuForm.tsx` "Активное блюдо" Switch) and via a quick toggle button on each item card. So per-group activity already works because a dish IS group-specific.

Two real gaps:
- The Menu page shows a generic "Меню" title — it does NOT show which group's menu is displayed (`MenuPage.tsx:285`).
- There is no way to create one dish into several groups at once; an admin of two groups must recreate it in each.

## Decision (from brainstorming)

**Approach 1 — copies on create.** When creating a dish, the admin picks one or more of THEIR admin groups; the backend creates one independent `MenuItem` copy per selected group. Per-group activity = each copy's existing `isActive`. No shared-catalog model, no schema migration. Chosen over Approach 2 (shared `MenuItem` + `MenuItemGroup` join table) because it satisfies the stated need ("create into several groups" + "toggle activity per group" + "an admin of one group cannot affect others") with minimal change and zero conflict with the just-shipped group-isolation work.

## Goals

1. Menu page clearly shows the current group and lets a multi-group user switch group.
2. Create form offers a multi-select of the user's ADMIN groups (only); submitting creates a copy in each selected group.
3. Activity toggle label is explicit that it applies to the dish's group.
4. Cross-group isolation preserved: a user can only target groups where they are admin — enforced on the backend, and non-admin groups never appear in the UI list.

## Non-goals (explicit)

- No `MenuItem` schema change; no migration. Copies are ordinary per-group rows.
- No edit-propagation: editing one copy (e.g. price) does NOT change copies in other groups. Copies are independent. (If "edit once, change everywhere" is wanted later, that is Approach 2 — a separate spec.)
- Editing an existing dish stays single-group (the multi-group selector appears only in CREATE mode).
- The global admin panel is untouched.

---

## Design

### Part 1 — Menu page group header / switcher

`MenuPage.tsx` header gains a group control next to the title:
- Shows the current group's name (from `useUserGroups()` + `currentGroupId` in the Zustand store, already wired via `useCurrentGroup()`).
- If the user has more than one group: render it as a dropdown/switcher that calls the store's `setCurrentGroupId`; changing it re-runs `useMenuItems()` (already keyed by `currentGroupId`) so the menu reloads for the chosen group.
- If the user has exactly one group: render the name as a static label (no dropdown).

No new data flow — reuses existing `useUserGroups`, `useCurrentGroup`, and the menu query's `currentGroupId` dependency.

### Part 2 — Create dish into multiple groups

**Frontend (`MenuForm.tsx`, create mode only):**
- Add a "В группах" multi-select listing ONLY the user's admin groups — `useUserGroups()` filtered to role ∈ {ADMIN, CREATOR}. (If the existing `useUserGroups` does not already expose the caller's per-group role, extend it / the groups API to include it; the list MUST NOT show groups where the user is not admin.)
- The currently-viewed group is pre-checked. At least one group must be selected (validation).
- If the user is admin of only one group, the selector collapses to that single group (or is hidden) — effectively unchanged UX for single-group admins.
- On submit, send `groupIds: number[]`.
- Edit mode: NO group selector (editing is per-copy, single group).

**Frontend service (`menu.service.ts`):**
- `createItem(data, groupIds: number[])` → `POST /menu` with body `{ ...data, groupIds }`.
- On success, invalidate the menu query cache for every affected groupId (so each group's menu refreshes). Show a toast: created in N group(s).

**Backend:**
- `POST /menu` create body carries `groupIds: number[]` (length ≥ 1) instead of a single `groupId`. Update `createMenuItemSchema` (`validation.ts`) accordingly (`groupIds: z.array(z.number().int().positive()).min(1)`).
- Remove `groupAdminMiddleware` from the `POST /menu` route — per-group authorization moves into the controller/service (authoritative, consistent with the group-isolation hardening). Keep `telegramAuthMiddleware` + `validateMenuItemData`.
- New service method `MenuService.createMenuItemForGroups(data, createdBy, groupIds, actingUserId)`:
  1. Assert admin for EVERY groupId first: `for (const gid of groupIds) await GroupService.assertAdmin(actingUserId, gid);` — if any fails, throw `GroupAccessError('NOT_ADMIN')` and create nothing (all-or-nothing).
  2. Create one copy per group (a `MenuItem` with that `groupId`, same name/description/price/imageUrl/isActive, `createdBy`). Use a single `$transaction` so it's atomic.
  3. Return the array of created items.
- Controller `createItem`: read `groupIds` (de-duplicate), call the service with `user.id` as both `createdBy` and `actingUserId`, map `GroupAccessError` → 403 (via the existing `sendMenuError` helper), return `{ success, data: items, count }`.

### Part 3 — Explicit per-group activity label

In `MenuForm.tsx`, the existing "Активное блюдо" Switch keeps its behavior but the label/description is made explicit that activity is per the dish's group, e.g. label "Активно" with description "Участвует в голосованиях этой группы". In create mode (multi-group), the single `isActive` value applies to all created copies (each copy starts with that value, then can be toggled independently afterwards). The quick card toggle is unchanged.

---

## Behavior summary

- A user administering groups A and B creating a dish with both checked → two independent dishes, one in A and one in B, each individually toggleable.
- A user administering only group A → only A available; behaves like today.
- A user is never offered, and the backend never accepts, a group where they are not admin (403 + nothing created if forged).
- The Menu page always shows whose menu it is and (multi-group) lets the user switch.

## Testing

**Backend unit (mocked Prisma + GroupService):**
- `createMenuItemForGroups` with `groupIds=[A,B]`, user admin of both → 2 items created, one per group.
- with a group where user is NOT admin → throws `GroupAccessError`, `menuItem.create`/`createMany` NOT called (all-or-nothing).
- single group → 1 item.
- duplicate ids deduped.
- Controller: `POST /menu` maps `GroupAccessError` → 403; success returns array + count.

**Frontend:**
- Create form lists only admin groups (a non-admin group is absent).
- Submitting with two groups calls the service with `groupIds:[A,B]` and invalidates both caches.
- Menu page header shows the current group name; switching group (multi-group user) refetches that group's menu.

## Files (estimated)

- `backend/src/api/middleware/validation.ts` — create schema uses `groupIds`.
- `backend/src/api/routes/menu.routes.ts` — drop `groupAdminMiddleware` from `POST /`.
- `backend/src/services/menu.service.ts` — `createMenuItemForGroups`.
- `backend/src/api/controllers/menu.controller.ts` — `createItem` multi-group + 403 mapping.
- `backend/src/types/menu.types.ts` — create payload `groupIds`.
- `frontend/src/services/menu.service.ts` — `createItem(data, groupIds)`.
- `frontend/src/components/menu/MenuForm.tsx` — admin-group multi-select (create mode), explicit activity label.
- `frontend/src/pages/MenuPage.tsx` — group header/switcher; multi-cache invalidation after create.
- `frontend/src/hooks/...` — an admin-groups source (extend `useUserGroups` to expose role if needed).
- Tests as above.

## Open risks

- `useUserGroups` may not expose the caller's per-group role; if so, the groups API/hook must be extended to return it (needed to filter the create list to admin groups). Confirm at implementation; do not show non-admin groups.
- Removing `groupAdminMiddleware` from `POST /menu`: the controller MUST assert admin per group, or create becomes unauthorized. The plan covers this with a failing test first.
