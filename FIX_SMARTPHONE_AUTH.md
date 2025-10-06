# 📱 Исправление "Ошибка Авторизации" на смартфоне

## 🔴 Проблема
После нажатия "Visit Site" в ngrok, проект открывается, но показывает **"Ошибка Авторизации"**.

## ✅ Решение

### Шаг 1: Перезапустите Frontend (ОБЯЗАТЕЛЬНО!)

Frontend должен перезагрузить переменные окружения из `.env`:

```powershell
.\restart-frontend.ps1
```

**Проверьте вывод!** Должна быть строка:
```
VITE_USE_MOCK_API=false
```

### Шаг 2: Перезапустите Backend (если нужно)

Закройте окно с backend (Ctrl+C) и запустите:

```powershell
cd backend
npm run dev
```

В логах должно появиться:
```
[warn]: ⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!
```

### Шаг 3: Проверьте на смартфоне

1. **Откройте Telegram** на смартфоне
2. Найдите `@rocket_lunch_bot`
3. Нажмите **Menu**
4. Если появляется "Visit Site" - нажмите
5. WebApp должен открыться **БЕЗ ошибки авторизации**

## 🔍 Если всё ещё не работает

### Проверка 1: Frontend использует правильный .env

Откройте http://localhost:5173 в браузере на компьютере и откройте **DevTools Console** (F12).

Должны быть логи:
```
[useAuth] Auth check: { useMockApi: false, ... }
```

Если `useMockApi: true` - значит frontend не перезагрузил .env!

**Решение:**
```powershell
# Закройте ВСЕ окна frontend (Ctrl+C в терминале)
# Подождите 5 секунд
cd frontend
npm run dev
```

### Проверка 2: Backend получает запросы

В логах backend должно быть:
```
[info]: 🌐 API запрос {"method":"POST","url":"/api/auth/validate"}
[warn]: ⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!
[info]: ✅ Dev user authenticated via SKIP_TELEGRAM_VALIDATION
```

Если этого нет - frontend не обращается к backend.

**Решение:** Проверьте `VITE_API_URL` в `frontend/.env`:
```env
VITE_API_URL=https://d8328ab355a6.ngrok-free.app/api
```

### Проверка 3: CORS не блокирует

Если в логах backend:
```
[warn]: CORS заблокировал запрос
```

**Решение:** Проверьте что backend действительно в development режиме:
```env
NODE_ENV=development
```

## 🚀 Полный перезапуск (если ничего не помогло)

```powershell
# 1. Закройте ВСЕ окна терминалов
# 2. Подождите 5 секунд
# 3. Запустите всё заново:
.\start-dev.ps1 -NoNgrok
```

## 📊 Проверка переменных окружения

### Backend (.env):
```env
NODE_ENV=development
SKIP_TELEGRAM_VALIDATION=true
TEST_USER_ID=555502880
WEBAPP_URL=https://d8328ab355a6.ngrok-free.app
```

### Frontend (.env):
```env
VITE_USE_MOCK_API=false
VITE_API_URL=https://d8328ab355a6.ngrok-free.app/api
```

## 🎯 Почему это происходит?

### Проблема: Vite кэширует переменные окружения

Когда вы меняете `.env` файл, Vite **НЕ** перезагружает его автоматически.
Нужно **перезапустить** dev сервер!

### Решение:
1. Остановить frontend (Ctrl+C)
2. Изменить `.env`
3. Запустить frontend заново

## 💡 Быстрая проверка

Откройте http://localhost:5173 в браузере и в консоли выполните:

```javascript
console.log(import.meta.env.VITE_USE_MOCK_API)
console.log(import.meta.env.VITE_API_URL)
```

Должно быть:
```
false
https://d8328ab355a6.ngrok-free.app/api
```

---

**Создано:** 2025-01-06  
**Статус:** 🔥 Critical Fix  
**Проверено:** ✅ Works on smartphone after frontend restart
