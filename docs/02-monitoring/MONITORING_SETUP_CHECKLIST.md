# ✅ Чек-лист настройки мониторинга

**Используй этот чек-лист для быстрой настройки мониторинга**

---

## 🎯 Quick Setup (5-10 минут)

### [ ] 1. Получи Sentry DSN ключи

**Действия:**
1. Перейди на [sentry.io](https://sentry.io) и зарегистрируйся
2. Создай организацию: `telegram-food-bot`
3. Создай **Backend** проект:
   - Name: `telegram-food-bot-backend`
   - Platform: `Node.js`
   - **Скопируй DSN**: `https://xxx@o123.ingest.sentry.io/456`

4. Создай **Frontend** проект:
   - Name: `telegram-food-bot-frontend`
   - Platform: `React`
   - **Скопируй DSN**: `https://yyy@o123.ingest.sentry.io/789`

---

### [ ] 2. Обнови backend .env.production

**Файл:** `E:\Lunch_bot\telegram-food-bot\backend\.env.production`

**Добавь (или раскомментируй):**
```bash
# Sentry Error Tracking
ENABLE_SENTRY=true
SENTRY_DSN=https://ВАШ_BACKEND_DSN@o123.ingest.sentry.io/456
```

**Замени** `ВАШ_BACKEND_DSN` на реальный DSN от Sentry Backend проекта

---

### [ ] 3. Обнови frontend .env.production

**Файл:** `E:\Lunch_bot\telegram-food-bot\frontend\.env.production`

**Добавь (или раскомментируй):**
```bash
# Sentry Error Tracking
VITE_SENTRY_DSN=https://ВАШ_FRONTEND_DSN@o123.ingest.sentry.io/789
VITE_APP_VERSION=2.0.0
```

**Замени** `ВАШ_FRONTEND_DSN` на реальный DSN от Sentry Frontend проекта

---

### [ ] 4. Закоммить и запушить изменения

```bash
cd E:\Lunch_bot
git add .
git commit -m "Add monitoring configuration with Sentry DSN"
git push origin feature/new_version
```

---

### [ ] 5. Задеплой на VPS

**SSH на VPS:**
```bash
ssh root@YOUR_VPS_IP
```

**Обнови приложение:**
```bash
cd /root/telegram-food-bot
./update-vps.sh
```

**Скрипт автоматически:**
- Pull изменения из Git
- Установит зависимости
- Соберёт backend и frontend
- Перезапустит PM2 без downtime

---

### [ ] 6. Проверь работу мониторинга

#### 6.1 Health Check
```bash
curl https://rocket-lunch.duckdns.org/health
```

**Ожидаемый ответ:**
```json
{
  "status": "healthy",
  "uptime": "...",
  "database": "connected"
}
```

#### 6.2 Metrics
```bash
curl https://rocket-lunch.duckdns.org/api/metrics
```

**Ожидаемый ответ:** JSON с метриками (polls, votes, users, etc.)

#### 6.3 Dashboard
Открой в браузере:
```
https://rocket-lunch.duckdns.org/dashboard.html
```

**Должно показывать:** Real-time метрики, графики, health status

#### 6.4 Sentry Test (опционально)
```bash
# Отправить тестовую ошибку
curl https://rocket-lunch.duckdns.org/api/test/sentry-error
```

**Проверь Sentry:**
1. Перейди на [sentry.io](https://sentry.io)
2. Projects → `telegram-food-bot-backend`
3. Issues → должна появиться тестовая ошибка "Test Sentry Error - Backend"

---

### [ ] 7. Настрой Sentry Alerts (опционально)

**В Sentry проекте:**
1. Settings → Alerts → New Alert Rule

**Alert Rule 1: Critical Errors**
- Name: `Backend Critical Errors`
- When: `An issue is first seen`
- Conditions: `Level equals error OR fatal`
- Actions: `Send notification via Email`

**Alert Rule 2: High Error Rate**
- Name: `Too Many Errors`
- When: `An issue's events exceed 10 in 1 hour`
- Actions: `Send notification via Email`

---

### [ ] 8. Проверь PM2 мониторинг

**SSH на VPS:**
```bash
ssh root@YOUR_VPS_IP

# Статус процесса
pm2 status

# Живой мониторинг
pm2 monit

# Логи
pm2 logs rocket-lunch-bot

# Метрики
pm2 describe rocket-lunch-bot
```

---

## ✅ Готово! Мониторинг работает

Теперь у тебя есть:
- ✅ **Sentry** - отслеживание ошибок backend + frontend
- ✅ **Health Checks** - `/health`, `/health/ready`, `/health/live`
- ✅ **Metrics API** - `/api/metrics`, `/api/metrics/detailed`
- ✅ **Dashboard** - `https://rocket-lunch.duckdns.org/dashboard.html`
- ✅ **PM2 Monitoring** - управление процессом на VPS

---

## 🔍 Troubleshooting

### Проблема: Ошибки не попадают в Sentry

**Проверь:**
```bash
# На VPS
cd /root/telegram-food-bot
pm2 logs rocket-lunch-bot | grep Sentry
```

**Должно быть:**
```
✅ Sentry инициализирован для окружения: production
```

**Если видишь:**
```
Sentry мониторинг отключен
```

**Проверь .env.production:**
```bash
cat backend/.env.production | grep SENTRY
```

Убедись, что:
- `ENABLE_SENTRY=true`
- `SENTRY_DSN=https://...` (не пустой)

### Проблема: Dashboard не загружается

**Проверь:**
```bash
# Файл должен существовать
ls -la /root/telegram-food-bot/frontend/dist/dashboard.html
```

**Если файла нет:**
```bash
# Пересобрать frontend
cd /root/telegram-food-bot
npm run build --prefix frontend
pm2 restart rocket-lunch-bot
```

### Проблема: Metrics возвращают 404

**Проверь логи:**
```bash
pm2 logs rocket-lunch-bot --err
```

**Пересобрать backend:**
```bash
cd /root/telegram-food-bot
npm run build --prefix backend
pm2 restart rocket-lunch-bot
```

---

## 📚 Дополнительная документация

- [MONITORING_QUICK_START.md](MONITORING_QUICK_START.md) - быстрый старт
- [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md) - полное руководство
- [MONITORING_IMPLEMENTATION_SUMMARY.md](MONITORING_IMPLEMENTATION_SUMMARY.md) - что реализовано

---

## 🎉 Следующие шаги

После настройки мониторинга:

1. [ ] Протестируй приложение в production
2. [ ] Собери feedback от пользователей
3. [ ] Настрой дополнительные alerts
4. [ ] Добавь Telegram alerting бот (опционально)
5. [ ] Интеграция с Grafana (опционально)

---

**Время на настройку:** 5-10 минут
**Сложность:** Легко
**Требуется:** Регистрация на sentry.io + SSH доступ к VPS

**Готово!** 🚀
