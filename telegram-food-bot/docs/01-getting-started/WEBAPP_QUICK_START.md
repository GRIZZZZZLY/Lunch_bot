# ⚡ WebApp Quick Start - 5 минут до запуска

## 🎯 Цель

Запустить WebApp интерфейс бота в dev режиме с HTTPS туннелями.

---

## 🚀 Быстрый старт (РЕКОМЕНДУЕТСЯ)

### ⭐ Вариант A: Автоматический запуск (САМЫЙ ПРОСТОЙ!)

**Запускает ВСЁ одной командой - Backend, Frontend, Proxy, ngrok!**

1. **Установите ngrok** (если ещё нет):
```powershell
winget install ngrok
```

2. **Запустите всё одной командой**:
```powershell
.\start-dev.ps1
```

Откроются 4 окна терминала автоматически! ✨

---

### Вариант B: Один туннель через Proxy (ручной)

**Если нужно больше контроля:**

```powershell
.\dev-start-proxy.ps1
```

3. **Откроются 4 окна терминала**:
   - 🔧 Backend (порт 3001)
   - ⚛️ Frontend (порт 5173)
   - 🔀 Proxy (порт 8080)
   - 🌐 ngrok (HTTPS туннель)

4. **Скопируйте ngrok URL** из последнего окна:
```
https://abc123.ngrok-free.app
```

5. **Обновите конфиги**:

```bash
# backend\.env
WEBAPP_URL=https://abc123.ngrok-free.app
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://abc123.ngrok-free.app

# frontend\.env
VITE_API_URL=https://abc123.ngrok-free.app/api
```

6. **Перезапустите backend**:
   - В окне Backend: `Ctrl+C`
   - Затем: `npm run dev`

7. **Откройте бота в Telegram** → Нажмите Menu Button!

✅ **Готово! WebApp работает!**

---

## 🔄 Альтернативный вариант

### Вариант B: Два туннеля (без Proxy)

Если Proxy не работает, используйте два отдельных туннеля:

```powershell
.\dev-start-ngrok.ps1
```

Откроются 4 окна:
- Backend
- Frontend
- ngrok для Backend
- ngrok для Frontend

Обновите .env файлы **двумя разными URL**:
```bash
# backend\.env
WEBAPP_URL=https://frontend-url.ngrok-free.app
CORS_ORIGIN=https://frontend-url.ngrok-free.app

# frontend\.env
VITE_API_URL=https://backend-url.ngrok-free.app/api
```

---

## 🐛 Troubleshooting

### Menu Button не появился

**Причина:** WEBAPP_URL не HTTPS или backend не перезапущен

**Решение:**
1. Проверьте `backend\.env` → `WEBAPP_URL` должен быть HTTPS
2. Перезапустите backend (`Ctrl+C`, потом `npm run dev`)
3. В логах должно быть: `✅ Default menu button set for private chats`

### CORS ошибки в консоли

**Причина:** ngrok URL не добавлен в CORS_ORIGIN

**Решение:**
```bash
# backend\.env
CORS_ORIGIN=http://localhost:5173,https://YOUR_NGROK_URL
```

### WebApp не загружается

**Причина:** Проверьте что все сервисы запущены

**Решение:**
```powershell
# Проверьте в браузере:
curl http://localhost:3001/health  # Backend
curl http://localhost:5173          # Frontend
curl http://localhost:8080          # Proxy (если используете)
```

### ngrok URL изменился после перезапуска

**Причина:** Бесплатная версия ngrok дает случайный URL

**Решение:**
1. Скопируйте новый URL
2. Обновите .env файлы
3. Перезапустите backend

**Или:** Зарегистрируйтесь на ngrok.com для постоянного URL (платно)

---

## 📱 Проверка работы

### 1. Backend запущен:
```
✅ API server running on http://localhost:3001
✅ Default menu button set for private chats
```

### 2. Frontend запущен:
```
  VITE v4.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. ngrok работает:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8080
```

### 4. Menu Button в боте:
- Откройте @rocket_lunch_bot
- Внизу должна быть кнопка "📋 Открыть меню"
- Нажмите → WebApp откроется!

---

## 🎉 Что дальше?

### Тестирование функций:

1. **Открыть WebApp** → Menu Button в боте
2. **Создать голосование** → В WebApp → Poll Create
3. **Проверить уведомление в группе** → Должна появиться кнопка "🗳️ Проголосовать"
4. **Проголосовать** → Нажать кнопку → WebApp откроется на странице голосования
5. **Дождаться результатов** → Уведомление с кнопкой "📊 Результаты"

### Разработка:

- Frontend: http://localhost:5173 (Hot Reload работает)
- Backend: http://localhost:3001 (Auto-restart при изменениях)
- Изменения применяются автоматически!

---

## 📖 Подробная документация

- [WEBAPP_SETUP.md](./WEBAPP_SETUP.md) - полная инструкция по настройке
- [DEV_README.md](./DEV_README.md) - общая информация о dev окружении
- [DEV_MANUAL_TESTING.md](./DEV_MANUAL_TESTING.md) - сценарии тестирования

---

## 💡 Полезные команды

```powershell
# Остановить все окна
# Закройте каждое окно через Ctrl+C

# Запустить только Backend
cd backend
npm run dev

# Запустить только Frontend
cd frontend
npm run dev

# Запустить Proxy
node proxy-server.js

# Запустить ngrok вручную
ngrok http 8080  # Для Proxy варианта
ngrok http 3001  # Для Backend
ngrok http 5173  # Для Frontend
```

---

**🎊 Готово! Приятной разработки!**
