# Финальное решение проблемы PostgreSQL

## Проблема
Prisma Client не может подключиться к PostgreSQL в Docker из-за проблем с аутентификацией.

## Диагностика
- ✅ PostgreSQL работает
- ✅ База данных и таблицы созданы
- ✅ Подключение через `docker exec` работает
- ❌ Подключение через Prisma/Node.js не работает
- ❌ Credentials показываются как `(not available)` в ошибке

## Решение: Пересоздать PostgreSQL с правильными настройками

### Шаг 1: Остановить текущий контейнер

```powershell
docker stop foodbot-postgres
docker rm foodbot-postgres
docker volume rm telegram-food-bot_postgres_data  # Удалит данные!
```

### Шаг 2: Создать новый контейнер с trust auth для разработки

```powershell
docker run -d \
  --name foodbot-postgres \
  -e POSTGRES_USER=foodbot \
  -e POSTGRES_PASSWORD=foodbot_password \
  -e POSTGRES_DB=foodbot_db \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine
```

### Шаг 3: Применить миграции

```powershell
cd C:\BOT_V2\telegram-food-bot\backend

# Применить SQL скрипт
docker cp init-db.sql foodbot-postgres:/tmp/init-db.sql
docker exec foodbot-postgres psql -U foodbot -d foodbot_db -f /tmp/init-db.sql

# Или через Prisma (если заработает)
npx prisma migrate dev --name init
```

### Шаг 4: Запустить backend

```powershell
npm run dev
```

## Альтернатива (если не заработает)

### Использовать SQLite для разработки

1. Изменить `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

2. Применить миграции:
```powershell
npx prisma migrate dev --name init
npx prisma generate
```

3. Запустить:
```powershell
npm run dev
```

## Следующие шаги после решения

1. Настроить BOT_TOKEN в .env
2. Запустить backend
3. Протестировать функционал
4. Запустить frontend
5. Открыть Mini App через Telegram
