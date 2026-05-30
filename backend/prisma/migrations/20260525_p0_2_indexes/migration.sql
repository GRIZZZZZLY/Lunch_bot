-- Phase 1 (P0-2) — composite indexes for hot read-paths.
--
-- Обычный CREATE INDEX (НЕ CONCURRENTLY): `prisma migrate deploy` оборачивает
-- миграцию в транзакцию, где CONCURRENTLY запрещён (E25001). Таблицы небольшие
-- → краткий лок на построение индекса некритичен.
--
-- IF NOT EXISTS — идемпотентность (безопасно при повторном применении).

CREATE INDEX IF NOT EXISTS
  "polls_group_id_status_created_at_idx"
  ON "polls" ("group_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS
  "transactions_poll_id_status_idx"
  ON "transactions" ("poll_id", "status");

CREATE INDEX IF NOT EXISTS
  "donations_user_id_status_idx"
  ON "donations" ("user_id", "status");

-- Audit:
--   SELECT indexname, tablename FROM pg_indexes
--   WHERE indexname IN (
--     'polls_group_id_status_created_at_idx',
--     'transactions_poll_id_status_idx',
--     'donations_user_id_status_idx'
--   );
