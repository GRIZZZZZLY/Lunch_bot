# 🚀 Полное Руководство по Деплою на VPS

**Домен:** `rocket-lunch.duckdns.org`  
**IP VPS:** Ваш IP адрес  
**OS:** Ubuntu 20.04+ / Debian 11+

---

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Настройка VPS](#настройка-vps)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка SSL сертификата](#настройка-ssl-сертификата)
5. [Деплой приложения](#деплой-приложения)
6. [Настройка Telegram Webhook](#настройка-telegram-webhook)
7. [Мониторинг и логи](#мониторинг-и-логи)
8. [Обновление приложения](#обновление-приложения)
9. [Траблшутинг](#траблшутинг)

---

## 📌 Предварительные требования

### На локальной машине:
- ✅ Git установлен
- ✅ Node.js 18+ установлен
- ✅ Доступ к VPS по SSH
- ✅ DuckDNS домен настроен и привязан к IP VPS

### На VPS:
- ✅ Ubuntu 20.04+ или Debian 11+
- ✅ Root или sudo доступ
- ✅ Открытые порты: 80 (HTTP), 443 (HTTPS)
- ✅ Минимум 1GB RAM
- ✅ 10GB+ свободного места на диске

---

## 🔧 Настройка VPS

### 1. Подключение к VPS

```bash
# Подключитесь к серверу по SSH
ssh root@YOUR_VPS_IP

# Или если у вас другой пользователь
ssh your-user@YOUR_VPS_IP
```

### 2. Обновление системы

```bash
# Обновите список пакетов
apt update

# Обновите установленные пакеты
apt upgrade -y

# Установите необходимые утилиты
apt install -y curl wget git build-essential
```

### 3. Настройка firewall (UFW)

```bash
# Установите UFW если не установлен
apt install -y ufw

# Разрешите SSH (важно, чтобы не потерять доступ!)
ufw allow OpenSSH

# Разрешите HTTP и HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Включите firewall
ufw enable

# Проверьте статус
ufw status
```

---

## 📦 Установка зависимостей

### 1. Установка Node.js 22.x (LTS)

```bash
# Добавьте NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# Установите Node.js
apt install -y nodejs

# Проверьте версии
node --version  # должно быть v22.x.x
npm --version   # должно быть 10.x.x
```

### 2. Установка PM2

```bash
# Установите PM2 глобально
npm install -g pm2

# Проверьте установку
pm2 --version
```

### 3. Установка Nginx

```bash
# Установите Nginx
apt install -y nginx

# Проверьте статус
systemctl status nginx

# Запустите Nginx если не запущен
systemctl start nginx
systemctl enable nginx
```

---

## 🔐 Настройка SSL сертификата

### 1. Установка Certbot

```bash
# Установите Certbot и плагин для Nginx
apt install -y certbot python3-certbot-nginx
```

### 2. Получение SSL сертификата

```bash
# Остановите Nginx временно
systemctl stop nginx

# Получите сертификат (standalone mode)
certbot certonly --standalone -d rocket-lunch.duckdns.org

# Следуйте инструкциям:
# - Введите email для уведомлений
# - Согласитесь с Terms of Service
# - Выберите использование сертификата для указанного домена

# Запустите Nginx обратно
systemctl start nginx
```

### 3. Проверка сертификата

```bash
# Сертификаты должны быть в:
ls -la /etc/letsencrypt/live/rocket-lunch.duckdns.org/

# Должны быть файлы:
# - fullchain.pem
# - privkey.pem
# - cert.pem
# - chain.pem
```

### 4. Автоматическое обновление сертификата

```bash
# Certbot автоматически создаст cron job для обновления
# Проверьте его работу:
certbot renew --dry-run

# Если всё OK, сертификаты будут обновляться автоматически
```

---

## 🚀 Деплой приложения

### 1. Клонирование репозитория

```bash
# Перейдите в домашнюю директорию
cd /root

# Клонируйте репозиторий (или загрузите через Git)
git clone https://github.com/YOUR_USERNAME/telegram-food-bot.git

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

# Сохраните изменения (если есть)
git stash

# Получите последние изменения
git pull origin main

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
