# 🚀 Quick Start: Мониторинг за 5 минут

**Быстрое руководство по настройке мониторинга для Telegram Food Bot**

---

## 1. Получите Sentry DSN ключи (3 минуты)

### Шаг 1: Регистрация
```
https://sentry.io → Sign Up (через GitHub)
```

### Шаг 2: Создайте организацию
```
Organization name: telegram-food-bot
```

### Шаг 3: Создайте 2 проекта

**Backend проект:**
- Project name: `telegram-food-bot-backend`
- Platform: `Node.js`
- Copy DSN: `https://xxx@o123.ingest.sentry.io/456`

**Frontend проект:**
- Project name: `telegram-food-bot-frontend`
- Platform: `React`
- Copy DSN: `https://yyy@o123.ingest.sentry.io/789`

---

## 2. Обновите .env файлы (1 минута)

### Backend (.env.production)
```bash
cd E:\Lunch_bot\telegram-food-bot\backend

# Добавьте в .env.production:
ENABLE_SENTRY=true
SENTRY_DSN=https://YOUR_BACKEND_DSN@o123.ingest.sentry.io/456
```

### Frontend (.env.production)
```bash
cd E:\Lunch_bot\telegram-food-bot\frontend

# Добавьте в .env.production:
VITE_SENTRY_DSN=https://YOUR_FRONTEND_DSN@o123.ingest.sentry.io/789
VITE_APP_VERSION=2.0.0
```

---

## 3. Задеплойте на VPS (автоматически)

```bash
# На локальной машине
git add .
git commit -m "Add monitoring setup"
git push origin feature/new_version

# На VPS
cd /root/telegram-food-bot
./update-vps.sh
```

**Скрипт автоматически:**
- ✅ Pull изменения
- ✅ Установит зависимости
- ✅ Соберёт backend и frontend
- ✅ Перезапустит PM2 без даунтайма

---

## 4. Проверьте работу (1 минута)

### 4.1 Проверьте health
```bash
curl https://rocket-lunch.duckdns.org/health
```

**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "uptime": "1h 23m",
  "database": "connected"
}
```

### 4.2 Проверьте metrics
```bash
curl https://rocket-lunch.duckdns.org/api/metrics
```

### 4.3 Откройте Dashboard
```
https://rocket-lunch.duckdns.org/dashboard.html
```

### 4.4 Протестируйте Sentry
```bash
# Отправить тестовую ошибку
curl https://rocket-lunch.duckdns.org/api/test/sentry-error

# Отправить тестовое сообщение
curl https://rocket-lunch.duckdns.org/api/test/sentry-message
```

**Проверьте Sentry:**
```
https://sentry.io → Projects → telegram-food-bot-backend → Issues
```

---

## 5. Настройте Alerts (опционально, 2 минуты)

### В Sentry проекте:

**Settings → Alerts → New Alert Rule**

**Правило 1: Critical Errors**
- Name: `Backend Critical Errors`
- When: `An issue is first seen`
- Conditions: `Level equals error OR fatal`
- Actions: `Send notification via Email`

**Правило 2: High Error Rate**
- Name: `Too Many Errors`
- When: `An issue's events exceed 10 in 1 hour`
- Actions: `Send notification via Email`

---

## 🎉 Готово!

### Теперь у вас работает:

- ✅ **Sentry** - отслеживание ошибок backend + frontend
- ✅ **Health Check** - `/health` endpoint
- ✅ **Metrics API** - `/api/metrics` endpoint
- ✅ **Dashboard** - визуализация метрик
- ✅ **PM2 Monitoring** - управление процессом

---

## 📊 Полезные команды

### На VPS

```bash
# PM2 статус
pm2 status

# Живой мониторинг
pm2 monit

# Логи
pm2 logs rocket-lunch-bot

# Рестарт
pm2 restart rocket-lunch-bot

# Метрики
pm2 describe rocket-lunch-bot
```

### Проверка метрик

```bash
# Health check
curl https://rocket-lunch.duckdns.org/health

# Application metrics
curl https://rocket-lunch.duckdns.org/api/metrics

# Detailed stats
curl https://rocket-lunch.duckdns.org/api/metrics/detailed
```

---

## 🔍 Что дальше?

### Immediate:
- [ ] Проверьте, что ошибки попадают в Sentry
- [ ] Настройте email alerts
- [ ] Добавьте dashboard в закладки

### Optional:
- [ ] Настройте Telegram alerting бот
- [ ] Интеграция с Slack/Discord
- [ ] Добавьте Grafana dashboard
- [ ] Настройте log rotation

---

## 📚 Полная документация

См. [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) для детального руководства.

---

**Время на настройку:** ~5-10 минут
**Статус:** ✅ Production Ready

**Проблемы?** Проверьте логи: `pm2 logs rocket-lunch-bot`
