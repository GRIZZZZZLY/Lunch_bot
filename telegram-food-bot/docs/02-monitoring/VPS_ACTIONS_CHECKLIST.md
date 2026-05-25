# VPS Actions Checklist — что делать когда сервер появится

**Status:** VPS пока нет. Этот документ агрегирует ВСЕ ручные действия из Phase 0..3, которые требуют доступа к серверу.
**Цель:** когда поднимешь VPS — открыть этот файл, пройти сверху вниз.

---

## STEP 0 — Initial provisioning (один раз, ~1 час)

Базовый сетап VPS до того, как накатывать наш код.

| # | Команда / действие | Зачем |
|---|---|---|
| 0.1 | `sudo apt update && sudo apt upgrade -y` | Свежий базовый image |
| 0.2 | Установить Node.js 22 (через nodesource) | Бэкенд требует ≥22 |
| 0.3 | Установить PostgreSQL 18 (`apt install postgresql-18`) | Прод-БД |
| 0.4 | `sudo apt install -y nginx certbot python3-certbot-nginx` | Reverse proxy + SSL |
| 0.5 | `sudo apt install -y docker.io docker-compose-v2` | Для Redis-контейнера |
| 0.6 | `sudo apt install -y restic jq` | Для off-site backup + ci-baseline |
| 0.7 | `npm install -g pm2` | Process manager |
| 0.8 | Создать пользователя `igor`, `usermod -aG docker igor` | Не работаем под root |
| 0.9 | DuckDNS обновитель в cron (если IP динамический) | rocket-lunch.duckdns.org |
| 0.10 | `certbot --nginx -d rocket-lunch.duckdns.org` | TLS cert |

После этого — clone repo, `cd telegram-food-bot && ./deploy-vps.sh`. Проверить `pm2 status`.

---

## STEP 1 — Phase 0 gates (критично, ~2 часа)

Включить приборы и страховку. **Делать ДО любых оптимизаций** — иначе будем мерить наугад.

### 1.1 — pg_stat_statements

```bash
# Найти postgresql.conf
sudo -u postgres psql -c "SHOW config_file;"
# Отредактировать найденный файл, добавить:
#   shared_preload_libraries = 'pg_stat_statements'
#   pg_stat_statements.track = all
#   pg_stat_statements.max = 5000
#   log_min_duration_statement = 200ms
#   log_lock_waits = on

sudo systemctl restart postgresql

# Зарегистрировать в нужной БД
sudo -u postgres psql -d foodbot -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
sudo -u postgres psql -d foodbot -c "GRANT pg_read_all_stats TO foodbot;"
```

Через сутки — собрать топ-20 запросов (запрос в [PHASE_0_RUNBOOK.md § G0-1](./PHASE_0_RUNBOOK.md#g0-1--pg_stat_statements-на-vps)).

### 1.2 — Redis prod (обязательно для idempotency)

```bash
# В docker-compose.yml рядом с PG (см. PHASE_0_RUNBOOK § G0-9)
docker compose up -d redis
docker compose ps redis  # → healthy

# backend/.env
echo 'REDIS_ENABLED=true' >> backend/.env
echo 'REDIS_URL=redis://127.0.0.1:6379/0' >> backend/.env

pm2 reload rocket-lunch-bot --update-env
```

Если хочется hard-fail при `REDIS_ENABLED=false` в проде — поправить [backend/src/config/redis.config.ts](../../backend/src/config/redis.config.ts) согласно § G0-9.

### 1.3 — Off-site backup (restic)

См. [PHASE_0_RUNBOOK § G0-6](./PHASE_0_RUNBOOK.md#g0-6--off-site-backup-restic).

```bash
# Выбрать хранилище: Backblaze B2 / Hetzner Storage Box / любой S3
# Создать ~/.config/restic.env с creds (chmod 600)
restic init      # один раз
crontab -e       # каждые 6 часов: scripts/backup-postgres-offsite.sh

# Через неделю — restore drill в staging
```

### 1.4 — Sentry Performance dashboard (внешний UI, не VPS)

См. [PHASE_0_RUNBOOK § G0-2](./PHASE_0_RUNBOOK.md#g0-2--sentry-performance-dashboard). На sentry.io: создать saved search, dashboard, 3 алерта.

---

## STEP 2 — Phase 1 wins (~1 час)

### 2.1 — Применить composite indexes (CONCURRENTLY)

```bash
# Off-peak window!
psql -h localhost -U foodbot -d foodbot \
  -f backend/prisma/migrations/20260525_p0_2_indexes/migration.sql

cd backend
npx prisma migrate resolve --applied 20260525_p0_2_indexes
npx prisma migrate status   # → up to date
```

EXPLAIN ANALYZE before/after — обязательно (запросы в [PHASE_1_RUNBOOK § P0-2](./PHASE_1_RUNBOOK.md#p0-2--prisma-composite-indexes--concurrently-migration)).

### 2.2 — Применить payment_channel migration

```bash
psql -h localhost -U foodbot -d foodbot \
  -f backend/prisma/migrations/20260525_p1_8_payment_channel/migration.sql

cd backend
npx prisma migrate resolve --applied 20260525_p1_8_payment_channel
```

### 2.3 — Nginx brotli + immutable cache

```bash
sudo apt install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
sudo nano /etc/nginx/sites-available/rocket-lunch
# Вставить блок из PHASE_1_RUNBOOK § P0-4 (brotli, cache-control immutable, /index.html no-cache, sentry-trace headers)
sudo nginx -t && sudo systemctl reload nginx

# Verify
curl -H "Accept-Encoding: br" -I https://rocket-lunch.duckdns.org/assets/<hash>.js
# → content-encoding: br, cache-control: public, max-age=31536000, immutable
```

### 2.4 — CI release tag (GH Actions, не VPS)

В `.github/workflows/deploy.yml`:
```yaml
- env:
    VITE_GIT_COMMIT_SHA: ${{ github.sha }}    # frontend build
- env:
    SENTRY_RELEASE: ${{ github.sha }}          # pm2 reload --update-env
```

После деплоя в Sentry на новых event'ах виден `release: <git_sha>`.

---

## STEP 3 — Phase 1 follow-ups (~2 часа, не блокирует)

Не VPS, но делать параллельно после деплоя.

| # | Где | Что |
|---|---|---|
| 3.1 | `frontend/src/hooks/*` | Прописать `staleTime: STALE_TIMES.X` для каждого критичного `useQuery` (10-15 файлов) |
| 3.2 | 4 файла фронта | Заменить `react-confetti` на `LazyConfetti` (см. PHASE_1_RUNBOOK § P0-5) |
| 3.3 | `donation.controller.ts` | Заполнять `paymentChannel` при create/confirm (см. PHASE_2_RUNBOOK § P1-8) |
| 3.4 | `frontend/src/services/api.ts` | Прокидывать стабильный Idempotency-Key через React Query mutationFn (см. PHASE_1_RUNBOOK § P0-7) |

---

## STEP 4 — Phase 2 cleanup (1-2 часа, не блокирует)

Расширение adoption паттернов на остальные controllers и services.

| # | Где | Что |
|---|---|---|
| 4.1 | `backend/src/api/controllers/*` | Адаптировать на `respondProblem(res, req, problems.*)` вместо инлайн `res.status().json()` |
| 4.2 | `getPollById`, `BudgetService.getDebts/getCredits`, `UserService.getProfile`, `GroupService.getGroupMembers` | Обернуть в `cacheService.getOrSet` (см. PHASE_2_RUNBOOK § P1-2) |
| 4.3 | `avatar.controller.ts` | Использовать `avatarStorage.fetch(fileId)` (см. PHASE_3_RUNBOOK § P2-5) |

---

## STEP 5 — Phase 3 activation (когда придёт нагрузка)

Большинство — крупные шаги, делать когда видим реальную потребность.

### 5.1 — PM2 cluster mode (только после Redis prod + cache adoption)

См. [PHASE_1_RUNBOOK § P0-3](./PHASE_1_RUNBOOK.md#p0-3--pm2-graceful-shutdown--cluster-prep). В `ecosystem.config.js` переключить `instances: 1, exec_mode: 'fork'` на `instances: 'max', exec_mode: 'cluster'`.

### 5.2 — Split monolith (когда монолит начнёт мешать)

См. [PHASE_3_RUNBOOK § P2-1](./PHASE_3_RUNBOOK.md#p2-1--split-monolith-prep). В `ecosystem.config.js` раскомментировать 2-app блок, вынести notification.service на Redis pub/sub.

### 5.3 — pgBouncer (когда упрёмся в connection limit)

См. [PHASE_3_RUNBOOK § P2-2](./PHASE_3_RUNBOOK.md#p2-2--prisma-pgbouncer-prep). Установить pgbouncer, переключить DATABASE_URL на порт 6432.

### 5.4 — OpenTelemetry stack (когда Sentry tracing перестанет хватать)

См. [PHASE_3_RUNBOOK § P2-3](./PHASE_3_RUNBOOK.md#p2-3--opentelemetry-scaffold).
1. `npm install @opentelemetry/*` (5 пакетов).
2. Развернуть Tempo / Jaeger через docker-compose.
3. Добавить `import './utils/telemetry'` ПЕРВЫМ в index.ts.
4. `OTEL_ENABLED=true OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`.

### 5.5 — S3 для аватаров (когда Telegram CDN flakiness станет заметна)

См. [PHASE_3_RUNBOOK § P2-5](./PHASE_3_RUNBOOK.md#p2-5--avatar-storage-abstraction).
1. Создать bucket (Backblaze B2 / Cloudflare R2 / Yandex Object Storage).
2. `npm install @aws-sdk/client-s3`.
3. Доимплементить [s3-storage.driver.ts](../../backend/src/services/avatar-storage/s3-storage.driver.ts) (план в header).
4. `AVATAR_STORAGE_DRIVER=s3` + 4 env-creds.

### 5.6 — Cloudflare edge (когда придут пользователи не из Москвы)

См. [PHASE_3_RUNBOOK § P2-7](./PHASE_3_RUNBOOK.md#p2-7-cloudflare-edge).
1. DNS на Cloudflare.
2. SSL = Full Strict (не Flexible).
3. Page Rules: `/assets/*` → Cache Everything, Edge TTL 1 year.
4. WAF: rate-limit `/api/auth/*`.

### 5.7 — Read replica (когда аналитика начнёт мешать)

См. [PHASE_3_RUNBOOK § P2-10](./PHASE_3_RUNBOOK.md#p2-10-read-replica). PG streaming replication, отдельный `DATABASE_URL_READ` для stats/history.

### 5.8 — Partitioning (когда > 10M строк в polls/votes/transactions)

См. [PHASE_3_RUNBOOK § P2-8](./PHASE_3_RUNBOOK.md#p2-8-partitioning). Range partitioning по `created_at` (monthly) + pg_partman.

### 5.9 — Storybook → Chromatic (когда фронт-команда вырастет)

См. [PHASE_3_RUNBOOK § P2-9](./PHASE_3_RUNBOOK.md#p2-9-storybook--chromatic).

---

## Приоритеты (если VPS появится сейчас)

**Неделя 1:**
- Step 0 (provision)
- Step 1.1 — pg_stat_statements (баклоркает любую оптимизацию БД)
- Step 1.2 — Redis prod (idempotency сейчас бесшумно проваливается на dev fallback)
- Step 1.3 — off-site backup (без неё первый сбой диска = потеря данных)

**Неделя 2:**
- Step 1.4 — Sentry dashboard
- Step 2 — все P0 wins (индексы, nginx, payment_channel migration, CI release tag)
- Step 3.1-3.4 — adoption tasks параллельно

**Неделя 3-4:**
- Step 4 — cleanup adoption (problem+json, cache, avatar)
- Замер эффекта через Sentry (p95 endpoints / Web Vitals) — фиксировать baseline до/после

**Месяц 2+:**
- Step 5.1 PM2 cluster (когда RPS вырастет)
- Step 5.5 S3 для аватаров (когда жалобы на скорость)
- Step 5.6 Cloudflare (когда трафик из других регионов)

**Месяц 3+ (зависит от роста):**
- Step 5.2 split monolith
- Step 5.3 pgBouncer
- Step 5.4 OTel
- Step 5.7-5.9

---

## Что НЕ требует VPS (можно делать прямо сейчас на ноуте)

- Step 3 целиком (frontend hooks + LazyConfetti adoption + Idempotency-Key через React Query + payment_channel controller).
- Step 4.1-4.3 целиком (problem+json adoption, cache adoption, avatar storage adoption).

Это всё — следующий estimated batch на 4-6 часов работы. Сделать когда будет настроение или появится сервер — без разницы.

---

## Связанные документы

- [PHASE_0_RUNBOOK.md](./PHASE_0_RUNBOOK.md) — детали gates
- [PHASE_1_RUNBOOK.md](./PHASE_1_RUNBOOK.md) — детали P0 wins
- [PHASE_2_RUNBOOK.md](./PHASE_2_RUNBOOK.md) — детали P1 refactors
- [PHASE_3_RUNBOOK.md](./PHASE_3_RUNBOOK.md) — детали P2 scaffolds
