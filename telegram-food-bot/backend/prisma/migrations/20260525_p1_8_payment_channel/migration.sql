-- Phase 2 (P1-8) — payment channel tracking on Donation.
--
-- Legacy `method` остаётся как есть (STARS / WALLET / SBP_MANUAL — free-form
-- от Telegram payments callbacks). Новое поле `payment_channel` — нормализованный
-- enum-подобный канал для аналитики: STARS | SBP | WALLET | OTHER. Заполняется
-- бэкендом при confirmPayment в donation.controller, mapping из method/source.
--
-- Backward compat: nullable, индекс composite (channel, status).
--
-- Применение:
--   ALTER TABLE — мгновенный для добавления nullable.
--   CREATE INDEX CONCURRENTLY — без локa таблицы.

ALTER TABLE "donations"
  ADD COLUMN IF NOT EXISTS "payment_channel" TEXT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  "donations_payment_channel_status_idx"
  ON "donations" ("payment_channel", "status");

-- Backfill для исторических donations:
-- map method (STARS | WALLET | SBP_MANUAL) → payment_channel (STARS | WALLET | SBP).
UPDATE "donations"
SET "payment_channel" = CASE
  WHEN "method" = 'STARS'      THEN 'STARS'
  WHEN "method" = 'WALLET'     THEN 'WALLET'
  WHEN "method" = 'SBP_MANUAL' THEN 'SBP'
  ELSE 'OTHER'
END
WHERE "payment_channel" IS NULL;

-- Audit:
--   SELECT payment_channel, status, COUNT(*) FROM donations GROUP BY 1, 2 ORDER BY 1, 2;
