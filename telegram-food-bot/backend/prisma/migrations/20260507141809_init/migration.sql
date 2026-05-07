-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "photo_url" TEXT,
    "avatar_url" TEXT,
    "avatar_updated_at" TIMESTAMP(3),
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "participates_in_polls" BOOLEAN NOT NULL DEFAULT true,
    "payment_card" TEXT,
    "payment_phone" TEXT,
    "payment_details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'group',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30),
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "duration" INTEGER NOT NULL DEFAULT 30,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "message_id" INTEGER,
    "chat_id" BIGINT,
    "selected_menu_item_ids" TEXT,
    "is_multi_select" BOOLEAN NOT NULL DEFAULT true,
    "max_selections" INTEGER NOT NULL DEFAULT 3,
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_participants" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXPECTED',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "vote_type" TEXT NOT NULL DEFAULT 'MENU_ITEM',
    "custom_option" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_results" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "winner_menu_item_id" INTEGER,
    "responsible_user_id" INTEGER NOT NULL,
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "roulette_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER,
    "store_run_id" INTEGER,
    "from_user_id" INTEGER NOT NULL,
    "to_user_id" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "menu_item_id" INTEGER,
    "category_order_id" INTEGER,
    "store_item_id" INTEGER,
    "item_price" DECIMAL(65,30),
    "delivery_share" DECIMAL(65,30),
    "service_share" DECIMAL(65,30),
    "tip_share" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "disputed_reason" TEXT,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "last_reminder_at" TIMESTAMP(3),
    "debt_message_id" INTEGER,
    "debt_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_order_costs" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "delivery_cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "service_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tip" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "entered_by" INTEGER NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_order_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsible_selections" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "selected_user_id" INTEGER,
    "volunteer_user_id" INTEGER,
    "roulette_winner_id" INTEGER,
    "timeout_at" TIMESTAMP(3),
    "timeout_minutes" INTEGER NOT NULL DEFAULT 3,
    "completed_at" TIMESTAMP(3),
    "message_id" INTEGER,
    "chat_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsible_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reminders" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUTO',
    "sent_by" INTEGER,
    "message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_reminders" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_suggestions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suggested_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_menu_item_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_orders" (
    "id" SERIAL NOT NULL,
    "poll_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "responsible_user_id" INTEGER,
    "selection_status" TEXT NOT NULL DEFAULT 'PENDING',
    "calculation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "selection_mode" TEXT,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "delivery_cost" DECIMAL(65,30) DEFAULT 0,
    "service_fee" DECIMAL(65,30) DEFAULT 0,
    "tip" DECIMAL(65,30) DEFAULT 0,
    "notes" TEXT,
    "total_items_amount" DECIMAL(65,30) DEFAULT 0,
    "total_additional_costs" DECIMAL(65,30) DEFAULT 0,
    "total_amount" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "calculation_started_at" TIMESTAMP(3),
    "calculation_completed_at" TIMESTAMP(3),
    "participant_messages" TEXT,

    CONSTRAINT "category_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "category_order_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "entered_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_edit_logs" (
    "id" SERIAL NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "edited_by" INTEGER NOT NULL,
    "field_changed" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" SERIAL NOT NULL,
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
    "last_vote_date" TIMESTAMP(3),
    "polls_participated" INTEGER NOT NULL DEFAULT 0,
    "polls_won" INTEGER NOT NULL DEFAULT 0,
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "correct_predictions" INTEGER NOT NULL DEFAULT 0,
    "times_responsible" INTEGER NOT NULL DEFAULT 0,
    "times_volunteer" INTEGER NOT NULL DEFAULT 0,
    "orders_received" INTEGER NOT NULL DEFAULT 0,
    "payments_on_time" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "new_dishes_discovered" INTEGER NOT NULL DEFAULT 0,
    "categories_tried" INTEGER NOT NULL DEFAULT 0,
    "menu_items_added" INTEGER NOT NULL DEFAULT 0,
    "referrals_count" INTEGER NOT NULL DEFAULT 0,
    "random_choices" INTEGER NOT NULL DEFAULT 0,
    "win_streak" INTEGER NOT NULL DEFAULT 0,
    "max_win_streak" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "season_id" INTEGER,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" TEXT NOT NULL DEFAULT 'Новичок',
    "total_votes" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "win_streak" INTEGER NOT NULL DEFAULT 0,
    "max_win_streak" INTEGER NOT NULL DEFAULT 0,
    "categories_tried" INTEGER NOT NULL DEFAULT 0,
    "random_choices" INTEGER NOT NULL DEFAULT 0,
    "correct_predictions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "achievement_id" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quest_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "icon" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_challenge_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "challenge_id" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_challenge_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "rewards" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_polls" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "days_of_week" TEXT NOT NULL,
    "time_of_day" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "selected_menu_item_ids" TEXT,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_run_status" TEXT,
    "last_run_message" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_reminder_settings" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_days" INTEGER NOT NULL DEFAULT 3,
    "message_template" TEXT NOT NULL,
    "min_debt_age" INTEGER NOT NULL DEFAULT 1,
    "max_reminders" INTEGER NOT NULL DEFAULT 5,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notification_settings" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "notify_on_new_user" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_new_poll" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_poll_end" BOOLEAN NOT NULL DEFAULT false,
    "notify_on_debt_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_runs" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "initiator_id" INTEGER NOT NULL,
    "store_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "collect_until" TIMESTAMP(3) NOT NULL,
    "shopping_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount_rub" INTEGER NOT NULL,
    "amount_stars" INTEGER,
    "amount_crypto" TEXT,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_items" (
    "id" SERIAL NOT NULL,
    "store_run_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "price" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_items_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "poll_participants_poll_id_status_idx" ON "poll_participants"("poll_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "poll_participants_poll_id_user_id_key" ON "poll_participants"("poll_id", "user_id");

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
CREATE INDEX "transactions_store_run_id_idx" ON "transactions"("store_run_id");

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

-- CreateIndex
CREATE INDEX "store_runs_group_id_status_idx" ON "store_runs"("group_id", "status");

-- CreateIndex
CREATE INDEX "store_runs_status_collect_until_idx" ON "store_runs"("status", "collect_until");

-- CreateIndex
CREATE INDEX "store_runs_initiator_id_status_idx" ON "store_runs"("initiator_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "donations_external_id_key" ON "donations"("external_id");

-- CreateIndex
CREATE INDEX "donations_user_id_idx" ON "donations"("user_id");

-- CreateIndex
CREATE INDEX "donations_status_method_idx" ON "donations"("status", "method");

-- CreateIndex
CREATE INDEX "donations_created_at_idx" ON "donations"("created_at");

-- CreateIndex
CREATE INDEX "store_items_store_run_id_idx" ON "store_items"("store_run_id");

-- CreateIndex
CREATE INDEX "store_items_user_id_idx" ON "store_items"("user_id");

-- CreateIndex
CREATE INDEX "store_items_store_run_id_user_id_idx" ON "store_items"("store_run_id", "user_id");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_participants" ADD CONSTRAINT "poll_participants_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_participants" ADD CONSTRAINT "poll_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_winner_menu_item_id_fkey" FOREIGN KEY ("winner_menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_results" ADD CONSTRAINT "poll_results_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_run_id_fkey" FOREIGN KEY ("store_run_id") REFERENCES "store_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_item_id_fkey" FOREIGN KEY ("store_item_id") REFERENCES "store_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_order_id_fkey" FOREIGN KEY ("category_order_id") REFERENCES "category_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_order_costs" ADD CONSTRAINT "poll_order_costs_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_selections" ADD CONSTRAINT "responsible_selections_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_selections" ADD CONSTRAINT "responsible_selections_selected_user_id_fkey" FOREIGN KEY ("selected_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_selections" ADD CONSTRAINT "responsible_selections_volunteer_user_id_fkey" FOREIGN KEY ("volunteer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_selections" ADD CONSTRAINT "responsible_selections_roulette_winner_id_fkey" FOREIGN KEY ("roulette_winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_reminders" ADD CONSTRAINT "admin_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_reminders" ADD CONSTRAINT "admin_reminders_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_suggestions" ADD CONSTRAINT "menu_suggestions_suggested_by_fkey" FOREIGN KEY ("suggested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_suggestions" ADD CONSTRAINT "menu_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_orders" ADD CONSTRAINT "category_orders_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_orders" ADD CONSTRAINT "category_orders_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_category_order_id_fkey" FOREIGN KEY ("category_order_id") REFERENCES "category_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_edit_logs" ADD CONSTRAINT "order_item_edit_logs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_edit_logs" ADD CONSTRAINT "order_item_edit_logs_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_history" ADD CONSTRAINT "xp_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_history" ADD CONSTRAINT "xp_history_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_polls" ADD CONSTRAINT "recurring_polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_polls" ADD CONSTRAINT "recurring_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_reminder_settings" ADD CONSTRAINT "debt_reminder_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_reminder_settings" ADD CONSTRAINT "debt_reminder_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notification_settings" ADD CONSTRAINT "admin_notification_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_runs" ADD CONSTRAINT "store_runs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_runs" ADD CONSTRAINT "store_runs_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_store_run_id_fkey" FOREIGN KEY ("store_run_id") REFERENCES "store_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_items" ADD CONSTRAINT "store_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
