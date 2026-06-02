# Store Run SHOPPING Timeout — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design)
**Branch:** `feature/store-run`
**Scope:** Auto-cancel store runs stuck in SHOPPING longer than a timeout, clean up their hanging notifications. No schema change.

## Problem

A store run goes COLLECTING → (timer/button) → SHOPPING (initiator goes shopping) → SETTLED (prices entered). The COLLECTING phase auto-closes via `autoCloseExpired` (cron). But SHOPPING has **no timeout**: if the initiator never enters prices / settles, the run hangs forever with a "🛍 X в магазине. Жди цены." notification (observed stuck since the previous day — run id=16 "КБ", group 1).

`cancelStoreRun` only works from COLLECTING; there is no path to end a stale SHOPPING run.

## Decisions (from brainstorming)

- **On timeout: cancel + cleanup** (not partial settle). No prices entered → nothing owed.
- **Timeout: 3 hours** after `shoppingAt`, env-configurable.

## Design

- **`StoreRunService.expireStaleShoppingRuns(): Promise<number[]>`** — mirrors `autoCloseExpired`. One atomic returning update:
  `updateManyAndReturn({ where: { status: 'SHOPPING', shoppingAt: { lt: now - TIMEOUT } }, data: { status: 'CANCELLED', cancelledAt: now }, select: { id } })`. Race-safe (status guard in the write where-clause). Returns the ids actually cancelled.
- **Cron:** extend the existing per-minute `store-run-autoclose.job.ts`. After `autoCloseExpired`, call `expireStaleShoppingRuns()`; for each expired id (fire-and-forget, don't fail the cron):
  - `notificationService.deleteStoreRunMessages(id)` — removes the group post + DM invites (clears the stuck "жди цены").
  - `notificationService.notifyStoreRunExpired(id)` — brief DM to the initiator: «Забег «X» авто-отменён — цены не внесены за N ч».
- **Timeout config:** `STORE_RUN_SHOPPING_TIMEOUT_MIN`, default `180`.
- **Stuck run id=16:** handled automatically — once deployed, the per-minute cron sees it (>3h old) → CANCELLED + cleanup. Verify post-deploy; no manual DB delete needed.

## Non-goals

- No partial-price settle on timeout (cancel only).
- COLLECTING auto-close (`autoCloseExpired`) unchanged.
- No schema change. `cancelStoreRun` (COLLECTING-only) unchanged — the timeout path is a separate cron-only transition.
- Participant DM invites are removed by `deleteStoreRunMessages`; no separate per-participant cancellation message (the initiator gets the notice).

## Testing

- Unit (`expireStaleShoppingRuns`, mocked Prisma): old SHOPPING (shoppingAt < cutoff) → cancelled (returned ids); fresh SHOPPING → untouched; the where-clause carries `status:'SHOPPING'` + `shoppingAt: { lt }` and `data.status==='CANCELLED'`; empty → [].
- `notifyStoreRunExpired`: sends an initiator DM (mocked bot); no-op if bot/run missing.

## Files

- `backend/src/services/store-run.service.ts` — `expireStaleShoppingRuns`.
- `backend/src/services/notification.service.ts` — `notifyStoreRunExpired`.
- `backend/src/jobs/store-run-autoclose.job.ts` — call expire + cleanup + notify.
- Tests: `backend/src/__tests__/unit/services/store-run-expire.service.test.ts`.
