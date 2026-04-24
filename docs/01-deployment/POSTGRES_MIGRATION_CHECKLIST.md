# PostgreSQL Migration Checklist

Быстрый чек-лист для миграции SQLite → PostgreSQL.

---

## ✅ Pre-Migration (Подготовка)

- [ ] **Создать бэкапы**
  ```bash
  cd backend
  cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)
  ```

- [ ] **Запустить Postgres**
  ```bash
  docker-compose up -d postgres
  ```

- [ ] **Проверить подключение**
  ```bash
  docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "SELECT 1;"
  ```

- [ ] **Зафиксировать единый schema**
  ```bash
  # Убедиться, что provider = "postgresql"
  cat backend/prisma/schema.prisma | grep provider
  ```

- [ ] **Переключить runtime на Postgres**
  - Обновить `backend/src/database/client.ts` (убрать sqlite-адаптер)
  - Добавить проверку `DATABASE_URL` на `postgresql://`

- [ ] **Создать baseline миграций**
  ```bash
  cd backend
  rm -rf prisma/migrations
  export DATABASE_URL="postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db"
  npx prisma migrate dev --name init
  ```

---

## ✅ Migration (Миграция данных)

- [ ] **Установить зависимости**
  ```bash
  cd backend
  npm install better-sqlite3 --save-dev
  npm install @types/better-sqlite3 --save-dev
  ```

- [ ] **Dry-run миграции**
  ```bash
  npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --dry-run
  ```

- [ ] **Реальная миграция**
  ```bash
  npm run db:migrate:sqlite-to-postgres -- --sqlite=./prisma/dev.db --truncate
  ```

- [ ] **Проверить counts**
  ```bash
  docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "
  SELECT 'users' as table, COUNT(*) FROM users
  UNION ALL SELECT 'groups', COUNT(*) FROM groups
  UNION ALL SELECT 'polls', COUNT(*) FROM polls
  UNION ALL SELECT 'votes', COUNT(*) FROM votes;
  "
  ```

---

## ✅ Testing (Тестирование)

- [ ] **Smoke-тесты**
  ```bash
  # Запустить backend
  cd backend
  export DATABASE_URL="postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db"
  npm run dev

  # В другом терминале
  curl http://localhost:3001/api/health
  curl http://localhost:3001/api/polls/active
  curl http://localhost:3001/api/menu
  ```

- [ ] **Интеграционные тесты**
  ```bash
  cd backend
  npm test
  ```

- [ ] **Проверить бота**
  - Отправить `/start` в Telegram
  - Открыть Mini App
  - Создать голосование
  - Проголосовать

---

## ✅ Production (Продакшен)

- [ ] **Обновить .env.production**
  ```bash
  # Проверить DATABASE_URL
  cat backend/.env.production | grep DATABASE_URL
  # Должно быть: postgresql://foodbot:foodbot_password@localhost:5432/foodbot_db
  ```

- [ ] **Запустить через start-prod.ps1**
  ```powershell
  .\start-prod.ps1
  ```

- [ ] **Проверить логи**
  - Window 1 (Backend): должно быть "✅ Подключение к базе данных успешно установлено"
  - Не должно быть ошибок Prisma

- [ ] **Проверить ngrok**
  - Скопировать URL из Window 2
  - Вставить в Window 3 (URL Updater)
  - Дождаться автоматического обновления

- [ ] **Финальная проверка**
  - Открыть бота в Telegram
  - Нажать "Menu"
  - Mini App должен открыться
  - Все функции работают

---

## ✅ Post-Migration (После миграции)

- [ ] **Мониторинг (24 часа)**
  - Проверять логи на ошибки
  - Следить за производительностью
  - Проверять, что данные сохраняются

- [ ] **Очистка (через 1-2 недели)**
  ```bash
  # Удалить бэкапы
  rm backend/prisma/dev.db.backup-*

  # Удалить sqlite-зависимости
  cd backend
  npm uninstall better-sqlite3 @types/better-sqlite3 @prisma/adapter-better-sqlite3

  # Закоммитить
  git add .
  git commit -m "chore: complete SQLite to PostgreSQL migration"
  git push
  ```

---

## ⚠️ Rollback (если что-то пошло не так)

### На этапе миграции данных

```bash
# 1. Восстановить SQLite
cp backend/prisma/dev.db.backup-YYYYMMDD-HHMMSS backend/prisma/dev.db

# 2. Очистить Postgres
docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO foodbot;
"

# 3. Вернуть код
git checkout HEAD -- backend/src/database/client.ts
git checkout HEAD -- backend/.env.production
```

### На проде (через start-prod.ps1)

```bash
# 1. Остановить все окна (Ctrl+C)

# 2. Восстановить .env.production
git checkout HEAD -- backend/.env.production

# 3. Восстановить SQLite
cp backend/prisma/dev.db.backup-YYYYMMDD-HHMMSS backend/prisma/dev.db

# 4. Перезапустить
.\start-prod.ps1
```

---

## 📊 Метрики успеха

После миграции проверить:

- [ ] Все counts совпадают (SQLite vs Postgres)
- [ ] Нет orphan records (FK-связи целы)
- [ ] Health endpoint работает (200 OK)
- [ ] Активные голосования загружаются
- [ ] Меню загружается
- [ ] Бот отвечает на команды
- [ ] Mini App открывается
- [ ] Можно создать голосование
- [ ] Можно проголосовать
- [ ] Транзакции сохраняются
- [ ] Интеграционные тесты проходят
- [ ] Логи не содержат ошибок Prisma

---

## 🆘 Troubleshooting

### Backend не запускается

```bash
# Проверить DATABASE_URL
cat backend/.env.production | grep DATABASE_URL

# Проверить, что Postgres запущен
docker ps | grep postgres

# Проверить логи Postgres
docker logs foodbot-postgres
```

### Ошибка "relation does not exist"

```bash
# Применить миграции
cd backend
npx prisma migrate deploy
```

### Ошибка "password authentication failed"

```bash
# Проверить пароль в DATABASE_URL
# Должен совпадать с docker-compose.yml
```

### Данные не сохраняются

```bash
# Проверить, что используется правильная БД
docker exec -it foodbot-postgres psql -U foodbot -d foodbot_db -c "\dt"
```

---

**Дата создания:** 2026-02-02  
**Версия:** 1.0
