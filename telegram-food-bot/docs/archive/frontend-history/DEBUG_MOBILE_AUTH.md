# 🐛 ОТЛАДКА АВТОРИЗАЦИИ НА МОБИЛЬНОМ

**Дата:** 2025-01-05  
**Проблема:** "Ошибка Авторизации" на мобильном телефоне

---

## 🔍 ШАГ 1: ПРОВЕРКА НАСТРОЕК

### 1.1 Проверьте `.env` файл:

```bash
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
cat .env | grep VITE_USE_MOCK_API
```

**Должно быть:**
```env
VITE_USE_MOCK_API=true
```

### 1.2 Перезапустите dev server:

```bash
# Остановите текущий сервер (Ctrl+C)
npm run dev
```

**Ожидаемый вывод:**
```
✓ VITE v4.5.14  ready in 256 ms
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.X.X:5173/
```

---

## 📱 ШАГ 2: ОТКРОЙТЕ НА ТЕЛЕФОНЕ

### 2.1 Узнайте ваш IP:

**Windows:**
```bash
ipconfig
```
Найдите: `IPv4 Address: 192.168.X.X`

### 2.2 Откройте в браузере телефона:

```
http://192.168.X.X:8080/
```

---

## 🔧 ШАГ 3: ОТКРОЙТЕ КОНСОЛЬ НА ТЕЛЕФОНЕ

### Android Chrome:
1. Подключите телефон к ПК через USB
2. На ПК откройте Chrome
3. Перейдите: `chrome://inspect/#devices`
4. Найдите ваше устройство и нажмите "Inspect"

### iOS Safari:
1. На iPhone: Настройки → Safari → Дополнения → Веб-инспектор (вкл)
2. На Mac: Safari → Разработка → [Ваш iPhone] → [Страница]

### Альтернатива (без USB):
1. На телефоне откройте: `http://192.168.X.X:8080/`
2. В адресной строке добавьте: `javascript:alert(localStorage.getItem('debug-logs'))`

---

## 📋 ШАГ 4: ПРОВЕРЬТЕ ЛОГИ

### В консоли должны быть логи:

#### ✅ ПРАВИЛЬНО (MOCK работает):
```
[useAuth] Auth check: {
  isReady: true,
  hasInitData: false,
  initDataLength: 0,
  hasTgUser: false,
  useMockApi: true
}
[useAuth] MOCK MODE - using mock authentication
[useAuth] Mock authentication successful
```

#### ❌ ОШИБКА (MOCK не включен):
```
[useAuth] Auth check: {
  isReady: true,
  hasInitData: false,
  initDataLength: 0,
  hasTgUser: false,
  useMockApi: false  ← ПРОБЛЕМА!
}
[useAuth] No valid initData - attempting fallback authentication
[useAuth] Fallback auth error: No Telegram data available
```

---

## 🛠️ ШАГ 5: ИСПРАВЛЕНИЕ ПРОБЛЕМ

### Проблема 1: `useMockApi: false` в логах

**Причина:** `.env` не обновился или сервер не перезапущен

**Решение:**
```bash
# 1. Остановите dev server (Ctrl+C)
# 2. Очистите кэш
rm -rf node_modules/.vite

# 3. Проверьте .env
cat .env | grep VITE_USE_MOCK_API
# Должно быть: VITE_USE_MOCK_API=true

# 4. Перезапустите
npm run dev
```

---

### Проблема 2: "Ошибка Авторизации" все еще есть

**Причина:** Старая версия страницы в кэше

**Решение на телефоне:**
1. Откройте настройки браузера
2. Очистите кэш и данные сайта
3. Перезагрузите страницу (Ctrl+Shift+R или Command+Shift+R)

---

### Проблема 3: Консоль не открывается на телефоне

**Решение:** Используйте встроенный logger

**Добавьте в код временно:**
```typescript
// В src/hooks/useAuth.ts после строки 43
alert(JSON.stringify({
  isReady,
  hasInitData: !!initData,
  initDataLength: initData?.length || 0,
  hasTgUser: !!tgUser,
  useMockApi,
}));
```

Или используйте:
```typescript
// Показать ошибку как popup
if (error) {
  window.Telegram?.WebApp?.showAlert?.(error);
}
```

---

## 🧪 ШАГ 6: АЛЬТЕРНАТИВНЫЙ ТЕСТ

### Тест без мобильного телефона:

1. **Откройте на ПК:**
```
http://localhost:5173/
```

2. **Откройте DevTools (F12)**

3. **Включите Mobile mode:**
   - Chrome: Device Toolbar (Ctrl+Shift+M)
   - Firefox: Responsive Design Mode (Ctrl+Shift+M)

4. **Проверьте консоль:**
   - Должны увидеть: `[useAuth] MOCK MODE - using mock authentication`

---

## 📊 ШАГ 7: ФИНАЛЬНАЯ ПРОВЕРКА

### Checklist:

- [ ] `.env` содержит `VITE_USE_MOCK_API=true`
- [ ] Dev server перезапущен после изменения .env
- [ ] На телефоне очищен кэш браузера
- [ ] В консоли видно `[useAuth] MOCK MODE`
- [ ] В консоли видно `[useAuth] Mock authentication successful`
- [ ] Страница загружается без ошибок
- [ ] MenuPage показывает блюда
- [ ] StatsPage показывает статистику

---

## 💡 БЫСТРОЕ РЕШЕНИЕ

Если все еще не работает, попробуйте **hard reset**:

```bash
# 1. Остановите все процессы
# Ctrl+C в терминале с dev server

# 2. Очистите все кэши
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
rm -rf node_modules/.vite
rm -rf dist

# 3. Убедитесь что .env правильный
echo "VITE_USE_MOCK_API=true" >> .env

# 4. Перезапустите
npm run dev

# 5. На телефоне:
# - Закройте браузер полностью
# - Очистите кэш приложения браузера
# - Откройте заново http://YOUR_IP:8080/
```

---

## 🚨 ЕСЛИ НИЧЕГО НЕ ПОМОГЛО

### Последняя проверка - вручную вставьте код:

1. **Откройте `src/hooks/useAuth.ts`**

2. **Найдите строку 36 (начало useEffect)**

3. **Замените весь useEffect на:**

```typescript
useEffect(() => {
  // ПРИНУДИТЕЛЬНЫЙ MOCK РЕЖИМ
  console.log('[useAuth] FORCE MOCK MODE ACTIVATED');
  
  const mockUser: User = {
    id: 1,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Тест',
    lastName: 'Пользователь',
    isAdmin: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  setUser(mockUser);
  setIsLoading(false);
  setError(null);
  console.log('[useAuth] Force mock user set');
}, []);
```

4. **Сохраните файл**

5. **Dev server автоматически перезагрузится**

6. **Откройте на телефоне**

Это **100% должно работать**, потому что мы игнорируем все проверки.

---

## 📞 ОБРАТНАЯ СВЯЗЬ

Если это все еще не работает, пришлите:

1. **Скриншот консоли с телефона** (или текст ошибки)
2. **Содержимое `.env` файла**
3. **Вывод команды:** `npm run dev`
4. **IP адрес который вы используете**

---

**Статус:** 🔧 DEBUGGING MODE  
**Автор:** Droid (Factory AI)  
**Версия:** 1.0.0  
**Дата:** 2025-01-05
