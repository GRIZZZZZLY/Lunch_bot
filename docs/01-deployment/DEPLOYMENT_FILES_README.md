# 📦 Файлы для Деплоя - Описание

Все необходимые файлы для деплоя Rocket Lunch Bot на VPS с доменом `rocket-lunch.duckdns.org`.

⚠️ **Важно:** Проект использует ветку `feature/new_version` для деплоя (не `main`)!

---

## 📁 Структура файлов

```
telegram-food-bot/
├── deploy-vps.sh              # Основной скрипт деплоя
├── update-vps.sh              # Скрипт быстрого обновления
├── backup-db.sh               # Скрипт бэкапа БД
├── setup-cron-backup.sh       # Настройка автоматических бэкапов
├── nginx-vps.conf             # Конфигурация Nginx
├── rocket-lunch-bot.service   # Systemd service (опционально)
│
├── backend/
│   ├── .env                   # Dev environment (локальная разработка)
│   └── .env.production        # Production environment (VPS) ✅ ОБНОВЛЁН
│
└── frontend/
    ├── .env                   # Dev environment (локальная разработка)
    └── .env.production        # Production environment (VPS) ✅ ОБНОВЛЁН

Документация:
├── VPS_DEPLOYMENT_GUIDE_NEW.md   # Полное руководство по деплою
├── QUICK_VPS_DEPLOY.md           # Быстрая шпаргалка
├── DEPLOYMENT_CHECKLIST.md       # Чек-лист подготовки
├── DEPLOYMENT_FILES_README.md    # Этот файл
├── DEPLOYMENT_READY_SUMMARY.md   # Итоговый summary
└── GIT_BRANCH_INFO.md            # ⚠️ Инфо о ветке feature/new_version
```

---

## 📄 Описание файлов

### 🚀 Скрипты деплоя

#### `deploy-vps.sh`
**Назначение:** Полный деплой приложения на VPS  
**Использование:** Первый деплой или полная переустановка  
**Что делает:**
- ✅ Автоматически переключается на ветку `feature/new_version`
- Копирует production .env файлы
- Устанавливает зависимости
- Собирает frontend и backend
- Настраивает базу данных
- Запускает через PM2

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

#### `update-vps.sh`
**Назначение:** Быстрое обновление без downtime  
**Использование:** Регулярные обновления кода  
**Что делает:**
- ✅ Автоматически переключается на ветку `feature/new_version`
- Подтягивает изменения из Git (`git pull origin feature/new_version`)
- Обновляет зависимости
- Пересобирает приложение
- Перезапускает через PM2 reload (zero-downtime)

```bash
chmod +x update-vps.sh
./update-vps.sh
```

#### `backup-db.sh`
**Назначение:** Бэкап базы данных SQLite  
**Использование:** Ручной или автоматический бэкап  
**Что делает:**
- Создаёт копию prod.db с timestamp
- Хранит последние 30 бэкапов
- Показывает статистику бэкапов

```bash
chmod +x backup-db.sh
./backup-db.sh
```

#### `setup-cron-backup.sh`
**Назначение:** Настройка автоматических бэкапов  
**Использование:** Один раз после деплоя  
**Что делает:**
- Создаёт cron job для ежедневных бэкапов в 3 AM
- Логирует в `/var/log/rocket-lunch-backup.log`

```bash
chmod +x setup-cron-backup.sh
./setup-cron-backup.sh
```

---

### ⚙️ Конфигурационные файлы

#### `nginx-vps.conf`
**Назначение:** Конфигурация Nginx для reverse proxy  
**Содержит:**
- HTTP → HTTPS редирект
- SSL настройки
- Proxy для API (/api)
- Proxy для Telegram webhook (/webhook)
- Раздача статических файлов frontend
- Security headers
- Gzip compression

**Установка:**
```bash
cp nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot
ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

#### `rocket-lunch-bot.service`
**Назначение:** Systemd service (альтернатива PM2)  
**Использование:** Опционально, если хотите использовать systemd вместо PM2  
**Не рекомендуется:** PM2 проще в использовании и имеет больше функций

**Установка (если нужно):**
```bash
cp rocket-lunch-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable rocket-lunch-bot
systemctl start rocket-lunch-bot
```

---

### 🔐 Environment файлы

#### `backend/.env.production`
**Обновлено для домена:** `rocket-lunch.duckdns.org`

**Ключевые настройки:**
```bash
WEBAPP_URL=https://rocket-lunch.duckdns.org
BOT_WEBHOOK_URL=https://rocket-lunch.duckdns.org/webhook
CORS_ORIGIN=https://rocket-lunch.duckdns.org
NODE_ENV=production
SKIP_TELEGRAM_VALIDATION=false  # ⚠️ Важно!
```

#### `frontend/.env.production`
**Обновлено для домена:** `rocket-lunch.duckdns.org`

**Ключевые настройки:**
```bash
VITE_API_URL=https://rocket-lunch.duckdns.org/api
VITE_BOT_USERNAME=rocket_lunch_bot
VITE_NODE_ENV=production
```

---

## 📚 Документация

### `VPS_DEPLOYMENT_GUIDE_NEW.md`
**Полное руководство** (35 KB) с пошаговыми инструкциями:
- Настройка VPS с нуля
- Установка всех зависимостей
- Настройка SSL через Certbot
- Деплой приложения
- Настройка Telegram webhook
- Мониторинг и логи
- Траблшутинг

### `QUICK_VPS_DEPLOY.md`
**Быстрая шпаргалка** для опытных пользователей:
- Экспресс-деплой за 5 минут
- Команды для обновления
- Основные команды PM2
- Проверка работы
- Quick fixes

### `DEPLOYMENT_CHECKLIST.md`
**Чек-лист** для проверки готовности:
- Предварительная подготовка
- Системные требования
- Процесс деплоя
- Telegram конфигурация
- Тестирование
- Безопасность

---

## 🎯 Быстрый старт

### Вариант 1: Первый деплой

```bash
# 1. На локальной машине - закоммитьте изменения
cd E:\Lunch_bot\telegram-food-bot
git add .
git commit -m "Готов к деплою"
git push

# 2. На VPS - установите зависимости
ssh root@YOUR_VPS_IP
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2

# 3. Клонируйте и деплой
cd /root
git clone YOUR_REPO_URL telegram-food-bot
cd telegram-food-bot
chmod +x deploy-vps.sh
./deploy-vps.sh

# 4. Настройте Nginx
cp nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot
ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 5. Получите SSL
systemctl stop nginx
certbot certonly --standalone -d rocket-lunch.duckdns.org
systemctl start nginx

# 6. Настройте Telegram
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"
```

### Вариант 2: Обновление

```bash
# На VPS
ssh root@YOUR_VPS_IP
cd /root/telegram-food-bot
git pull
./update-vps.sh
```

---

## ⚡ Основные команды

```bash
# PM2 управление
pm2 status                    # Статус
pm2 logs rocket-lunch-bot     # Логи
pm2 restart rocket-lunch-bot  # Перезапуск
pm2 monit                     # Мониторинг

# Nginx
nginx -t                      # Проверка конфига
systemctl reload nginx        # Перезагрузка

# Логи
tail -f /var/log/nginx/rocket-lunch-bot.access.log
tail -f /var/log/nginx/rocket-lunch-bot.error.log

# Бэкап
./backup-db.sh               # Ручной бэкап
./setup-cron-backup.sh       # Автоматические бэкапы

# Проверка
curl -I https://rocket-lunch.duckdns.org
curl https://rocket-lunch.duckdns.org/api/health
```

---

## 🔧 Траблшутинг

### Бот не отвечает
```bash
pm2 logs rocket-lunch-bot --err
pm2 restart rocket-lunch-bot
```

### 502 Bad Gateway
```bash
pm2 status
netstat -tuln | grep 3001
pm2 restart rocket-lunch-bot
```

### SSL не работает
```bash
certbot certificates
certbot renew
systemctl reload nginx
```

---

## ✅ Что было обновлено для домена

### Backend `.env.production`:
- ✅ `WEBAPP_URL` → `https://rocket-lunch.duckdns.org`
- ✅ `BOT_WEBHOOK_URL` → `https://rocket-lunch.duckdns.org/webhook`
- ✅ `CORS_ORIGIN` → `https://rocket-lunch.duckdns.org`

### Frontend `.env.production`:
- ✅ `VITE_API_URL` → `https://rocket-lunch.duckdns.org/api`

### Все скрипты и конфиги используют новый домен

---

## 📞 Telegram API Setup

После деплоя обязательно выполните:

```bash
# Установить webhook
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

# Проверить webhook
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"

# Установить Menu Button
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🍴 Открыть меню","web_app":{"url":"https://rocket-lunch.duckdns.org"}}}'
```

---

## 🎉 Готово!

Все файлы обновлены и готовы к деплою на домен **rocket-lunch.duckdns.org**.

Следуйте инструкциям в `QUICK_VPS_DEPLOY.md` для быстрого деплоя или `VPS_DEPLOYMENT_GUIDE_NEW.md` для подробного руководства.

**Удачного деплоя! 🚀**
