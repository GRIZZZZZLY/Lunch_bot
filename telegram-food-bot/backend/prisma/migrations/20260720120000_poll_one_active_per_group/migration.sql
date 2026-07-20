-- Не более одного ACTIVE-голосования на группу.
-- Prisma schema не умеет выражать частичный (filtered) уникальный индекс,
-- поэтому миграция ручная (в тестах тот же индекс накатывает globalSetup.ts).
-- Защита от гонки конкурентных createPoll, в т.ч. при нескольких процессах бота
-- (инцидент 2026-07-20: orphan-процесс + pm2-процесс создали два голосования).
-- Без CONCURRENTLY: migrate deploy выполняет миграции внутри транзакции.
CREATE UNIQUE INDEX IF NOT EXISTS "polls_one_active_per_group"
  ON "polls" ("group_id")
  WHERE "status" = 'ACTIVE';
