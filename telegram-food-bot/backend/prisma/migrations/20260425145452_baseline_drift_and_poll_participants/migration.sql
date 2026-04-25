-- AlterTable
ALTER TABLE "category_orders" ADD COLUMN "participant_messages" TEXT;

-- CreateTable
CREATE TABLE "poll_participants" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXPECTED',
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "poll_participants_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "poll_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_runs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "initiator_id" INTEGER NOT NULL,
    "store_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "collect_until" DATETIME NOT NULL,
    "shopping_at" DATETIME,
    "settled_at" DATETIME,
    "cancelled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "store_runs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_runs_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "store_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "store_run_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "price" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "store_items_store_run_id_fkey" FOREIGN KEY ("store_run_id") REFERENCES "store_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "store_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_polls" (
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
    "is_automatic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_polls" ("chat_id", "created_at", "created_by", "duration", "ended_at", "group_id", "id", "is_multi_select", "max_selections", "message_id", "selected_menu_item_ids", "started_at", "status", "updated_at") SELECT "chat_id", "created_at", "created_by", "duration", "ended_at", "group_id", "id", "is_multi_select", "max_selections", "message_id", "selected_menu_item_ids", "started_at", "status", "updated_at" FROM "polls";
DROP TABLE "polls";
ALTER TABLE "new_polls" RENAME TO "polls";
CREATE INDEX "polls_status_idx" ON "polls"("status");
CREATE INDEX "polls_started_at_idx" ON "polls"("started_at");
CREATE INDEX "polls_status_started_at_idx" ON "polls"("status", "started_at");
CREATE INDEX "polls_group_id_status_idx" ON "polls"("group_id", "status");
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER,
    "store_run_id" INTEGER,
    "from_user_id" INTEGER NOT NULL,
    "to_user_id" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "menu_item_id" INTEGER,
    "category_order_id" INTEGER,
    "store_item_id" INTEGER,
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
    "debt_message_id" INTEGER,
    "debt_chat_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_store_run_id_fkey" FOREIGN KEY ("store_run_id") REFERENCES "store_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_store_item_id_fkey" FOREIGN KEY ("store_item_id") REFERENCES "store_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_category_order_id_fkey" FOREIGN KEY ("category_order_id") REFERENCES "category_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("amount", "category_order_id", "confirmed_at", "created_at", "delivery_share", "disputed_reason", "from_user_id", "id", "item_price", "last_reminder_at", "menu_item_id", "paid_at", "poll_id", "reminder_count", "service_share", "status", "tip_share", "to_user_id", "updated_at") SELECT "amount", "category_order_id", "confirmed_at", "created_at", "delivery_share", "disputed_reason", "from_user_id", "id", "item_price", "last_reminder_at", "menu_item_id", "paid_at", "poll_id", "reminder_count", "service_share", "status", "tip_share", "to_user_id", "updated_at" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_poll_id_idx" ON "transactions"("poll_id");
CREATE INDEX "transactions_store_run_id_idx" ON "transactions"("store_run_id");
CREATE INDEX "transactions_from_user_id_status_idx" ON "transactions"("from_user_id", "status");
CREATE INDEX "transactions_to_user_id_status_idx" ON "transactions"("to_user_id", "status");
CREATE INDEX "transactions_category_order_id_idx" ON "transactions"("category_order_id");
CREATE TABLE "new_users" (
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
    "participates_in_polls" BOOLEAN NOT NULL DEFAULT true,
    "payment_card" TEXT,
    "payment_phone" TEXT,
    "payment_details" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar_updated_at", "avatar_url", "created_at", "first_name", "id", "is_active", "is_admin", "last_name", "payment_card", "payment_details", "payment_phone", "photo_url", "telegram_id", "updated_at", "username") SELECT "avatar_updated_at", "avatar_url", "created_at", "first_name", "id", "is_active", "is_admin", "last_name", "payment_card", "payment_details", "payment_phone", "photo_url", "telegram_id", "updated_at", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "poll_participants_poll_id_status_idx" ON "poll_participants"("poll_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "poll_participants_poll_id_user_id_key" ON "poll_participants"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "store_runs_group_id_status_idx" ON "store_runs"("group_id", "status");

-- CreateIndex
CREATE INDEX "store_runs_status_collect_until_idx" ON "store_runs"("status", "collect_until");

-- CreateIndex
CREATE INDEX "store_runs_initiator_id_status_idx" ON "store_runs"("initiator_id", "status");

-- CreateIndex
CREATE INDEX "store_items_store_run_id_idx" ON "store_items"("store_run_id");

-- CreateIndex
CREATE INDEX "store_items_user_id_idx" ON "store_items"("user_id");

-- CreateIndex
CREATE INDEX "store_items_store_run_id_user_id_idx" ON "store_items"("store_run_id", "user_id");
