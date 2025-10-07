# 📱 Исправление "Ошибка авторизации" на мобильном телефоне

## 🔍 Проблема

При открытии WebApp с телефона через Telegram показывается **"Ошибка авторизации"**, хотя на компьютере всё работает.

## 🎯 Причина

В файле `frontend/.env` был включен **Mock API режим**:

```env
VITE_USE_MOCK_API=true  ← Это блокировало реальные запросы к backend
```

В этом режиме приложение использует тестовые данные вместо реального backend API.

## ✅ Исправление

### Шаг 1: Отключить Mock API

**Исправлено автоматически!** В `frontend/.env` изменено на:

```env
VITE_USE_MOCK_API=false
```

### Шаг 2: Обновить ngrok URL (если нужно)

Если у вас сменился ngrok URL, используйте скрипт:

```powershell
.\update-ngrok-url.ps1 "https://ваш-новый-url.ngrok-free.app"
```

Скрипт автоматически обновит:
- ✅ `backend/.env` → `WEBAPP_URL` и `CORS_ORIGIN`
- ✅ `frontend/.env` → `VITE_API_URL`

### Шаг 3: Перезапустить сервисы

#### Вариант A: Перезапуск всех сервисов

```powershell
.\start-dev.ps1 -NoNgrok
```

#### Вариант B: Перезапуск вручную

Закройте все окна с backend/frontend/proxy и запустите заново:

```powershell
# В отдельных окнах:
cd backend && npm run dev
cd frontend && npm run dev
cd .. && node proxy-server.js
```

## 🧪 Проверка

### На компьютере:
1. Откройте http://localhost:5173 в браузере
2. Должно работать без ошибок

### На телефоне:
1. Откройте Telegram
2. Найдите бота `@rocket_lunch_bot`
3. Нажмите кнопку **Menu** (внизу)
4. WebApp должен открыться **БЕЗ ошибки авторизации**

## 📊 Проверка в логах

В терминале backend должны появиться логи:

```
[warn]: ⚠️  SKIP_TELEGRAM_VALIDATION активен - валидация отключена!
[debug]: CORS: development режим, разрешаем все origins
[info]: API пользователь аутентифицирован
```

## ⚙️ Что было исправлено

### 1. CORS политика (backend)
```typescript
// В development разрешены ВСЕ origins (для работы с ngrok)
if (process.env.NODE_ENV === 'development') {
  return callback(null, true);
}
```

### 2. Валидация initData (backend)
```typescript
// Можно отключить валидацию для разработки
if (process.env.SKIP_TELEGRAM_VALIDATION === 'true') {
  // Используется тестовый пользователь
}
```

### 3. Mock API отключен (frontend)
```env
VITE_USE_MOCK_API=false
```

## 🔐 Безопасность

**В production** все проверки включаются автоматически:
- ✅ CORS проверяет только разрешенные домены
- ✅ Telegram initData валидируется обязательно
- ✅ Mock API недоступен

## 📝 Дополнительные настройки

### Полное отключение валидации (для тестирования)

Если всё ещё возникают проблемы, можно временно отключить валидацию в `backend/.env`:

```env
# ⚠️ ТОЛЬКО ДЛЯ РАЗРАБОТКИ!
SKIP_TELEGRAM_VALIDATION=true
TEST_USER_ID=555502880
```

Это создаст тестового пользователя для всех запросов.

## 🆘 Если проблема осталась

### 1. Проверьте ngrok URL

В логах backend ищите:
```
Default menu button set for private chats {"webappUrl":"https://..."}
```

Этот URL должен совпадать с `VITE_API_URL` в `frontend/.env`.

### 2. Проверьте CORS origin

В логах backend ищите:
```
[warn]: CORS заблокировал запрос {"origin":"https://..."}
```

Если видите это - значит ngrok URL не совпадает.

### 3. Откройте DevTools в Telegram Desktop

1. Telegram Desktop → Settings → Advanced → Experimental → Debug Mode
2. Откройте WebApp
3. Правый клик → Inspect Element
4. Console покажет ошибки

---

**Создано:** 2025-01-06  
**Статус:** ✅ Исправлено  
**Документация:** См. также `backend/DEV_MODE.md`
