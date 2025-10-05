-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_votes" (
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
INSERT INTO "new_votes" ("created_at", "id", "menu_item_id", "poll_id", "updated_at", "user_id") SELECT "created_at", "id", "menu_item_id", "poll_id", "updated_at", "user_id" FROM "votes";
DROP TABLE "votes";
ALTER TABLE "new_votes" RENAME TO "votes";
CREATE INDEX "votes_poll_id_idx" ON "votes"("poll_id");
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");
CREATE INDEX "votes_vote_type_idx" ON "votes"("vote_type");
CREATE UNIQUE INDEX "votes_poll_id_user_id_key" ON "votes"("poll_id", "user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
