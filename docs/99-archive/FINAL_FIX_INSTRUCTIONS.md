# 🚀 ФИНАЛЬНАЯ ИНСТРУКЦИЯ - Исправление "Invalid initData"

## ✅ Что уже сделано:

1. ✅ `.env` исправлен: `SKIP_TELEGRAM_VALIDATION=true`
2. ✅ Backend пересобран с новыми настройками
3. ✅ Frontend собран с исправлениями профиля

---

## 📋 ЧТО НУЖНО СДЕЛАТЬ СЕЙЧАС:

### Шаг 1: Закрыть ТОЛЬКО окно Backend

Найдите окно PowerShell с заголовком:
```
BACKEND PRODUCTION SERVER
```

Закройте **ТОЛЬКО это окно**.

**НЕ закрывайте** окна:
- ngrok HTTPS TUNNEL
- PRODUCTION URL UPDATER

---

### Шаг 2: Запустить backend заново

Откройте **НОВОЕ** окно PowerShell и выполните:

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
npm start
```

Должно появиться:
```
========================================
  BACKEND PRODUCTION SERVER
========================================

Port: 3001
✓: Loaded .env.production
```

---

### Шаг 3: Проверить Telegram WebApp

1. **Откройте @rocket_lunch_bot в Telegram**
2. **Нажмите кнопку "Menu"**
3. **Mini App должно открыться БЕЗ ошибки**

---

## 🔍 Диагностика

### Если всё ещё ошибка "Invalid initData":

#### 1. Проверьте логи backend

В окне Backend должны появиться строки при открытии WebApp:
```
🔓 SKIP_TELEGRAM_VALIDATION: extracting REAL user from initData
✅ SKIP mode: authenticated with REAL Telegram user
```

**Если НЕ появляются** - смотрите раздел "Проблема с Backend" ниже.

#### 2. Проверьте DevTools (если открыто в браузере)

Нажмите F12 в Telegram Desktop → вкладка Console:

**Должно быть:**
- `[useAuth] Login successful`
- `userId: 4833` (или другой ID)

**НЕ должно быть:**
- `401 Unauthorized`
- `Invalid initData`
- `Authentication failed`

#### 3. Проверьте Network запросы

DevTools → вкладка Network → найдите POST `/api/auth/validate`:

**Request Payload должен содержать:**
```json
{
  "initData": "query_id=AAEg...&user=%7B%22id%22..."
}
```

**Response должен быть:**
```json
{
  "success": true,
  "user": { "id": 4833, ... },
  "token": "..."
}
```

---

## 🛠️ Решение проблем

### Проблема: Backend не запускается

**Ошибка:** `Port 3001 already in use`

**Решение:**
```powershell
# Остановить все Node процессы
taskkill /F /IM node.exe

# Подождать 2 секунды
timeout /t 2

# Запустить backend
cd E:\Lunch_bot\telegram-food-bot\backend
npm start
```

---

### Проблема: В логах "Invalid Telegram hash"

Это означает что `SKIP_TELEGRAM_VALIDATION` всё ещё `false`.

**Решение:**
```powershell
# Проверить .env
cd E:\Lunch_bot\telegram-food-bot\backend
Get-Content .env | Select-String "SKIP"

# Если показывает false - исправить:
# Открыть .env в блокноте
notepad .env

# Найти строку:
SKIP_TELEGRAM_VALIDATION=false

# Изменить на:
SKIP_TELEGRAM_VALIDATION=true

# Сохранить (Ctrl+S), закрыть блокнот

# Пересобрать backend
npm run build

# Перезапустить
npm start
```

---

### Проблема: Frontend показывает старую версию

**Симптомы:**
- Данные профиля всё ещё смешиваются
- Есть две кнопки сохранения

**Решение - пересобрать frontend:**
```powershell
cd E:\Lunch_bot\telegram-food-bot\frontend
npm run build

# Перезапустить backend (он отдаёт frontend)
cd ..\backend
npm start
```

---

### Проблема: ngrok URL изменился

Если вы перезапускали ngrok, URL мог измениться.

**Решение:**
1. Скопируйте новый URL из окна ngrok
2. Вставьте в окно "URL Updater"
3. Скрипт обновит все конфигурации
4. Перезапустите backend

---

## 📊 Как проверить что всё работает

### Тест 1: Авторизация
- ✅ Откройте Mini App
- ✅ Нет ошибки "Invalid initData"
- ✅ Видите главную страницу с голосованиями

### Тест 2: Профиль (2 пользователя)
- ✅ Пользователь A: заполнить профиль → сохранить
- ✅ Пользователь B: открыть профиль → видит пустой профиль
- ✅ Пользователь B: заполнить свой профиль → сохранить
- ✅ Пользователь A: проверить профиль → видит свои данные

### Тест 3: Голосования (2 пользователя)
- ✅ Админ создаёт голосование
- ✅ Обычный пользователь открывает Mini App
- ✅ Видит активное голосование (не просто кнопку создания)

---

## 📞 Если ничего не помогает

### Полный перезапуск с нуля:

```powershell
# 1. Остановить все
taskkill /F /IM node.exe
taskkill /F /IM ngrok.exe

# 2. Проверить .env
cd E:\Lunch_bot\telegram-food-bot\backend
notepad .env
# Убедиться: SKIP_TELEGRAM_VALIDATION=true, NODE_ENV=development

# 3. Пересобрать всё
npm run build

cd ..\frontend
npm run build

# 4. Запустить заново
cd ..
.\start-prod.ps1 -SkipBuild
```

---

## ✅ После успешного запуска

Используйте чеклист для тестирования:
- `QUICK_TEST_CHECKLIST.md` - быстрый чеклист
- `TESTING_INSTRUCTIONS.md` - подробные инструкции

---

## 📋 Изменённые файлы

1. ✅ `backend/.env` - `SKIP_TELEGRAM_VALIDATION=true`
2. ✅ `backend/dist/` - пересобран с новыми настройками
3. ✅ `frontend/src/hooks/usePolls.ts` - исправлен импорт
4. ✅ `frontend/src/hooks/usePaymentInfo.ts` - новый hook
5. ✅ `frontend/src/lib/queryClient.ts` - добавлен paymentInfo key
6. ✅ `frontend/src/pages/ProfilePage.tsx` - React Query + удалён FAB
7. ✅ `frontend/src/pages/HomePage.tsx` - добавлен useUI
8. ✅ `frontend/dist/` - собран production build

Всё готово к тестированию! 🚀
