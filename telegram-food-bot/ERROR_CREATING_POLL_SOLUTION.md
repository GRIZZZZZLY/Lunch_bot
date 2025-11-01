# 🔧 Решение Ошибки "Ошибка создания голосования"

**Дата:** 08.01.2025  
**Проблема:** При нажатии "Запустить" появляется ошибка создания голосования

---

## 🔍 Анализ Проблемы

### Что Проверено:

1. ✅ **Backend запущен** - порт 3001 активен (PID 30028)
2. ✅ **Пользователь существует** - ID 1, Игорь, isAdmin=true, isActive=true
3. ✅ **Роут работает** - `/api/polls/create-from-webapp` существует
4. ✅ **Авторизация настроена** - `SKIP_TELEGRAM_VALIDATION=true` для dev режима
5. ⚠️ **Ngrok туннель** - `https://epicritic-uninspiredly-makai.ngrok-free.dev/api`

### Возможные Причины:

1. **Ngrok туннель не работает** - туннель мог истечь или быть недоступен
2. **CORS проблемы** - frontend не может обратиться к backend через ngrok
3. **Токен авторизации** - frontend не получает или не сохраняет токен правильно
4. **Сетевые проблемы** - запросы не доходят до backend

---

## 🛠️ Решение

### Шаг 1: Проверка Ngrok Туннеля

**Проблема:** Ngrok туннель может быть неактивен или истёк (ngrok free версия имеет временные ограничения)

**Решение:**

```bash
# Проверьте работает ли ngrok
curl https://epicritic-uninspiredly-makai.ngrok-free.dev/api/health

# Если не работает - запустите новый туннель:
cd C:\BOT_V2\telegram-food-bot\backend
ngrok http 3001
```

**Затем обновите URL в конфигурации:**

1. Скопируйте новый ngrok URL (например: `https://abc-def-123.ngrok-free.app`)
2. Обновите `frontend/.env`:
   ```bash
   VITE_API_URL=https://YOUR-NEW-NGROK-URL/api
   ```
3. Обновите `backend/.env`:
   ```bash
   WEBAPP_URL=https://YOUR-NEW-NGROK-URL
   CORS_ORIGIN=http://localhost:5173,https://YOUR-NEW-NGROK-URL
   ```

---

### Шаг 2: Использование Локального API (Временное Решение)

**Если ngrok не работает, используйте локальный API:**

1. Откройте `frontend/.env`
2. Измените API URL:
   ```bash
   # Было:
   VITE_API_URL=https://epicritic-uninspiredly-makai.ngrok-free.dev/api

   # Стало:
   VITE_API_URL=http://localhost:3001/api
   ```

3. Перезапустите frontend:
   ```bash
   cd C:\BOT_V2\telegram-food-bot\frontend
   npm run dev
   ```

**⚠️ Примечание:** Это работает только на ПК, не на телефоне!

---

### Шаг 3: Проверка Логов Backend

**Откройте консоль где запущен backend и проверьте логи:**

```bash
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev
```

**Ищите сообщения:**
- `🚀 START createPollFromWebApp` - запрос получен
- `Creating poll from WebApp` - параметры запроса
- Ошибки валидации или создания

---

### Шаг 4: Проверка Frontend Консоли

**Откройте браузер и проверьте консоль (F12):**

1. Откройте http://localhost:5173
2. Откройте DevTools (F12) → Console
3. Попробуйте создать голосование

**Ищите сообщения:**
- `[useAuth]` - авторизация
- `[API] POST /api/polls/create-from-webapp` - запрос создания
- `❌ [API] ... failed` - ошибки API

---

### Шаг 5: Включить MOCK API (Для Тестирования)

**Если backend недоступен, используйте MOCK API:**

1. Откройте `frontend/.env`
2. Измените:
   ```bash
   VITE_USE_MOCK_API=true
   ```

3. Перезапустите frontend

**✅ Это позволит тестировать UI без backend!**

---

## 🧪 Диагностика

### Тест 1: Проверка API Доступности

```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method GET

# Ожидается:
# StatusCode: 200
# Content: {"success":true, ...}
```

### Тест 2: Проверка Авторизации

```bash
# PowerShell
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    initData = ""
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/auth/validate" `
  -Method POST `
  -Headers $headers `
  -Body $body

# Ожидается:
# StatusCode: 200
# Content: {"success":true, "user":{...}, "token":"..."}
```

### Тест 3: Проверка Создания Голосования

**Сначала получите токен из Теста 2, затем:**

```bash
# PowerShell
$token = "ВАШ_ТОКЕН_ИЗ_ТЕСТА_2"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

$body = @{
    groupId = 1
    duration = 30
    selectedMenuItems = @(1, 2, 3)
    title = "Test Poll"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/polls/create-from-webapp" `
  -Method POST `
  -Headers $headers `
  -Body $body

# Ожидается:
# StatusCode: 201
# Content: {"success":true, "data":{...}}
```

---

## 📋 Чек-лист Решения

- [ ] Backend запущен (`npm run dev` в backend папке)
- [ ] Frontend запущен (`npm run dev` в frontend папке)
- [ ] Ngrok туннель активен (или используется localhost)
- [ ] `.env` файлы обновлены с правильными URL
- [ ] Пользователь имеет admin права (проверено ✅)
- [ ] Консоль browser открыта для просмотра ошибок
- [ ] Консоль backend открыта для просмотра логов

---

## 🎯 Рекомендуемое Решение

### Для Локальной Разработки (ПК):

```bash
# Terminal 1: Backend
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev

# Terminal 2: Frontend
cd C:\BOT_V2\telegram-food-bot\frontend

# Обновите .env:
# VITE_API_URL=http://localhost:3001/api
# VITE_USE_MOCK_API=false

npm run dev

# Откройте: http://localhost:5173
```

### Для Тестирования на Телефоне:

```bash
# Terminal 1: Backend
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev

# Terminal 2: Ngrok
ngrok http 3001
# Скопируйте URL (например: https://abc-123.ngrok-free.app)

# Terminal 3: Frontend
cd C:\BOT_V2\telegram-food-bot\frontend

# Обновите .env:
# VITE_API_URL=https://abc-123.ngrok-free.app/api
# VITE_USE_MOCK_API=false

npm run dev

# Откройте ngrok URL на телефоне
```

---

## 🐛 Отладка

### Если Ошибка Остаётся:

1. **Проверьте Network вкладку в DevTools:**
   - Найдите запрос к `/api/polls/create-from-webapp`
   - Посмотрите на Status Code (401? 403? 500?)
   - Посмотрите на Response body

2. **Проверьте Headers запроса:**
   - Есть ли `Authorization: Bearer ...`?
   - Правильный ли Content-Type?

3. **Проверьте Payload:**
   - Правильный ли groupId?
   - Есть ли selectedMenuItems?
   - Правильная ли duration?

---

## 📞 Нужна Помощь?

**Запустите приложение в dev mode и пришлите:**

1. Screenshot консоли browser (F12 → Console)
2. Screenshot консоли backend
3. Screenshot Network вкладки (запрос создания голосования)

---

## ✅ Ожидаемый Результат

После исправления, при нажатии "Запустить":
- ✅ Консоль browser: `[API] POST /api/polls/create-from-webapp`
- ✅ Консоль backend: `🚀 START createPollFromWebApp`
- ✅ Ответ: `{success: true, data: {pollId: ..., messageId: ...}}`
- ✅ Модалка закрывается
- ✅ Голосование создано!

---

_Generated: 08.01.2025_  
_Type: Troubleshooting Guide_
