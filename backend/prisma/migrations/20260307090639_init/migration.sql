-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "photo_url" TEXT,
    "avatar_url" TEXT,
    "avatar_updated_at" DATETIME,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "payment_card" TEXT,
    "payment_phone" TEXT,
    "payment_details" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegram_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'group',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "menu_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "polls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "duration" INTEGER NOT NULL DEFAULT 30,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "created_by" INTEGER NOT NULL,
    "message_id" INTEGER,
    "chat_id" BIGINT,
    "selected_menu_item_ids" TEXT,
    "is_multi_select" BOOLEAN NOT NULL DEFAULT true,
    "max_selections" INTEGER NOT NULL DEFAULT 3,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "votes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "vote_type" TEXT NOT NULL DEFAULT 'MENU_ITEM',
    "custom_option" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "votes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "poll_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "winner_menu_item_id" INTEGER,
    "responsible_user_id" INTEGER NOT NULL,
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "roulette_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poll_results_winner_menu_item_id_fkey" FOREIGN KEY ("winner_menu_item_id") REFERENCES "menu_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "poll_results_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "poll_results_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "from_user_id" INTEGER NOT NULL,
    "to_user_id" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "menu_item_id" INTEGER,
    "category_order_id" INTEGER,
    "item_price" DECIMAL,
    "delivery_share" DECIMAL,
    "service_share" DECIMAL,
    "tip_share" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" DATETIME,
    "confirmed_at" DATETIME,
    "disputed_reason" TEXT,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_category_order_id_fkey" FOREIGN KEY ("category_order_id") REFERENCES "category_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "poll_order_costs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "delivery_cost" DECIMAL NOT NULL DEFAULT 0,
    "service_fee" DECIMAL NOT NULL DEFAULT 0,
    "tip" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "entered_by" INTEGER NOT NULL,
    "entered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "poll_order_costs_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "responsible_selections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "selected_user_id" INTEGER,
    "volunteer_user_id" INTEGER,
    "roulette_winner_id" INTEGER,
    "timeout_at" DATETIME,
    "timeout_minutes" INTEGER NOT NULL DEFAULT 3,
    "completed_at" DATETIME,
    "message_id" INTEGER,
    "chat_id" BIGINT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "responsible_selections_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "responsible_selections_selected_user_id_fkey" FOREIGN KEY ("selected_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "responsible_selections_volunteer_user_id_fkey" FOREIGN KEY ("volunteer_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "responsible_selections_roulette_winner_id_fkey" FOREIGN KEY ("roulette_winner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transaction_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUTO',
    "sent_by" INTEGER,
    "message" TEXT,
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_reminders_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_reminders_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_reminders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "admin_reminders_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menu_suggestions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suggested_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "reviewed_at" DATETIME,
    "rejection_reason" TEXT,
    "created_menu_item_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "menu_suggestions_suggested_by_fkey" FOREIGN KEY ("suggested_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "menu_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "category_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "responsible_user_id" INTEGER,
    "selection_status" TEXT NOT NULL DEFAULT 'PENDING',
    "calculation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "selection_mode" TEXT,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "delivery_cost" DECIMAL DEFAULT 0,
    "service_fee" DECIMAL DEFAULT 0,
    "tip" DECIMAL DEFAULT 0,
    "notes" TEXT,
    "total_items_amount" DECIMAL DEFAULT 0,
    "total_additional_costs" DECIMAL DEFAULT 0,
    "total_amount" DECIMAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "calculation_started_at" DATETIME,
    "calculation_completed_at" DATETIME,
    CONSTRAINT "category_orders_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "category_orders_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "notes" TEXT,
    "entered_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "order_items_category_order_id_fkey" FOREIGN KEY ("category_order_id") REFERENCES "category_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_item_edit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_item_id" INTEGER NOT NULL,
    "edited_by" INTEGER NOT NULL,
    "field_changed" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_item_edit_logs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_item_edit_logs_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" TEXT NOT NULL DEFAULT 'Новичок',
    "gastro_rating" INTEGER NOT NULL DEFAULT 0,
    "responsible_rating" INTEGER NOT NULL DEFAULT 0,
    "social_rating" INTEGER NOT NULL DEFAULT 0,
    "explorer_rating" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_vote_date" DATETIME,
    "polls_participated" INTEGER NOT NULL DEFAULT 0,
    "polls_won" INTEGER NOT NULL DEFAULT 0,
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "correct_predictions" INTEGER NOT NULL DEFAULT 0,
    "times_responsible" INTEGER NOT NULL DEFAULT 0,
    "times_volunteer" INTEGER NOT NULL DEFAULT 0,
    "orders_received" INTEGER NOT NULL DEFAULT 0,
    "payments_on_time" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "new_dishes_discovered" INTEGER NOT NULL DEFAULT 0,
    "categories_tried" INTEGER NOT NULL DEFAULT 0,
    "menu_items_added" INTEGER NOT NULL DEFAULT 0,
    "referrals_count" INTEGER NOT NULL DEFAULT 0,
    "random_choices" INTEGER NOT NULL DEFAULT 0,
    "win_streak" INTEGER NOT NULL DEFAULT 0,
    "max_win_streak" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "xp_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "season_id" INTEGER,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "xp_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "xp_history_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" TEXT NOT NULL DEFAULT 'Новичок',
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL NOT NULL DEFAULT 0,
    "win_streak" INTEGER NOT NULL DEFAULT 0,
    "max_win_streak" INTEGER NOT NULL DEFAULT 0,
    "categories_tried" INTEGER NOT NULL DEFAULT 0,
    "random_choices" INTEGER NOT NULL DEFAULT 0,
    "correct_predictions" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "xp_reward" INTEGER NOT NULL DEFAULT 0,
    "requirement" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "unlocked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 0,
    "requirement" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "quest_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "expires_at" DATETIME NOT NULL,
    CONSTRAINT "user_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_quests_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "icon" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "deadline" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_challenge_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "challenge_id" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_challenge_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_challenge_progress_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "rewards" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recurring_polls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "days_of_week" TEXT NOT NULL,
    "time_of_day" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "selected_menu_item_ids" TEXT,
    "last_run_at" DATETIME,
    "next_run_at" DATETIME,
    "last_run_status" TEXT,
    "last_run_message" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "recurring_polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "debt_reminder_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_days" INTEGER NOT NULL DEFAULT 3,
    "message_template" TEXT NOT NULL,
    "min_debt_age" INTEGER NOT NULL DEFAULT 1,
    "max_reminders" INTEGER NOT NULL DEFAULT 5,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "debt_reminder_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debt_reminder_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_notification_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "notify_on_new_user" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_new_poll" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_poll_end" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_debt_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "admin_notification_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_telegram_id_key" ON "groups"("telegram_id");

-- CreateIndex
CREATE INDEX "menu_items_is_active_idx" ON "menu_items"("is_active");

-- CreateIndex
CREATE INDEX "polls_status_idx" ON "polls"("status");

-- CreateIndex
CREATE INDEX "polls_started_at_idx" ON "polls"("started_at");

-- CreateIndex
CREATE INDEX "polls_status_started_at_idx" ON "polls"("status", "started_at");

-- CreateIndex
CREATE INDEX "polls_group_id_status_idx" ON "polls"("group_id", "status");

-- CreateIndex
CREATE INDEX "votes_poll_id_idx" ON "votes"("poll_id");

-- CreateIndex
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");

-- CreateIndex
CREATE INDEX "votes_vote_type_idx" ON "votes"("vote_type");

-- CreateIndex
CREATE INDEX "votes_poll_id_user_id_idx" ON "votes"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at");

-- CreateIndex
CREATE INDEX "votes_menu_item_id_idx" ON "votes"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_poll_id_user_id_menu_item_id_key" ON "votes"("poll_id", "user_id", "menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_results_poll_id_key" ON "poll_results"("poll_id");

-- CreateIndex
CREATE INDEX "transactions_poll_id_idx" ON "transactions"("poll_id");

-- CreateIndex
CREATE INDEX "transactions_from_user_id_status_idx" ON "transactions"("from_user_id", "status");

-- CreateIndex
CREATE INDEX "transactions_to_user_id_status_idx" ON "transactions"("to_user_id", "status");

-- CreateIndex
CREATE INDEX "transactions_category_order_id_idx" ON "transactions"("category_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_order_costs_poll_id_key" ON "poll_order_costs"("poll_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsible_selections_poll_id_key" ON "responsible_selections"("poll_id");

-- CreateIndex
CREATE INDEX "admin_reminders_userId_groupId_idx" ON "admin_reminders"("userId", "groupId");

-- CreateIndex
CREATE INDEX "admin_reminders_createdAt_idx" ON "admin_reminders"("createdAt");

-- CreateIndex
CREATE INDEX "group_members_group_id_is_active_idx" ON "group_members"("group_id", "is_active");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "menu_suggestions_status_idx" ON "menu_suggestions"("status");

-- CreateIndex
CREATE INDEX "menu_suggestions_suggested_by_idx" ON "menu_suggestions"("suggested_by");

-- CreateIndex
CREATE INDEX "menu_suggestions_created_at_idx" ON "menu_suggestions"("created_at");

-- CreateIndex
CREATE INDEX "menu_suggestions_status_created_at_idx" ON "menu_suggestions"("status", "created_at");

-- CreateIndex
CREATE INDEX "category_orders_poll_id_idx" ON "category_orders"("poll_id");

-- CreateIndex
CREATE INDEX "category_orders_responsible_user_id_idx" ON "category_orders"("responsible_user_id");

-- CreateIndex
CREATE INDEX "category_orders_calculation_status_idx" ON "category_orders"("calculation_status");

-- CreateIndex
CREATE INDEX "category_orders_poll_id_calculation_status_idx" ON "category_orders"("poll_id", "calculation_status");

-- CreateIndex
CREATE UNIQUE INDEX "category_orders_poll_id_category_key" ON "category_orders"("poll_id", "category");

-- CreateIndex
CREATE INDEX "order_items_category_order_id_idx" ON "order_items"("category_order_id");

-- CreateIndex
CREATE INDEX "order_items_user_id_idx" ON "order_items"("user_id");

-- CreateIndex
CREATE INDEX "order_items_entered_by_idx" ON "order_items"("entered_by");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_category_order_id_user_id_key" ON "order_items"("category_order_id", "user_id");

-- CreateIndex
CREATE INDEX "order_item_edit_logs_order_item_id_idx" ON "order_item_edit_logs"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_edit_logs_edited_by_idx" ON "order_item_edit_logs"("edited_by");

-- CreateIndex
CREATE INDEX "order_item_edit_logs_timestamp_idx" ON "order_item_edit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_user_id_key" ON "user_stats"("user_id");

-- CreateIndex
CREATE INDEX "user_stats_total_xp_idx" ON "user_stats"("total_xp");

-- CreateIndex
CREATE INDEX "user_stats_level_idx" ON "user_stats"("level");

-- CreateIndex
CREATE INDEX "user_stats_user_id_total_xp_idx" ON "user_stats"("user_id", "total_xp");

-- CreateIndex
CREATE INDEX "user_stats_gastro_rating_idx" ON "user_stats"("gastro_rating");

-- CreateIndex
CREATE INDEX "user_stats_responsible_rating_idx" ON "user_stats"("responsible_rating");

-- CreateIndex
CREATE INDEX "user_stats_social_rating_idx" ON "user_stats"("social_rating");

-- CreateIndex
CREATE INDEX "user_stats_explorer_rating_idx" ON "user_stats"("explorer_rating");

-- CreateIndex
CREATE INDEX "xp_history_user_id_idx" ON "xp_history"("user_id");

-- CreateIndex
CREATE INDEX "xp_history_season_id_idx" ON "xp_history"("season_id");

-- CreateIndex
CREATE INDEX "xp_history_created_at_idx" ON "xp_history"("created_at");

-- CreateIndex
CREATE INDEX "xp_history_category_idx" ON "xp_history"("category");

-- CreateIndex
CREATE INDEX "xp_history_user_id_season_id_idx" ON "xp_history"("user_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_key" ON "user_progress"("user_id");

-- CreateIndex
CREATE INDEX "user_progress_xp_idx" ON "user_progress"("xp");

-- CreateIndex
CREATE INDEX "user_progress_level_idx" ON "user_progress"("level");

-- CreateIndex
CREATE INDEX "user_progress_user_id_xp_idx" ON "user_progress"("user_id", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "achievements_key_idx" ON "achievements"("key");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "achievements_rarity_idx" ON "achievements"("rarity");

-- CreateIndex
CREATE INDEX "achievements_is_active_idx" ON "achievements"("is_active");

-- CreateIndex
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

-- CreateIndex
CREATE INDEX "user_achievements_achievement_id_idx" ON "user_achievements"("achievement_id");

-- CreateIndex
CREATE INDEX "user_achievements_unlocked_at_idx" ON "user_achievements"("unlocked_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id_key" ON "user_achievements"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "quests_key_key" ON "quests"("key");

-- CreateIndex
CREATE INDEX "quests_key_idx" ON "quests"("key");

-- CreateIndex
CREATE INDEX "quests_type_idx" ON "quests"("type");

-- CreateIndex
CREATE INDEX "quests_category_idx" ON "quests"("category");

-- CreateIndex
CREATE INDEX "quests_is_active_idx" ON "quests"("is_active");

-- CreateIndex
CREATE INDEX "user_quests_user_id_status_idx" ON "user_quests"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_quests_quest_id_idx" ON "user_quests"("quest_id");

-- CreateIndex
CREATE INDEX "user_quests_expires_at_idx" ON "user_quests"("expires_at");

-- CreateIndex
CREATE INDEX "user_quests_status_idx" ON "user_quests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_user_id_quest_id_started_at_key" ON "user_quests"("user_id", "quest_id", "started_at");

-- CreateIndex
CREATE INDEX "challenges_type_idx" ON "challenges"("type");

-- CreateIndex
CREATE INDEX "challenges_rarity_idx" ON "challenges"("rarity");

-- CreateIndex
CREATE INDEX "challenges_is_active_idx" ON "challenges"("is_active");

-- CreateIndex
CREATE INDEX "challenges_deadline_idx" ON "challenges"("deadline");

-- CreateIndex
CREATE INDEX "user_challenge_progress_user_id_idx" ON "user_challenge_progress"("user_id");

-- CreateIndex
CREATE INDEX "user_challenge_progress_challenge_id_idx" ON "user_challenge_progress"("challenge_id");

-- CreateIndex
CREATE INDEX "user_challenge_progress_is_completed_idx" ON "user_challenge_progress"("is_completed");

-- CreateIndex
CREATE UNIQUE INDEX "user_challenge_progress_user_id_challenge_id_key" ON "user_challenge_progress"("user_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_number_key" ON "seasons"("number");

-- CreateIndex
CREATE INDEX "seasons_is_active_idx" ON "seasons"("is_active");

-- CreateIndex
CREATE INDEX "seasons_start_date_end_date_idx" ON "seasons"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "recurring_polls_is_enabled_next_run_at_idx" ON "recurring_polls"("is_enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "recurring_polls_group_id_is_enabled_idx" ON "recurring_polls"("group_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_polls_group_id_key" ON "recurring_polls"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_reminder_settings_group_id_key" ON "debt_reminder_settings"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_notification_settings_group_id_key" ON "admin_notification_settings"("group_id");
