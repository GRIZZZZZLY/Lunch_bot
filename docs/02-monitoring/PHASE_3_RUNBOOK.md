# Phase 3 (P2) — Architectural Scaffolds Runbook

**Дата:** 2026-05-25
**Опирается на:** [PHASE_0_RUNBOOK.md](./PHASE_0_RUNBOOK.md) + [PHASE_1_RUNBOOK.md](./PHASE_1_RUNBOOK.md) + [PHASE_2_RUNBOOK.md](./PHASE_2_RUNBOOK.md).
**Цель фазы:** крупные архитектурные подготовки. Большинство — scaffold с feature-toggle, активация когда придёт нагрузка / релиз feature flag UI / приватный bucket.

Содержание:

1. [P2-3 — OpenTelemetry scaffold](#p2-3--opentelemetry-scaffold) ✅ scaffold
2. [P2-4 — Feature flags abstraction](#p2-4--feature-flags-abstraction) ✅ ready to use
3. [P2-5 — Avatar storage abstraction](#p2-5--avatar-storage-abstraction) ✅ scaffold
4. [P2-2 — Prisma pgBouncer prep](#p2-2--prisma-pgbouncer-prep) ✅ docs + tune-points
5. [P2-1 — Split monolith prep](#p2-1--split-monolith-prep) ✅ entry-point env-toggle
6. [P2-6 — Expand-and-contract migrations](#p2-6--expand-and-contract-migrations)
7. [P2-7..P2-10 — внешние сервисы](#p2-7p2-10--внешние-сервисы) docs-only

---

## P2-3 — OpenTelemetry scaffold ✅ scaffold

**Файл:** [backend/src/utils/telemetry.ts](../../backend/src/utils/telemetry.ts)

Динамическая инициализация: пакеты `@opentelemetry/*` НЕ установлены, бандл не утяжелён. По умолчанию `initTelemetry()` возвращает noop handle.

### Активация

```bash
cd backend
npm install --save \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions

# env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=telegram-food-bot-backend
```

В [index.ts](../../backend/src/index.ts) **первой строкой** (до `import dotenv`!) добавить:

```ts
import './utils/telemetry'; // side-effect: должен подменить require() ДО других импортов
```

И в startApplication:

```ts
import { initTelemetry } from './utils/telemetry';
const telemetry = await initTelemetry();
// в gracefulShutdown:
await telemetry.shutdown();
```

### DoD

- [ ] OTLP endpoint (Tempo/Jaeger) получает trace при `POST /api/votes/multiple`.
- [ ] Корреляция: Sentry span = OTel span (Sentry SDK 8+ это умеет нативно).
- [ ] Telegram polling outbounds (`api.telegram.org`) отфильтрованы (см. `ignoreOutgoingRequestHook`).

### Edge

- ОБЯЗАТЕЛЬНО импорт telemetry первым — auto-instrumentation работает через monkey-patch require, поздний import → instrumentation мимо.
- `getNodeAutoInstrumentations` тянет fs/dns/net — отключены для шума.

---

## P2-4 — Feature flags abstraction ✅ ready

**Файл:** [backend/src/utils/feature-flags.ts](../../backend/src/utils/feature-flags.ts)

Готовый EnvProvider, читает `FEATURE_FLAGS_JSON`. API:

```ts
import { featureFlags } from './utils/feature-flags';

if (featureFlags.isEnabled('budget_v2', { userId: ctx.user.id })) {
  // new flow
} else {
  // legacy flow
}

const layout = featureFlags.variant('checkout_layout', { userId: ctx.user.id });
// → 'A' | 'B' | undefined
```

### env пример

```json
FEATURE_FLAGS_JSON={
  "budget_v2": { "enabled": true, "rollout": 25 },
  "new_admin_ui": { "enabled": true, "allowUserIds": [7, 42] },
  "kill_switch_payments": { "enabled": false },
  "checkout_layout": { "enabled": true, "variants": ["A", "B"] }
}
```

Hot-reload: в production раз в 30s `featureFlags.refresh()` подхватывает изменения после `pm2 reload --update-env`.

### Что осталось руками

- Найти первые 2-3 нативных места для `isEnabled` (новая фича за флагом — например, новая UI рулетки или multi-winner режим по умолчанию).
- Document в `docs/04-features/` reference на флаги.
- TODO P3: добавить PostHogProvider / UnleashProvider для streaming-обновлений + segmentation по группам.

### DoD

- [ ] Хотя бы одна фича за флагом раскатана, kill-switch проверен.
- [ ] Тест на consistency: один и тот же `userId` всегда даёт один bucket.

### Edge

- Без `userId` контекста `isEnabled` детерминирована только если `rollout` ≥ 100. Иначе по умолчанию false (консервативно).
- `denyUserIds` сильнее `allowUserIds`, оба сильнее `rollout%`.

---

## P2-5 — Avatar storage abstraction ✅ scaffold

**Файлы:**

- [services/avatar-storage/index.ts](../../backend/src/services/avatar-storage/index.ts) — interface + driver picker.
- [services/avatar-storage/telegram-passthrough.driver.ts](../../backend/src/services/avatar-storage/telegram-passthrough.driver.ts) — текущее поведение (default).
- [services/avatar-storage/s3-storage.driver.ts](../../backend/src/services/avatar-storage/s3-storage.driver.ts) — scaffold, throws на fetch.

### Что осталось руками

1. Зарефакторить [avatar.controller.ts](../../backend/src/api/controllers/avatar.controller.ts) на использование `avatarStorage.fetch(fileId)`:

```ts
import { avatarStorage } from '../../services/avatar-storage';

const result = await avatarStorage.fetch(fileId);
if (result.redirectUrl) {
  res.redirect(302, result.redirectUrl);
} else if (result.stream) {
  res.setHeader('Content-Type', result.contentType ?? 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  result.stream.pipe(res);
}
```

2. Когда понадобится S3 — установить `@aws-sdk/client-s3`, заполнить [s3-storage.driver.ts](../../backend/src/services/avatar-storage/s3-storage.driver.ts) (план в файле header).

### Активация S3

```bash
AVATAR_STORAGE_DRIVER=s3
AVATAR_S3_ENDPOINT=https://s3.timeweb.cloud
AVATAR_S3_BUCKET=foodbot-avatars
AVATAR_S3_ACCESS_KEY_ID=...
AVATAR_S3_SECRET_ACCESS_KEY=...
AVATAR_S3_PUBLIC_URL_BASE=https://avatars.rocket-lunch.duckdns.org  # optional CDN
```

### DoD после активации S3

- [ ] Первый запрос аватара: latency ~200-500ms (cache-miss, Telegram + putObject).
- [ ] Второй запрос: 302 redirect, < 50ms.
- [ ] Bucket lifecycle policy: удалять аватары без обновления > 30 дней.

### Edge

- При смене аватара пользователем — Telegram даёт новый `file_id`, поэтому stale-cache риска нет; старый объект протухает по lifecycle.
- 302 редирект в Mini App iframe = OK; в браузере follow auto.

---

## P2-2 — Prisma pgBouncer prep ✅ docs + tune-points

**Файл:** [backend/src/database/client.ts](../../backend/src/database/client.ts)

Сделан scaffold для тюнинга pool (PG_POOL_MAX / PG_IDLE_TIMEOUT_MS / PG_CONNECTION_TIMEOUT_MS). Adapter-pg не требует `pgbouncer=true` флага (это специфично для регулярного Prisma engine).

### Активация pgBouncer на VPS (когда придёт нагрузка)

```bash
# 1. Установить
sudo apt install -y pgbouncer

# 2. /etc/pgbouncer/pgbouncer.ini
[databases]
foodbot = host=127.0.0.1 port=5432 dbname=foodbot

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction        # critical: transaction-pool для масштаба
max_client_conn = 200
default_pool_size = 25
reserve_pool_size = 5
server_idle_timeout = 60
log_connections = 0
log_disconnections = 0

# 3. /etc/pgbouncer/userlist.txt
"foodbot" "SCRAM-SHA-256$..."   # generate: psql → SELECT rolname,rolpassword FROM pg_authid

# 4. enable + start
sudo systemctl enable --now pgbouncer

# 5. backend/.env
DATABASE_URL=postgresql://foodbot:***@localhost:6432/foodbot
```

### DoD

- [ ] `pgbouncer -R` показывает connection-stats без exhaust.
- [ ] k6 stress (×3 текущего пика) не упирается в connection limit.
- [ ] `prepared_statements=false`-проблема НЕ возникает (adapter-pg не использует prepared).

### Edge

- `pool_mode = transaction` несовместим с long-running transactions > timeout. Все наши $transaction короткие — ок.
- `SET LOCAL` и `LISTEN/NOTIFY` НЕ работают в transaction-pool. Если в коде появятся — переключать на session-pool.

---

## P2-1 — Split monolith prep ✅ entry-point env-toggle

**Файлы:**

- [backend/src/index.ts](../../backend/src/index.ts) — добавлен `PROCESS_ROLE` env (`full` | `api` | `bot`), условные `createBot()`/`createApiServer()`/jobs.
- [ecosystem.config.js](../../ecosystem.config.js) — комментарий с примером 2-app конфигурации.

По умолчанию `PROCESS_ROLE=full` — старое поведение, ничего не ломается.

### Что осталось руками (когда придёт время)

1. **Prerequisites:**
   - G0-9 Redis обязательным (idempotency + cache shared).
   - P1-2 adoption — ВСЕ in-memory кеши вынесены в Redis.
   - P1-3 PM2 cluster prep (process.send('ready') уже есть).

2. **Включение:**
   ```js
   // ecosystem.config.js
   const common = { script: './backend/dist/index.js', cwd: '/home/igor/...', ...rest };
   module.exports = {
     apps: [
       { ...common, name: 'rocket-lunch-api', env: { ...env, PROCESS_ROLE: 'api' }, instances: 2, exec_mode: 'cluster' },
       { ...common, name: 'rocket-lunch-bot', env: { ...env, PROCESS_ROLE: 'bot' }, instances: 1, exec_mode: 'fork' },
     ],
   };
   ```

3. **Inter-process:**
   - API создаёт `Vote` → emit Redis pub/sub → bot-worker слушает и отправляет notification.
   - Сейчас `notificationService.initialize(bot)` зовётся внутри createBot — в `api` mode не вызывается, поэтому нотификации из api flow требуют миграции на pub/sub.

### DoD

- [ ] `PROCESS_ROLE=api npm start` — API сервер работает, bot polling НЕ стартует.
- [ ] `PROCESS_ROLE=bot npm start` — bot polling работает, HTTP сервер НЕ стартует.
- [ ] Default (без env) — `full` режим, идентично текущему prod-поведению.
- [ ] `pm2 stop rocket-lunch-bot && pm2 reload rocket-lunch-api` — API продолжает обслуживать без проблем.

### Edge

- В `api` mode notification.service не имеет bot instance → любые `bot.api.sendMessage` из контроллеров упадут. Решение: вынести через Redis pub/sub или вызывать API bot-процесса по HTTP.
- В `bot` mode endpoints недоступны → внешние интеграции (например, Telegram webhook setting) делать через `full` mode при первом старте.

---

## P2-6 — Expand-and-contract migrations

**Цель:** мигрировать схему без downtime, поддерживая старый и новый код одновременно.

### Pattern: добавление NOT NULL колонки

```
Phase A (expand):
  1. Migration: ADD COLUMN ... DEFAULT NULL  (nullable, мгновенно)
  2. Deploy: код пишет в новое поле, ЧИТАЕТ из старого+нового
  3. Backfill SQL: UPDATE ... SET new_col = computed FROM old_col
Phase B (transition):
  4. Migration: ALTER COLUMN ... SET NOT NULL (после backfill)
  5. Deploy: код читает ТОЛЬКО из нового поля
Phase C (contract):
  6. Migration: DROP COLUMN old_col (после rolling deploy)
```

### Pattern: переименование колонки

То же: добавляем `new_col`, копируем, читаем-пишем оба, удаляем `old_col` в 3 деплоя.

### Pattern: смена типа

Аналогично: новая колонка с новым типом, double-write, switch read, drop старой.

### Tooling

- `prisma migrate diff --script` — генерит SQL.
- `prisma migrate resolve --applied` — фиксирует ручную миграцию в history.
- CONCURRENTLY для индексов (см. P0-2 пример).

### Когда НЕЛЬЗЯ expand-and-contract

- Изменение конфигурации репликации.
- Срочный кетч-ап после инцидента: лучше короткий downtime + честная миграция, чем 5 деплоев под давлением.

### DoD

- [ ] Runbook добавлен в `docs/02-monitoring/MIGRATION_RUNBOOK.md` (этот файл сюда же).
- [ ] Первая non-trivial миграция (например, `User.lastSeenAt`) сделана через expand-and-contract.

---

## P2-7..P2-10 — внешние сервисы (docs-only)

### P2-7 Cloudflare edge

См. отдельный runbook когда домен переедет за CF.

```
Цель: edge cache для статики, WAF, защита от small DDoS.
Шаги:
  1. NS → Cloudflare.
  2. SSL = Full strict, не Flexible (иначе MITM).
  3. Page Rules: /assets/* → Cache Everything, Edge TTL 1 year.
  4. WAF: rate-limit /api/auth/* (100/min/IP), Bot Fight Mode OFF (Telegram WebView).
  5. Origin: лимит на CF-Connecting-IP вместо req.ip (express-rate-limit keyGen).
DoD:
  - LCP edge-users -10-30%.
  - WAF блокирует bruteforce на /auth.
```

### P2-8 Partitioning

Когда `polls`/`votes`/`transactions` > 10M строк.

```
Range partitioning по created_at (monthly).
  CREATE TABLE polls_y2026m05 PARTITION OF polls FOR VALUES FROM (...) TO (...);
DoD:
  - EXPLAIN на старых query показывает partition pruning.
  - pg_partman кронит создание новых партиций.
```

### P2-9 Storybook → Chromatic

```
Цель: PR блокируется на визуальной регрессии UI.
Шаги:
  1. chromatic.com → project token.
  2. .github/workflows/chromatic.yml: chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
  3. Approve baseline на main.
DoD:
  - PR с визуальной регрессией = red status.
```

### P2-10 Read replica

```
Цель: тяжёлые аналитические query не мешают prod трафику.
Шаги:
  1. PG streaming replication: основной → replica.
  2. Prisma: replica DATABASE_URL_READ для read-only сервисов
     (stats, history) — отдельный PrismaClient instance.
DoD:
  - p95 read endpoints на replica.
  - Lag < 1s в нормальном состоянии.
```

---

## Phase 3 DoD overall

- [x] Все scaffold-файлы созданы.
- [x] Backend type-check чистый.
- [x] PROCESS_ROLE env работает (по умолчанию full, ничего не меняется).
- [x] Avatar storage abstraction готова к swap on S3 driver.
- [x] Feature flags провайдер готов, EnvProvider работает.
- [x] OpenTelemetry scaffold — feature-gated, без overhead пока выключен.
- [x] pgBouncer документация готова.
- [ ] Avatar controller адаптирован на `avatarStorage.fetch()`.
- [ ] Первая фича за feature flag.
- [ ] OTel пакеты установлены, collector развёрнут (когда нужна distributed trace).
- [ ] PROCESS_ROLE split на проде (когда G0-9 + P1-2 закрыты).

После Phase 3 проект имеет ВСЕ архитектурные опоры для роста до 10× нагрузки и feature velocity без рисков. Дальше — Phase 4: BullMQ adoption, Playwright E2E, monitor adoption, перенос gamification в отдельный namespace.
