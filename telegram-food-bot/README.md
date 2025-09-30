# Telegram Food Bot

Telegram бот для выбора еды в коллективе с системой голосования и рулеткой.

## Функционал

- 🤖 **Telegram Bot**: Команды для запуска голосования и управления
- 📱 **Mini App**: Интерфейс для управления меню блюд
- 🗳️ **Система голосования**: Голосование за блюда с автоматическим завершением
- 🎲 **Рулетка**: Случайный выбор ответственного за заказ
- 📊 **Статистика**: История голосований и популярные блюда

## Структура проекта

```
telegram-food-bot/
├── backend/           # Backend сервер (TypeScript, Grammy, Express, Prisma)
├── frontend/          # Mini App (React, Tailwind CSS, TWA SDK)
├── docker/           # Docker конфигурация
└── docs/             # Документация проекта
```

## ⚡ Быстрый старт

### Вариант 1: Docker (рекомендуется)

```bash
# 1. Клонировать репозиторий
git clone <repository-url>
cd telegram-food-bot

# 2. Настроить переменные окружения
cp .env.example .env
# Отредактируйте .env и укажите BOT_TOKEN, BOT_USERNAME, TELEGRAM_SECRET_KEY

# 3. Запустить все сервисы
docker-compose up -d

# 4. Проверить статус
docker-compose ps
curl http://localhost:3001/health
```

**Готово!** 🎉
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Database: localhost:5432

### Вариант 2: Локальная разработка

```bash
# 1. Запустить только базу данных
docker-compose -f docker-compose.dev.yml up -d

# 2. Установить зависимости
cd backend && npm install
cd ../frontend && npm install

# 3. Запустить backend (в отдельном терминале)
cd backend && npm run dev

# 4. Запустить frontend (в отдельном терминале)
cd frontend && npm run dev
```

## 📚 Документация

- **[QUICK_START.md](QUICK_START.md)** - Быстрый старт за 5 минут
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Полное руководство по Docker
- **[AGENTS.md](AGENTS.md)** - План разработки проекта
- **[docs/](docs/)** - Детальная документация

## 🛠️ Разработка

### Требования
- Node.js 18+
- PostgreSQL 14+ (или Docker)
- Docker & Docker Compose (опционально)

### Полезные команды

```bash
# Backend
npm run dev              # Запуск в режиме разработки
npm run build            # Сборка production
npm test                 # Запуск тестов
npm run lint             # Проверка кода
npx prisma studio        # GUI для БД
npx prisma migrate dev   # Создать миграцию

# Frontend
npm run dev              # Запуск в режиме разработки
npm run build            # Сборка production
npm run preview          # Просмотр production сборки
npm test                 # Запуск тестов
npm run lint             # Проверка кода

# Docker
docker-compose up -d               # Запустить все сервисы
docker-compose down                # Остановить все сервисы
docker-compose logs -f backend     # Смотреть логи backend
docker-compose restart backend     # Перезапустить backend
docker-compose exec backend sh     # Зайти в контейнер
```

### Структура базы данных

```bash
# Создать новую миграцию
cd backend
npx prisma migrate dev --name your_migration_name

# Применить миграции
npx prisma migrate deploy

# Открыть Prisma Studio
npx prisma studio
```

## Команды бота

- `/start` - Регистрация пользователя
- `/help` - Справка по командам  
- `/menu` - Открыть Mini App для управления меню
- `/startpoll` - Запустить голосование (только админы)
- `/history` - История голосований

## Технологии

### Backend
- **TypeScript** - Язык программирования
- **Grammy** - Telegram Bot API
- **Express** - Web framework
- **Prisma** - ORM для работы с БД
- **PostgreSQL** - База данных
- **Winston** - Логирование

### Frontend
- **React** - UI библиотека
- **TypeScript** - Язык программирования  
- **Tailwind CSS** - CSS framework
- **Vite** - Build tool
- **Telegram WebApp SDK** - Интеграция с Telegram

### DevOps
- **Docker** - Контейнеризация
- **GitHub Actions** - CI/CD
- **Nginx** - Reverse proxy

## Документация

- [Установка и настройка](docs/SETUP.md)
- [Архитектура проекта](docs/ARCHITECTURE.md)
- [API документация](docs/API.md)
- [Деплой](docs/DEPLOYMENT.md)

## Лицензия

MIT License - см. [LICENSE](LICENSE)
