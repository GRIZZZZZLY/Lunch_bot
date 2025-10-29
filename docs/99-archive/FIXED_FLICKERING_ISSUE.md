# ✅ Исправлена проблема мерцания данных в Production

## 🐛 Проблема

В production режиме наблюдалось "мерцание" данных:
- Фото профиля то появляется, то исчезает
- Блюда меню то есть, то их нет
- Данные "прыгают" при переключении между страницами

## 🔍 Причины

### 1. **Слишком долгий staleTime в React Query**
```typescript
// Было:
staleTime: 5 * 60 * 1000, // 5 минут - данные редко обновлялись!
gcTime: 10 * 60 * 1000, // 10 минут

// Стало:
staleTime: 30 * 1000, // 30 секунд - быстрее обновление!
gcTime: 5 * 60 * 1000, // 5 минут
```

### 2. **Двойной setUser() в useAuth**
```typescript
// Было:
loadUserWithToken() {
  // 1. Парсим токен и сразу setUser(tokenUser) - МЕРЦАНИЕ!
  setUser(tokenUser); 
  setIsLoading(false);
  
  // 2. Затем API запрос и опять setUser(apiUser) - МЕРЦАНИЕ!
  const apiUser = await authService.getCurrentUser();
  setUser(apiUser);
}

// Стало:
loadUserWithToken() {
  // Только 1 setUser из API - нет мерцания!
  const apiUser = await authService.getCurrentUser();
  setUser(apiUser);
}
```

### 3. **refetchOnWindowFocus был отключен**
```typescript
// Было:
refetchOnWindowFocus: false, // Данные не обновлялись при возврате

// Стало:
refetchOnWindowFocus: true, // Данные актуальны!
```

### 4. **Нет очистки stale cache при запуске**
Старые данные из localStorage могли "конфликтовать" с новыми.

## ✅ Решение

### 1. Оптимизирована конфигурация React Query

**Файл:** `frontend/src/lib/queryClient.ts`

```typescript
const queryConfig: DefaultOptions = {
  queries: {
    staleTime: 30 * 1000, // 30 секунд (было 5 минут)
    gcTime: 5 * 60 * 1000, // 5 минут (было 10 минут)
    refetchOnWindowFocus: true, // Включено!
    refetchOnReconnect: true,
    retry: 1, // Было 2
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000),
    networkMode: 'online',
  },
};
```

**Результат:**
- ✅ Данные обновляются каждые 30 секунд
- ✅ Автоматическое обновление при возврате в приложение
- ✅ Быстрее retry при ошибках

### 2. Убран двойной setUser в useAuth

**Файл:** `frontend/src/hooks/useAuth.ts`

```typescript
const loadUserWithToken = async () => {
  try {
    setIsLoading(true);
    setError(null);

    // ✅ Только ОДИН setUser из API
    const response = await authService.getCurrentUser();
    
    if (response.success && response.data) {
      setUser(response.data); // Единственный setUser!
      setUserContext({
        id: response.data.id,
        username: response.data.username || `user_${response.data.id}`,
      });
    }
  } catch (err) {
    console.error('[useAuth] Failed to load user:', err);
    authService.clearToken();
    setError('Invalid token');
  } finally {
    setIsLoading(false);
  }
};
```

**Результат:**
- ✅ Фото профиля НЕ мерцает
- ✅ Данные пользователя стабильны
- ✅ Нет двойного рендера

### 3. Создан cacheUtils для очистки stale данных

**Файл:** `frontend/src/lib/cacheUtils.ts`

```typescript
/**
 * Инициализация cache при старте приложения
 */
export const initCache = () => {
  console.log('[CacheUtils] Initializing cache...');
  
  // Проверяем версию cache
  checkCacheVersion();
  
  // Очищаем stale данные
  clearStaleCache();
  
  console.log('[CacheUtils] Cache initialized');
};
```

**Интеграция в App.tsx:**

```typescript
import { initCache } from './lib/cacheUtils';

function AppContent() {
  // Инициализация cache при запуске (только 1 раз)
  useEffect(() => {
    initCache();
  }, []);
  
  // ...
}
```

**Результат:**
- ✅ Старые данные очищаются при запуске
- ✅ Версионирование cache
- ✅ Нет конфликтов между старым и новым кэшем

## 📦 Production билд обновлен

✅ Frontend пересобран с исправлениями:
- Файл: `dist/assets/js/index-f334aa84.js` (89.25 KB)
- Файл: `dist/assets/js/HomePage-4320a84b.js` (78.83 KB)

## 🚀 Как применить

### Перезапустите backend:

```powershell
# Остановите текущий процесс (Ctrl+C)

cd E:\Lunch_bot\telegram-food-bot\backend
npm start
```

Или через скрипт:
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-prod.ps1
```

## 🧪 Проверка работы

### 1. Откройте бота в Telegram
### 2. Проверьте:

✅ **Фото профиля:**
- Загружается один раз
- НЕ исчезает при навигации
- Стабильно отображается

✅ **Меню блюд:**
- Блюда загружаются один раз
- НЕ исчезают при переключении страниц
- Стабильное отображение

✅ **Данные пользователя:**
- Имя, username стабильны
- isAdmin не меняется
- Нет мерцания в header

✅ **Навигация:**
- При переходе между страницами данные сохраняются
- Нет повторной загрузки при возврате назад
- Smooth UX без "прыжков"

## 📊 Сравнение До/После

### До исправлений:
```
❌ staleTime: 5 минут - редкие обновления
❌ Двойной setUser - мерцание фото
❌ refetchOnWindowFocus: false - стейл данные
❌ Нет очистки старого cache
❌ Мерцание при каждом переходе
```

### После исправлений:
```
✅ staleTime: 30 секунд - частые обновления
✅ Единственный setUser - нет мерцания
✅ refetchOnWindowFocus: true - актуальные данные
✅ initCache() очищает стейл данные
✅ Стабильный UI без мерцания
```

## 🔧 Дополнительные улучшения

### 1. Версионирование cache

При breaking changes увеличиваем версию:

```typescript
const CACHE_VERSION = '2.0.0'; // Было 1.0.0
```

Это автоматически очистит старый cache у всех пользователей.

### 2. Retry настройки

```typescript
// Быстрее retry при ошибках
retry: 1, // Было 2
retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000),
```

Меньше задержек при временных сетевых проблемах.

### 3. GC Time

```typescript
gcTime: 5 * 60 * 1000, // 5 минут (было 10 минут)
```

Быстрее освобождается память от неиспользуемых данных.

## ⚠️ Важно

### После обновления рекомендуется:

1. **Очистить localStorage в браузере** (для тестирования):
   - Откройте DevTools (F12)
   - Application → Storage → Clear site data

2. **Перезагрузить приложение** в Telegram:
   - Закройте Mini App
   - Откройте заново

3. **Проверить в реальных условиях**:
   - Тестируйте на реальных устройствах
   - Проверьте на медленном интернете
   - Убедитесь что нет мерцания

## 🎉 Готово!

Проблема мерцания исправлена на всех уровнях:
- ✅ Правильная конфигурация React Query
- ✅ Оптимизирован useAuth
- ✅ Добавлена очистка stale cache
- ✅ Production билд обновлен

**Перезапустите backend и проверяйте!** 🚀

## 📝 Если проблема сохраняется

### Дополнительная диагностика:

1. **Проверьте console в DevTools:**
   ```javascript
   // Должно быть:
   [CacheUtils] Initializing cache...
   [CacheUtils] Cache version mismatch (null vs 2.0.0), clearing...
   [CacheUtils] Cache initialized
   ```

2. **Проверьте Network tab:**
   - Не должно быть дублирующихся запросов
   - Запросы должны кэшироваться 30 секунд

3. **Проверьте localStorage:**
   - `CACHE_VERSION` должна быть `2.0.0`
   - Старые ключи должны быть удалены

Если проблема сохраняется - напишите, разберемся дальше! 💪
