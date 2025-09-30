# Установка и настройка

Это руководство поможет вам настроить проект Telegram Food Bot для разработки и production.

## Требования

### Системные требования
- **Node.js**: версия 18 или выше
- **PostgreSQL**: версия 14 или выше  
- **Docker**: для контейнеризации (рекомендуется)
- **Git**: для работы с репозиторием

### Telegram требования
- Создать бота через [@BotFather](https://t.me/botfather)
- Получить токен бота
- Настроить команды бота (optional)

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd telegram-food-bot
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Заполните следующие обязательные переменные в файле `.env`:

```bash
# Telegram Bot
BOT_TOKEN=your_bot_token_from_botfather
BOT_USERNAME=your_bot_username
TELEGRAM_SECRET_KEY=your_webapp_secret_key

# Database
POSTGRES_PASSWORD=secure_password
DATABASE_URL=postgresql://foodbot:secure_password@localhost:5432/foodbot_db

# Admin пользователи (Telegram user IDs через запятую)
ADMIN_USER_IDS=123456789,987654321
```

### 3. Запуск с Docker (рекомендуется)

#### Для разработки:
```bash
# Запуск только базы данных
docker-compose -f docker-compose.dev.yml up -d

# Установка зависимостей и запуск backend
cd backend
npm install
npm run dev

# В отдельном терминале - запуск frontend  
cd frontend
npm install
npm run dev
```

#### Для production:
```bash
docker-compose up -d
```

### 4. Ручная установка (без Docker)

#### Установка PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (с Homebrew)
brew install postgresql
brew services start postgresql

# Windows
# Скачать и установить с https://www.postgresql.org/download/
```

#### Создание базы данных
```sql
-- Подключитесь к PostgreSQL
sudo -u postgres psql

-- Создайте пользователя и базу
CREATE USER foodbot WITH PASSWORD 'your_password';
CREATE DATABASE foodbot_db OWNER foodbot;
GRANT ALL PRIVILEGES ON DATABASE foodbot_db TO foodbot;
```

#### Установка зависимостей
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend  
npm install
```

#### Настройка базы данных
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

#### Запуск приложения
```bash
# Backend (в одном терминале)
cd backend
npm run dev

# Frontend (в другом терминале)
cd frontend
npm run dev
```

## Настройка Telegram бота

### 1. Создание бота

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните токен бота в файле `.env`

### 2. Настройка команд бота

Отправьте [@BotFather](https://t.me/botfather) команду `/setcommands` и выберите вашего бота:

```
start - Начать работу с ботом
help - Показать справку
menu - Открыть меню управления блюдами
startpoll - Запустить голосование за еду
history - Показать историю голосований
```

### 3. Настройка Menu Button (для Mini App)

```
/setmenubutton
@your_bot_username
Меню
https://yourdomain.com
```

### 4. Настройка вебхука (для production)

```bash
curl -F "url=https://yourdomain.com/webhook" \
     https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

## Настройка админов

1. Узнайте ваш Telegram user ID:
   - Отправьте `/start` боту [@userinfobot](https://t.me/userinfobot)
   - Или используйте [@RawDataBot](https://t.me/RawDataBot)

2. Добавьте ID в переменную `ADMIN_USER_IDS` в `.env`:
   ```bash
   ADMIN_USER_IDS=123456789,987654321
   ```

## Проверка установки

### 1. Проверка базы данных
```bash
cd backend
npx prisma studio
# Откроется веб-интерфейс на http://localhost:5555
```

### 2. Проверка API
```bash
curl http://localhost:3001/health
# Ответ: {"status":"ok","timestamp":"..."}
```

### 3. Проверка бота
Отправьте команду `/start` вашему боту в Telegram.

### 4. Проверка Mini App
- Отправьте команду `/menu` боту
- Или нажмите кнопку "Меню" в интерфейсе бота

## Конфигурация для разработки

### VS Code расширения (рекомендуется)
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### Настройка hot reload
Backend и frontend автоматически перезапускаются при изменении файлов в режиме разработки.

## Troubleshooting

### Проблемы с базой данных
```bash
# Сброс базы данных
cd backend
npx prisma migrate reset

# Пересоздание Prisma Client
npx prisma generate
```

### Проблемы с Docker
```bash
# Полная очистка
docker-compose down -v
docker system prune -f

# Пересборка образов
docker-compose build --no-cache
```

### Проблемы с портами
Убедитесь, что порты не заняты другими приложениями:
- 3001 - Backend API
- 5173 - Frontend dev server  
- 5432 - PostgreSQL
- 6379 - Redis (опционально)

## Следующие шаги

После успешной установки:

1. Ознакомьтесь с [архитектурой проекта](ARCHITECTURE.md)
2. Изучите [API документацию](API.md)  
3. Проверьте [руководство по деплою](DEPLOYMENT.md)

## Получение помощи

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs -f`
2. Убедитесь, что все переменные окружения заданы правильно
3. Проверьте, что все порты свободны
4. Создайте issue в репозитории проекта
