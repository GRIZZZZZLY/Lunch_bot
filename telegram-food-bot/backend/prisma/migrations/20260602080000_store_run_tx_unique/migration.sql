-- Уникальность пары (store_run_id, store_item_id): один StoreItem магазинного
-- забега даёт максимум одну транзакцию. Защита от гонки при финализации
-- забега (двойной клик «завершить»). В Postgres NULL,NULL считаются
-- различными, поэтому poll-транзакции (обе колонки NULL) ограничение не
-- затрагивают.
-- CreateIndex
CREATE UNIQUE INDEX "transactions_store_run_id_store_item_id_key" ON "transactions"("store_run_id", "store_item_id");
