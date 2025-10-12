# 🛠️ Инструменты для отладки и тестирования

## 📦 Что было добавлено

### 1. **Debug Logger** (`frontend/src/utils/debugLogger.ts`)

Утилита для подробного логирования с красивым форматированием:

```typescript
import { debugLogger } from '@/utils/debugLogger';

// API запросы
debugLogger.api('GET', '/api/polls/active', { groupId: 1 });

// Состояние polls
debugLogger.poll('Loaded', pollData);

// Фильтрация
debugLogger.filter('InlineVotingCard', 4, 2, [131, 135]);

// Ошибки с контекстом
debugLogger.error('Component', error, { context: 'data' });
```

**Включение:**
```javascript
// В Console браузера:
__enableDebug()  // Включить
__disableDebug() // Выключить
```

### 2. **Автотесты** (`backend/test-app-flow.js`)

Проверяет весь flow приложения:

✅ Database Connection  
✅ Active Poll with selectedMenuItemIds  
✅ Menu Items Filtering Logic  
✅ Poll Creation Flow  
✅ Completed Polls History  

**Запуск:**
```bash
cd backend
npm run test:flow
```

**Результат:**
```
📊 TEST SUMMARY
Total tests: 9
✅ Passed: 9
❌ Failed: 0
Success rate: 100.0%
```

### 3. **Документация**

**`DEBUGGING_GUIDE.md`** - Полное руководство:
- Включение debug режима
- Автоматические тесты
- Проверка состояния
- Частые проблемы и решения
- Логирование backend
- Инструменты отладки
- Чеклист диагностики

**`QUICK_DEBUG.md`** - Быстрая справка:
- Диагностика за 30 секунд
- Частые проблемы (1 минута на fix)
- Быстрые проверки
- Мобильная отладка

---

## 🚀 Быстрый старт

### Включить подробное логирование:

```javascript
// В Console (F12):
__enableDebug()
```

Теперь вы увидите детальные логи всех операций.

### Запустить автотесты:

```bash
cd backend
npm run test:flow
```

Проверяет корректность работы всего функционала.

### При проблемах:

```javascript
// Полная очистка кэша:
localStorage.clear();
sessionStorage.clear();
location.reload();

// Или жёсткая перезагрузка:
// Ctrl + Shift + R
```

---

## 💡 Примеры использования

### Диагностика фильтрации menu items:

```javascript
// 1. Включите debug
__enableDebug()

// 2. Создайте poll с выбором 2 из 4 items
// В консоли вы увидите:

FILTER InlineVotingCard
  Before filtering: 4 items
  After filtering: 2 items  
  Selected IDs: [131, 135]
  Reduction: 50.0%
```

### Проверка что API возвращает:

```javascript
__enableDebug()

// При любом API запросе вы увидите:
API GET /api/polls/active
  Response: {success: true, data: [...]}
  Duration: 45ms
```

### Отладка создания poll:

```javascript
__enableDebug()

// При создании poll:
POLL Created
  Poll ID: 94
  selectedMenuItemIds: [131,132]
  Parsed IDs: [131, 132]

CACHE Invalidated
  Key: polls.active
```

---

## 📊 Результаты тестирования

Все тесты успешно пройдены ✅

```
============================================================
📊 TEST SUMMARY
============================================================

Total tests: 9
✅ Passed: 9
❌ Failed: 0
Success rate: 100.0%

✅ All tests passed! 🎉

============================================================
```

**Что проверяется:**

1. ✅ Database подключается корректно
2. ✅ Active polls загружаются с selectedMenuItemIds
3. ✅ Фильтрация menu items работает правильно
4. ✅ Poll создаётся и сохраняется с selectedMenuItemIds
5. ✅ selectedMenuItemIds сохраняется после reload
6. ✅ Completed polls содержат selectedMenuItemIds
7. ✅ Все menu items существуют и активны
8. ✅ Парсинг JSON selectedMenuItemIds работает
9. ✅ Cleanup test данных работает

---

## 🎯 Основные возможности

### Debug Logger:

- 📡 **API логирование** - все запросы/ответы с timing
- 🗳️ **Poll состояние** - детальная информация о polls
- 🔍 **Фильтрация** - до/после с процентами
- 💾 **Кэш операции** - invalidation, set, get
- ⚠️ **Ошибки** - с полным контекстом и stack trace
- ⏱️ **Timing** - измерение времени выполнения
- 🎨 **Красивый вывод** - цветовое кодирование

### Автотесты:

- 🔄 **Автоматическая проверка** всего flow
- 📊 **Детальные отчёты** с процентами
- ✅ **Проверка данных** в БД
- 🧪 **Тест фильтрации** menu items
- 🆕 **Тест создания** polls
- ♻️ **Cleanup** - автоматическая очистка test данных

### Документация:

- 📖 **Полное руководство** - DEBUGGING_GUIDE.md
- ⚡ **Быстрая справка** - QUICK_DEBUG.md
- 📋 **Чеклисты** - для диагностики проблем
- 💡 **Примеры** - реальные сценарии использования
- 🚨 **Экстренная помощь** - когда всё сломалось

---

## 🔧 Доступные команды

```bash
# Backend
npm run test:flow        # Запустить автотесты
npm run check-polls      # Проверить polls в БД
npm run list-users       # Список пользователей
npm run make-admin 555   # Сделать админом

# Frontend Console
__enableDebug()          # Включить debug режим
__disableDebug()         # Выключить debug режим
__debug                  # Доступ к logger API
```

---

## 📝 Следующие шаги

После добавления инструментов отладки:

1. **При разработке:**
   - Всегда включайте debug режим
   - Проверяйте логи в Console
   - Запускайте тесты после изменений

2. **При проблемах:**
   - Включите debug режим
   - Воспроизведите проблему
   - Скопируйте логи
   - Запустите автотесты

3. **Перед коммитом:**
   - Запустите `npm run test:flow`
   - Убедитесь что все тесты проходят
   - Проверьте что debug режим выключен в production

---

## 📞 Поддержка

Полная документация:
- 📖 [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) - Детальное руководство
- ⚡ [QUICK_DEBUG.md](./QUICK_DEBUG.md) - Быстрая справка

**Последнее обновление:** 12 октября 2025  
**Версия:** 1.0.0  
**Статус:** ✅ Все тесты пройдены
