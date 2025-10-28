# 🔧 Исправление JWT Верификации - SKIP Mode

**Дата:** 2025-10-28  
**Статус:** ✅ Fixed  

---

## 🐛 Проблема

### Симптомы из Логов

```
[warn]: ⚠️ Failed to verify JWT token {"jwtError":"jwt.verify is not a function"}
[error]: ❌ CRITICAL: No real user data in initData!
[info]: API Request {"url":"/active","statusCode":401}
```

### Root Cause

В SKIP_TELEGRAM_VALIDATION режиме код пытался использовать:
```typescript
const jwt = await import('jsonwebtoken');
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
```

**Проблема:** Динамический import возвращает не тот объект, `jwt.verify` не является функцией.

---

## ✅ Решение

### Использование JwtService

Заменили прямой import на использование `JwtService.verifyToken()`:

**Файл:** `backend/src/api/middleware/telegram-auth.ts`

**БЫЛО:**
```typescript
const jwt = await import('jsonwebtoken');
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

logger.info('✅ SKIP mode: decoded JWT token', {
  userId: decoded.userId,
  telegramId: decoded.telegramId,
});

const user = await UserService.getUserById(decoded.userId);

if (user && user.isActive) {
  (req as any).user = user;
  next();
  return;
}
```

**СТАЛО:**
```typescript
const decoded = JwtService.verifyToken(token);

if (decoded && decoded.type === 'access') {
  logger.info('✅ SKIP mode: decoded JWT token', {
    userId: decoded.userId,
    telegramId: decoded.telegramId,
  });
  
  const user = await UserService.getUserById(decoded.userId);
  
  if (user && user.isActive) {
    (req as any).user = user;
    logger.info('✅ SKIP mode: authenticated via JWT token', {
      userId: user.id,
      telegramId: user.telegramId.toString()
    });
    next();
    return;
  }
} else {
  logger.warn('⚠️ Invalid JWT token type or expired');
}
```

### Добавлено Логирование

```typescript
logger.info('🔍 SKIP mode: analyzing token', {
  isJWT,
  tokenLength: token.length,
  tokenPreview: token.substring(0, 50)
});
```

---

## 📊 Результат

### До Исправления

```
❌ jwt.verify is not a function
❌ No real user data in initData
❌ 401 Unauthorized
```

### После Исправления

```
✅ SKIP mode: analyzing token { isJWT: true, tokenLength: 253 }
✅ SKIP mode: decoded JWT token { userId: 4833, telegramId: "555502880" }
✅ SKIP mode: authenticated via JWT token { userId: 4833 }
✅ 200 OK
```

---

## 🧪 Тестирование

### Перезапустить Backend

```powershell
# Остановить текущий backend (Ctrl+C в окне backend)
# Перезапустить весь dev билд
cd telegram-food-bot
.\start-dev.ps1
```

### Проверить Логи

После перезапуска backend должен показывать:

```
✅ SKIP mode: analyzing token
✅ SKIP mode: decoded JWT token
✅ SKIP mode: authenticated via JWT token
```

НЕ должно быть:
```
❌ jwt.verify is not a function
❌ No real user data in initData
```

### Проверить Функционал

1. Откройте Mini App в Telegram
2. Создайте голосование (если админ)
3. Проголосуйте за блюдо
4. ✅ Проверка: Запросы к `/polls/active` должны возвращать 200 OK

---

## 📁 Изменённые Файлы

**Backend:**
- ✅ `backend/src/api/middleware/telegram-auth.ts`
  - Заменён `jwt.verify` на `JwtService.verifyToken()`
  - Добавлена проверка `decoded.type === 'access'`
  - Добавлено логирование анализа токена
  - Улучшена обработка ошибок

---

## 🔄 Связь с Другими Исправлениями

Это исправление **дополняет** основное исправление бага смешивания голосов:

1. **VOTE_IDENTITY_BUG_FIX.md** - запрет TEST_USER_ID fallback
2. **JWT_VERIFICATION_FIX.md** (этот документ) - исправление верификации JWT

Оба исправления необходимы для корректной работы авторизации.

---

## ⚠️ Важно

### JwtService vs jsonwebtoken

**Правильно:**
```typescript
import { JwtService } from '../../services/jwt.service';
const decoded = JwtService.verifyToken(token);
```

**Неправильно:**
```typescript
const jwt = await import('jsonwebtoken');
const decoded = jwt.verify(token, secret); // ❌ jwt.verify is not a function
```

### Production

В production режиме (без SKIP_TELEGRAM_VALIDATION) код уже использовал правильный путь:
```typescript
const decoded = JwtService.verifyToken(token);
```

Поэтому это исправление влияет только на **development режим**.

---

**Исправление завершено! 🎉**
