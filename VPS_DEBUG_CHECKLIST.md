# 🔍 VPS Debug Checklist - Что проверить после исправлений

После исправления ошибок (Redis, Telegram API, useAuth) нужно **пересобрать и передеплоить** на VPS.

---

## ✅ Исправленные проблемы (локально):

1. ✅ **Redis опциональный** - `REDIS_ENABLED=false` в .env
2. ✅ **Telegram API** - добавлены инструкции по VPN/прокси
3. ✅ **useAuth циклическая зависимость** - исправлена через `useRef`

---

## 🚀 Что делать на VPS:

### Шаг 1: Pull последних изменений

```bash
# SSH на VPS
ssh user@your-vps-ip

# Перейдите в папку проекта
cd ~/Lunch_bot

# Получите последние изменения
git pull origin feature/new_version

# Или если изменения только локальные - закоммитьте и запуште их
```

### Шаг 2: Обновите .env файлы

```bash
# Backend .env
cd ~/Lunch_bot/telegram-food-bot/backend

# Убедитесь что Redis отключен для dev/staging
grep REDIS_ENABLED .env
# Должно быть: REDIS_ENABLED=false (если Redis не установлен)

# Проверьте настройки прокси если Telegram API заблокирован на VPS
grep USE_PROXY .env
# Если нужен прокси: USE_PROXY=true и PROXY_URL=...
```

### Шаг 3: Пересоберите frontend

```bash
cd ~/Lunch_bot/telegram-food-bot/frontend

# Исправьте права если были проблемы
chmod -R +x node_modules/.bin

# Очистите старую сборку
rm -rf dist/

# Соберите заново
npm run build

# Проверьте что собралось
ls -la dist/
# Должны быть: index.html, assets/, favicon.svg
```

### Шаг 4: Перезапустите backend через PM2

```bash
cd ~/Lunch_bot/telegram-food-bot

# Перезапустите с обновлённым кодом
pm2 restart telegram-food-bot

# ИЛИ полная пересборка:
cd backend
npm run build
pm2 restart telegram-food-bot

# Проверьте логи
pm2 logs telegram-food-bot --lines 50
```

**Что должно быть в логах:**
```
✅ Cache service initialized with Redis (или warning - это OK)
✅ Бот инициализирован
✅ Webhook удален
✅ Бот запущен в polling режиме
✅ API сервер запущен на http://127.0.0.1:3001
```

### Шаг 5: Проверьте Nginx

```bash
# Проверьте конфигурацию
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx

# Проверьте статус
sudo systemctl status nginx
```

### Шаг 6: Тестирование

#### 6.1 Проверьте API напрямую
```bash
# Health check
curl http://localhost:3001/health

# Должен вернуть:
# {"status":"ok","timestamp":"...","uptime":...}
```

#### 6.2 Проверьте статические файлы
```bash
# Проверьте что frontend раздаётся
curl -I http://localhost:3001/

# Должен вернуть:
# HTTP/1.1 200 OK
# Content-Type: text/html
```

#### 6.3 Проверьте через домен
```bash
# HTTP (должен редиректить на HTTPS)
curl -I http://rocket-lunch.duckdns.org

# HTTPS
curl -I https://rocket-lunch.duckdns.org
```

#### 6.4 Откройте в браузере
```
https://rocket-lunch.duckdns.org
```

**Что должно произойти:**
- ✅ Сайт открывается
- ✅ Нет белого экрана
- ✅ Нет ошибки "Cannot access 'refresh' before initialization"
- ✅ Интерфейс загружается

**Проверьте консоль браузера (F12):**
```
✅ Telegram WebApp SDK loaded successfully
✅ [ApiService] Initializing with baseURL: /api
✅ [Sentry] Disabled in development mode
✅ 🚀 Бот готов к работе
```

---

## 🐛 Если проблемы остались:

### Проблема: Frontend не пересобрался

**Признаки:**
```bash
npm run build
# Error: vite: Permission denied
```

**Решение:**
```bash
# Исправьте права
cd ~/Lunch_bot/telegram-food-bot/frontend
sudo chown -R $USER:$USER node_modules
chmod -R +x node_modules/.bin

# Попробуйте снова
npm run build
```

---

### Проблема: Backend не запустился

**Признаки:**
```bash
pm2 logs telegram-food-bot
# HttpError: Network request for 'getMe' failed!
# code: ECONNRESET
```

**Решение:** Telegram API заблокирован на VPS

**Вариант 1: VPN на VPS** (рекомендуется)
```bash
# Установите VPN клиент на VPS
# Например Wireguard, OpenVPN, или Cloudflare WARP
```

**Вариант 2: Прокси в .env**
```bash
cd ~/Lunch_bot/telegram-food-bot/backend
nano .env

# Добавьте:
USE_PROXY=true
PROXY_URL=socks5://your-proxy-server:1080
```

---

### Проблема: Белый экран / useAuth ошибка

**Признаки:**
- Сайт открывается, но белый экран
- В консоли: "Cannot access 'refresh' before initialization"

**Решение:**
```bash
# Убедитесь что pull последних изменений сделан
git log --oneline -5
# Должен быть коммит с исправлением useAuth

# Пересоберите frontend
cd ~/Lunch_bot/telegram-food-bot/frontend
npm run build

# Перезапустите backend
pm2 restart telegram-food-bot
```

---

### Проблема: Redis ошибки

**Признаки:**
```bash
pm2 logs telegram-food-bot
# ❌ Redis error: {"code":"EACCES"}
```

**Решение:** Это нормально если Redis не установлен

```bash
# Проверьте что REDIS_ENABLED=false
cd ~/Lunch_bot/telegram-food-bot/backend
grep REDIS_ENABLED .env

# Должно быть: REDIS_ENABLED=false
```

Бот будет работать без кэша (для production рекомендуется установить Redis).

---

## 📋 Финальный чеклист:

- [ ] Git pull последних изменений
- [ ] Backend .env настроен (REDIS_ENABLED, USE_PROXY)
- [ ] Frontend пересобран (`npm run build`)
- [ ] Backend перезапущен (`pm2 restart`)
- [ ] Nginx перезагружен (`sudo systemctl reload nginx`)
- [ ] API отвечает (`curl http://localhost:3001/health`)
- [ ] Сайт открывается (`https://rocket-lunch.duckdns.org`)
- [ ] Консоль браузера без ошибок (F12)
- [ ] Telegram бот отвечает (проверка в Telegram)

---

## 🎯 Результат:

После всех шагов:
- ✅ Backend запущен и работает
- ✅ Frontend собран и раздаётся
- ✅ Сайт открывается без ошибок
- ✅ Telegram бот функционирует
- ✅ Mini App доступно в боте

---

**Документация:**
- [VPS_FIX_INSTRUCTIONS.md](../VPS_FIX_INSTRUCTIONS.md) - детальные инструкции
- [TELEGRAM_API_FIX.md](TELEGRAM_API_FIX.md) - исправление Telegram API
- [QUICK_START_DEV.md](QUICK_START_DEV.md) - локальный запуск
