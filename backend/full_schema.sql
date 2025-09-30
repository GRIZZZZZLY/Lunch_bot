-- Создаем enum для статусов голосования
CREATE TYPE "PollStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- Создаем таблицу пользователей
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "telegram_id" BIGINT UNIQUE NOT NULL,
  "username" TEXT,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT,
  "is_admin" BOOLEAN DEFAULT false NOT NULL,
  "is_active" BOOLEAN DEFAULT true NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Создаем таблицу групп
CREATE TABLE "groups" (
  "id" SERIAL PRIMARY KEY,
  "telegram_id" BIGINT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT DEFAULT 'group' NOT NULL,
  "is_active" BOOLEAN DEFAULT true NOT NULL,
  "settings" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Создаем таблицу элементов меню
CREATE TABLE "menu_items" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(10, 2),
  "category" TEXT,
  "image_url" TEXT,
  "is_active" BOOLEAN DEFAULT true NOT NULL,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
);

-- Создаем таблицу голосований
CREATE TABLE "polls" (
  "id" SERIAL PRIMARY KEY,
  "group_id" INTEGER NOT NULL,
  "status" "PollStatus" DEFAULT 'ACTIVE' NOT NULL,
  "duration" INTEGER DEFAULT 30 NOT NULL,
  "started_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "ended_at" TIMESTAMP,
  "created_by" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("group_id") REFERENCES "groups"("id"),
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
);

-- Создаем таблицу голосов
CREATE TABLE "votes" (
  "id" SERIAL PRIMARY KEY,
  "poll_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "menu_item_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
);

-- Создаем таблицу результатов голосований
CREATE TABLE "poll_results" (
  "id" SERIAL PRIMARY KEY,
  "poll_id" INTEGER UNIQUE NOT NULL,
  "winner_menu_item_id" INTEGER,
  "responsible_user_id" INTEGER NOT NULL,
  "total_votes" INTEGER DEFAULT 0 NOT NULL,
  "roulette_data" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE,
  FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id"),
  FOREIGN KEY ("winner_menu_item_id") REFERENCES "menu_items"("id")
);

-- Создаем уникальные ограничения
CREATE UNIQUE INDEX IF NOT EXISTS "votes_poll_id_user_id_key" ON "votes"("poll_id", "user_id");

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS "menu_items_is_active_idx" ON "menu_items"("is_active");
CREATE INDEX IF NOT EXISTS "menu_items_category_idx" ON "menu_items"("category");
CREATE INDEX IF NOT EXISTS "polls_status_idx" ON "polls"("status");
CREATE INDEX IF NOT EXISTS "polls_started_at_idx" ON "polls"("started_at");
CREATE INDEX IF NOT EXISTS "votes_poll_id_idx" ON "votes"("poll_id");
CREATE INDEX IF NOT EXISTS "votes_user_id_idx" ON "votes"("user_id");

-- Создаем триггеры для updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON "groups" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON "menu_items" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON "polls" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON "votes" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
