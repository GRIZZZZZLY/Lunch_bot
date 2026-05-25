# Phase 1 (P0) — Quick Wins Runbook

**Дата:** 2026-05-25
**Опирается на:** [PHASE_0_RUNBOOK.md](./PHASE_0_RUNBOOK.md) (должна быть закрыта).
**Цель фазы:** быстрые победы без переписывания — снизить нагрузку на API, ускорить Mini App, видеть 429/idempotency в метриках, готовиться к PM2 cluster.

Содержание:

1. [P0-1 — TanStack Query staleTime tuning](#p0-1--tanstack-query-staletime-tuning) ✅ code
2. [P0-2 — Prisma composite indexes + CONCURRENTLY migration](#p0-2--prisma-composite-indexes--concurrently-migration) ✅ schema, VPS-action
3. [P0-3 — PM2 graceful shutdown / cluster prep](#p0-3--pm2-graceful-shutdown--cluster-prep) ✅ partial
4. [P0-4 — Nginx brotli + immutable cache](#p0-4--nginx-brotli--immutable-cache) VPS-only
5. [P0-5 — Bundle: LazyConfetti + ESLint guard](#p0-5--bundle-lazyconfetti--eslint-guard) ✅ code, follow-up call-sites
6. [P0-6 — Sentry release tag + PII scrub](#p0-6--sentry-release-tag--pii-scrub) ✅ code, CI integration needed
7. [P0-7 — Idempotency-Key auto-генерация](#p0-7--idempotency-key-auto-генерация) ✅ code
8. [P0-8 — Prometheus counter 429 + idempotency replay](#p0-8--prometheus-counter-429--idempotency-replay) ✅ code

---

## P0-1 — TanStack Query staleTime tuning ✅ code

**Сделано:** [frontend/src/lib/queryClient.ts](../../frontend/src/lib/queryClient.ts)

- Default `staleTime` поднят с 30s до 60s.
- `refetchOnWindowFocus: false` (Mini App в Telegram даёт ложные «фокусы» при перелистывании inline-keyboard'ов → штормит API).
- Экспортирован `STALE_TIMES` enum: `REALTIME`, `VOTES`, `BUDGET`, `POLL_DETAIL`, `STATS`, `MENU`, `PROFILE`, `STATIC`.

### Что осталось руками (per-hook adoption)

Прогнать `Grep -r "useQuery"` в `frontend/src/hooks/`, на каждом критичном хуке прописать `staleTime: STALE_TIMES.X`:

| Хук / queryKey | Рекомендуемый `staleTime` | Дополнительно |
|---|---|---|
| `useActivePoll` / `polls.active()` | `STALE_TIMES.REALTIME` (5s) | `refetchInterval: 5000` |
| `useVotes(pollId)` | `STALE_TIMES.VOTES` (4.5s) | `refetchInterval: 5000` |
| `useBudgetDebts` / `credits` | `STALE_TIMES.BUDGET` (10s) | `refetchInterval: 15000` если активный poll |
| `useMenuItems` | `STALE_TIMES.MENU` (5 мин) | invalidate на admin-mutate |
| `useUserProfile` / `useAvatar` | `STALE_TIMES.PROFILE` (15 мин) | invalidate на profile-update |
| `usePollHistory` / `useStats` | `STALE_TIMES.STATS` (2 мин) | |

### DoD

- [ ] Network-tab за минуту voting на активном poll: < 15 запросов (раньше ~60).
- [ ] Sentry transaction `GET /api/polls/active` throughput −60%+.
- [ ] Никакой stale data на UI: после voteMutation.onSuccess видно новый вотер ≤ 2s.

### Edge

- `useActivePoll` НЕ ставить `staleTime: 0` — это было прежнее «решение», создавшее шторм. С `refetchInterval` + `staleTime: 4500ms` real-time сохраняется.
- Mutations должны делать точечные `queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(id) })` — не общий `polls.all`.

---

## P0-2 — Prisma composite indexes + CONCURRENTLY migration ✅ schema

**Сделано в schema** [prisma/schema.prisma](../../backend/prisma/schema.prisma):

```prisma
// Poll
@@index([groupId, status, createdAt(sort: Desc)])
// Transaction
@@index([pollId, status])
// Donation
@@index([userId, status])
```

**Migration:** [prisma/migrations/20260525_p0_2_indexes/migration.sql](../../backend/prisma/migrations/20260525_p0_2_indexes/migration.sql) — `CREATE INDEX CONCURRENTLY IF NOT EXISTS` для всех трёх.

### Применение на VPS (zero-downtime)

```bash
# 1. Соединение к проду
psql "postgresql://foodbot:***@localhost:5432/foodbot"

# 2. Применение CONCURRENTLY (вне транзакции!). Через psql -f:
#    Каждый CREATE INDEX CONCURRENTLY должен быть в своей транзакции —
#    psql -f этого добивается, если файл не обёрнут в BEGIN/COMMIT.
psql -h localhost -U foodbot -d foodbot -f backend/prisma/migrations/20260525_p0_2_indexes/migration.sql

# 3. Зафиксировать в Prisma migration history
cd backend
npx prisma migrate resolve --applied 20260525_p0_2_indexes
npx prisma migrate status       # → up to date

# 4. Audit
psql -h localhost -U foodbot -d foodbot -c "\d polls"
# должны видеть polls_group_id_status_created_at_idx
```

### EXPLAIN before/after (обязательно — иначе не доказали ускорения)

```sql
-- BEFORE (до накатки индекса; запустить если уже накатили — то откатить или симулировать через SET enable_indexscan=off)
EXPLAIN ANALYZE
SELECT id, status, created_at, started_at FROM polls
WHERE group_id = 1 AND status = 'ACTIVE'
ORDER BY created_at DESC LIMIT 20;
-- Ожидаем: Seq Scan + Sort

-- AFTER
EXPLAIN ANALYZE
SELECT id, status, created_at, started_at FROM polls
WHERE group_id = 1 AND status = 'ACTIVE'
ORDER BY created_at DESC LIMIT 20;
-- Ожидаем: Index Scan using polls_group_id_status_created_at_idx, no Sort node
```

### DoD

- [ ] `pg_indexes` показывает все три индекса.
- [ ] EXPLAIN на hot-paths показывает Index Scan, без Sort node.
- [ ] p95 `GET /api/polls/active` после применения индексов −20–50%.
- [ ] Sentry: regression на этих endpoint'ах НЕТ через 24h.

### Edge

- CONCURRENTLY долго работает на больших таблицах (5+ минут на 1M строк). Не запускать перед пиковыми часами.
- При неуспехе CREATE INDEX CONCURRENTLY оставляет «invalid» индекс — нужно `DROP INDEX CONCURRENTLY` и повторить.
- Prisma migrate diff может предложить «удалить» эти индексы при следующем migrate dev — решение: добавить `@@index` в schema (уже сделано), миграцию фиксируем через `resolve --applied`.

---

## P0-3 — PM2 graceful shutdown / cluster prep ✅ partial

**Сделано:**

- [ecosystem.config.js](../../ecosystem.config.js) — `kill_timeout: 10000`, `wait_ready: true`, `shutdown_with_message: true`. Комменты, при каких условиях переключать на cluster (требует Redis-backed rate-limit + cache; см. G0-9 + P1-2).
- [backend/src/index.ts](../../backend/src/index.ts) — добавлен `process.send('ready')` после успешного старта.
- Graceful shutdown уже был корректный: SIGINT/SIGTERM → `gracefulShutdown` с 10s hard-timeout.

### Что НЕ делаем сейчас

Переключать на cluster ДО:

1. G0-9 — Redis обязателен в проде (rate-limit-redis + cache переехал).
2. Раздельных PM2 апов для bot-worker и api (P2-1), иначе Grammy polling запустится N раз и Telegram начнёт жаловаться на одновременные `getUpdates`.

### DoD на текущей фазе

- [ ] `pm2 reload rocket-lunch-bot` на VPS теперь даёт реальный zero-downtime: следующий процесс репортит ready → старый дрейн → kill.
- [ ] В `pm2 logs` видно `✅ Приложение успешно запущено` ровно один раз на reload (не два).

---

## P0-4 — Nginx brotli + immutable cache (VPS-only)

**Цель:** на повторное открытие Mini App клиент тащит почти 0 байт; на холодное — payload меньше на 15–25% vs gzip.

### Шаги

```bash
# 1. Поставить brotli модуль для Nginx (если ещё нет)
sudo apt install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
# проверить:
nginx -V 2>&1 | grep -o 'brotli'

# 2. Подкрутить /etc/nginx/sites-available/rocket-lunch
sudo nano /etc/nginx/sites-available/rocket-lunch
```

Вставить/проверить в `server { ... }`:

```nginx
# === Compression =========================================================
gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_proxied any;
gzip_types text/css text/plain text/javascript application/javascript application/json application/xml application/xml+rss image/svg+xml font/woff font/woff2;

# brotli включается из модуля (доступно через include)
brotli on;
brotli_static on;
brotli_comp_level 5;
brotli_min_length 1024;
brotli_types text/css text/plain text/javascript application/javascript application/json application/xml application/xml+rss image/svg+xml font/woff font/woff2;

# === Cache headers =======================================================
# Hashed assets — immutable, 1 год
location ~* ^/assets/.*\.(?:js|css|woff2|png|jpg|jpeg|svg|webp)$ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    access_log off;
    try_files $uri =404;
}

# index.html / навигация — НИКОГДА не кешируется (иначе застрянут на старой сборке)
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate" always;
    try_files $uri =404;
}

# Service Worker — короткий кеш чтобы быстро накатывал новый SW
location = /sw.js {
    add_header Cache-Control "no-cache, must-revalidate" always;
    add_header Service-Worker-Allowed "/";
    try_files $uri =404;
}

# === SPA fallback =========================================================
location / {
    try_files $uri /index.html;
}

# === API proxy ============================================================
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # P0/G0-3: пропускаем Sentry trace headers насквозь
    proxy_set_header sentry-trace $http_sentry_trace;
    proxy_set_header baggage $http_baggage;
    proxy_read_timeout 60s;
}

# Health endpoint — без access_log, без cache, без rate-limit
location = /health {
    proxy_pass http://127.0.0.1:3001/health;
    access_log off;
}
```

```bash
# 3. Проверить + reload
sudo nginx -t
sudo systemctl reload nginx

# 4. Verify
curl -H "Accept-Encoding: br" -I https://rocket-lunch.duckdns.org/assets/index-XXX.js
# должно: content-encoding: br, cache-control: public, max-age=31536000, immutable

curl -I https://rocket-lunch.duckdns.org/
# должно: cache-control: no-cache, must-revalidate
```

### DoD

- [ ] Lighthouse mobile на холодном открытии LCP < 2s (раньше 2–4s).
- [ ] Repeat-visit (через DevTools «Disable cache» OFF) LCP < 0.7s.
- [ ] Network panel показывает `content-encoding: br` на JS/CSS.
- [ ] Новая сборка вступает в силу < 30s после визита (index.html не кешируется).

### Edge

- В Telegram WebView Service Worker может удерживать старый bundle — vite-plugin-pwa уже стоит с `cleanupOutdatedCaches: true` и `skipWaiting: true`, должно норм. Если жалобы — пользователь делает `?reset` (уже реализовано в [main.tsx](../../frontend/src/main.tsx)).
- `proxy_set_header sentry-trace` без `proxy_set_header baggage` сломает propagation — оба обязательны.

---

## P0-5 — Bundle: LazyConfetti + ESLint guard ✅ code

**Сделано:**

- [frontend/src/components/common/LazyConfetti.tsx](../../frontend/src/components/common/LazyConfetti.tsx) — wrapper через `React.lazy`.
- [frontend/eslint.config.js](../../frontend/eslint.config.js) — `no-restricted-imports` на `react-confetti` (warn), LazyConfetti исключён.

### Что осталось руками (4 call-sites)

```bash
# Найти все импорты
grep -rn "from 'react-confetti'" frontend/src
```

Заменить в:

- [SuggestDishForm.tsx](../../frontend/src/components/menu/SuggestDishForm.tsx)
- [PaymentSuccess.tsx](../../frontend/src/components/donation/PaymentSuccess.tsx)
- [SuccessMessageView.tsx](../../frontend/src/components/budget/SuccessMessageView.tsx)
- [ConfettiAnimation.tsx](../../frontend/src/components/polls/ConfettiAnimation.tsx)

С `import Confetti from 'react-confetti'` на `import { LazyConfetti as Confetti } from '@/components/common/LazyConfetti'`.

### Опционально — lucide-react audit

В текущей версии (`^0.552`) ESM tree-shaking работает на барреле — `import { Check } from 'lucide-react'` бандлер вычистит. Проверить через bundle visualizer:

```bash
cd frontend
npm run build
# dist/stats.html → искать "lucide" в vendor chunk
# если > 30 KB gzip — раскомментировать второе правило no-restricted-imports
```

### DoD

- [ ] `dist/stats.html` после build: react-confetti НЕ в initial chunk (а в lazy-chunk).
- [ ] Initial JS gzip ↓ на 30–60 KB.
- [ ] FCP −10–20% по Lighthouse.

---

## P0-6 — Sentry release tag + PII scrub ✅ code

**Сделано:**

- [backend/src/config/sentry.config.ts](../../backend/src/config/sentry.config.ts) — `release` из `SENTRY_RELEASE` / `GIT_COMMIT_SHA` / `npm_package_version` fallback. Расширен PII scrubber: дополнительные headers (cookie, x-telegram-init-data, idempotency-key), env (DATABASE_URL, REDIS_URL, DB_PASSWORD), body-поля (paymentCard, paymentPhone, phone, cardNumber).
- [frontend/src/lib/sentry.ts](../../frontend/src/lib/sentry.ts) — `release` из `VITE_GIT_COMMIT_SHA` fallback на `VITE_APP_VERSION`.

### CI integration (GH Actions)

```yaml
# .github/workflows/deploy.yml
- name: Build frontend with release tag
  env:
    VITE_GIT_COMMIT_SHA: ${{ github.sha }}
  run: |
    cd frontend
    npm ci
    npm run build

- name: Deploy backend
  env:
    SENTRY_RELEASE: ${{ github.sha }}
  run: |
    ssh igor@vps 'cd /home/igor/Lunch_bot/telegram-food-bot && \
      SENTRY_RELEASE=${{ github.sha }} pm2 reload rocket-lunch-bot --update-env'
```

### DoD

- [ ] Sentry → Issue → видно `release: <git_sha>` тег.
- [ ] При регрессии после деплоя Sentry → «First seen in» = новый release.
- [ ] PII в event'ах не утекает: проверить через искусственный 500 — в `event.request.headers` нет `authorization`, в `event.contexts.runtime.env` нет `DATABASE_URL`.

---

## P0-7 — Idempotency-Key auto-генерация ✅ code

**Сделано:** [frontend/src/services/api.service.ts](../../frontend/src/services/api.service.ts)

- Request interceptor генерирует `Idempotency-Key` (UUID v4 через `crypto.randomUUID`) для всех `POST/PATCH/DELETE`, если ключ не передан явно.
- Сервер (G0-8 middleware) на повторе с тем же ключом вернёт оригинальный ответ + `X-Idempotent-Replayed: true`.

### Что осталось руками (для React Query mutations)

Для критичных мутаций (vote, mark-paid, confirm-payment) **зафиксировать** ключ в `mutationFn`, чтобы ретраи React Query несли тот же `Idempotency-Key`:

```ts
const mutation = useMutation({
  mutationFn: async (data) => {
    const idempotencyKey = crypto.randomUUID(); // фиксируем 1 раз
    return apiService.post('/votes/multiple', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },
  retry: 1,
});
```

Без этого: каждый retry React Query сгенерит новый ключ через interceptor → дедупликация не сработает.

### DoD

- [ ] Network: на double-tap по «Голосовать» оба POST идут с **одинаковым** Idempotency-Key, второй возвращает `200` с `X-Idempotent-Replayed: true`.
- [ ] Prometheus: `food_bot_idempotency_replay_total{scope="vote"}` > 0 после нагрузочного теста.

---

## P0-8 — Prometheus counter 429 + idempotency replay ✅ code

**Сделано:**

- [backend/src/services/metrics.service.ts](../../backend/src/services/metrics.service.ts) — два новых counter'а:
  - `food_bot_rate_limit_429_total{bucket, route}`
  - `food_bot_idempotency_replay_total{scope, kind}`
- [backend/src/api/middleware/rate-limiter.ts](../../backend/src/api/middleware/rate-limiter.ts) — каждый handler логирует 429 в свой bucket.
- [backend/src/api/middleware/idempotency.ts](../../backend/src/api/middleware/idempotency.ts) — replays считаются.

### Grafana / Prometheus panels (если PM2 уже выставляет /metrics)

```promql
# Rate-limit 429 per bucket (top 5)
sum by (bucket) (rate(food_bot_rate_limit_429_total[5m])) > 0

# % of 429 from total
sum(rate(food_bot_rate_limit_429_total[5m]))
  / sum(rate(food_bot_http_requests_total[5m]))

# Idempotency replays per scope
sum by (scope, kind) (rate(food_bot_idempotency_replay_total[5m]))
```

### Alerts

- `% 429 / total > 1%` на 10 мин → warning. Сигнал: либо лимит слишком жёсткий, либо атака.
- `idempotency_replay{kind="inflight"} > 5/min` → warning. Сигнал: клиент бомбит ретраями быстрее окна выполнения handler'а.

### DoD

- [ ] `curl http://localhost:3001/metrics` показывает обе серии.
- [ ] Grafana panel показывает данные после первого реального 429.

---

## Critical-path sequencing

```
P0-1, P0-7, P0-8           ← deploy now (frontend + backend), zero-risk
P0-6 + CI integration       ← следующий deploy через GH Actions
P0-2 (CONCURRENTLY)         ← off-peak window, ≤30 мин
P0-3 (process.send ready)   ← в том же деплое что и P0-2
P0-4 (nginx)                ← в обходящемся reload
P0-5 (per-call-site)        ← плановая работа, не блокирует ничего
```

## Phase 1 DoD overall

- [x] Все code-changes применены, type-check чистый.
- [ ] Per-hook adoption STALE_TIMES (P0-1) — пройтись по `frontend/src/hooks/`.
- [ ] Per-call-site adoption LazyConfetti (P0-5) — 4 файла.
- [ ] CONCURRENTLY migration применена на VPS (P0-2).
- [ ] Nginx config обновлён + reload (P0-4).
- [ ] CI инжектит SENTRY_RELEASE / VITE_GIT_COMMIT_SHA (P0-6).
- [ ] Grafana panels на 429 и idempotency_replay (P0-8).
- [ ] Sentry: видно release tag на новых event'ах.
- [ ] Lighthouse mobile: LCP <2s cold, <0.7s repeat (P0-4).

После закрытия → готовы к **Phase 2 (P1)**: BullMQ для notifications, Redis hot-cache, PM2 cluster, repository pattern, Playwright E2E.
