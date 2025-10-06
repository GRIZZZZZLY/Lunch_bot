# 🐳 Docker Setup для Telegram Food Bot

Это руководство поможет вам запустить проект с использованием Docker.

## 📋 Предварительные требования

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+
- Telegram Bot Token (получите у [@BotFather](https://t.me/BotFather))

## 🚀 Быстрый старт

### 1. Настройка переменных окружения

Скопируйте пример файла конфигурации:

```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните обязательные переменные:

```env
# Обязательно заполнить:
BOT_TOKEN=your_bot_token_here
BOT_USERNAME=your_bot_username
TELEGRAM_SECRET_KEY=your_telegram_secret_key_here
```

### 2. Запуск проекта

**Запуск всех сервисов (PostgreSQL + Backend + Frontend):**

```bash
docker-compose up -d
```

**Запуск только базы данных (для локальной разработки):**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Проверка статуса

```bash
# Посмотреть логи
docker-compose logs -f

# Проверить статус контейнеров
docker-compose ps

# Проверить health check
curl http://localhost:3001/health
curl http://localhost:5173/health
```

## 🛠️ Управление проектом

### Остановка сервисов

```bash
# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes (БД будет очищена!)
docker-compose down -v
```

### Перезапуск отдельного сервиса

```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart postgres
```

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только backend
docker-compose logs -f backend

# Только frontend
docker-compose logs -f frontend

# Последние 100 строк
docker-compose logs --tail=100
```

### Выполнение команд внутри контейнеров

```bash
# Зайти в контейнер backend
docker-compose exec backend sh

# Выполнить миграции Prisma
docker-compose exec backend npx prisma migrate deploy

# Создать нового пользователя в БД
docker-compose exec backend npx prisma studio

# Зайти в PostgreSQL
docker-compose exec postgres psql -U foodbot -d foodbot_db
```

## 🔧 Режимы работы

### Development режим

Использует `docker-compose.dev.yml` - только база данных и pgAdmin:

```bash
docker-compose -f docker-compose.dev.yml up -d

# Backend и Frontend запускаются локально:
cd backend && npm run dev
cd frontend && npm run dev
```

**Доступ к pgAdmin:**
- URL: http://localhost:5050
- Email: `admin@foodbot.local`
- Password: `admin`

### Production режим

Использует основной `docker-compose.yml` - все сервисы в контейнерах:

```bash
docker-compose up -d
```

**Доступные сервисы:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Backend Health: http://localhost:3001/health
- PostgreSQL: localhost:5432

## 🗄️ Работа с базой данных

### Создание миграций

```bash
# Войти в контейнер backend
docker-compose exec backend sh

# Создать новую миграцию
npx prisma migrate dev --name your_migration_name

# Применить миграции
npx prisma migrate deploy

# Открыть Prisma Studio (GUI для БД)
npx prisma studio
```

### Бэкап базы данных

```bash
# Создать бэкап
docker-compose exec postgres pg_dump -U foodbot foodbot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из бэкапа
docker-compose exec -T postgres psql -U foodbot foodbot_db < backup_20240101_120000.sql
```

### Очистка базы данных

```bash
# Удалить все данные и пересоздать таблицы
docker-compose exec backend npx prisma migrate reset
```

## 🔍 Отладка

### Проблемы с подключением к БД

```bash
# Проверить, что PostgreSQL запущен
docker-compose ps postgres

# Проверить логи PostgreSQL
docker-compose logs postgres

# Проверить подключение
docker-compose exec postgres pg_isready -U foodbot
```

### Проблемы с backend

```bash
# Проверить логи
docker-compose logs backend

# Пересобрать образ
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Проблемы с frontend

```bash
# Проверить логи
docker-compose logs frontend

# Пересобрать образ
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

## 📦 Переменные окружения

### Основные переменные

| Переменная | Описание | По умолчанию |
|-----------|----------|--------------|
| `BOT_TOKEN` | Токен Telegram бота | - |
| `BOT_USERNAME` | Username бота | - |
| `TELEGRAM_SECRET_KEY` | Секретный ключ для валидации | - |
| `DATABASE_URL` | URL подключения к PostgreSQL | auto |
| `API_PORT` | Порт backend API | 3001 |
| `FRONTEND_PORT` | Порт frontend | 5173 |
| `POSTGRES_PORT` | Порт PostgreSQL | 5432 |
| `NODE_ENV` | Окружение | development |

### Дополнительные настройки

См. полный список в `.env.example`

## 🧪 Тестирование

```bash
# Запустить тесты backend
docker-compose exec backend npm test

# Запустить тесты с покрытием
docker-compose exec backend npm run test:coverage

# Запустить линтер
docker-compose exec backend npm run lint
docker-compose exec frontend npm run lint
```

## 📊 Мониторинг

### Health Checks

Docker автоматически проверяет здоровье контейнеров:

```bash
# Посмотреть статус health checks
docker-compose ps

# Проверить вручную
curl http://localhost:3001/health  # Backend
curl http://localhost:5173/health  # Frontend
```

### Использование ресурсов

```bash
# Посмотреть использование CPU и памяти
docker stats

# Только для проекта foodbot
docker stats foodbot-backend foodbot-frontend foodbot-postgres
```

## 🔐 Безопасность

### Production рекомендации

1. **Измените пароли по умолчанию:**
   ```env
   POSTGRES_PASSWORD=strong_random_password
   TELEGRAM_SECRET_KEY=random_secret_key
   JWT_SECRET=another_random_secret
   ```

2. **Используйте отдельный файл .env для production:**
   ```bash
   cp .env.example .env.production
   # Отредактируйте .env.production
   docker-compose --env-file .env.production up -d
   ```

3. **Настройте CORS правильно:**
   ```env
   CORS_ORIGIN=https://yourdomain.com
   ```

4. **Используйте SSL/TLS в production**

## 🆘 Поддержка

### Полезные команды

```bash
# Очистить все Docker ресурсы проекта
docker-compose down -v --rmi all

# Пересобрать все образы
docker-compose build --no-cache

# Посмотреть версии образов
docker-compose images

# Экспорт логов в файл
docker-compose logs > logs_$(date +%Y%m%d_%H%M%S).txt
```

### Известные проблемы

1. **Порты заняты:** Проверьте, что порты 3001, 5173, 5432 свободны
2. **Недостаточно памяти:** Увеличьте лимиты Docker
3. **Медленная сборка:** Используйте `--parallel` флаг

## 📚 Дополнительные ресурсы

- [Docker Compose документация](https://docs.docker.com/compose/)
- [Prisma документация](https://www.prisma.io/docs/)
- [Grammy документация](https://grammy.dev/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
