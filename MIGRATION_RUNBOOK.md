# SQLite → PostgreSQL Migration Runbook

Полный пошаговый план миграции с командами, проверками и откатом.

---

## Предварительные требования

- [ ] Node.js 22+ установлен
- [ ] Docker и Docker Compose установлены
- [ ] Доступ к SQLite файлу (`backend/prisma/dev.db`)
- [ ] Postgres контейнер запущен (`docker-compose up -d postgres`)

---

## Этап 1: Подготовка (Pre-Migration)

### 1.1 Создать бэкапы

```bash
# Бэкап SQLite
cd backend
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)

# Бэкап Postgres (если есть данные)
docker exec -t foodbot-postgres pg_dump -U foodbot -d foodbot_db > backup-postgres-$(date +%Y%m%d-%H%M%S).sql
```

**Проверка:**
```bash
ls -lh prisma/dev.db.backup-*
ls -lh backup-postgres-*.sql
```

---

### 1.2 Зафиксировать единый schema

```bash
# Убедиться, что используется Postgres schema
cat prisma/schema.prisma | grep 'provider'
# Должно быть: provider = "postgresql"

# Архивировать старый sqlite schema (если есть)
mv src/database/schema.prisma src/database/schema.prisma.sqlite.bak 2>/dev/null || true
```

**Проверка:**
```bash
# Должен быть только один schema с provider = "postgresql"
find . -name "schema.prisma" -exec grep -H "provider" {} \;
```

---

### 1.3 Переключить runtime на Postgres

**Файл:** `backend/src/database/client.ts`

Убрать:
```typescript
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
```

Заменить создание клиента на:
```typescript
const createPrismaClient = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Проверка: только PostgreSQL
  if (!databaseUrl.startsWith('postgresql://')) {
    throw new Error('Only PostgreSQL is supported. DATABASE_URL must start with postgresql://');
  }

  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
    errorFormat: 'pretty',
  });

  // ... остальной код логирования
  
  return prisma;
};
```

**Проверка:**
```bash
# Убедиться, что нет импорта sqlite-адаптера
grep -r "PrismaBetterSqlite3" src/
# Должно быть пусто
```

---

### 1.4 Создать новый baseline миграций для Postgres

```bash
# Удалить старые миграции (в отдельной ветке!)
git checkout -b migration/sqlite-to-postgres
rm -rf prisma/migrations

# Создать новый baseline
export DATABASE_URL="postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db"
npx prisma migrate dev --name init

# Проверить, что миграция применилась
npx prisma migrate status
```

**Проверка:**
```bash
# Должна быть одна миграция "init"
ls -la prisma/migrations/
```

---

## Этап 2: Миграция данных (Data Migration)

### 2.1 Установить зависимости (если нужно)

```bash
npm install better-sqlite3 --save-dev
npm install @types/better-sqlite3 --save-dev
```

---

### 2.2 Запустить миграцию (dry-run)

```bash
# Тестовый прогон (без записи в Postgres)
npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --dry-run
```

**Ожидаемый результат:**
- Все таблицы найдены
- Counts совпадают
- Нет ошибок

---

### 2.3 Запустить реальную миграцию

```bash
# Реальная миграция с truncate (очистка Postgres перед вставкой)
npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --truncate

# Или без truncate (добавление к существующим данным)
npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db
```

**Ожидаемый результат:**
```
✅ Migration completed successfully!
Total rows in SQLite: 1234
Total rows migrated: 1234
Total errors: 0
```

---

### 2.4 Верификация данных

Скрипт автоматически проверяет counts, но дополнительно:

```bash
# Проверить критичные таблицы
npx prisma studio
# Открыть Users, Groups, Polls, Votes — проверить данные визуально

# Или через SQL
docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'groups', COUNT(*) FROM groups
UNION ALL
SELECT 'polls', COUNT(*) FROM polls
UNION ALL
SELECT 'votes', COUNT(*) FROM votes
UNION ALL
SELECT 'menu_items', COUNT(*) FROM menu_items;
"
```

**Проверка FK-связей:**
```sql
-- Проверить, что нет orphan votes (голоса без poll/user)
SELECT COUNT(*) FROM votes v
LEFT JOIN polls p ON v.poll_id = p.id
WHERE p.id IS NULL;
-- Должно быть 0

SELECT COUNT(*) FROM votes v
LEFT JOIN users u ON v.user_id = u.id
WHERE u.id IS NULL;
-- Должно быть 0
```

---

## Этап 3: Тестирование (Testing)

### 3.1 Smoke-тесты

```bash
# Запустить backend с Postgres
export DATABASE_URL="postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db"
npm run dev

# В другом терминале:
# Health check
curl http://localhost:3001/api/health

# Получить активные голосования
curl http://localhost:3001/api/polls/active

# Получить меню
curl http://localhost:3001/api/menu
```

**Ожидаемый результат:**
- Все endpoints возвращают 200
- Данные корректны

---

### 3.2 Интеграционные тесты

```bash
# Запустить тесты против Postgres
npm test
```

**Ожидаемый результат:**
- Все тесты проходят

---

## Этап 4: Production Deployment

### 4.1 Обновить .env для production

```bash
# В .env.production
DATABASE_URL=postgresql://rocket_lunch_user:${POSTGRES_PASSWORD}@postgres:5432/rocket_lunch_db
```

---

### 4.2 Деплой через Docker Compose

```bash
# Остановить старые контейнеры
docker-compose -f docker-compose.production.yml down

# Собрать новые образы
docker-compose -f docker-compose.production.yml build

# Запустить с миграциями
docker-compose -f docker-compose.production.yml up -d

# Проверить логи
docker-compose -f docker-compose.production.yml logs -f backend
```

**Ожидаемый результат:**
```
✅ Подключение к базе данных успешно установлено
✅ Prisma migrations applied successfully
🚀 Backend server started on port 3001
```

---

### 4.3 Финальная верификация

```bash
# Health check
curl https://your-domain.com/api/health

# Проверить бота
# Отправить команду /start в Telegram

# Проверить веб-приложение
# Открыть Mini App в Telegram
```

---

## Откат (Rollback)

### Если миграция упала на этапе 2 (Data Migration)

```bash
# 1. Восстановить SQLite (если нужно)
cp prisma/dev.db.backup-YYYYMMDD-HHMMSS prisma/dev.db

# 2. Очистить Postgres
docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO foodbot;
"

# 3. Вернуть старый код
git checkout main
git branch -D migration/sqlite-to-postgres

# 4. Восстановить sqlite-адаптер в client.ts
git checkout HEAD -- src/database/client.ts
```

---

### Если миграция упала на проде (этап 4)

```bash
# 1. Остановить контейнеры
docker-compose -f docker-compose.production.yml down

# 2. Восстановить Postgres из бэкапа
docker exec -i foodbot-postgres psql -U rocket_lunch_user -d rocket_lunch_db < backup-postgres-YYYYMMDD-HHMMSS.sql

# 3. Откатить код на предыдущий коммит
git revert HEAD
git push

# 4. Пересобрать и запустить
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

---

## Чек-лист финальной проверки

После успешной миграции:

- [ ] Все counts совпадают (SQLite vs Postgres)
- [ ] Нет orphan records (FK-связи целы)
- [ ] Health endpoint работает
- [ ] Активные голосования загружаются
- [ ] Меню загружается
- [ ] Бот отвечает на команды
- [ ] Mini App открывается и работает
- [ ] Интеграционные тесты проходят
- [ ] Логи не содержат ошибок

---

## Очистка после миграции

Когда всё работает стабильно (через 1-2 недели):

```bash
# Удалить бэкапы
rm prisma/dev.db.backup-*
rm backup-postgres-*.sql

# Удалить sqlite-зависимости
npm uninstall better-sqlite3 @types/better-sqlite3 @prisma/adapter-better-sqlite3

# Удалить старый sqlite schema
rm src/database/schema.prisma.sqlite.bak

# Закоммитить изменения
git add .
git commit -m "chore: complete SQLite to PostgreSQL migration"
git push
```

---

## Контакты для поддержки

Если что-то пошло не так:
1. Проверить логи: `docker-compose logs -f backend`
2. Проверить Postgres: `docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db`
3. Откатиться по инструкции выше

---

**Дата создания:** 2026-02-02  
**Версия:** 1.0
