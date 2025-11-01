# 🚀 Деплой PROD-DEV Билда на VPS

## Введение

Этот гайд описывает, как задеплоить **PROD-DEV** версию бота на VPS сервер. PROD-DEV режим сочетает:
- ✅ **Production оптимизацию** (минифицированный код, быстрая работа)
- ✅ **Dev дебаггинг** (console.log, source maps)
- ✅ **SKIP_TELEGRAM_VALIDATION** (для тестирования без ngrok)

## Предварительные требования

- ✅ VPS сервер с Ubuntu 20.04/22.04
- ✅ Доступ по SSH
- ✅ Домен настроен (например, `rocket-lunch.duckdns.org`)
- ✅ Git установлен на VPS
- ✅ Node.js 18+ установлен
- ✅ PM2 установлен глобально: `npm install -g pm2`
- ✅ Nginx установлен (опционально, для reverse proxy)

## Шаг 1: Подготовка .env.prod-dev файлов

### На локальной машине

Убедитесь, что у вас есть правильные `.env.prod-dev` файлы:

#### `backend/.env.prod-dev`
```bash
# Node Environment
NODE_ENV=production

# Server
API_PORT=3001
HOST=0.0.0.0

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBAPP_URL=https://rocket-lunch.duckdns.org
BOT_USERNAME=rocket_lunch_bot

# Database
DATABASE_URL="file:./prisma/dev.db"

# Security
JWT_SECRET=your_jwt_secret_here

# ВАЖНО: Включаем для тестирования
SKIP_TELEGRAM_VALIDATION=true

# Logging
LOG_LEVEL=info

# Features
ENABLE_SENTRY=false
```

#### `frontend/.env.prod-dev`
```bash
# API Configuration
VITE_API_URL=/api

# Bot Configuration
VITE_BOT_USERNAME=rocket_lunch_bot

# Environment
VITE_ENV=prod-dev

# Debug
VITE_DEBUG=true
```

## Шаг 2: Создание деплой скрипта для PROD-DEV

Создайте файл `deploy-prod-dev-vps.sh` на локальной машине:

```bash
#!/bin/bash

# ===============================================
# 🚀 VPS PROD-DEV Deployment Script
# ===============================================
# Deploys optimized build with debug features
# Domain: rocket-lunch.duckdns.org
# Branch: feature/new_version

set -e  # Exit on any error

echo "🚀 Starting PROD-DEV deployment to VPS..."

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feature/new_version" ]; then
    echo "⚠️  Warning: Not on feature/new_version branch!"
    echo "Switching to feature/new_version..."
    git checkout feature/new_version
fi

# ===============================================
# 1. Environment Setup
# ===============================================
echo "📦 Setting up PROD-DEV environment..."

# Backup current .env files
if [ -f backend/.env ]; then
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
fi
if [ -f frontend/.env ]; then
    cp frontend/.env frontend/.env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy PROD-DEV environment files
if [ -f backend/.env.prod-dev ]; then
    cp backend/.env.prod-dev backend/.env
    echo "✅ Loaded backend/.env.prod-dev"
else
    echo "❌ ERROR: backend/.env.prod-dev not found!"
    exit 1
fi

if [ -f frontend/.env.prod-dev ]; then
    cp frontend/.env.prod-dev frontend/.env
    echo "✅ Loaded frontend/.env.prod-dev"
else
    echo "❌ ERROR: frontend/.env.prod-dev not found!"
    exit 1
fi

# ===============================================
# 2. Install Dependencies
# ===============================================
echo "📦 Installing dependencies..."

# Backend dependencies
cd backend
npm ci --only=production
cd ..

# Frontend dependencies (needed for build)
cd frontend
npm ci
cd ..

echo "✅ Dependencies installed"

# ===============================================
# 3. Build Frontend (PROD-DEV mode)
# ===============================================
echo "🏗️  Building frontend (PROD-DEV)..."

cd frontend

# Check if build:prod-dev script exists
if grep -q "build:prod-dev" package.json; then
    npm run build:prod-dev
else
    # Fallback to regular build
    npm run build
fi

cd ..

echo "✅ Frontend built successfully"

# ===============================================
# 4. Build Backend
# ===============================================
echo "🏗️  Building backend..."

cd backend
npm run build
cd ..

echo "✅ Backend built successfully"

# ===============================================
# 5. Database Setup
# ===============================================
echo "🗄️  Setting up database..."

cd backend

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:push

cd ..

echo "✅ Database configured"

# ===============================================
# 6. PM2 Process Management
# ===============================================
echo "🔄 Configuring PM2..."

cd backend

# Stop existing process if running
pm2 delete rocket-lunch-bot 2>/dev/null || true

# Start application with PM2
pm2 start dist/index.js --name rocket-lunch-bot \
  --max-memory-restart 500M \
  --env production \
  --log-date-format "YYYY-MM-DD HH:mm:ss Z"

# Save PM2 configuration
pm2 save

cd ..

echo "✅ PM2 configured"

# ===============================================
# 7. Final Checks
# ===============================================
echo "🔍 Running final checks..."

# Check if process is running
pm2 status

# Show logs (last 20 lines)
echo ""
echo "📋 Recent logs:"
pm2 logs rocket-lunch-bot --lines 20 --nostream

echo ""
echo "✅ PROD-DEV deployment completed successfully!"
echo ""
echo "🔍 Debug features enabled:"
echo "  ✓ console.log preserved"
echo "  ✓ Source maps enabled"
echo "  ✓ SKIP_TELEGRAM_VALIDATION=true"
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs rocket-lunch-bot --lines 100  - View logs"
echo "  pm2 restart rocket-lunch-bot  - Restart app"
echo "  pm2 monit  - Monitor app"
echo "  curl http://localhost:3001/api/health  - Check API health"
echo ""
echo "🌐 Application URL: https://rocket-lunch.duckdns.org"
echo ""
```

Сохраните этот файл как `telegram-food-bot/deploy-prod-dev-vps.sh`.

## Шаг 3: Сделайте скрипт исполняемым

```bash
chmod +x deploy-prod-dev-vps.sh
```

## Шаг 4: Закоммитьте изменения

```bash
git add backend/.env.prod-dev frontend/.env.prod-dev deploy-prod-dev-vps.sh
git commit -m "feat: add PROD-DEV deployment configuration for VPS"
git push origin feature/new_version
```

## Шаг 5: Деплой на VPS

### SSH на VPS

```bash
ssh your_user@your_vps_ip
```

### Перейдите в директорию проекта

```bash
cd ~/telegram-food-bot
# или
cd /var/www/telegram-food-bot
```

### Подтяните последние изменения

```bash
git fetch origin
git checkout feature/new_version
git pull origin feature/new_version
```

### Запустите деплой скрипт

```bash
./deploy-prod-dev-vps.sh
```

## Шаг 6: Проверка деплоя

### Проверьте статус PM2

```bash
pm2 status
```

Вы должны увидеть:
```
┌─────┬────────────────────┬─────────┬─────────┬──────────┬────────┬─────────┐
│ id  │ name               │ mode    │ ↺       │ status   │ cpu    │ memory  │
├─────┼────────────────────┼─────────┼─────────┼──────────┼────────┼─────────┤
│ 0   │ rocket-lunch-bot   │ fork    │ 0       │ online   │ 0%     │ 50.0mb  │
└─────┴────────────────────┴─────────┴─────────┴──────────┴────────┴─────────┘
```

### Проверьте логи

```bash
pm2 logs rocket-lunch-bot --lines 50
```

Вы должны увидеть:
```
[2025-10-31 12:00:00] INFO: 🚀 Backend server started successfully
[2025-10-31 12:00:00] INFO: API running on http://0.0.0.0:3001
[2025-10-31 12:00:00] INFO: SKIP_TELEGRAM_VALIDATION: true
[2025-10-31 12:00:00] INFO: 🤖 Telegram bot connected
```

### Проверьте API Health

```bash
curl http://localhost:3001/api/health
```

Ответ должен быть:
```json
{
  "status": "ok",
  "timestamp": "2025-10-31T12:00:00.000Z",
  "uptime": 123.45
}
```

### Проверьте фронтенд

```bash
curl -I http://localhost:3001
```

Ответ должен быть:
```
HTTP/1.1 200 OK
Content-Type: text/html
```

## Шаг 7: Настройка Nginx (если используется)

Если вы используете Nginx как reverse proxy, убедитесь, что конфигурация корректна:

```nginx
server {
    listen 80;
    server_name rocket-lunch.duckdns.org;

    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rocket-lunch.duckdns.org;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/rocket-lunch.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rocket-lunch.duckdns.org/privkey.pem;

    # Reverse proxy к Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Перезагрузите Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Шаг 8: Настройка Telegram Webhook

### Удалите старый webhook (если есть)

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

### Установите новый webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"
```

### Проверьте webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Ответ должен содержать:
```json
{
  "ok": true,
  "result": {
    "url": "https://rocket-lunch.duckdns.org/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Шаг 9: Тестирование

### Откройте бота в Telegram

1. Найдите `@rocket_lunch_bot`
2. Нажмите `/start`
3. Откройте Mini App
4. Проверьте, что все работает

### Проверьте debug функции

1. **Console.log**: Логи должны быть видны в `pm2 logs`
   ```bash
   pm2 logs rocket-lunch-bot --lines 100
   ```

2. **Source maps**: Ошибки показывают оригинальный код, не минифицированный

3. **SKIP_TELEGRAM_VALIDATION**: Можно тестировать через ngrok или напрямую

## Шаг 10: Обновление (Zero Downtime)

Для обновления приложения без простоя:

```bash
# На VPS
cd ~/telegram-food-bot

# Подтянуть изменения
git pull origin feature/new_version

# Пересобрать
./deploy-prod-dev-vps.sh

# Или использовать update скрипт
./update-vps.sh
```

PM2 автоматически сделает graceful reload.

## Полезные команды

### PM2 Management

```bash
# Просмотр логов
pm2 logs rocket-lunch-bot

# Просмотр логов в реальном времени
pm2 logs rocket-lunch-bot --lines 100 --raw

# Мониторинг
pm2 monit

# Рестарт
pm2 restart rocket-lunch-bot

# Остановка
pm2 stop rocket-lunch-bot

# Удаление
pm2 delete rocket-lunch-bot

# Список процессов
pm2 list

# Информация о процессе
pm2 info rocket-lunch-bot
```

### Проверка здоровья

```bash
# API Health
curl http://localhost:3001/api/health

# Check process
pm2 status rocket-lunch-bot

# Check memory usage
pm2 info rocket-lunch-bot | grep memory

# Check logs for errors
pm2 logs rocket-lunch-bot --err --lines 50
```

### Debugging

```bash
# Следить за логами с фильтром
pm2 logs rocket-lunch-bot | grep ERROR

# Проверить переменные окружения
pm2 env 0  # где 0 - id процесса

# Посмотреть конфигурацию
cat backend/.env

# Проверить webhook
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

## Troubleshooting

### Проблема: App не запускается

**Решение:**
```bash
# Проверьте логи
pm2 logs rocket-lunch-bot --err --lines 100

# Проверьте .env файлы
cat backend/.env

# Проверьте порт
netstat -tuln | grep 3001

# Убедитесь, что порт свободен
sudo lsof -i :3001
```

### Проблема: Webhook не работает

**Решение:**
```bash
# Удалите webhook
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"

# Подождите 5 секунд
sleep 5

# Установите снова
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

# Проверьте
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

### Проблема: 502 Bad Gateway в Nginx

**Решение:**
```bash
# Проверьте, что app запущен
pm2 status rocket-lunch-bot

# Проверьте Nginx конфигурацию
sudo nginx -t

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log

# Перезапустите Nginx
sudo systemctl restart nginx
```

### Проблема: Database errors

**Решение:**
```bash
cd backend

# Пересоздайте Prisma Client
npm run db:generate

# Примените миграции
npm run db:push

# Перезапустите app
pm2 restart rocket-lunch-bot
```

## Переход с PROD-DEV на PRODUCTION

Когда всё оттестировано, переключитесь на production:

```bash
# Остановите PM2
pm2 stop rocket-lunch-bot

# Замените .env файлы
cp backend/.env.production backend/.env
cp frontend/.env.production frontend/.env

# Отредактируйте backend/.env
nano backend/.env
# Установите: SKIP_TELEGRAM_VALIDATION=false

# Пересоберите
./deploy-vps.sh

# Запустите
pm2 start rocket-lunch-bot
```

## Заключение

Вы успешно задеплоили **PROD-DEV** версию бота на VPS! 

Этот режим позволяет:
- ✅ Тестировать production билд в реальных условиях
- ✅ Дебажить с помощью console.log и source maps
- ✅ Быстро итерировать без ngrok
- ✅ Проверить production оптимизации

Когда всё будет стабильно работать, переключайтесь на полный production режим.

---

**Создано:** 2025-10-31  
**Версия:** 1.0.0  
**Проект:** Rocket Lunch Bot  
**Branch:** feature/new_version
