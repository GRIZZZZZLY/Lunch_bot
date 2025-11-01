# 🚀 Быстрый деплой PROD-DEV на VPS

## TL;DR - Команды для копипасты

```bash
# 1. SSH на VPS
ssh your_user@your_vps_ip

# 2. Перейти в проект
cd ~/telegram-food-bot

# 3. Подтянуть изменения
git fetch origin
git checkout feature/new_version
git pull origin feature/new_version

# 4. Задеплоить
chmod +x deploy-prod-dev-vps.sh
./deploy-prod-dev-vps.sh

# 5. Проверить
pm2 status
pm2 logs rocket-lunch-bot --lines 50
curl http://localhost:3001/api/health
```

## Что нужно изменить ПЕРЕД деплоем

### 1. Backend `.env.prod-dev` (обязательно!)

```bash
# Отредактируйте на VPS перед деплоем:
nano backend/.env.prod-dev
```

Измените следующие параметры:

```bash
# ❌ БЫЛО (для локальной разработки):
WEBAPP_URL=http://localhost:3001
API_HOST=127.0.0.1

# ✅ СТАЛО (для VPS):
WEBAPP_URL=https://rocket-lunch.duckdns.org
API_HOST=0.0.0.0  # Чтобы слушать на всех интерфейсах
```

Остальное можно оставить как есть:
- ✅ `SKIP_TELEGRAM_VALIDATION=true` - для тестирования
- ✅ `BOT_MODE=polling` - не требует webhook
- ✅ `LOG_LEVEL=info` - для дебаггинга

### 2. Frontend `.env.prod-dev` (уже готов!)

Файл уже правильно настроен:
```bash
VITE_API_URL=/api  # Относительный путь
VITE_BOT_USERNAME=rocket_lunch_bot
```

Ничего менять не нужно! ✅

## После деплоя

### Проверьте, что всё работает

```bash
# 1. Статус PM2
pm2 status
# Должно быть: status = online

# 2. Логи (без ошибок)
pm2 logs rocket-lunch-bot --lines 100
# Должно быть: 
# ✓ Backend server started
# ✓ Telegram bot connected

# 3. API Health
curl http://localhost:3001/api/health
# Должно быть: {"status":"ok",...}

# 4. Frontend
curl -I http://localhost:3001
# Должно быть: HTTP/1.1 200 OK
```

### Настройте Telegram

```bash
# ВАРИАНТ 1: Webhook (если используете Nginx + SSL)
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

# ВАРИАНТ 2: Polling (если нет SSL или тестируете)
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
# Бот автоматически использует polling из .env
```

### Откройте в Telegram

1. Найдите `@rocket_lunch_bot`
2. `/start`
3. Откройте Mini App
4. Проверьте все функции

## Debug на VPS

```bash
# Следить за логами в реальном времени
pm2 logs rocket-lunch-bot --raw

# Проверить переменные окружения
cat backend/.env | grep SKIP

# Проверить, какой порт слушает
netstat -tuln | grep 3001

# Проверить использование памяти
pm2 info rocket-lunch-bot | grep memory

# Рестарт если что-то не так
pm2 restart rocket-lunch-bot
```

## Частые проблемы

### ❌ App не запускается

```bash
# Проверьте логи
pm2 logs rocket-lunch-bot --err --lines 100

# Возможные причины:
# 1. Порт занят
sudo lsof -i :3001

# 2. База данных не создалась
cd backend
npm run db:push
cd ..
pm2 restart rocket-lunch-bot
```

### ❌ Telegram бот не отвечает

```bash
# 1. Проверьте токен
cat backend/.env | grep BOT_TOKEN

# 2. Проверьте webhook
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"

# 3. Удалите webhook (для polling mode)
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"

# 4. Рестарт
pm2 restart rocket-lunch-bot
```

### ❌ Frontend показывает 404

```bash
# 1. Проверьте, что frontend собрался
ls -la frontend/dist/index.html

# 2. Если нет, пересоберите
cd frontend
npm run build
cd ..

# 3. Рестарт
pm2 restart rocket-lunch-bot
```

## Переход на Production

Когда всё оттестировано:

```bash
# 1. Остановите app
pm2 stop rocket-lunch-bot

# 2. Измените .env
nano backend/.env
# Найдите и измените:
SKIP_TELEGRAM_VALIDATION=false
NODE_ENV=production

# 3. Используйте production скрипт
./deploy-vps.sh

# 4. Проверьте
pm2 logs rocket-lunch-bot
```

## Полезные ссылки

- 📖 **Полная инструкция**: [DEPLOY_PROD_DEV_TO_VPS.md](./DEPLOY_PROD_DEV_TO_VPS.md)
- 🔧 **Локальная разработка**: [start-prod-dev.ps1](./start-prod-dev.ps1)
- 🚀 **Production деплой**: [deploy-vps.sh](./deploy-vps.sh)

---

**Создано:** 2025-10-31  
**Для:** Быстрого деплоя PROD-DEV на VPS
