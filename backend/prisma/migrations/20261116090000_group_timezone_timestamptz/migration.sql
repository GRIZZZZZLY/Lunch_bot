-- Все моменты времени хранятся как timestamptz, у группы появляется пояс.
-- Прежние значения записаны в UTC (Prisma пишет UTC в timestamp(3)),
-- поэтому AT TIME ZONE 'UTC' переносит их без сдвига. Столбцов: 98.

ALTER TABLE "groups" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';

ALTER TABLE "users"
  ALTER COLUMN "avatar_updated_at" TYPE TIMESTAMPTZ(3) USING "avatar_updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "groups"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "menu_items"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "polls"
  ALTER COLUMN "started_at" TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "ended_at" TYPE TIMESTAMPTZ(3) USING "ended_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "poll_participants"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "votes"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "poll_results"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "transactions"
  ALTER COLUMN "paid_at" TYPE TIMESTAMPTZ(3) USING "paid_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "confirmed_at" TYPE TIMESTAMPTZ(3) USING "confirmed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_reminder_at" TYPE TIMESTAMPTZ(3) USING "last_reminder_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "poll_order_costs"
  ALTER COLUMN "entered_at" TYPE TIMESTAMPTZ(3) USING "entered_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "responsible_selections"
  ALTER COLUMN "timeout_at" TYPE TIMESTAMPTZ(3) USING "timeout_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "payment_reminders"
  ALTER COLUMN "sent_at" TYPE TIMESTAMPTZ(3) USING "sent_at" AT TIME ZONE 'UTC';

ALTER TABLE "admin_reminders"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "group_members"
  ALTER COLUMN "joined_at" TYPE TIMESTAMPTZ(3) USING "joined_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "left_at" TYPE TIMESTAMPTZ(3) USING "left_at" AT TIME ZONE 'UTC';

ALTER TABLE "menu_suggestions"
  ALTER COLUMN "reviewed_at" TYPE TIMESTAMPTZ(3) USING "reviewed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "category_orders"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "calculation_started_at" TYPE TIMESTAMPTZ(3) USING "calculation_started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "calculation_completed_at" TYPE TIMESTAMPTZ(3) USING "calculation_completed_at" AT TIME ZONE 'UTC';

ALTER TABLE "order_items"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "order_item_edit_logs"
  ALTER COLUMN "timestamp" TYPE TIMESTAMPTZ(3) USING "timestamp" AT TIME ZONE 'UTC';

ALTER TABLE "user_stats"
  ALTER COLUMN "last_vote_date" TYPE TIMESTAMPTZ(3) USING "last_vote_date" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "xp_history"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "user_progress"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "achievements"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "user_achievements"
  ALTER COLUMN "unlocked_at" TYPE TIMESTAMPTZ(3) USING "unlocked_at" AT TIME ZONE 'UTC';

ALTER TABLE "quests"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "user_quests"
  ALTER COLUMN "started_at" TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';

ALTER TABLE "challenges"
  ALTER COLUMN "deadline" TYPE TIMESTAMPTZ(3) USING "deadline" AT TIME ZONE 'UTC',
  ALTER COLUMN "start_date" TYPE TIMESTAMPTZ(3) USING "start_date" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_date" TYPE TIMESTAMPTZ(3) USING "end_date" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "user_challenge_progress"
  ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "seasons"
  ALTER COLUMN "start_date" TYPE TIMESTAMPTZ(3) USING "start_date" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_date" TYPE TIMESTAMPTZ(3) USING "end_date" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "recurring_polls"
  ALTER COLUMN "last_run_at" TYPE TIMESTAMPTZ(3) USING "last_run_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "next_run_at" TYPE TIMESTAMPTZ(3) USING "next_run_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "debt_reminder_settings"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "admin_notification_settings"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "store_runs"
  ALTER COLUMN "collect_until" TYPE TIMESTAMPTZ(3) USING "collect_until" AT TIME ZONE 'UTC',
  ALTER COLUMN "shopping_at" TYPE TIMESTAMPTZ(3) USING "shopping_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "settled_at" TYPE TIMESTAMPTZ(3) USING "settled_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "cancelled_at" TYPE TIMESTAMPTZ(3) USING "cancelled_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "group_stores"
  ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ(3) USING "last_used_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "archived_at" TYPE TIMESTAMPTZ(3) USING "archived_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "user_item_presets"
  ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ(3) USING "last_used_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "donations"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "confirmed_at" TYPE TIMESTAMPTZ(3) USING "confirmed_at" AT TIME ZONE 'UTC';

ALTER TABLE "store_items"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "outbox_events"
  ALTER COLUMN "next_attempt_at" TYPE TIMESTAMPTZ(3) USING "next_attempt_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "claimed_until" TYPE TIMESTAMPTZ(3) USING "claimed_until" AT TIME ZONE 'UTC',
  ALTER COLUMN "sent_at" TYPE TIMESTAMPTZ(3) USING "sent_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
