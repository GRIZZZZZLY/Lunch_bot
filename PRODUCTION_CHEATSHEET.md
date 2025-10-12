# 📝 Production Deployment Cheatsheet

Быстрая шпаргалка для production деплоя.

---

## 🚀 Методы деплоя

### Метод 1: Классический (PM2)
- ✅ Простой и надежный
- ✅ Хорошо для небольших проектов
- 📄 Документация: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- 🎯 Для: VPS с прямым доступом

### Метод 2: Docker Compose
- ✅ Изолированная среда
- ✅ Легкое обновление
- 📄 Документация: `DOCKER_DEPLOYMENT.md`
- 🎯 Для: Продвинутых пользователей

### Метод 3: Автоматический скрипт
- ✅ Один клик деплой
- ✅ Настройка всего за 5 минут
- 📄 Скрипт: `QUICK_DEPLOY.sh`
- 🎯 Для: Быстрого старта

---

## ⚙️ Критичные настройки .env

```bash
# ⚠️ ОБЯЗАТЕЛЬНО в production:
NODE_ENV=production
SKIP_TELEGRAM_VALIDATION=false
BOT_MODE=webhook
BOT_WEBHOOK_URL=https://your-domain.com/api/webhook

# 🔐 Безопасность:
JWT_SECRET=$(openssl rand -hex 64)  # Сгенерировать!
CORS_ORIGIN=https://your-domain.com

# 📡 Telegram:
BOT_TOKEN=your_bot_token
WEBAPP_URL=https://your-domain.com

# 🗄️ База данных:
DATABASE_URL=postgresql://user:pass@localhost:5432/db
# Или SQLite: file:./prisma/production.db
```

---

## 🛠️ Быстрые команды

### PM2 метод:

```bash
# Запуск
pm2 start ecosystem.config.js --env production
pm2 save

# Мониторинг
pm2 status
pm2 logs rocket-lunch-bot
pm2 monit

# Перезапуск
pm2 restart rocket-lunch-bot

# Остановка
pm2 stop rocket-lunch-bot
```

### Docker метод:

```bash
# Запуск
docker compose -f docker-compose.production.yml up -d

# Мониторинг
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f

# Перезапуск
docker compose -f docker-compose.production.yml restart

# Остановка
docker compose -f docker-compose.production.yml down
```

---

## 📡 Telegram Webhook

### Установка:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/webhook",
    "allowed_updates": ["message", "callback_query", "my_chat_member"],
    "drop_pending_updates": true
  }'
```

### Проверка:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Удаление (для локальной разработки):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

---

## 🌐 Nginx конфигурация

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Команды Nginx:
sudo nginx -t                 # Проверка конфигурации
sudo systemctl restart nginx  # Перезапуск
sudo tail -f /var/log/nginx/error.log  # Логи
```

---

## 🔐 SSL сертификат

```bash
# Получение Let's Encrypt сертификата:
sudo certbot --nginx -d your-domain.com

# Проверка автообновления:
sudo certbot renew --dry-run

# Ручное обновление:
sudo certbot renew
```

---

## 💾 Бэкапы

### SQLite:

```bash
# Бэкап
cp backend/prisma/production.db backups/db_$(date +%Y%m%d).db

# Восстановление
cp backups/db_20250110.db backend/prisma/production.db
```

### PostgreSQL:

```bash
# Бэкап
pg_dump -U user dbname > backup_$(date +%Y%m%d).sql

# Восстановление
psql -U user dbname < backup_20250110.sql
```

### Автоматизация (crontab):

```bash
crontab -e
# Добавить: 0 3 * * * /home/user/backup-db.sh
```

---

## 🔄 Обновление приложения

### PM2 метод:

```bash
cd ~/telegram-food-bot
git pull origin main
cd backend && npm ci --production && npm run build
cd ../frontend && npm ci && npm run build
pm2 restart rocket-lunch-bot
```

### Docker метод:

```bash
cd ~/telegram-food-bot
git pull origin main
cd frontend && npm ci && npm run build && cd ..
docker compose -f docker-compose.production.yml up -d --build
```

### Скрипт деплоя:

```bash
#!/bin/bash
cd ~/telegram-food-bot
git pull origin main
cd backend && npm ci --production && npm run build
cd ../frontend && npm ci && npm run build
pm2 restart rocket-lunch-bot
sudo systemctl reload nginx
echo "✅ Deployed!"
```

---

## 🐛 Решение проблем

### Бот не отвечает:

```bash
# 1. Проверить логи
pm2 logs rocket-lunch-bot
# или
docker compose -f docker-compose.production.yml logs backend

# 2. Проверить webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# 3. Перезапустить
pm2 restart rocket-lunch-bot
# или
docker compose -f docker-compose.production.yml restart
```

### 502 Bad Gateway:

```bash
# Backend не запущен
pm2 status
pm2 restart rocket-lunch-bot

# Проверить порт
netstat -tulpn | grep 3001

# Nginx ошибки
sudo tail -f /var/log/nginx/error.log
```

### База данных:

```bash
# Проверить подключение
cd backend
npx prisma db pull

# Применить миграции
npx prisma migrate deploy

# Prisma Studio (веб-интерфейс)
npx prisma studio
```

### SSL проблемы:

```bash
# Проверить сертификат
sudo certbot certificates

# Обновить
sudo certbot renew

# Тест конфигурации
sudo nginx -t
```

---

## 📊 Мониторинг

### Ресурсы сервера:

```bash
# CPU и память
htop

# Диск
df -h

# Сеть
netstat -tulpn

# Все процессы
ps aux | grep node
```

### PM2:

```bash
pm2 monit              # Интерактивный мониторинг
pm2 status             # Статус всех процессов
pm2 logs --lines 100   # Последние 100 строк
```

### Docker:

```bash
docker stats           # Ресурсы контейнеров
docker ps              # Запущенные контейнеры
docker logs <container> # Логи контейнера
```

---

## 🧪 Тестирование

```bash
# API Health Check
curl https://your-domain.com/api/health

# Проверка SSL
curl -I https://your-domain.com

# Webhook endpoint
curl https://your-domain.com/api/webhook
# Должен вернуть 405 или 401

# Проверка webhook info
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# DNS проверка
nslookup your-domain.com

# Порты
netstat -tulpn | grep -E '80|443|3001'
```

---

## 📋 Чек-лист перед запуском

```bash
□ Домен куплен и настроен DNS (A-запись)
□ VPS сервер арендован
□ Node.js 20+ установлен
□ База данных настроена
□ .env файлы созданы и заполнены
□ JWT_SECRET сгенерирован (128 символов)
□ Frontend собран (npm run build)
□ Backend собран (npm run build)
□ Nginx настроен
□ SSL сертификат получен
□ Firewall настроен (порты 22, 80, 443)
□ PM2 или Docker запущены
□ Webhook установлен
□ Бот отвечает на /start
□ Mini App открывается
□ Авторизация работает
□ Голосование создается
□ Уведомления приходят
□ Бэкапы настроены
□ Мониторинг работает
```

---

## 🔗 Полезные ссылки

- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Telegram Mini Apps:** https://core.telegram.org/bots/webapps
- **PM2 Documentation:** https://pm2.keymetrics.io/
- **Docker Documentation:** https://docs.docker.com/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **Prisma Documentation:** https://www.prisma.io/docs/

---

## 💡 Лучшие практики

### Безопасность:

```bash
✅ NODE_ENV=production
✅ SKIP_TELEGRAM_VALIDATION=false
✅ JWT_SECRET минимум 128 символов
✅ Файлы .env с правами 600
✅ SSH только по ключу
✅ Firewall активен
✅ Регулярные обновления системы
```

### Мониторинг:

```bash
✅ Логи ротируются (logrotate)
✅ PM2 или Docker автостарт
✅ Бэкапы раз в день
✅ Мониторинг ресурсов
✅ Алерты на критичные ошибки
```

### Производительность:

```bash
✅ Gzip в Nginx включен
✅ Кеширование статики
✅ Connection pooling для БД
✅ PM2 cluster mode (для нагрузки)
✅ CDN для статики (опционально)
```

---

## 🆘 Экстренные команды

```bash
# Немедленная остановка
pm2 stop all
docker compose down

# Откат к предыдущей версии
git reset --hard HEAD^
./deploy.sh

# Очистка логов
pm2 flush
> backend/logs/combined.log

# Перезагрузка всего сервера
sudo reboot
```

---

## 🎉 Готово!

Сохраните этот файл - он пригодится для быстрого решения проблем!

**Документация:**
- 📖 Полное руководство: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- ✅ Чек-лист: `PRODUCTION_CHECKLIST.md`
- 🐳 Docker деплой: `DOCKER_DEPLOYMENT.md`
- 🚀 Автоскрипт: `QUICK_DEPLOY.sh`
