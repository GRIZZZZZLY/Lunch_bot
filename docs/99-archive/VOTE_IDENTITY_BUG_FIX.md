# 🐛 ИСПРАВЛЕНИЕ КРИТИЧЕСКОГО БАГА: Смешивание Голосов Пользователей

**Дата:** 2025-10-28  
**Приоритет:** 🚨 CRITICAL  
**Статус:** ✅ Fixed

---

## 🔥 Описание Проблемы

### Симптомы
- Пользователь 1 голосует за блюдо A
- Пользователь 2 голосует за блюдо B
- ❌ **БАГ:** Голос пользователя 1 АВТОМАТИЧЕСКИ переключается на блюдо B!

### Причина
Все пользователи получали **ОДИН И ТОТ ЖЕ** `TEST_USER_ID` при авторизации в dev режиме с `SKIP_TELEGRAM_VALIDATION=true`.

---

## 🔍 Root Cause Analysis

### Цепочка Ошибок

1. **Frontend**: `useTelegram.ts` 
   - При отсутствии Telegram SDK использовался mock user с ID `123456789`
   - Все пользователи получали ОДИНАКОВЫЙ mock user

2. **Frontend**: `auth.service.ts` (строка 41)
   - Отправлялся `'mock_jwt_token_12345678'` вместо РЕАЛЬНОГО initData
   - Backend не мог извлечь настоящий user ID

3. **Backend**: `telegram-auth.ts` (строки 100-120)
   - Fallback на `TEST_USER_ID` из .env (555502880)
   - ВСЕ пользователи получали ОДНОГО и ТОГО ЖЕ пользователя из БД

4. **Backend**: `validateInitDataMiddleware` (строки 301-313)
   - Та же проблема: fallback на единый TEST_USER_ID

### Результат
```
User 1 (Telegram ID: 111111) → TEST_USER_ID (555502880) → DB user ID: 1
User 2 (Telegram ID: 222222) → TEST_USER_ID (555502880) → DB user ID: 1
                                         ↓
                         ОБА пользователя = ОДИН user в БД!
```

Когда User 2 голосовал, vote с `userId: 1` ОБНОВЛЯЛСЯ (upsert), перезаписывая голос User 1!

---

## ✅ Решение

### 1. Frontend: Логирование для Диагностики

**Файл:** `frontend/src/hooks/useAuth.ts`

Добавлено логирование:
```typescript
const authInfo = {
  tgUserId: tgUser?.id,           // ✅ РЕАЛЬНЫЙ Telegram ID
  tgUserName: tgUser?.first_name,
  initDataPreview: initData?.substring(0, 50),
};
console.log('[useAuth] Auth check:', authInfo);
```

**Файл:** `frontend/src/services/auth.service.ts`

Убран mock fallback:
```typescript
// ❌ БЫЛО:
initData: initData || 'mock_jwt_token_12345678'

// ✅ СТАЛО:
initData: initData || ''  // Отправляем РЕАЛЬНЫЙ initData!
```

**Файл:** `frontend/src/components/voting/InlineVotingCard.tsx`

Добавлено детальное логирование:
```typescript
console.log('[InlineVotingCard] 🔍 Looking for user vote:', {
  currentUserId: user.id,
  userTelegramId: user.telegramId,
  totalVotes: pollResponse.data.votes?.length,
  allVoterIds: pollResponse.data.votes?.map(v => ({ 
    userId: v.userId, 
    userName: v.user?.firstName 
  }))
});
```

### 2. Backend: Запрет Fallback на TEST_USER_ID

**Файл:** `backend/src/api/middleware/telegram-auth.ts`

**БЫЛО (строки 100-120):**
```typescript
// Fallback на TEST_USER_ID
const testUserId = process.env.TEST_USER_ID || '123456789';
const dbUser = await UserService.getUserByTelegramId(BigInt(testUserId));
(req as any).user = dbUser;  // ❌ ВСЕ получают ОДНОГО user!
```

**СТАЛО:**
```typescript
// Fallback ЗАПРЕЩЁН - возвращаем 401
logger.error('❌ CRITICAL: No real user data in initData!');
logger.error('❌ Cannot authenticate - this would mix votes!');

res.status(401).json({
  success: false,
  error: 'Telegram authentication required',
  code: 'MISSING_TELEGRAM_DATA'
});
return;
```

**Также исправлено в `validateInitDataMiddleware` (строки 285-316):**
```typescript
// Попытка извлечь РЕАЛЬНЫЙ user из initData
if (initData && initData.trim().length > 0) {
  try {
    const telegramUser = parseInitDataUnsafe(initData);
    
    if (telegramUser && telegramUser.id) {
      (req as any).telegramUser = telegramUser;  // ✅ РЕАЛЬНЫЙ user!
      logger.info('✅ REAL user from initData:', {
        userId: telegramUser.id,
        firstName: telegramUser.first_name
      });
      next();
      return;
    }
  } catch (parseError) {
    logger.error('❌ Failed to parse initData:', parseError);
  }
}

// Если нет реальных данных - ЗАПРЕЩЕНО использовать TEST_USER_ID
res.status(401).json({
  success: false,
  error: 'Telegram authentication required',
  code: 'MISSING_TELEGRAM_DATA'
});
```

---

## 📊 Результат

### До Исправления
```
User 1 votes for dish A:
  userId: 1 (TEST_USER_ID) → menuItemId: 10

User 2 votes for dish B:
  userId: 1 (TEST_USER_ID) → menuItemId: 20  ❌ ПЕРЕЗАПИСЬ!

Result: User 1 sees dish B selected (WRONG!)
```

### После Исправления
```
User 1 votes for dish A:
  userId: 123 (REAL ID from Telegram) → menuItemId: 10

User 2 votes for dish B:
  userId: 456 (REAL ID from Telegram) → menuItemId: 20

Result: Each user sees their OWN vote ✅
```

---

## 🧪 Тестирование

### Как Проверить Исправление

1. **Открыть Dev Build в 2 Telegram аккаунтах:**
   ```powershell
   cd telegram-food-bot
   .\start-dev.ps1
   ```

2. **User 1: Создать голосование и проголосовать за блюдо A**
   - Проверить консоль браузера:
   ```
   [useAuth] Auth check: { tgUserId: 111111, ... }
   [InlineVotingCard] 🔍 currentUserId: 123
   [InlineVotingCard] 🎯 found: true, menuItemId: 10
   ```

3. **User 2: Войти в то же голосование и проголосовать за блюдо B**
   - Проверить консоль браузера:
   ```
   [useAuth] Auth check: { tgUserId: 222222, ... }
   [InlineVotingCard] 🔍 currentUserId: 456
   [InlineVotingCard] 🎯 found: true, menuItemId: 20
   ```

4. **User 1: Обновить страницу**
   - ✅ Голос должен ОСТАТЬСЯ на блюде A (не переключиться на B!)

### Проверка Логов Backend

```bash
cd telegram-food-bot/backend
tail -f logs/combined.log
```

Должно быть:
```
✅ validateInitDataMiddleware: SKIP mode - REAL user from initData
   userId: 111111, firstName: "Иван"

✅ validateInitDataMiddleware: SKIP mode - REAL user from initData
   userId: 222222, firstName: "Петр"
```

НЕ должно быть:
```
❌ validateInitDataMiddleware: No real user data in initData!
⚠️ SKIP mode: fallback test user (testUserId: 555502880)
```

---

## ⚠️ Важные Замечания

### 1. Требование Telegram initData

После исправления приложение **ТРЕБУЕТ** корректный initData от Telegram WebApp.

Если initData не придёт:
- ❌ Авторизация ПРОВАЛИТСЯ с 401
- ❌ Пользователь НЕ сможет голосовать

Это **правильное поведение**, так как без реального user ID невозможно корректно разделить голоса.

### 2. Локальное Тестирование

Для локальной разработки ОБЯЗАТЕЛЬНО:
1. Открывать через Telegram (не напрямую в браузере)
2. Использовать ngrok для HTTPS
3. Обновлять WEBAPP_URL в .env backend

### 3. Production

В production `SKIP_TELEGRAM_VALIDATION` ДОЛЖЕН быть `false`!

Если `true` - backend выдаст ошибку и ОСТАНОВИТСЯ:
```
🚨 SECURITY BREACH: SKIP_TELEGRAM_VALIDATION in PRODUCTION!
CRITICAL SECURITY ERROR: must NEVER be enabled in production!
```

---

## 📁 Изменённые Файлы

### Frontend (3 файла)

1. ✅ `frontend/src/hooks/useAuth.ts`
   - Добавлено логирование tgUserId, tgUserName
   
2. ✅ `frontend/src/services/auth.service.ts`
   - Убран fallback на 'mock_jwt_token_12345678'
   - Отправка РЕАЛЬНОГО initData на backend
   
3. ✅ `frontend/src/components/voting/InlineVotingCard.tsx`
   - Детальное логирование голосов и user ID

### Backend (1 файл)

4. ✅ `backend/src/api/middleware/telegram-auth.ts`
   - ЗАПРЕЩЁН fallback на TEST_USER_ID в `telegramAuthMiddleware`
   - ЗАПРЕЩЁН fallback на TEST_USER_ID в `validateInitDataMiddleware`
   - Извлечение РЕАЛЬНОГО user из initData даже в SKIP режиме
   - Различие JWT токена и Telegram initData (проверка `startsWith('eyJ')`)
   - JWT токены валидируются через jsonwebtoken
   - Telegram initData парсится через parseInitDataUnsafe
   - Возврат 401 если нет реальных данных

### Дополнительное Исправление

**Проблема:** Backend пытался парсить JWT токен как Telegram initData.

**Решение:** Добавлена проверка формата токена:
- Если токен начинается с `'eyJ'` → это JWT → валидация через jsonwebtoken
- Иначе → это Telegram initData → парсинг через parseInitDataUnsafe

Теперь backend корректно обрабатывает оба формата авторизации.

---

## 🔄 Откат (если нужно)

```powershell
git checkout HEAD -- telegram-food-bot/frontend/src/hooks/useAuth.ts
git checkout HEAD -- telegram-food-bot/frontend/src/services/auth.service.ts
git checkout HEAD -- telegram-food-bot/frontend/src/components/voting/InlineVotingCard.tsx
git checkout HEAD -- telegram-food-bot/backend/src/api/middleware/telegram-auth.ts
```

⚠️ **Не рекомендуется!** Это вернёт критический баг.

---

## 🎯 Итог

✅ **Проблема решена**: Каждый пользователь теперь получает свой уникальный ID  
✅ **Голоса НЕ смешиваются**: Vote привязан к правильному userId  
✅ **Безопасность**: Fallback на TEST_USER_ID ЗАПРЕЩЁН  
✅ **Логирование**: Добавлена диагностика для отладки  

**Баг исправлен! 🎉**
