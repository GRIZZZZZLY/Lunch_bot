# Перезапуск только Backend

## Проблема

`.env` был изменён (установлен `SKIP_TELEGRAM_VALIDATION=true`), но backend всё ещё использует старые настройки.

## Решение

Нужно перезапустить **ТОЛЬКО backend**, ngrok и URL updater оставить работающими.

---

## Вариант 1: Через PowerShell (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Остановить ТОЛЬКО окно Backend

Найдите окно с заголовком "BACKEND PRODUCTION SERVER" и закройте его.

**НЕ закрывайте:** окна ngrok и URL Updater.

### Шаг 2: Запустить backend заново

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
npm start
```

---

## Вариант 2: Через батник

```cmd
cd E:\Lunch_bot\telegram-food-bot\backend
restart.bat
```

Этот скрипт:
1. Остановит все Node процессы
2. Запустит backend в новом окне

---

## Проверка

### 1. Проверить что SKIP_TELEGRAM_VALIDATION применилось

**В окне Backend должно быть:**
```
✓: Loaded .env.production
```

**Откройте консоль DevTools в Telegram WebApp и проверьте:**
- Не должно быть ошибок 401 Unauthorized
- Не должно быть "Invalid initData"

### 2. Проверить логи

```powershell
Get-Content E:\Lunch_bot\telegram-food-bot\backend\logs\combined.log -Tail 10
```

**Должно быть (когда откроете Telegram WebApp):**
```json
{
  "message": "🔓 SKIP_TELEGRAM_VALIDATION: extracting REAL user from initData"
}
{
  "message": "✅ SKIP mode: authenticated with REAL Telegram user",
  "userId": 4833,
  "telegramId": 555502880
}
```

**НЕ должно быть:**
```
"Invalid Telegram hash - signature verification failed"
"InitData validation failed"
```

---

## Если всё ещё не работает

### Проверка 1: Убедиться что `.env` правильный

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
Get-Content .env | Select-String "SKIP_TELEGRAM_VALIDATION"
Get-Content .env | Select-String "NODE_ENV"
```

**Должно быть:**
```
SKIP_TELEGRAM_VALIDATION=true
NODE_ENV=development
```

### Проверка 2: Пересобрать backend

Возможно старый скомпилированный код в `dist/`:

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
npm run build
npm start
```

### Проверка 3: Проверить фронтенд

Возможно проблема на фронтенде - initData не отправляется:

1. Откройте DevTools в Telegram WebApp (F12 в десктопной версии)
2. Перейдите на вкладку "Network"
3. Обновите страницу
4. Найдите запрос POST `/api/auth/validate`
5. Проверьте Request Payload - должен быть `initData` со значением

---

## Альтернативное решение

Если ничего не помогает, возможно проблема в том что frontend использует старый build.

**Пересоберите frontend:**

```powershell
cd E:\Lunch_bot\telegram-food-bot\frontend
npm run build
```

Затем перезапустите backend (он будет отдавать новый build).
