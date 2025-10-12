# 🚀 Production Start Guide

## Quick Start

```powershell
.\start-prod.ps1
```

Откроет **3 окна**:
1. **Backend** (3001) - API + Static
2. **ngrok** - HTTPS тоннель  
3. **URL Updater** - Автоматическая настройка

---

## 📋 Что делает скрипт?

### Автоматически:
1. ✅ Проверяет Node.js и ngrok
2. ✅ Собирает frontend (`npm run build`)
3. ✅ Запускает backend (раздает `/api` + статику из `dist/`)
4. ✅ Запускает ngrok на порту 3001
5. ✅ Обновляет `.env` файлы с ngrok URL
6. ✅ Пересобирает frontend с новым URL
7. ✅ Перезапускает backend

### Вручную (после скрипта):
1. Скопировать ngrok URL из **окна 2**
2. Вставить в **окно 3** (URL Updater)
3. Открыть @rocket_lunch_bot в Telegram → нажать "Menu"

---

## 🆚 Production vs Development

| Параметр | Production | Development |
|----------|-----------|-------------|
| Команда | `start-prod.ps1` | `start-dev.ps1` |
| Окна | 3 | 5 |
| Frontend | Build → dist/ | Dev server (5173) |
| Backend | 3001 | 3001 |
| Proxy | ❌ Не нужен | ✅ 8080 |
| ngrok порт | 3001 | 8080 |
| HMR | ❌ | ✅ |

---

## 🏗️ Архитектура Production

```
Telegram WebApp
      ↓
    ngrok
      ↓
Backend:3001
    ├─ /api → API endpoints
    └─ /    → Static (frontend/dist/)
```

**Backend раздает:**
- API запросы: `/api/auth/validate`, `/api/polls/active`, etc.
- Статические файлы: `/`, `/assets/js/...`, `/assets/css/...`
- Fallback на `index.html` для React Router

---

## 🛠️ Параметры скрипта

```powershell
# Пропустить установку зависимостей
.\start-prod.ps1 -SkipChecks

# Пропустить сборку frontend (если уже собран)
.\start-prod.ps1 -SkipBuild

# Запуск без ngrok (если URL уже настроен)
.\start-prod.ps1 -NoNgrok

# Комбинация
.\start-prod.ps1 -SkipChecks -SkipBuild
```

---

## 📁 Файловая структура

```
telegram-food-bot/
├── start-prod.ps1           # Главный скрипт
├── update-urls-prod.ps1     # Обновление URLs
├── backend/
│   ├── .env                 # WEBAPP_URL=https://...
│   └── src/api/server.ts    # Раздает статику из dist/
└── frontend/
    ├── .env.production      # VITE_API_URL=https://.../api
    └── dist/                # Собранный frontend
        ├── index.html
        └── assets/
```

---

## 🔧 Обновление .env файлов

### Backend `.env`:
```env
WEBAPP_URL=https://weighty-untreacherously-christina.ngrok-free.dev
```

### Frontend `.env.production`:
```env
VITE_API_URL=https://weighty-untreacherously-christina.ngrok-free.dev/api
```

**ВАЖНО:** При изменении ngrok URL нужно:
1. Обновить оба `.env` файла
2. Пересобрать frontend: `cd frontend && npm run build`
3. Перезапустить backend

---

## ✅ Проверка работы

### 1. Backend логи должны показать:
```
🚀 API сервер запущен на http://localhost:3001
```

### 2. ngrok должен показать:
```
Forwarding   https://xxx.ngrok-free.dev -> http://localhost:3001
```

### 3. Frontend логи в Telegram:
```
[useAuth] API URL: https://xxx.ngrok-free.dev/api
🌐 [API] POST https://xxx.ngrok-free.dev/api/auth/validate
✅ [API] POST https://xxx.ngrok-free.dev/api/auth/validate success
```

### 4. Откройте в браузере:
```
https://xxx.ngrok-free.dev
```
Должен открыться frontend приложения.

---

## 🚨 Troubleshooting

### Проблема: Frontend не загружается
**Решение:**
```powershell
cd frontend
npm run build
```

### Проблема: API 404
**Проверьте:**
1. Backend запущен на 3001
2. `.env.production` содержит правильный URL
3. Frontend пересобран после изменения URL

### Проблема: ngrok требует auth
**Решение:**
```powershell
ngrok config add-authtoken YOUR_TOKEN
```

### Проблема: Старый кэш в Telegram
**Решение:**
1. Полностью закрыть Telegram
2. Очистить кэш (Settings → Data and Storage → Clear Cache)
3. Открыть снова

---

## 📝 Manual Setup (без скрипта)

### 1. Build Frontend:
```powershell
cd frontend
npm run build
```

### 2. Start Backend:
```powershell
cd backend
npm run dev
```

### 3. Start ngrok:
```powershell
ngrok http 3001
```

### 4. Update .env:
Обновите `WEBAPP_URL` и `VITE_API_URL` вручную.

### 5. Rebuild + Restart:
```powershell
cd frontend
npm run build
cd ../backend
# Перезапустить backend (Ctrl+C → npm run dev)
```

---

## 🔄 Обновление после изменений

### Изменения в Frontend:
```powershell
cd frontend
npm run build
# Backend автоматически раздаст новый build
```

### Изменения в Backend:
```powershell
# Backend перезапустится автоматически (nodemon)
```

### Новый ngrok URL:
```powershell
.\update-urls-prod.ps1
# Или вручную обновить .env → rebuild → restart
```

---

## 📚 Дополнительно

- **Dev режим:** `start-dev.ps1` (HMR, hot reload)
- **Документация:** `WEBAPP_QUICK_START.md`, `WEBAPP_SETUP.md`
- **Логи:** Backend выводит все запросы в консоль
- **Отладка:** Frontend логи в DevTools консоли Telegram WebApp

---

## ⚡ Production Checklist

- [ ] Frontend собран (`dist/` существует)
- [ ] Backend раздает статику (проверить `server.ts`)
- [ ] ngrok запущен на порту 3001
- [ ] `.env` файлы обновлены с ngrok URL
- [ ] @BotFather menu button настроен
- [ ] Telegram WebApp открывается
- [ ] API запросы работают (проверить логи)

---

**Готово!** 🎉 Приложение работает в production режиме.
