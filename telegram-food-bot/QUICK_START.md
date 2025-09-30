# ⚡ Быстрый старт

Минимальная инструкция для запуска проекта.

## 🎯 За 5 минут

### 1. Подготовка

```bash
# Клонировать репозиторий (если еще не клонирован)
git clone <repository-url>
cd telegram-food-bot

# Скопировать и настроить .env
cp .env.example .env
```

### 2. Настроить `.env`

Откройте `.env` и замените:

```env
BOT_TOKEN=your_bot_token_here           # Получить у @BotFather
BOT_USERNAME=your_bot_username          # Например: MyFoodBot
TELEGRAM_SECRET_KEY=random_secret_123   # Любая случайная строка
```

### 3. Запустить

```bash
# С Docker (рекомендуется)
docker-compose up -d

# Или локально
npm install                  # В корне
cd backend && npm install
cd ../frontend && npm install

# В отдельных терминалах:
docker-compose -f docker-compose.dev.yml up -d  # Только БД
cd backend && npm run dev    # Backend
cd frontend && npm run dev   # Frontend
```

### 4. Проверить

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/health
- **База данных**: localhost:5432

## 🎮 Основные команды

```bash
# Docker
docker-compose up -d        # Запустить
docker-compose logs -f      # Смотреть логи
docker-compose down         # Остановить

# Разработка
npm run dev                 # Backend + Frontend
npm run build              # Сборка
npm test                   # Тесты
npm run lint               # Проверка кода

# База данных
npx prisma migrate dev     # Создать миграцию
npx prisma studio          # Открыть GUI для БД
npx prisma generate        # Обновить Prisma Client
```

## 🆘 Проблемы?

### Порт занят

```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill
```

### База данных не подключается

```bash
# Перезапустить PostgreSQL
docker-compose restart postgres

# Проверить статус
docker-compose ps postgres
```

### Ошибки при сборке

```bash
# Очистить кэш и пересобрать
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## 📚 Детальная документация

- [DOCKER_SETUP.md](DOCKER_SETUP.md) - Полное руководство по Docker
- [README.md](README.md) - Описание проекта
- [AGENTS.md](AGENTS.md) - План разработки
