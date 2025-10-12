# 🐛 Руководство по отладке приложения

## 📋 Содержание
1. [Включение Debug режима](#включение-debug-режима)
2. [Автоматические тесты](#автоматические-тесты)
3. [Проверка состояния](#проверка-состояния)
4. [Частые проблемы](#частые-проблемы)
5. [Логирование Backend](#логирование-backend)

---

## 🔍 Включение Debug режима

### Вариант 1: Через Console браузера

**Откройте DevTools (F12) → Console и выполните:**

```javascript
// Включить debug режим
__enableDebug()

// Выключить debug режим
__disableDebug()
```

После выполнения страница перезагрузится автоматически.

### Вариант 2: Через localStorage

```javascript
// Включить
localStorage.setItem('debug', 'true');
location.reload();

// Выключить
localStorage.removeItem('debug');
location.reload();
```

### Что дает Debug режим?

**Подробное логирование:**
- 📡 Все API запросы и ответы
- 🗳️ Состояние polls с детализацией
- 🔍 Фильтрация menu items (до/после)
- 💾 Операции с кэшем
- ⚠️ Ошибки с полным контекстом
- ⏱️ Время выполнения операций

**Пример вывода:**
```
API GET /api/polls/active
  Request Data: { ... }
  Time: 2025-10-12T18:00:00.000Z

POLL Loaded
  Poll ID: 92
  Status: ACTIVE
  selectedMenuItemIds: [131,135]
  Parsed IDs: [131, 135]
  Full Poll: { ... }

FILTER InlineVotingCard
  Before filtering: 4 items
  After filtering: 2 items
  Selected IDs: [131, 135]
  Reduction: 50.0%
```

---

## 🧪 Автоматические тесты

### Запуск всех тестов:

```bash
cd backend
npm run test:flow
```

### Что тестируется:

✅ **TEST 1: Database Connection**
- Подключение к БД
- Наличие polls
- Наличие активных menu items

✅ **TEST 2: Active Poll**
- Проверка активного голосования
- Корректность `selectedMenuItemIds`
- Существование выбранных items

✅ **TEST 3: Menu Items Filtering**
- Логика фильтрации
- Соответствие результата ожиданиям

✅ **TEST 4: Poll Creation Flow**
- Создание poll с selectedMenuItemIds
- Сохранение в БД
- Загрузка после сохранения

✅ **TEST 5: Completed Polls History**
- Наличие завершенных polls
- Сохранение selectedMenuItemIds

### Результат тестов:

```
📊 TEST SUMMARY
Total tests: 9
✅ Passed: 9
❌ Failed: 0
Success rate: 100.0%

✅ All tests passed! 🎉
```

---

## 🔎 Проверка состояния

### Проверка текущего состояния приложения:

Откройте Console (F12) и выполните:

```javascript
// 1. Проверка пользователя
console.log('User:', localStorage.getItem('telegram_user'));

// 2. Проверка активного poll
console.log('Active poll:', window.__activePoll);

// 3. Проверка токена
console.log('Token:', localStorage.getItem('auth_token'));

// 4. Проверка кэша React Query
console.log('Query cache:', window.__queryClient?.getQueryCache());
```

### Принудительная очистка:

```javascript
// Очистить всё
localStorage.clear();
sessionStorage.clear();
location.reload();

// Очистить только кэш React Query
window.__queryClient?.clear();
```

---

## ⚠️ Частые проблемы

### Проблема 1: Показываются все menu items вместо выбранных

**Симптомы:**
- Выбрали 2 блюда при создании poll
- Отображаются все 4 блюда
- После перезагрузки (Ctrl+Shift+R) показываются правильные 2

**Причина:** Устаревшие данные в кэше React Query

**Решение:**

1. **Проверьте что `selectedMenuItemIds` сохраняется:**
```javascript
// В Console после создания poll
fetch('/api/polls/92')
  .then(r => r.json())
  .then(data => console.log('selectedMenuItemIds:', data.data.selectedMenuItemIds))
```

2. **Очистите кэш:**
```javascript
window.__queryClient?.invalidateQueries({ queryKey: ['polls', 'active'] });
```

3. **Если не помогает, жесткая перезагрузка:**
```
Ctrl + Shift + R  (Windows)
Cmd + Shift + R   (Mac)
```

### Проблема 2: Кнопка "Повторить вчерашнее" не работает

**Диагностика:**

1. **Включите debug режим:**
```javascript
__enableDebug()
```

2. **Нажмите кнопку и проверьте Console:**

Должны увидеть:
```
🔄 [handleRepeatYesterday] Функция вызвана
🔄 [handleRepeatYesterday] Запрос последнего poll...
```

3. **Проверьте backend логи:**

Должны увидеть:
```
2025-10-12 21:00:00 [info]: GET /api/polls/last-completed
2025-10-12 21:00:00 [info]: POST /api/polls/repeat/86
```

**Если запросов нет:**
- Проверьте что backend запущен
- Проверьте что вы админ: `localStorage.getItem('telegram_user')`
- Проверьте что нет активного голосования

### Проблема 3: Нужна перезагрузка чтобы увидеть изменения

**Причина:** Агрессивное кэширование

**Решение:**

1. **Отключите кэш в DevTools:**
   - F12 → Network → ✅ Disable cache

2. **Очистите кэш приложения:**
   - F12 → Application → Clear site data → Clear

3. **Проверьте Service Worker:**
   - F12 → Application → Service Workers
   - Если есть активный → Unregister

---

## 📊 Логирование Backend

### Уровни логирования:

Backend логирует в консоль и файлы:
- `backend/logs/combined.log` - все логи
- `backend/logs/error.log` - только ошибки

### Полезные паттерны в логах:

**Успешный запрос:**
```
[info]: API Request {"method":"GET","url":"/active","statusCode":200}
```

**Ошибка:**
```
[error]: Error creating poll: Failed to validate data
```

**SQL запросы:** (только если включен DEBUG)
```
[debug]: Prisma Query: {"query":"SELECT ... FROM polls"}
```

### Поиск проблем в логах:

```bash
# Поиск ошибок
cat backend/logs/combined.log | grep "\[error\]"

# Поиск по endpoint
cat backend/logs/combined.log | grep "/api/polls/repeat"

# Последние 50 строк
tail -n 50 backend/logs/combined.log
```

---

## 🛠️ Инструменты отладки

### В Console доступны:

```javascript
// Debug утилиты
__debug              // Debug logger
__enableDebug()      // Включить debug режим
__disableDebug()     // Выключить debug режим

// React Query
__queryClient        // Query client для работы с кэшем
```

### Примеры использования:

```javascript
// Логирование API запроса
__debug.api('GET', '/api/polls/active', { groupId: 1 });

// Логирование poll
__debug.poll('Loaded', pollData);

// Логирование фильтрации
__debug.filter('InlineVotingCard', 4, 2, [131, 135]);

// Измерение времени
__debug.time('Load poll');
// ... код ...
__debug.timeEnd('Load poll');
```

---

## 📝 Чеклист для диагностики

Когда что-то работает не так:

- [ ] Запущен ли backend? (`npm run dev`)
- [ ] Включен ли debug режим? (`__enableDebug()`)
- [ ] Очищен ли кэш браузера? (F12 → Application → Clear site data)
- [ ] Проверены логи backend? (`backend/logs/combined.log`)
- [ ] Запущены автотесты? (`npm run test:flow`)
- [ ] Проверена Console на ошибки? (F12 → Console)
- [ ] Сделана жесткая перезагрузка? (`Ctrl+Shift+R`)

---

## 💡 Полезные команды

```bash
# Backend
cd backend
npm run dev              # Запустить сервер
npm run build            # Собрать
npm run test:flow        # Запустить тесты
npm run check-polls      # Проверить polls
npm run list-users       # Список пользователей
npm run make-admin 555   # Сделать админом

# Frontend
cd frontend
npm run dev              # Dev сервер
npm run build            # Собрать для production

# База данных
cd backend
npx prisma studio        # Открыть GUI для БД
```

---

## 🚨 Экстренная диагностика

Если ничего не помогает:

1. **Полная очистка:**
```javascript
// В Console:
localStorage.clear();
sessionStorage.clear();
caches.keys().then(names => names.forEach(name => caches.delete(name)));
location.reload();
```

2. **Проверка БД:**
```bash
cd backend
npm run test:flow
```

3. **Проверка токена:**
```javascript
fetch('/api/auth/me', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
  }
}).then(r => r.json()).then(console.log)
```

4. **Если всё еще не работает:**
- Проверьте `.env` файлы (backend и frontend)
- Перезапустите backend
- Сделайте Hard Refresh (`Ctrl+Shift+R`)
- Откройте в инкогнито режиме

---

## 📞 Поддержка

Если проблема не решается:

1. Включите debug режим (`__enableDebug()`)
2. Воспроизведите проблему
3. Скопируйте логи из Console
4. Скопируйте последние 100 строк из `backend/logs/combined.log`
5. Запустите `npm run test:flow` и скопируйте результат
6. Опишите что делали перед проблемой

---

**Последнее обновление:** 12 октября 2025
