-- Снять FK-ссылки на удаляемые блюда (история голосований остаётся без названия)
UPDATE "votes" SET "menu_item_id" = NULL WHERE "menu_item_id" IS NOT NULL;
UPDATE "poll_results" SET "winner_menu_item_id" = NULL WHERE "winner_menu_item_id" IS NOT NULL;

-- Обнулить меню и предложки (решение: все группы с нуля)
DELETE FROM "menu_suggestions";
DELETE FROM "menu_items";

-- Добавить group_id (таблицы пусты → NOT NULL безопасен)
ALTER TABLE "menu_items" ADD COLUMN "group_id" INTEGER NOT NULL;
ALTER TABLE "menu_suggestions" ADD COLUMN "group_id" INTEGER NOT NULL;

-- FK + индексы
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_suggestions"
  ADD CONSTRAINT "menu_suggestions_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "menu_items_group_id_is_active_idx" ON "menu_items"("group_id", "is_active");
CREATE INDEX "menu_suggestions_group_id_status_idx" ON "menu_suggestions"("group_id", "status");
