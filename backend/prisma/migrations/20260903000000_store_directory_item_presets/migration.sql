-- Справочник магазинов группы и личные пресеты товаров.
--
-- Обе таблицы новые, а единственная правка существующей — nullable-колонка
-- store_runs.store_id без значения по умолчанию. Старый код о ней не знает и
-- продолжает работать, поэтому миграция безопасна ДО выкладки кода.
-- IF NOT EXISTS делает повторный прогон no-op.
--
-- Дедупликация имён живёт в уникальных индексах, а не только в сервисе: два
-- одновременных запроса «Пятёрочка» и «пятерочка» иначе создали бы две строки,
-- потому что проверка «есть ли уже такая» и вставка — разные операции.
-- normalized_name считает backend/src/utils/normalize-name.ts.

CREATE TABLE IF NOT EXISTS "group_stores" (
  "id"              SERIAL       NOT NULL,
  "group_id"        INTEGER      NOT NULL,
  "name"            TEXT         NOT NULL,
  "normalized_name" TEXT         NOT NULL,
  "created_by_id"   INTEGER      NOT NULL,
  "last_used_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usage_count"     INTEGER      NOT NULL DEFAULT 1,
  "archived_at"     TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "group_stores_group_id_normalized_name_key"
  ON "group_stores"("group_id", "normalized_name");

CREATE INDEX IF NOT EXISTS "group_stores_group_id_archived_at_last_used_at_idx"
  ON "group_stores"("group_id", "archived_at", "last_used_at");

CREATE TABLE IF NOT EXISTS "user_item_presets" (
  "id"              SERIAL       NOT NULL,
  "user_id"         INTEGER      NOT NULL,
  "name"            TEXT         NOT NULL,
  "normalized_name" TEXT         NOT NULL,
  "quantity"        INTEGER      NOT NULL DEFAULT 1,
  "notes"           TEXT,
  "pinned"          BOOLEAN      NOT NULL DEFAULT false,
  "usage_count"     INTEGER      NOT NULL DEFAULT 1,
  "last_used_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_item_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_item_presets_user_id_normalized_name_key"
  ON "user_item_presets"("user_id", "normalized_name");

CREATE INDEX IF NOT EXISTS "user_item_presets_user_id_pinned_last_used_at_idx"
  ON "user_item_presets"("user_id", "pinned", "last_used_at");

ALTER TABLE "store_runs" ADD COLUMN IF NOT EXISTS "store_id" INTEGER;

CREATE INDEX IF NOT EXISTS "store_runs_store_id_idx" ON "store_runs"("store_id");

-- Внешние ключи отдельными шагами: DO-блоки нужны потому, что у ALTER TABLE
-- ... ADD CONSTRAINT нет IF NOT EXISTS, а миграция должна оставаться
-- повторно прогоняемой.
DO $$ BEGIN
  ALTER TABLE "group_stores"
    ADD CONSTRAINT "group_stores_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "group_stores"
    ADD CONSTRAINT "group_stores_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_item_presets"
    ADD CONSTRAINT "user_item_presets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SET NULL, а не CASCADE: скрытый или удалённый магазин не должен уносить с
-- собой забег вместе с его позициями и долгами. Имя забега живёт в store_name.
DO $$ BEGIN
  ALTER TABLE "store_runs"
    ADD CONSTRAINT "store_runs_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "group_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
