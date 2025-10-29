# 🚀 Production Deployment Guide - Rocket Lunch Bot

Полное руководство по развертыванию Telegram Food Bot в production.

---

## 📋 Содержание

1. [Предварительная подготовка](#1-предварительная-подготовка)
2. [Выбор хостинга](#2-выбор-хостинга)
3. [Настройка сервера](#3-настройка-сервера)
4. [Подготовка кода](#4-подготовка-кода)
5. [База данных](#5-база-данных)
6. [Переменные окружения](#6-переменные-окружения)
7. [SSL и домен](#7-ssl-и-домен)
8. [Nginx конфигурация](#8-nginx-конфигурация)
9. [Запуск приложения](#9-запуск-приложения)
10. [Telegram Webhook](#10-telegram-webhook)
11. [Мониторинг](#11-мониторинг)
12. [Бэкапы](#12-бэкапы)
13. [Проверка безопасности](#13-проверка-безопасности)

---

## 1. Предварительная подготовка

### ✅ Чек-лист перед деплоем:

- [ ] Код протестирован локально
- [ ] Все зависимости установлены и обновлены
- [ ] TypeScript код компилируется без ошибок
- [ ] Тесты пройдены (если есть)
- [ ] .env файлы настроены для production
- [ ] Секреты и токены подготовлены
- [ ] Документация актуальна

### 📝 Требования:

```bash
Node.js >= 18.x
PostgreSQL >= 14.x (или SQLite для малых проектов)
Nginx >= 1.18
Git
PM2 (process manager)
```

---

## 2. Выбор хостинга

### Рекомендуемые VPS провайдеры:

**Бюджетные варианты:**
- ✅ **DigitalOcean** - от $6/месяц (Droplet)
- ✅ **Hetzner Cloud** - от €4.15/месяц
- ✅ **Vultr** - от $6/месяц
- ✅ **Linode** (Akamai) - от $5/месяц

**Российские аналоги:**
- ✅ **Timeweb** - от 300₽/месяц
- ✅ **RuVDS** - от 200₽/месяц
- ✅ **Selectel** - от 350₽/месяц

### Минимальные требования к серверу:

```
CPU: 1 vCPU
RAM: 1GB (рекомендуется 2GB)
Disk: 25GB SSD
OS: Ubuntu 22.04 LTS
```

---

## 3. Настройка сервера

### 3.1. Первичная настройка

```bash
# Подключение к серверу
ssh root@your-server-ip

# Обновление системы
apt update && apt upgrade -y

# Установка базовых пакетов
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx
```

### 3.2. Создание пользователя

```bash
# Создать нового пользователя (не работать от root!)
adduser deployer
usermod -aG sudo deployer

# Настройка SSH ключей
mkdir -p /home/deployer/.ssh
cp ~/.ssh/authorized_keys /home/deployer/.ssh/
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys

# Переключиться на нового пользователя
su - deployer
```

### 3.3. Установка Node.js

```bash
# Установка Node.js 20.x через nvm (рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20

# Проверка
node --version
npm --version
```

### 3.4. Установка PM2

```bash
npm install -g pm2

# Автозапуск PM2 при перезагрузке
pm2 startup
# Выполнить команду, которую покажет PM2
```

### 3.5. Установка PostgreSQL (опционально)

```bash
# Если используете PostgreSQL вместо SQLite
sudo apt install -y postgresql postgresql-contrib

# Настройка базы данных
sudo -u postgres psql

CREATE DATABASE rocket_lunch_db;
CREATE USER rocket_lunch_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE rocket_lunch_db TO rocket_lunch_user;
\q
```

---

## 4. Подготовка кода

### 4.1. Клонирование репозитория

```bash
cd ~
git clone https://github.com/your-username/telegram-food-bot.git
cd telegram-food-bot

# Или через SSH (если настроен deploy key)
git clone git@github.com:your-username/telegram-food-bot.git
```

### 4.2. Установка зависимостей

```bash
# Backend
cd telegram-food-bot/backend
npm ci --production
npm run build

# Frontend
cd ../frontend
npm ci
npm run build
```

### 4.3. Проверка билда

```bash
# Проверить что dist папки созданы
ls -la backend/dist
ls -la frontend/dist
```

---

## 5. База данных

### 5.1. SQLite (простой вариант)

```bash
cd telegram-food-bot/backend

# Prisma миграции
npx prisma migrate deploy

# Проверка
ls -la prisma/production.db
```

### 5.2. PostgreSQL (рекомендуется для production)

```bash
# Обновить DATABASE_URL в .env
# DATABASE_URL="postgresql://rocket_lunch_user:password@localhost:5432/rocket_lunch_db"

# Запустить миграции
npx prisma migrate deploy

# Проверка подключения
npx prisma db pull
```

---

## 6. Переменные окружения

### 6.1. Backend .env

```bash
cd ~/telegram-food-bot/backend
nano .env.production
```

**Содержимое `.env.production`:**

```bash
# ===============================================
# 🚀 PRODUCTION ENVIRONMENT
# ===============================================

# ===============================================
# DATABASE - PostgreSQL для production
# ===============================================
DATABASE_URL="postgresql://rocket_lunch_user:STRONG_PASSWORD@localhost:5432/rocket_lunch_db"
# Или SQLite:
# DATABASE_URL="file:./prisma/production.db"

# ===============================================
# TELEGRAM BOT - Webhook режим
# ===============================================
BOT_TOKEN=your_bot_token_from_botfather
BOT_USERNAME=your_bot_username
BOT_MODE=webhook

# ⚠️ ВАЖНО: Используем webhook для production
BOT_WEBHOOK_URL=https://your-domain.com/api/webhook

# ===============================================
# TELEGRAM WEBAPP
# ===============================================
TELEGRAM_SECRET_KEY=your_bot_token_from_botfather
WEBAPP_URL=https://your-domain.com

# ===============================================
# API SERVER
# ===============================================
API_PORT=3001
API_HOST=127.0.0.1

# ===============================================
# ENVIRONMENT
# ===============================================
NODE_ENV=production

# ===============================================
# LOGGING
# ===============================================
LOG_LEVEL=info
LOG_FORMAT=combined

# ===============================================
# SECURITY - КРИТИЧЕСКИ ВАЖНО!
# ===============================================
# Генерация: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=GENERATE_STRONG_SECRET_HERE_128_CHARS

# Разрешенные домены для CORS
CORS_ORIGIN=https://your-domain.com

# ===============================================
# ADMIN CONFIGURATION
# ===============================================
ADMIN_USER_IDS=your_telegram_id

# ===============================================
# NOTIFICATION SETTINGS
# ===============================================
NOTIFICATION_ENABLED=true
NOTIFICATION_DELAY_MINUTES=5

# ===============================================
# POLL SETTINGS
# ===============================================
POLL_DURATION_MINUTES=30
AUTO_ROULETTE_ENABLED=true

# ===============================================
# PRODUCTION SECURITY
# ===============================================
# ⚠️ ВСЕГДА false в production!
SKIP_TELEGRAM_VALIDATION=false
```

### 6.2. Генерация секретов

```bash
# JWT_SECRET (128 символов)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Скопировать результат в .env как JWT_SECRET
```

### 6.3. Frontend .env

```bash
cd ~/telegram-food-bot/frontend
nano .env.production
```

**Содержимое `.env.production`:**

```bash
# ===============================================
# 🎨 FRONTEND PRODUCTION
# ===============================================

# API Backend URL
VITE_API_URL=https://your-domain.com/api

# Telegram Bot Username
VITE_BOT_USERNAME=your_bot_username

# Environment
VITE_NODE_ENV=production

# ===============================================
# MOCK API - ОТКЛЮЧИТЬ!
# ===============================================
VITE_USE_MOCK_API=false

# ===============================================
# ERROR TRACKING (опционально)
# ===============================================
VITE_SENTRY_DSN=
VITE_APP_VERSION=1.0.0
```

---

## 7. SSL и домен

### 7.1. Настройка DNS

В панели вашего регистратора доменов:

```
A запись:  your-domain.com → your_server_ip
A запись:  www.your-domain.com → your_server_ip
```

### 7.2. Получение SSL сертификата

```bash
# Установка Certbot (если еще не установлен)
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

---

## 8. Nginx конфигурация

### 8.1. Создание конфига

```bash
sudo nano /etc/nginx/sites-available/rocket-lunch-bot
```

**Содержимое:**

```nginx
# Frontend + Backend + Webhook
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration (настроит Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Frontend - React App
    location / {
        root /home/deployer/telegram-food-bot/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Telegram Webhook
    location /api/webhook {
        proxy_pass http://127.0.0.1:3001/api/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Только Telegram может вызывать webhook
        # allow 149.154.160.0/20;
        # allow 91.108.4.0/22;
        # deny all;
    }
    
    # Logs
    access_log /var/log/nginx/rocket-lunch-bot.access.log;
    error_log /var/log/nginx/rocket-lunch-bot.error.log;
}
```

### 8.2. Активация конфига

```bash
# Создать симлинк
sudo ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/

# Удалить дефолтный конфиг
sudo rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

---

## 9. Запуск приложения

### 9.1. PM2 конфигурация

```bash
cd ~/telegram-food-bot/backend
nano ecosystem.config.js
```

**Содержимое `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './dist/index.js',
    cwd: '/home/deployer/telegram-food-bot/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    env_production: {
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
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'prisma'],
  }]
};
```

### 9.2. Запуск через PM2

```bash
cd ~/telegram-food-bot/backend

# Загрузить .env.production
cp .env.production .env

# Запустить приложение
pm2 start ecosystem.config.js --env production

# Сохранить конфигурацию для автозапуска
pm2 save

# Проверить статус
pm2 status
pm2 logs rocket-lunch-bot

# Полезные команды PM2:
# pm2 restart rocket-lunch-bot  # Перезапуск
# pm2 stop rocket-lunch-bot      # Остановка
# pm2 delete rocket-lunch-bot    # Удаление
# pm2 monit                      # Мониторинг в реальном времени
```

---

## 10. Telegram Webhook

### 10.1. Установка webhook

```bash
cd ~/telegram-food-bot/backend

# Создать скрипт для установки webhook
nano set-webhook.js
```

**Содержимое `set-webhook.js`:**

```javascript
const https = require('https');
require('dotenv').config({ path: './.env' });

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

if (!BOT_TOKEN || !WEBHOOK_URL) {
  console.error('❌ BOT_TOKEN или BOT_WEBHOOK_URL не установлены');
  process.exit(1);
}

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/setWebhook`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const data = JSON.stringify({
  url: WEBHOOK_URL,
  allowed_updates: ['message', 'callback_query', 'my_chat_member'],
  drop_pending_updates: true,
});

console.log('🔄 Установка webhook...');
console.log('📍 URL:', WEBHOOK_URL);

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    const result = JSON.parse(responseData);
    
    if (result.ok) {
      console.log('✅ Webhook успешно установлен!');
      console.log('📋 Описание:', result.description);
    } else {
      console.error('❌ Ошибка установки webhook:', result.description);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

req.write(data);
req.end();
```

### 10.2. Запуск установки webhook

```bash
node set-webhook.js
```

### 10.3. Проверка webhook

```bash
# Создать скрипт проверки
nano check-webhook.js
```

**Содержимое:**

```javascript
const https = require('https');
require('dotenv').config({ path: './.env' });

const BOT_TOKEN = process.env.BOT_TOKEN;

https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const info = JSON.parse(data);
    console.log('📡 Webhook Info:');
    console.log(JSON.stringify(info.result, null, 2));
  });
});
```

```bash
node check-webhook.js
```

### 10.4. Обновление Menu Button

```bash
nano update-menu-button.js
```

**Содержимое:**

```javascript
const https = require('https');
require('dotenv').config({ path: './.env' });

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${BOT_TOKEN}/setChatMenuButton`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const data = JSON.stringify({
  menu_button: {
    type: 'web_app',
    text: '📋 Мои группы',
    web_app: {
      url: WEBAPP_URL
    }
  }
});

console.log('🔄 Установка Menu Button...');

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    const result = JSON.parse(responseData);
    console.log(result.ok ? '✅ Menu Button установлен!' : '❌ Ошибка:', result.description);
  });
});

req.write(data);
req.end();
```

```bash
node update-menu-button.js
```

---

## 11. Мониторинг

### 11.1. PM2 мониторинг

```bash
# Веб-интерфейс PM2 Plus (бесплатно для 1 сервера)
pm2 link your_secret_key your_public_key

# Локальный мониторинг
pm2 monit

# Логи в реальном времени
pm2 logs rocket-lunch-bot --lines 100
```

### 11.2. Системный мониторинг

```bash
# Установка htop
sudo apt install htop

# Мониторинг ресурсов
htop

# Проверка дискового пространства
df -h

# Проверка памяти
free -h
```

### 11.3. Логирование

```bash
# Настройка ротации логов
sudo nano /etc/logrotate.d/rocket-lunch-bot
```

**Содержимое:**

```
/home/deployer/telegram-food-bot/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deployer deployer
    sharedscripts
}
```

### 11.4. Мониторинг Nginx

```bash
# Просмотр access логов
sudo tail -f /var/log/nginx/rocket-lunch-bot.access.log

# Просмотр error логов
sudo tail -f /var/log/nginx/rocket-lunch-bot.error.log
```

---

## 12. Бэкапы

### 12.1. Автоматический бэкап базы данных

```bash
# Создать директорию для бэкапов
mkdir -p ~/backups

# Создать скрипт бэкапа
nano ~/backup-db.sh
```

**Содержимое `backup-db.sh`:**

```bash
#!/bin/bash

BACKUP_DIR="/home/deployer/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/home/deployer/telegram-food-bot/backend/prisma/production.db"

# Для SQLite
cp $DB_PATH "$BACKUP_DIR/db_backup_$DATE.db"

# Для PostgreSQL
# pg_dump -U rocket_lunch_user rocket_lunch_db > "$BACKUP_DIR/db_backup_$DATE.sql"

# Удалить старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "db_backup_*.db" -mtime +30 -delete

echo "✅ Backup completed: db_backup_$DATE.db"
```

```bash
chmod +x ~/backup-db.sh
```

### 12.2. Настройка cron для автоматических бэкапов

```bash
crontab -e
```

**Добавить:**

```cron
# Бэкап базы данных каждый день в 3:00 ночи
0 3 * * * /home/deployer/backup-db.sh >> /home/deployer/backups/backup.log 2>&1
```

---

## 13. Проверка безопасности

### 13.1. Файрвол (UFW)

```bash
# Установка и настройка
sudo apt install ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

sudo ufw enable
sudo ufw status
```

### 13.2. Проверка переменных окружения

```bash
# ⚠️ КРИТИЧЕСКИ ВАЖНО!
# Убедитесь что эти параметры установлены правильно:

cd ~/telegram-food-bot/backend
grep -E 'NODE_ENV|SKIP_TELEGRAM_VALIDATION|JWT_SECRET' .env
```

**Должно быть:**
```
NODE_ENV=production
SKIP_TELEGRAM_VALIDATION=false
JWT_SECRET=очень_длинный_случайный_ключ_128_символов
```

### 13.3. Проверка прав доступа

```bash
# Файлы .env должны быть недоступны для чтения другими пользователями
chmod 600 ~/telegram-food-bot/backend/.env
chmod 600 ~/telegram-food-bot/frontend/.env

# Проверка
ls -la ~/telegram-food-bot/backend/.env
# Должно быть: -rw------- (600)
```

### 13.4. Fail2Ban (опционально)

```bash
# Защита от брутфорса SSH
sudo apt install fail2ban

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 14. Деплой обновлений

### 14.1. Скрипт для автоматического деплоя

```bash
nano ~/deploy.sh
```

**Содержимое:**

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

cd ~/telegram-food-bot

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Backend
echo "🔨 Building backend..."
cd backend
npm ci --production
npm run build

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm ci
npm run build

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart rocket-lunch-bot

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed!"
echo "📊 Check status: pm2 status"
echo "📋 Check logs: pm2 logs rocket-lunch-bot"
```

```bash
chmod +x ~/deploy.sh
```

### 14.2. Использование

```bash
# Запуск деплоя
~/deploy.sh

# Проверка
pm2 logs rocket-lunch-bot --lines 50
```

---

## 15. Финальная проверка

### ✅ Чек-лист после деплоя:

- [ ] Сервер доступен по HTTPS
- [ ] SSL сертификат валиден
- [ ] Frontend открывается (https://your-domain.com)
- [ ] API отвечает (https://your-domain.com/api/health)
- [ ] Webhook установлен и работает
- [ ] Бот отвечает в Telegram
- [ ] Mini App открывается из бота
- [ ] Авторизация работает
- [ ] Голосования создаются
- [ ] Уведомления приходят
- [ ] Логи пишутся корректно
- [ ] PM2 показывает статус "online"
- [ ] Бэкапы настроены
- [ ] Файрвол настроен

### 15.1. Тестирование

```bash
# 1. Проверка API
curl https://your-domain.com/api/health

# 2. Проверка webhook
curl https://your-domain.com/api/webhook
# Должен вернуть 405 (метод не разрешен)

# 3. Проверка SSL
curl -I https://your-domain.com

# 4. Проверка статуса бота
cd ~/telegram-food-bot/backend
node check-webhook.js
```

### 15.2. Проверка через Telegram

1. Откройте бота в Telegram
2. Отправьте команду `/start`
3. Нажмите на кнопку Menu
4. Mini App должен открыться
5. Попробуйте создать голосование в группе
6. Проверьте что уведомления работают

---

## 16. Решение проблем

### Бот не отвечает:

```bash
# Проверить логи PM2
pm2 logs rocket-lunch-bot

# Перезапустить
pm2 restart rocket-lunch-bot

# Проверить статус
pm2 status
```

### Webhook не работает:

```bash
# Проверить webhook info
node check-webhook.js

# Переустановить webhook
node set-webhook.js

# Проверить логи Nginx
sudo tail -f /var/log/nginx/rocket-lunch-bot.error.log
```

### 502 Bad Gateway:

```bash
# Backend не запущен или недоступен
pm2 status
pm2 restart rocket-lunch-bot

# Проверить порт
netstat -tulpn | grep 3001
```

### SSL не работает:

```bash
# Проверить сертификат
sudo certbot certificates

# Обновить сертификат
sudo certbot renew

# Проверить конфигурацию Nginx
sudo nginx -t
```

---

## 17. Полезные команды

```bash
# === PM2 ===
pm2 status                    # Статус всех приложений
pm2 logs rocket-lunch-bot     # Логи в реальном времени
pm2 restart rocket-lunch-bot  # Перезапуск
pm2 stop rocket-lunch-bot     # Остановка
pm2 monit                     # Мониторинг ресурсов

# === Nginx ===
sudo nginx -t                 # Проверка конфигурации
sudo systemctl restart nginx  # Перезапуск
sudo systemctl status nginx   # Статус

# === Логи ===
tail -f ~/telegram-food-bot/backend/logs/combined.log  # Логи бэкенда
sudo tail -f /var/log/nginx/access.log                # Nginx access
sudo tail -f /var/log/nginx/error.log                 # Nginx error

# === База данных ===
cd ~/telegram-food-bot/backend
npx prisma studio  # Веб-интерфейс для БД

# === Git ===
git pull origin main  # Обновление кода
git status           # Статус репозитория
```

---

## 18. Контакты и поддержка

- **Документация Telegram Bot API:** https://core.telegram.org/bots/api
- **Документация Telegram Mini Apps:** https://core.telegram.org/bots/webapps
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Nginx Documentation:** https://nginx.org/en/docs/

---

## 🎉 Поздравляем!

Ваш Telegram Food Bot развернут в production и готов к использованию!

**Важные напоминания:**
- Регулярно проверяйте логи
- Мониторьте использование ресурсов
- Делайте бэкапы базы данных
- Обновляйте зависимости
- Следите за безопасностью

**Удачи! 🚀**
