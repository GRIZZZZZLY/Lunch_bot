# 🚀 Деплой Telegram Food Bot на VPS

**Сервер:** Ubuntu 24.04.3 LTS  
**Доступ:** SSH (igor@vm-v2-mini)

---

## 📋 Предварительные Требования

### На VPS должны быть установлены:
- ✅ Node.js 18+ (рекомендуется 22.x)
- ✅ npm или yarn
- ✅ PM2 (для управления процессами)
- ✅ Git
- ✅ Nginx (опционально, для reverse proxy)

---

## 🔧 Шаг 1: Установка Зависимостей на VPS

```bash
# Подключитесь к серверу
ssh igor@vm-v2-mini

# Обновите систему
sudo apt update
sudo apt upgrade -y

# Установите Node.js 22.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Проверьте версии
node --version  # должно быть v22.x.x
npm --version   # должно быть 10.x.x

# Установите PM2 глобально
sudo npm install -g pm2

# Установите Git (если не установлен)
sudo apt install -y git

# Установите Nginx (опционально)
sudo apt install -y nginx
```

---

## 📁 Шаг 2: Подготовка Проекта на Локальной Машине

### 2.1 Создайте Production Build

```powershell
# На вашем Windows ПК
cd E:\Lunch_bot\telegram-food-bot

# Backend build
cd backend
npm run build:prod
cd ..

# Frontend build
cd frontend
npm run build
cd ..
```

### 2.2 Создайте .env для Production

**Backend `.env.production`:**
```env
# DATABASE
DATABASE_URL=file:./prisma/prod.db

# TELEGRAM BOT
BOT_TOKEN=8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk
BOT_USERNAME=rocket_lunch_bot
BOT_MODE=webhook

# WEBHOOK (замените на ваш домен)
BOT_WEBHOOK_URL=https://your-domain.com/webhook

# PROXY (если нужен)
USE_PROXY=false
PROXY_URL=

# WEBAPP URL (замените на ваш домен)
TELEGRAM_SECRET_KEY=8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk
WEBAPP_URL=https://your-domain.com

# API SERVER
API_PORT=3001
API_HOST=0.0.0.0

# ENVIRONMENT
NODE_ENV=production

# LOGGING
LOG_LEVEL=info
LOG_FORMAT=json

# SECURITY
JWT_SECRET=1e1cd5f02f991e068756264c7b1e9bb70dfa5036ab5c9bb298e6fc92a9f5fc92f95460e8dcc3e0abf49b11898c7ad0584c0cd42509388b001cbd18248bab8b7b
CORS_ORIGIN=https://your-domain.com

# ADMIN
ADMIN_USER_IDS=555502880

# FEATURES
NOTIFICATION_ENABLED=true
NOTIFICATION_DELAY_MINUTES=5
POLL_DURATION_MINUTES=30
AUTO_ROULETTE_ENABLED=true

# FILE UPLOAD
MAX_FILE_SIZE_MB=5
UPLOAD_PATH=./uploads

# SECURITY - PRODUCTION MODE
SKIP_TELEGRAM_VALIDATION=false
```

---

## 📤 Шаг 3: Загрузка на VPS

### Вариант A: Через Git (Рекомендуется)

```bash
# На VPS
cd ~
git clone https://github.com/your-username/telegram-food-bot.git
cd telegram-food-bot

# Или если уже есть локальный репозиторий
cd ~/telegram-food-bot
git pull origin main
```

### Вариант B: Через SCP/SFTP

**На Windows (PowerShell):**
```powershell
# Архивируйте проект (исключая node_modules)
cd E:\Lunch_bot
tar -czf telegram-food-bot.tar.gz `
  --exclude="telegram-food-bot/node_modules" `
  --exclude="telegram-food-bot/backend/node_modules" `
  --exclude="telegram-food-bot/frontend/node_modules" `
  --exclude="telegram-food-bot/backend/dist" `
  --exclude="telegram-food-bot/frontend/dist" `
  --exclude="telegram-food-bot/backend/logs" `
  --exclude="telegram-food-bot/backend/prisma/dev.db" `
  telegram-food-bot

# Загрузите на VPS
scp telegram-food-bot.tar.gz igor@vm-v2-mini:~/

# На VPS распакуйте
ssh igor@vm-v2-mini
cd ~
tar -xzf telegram-food-bot.tar.gz
```

---

## 🔨 Шаг 4: Установка Зависимостей на VPS

```bash
# На VPS
cd ~/telegram-food-bot

# Backend
cd backend
npm ci --production
npm run db:generate
cd ..

# Frontend (уже собран локально, просто копируем dist)
# Ничего не нужно, dist уже есть
```

---

## 🗄️ Шаг 5: Настройка БазыДанных

```bash
cd ~/telegram-food-bot/backend

# Создайте production БД
npm run db:push

# Заполните меню (опционально)
npm run db:seed

# Сделайте себя админом
npm run make-admin
# Введите ваш Telegram ID: 555502880
```

---

## 🚀 Шаг 6: Запуск с PM2

### 6.1 Создайте ecosystem.config.js

```bash
cd ~/telegram-food-bot
nano ecosystem.config.js
```

**Содержимое `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'food-bot-backend',
      script: './backend/dist/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
    },
  ],
};
```

### 6.2 Запустите PM2

```bash
# Запустите приложение
pm2 start ecosystem.config.js

# Проверьте статус
pm2 status

# Просмотр логов
pm2 logs food-bot-backend

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

---

## 🌐 Шаг 7: Настройка Nginx (опционально)

### 7.1 Создайте конфиг Nginx

```bash
sudo nano /etc/nginx/sites-available/food-bot
```

**Содержимое конфига:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Frontend (статика)
    location / {
        root /home/igor/telegram-food-bot/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Кэширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Увеличенные таймауты для длинных запросов
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Webhook для Telegram Bot
    location /webhook {
        proxy_pass http://localhost:3001/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Логи
    access_log /var/log/nginx/food-bot-access.log;
    error_log /var/log/nginx/food-bot-error.log;
}
```

### 7.2 Активируйте конфиг

```bash
# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/food-bot /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

---

## 🔒 Шаг 8: Настройка SSL (Let's Encrypt)

```bash
# Установите Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получите SSL сертификат
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автообновление сертификата
sudo certbot renew --dry-run
```

---

## 🔗 Шаг 9: Настройка Telegram Webhook

```bash
# На VPS создайте скрипт
cd ~/telegram-food-bot
nano set-webhook.sh
```

**Содержимое `set-webhook.sh`:**
```bash
#!/bin/bash
BOT_TOKEN="8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk"
WEBHOOK_URL="https://your-domain.com/webhook"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${WEBHOOK_URL}\",\"allowed_updates\":[\"message\",\"callback_query\",\"my_chat_member\",\"chat_member\"]}"
```

```bash
# Сделайте исполняемым и запустите
chmod +x set-webhook.sh
./set-webhook.sh
```

---

## ✅ Шаг 10: Проверка Работы

### 10.1 Проверьте процессы

```bash
# PM2 статус
pm2 status

# Логи backend
pm2 logs food-bot-backend --lines 50

# Nginx статус
sudo systemctl status nginx
```

### 10.2 Проверьте API

```bash
# Проверьте health endpoint
curl http://localhost:3001/health

# Проверьте через домен
curl https://your-domain.com/api/health
```

### 10.3 Проверьте в Telegram

1. Откройте бота @rocket_lunch_bot
2. Отправьте `/start`
3. Проверьте что Mini App открывается

---

## 🔄 Обновление Проекта

### Автоматический деплой через Git

```bash
cd ~/telegram-food-bot

# Создайте deploy скрипт
nano deploy.sh
```

**Содержимое `deploy.sh`:**
```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin main

# Backend
cd backend
echo "📦 Installing backend dependencies..."
npm ci --production

echo "🔨 Building backend..."
npm run build:prod

echo "🗄️ Running migrations..."
npm run db:migrate:prod

cd ..

# Restart PM2
echo "♻️ Restarting PM2..."
pm2 restart food-bot-backend

echo "✅ Deployment complete!"
pm2 status
```

```bash
chmod +x deploy.sh
```

### Запуск обновления

```bash
./deploy.sh
```

---

## 🛠️ Полезные Команды PM2

```bash
# Просмотр логов
pm2 logs food-bot-backend

# Просмотр логов в реальном времени
pm2 logs food-bot-backend --lines 100 -f

# Перезапуск
pm2 restart food-bot-backend

# Остановка
pm2 stop food-bot-backend

# Удаление из PM2
pm2 delete food-bot-backend

# Мониторинг ресурсов
pm2 monit

# Информация о процессе
pm2 info food-bot-backend
```

---

## 🔍 Troubleshooting

### Проблема 1: Backend не запускается

```bash
# Проверьте логи
pm2 logs food-bot-backend --err

# Проверьте .env файл
cat ~/telegram-food-bot/backend/.env

# Проверьте права доступа
ls -la ~/telegram-food-bot/backend/
```

### Проблема 2: Webhook не работает

```bash
# Проверьте webhook статус
curl "https://api.telegram.org/bot8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk/getWebhookInfo"

# Удалите webhook
curl "https://api.telegram.org/bot8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk/deleteWebhook"

# Установите заново
./set-webhook.sh
```

### Проблема 3: 502 Bad Gateway

```bash
# Проверьте что backend запущен
pm2 status

# Проверьте порт
netstat -tulpn | grep 3001

# Перезапустите backend
pm2 restart food-bot-backend
```

---

## 📊 Мониторинг

### Настройка PM2 Plus (опционально)

```bash
# Зарегистрируйтесь на pm2.io
# Получите ключ

pm2 link <secret> <public>
```

### Логи

```bash
# Backend логи
tail -f ~/telegram-food-bot/backend/logs/combined.log

# PM2 логи
tail -f ~/.pm2/logs/food-bot-backend-error.log
tail -f ~/.pm2/logs/food-bot-backend-out.log

# Nginx логи
sudo tail -f /var/log/nginx/food-bot-access.log
sudo tail -f /var/log/nginx/food-bot-error.log
```

---

## 🔐 Безопасность

### Firewall (UFW)

```bash
# Разрешите SSH
sudo ufw allow 22/tcp

# Разрешите HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включите firewall
sudo ufw enable

# Проверьте статус
sudo ufw status
```

### Регулярные бэкапы БД

```bash
# Создайте скрипт бэкапа
nano ~/backup-db.sh
```

**Содержимое `backup-db.sh`:**
```bash
#!/bin/bash
BACKUP_DIR=~/backups
DB_PATH=~/telegram-food-bot/backend/prisma/prod.db
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH "$BACKUP_DIR/prod.db.$DATE"

# Удаляем старые бэкапы (старше 7 дней)
find $BACKUP_DIR -name "prod.db.*" -mtime +7 -delete
```

```bash
chmod +x ~/backup-db.sh

# Добавьте в cron (каждый день в 3:00)
crontab -e
```

Добавьте строку:
```
0 3 * * * /home/igor/backup-db.sh
```

---

## ✅ Чеклист После Деплоя

- [ ] Backend запущен и работает (PM2)
- [ ] Frontend доступен через домен
- [ ] API отвечает на запросы
- [ ] Webhook установлен в Telegram
- [ ] SSL сертификат установлен
- [ ] Firewall настроен
- [ ] Бэкапы настроены
- [ ] Логирование работает
- [ ] Бот отвечает в Telegram
- [ ] Mini App открывается
- [ ] Голосование работает

---

**Готово! Ваш бот развёрнут на VPS! 🎉**
