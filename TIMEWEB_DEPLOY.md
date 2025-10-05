# 🚀 Деплой Telegram Food Bot на Timeweb

## 📋 Содержание
1. [Подготовка проекта](#подготовка-проекта)
2. [Настройка Timeweb](#настройка-timeweb)
3. [Деплой Backend (Node.js)](#деплой-backend-nodejs)
4. [Деплой Frontend (статика)](#деплой-frontend-статика)
5. [Настройка базы данных PostgreSQL](#настройка-базы-данных-postgresql)
6. [Настройка Telegram Bot](#настройка-telegram-bot)
7. [Автоматический деплой через Git](#автоматический-деплой-через-git)

---

## 🎯 Что нам нужно на Timeweb

### Вариант 1: Один VPS сервер (Рекомендуется)
- **VPS на Ubuntu/Debian** (от 190₽/мес)
- PostgreSQL
- Node.js приложение (Backend)
- Nginx для раздачи Frontend статики
- SSL сертификат (Let's Encrypt)

### Вариант 2: Два отдельных хостинга
- **Node.js хостинг** для Backend (от 99₽/мес)
- **Виртуальный хостинг** для Frontend (от 99₽/мес)
- **PostgreSQL база данных** (включена в тарифы)

**Рекомендую Вариант 1** - проще настроить и дешевле.

---

## 🔧 Подготовка проекта

### 1. Инициализация Git (если еще не сделано)

```powershell
cd E:\BOT_V2\Lunch_bot

# Инициализировать git
git init

# Создать .gitignore
```

Создайте файл `.gitignore` в корне проекта:

```
# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
build/
*/dist/
*/build/

# Environment variables
.env
.env.local
.env.production
*.env

# Database
*.db
*.sqlite
prisma/dev.db

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temp files
*.tmp
temp/
```

### 2. Подготовка Backend

Создайте файл `telegram-food-bot/backend/.env.example`:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_bot_token_here"
TELEGRAM_WEBHOOK_DOMAIN="https://api.yourdomain.ru"

# Frontend URL
FRONTEND_URL="https://yourdomain.ru"

# Server
PORT=3000
NODE_ENV=production
```

### 3. Проверка package.json Backend

Откройте `telegram-food-bot/backend/package.json` и убедитесь в наличии скриптов:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "prisma:migrate": "prisma migrate deploy",
    "prisma:generate": "prisma generate"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### 4. Подготовка Frontend для деплоя

Обновите `telegram-food-bot/frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'framer-motion': ['framer-motion'],
          'ui-vendor': ['lucide-react'],
        }
      }
    }
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  }
});
```

### 5. Соберите production build Frontend

```powershell
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
npm run build
```

Результат: папка `dist/` с готовыми файлами.

---

## 🌐 Настройка Timeweb

### Шаг 1: Покупка VPS

1. Перейдите на https://timeweb.com/ru/services/vps
2. Выберите тариф (минимум: 2GB RAM, 1 CPU)
3. Выберите ОС: **Ubuntu 22.04 LTS**
4. Оплатите и дождитесь создания сервера

После создания вы получите:
- IP адрес: `123.45.67.89`
- Root пароль
- SSH доступ

### Шаг 2: Регистрация домена (опционально)

1. Купите домен на Timeweb или подключите свой
2. Например: `foodbot.ru`
3. Настройте DNS записи:

```
A запись:  api.foodbot.ru  →  123.45.67.89
A запись:  foodbot.ru      →  123.45.67.89
```

Или используйте **поддомен от Timeweb** (бесплатно):
- `yourusername.twc1.net`

---

## 🔨 Деплой Backend (Node.js)

### 1. Подключение к VPS через SSH

```powershell
ssh root@123.45.67.89
# Введите пароль
```

### 2. Установка необходимого ПО

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка версии
node -v  # должно быть v20.x
npm -v

# Установка PostgreSQL
apt install -y postgresql postgresql-contrib

# Установка Nginx
apt install -y nginx

# Установка Git
apt install -y git

# Установка PM2 (менеджер процессов)
npm install -g pm2
```

### 3. Настройка PostgreSQL

```bash
# Войти в PostgreSQL
sudo -u postgres psql

# В консоли PostgreSQL:
CREATE DATABASE lunch_bot;
CREATE USER lunch_bot_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE lunch_bot TO lunch_bot_user;
\q

# Разрешить локальные подключения
echo "host    all             all             127.0.0.1/32            md5" >> /etc/postgresql/14/main/pg_hba.conf
systemctl restart postgresql
```

### 4. Клонирование проекта

```bash
# Создать директорию для проекта
mkdir -p /var/www/foodbot
cd /var/www/foodbot

# Клонировать из Git (если используете)
# git clone https://ваш-репозиторий.git .

# ИЛИ загрузить через SFTP/SCP
# Используйте WinSCP, FileZilla или:
```

**На вашем компьютере (Windows PowerShell):**

```powershell
# Скопировать backend на сервер
scp -r E:\BOT_V2\Lunch_bot\telegram-food-bot\backend root@123.45.67.89:/var/www/foodbot/
```

### 5. Настройка Backend на сервере

```bash
cd /var/www/foodbot/backend

# Установить зависимости
npm install --production

# Создать .env файл
nano .env
```

Вставьте конфигурацию:

```bash
DATABASE_URL="postgresql://lunch_bot_user:your_secure_password@localhost:5432/lunch_bot"
TELEGRAM_BOT_TOKEN="ваш_токен_бота"
TELEGRAM_WEBHOOK_DOMAIN="https://api.foodbot.ru"
FRONTEND_URL="https://foodbot.ru"
PORT=3000
NODE_ENV=production
```

Сохраните: `Ctrl+X → Y → Enter`

### 6. Применить миграции Prisma

```bash
# Сгенерировать Prisma Client
npx prisma generate

# Применить миграции
npx prisma migrate deploy
```

### 7. Собрать Backend

```bash
npm run build
```

### 8. Запустить через PM2

```bash
# Запустить приложение
pm2 start dist/index.js --name foodbot-backend

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Проверить статус
pm2 status
pm2 logs foodbot-backend
```

---

## 🎨 Деплой Frontend (статика)

### 1. Загрузить собранный Frontend

**На вашем компьютере:**

```powershell
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend

# Убедитесь что build собран
npm run build

# Скопировать на сервер
scp -r dist root@123.45.67.89:/var/www/foodbot/frontend
```

### 2. Настройка Nginx

**На сервере:**

```bash
# Создать конфиг для Frontend
nano /etc/nginx/sites-available/foodbot-frontend
```

Вставьте:

```nginx
server {
    listen 80;
    server_name foodbot.ru www.foodbot.ru;
    
    root /var/www/foodbot/frontend/dist;
    index index.html;

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Настройка Nginx для Backend API

```bash
# Создать конфиг для Backend
nano /etc/nginx/sites-available/foodbot-backend
```

Вставьте:

```nginx
server {
    listen 80;
    server_name api.foodbot.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Активировать конфигурации

```bash
# Создать символические ссылки
ln -s /etc/nginx/sites-available/foodbot-frontend /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/foodbot-backend /etc/nginx/sites-enabled/

# Удалить дефолтный конфиг
rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
nginx -t

# Перезапустить Nginx
systemctl restart nginx
```

---

## 🔒 Установка SSL (Let's Encrypt)

```bash
# Установить Certbot
apt install -y certbot python3-certbot-nginx

# Получить сертификаты
certbot --nginx -d foodbot.ru -d www.foodbot.ru -d api.foodbot.ru

# Следуйте инструкциям, введите email
# Выберите опцию redirect HTTP → HTTPS

# Автообновление сертификатов
certbot renew --dry-run
```

Теперь у вас:
- `https://foodbot.ru` - Frontend
- `https://api.foodbot.ru` - Backend API

---

## 📱 Настройка Telegram Bot

### 1. Обновить webhook Backend

```bash
# На сервере
cd /var/www/foodbot/backend

# Обновить .env
nano .env
```

Измените:
```bash
TELEGRAM_WEBHOOK_DOMAIN="https://api.foodbot.ru"
FRONTEND_URL="https://foodbot.ru"
```

Перезапустите backend:
```bash
pm2 restart foodbot-backend
```

### 2. Настроить Mini App в BotFather

В Telegram отправьте @BotFather:

```
/mybots
→ Выберите вашего бота
→ Bot Settings
→ Menu Button
→ Configure Menu Button
→ Название: 🍽 Открыть меню
→ URL: https://foodbot.ru
```

### 3. Проверка

Откройте бота в Telegram и нажмите кнопку меню - должен открыться ваш Mini App!

---

## 🔄 Автоматический деплой через Git

### 1. Создать Git репозиторий

**На вашем компьютере:**

```powershell
cd E:\BOT_V2\Lunch_bot

git init
git add .
git commit -m "Initial commit"

# Создайте репозиторий на GitHub/GitLab
# Затем:
git remote add origin https://github.com/yourusername/foodbot.git
git push -u origin main
```

### 2. Настроить deploy скрипт на сервере

```bash
# На сервере
nano /var/www/foodbot/deploy.sh
```

Вставьте:

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

cd /var/www/foodbot

# Pull latest changes
echo "📦 Pulling latest code..."
git pull origin main

# Backend
echo "🔨 Building backend..."
cd backend
npm install --production
npm run build
npx prisma generate
npx prisma migrate deploy

echo "♻️ Restarting backend..."
pm2 restart foodbot-backend

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm install
npm run build

echo "✅ Deployment completed!"
```

Сделайте исполняемым:
```bash
chmod +x /var/www/foodbot/deploy.sh
```

### 3. Деплой новой версии

После изменений в коде:

```powershell
# На компьютере
git add .
git commit -m "Update features"
git push origin main
```

```bash
# На сервере
cd /var/www/foodbot
./deploy.sh
```

---

## 📊 Мониторинг и логи

### PM2 команды

```bash
# Статус всех процессов
pm2 status

# Логи backend
pm2 logs foodbot-backend

# Логи только ошибок
pm2 logs foodbot-backend --err

# Очистить логи
pm2 flush

# Перезапуск
pm2 restart foodbot-backend

# Остановка
pm2 stop foodbot-backend

# Использование ресурсов
pm2 monit
```

### Nginx логи

```bash
# Access логи
tail -f /var/log/nginx/access.log

# Error логи
tail -f /var/log/nginx/error.log
```

### PostgreSQL логи

```bash
tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 🔧 Обновление проекта

### Backend обновление

```bash
cd /var/www/foodbot/backend
git pull origin main
npm install --production
npm run build
npx prisma migrate deploy
pm2 restart foodbot-backend
```

### Frontend обновление

```bash
cd /var/www/foodbot/frontend
git pull origin main
npm install
npm run build
# Nginx автоматически подхватит новые файлы
```

---

## 💰 Стоимость Timeweb

### Минимальная конфигурация

- **VPS SSD-5** (2GB RAM, 1 CPU, 30GB SSD): **190₽/мес**
- **Домен .ru**: **199₽/год** (опционально)
- **SSL сертификат**: **Бесплатно** (Let's Encrypt)

**Итого: ~190₽/месяц**

---

## ✅ Чеклист после деплоя

- [ ] Backend запущен через PM2
- [ ] Frontend раздаётся через Nginx
- [ ] PostgreSQL настроена и работает
- [ ] SSL сертификаты установлены
- [ ] Telegram webhook настроен
- [ ] Mini App открывается из Telegram
- [ ] Все функции работают (меню, голосования, статистика)
- [ ] PM2 автостарт настроен
- [ ] Git deploy скрипт создан

---

## 🎯 Альтернативный вариант: Использование поддомена Timeweb

Если не хотите покупать домен, используйте бесплатный поддомен:

1. После создания VPS вам дадут: `vpsXXXXX.timeweb.cloud`
2. Используйте его вместо `foodbot.ru`:
   - Frontend: `https://vpsXXXXX.timeweb.cloud`
   - Backend: `https://api.vpsXXXXX.timeweb.cloud` (настройте через nginx)

---

## 📞 Поддержка Timeweb

- Техподдержка: https://timeweb.com/ru/help
- Telegram: @timeweb_support
- Email: support@timeweb.ru

---

## 🚀 Готово!

Ваш Telegram Food Bot теперь работает на российском хостинге 24/7!

**Что дальше?**
1. Мониторьте логи первые дни
2. Настройте резервное копирование БД
3. Добавьте тестовые данные
4. Пригласите пользователей

**Удачи с проектом! 🎉**
