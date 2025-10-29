# 🚀 Полное Руководство по Деплою на VPS

**Домен:** `rocket-lunch.duckdns.org`  
**IP VPS:** Ваш IP адрес  
**OS:** Ubuntu 20.04+ / Debian 11+  
**Метод:** Загрузка через Git  
**Время:** ~35-40 минут

---

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [ШАГ 1: Подготовка VPS](#шаг-1-подготовка-vps)
3. [ШАГ 2: Установка зависимостей](#шаг-2-установка-зависимостей)
4. [ШАГ 3: Клонирование проекта через Git](#шаг-3-клонирование-проекта-через-git)
5. [ШАГ 4: Настройка SSL сертификата](#шаг-4-настройка-ssl-сертификата)
6. [ШАГ 5: Деплой приложения](#шаг-5-деплой-приложения)
7. [ШАГ 6: Настройка Nginx](#шаг-6-настройка-nginx)
8. [ШАГ 7: Настройка Telegram Webhook](#шаг-7-настройка-telegram-webhook)
9. [Мониторинг и логи](#мониторинг-и-логи)
10. [Обновление приложения](#обновление-приложения)
11. [Траблшутинг](#траблшутинг)

---

## 📌 Предварительные требования

### Что нужно подготовить:

**1. GitHub репозиторий:**
- ✅ Репозиторий с проектом создан на GitHub
- ✅ Ветка `feature/new_version` запушена в репозиторий
- ✅ Файлы `.env.production` настроены (но НЕ закоммичены!)

**2. DuckDNS домен:**
- ✅ Зарегистрирован на https://www.duckdns.org
- ✅ Привязан к IP вашего VPS
- ✅ Домен: `rocket-lunch.duckdns.org`

**3. Telegram бот:**
- ✅ Бот создан через @BotFather
- ✅ Токен бота сохранен
- ✅ Бот добавлен в тестовую группу

**4. VPS сервер:**
- ✅ Ubuntu 20.04+ или Debian 11+
- ✅ Доступ по SSH
- ✅ Пользователь с sudo правами (НЕ обязательно root)
- ✅ Минимум 1GB RAM
- ✅ 10GB+ свободного места

**5. SSH доступ:**
```bash
# Проверьте доступ (замените на ваши данные)
ssh igor@YOUR_VPS_IP

# Если работает - можно начинать!
```

---

## ШАГ 1: Подготовка VPS

**⏱️ Время: ~5 минут**

### 1.1. Подключитесь к VPS

```bash
# Замените YOUR_VPS_IP на ваш IP
ssh igor@YOUR_VPS_IP
```

### 1.2. Обновите систему

```bash
# Обновите список пакетов
sudo apt update

# Обновите установленные пакеты
sudo apt upgrade -y

# Установите необходимые утилиты
sudo apt install -y curl wget git build-essential
```

**⚠️ ВАЖНО:** Все команды `apt`, `systemctl`, `nginx`, `certbot` требуют `sudo`!

### 1.3. Настройте firewall (UFW)

```bash
# Установите UFW если не установлен
sudo apt install -y ufw

# Разрешите SSH (ВАЖНО! Иначе потеряете доступ!)
sudo ufw allow OpenSSH

# Разрешите HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включите firewall (подтвердите 'y')
sudo ufw enable

# Проверьте статус
sudo ufw status
```

**Ожидаемый результат:**
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

---

## ШАГ 2: Установка зависимостей

**⏱️ Время: ~10 минут**

### 2.1. Установите Node.js 22.x (LTS)

```bash
# Добавьте NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -

# Установите Node.js
sudo apt install -y nodejs

# Проверьте версии
node --version  # должно быть v22.x.x
npm --version   # должно быть 10.x.x
```

**Ожидаемый результат:**
```
v22.11.0  (или выше)
10.9.0    (или выше)
```

### 2.2. Установите PM2

```bash
# Установите PM2 глобально
sudo npm install -g pm2

# Проверьте установку
pm2 --version

# Настройте PM2 для автозапуска при перезагрузке
pm2 startup
# Выполните команду, которую выведет PM2
```

**Ожидаемый результат:**
```
[PM2] Spawning PM2 daemon with pm2_home=...
5.4.2  (или выше)
```

### 2.3. Установите Nginx

```bash
# Установите Nginx
sudo apt install -y nginx

# Проверьте статус
sudo systemctl status nginx

# Запустите Nginx если не запущен
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Проверка:** Откройте в браузере `http://YOUR_VPS_IP` - должна открыться страница "Welcome to nginx!"

---

## ШАГ 3: Клонирование проекта через Git

**⏱️ Время: ~3 минуты**

### 3.1. Настройте Git (если требуется аутентификация)

```bash
# Если репозиторий приватный, настройте Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Для приватных репозиториев используйте Personal Access Token
# Создайте токен: GitHub → Settings → Developer settings → Personal access tokens
```

### 3.2. Клонируйте репозиторий

```bash
# Перейдите в домашнюю директорию
cd ~

# Клонируйте репозиторий (замените на ваш URL)
git clone https://github.com/YOUR_USERNAME/telegram-food-bot.git

# Если приватный репозиторий:
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/telegram-food-bot.git

# Перейдите в директорию проекта
cd telegram-food-bot
```

### 3.3. Переключитесь на ветку feature/new_version

```bash
# ⚠️ ВАЖНО: Проект на ветке feature/new_version, НЕ на main!
git checkout feature/new_version

# Проверьте текущую ветку
git branch

# Должно показать:
# * feature/new_version
```

### 3.4. Настройте .env файлы

```bash
# Backend .env
cd ~/telegram-food-bot/backend

# Создайте .env файл
nano .env
```

**Вставьте следующее содержимое (замените значения на свои):**
```env
# === PRODUCTION CONFIGURATION ===
NODE_ENV=production
API_PORT=3001

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
WEBAPP_URL=https://rocket-lunch.duckdns.org

# Security
JWT_SECRET=your_random_jwt_secret_min_32_chars

# Database
DATABASE_URL="file:./prisma/prod.db"

# Optional: Sentry for error tracking
# SENTRY_DSN=your_sentry_dsn
```

**Сохраните:** `Ctrl+O`, `Enter`, `Ctrl+X`

```bash
# Frontend .env
cd ~/telegram-food-bot/frontend

# Создайте .env файл
nano .env
```

**Вставьте:**
```env
VITE_API_URL=https://rocket-lunch.duckdns.org/api
VITE_BOT_USERNAME=rocket_lunch_bot
```

**Сохраните:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

## ШАГ 4: Настройка SSL сертификата

**⏱️ Время: ~5 минут**

### 4.1. Установите Certbot

```bash
# Установите Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 4.2. Получите SSL сертификат

```bash
# Остановите Nginx временно
sudo systemctl stop nginx

# Получите сертификат (standalone mode)
sudo certbot certonly --standalone -d rocket-lunch.duckdns.org

# Следуйте инструкциям:
# 1. Введите email для уведомлений
# 2. Согласитесь с Terms of Service (y)
# 3. Выберите опции по желанию

# Запустите Nginx обратно
sudo systemctl start nginx
```

**Ожидаемый результат:**
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/rocket-lunch.duckdns.org/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/rocket-lunch.duckdns.org/privkey.pem
```

### 4.3. Проверьте сертификат

```bash
# Проверьте файлы сертификата
sudo ls -la /etc/letsencrypt/live/rocket-lunch.duckdns.org/

# Должны быть файлы:
# - fullchain.pem
# - privkey.pem
# - cert.pem
# - chain.pem
```

### 4.4. Настройте автообновление

```bash
# Проверьте, что автообновление работает
sudo certbot renew --dry-run

# Должно вывести: "Cert not yet due for renewal"
# Certbot автоматически обновляет сертификаты через cron
```

---

## 🚀 Деплой приложения

### 1. Клонирование репозитория

```bash
# Перейдите в домашнюю директорию
cd /root

# Клонируйте репозиторий (или загрузите через Git)
git clone https://github.com/YOUR_USERNAME/telegram-food-bot.git

# ⚠️ ВАЖНО: Переключитесь на ветку feature/new_version
cd telegram-food-bot
git checkout feature/new_version

# Или загрузите через SCP с локальной машины:
# scp -r E:\Lunch_bot\telegram-food-bot root@YOUR_VPS_IP:/root/
```

### 2. Запуск deployment скрипта

```bash
# Перейдите в директорию проекта
cd /root/telegram-food-bot

# Сделайте скрипт исполняемым
chmod +x deploy-vps.sh

# Запустите деплой
./deploy-vps.sh
```

### 3. Что делает скрипт:
- ✅ Копирует production .env файлы
- ✅ Устанавливает зависимости
- ✅ Собирает frontend и backend
- ✅ Настраивает базу данных
- ✅ Запускает приложение через PM2

### 4. Настройка Nginx

```bash
# Скопируйте конфигурацию Nginx
cp /root/telegram-food-bot/nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot

# Создайте символическую ссылку
ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию
rm /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
nginx -t

# Если всё OK, перезагрузите Nginx
systemctl reload nginx
```

---

## 📡 Настройка Telegram Webhook

### 1. Установка webhook

```bash
# Замените <YOUR_BOT_TOKEN> на токен вашего бота
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://rocket-lunch.duckdns.org/webhook"}'

# Должен вернуться ответ:
# {"ok":true,"result":true,"description":"Webhook was set"}
```

### 2. Проверка webhook

```bash
# Проверьте статус webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Должно быть:
# "url": "https://rocket-lunch.duckdns.org/webhook"
# "has_custom_certificate": false
# "pending_update_count": 0
```

### 3. Настройка Menu Button (Mini App)

```bash
# Установите menu button для Mini App
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🍴 Открыть меню",
      "web_app": {
        "url": "https://rocket-lunch.duckdns.org"
      }
    }
  }'
```

---

## 📊 Мониторинг и логи

### 1. PM2 команды

```bash
# Статус приложения
pm2 status

# Логи в реальном времени
pm2 logs rocket-lunch-bot

# Логи с фильтром по ошибкам
pm2 logs rocket-lunch-bot --err

# Последние 100 строк логов
pm2 logs rocket-lunch-bot --lines 100

# Мониторинг (CPU, RAM)
pm2 monit

# Информация о процессе
pm2 info rocket-lunch-bot

# Перезапуск приложения
pm2 restart rocket-lunch-bot

# Остановка приложения
pm2 stop rocket-lunch-bot

# Запуск приложения
pm2 start rocket-lunch-bot
```

### 2. Nginx логи

```bash
# Access log (входящие запросы)
tail -f /var/log/nginx/rocket-lunch-bot.access.log

# Error log (ошибки)
tail -f /var/log/nginx/rocket-lunch-bot.error.log

# Последние 50 строк ошибок
tail -n 50 /var/log/nginx/rocket-lunch-bot.error.log
```

### 3. Системные логи

```bash
# Логи systemd (если используете systemd service)
journalctl -u rocket-lunch-bot -f

# Логи за последний час
journalctl -u rocket-lunch-bot --since "1 hour ago"
```

### 4. Мониторинг ресурсов

```bash
# CPU и RAM в реальном времени
htop

# Использование диска
df -h

# Использование памяти
free -h

# Сетевые соединения
netstat -tuln | grep -E ':(80|443|3001)'
```

---

## 🔄 Обновление приложения

### Метод 1: Через Git (рекомендуется)

```bash
# Перейдите в директорию проекта
cd /root/telegram-food-bot

# Убедитесь, что вы на правильной ветке
git checkout feature/new_version

# Сохраните изменения (если есть)
git stash

# Получите последние изменения
git pull origin feature/new_version

# Запустите deployment скрипт
./deploy-vps.sh

# PM2 автоматически перезапустит приложение
```

### Метод 2: Ручное обновление

```bash
cd /root/telegram-food-bot

# Frontend
cd frontend
npm install
npm run build
cd ..

# Backend
cd backend
npm install
npm run build
npm run db:push
cd ..

# Перезапуск
pm2 restart rocket-lunch-bot
```

### Метод 3: Zero-downtime deployment

```bash
# Используйте PM2 reload вместо restart
pm2 reload rocket-lunch-bot

# PM2 перезапустит процесс без потери запросов
```

---

## 🛠️ Траблшутинг

### ❌ Проблема: Бот не отвечает

```bash
# 1. Проверьте статус PM2
pm2 status

# 2. Проверьте логи
pm2 logs rocket-lunch-bot --err

# 3. Проверьте webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# 4. Проверьте Nginx
nginx -t
systemctl status nginx

# 5. Перезапустите всё
pm2 restart rocket-lunch-bot
systemctl restart nginx
```

### ❌ Проблема: 502 Bad Gateway

```bash
# 1. Проверьте, запущен ли backend
pm2 status

# 2. Проверьте порт 3001
netstat -tuln | grep 3001

# 3. Проверьте логи backend
pm2 logs rocket-lunch-bot

# 4. Перезапустите backend
pm2 restart rocket-lunch-bot
```

### ❌ Проблема: SSL сертификат не работает

```bash
# 1. Проверьте сертификат
certbot certificates

# 2. Обновите сертификат
certbot renew

# 3. Проверьте конфигурацию Nginx
nginx -t

# 4. Перезагрузите Nginx
systemctl reload nginx
```

### ❌ Проблема: База данных не работает

```bash
cd /root/telegram-food-bot/backend

# 1. Проверьте файл базы данных
ls -la prisma/prod.db

# 2. Пересоздайте базу
npm run db:push

# 3. Сгенерируйте Prisma Client
npm run db:generate

# 4. Перезапустите приложение
pm2 restart rocket-lunch-bot
```

### ❌ Проблема: Mini App не открывается

```bash
# 1. Проверьте WEBAPP_URL в .env
cat backend/.env | grep WEBAPP_URL

# Должно быть: WEBAPP_URL=https://rocket-lunch.duckdns.org

# 2. Проверьте Menu Button
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getChatMenuButton"

# 3. Переустановите Menu Button
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🍴 Открыть меню",
      "web_app": {
        "url": "https://rocket-lunch.duckdns.org"
      }
    }
  }'
```

### ❌ Проблема: Высокое использование памяти

```bash
# 1. Проверьте использование памяти
pm2 monit

# 2. Установите лимит памяти
pm2 delete rocket-lunch-bot
cd /root/telegram-food-bot/backend
pm2 start dist/index.js --name rocket-lunch-bot \
  --max-memory-restart 500M

# 3. Сохраните конфигурацию
pm2 save
```

---

## 🔍 Полезные команды

### Проверка доступности

```bash
# Проверьте доступность домена
curl -I https://rocket-lunch.duckdns.org

# Проверьте API
curl https://rocket-lunch.duckdns.org/api/health

# Проверьте webhook
curl https://rocket-lunch.duckdns.org/webhook
```

### Backup базы данных

```bash
# Создайте backup
cd /root/telegram-food-bot/backend/prisma
cp prod.db prod.db.backup.$(date +%Y%m%d_%H%M%S)

# Список backups
ls -lh prod.db.backup.*

# Восстановление из backup
cp prod.db.backup.20251028_120000 prod.db
```

### Очистка логов

```bash
# Очистка PM2 логов
pm2 flush

# Очистка старых логов Nginx
find /var/log/nginx -name "*.log" -type f -mtime +30 -delete

# Ротация логов (автоматически)
# Уже настроена через logrotate
```

---

## ✅ Чек-лист после деплоя

- [ ] Приложение запущено через PM2
- [ ] Nginx настроен и работает
- [ ] SSL сертификат установлен и валиден
- [ ] Webhook установлен и работает
- [ ] Menu Button настроена
- [ ] База данных создана и мигрирована
- [ ] Логи пишутся корректно
- [ ] Firewall настроен (порты 80, 443 открыты)
- [ ] Домен resolves на IP VPS
- [ ] Бот отвечает на команды в Telegram
- [ ] Mini App открывается корректно
- [ ] Voting flow работает end-to-end

---

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте логи: `pm2 logs rocket-lunch-bot`
2. Проверьте webhook: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
3. Проверьте Nginx: `nginx -t && systemctl status nginx`
4. Перезапустите всё: `pm2 restart rocket-lunch-bot && systemctl restart nginx`

---

## 🎉 Готово!

Ваш бот теперь работает на домене **rocket-lunch.duckdns.org** и готов к использованию!

**Полезные ссылки:**
- Telegram бот: `https://t.me/rocket_lunch_bot`
- Mini App: `https://rocket-lunch.duckdns.org`
- Admin panel: `https://rocket-lunch.duckdns.org/admin` (если настроена)

**Следующие шаги:**
1. Протестируйте бота в группе
2. Настройте мониторинг (опционально: Sentry, Grafana)
3. Настройте автоматические backups базы данных
4. Документируйте любые изменения в конфигурации
