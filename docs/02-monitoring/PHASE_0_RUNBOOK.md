# Phase 0 — Measurement & Correctness Gates (Runbook)

**Дата:** 2026-05-25
**Цель фазы:** включить приборы и страховку, пока никакая оптимизация ещё не сделана. Без Phase 0 любые цифры P0/P1/P2 = угадайка.

Содержание:

1. [G0-1 — pg_stat_statements на VPS](#g0-1--pg_stat_statements-на-vps)
2. [G0-2 — Sentry Performance dashboard](#g0-2--sentry-performance-dashboard)
3. [G0-3 — Trace propagation server↔client](#g0-3--trace-propagation-serverclient) ✅ done in code
4. [G0-4 — web-vitals → Sentry](#g0-4--web-vitals--sentry) ✅ done in code
5. [G0-5 — CI baseline](#g0-5--ci-baseline)
6. [G0-6 — Off-site backup (restic)](#g0-6--off-site-backup-restic)
7. [G0-7 — Outbound Telegram throttler](#g0-7--outbound-telegram-throttler) ✅ done in code
8. [G0-8 — Idempotency keys на write-endpoints](#g0-8--idempotency-keys-на-write-endpoints) ✅ done in code (см. фронтенд-обвязку ниже)
9. [G0-9 — Redis обязательным в проде](#g0-9--redis-обязательным-в-проде)

Что осталось руками после мержа: VPS-задачи (G0-1, G0-6 cron, G0-9 docker-compose), Sentry UI (G0-2), фронтенд-обвязка Idempotency-Key (см. G0-8).

---

## G0-1 — pg_stat_statements на VPS

**Цель:** видеть топ-N долгих SQL-запросов с агрегатами; без этого любой разговор об индексах = пальцем в небо.

### Шаги

```bash
# 1. Включить расширение в postgresql.conf
sudo -u postgres psql -c "SHOW config_file;"
# редактируем найденный путь, добавляем/правим:
#   shared_preload_libraries = 'pg_stat_statements'
#   pg_stat_statements.track = all
#   pg_stat_statements.max = 5000
#   log_min_duration_statement = 200ms
#   log_lock_waits = on
#   log_temp_files = 0

sudo systemctl restart postgresql

# 2. Зарегистрировать расширение в каждой нужной БД
sudo -u postgres psql -d foodbot -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# 3. Дать foodbot-пользователю доступ к статистике (без SUPERUSER)
sudo -u postgres psql -d foodbot -c "GRANT pg_read_all_stats TO foodbot;"
```

### Сбор данных через сутки

```sql
-- Топ-20 запросов по суммарному времени выполнения
SELECT
  substring(query, 1, 120)                              AS query,
  calls,
  round(total_exec_time::numeric, 0)                    AS total_ms,
  round(mean_exec_time::numeric, 2)                     AS mean_ms,
  round((100 * total_exec_time / sum(total_exec_time)
        OVER ())::numeric, 1)                            AS pct_total,
  rows,
  round(shared_blks_hit::numeric
        / NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 1) AS cache_hit_pct
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- EXPLAIN ANALYZE на топ-5 (через psql, подставив query руками)
```

### DoD

- [ ] `SELECT * FROM pg_stat_statements LIMIT 1;` отдаёт строки от имени `foodbot`.
- [ ] Сохранён отчёт `docs/02-monitoring/PG_BASELINE_<date>.md` с топ-20 запросов.
- [ ] На каждый из топ-5 endpoints прогнан `EXPLAIN ANALYZE` — записан план до P0-2 (для diff после индексов).

### Edge cases

- Reset статистики при рестарте — копи отчёт перед `systemctl restart postgresql`.
- `pg_stat_statements.track_utility = off` если хочешь видеть только DML, не DDL.

---

## G0-2 — Sentry Performance dashboard

**Цель:** p50/p95/p99 по каждому endpoint в UI Sentry, алерты на регрессии.

### Шаги

1. Sentry → Performance → Transactions.
2. Создать Saved Search: `transaction.op:http.server` для серверных транзакций и отдельную для `pageload`/`navigation` — клиентских.
3. Создать Dashboard «foodbot — perf»:
   - Widget «Top transactions by p95» (table, sort by p95).
   - Widget «Throughput per route» (line).
   - Widget «Failure rate» (line).
   - Widget «Web Vitals» (LCP / INP / CLS — после деплоя G0-4 они начнут поступать).
4. Алерты:
   - p95 > 500ms на топ-5 (`POST /api/votes/multiple`, `GET /api/budget/debts`, `POST /api/budget/mark-paid`, `GET /api/polls/active`, `POST /api/store-runs`) → Slack/email.
   - failure_rate > 1% за 5 мин на любом endpoint → critical.
   - LCP p75 > 2.5s → warning; > 4s → critical.

### DoD

- [ ] Ссылка на dashboard в `docs/02-monitoring/SENTRY_DASHBOARD.md`.
- [ ] Алерты включены и отписан тестовый алерт (искусственный 5xx).
- [ ] В Sentry → Performance → Web Vitals видны метрики LCP/INP/CLS (G0-4).
- [ ] В одной транзакции `POST /api/votes/multiple` видны вложенные browser+server spans (G0-3).

### Edge cases

- Если используется GlitchTip (self-hosted) — Performance vidu есть с GlitchTip 4.x, но Web Vitals дашборд урезан. Кастомные measurements (`web_vital.lcp` и т.п.) можно вывести в Discover/Explore.
- `tracesSampleRate=0.1` уже выставлен — на этом объёме данных p95 стабилен через ~1 час.

---

## G0-3 — Trace propagation server↔client ✅ done in code

**Сделано:** [frontend/src/lib/sentry.ts](../../frontend/src/lib/sentry.ts) — добавлен `tracePropagationTargets` на `/api/*` и `rocket-lunch.duckdns.org`.

**Проверить после деплоя:**

- В Sentry → Performance → выбрать любую `pageload` транзакцию → во вкладке «Trace» должны быть и client-spans (`http.client GET /api/...`), и server-spans (`http.server POST /api/votes/...`) под одним trace_id.
- В DevTools → Network на любом `/api/*` запросе должен быть header `sentry-trace: <traceId>-<spanId>-<sampled>` и `baggage`.

**Edge:** при переносе на новый домен (Cloudflare и т.п.) расширь regex или просто оставь `/^\//` — он покрывает все same-origin запросы.

---

## G0-4 — web-vitals → Sentry ✅ done in code

**Сделано:**

- Новый модуль [frontend/src/lib/web-vitals.ts](../../frontend/src/lib/web-vitals.ts) — подписывается на `onCLS`/`onFCP`/`onINP`/`onLCP`/`onTTFB`, прицепляет значения как `setAttribute` на активный span + breadcrumbs.
- [frontend/src/main.tsx](../../frontend/src/main.tsx) — вызов `initWebVitals()` после `initSentry()`.

**Проверить после деплоя:**

- Открой Mini App → закрой → подожди ~10 сек (INP/CLS финализируются на page unload).
- Sentry → Performance → выбери последнюю `pageload` транзакцию → во вкладке «Attributes» должны быть `web_vital.lcp`, `web_vital.inp`, `web_vital.cls`, `web_vital.fcp`, `web_vital.ttfb`.
- В Issues → у любого error события должны быть breadcrumbs категории `web-vital`.

**Edge:** Telegram WebApp иногда сворачивается до `pagehide` — INP/CLS успевают отправиться благодаря web-vitals's внутреннему flush на `visibilitychange`.

---

## G0-5 — CI baseline

**Цель:** зафиксировать «сколько сейчас идёт CI», чтобы мерить эффект кеширования (P0-21).

### Шаги

```bash
# Локально (требует gh + jq)
./scripts/ci-baseline.sh 30
# вывод → перенаправить в docs/02-monitoring/CI_BASELINE.md
./scripts/ci-baseline.sh 30 > docs/02-monitoring/CI_BASELINE.md
```

### DoD

- [ ] `docs/02-monitoring/CI_BASELINE.md` существует с per-workflow p50/p95/avg/max.
- [ ] Обновлять файл раз в неделю (можно автоматизировать через GH Actions cron).

---

## G0-6 — Off-site backup (restic)

**Цель:** пережить смерть VPS-диска. Сейчас [backup-db.sh](../../backup-db.sh) льёт на тот же диск, что и БД, плюс ссылается на SQLite (`prod.db`) — мёртвый артефакт после миграции на PostgreSQL.

### Шаги

```bash
# 1. Установить restic на VPS
sudo apt update && sudo apt install -y restic

# 2. Создать удалённое хранилище. Варианты:
#    - Backblaze B2 (дёшево, $0.006/GB/мес)
#    - Hetzner Storage Box (€1.2/мес за 100GB)
#    - AWS S3 / S3-compatible
#    Пример B2:
restic -r b2:foodbot-backups:/postgres init
# вводит пароль шифрования — СОХРАНИТЬ в менеджере паролей, без него restore невозможен

# 3. Положить credentials в ~/.config/restic.env (chmod 600)
cat > ~/.config/restic.env <<'EOF'
export RESTIC_REPOSITORY="b2:foodbot-backups:/postgres"
export RESTIC_PASSWORD="<сильный пароль>"
export B2_ACCOUNT_ID="<keyId>"
export B2_ACCOUNT_KEY="<applicationKey>"
export DB_PASSWORD="<foodbot db password>"
EOF
chmod 600 ~/.config/restic.env

# 4. Поставить cron (каждые 6 часов)
crontab -e
# добавить:
# 0 */6 * * * /home/igor/Lunch_bot/telegram-food-bot/scripts/backup-postgres-offsite.sh >> /var/log/foodbot-backup.log 2>&1

# 5. Прогнать вручную и проверить
/home/igor/Lunch_bot/telegram-food-bot/scripts/backup-postgres-offsite.sh
restic snapshots
```

### Restore drill (раз в квартал)

```bash
# В staging-окружение, НЕ в прод
restic snapshots
restic restore <id> --target /tmp/restore
gunzip -c /tmp/restore/tmp/foodbot-backup/foodbot-*.sql.gz | psql -h localhost -U foodbot -d foodbot_test
# Проверить чтение нескольких таблиц
psql -h localhost -U foodbot -d foodbot_test -c "SELECT count(*) FROM \"Poll\";"
```

### DoD

- [ ] `restic snapshots` показывает свежий snapshot не старше 6 часов.
- [ ] Restore drill в staging прошёл за < 30 минут (RTO target).
- [ ] Шаги записаны в `docs/02-monitoring/BACKUP_RUNBOOK.md` с реальными значениями (без секретов!).

### Edge cases

- `restic check` стоит делать раз в сутки (скрипт уже это делает в 03:00).
- pg_dump в режиме `--format=plain` упрощает diff между снапшотами и читается любым psql — `--format=custom` экономит место, но требует pg_restore.
- При major-апгрейде PostgreSQL (18 → 19) бэкап в формате `plain` переживает версию, `custom` — может потребовать pg_restore той же major.

---

## G0-7 — Outbound Telegram throttler ✅ done in code

**Сделано:** [backend/src/bot/bot.ts](../../backend/src/bot/bot.ts) — добавлен `@grammyjs/transformer-throttler` ПЕРЕД auto-retry.

```
global: 30 msg/sec    ← Telegram bot global flood limit
group:  20 msg/min    ← Telegram per-group limit
out:    1 msg/sec per chat
```

**Зачем:** до этого `notifyGroupMembersAboutStoreRun()` и `sendPollEndedNotification()` шли через `Promise.all(userIds.map(send))` — на группе 30+ человек первый же залп ловил `429 retry_after: 30`. Throttler стоит ДО auto-retry, чтобы retry не складывались поверх лимита.

**Проверить после деплоя:**

- Sentry breadcrumbs: должны исчезнуть `Telegram API error 429` на нагрузочных событиях.
- При синтетическом тесте (создать poll в group из 100 fake-юзеров и завершить) ни одного 429 в логах.

**Edge:** throttler буферизует в памяти процесса — при `pm2 reload` буфер теряется. Для P1-1 (BullMQ) это станет неважно, очередь в Redis переживёт reload.

---

## G0-8 — Idempotency keys на write-endpoints ✅ done in code (backend)

**Сделано:**

- Новый middleware [backend/src/api/middleware/idempotency.ts](../../backend/src/api/middleware/idempotency.ts).
- Применён к routes: vote, budget (mark-paid / confirm-payment / cancel-mark / send-reminder / send-reminders-all), feedback, store-run (create / addItems / setItemPrice / start-shopping / settle / cancel).

**Контракт для клиента:**

```http
POST /api/votes/multiple HTTP/1.1
Idempotency-Key: 7b2c8e3a-9f4b-4f2e-bb91-9c2e0a8d5e10
Content-Type: application/json
...
```

- Ключ — UUID v4 (`crypto.randomUUID()`), генерируется один на одно пользовательское действие.
- TTL — 24 часа.
- На повторе сервер вернёт оригинальный ответ + хедер `X-Idempotent-Replayed: true`.
- На повторе в окне выполнения (handler ещё не вернул) сервер ответит `409 IDEMPOTENCY_INFLIGHT` с `Retry-After: 2`.

### Что осталось руками (фронт)

- В [frontend/src/services/api.ts](../../frontend/src/services/api.ts) добавить axios request interceptor:
  ```ts
  api.interceptors.request.use((cfg) => {
    if (cfg.method?.toUpperCase() === 'POST' && !cfg.headers['Idempotency-Key']) {
      cfg.headers['Idempotency-Key'] = crypto.randomUUID();
    }
    return cfg;
  });
  ```
- Для критичных мутаций (vote, mark-paid, confirm-payment) — передавать **тот же** ключ при ретраях из React Query. Использовать ключ из контекста мутации, а не генерировать заново на каждый attempt.

### DoD

- [ ] Бэкенд: integration test — два параллельных POST с одним Idempotency-Key → одна транзакция в БД, два одинаковых JSON-ответа.
- [ ] Фронт: на ретраях React Query (network flake) повторяет тот же ключ.
- [ ] Sentry: добавить таг `idempotent.replayed=true` через `event.tags` в interceptor — отслеживать, как часто срабатывает дедупликация.

### Edge cases

- `cacheService` graceful-fallback'ит при `REDIS_ENABLED=false` → middleware пропускает запрос с warn-логом. На проде ОБЯЗАТЕЛЬНО Redis (см. G0-9).
- 5xx ответы НЕ кешируются — клиент должен иметь возможность ретраить.
- Ключ скоупится по `req.user.id` (или IP для гостевых endpoint'ов), чтобы атакующий не подсунул чужой Idempotency-Key.

---

## G0-9 — Redis обязательным в проде

**Цель:** разблокировать G0-8 (idempotency) и подготовить ground для P0-3 (PM2 cluster). Сейчас [backend/src/services/cache.service.ts](../../backend/src/services/cache.service.ts) допускает `REDIS_ENABLED=false` — это нормально для dev, но в проде = бесшумно сломанная idempotency.

### Шаги (VPS)

```bash
# 1. Docker-compose уже есть для PG; добавим redis сервис рядом
# В docker-compose.yml (или отдельный redis.compose.yml):
cat >> docker-compose.yml <<'YAML'
  redis:
    image: redis:7-alpine
    container_name: foodbot-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"     # bind на localhost, не наружу
    volumes:
      - ./redis-data:/data
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
YAML

docker compose up -d redis
docker compose ps redis     # healthy

# 2. backend/.env (прод)
echo 'REDIS_ENABLED=true' >> backend/.env
echo 'REDIS_URL=redis://127.0.0.1:6379/0' >> backend/.env

# 3. pm2 reload
pm2 reload rocket-lunch-bot
```

### Жёсткое требование (после деплоя)

Сделать `REDIS_ENABLED=true` обязательным в проде — стартап-чек, который валит приложение, если в `NODE_ENV=production` Redis недоступен. Файл [backend/src/config/redis.config.ts](../../backend/src/config/redis.config.ts) — добавить:

```ts
if (process.env.NODE_ENV === 'production' && !REDIS_ENABLED) {
  throw new Error(
    '[FATAL] REDIS_ENABLED=false запрещён в production: idempotency keys и rate-limit упадут на shared state.'
  );
}
```

### DoD

- [ ] `docker compose ps redis` показывает `healthy` на VPS.
- [ ] Бэкенд при старте логирует `✅ Cache service initialized with Redis`.
- [ ] Hard-fail сработал бы при `REDIS_ENABLED=false` в проде (проверить локально с `NODE_ENV=production`).
- [ ] backup-postgres-offsite.sh не трогает redis-data (тома НЕ нужно бэкапить — кеш восстановим).

### Edge cases

- AOF `appendonly yes` — переживает restart Redis с минимальной потерей (1 сек). Этого хватает для idempotency.
- `maxmemory-policy allkeys-lru` — при переполнении 256MB начнём вытеснять самые старые ключи. Idempotency TTL 24h — должно хватать.
- При переходе на PM2 cluster (P1-3) Redis уже будет общим хранилищем — никаких изменений не требуется.

---

## Critical-path sequencing

```
G0-7 (throttler)  ──┐
G0-8 (idempotency) ─┼── ШИП НЕМЕДЛЕННО (deploy this week)
G0-9 (redis prod)  ─┤   без них = риск аварии в первой большой группе
G0-6 (off-site bkp)─┘
        ↓
G0-1 (pg_stat_statements)  ── собирает данные сутки
G0-2 (sentry dash)         ── собирает Web Vitals сутки
G0-3, G0-4 (deploy-and-wait)
G0-5 (CI baseline)         ── once
        ↓
→ ready for Phase 1 (P0)
```

## Definition of Done — Phase 0

- [x] `frontend/src/lib/sentry.ts` — tracePropagationTargets
- [x] `frontend/src/lib/web-vitals.ts` + main.tsx wiring
- [x] `backend/src/bot/bot.ts` — apiThrottler
- [x] `backend/src/api/middleware/idempotency.ts` + wiring в 4 routes
- [x] `scripts/backup-postgres-offsite.sh`
- [x] `scripts/ci-baseline.sh`
- [ ] VPS: pg_stat_statements включён, baseline собран
- [ ] VPS: Redis-контейнер healthy, REDIS_ENABLED=true в проде
- [ ] VPS: cron на off-site backup стоит, restore drill пройден
- [ ] Sentry: dashboard создан, алерты настроены
- [ ] Фронт: axios interceptor генерит Idempotency-Key для POST'ов
- [ ] CI baseline записан в `docs/02-monitoring/CI_BASELINE.md`
