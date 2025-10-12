# ⚡ Быстрая диагностика

> Минимальный чеклист для быстрой проверки работы приложения

## 🚀 За 30 секунд

### 1. Включите Debug режим
```javascript
// В Console (F12):
__enableDebug()
```

### 2. Запустите автотесты
```bash
cd backend
npm run test:flow
```

**Ожидаемый результат:**
```
✅ Passed: 9
❌ Failed: 0
Success rate: 100.0%
```

### 3. Проверьте активное голосование
```javascript
// В Console:
fetch('/api/polls/active')
  .then(r => r.json())
  .then(data => {
    console.log('Active polls:', data.data.length);
    if (data.data[0]) {
      console.log('selectedMenuItemIds:', data.data[0].selectedMenuItemIds);
    }
  })
```

---

## 🔴 Если что-то сломалось

### Вариант 1: Полная перезагрузка (5 сек)
```javascript
// В Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Вариант 2: Только кэш (2 сек)
```
Ctrl + Shift + R  (Windows)
Cmd + Shift + R   (Mac)
```

### Вариант 3: Проверка backend (10 сек)
```bash
# Остановить (Ctrl+C)
cd backend
npm run dev
```

---

## 📊 Быстрые проверки

| Проверка | Команда | Ожидаемый результат |
|----------|---------|---------------------|
| **Backend работает?** | `netstat -ano \| findstr "3001"` | Должна быть строка с LISTENING |
| **Polls есть?** | `npm run check-polls` | Список polls |
| **Я админ?** | `console.log(JSON.parse(localStorage.telegram_user).isAdmin)` | `true` |
| **Токен валиден?** | `fetch('/api/auth/me', {headers: {'Authorization': 'Bearer ' + localStorage.auth_token}}).then(r => r.json())` | `{success: true}` |

---

## 🐛 Частые проблемы (1 минута на fix)

### Проблема: Показываются все items вместо выбранных
```javascript
// Fix:
window.__queryClient?.invalidateQueries();
location.reload();
```

### Проблема: Кнопка не работает
```javascript
// Проверка 1: Админ ли я?
JSON.parse(localStorage.telegram_user).isAdmin
// Должно быть: true

// Проверка 2: Есть ли активный poll?
fetch('/api/polls/active').then(r => r.json()).then(d => console.log(d.data.length))
// Должно быть: 0 (нет активных)

// Проверка 3: Есть ли завершенные?
fetch('/api/polls/last-completed').then(r => r.json()).then(d => console.log(d.data))
// Должен вернуть poll
```

### Проблема: Backend не отвечает
```bash
# Перезапуск:
cd backend
# Ctrl+C
npm run dev
```

---

## 📱 Мобильная отладка

Если проблема только на телефоне:

1. **Подключите к Chrome DevTools:**
   - Chrome → `chrome://inspect`
   - Найдите своё устройство
   - Нажмите Inspect

2. **Включите debug:**
```javascript
__enableDebug()
```

3. **Проверьте логи:**
   - Смотрите Console в Chrome DevTools

---

## 🎯 Полная диагностика

Подробное руководство: [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md)

---

**TL;DR:**
1. `__enableDebug()` в Console
2. `npm run test:flow` в backend
3. `Ctrl+Shift+R` для жёсткой перезагрузки
