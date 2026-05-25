-- Phase 1 (P0-2) — composite indexes for hot read-paths.
--
-- CONCURRENTLY: создаём индексы без эксклюзивного локa таблицы. Дольше, но
-- не блокирует прод-трафик. Prisma migrate не умеет CONCURRENTLY — поэтому
-- ставим вручную через:
--   psql -h <host> -U foodbot -d foodbot -f migration.sql
-- ИЛИ оборачиваем в раздельные транзакции (CONCURRENTLY требует автокоммит).
--
-- После применения локально:
--   npx prisma migrate resolve --applied 20260525_p0_2_indexes
--   npx prisma migrate status   → up to date
--
-- IF NOT EXISTS — идемпотентность.

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "polls_group_id_status_created_at_idx"
  ON "polls" ("group_id", "status", "created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "transactions_poll_id_status_idx"
  ON "transactions" ("poll_id", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "donations_user_id_status_idx"
  ON "donations" ("user_id", "status");

-- Audit:
--   SELECT indexname, tablename FROM pg_indexes
--   WHERE indexname IN (
--     'polls_group_id_status_created_at_idx',
--     'transactions_poll_id_status_idx',
--     'donations_user_id_status_idx'
--   );
