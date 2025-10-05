-- CreateIndex
CREATE INDEX "menu_items_is_active_category_idx" ON "menu_items"("is_active", "category");

-- CreateIndex
CREATE INDEX "polls_status_started_at_idx" ON "polls"("status", "started_at");

-- CreateIndex
CREATE INDEX "polls_group_id_status_idx" ON "polls"("group_id", "status");

-- CreateIndex
CREATE INDEX "votes_poll_id_user_id_idx" ON "votes"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at");

-- CreateIndex
CREATE INDEX "votes_menu_item_id_idx" ON "votes"("menu_item_id");
