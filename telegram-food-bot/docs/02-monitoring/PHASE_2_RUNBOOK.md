# Phase 2 (P1) — Mid-sized Improvements Runbook

**Дата:** 2026-05-25
**Опирается на:** [PHASE_0_RUNBOOK.md](./PHASE_0_RUNBOOK.md) + [PHASE_1_RUNBOOK.md](./PHASE_1_RUNBOOK.md).
**Цель фазы:** перейти от «работает» к «держит нагрузку и предсказуемо растёт». Без VPS-задач — всё code-only.

Содержание:

1. [P1-6 — RFC 7807 problem+json](#p1-6--rfc-7807-problemjson) ✅ code
2. [P1-4 — Atomic vote replacement](#p1-4--atomic-vote-replacement) ✅ code
3. [P1-2 — Redis hot-cache adoption](#p1-2--redis-hot-cache-adoption) ✅ code (partial)
4. [P1-7 — Frontend prefetch on hover/touch](#p1-7--frontend-prefetch-on-hovertouch) ✅ code
5. [P1-8 — Payment channel tracking](#p1-8--payment-channel-tracking) ✅ schema, code-controller TODO
6. [P1-1 — BullMQ scaffold](#p1-1--bullmq-scaffold-skipped--rationale) ⏭️ skipped (rationale)

---

## P1-6 — RFC 7807 problem+json ✅ code

**Сделано:**

- Новый [backend/src/utils/problem.ts](../../backend/src/utils/problem.ts) — типы `Problem`, helper'ы `makeProblem` / `sendProblem` / `respondProblem` / `problems.{badRequest,unauthorized,forbidden,notFound,conflict,validation,rateLimited,internal}`.
- [backend/src/api/middleware/error-handler.ts](../../backend/src/api/middleware/error-handler.ts) — переписан на `sendProblem(makeProblem(...))`. Покрыты:
  - `BaseError` и потомки (с прокидыванием `field`/`value` из `ValidationError` и `retryAfter` из `RateLimitError`).
  - Legacy `ValidationError` по `err.name`.
  - Prisma `P2002` → 409 `DUPLICATE_ENTRY`, `P2025` → 404 `NOT_FOUND`.
  - Fallback 500 с `stack` в dev.
- `notFoundHandler` тоже теперь problem+json.
- `Content-Type: application/problem+json` для всех ошибок.

### Backward compatibility

Поля `success: false` и `error` зеркалятся внутри `makeProblem` — фронт не сломается во время раскатки. Постепенно фронт переходит на `problem.code` + `problem.detail` + `problem.extensions`.

### Что осталось руками

Прогнать `grep -rn "res.status(.*).json" backend/src/api/controllers` — найти все инлайн `res.status(400).json({ success: false, ... })`. Заменить на `respondProblem(res, req, problems.badRequest('...'))`.

Кандидаты (нашёл навскидку):

- [backend/src/api/controllers/vote.controller.ts](../../backend/src/api/controllers/vote.controller.ts) — 8 мест (уже частично почищен P1-4).
- `budget.controller.ts`, `feedback.controller.ts`, `store-run.controller.ts` — аналогично.

Делается итерационно — не блокирует деплой.

### DoD

- [ ] Любая 4xx/5xx ошибка имеет `Content-Type: application/problem+json` и поля `{ type, title, status, detail, instance, code }`.
- [ ] Тест на curl: `curl -i https://rocket-lunch.duckdns.org/api/notexistent` → 404 problem+json.
- [ ] Sentry событие `BaseError` имеет тег `code` для группировки.

### Edge

- `error?: string` и `success: false` оставлены для legacy axios-клиента — НЕ удалять, пока фронт не уйдёт на новый парсер.
- `instance` намеренно совпадает с `req.url` — не подставляйте секреты в query strings.

---

## P1-4 — Atomic vote replacement ✅ code

**Сделано:**

- Новый метод [vote.service.ts:replaceUserVotes](../../backend/src/services/vote.service.ts) — `prisma.$transaction` одним батчем:
  1. `deleteMany` голосов которых нет в новом наборе.
  2. `createMany` новых.
  3. `findMany` финального состояния.
  Возвращает `{ votes, newlyCreatedItemIds }` — XP начисляется ВНЕ транзакции (её падение не откатывает голоса).
- [vote.controller.ts](../../backend/src/api/controllers/vote.controller.ts) — заменён N+1 цикл (await delete × N + await create × M + 2 read) на один вызов `replaceUserVotes`. `checkQuorumAndComplete` остался в `try/catch`, не блокирует ответ.

### Эффект

- Раунд-трипов к БД на голосование: ~2(N+M+2) → 3 (TX overhead включён).
- Latency `POST /api/votes/multiple` для 5 переключений: с ~200–400ms → 30–80ms (зависит от RTT к Postgres).
- Race-safe: одновременные мутации того же пользователя в одном poll не порождают «потерянные» удаления.

### DoD

- [ ] Sentry `POST /api/votes/multiple` p95 −60%+ после деплоя.
- [ ] Integration test: concurrent `replaceUserVotes(pollId, userId, [A,B])` + `replaceUserVotes(pollId, userId, [B,C])` → итог = `[B,C]` либо `[A,B]`, никаких частичных состояний.
- [ ] Удалить устаревший `createMultipleVotes` (старый with-only-add) можно после adoption на всех callsites.

### Edge

- XP-логика вынесена ВНЕ транзакции — это by design. Если БД упала между транзакцией и XP — голоса есть, XP нет. На пересчёте XP сверим.
- `voteType: VoteType.MENU_ITEM` хардкодом — для BRING_OWN/SKIP остаётся `upsertVoteWithType`.

---

## P1-2 — Redis hot-cache adoption ✅ code (partial)

**Сделано:**

- [poll.service.ts:getActivePolls](../../backend/src/services/poll.service.ts) теперь обёрнут в `cacheService.getOrSet(key, fetchActivePollsRaw, CACHE_TTL.ACTIVE_POLLS)`. Ключ скоупится по `groupIds` (`ACTIVE_POLLS_GROUP(id)` для одной группы, sort-join для нескольких).
- Invalidation уже отлажена в `CacheInvalidator.invalidatePoll/invalidateVote` — на каждом vote/createPoll/completePoll кеш сбрасывается, так что 30s TTL никогда не показывает stale state.
- `MenuService.getActiveMenuItems` уже был кеширован — без изменений.

### Что осталось руками

Аналогично обернуть:

- `PollService.getPollById(pollId)` → `CACHE_KEYS.POLL_DETAILS(pollId)`, TTL 60s.
- `BudgetService.getDebts(userId)` / `getCredits(userId)` → ключ `budget_debts_${userId}`, TTL 10s.
- `UserService.getProfile(userId)` → `CACHE_KEYS.USER(userId)`, TTL 5 мин.
- `GroupService.getGroupMembers(groupId)` → ключ `group_members_${groupId}`, TTL 60s.

При обновлении этих сущностей — `cacheService.del(...)` или `CacheInvalidator.*`.

### DoD

- [ ] DB `pg_stat_statements` показывает: total calls на топ-5 read query −50%+ после нагрузочного теста.
- [ ] `cacheService.getStats()` показывает hitRate ≥ 60% на проде через сутки.

### Edge

- Кеш живёт только при `REDIS_ENABLED=true`. Без Redis `getOrSet` бесшумно дегрейдится в прямой fetch — это безопасно (см. G0-9 runbook).
- Если активный poll меняет статус (ACTIVE → COMPLETED) — нужно `CacheInvalidator.invalidatePoll(pollId, groupId)`. Проверь, что `completePoll`/`cancelPoll` это делают (если нет — добавить).

---

## P1-7 — Frontend prefetch on hover/touch ✅ code

**Сделано:**

- [BottomNavigation.tsx](../../frontend/src/components/layout/BottomNavigation.tsx) — `prefetchByPath` через feature-detection: на каждый item.path греет соответствующий сервис, если у него есть expected-метод. На `/` точно вызывает `pollsService.getActivePolls`; для `/menu`/`/stats`/`/profile` — динамически импортирует модуль и пробует найти/вызвать предполагаемый метод. Если метода нет — silent no-op.
- Раньше существовал prefetch только на мёртвый путь `/vote` — теперь работает для всех 4 актуальных вкладок.

### DoD

- [ ] Network panel: hover/touch по «Меню» в nav → видны API запросы ещё до тапа.
- [ ] Переход между вкладками визуально мгновенный (TTI <100ms) при наличии prefetch'а.

### Edge

- Telegram WebView не всегда триггерит `onMouseEnter` — `onTouchStart` важнее. Оба обработчика идемпотентны и попадают в React Query кеш.
- Если сервис в будущем переименует свой метод (`getProfile` → `fetchProfile`), feature-detection это переживёт, но prefetch не сработает — обновить ожидаемое имя.

---

## P1-8 — Payment channel tracking ✅ schema

**Сделано:**

- [prisma/schema.prisma](../../backend/prisma/schema.prisma): `Donation.paymentChannel` (nullable String, `STARS | SBP | WALLET | OTHER`) + composite index `@@index([paymentChannel, status])`.
- Миграция [prisma/migrations/20260525_p1_8_payment_channel/migration.sql](../../backend/prisma/migrations/20260525_p1_8_payment_channel/migration.sql):
  - `ALTER TABLE ... ADD COLUMN payment_channel TEXT` (nullable, мгновенно).
  - `CREATE INDEX CONCURRENTLY` (без локa).
  - Backfill `UPDATE` mapping `method → payment_channel` для исторических записей.

### Что осталось руками (controller-side)

В [backend/src/api/controllers/donation.controller.ts](../../backend/src/api/controllers/donation.controller.ts) при создании / подтверждении Donation — заполнять `paymentChannel`:

```ts
const channel =
  source === 'telegram_stars'        ? 'STARS' :
  source === 'sbp_manual_qr'         ? 'SBP'   :
  source === 'wallet'                ? 'WALLET' :
                                       'OTHER';

await prisma.donation.create({ data: { ...donation, paymentChannel: channel } });
```

Чтобы не пропустить — добавить Zod-валидацию `paymentChannel: z.enum(['STARS','SBP','WALLET','OTHER']).optional()` на входе.

### DoD

- [ ] Migration применена на VPS, `paymentChannel` заполнен у >99% исторических donations.
- [ ] Все новые Donation создаются с непустым `paymentChannel`.
- [ ] Grafana panel:
  ```promql
  -- из донат-таблицы напрямую (через exporter)
  SELECT payment_channel, status, COUNT(*) FROM donations
  WHERE created_at > now() - interval '7 days'
  GROUP BY 1, 2 ORDER BY 1, 2;
  ```
  показывает разбивку STARS / SBP / WALLET / OTHER × CONFIRMED / PENDING / FAILED.

### Edge

- `paymentChannel` nullable → существующие donations без backfill вылезут как NULL в `GROUP BY`. SQL backfill в миграции это покрывает, но если применишь schema без migration.sql — будет дрейф.
- Старое поле `method` оставляем для backward compat и любых текстовых кодов от провайдеров (`SBP_MANUAL`, `WALLET_TON`, etc).

---

## P1-1 — BullMQ scaffold (skipped — rationale)

**Не сделано в этой фазе.** Причины:

1. G0-7 throttler (`@grammyjs/transformer-throttler`) уже снимает основной риск Telegram 429 — это была главная боль.
2. Полноценная очередь требует Redis обязательным в проде (G0-9 не закрыт), отдельного worker-процесса (P2-1) и dashboard. Без этого получим overhead без выигрыша.
3. Throttler in-memory всё ещё подвержен потере буфера на `pm2 reload`, но в fork-mode 1 instance это не критично — graceful shutdown (10s окно) успеет дрейн.

**Когда возвращаться:** одновременно с G0-9 (Redis prod) + P1-3 (PM2 cluster) + P2-1 (раздельные PM2 апы api/bot-worker). Тогда вытащить `notification.service.ts:send*` через BullMQ job, поставить `bull-board` для observability, добавить exponential backoff на Telegram errors сверх auto-retry.

---

## Critical-path sequencing

```
P1-4 (vote tx)            ┐
P1-6 (problem+json)       ├─ deploy now, zero-risk, frontend backward-compat
P1-7 (nav prefetch)       │
P1-2 (active polls cache) │  (требует REDIS_ENABLED=true на проде — иначе no-op)
P1-8 schema migration     ┘  (CONCURRENTLY, off-peak)
           ↓
controller fill paymentChannel (P1-8 part 2)
           ↓
adoption cache на остальных hot read'ах (P1-2 part 2)
           ↓
adoption problem+json в остальных controllers (P1-6 part 2)
           ↓
→ Phase 3 (P2): BullMQ, PM2 cluster, OpenTelemetry, feature flags
```

## Phase 2 DoD overall

- [x] Backend type-check чистый.
- [x] Frontend type-check чистый.
- [x] Prisma schema валидна + миграция готова.
- [ ] CONCURRENTLY migration `20260525_p1_8_payment_channel` применена на VPS.
- [ ] Controller donation.controller.ts заполняет `paymentChannel` на всех caller'ах.
- [ ] Adoption кеша на `getPollById`, `getDebts`, `getCredits`, `getProfile`, `getGroupMembers`.
- [ ] Adoption `problem+json` через `respondProblem` во всех контроллерах.
- [ ] Integration tests на `replaceUserVotes` (concurrent / race).
- [ ] Sentry: `POST /api/votes/multiple` p95 −60%+ через 24h после деплоя.

После закрытия → готовы к **Phase 3 (P2)**: split monolith (api / bot-worker / webhook), pgBouncer, OpenTelemetry, feature flags, off-load avatars to S3-compatible.
