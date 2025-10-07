# 🔍 Руководство по сбору логов для отладки

## 📱 Frontend логи (iPhone / Telegram WebApp)

### Способ 1: Debug Logger (Самый простой ⭐)

1. **Откройте приложение** в Telegram на iPhone
2. **Кнопка 🐛 в правом верхнем углу** - откройте Debug Logger
3. **Или тройной тап** в любом месте экрана
4. **Скопируйте все логи**:
   - Сделайте скриншот всей панели
   - Или используйте кнопку "Clear" чтобы очистить старые логи перед тестом

### Что искать в логах:

#### ✅ Успешное создание голосования:
```
🔍 Checking active poll for group 1...
✅ No active poll - can create new one
📤 [PollsService] Creating poll from WebApp: {
  "groupId": 1,
  "duration": 30,
  "selectedMenuItems": [132, 133, 131],
  "title": "Голосование за обед"
}
🌐 [API] POST /polls/create-from-webapp
✅ [API] POST /polls/create-from-webapp success
📥 [PollsService] Create poll response: {
  "success": true,
  "hasData": true
}
```

#### ❌ Ошибка - активное голосование:
```
🔍 Checking active poll for group 1...
⚠️ Active poll found: {...}
📤 [PollsService] Creating poll from WebApp: {...}
🌐 [API] POST /polls/create-from-webapp
❌ [API] POST /polls/create-from-webapp failed {
  "success": false,
  "error": "Group already has an active poll",
  "code": "POLL_ALREADY_ACTIVE",
  "status": 400
}
```

#### 📡 Проверка активного голосования:
```
📡 [PollsService] Checking active poll for group 1
🌐 [API] GET /polls/active/1
✅ [API] GET /polls/active/1 success
📥 [PollsService] Active poll response: {
  "success": true,
  "hasData": true,
  "pollId": 123
}
```

---

## 🖥️ Backend логи

### Где найти логи:

```bash
C:\BOT_V2\telegram-food-bot\backend\logs\
```

Файлы:
- `combined-YYYY-MM-DD.log` - все логи
- `error-YYYY-MM-DD.log` - только ошибки

### Просмотр логов в реальном времени:

**PowerShell:**
```powershell
# Все логи
Get-Content C:\BOT_V2\telegram-food-bot\backend\logs\combined-*.log -Tail 50 -Wait

# Только ошибки
Get-Content C:\BOT_V2\telegram-food-bot\backend\logs\error-*.log -Tail 50 -Wait

# Последние 100 строк
Get-Content C:\BOT_V2\telegram-food-bot\backend\logs\combined-*.log -Tail 100
```

**CMD:**
```cmd
cd C:\BOT_V2\telegram-food-bot\backend\logs
type combined-*.log
```

### Что искать в backend логах:

#### ✅ Успешная проверка активного голосования:
```
2025-10-06 16:56:38 [info]: 🚀 START createPollFromWebApp
2025-10-06 16:56:38 [info]: Creating poll from WebApp {"groupId":1,"duration":30,"selectedMenuItems":[132,133,131],"title":"Голосование за обед","userId":1}
2025-10-06 16:56:38 [info]: 📊 After initial logging, before validation
2025-10-06 16:56:38 [debug]: Prisma Query: SELECT ... FROM groups WHERE id = 1
2025-10-06 16:56:38 [debug]: Cache MISS: active_polls_group_1
2025-10-06 16:56:38 [info]: ✅ Checked existing poll {"exists":false}
2025-10-06 16:56:38 [info]: 🍽️ About to load menu items...
2025-10-06 16:56:38 [info]: ✅ Poll created successfully {"pollId":123}
```

#### ❌ Ошибка - активное голосование:
```
2025-10-06 16:56:38 [info]: ✅ Checked existing poll {"exists":true}
2025-10-06 16:56:38 [warn]: ❌ Group already has active poll
2025-10-06 16:56:38 [info]: API Request {"method":"POST","url":"/create-from-webapp","statusCode":400,"duration":"3ms"}
```

#### 🗄️ Проблемы с базой данных:
```
2025-10-06 16:56:38 [error]: ❌ Database error: {...}
```

---

## 🛠️ Как собрать полную информацию об ошибке

### Шаг 1: Очистите логи
```javascript
// На iPhone в Debug Logger нажмите "Clear"
```

### Шаг 2: Воспроизведите ошибку
1. Откройте страницу где происходит ошибка
2. Выполните действие которое вызывает ошибку
3. Дождитесь завершения (успех или ошибка)

### Шаг 3: Соберите Frontend логи
1. Откройте Debug Logger (🐛 или тройной тап)
2. Сделайте **скриншот ВСЕХ логов**
3. Или скопируйте текст если возможно

### Шаг 4: Соберите Backend логи
```powershell
# Последние 200 строк из всех логов
Get-Content C:\BOT_V2\telegram-food-bot\backend\logs\combined-*.log -Tail 200 > C:\BOT_V2\backend_logs.txt

# Все ошибки за сегодня
Get-Content C:\BOT_V2\telegram-food-bot\backend\logs\error-*.log > C:\BOT_V2\backend_errors.txt
```

### Шаг 5: Отправьте информацию

Отправьте:
1. ✅ **Скриншот Debug Logger** с iPhone
2. ✅ **Файл backend_logs.txt** (последние 200 строк)
3. ✅ **Описание что делали** когда произошла ошибка
4. ✅ **Время когда произошло** (для поиска в логах)

---

## 📊 Уровни логирования

### Frontend (Console):
- `🌐 [API]` - HTTP запросы
- `📤 [PollsService]` - Отправка данных
- `📥 [PollsService]` - Получение ответов
- `📡 [PollsService]` - Проверки состояния
- `🔍` - Проверка активного голосования
- `✅` - Успешные операции
- `❌` - Ошибки
- `⚠️` - Предупреждения

### Backend (Winston):
- `[info]` - Информация о работе
- `[debug]` - Детальная отладка (SQL запросы, кэш)
- `[warn]` - Предупреждения
- `[error]` - Ошибки

---

## 🔎 Поиск конкретных проблем

### Проблема: "Не могу создать голосование"
**Ищите в логах:**
```
Frontend:
- 📤 [PollsService] Creating poll
- 🌐 [API] POST /polls/create-from-webapp
- ❌ [API] POST ... failed

Backend:
- 🚀 START createPollFromWebApp
- ❌ Group already has active poll
или
- ❌ FAILED to load menu items
```

### Проблема: "Ошибка авторизации"
**Ищите в логах:**
```
Frontend:
- [useAuth] 🔄 Login with fallback
- [useAuth] ✅ Login successful
или
- [useAuth] ❌ Login failed

Backend:
- ✅ telegramAuthMiddleware: SKIP mode
- ✅ User authenticated
```

### Проблема: "Не загружается меню"
**Ищите в логах:**
```
Frontend:
- 🌐 [API] GET /menu
- ❌ [API] GET /menu failed

Backend:
- Prisma Query: SELECT ... FROM menu_items
- ❌ Database error
```

---

## 🚨 Критические ошибки

Если видите такие ошибки - сразу отправляйте:

### Frontend:
```
❌ [API] POST /polls/create-from-webapp failed {
  "status": 500,
  "error": "Internal Server Error"
}
```

### Backend:
```
[error]: ❌ Database connection failed
[error]: ❌ Unhandled exception
[error]: ❌ Bot token invalid
```

---

## 💡 Советы

1. **Всегда очищайте логи** перед воспроизведением ошибки
2. **Не закрывайте Debug Logger** пока не скопировали логи
3. **Записывайте время** когда произошла ошибка
4. **Делайте скриншоты** - проще чем копировать текст
5. **Backend логи** - последние 100-200 строк обычно достаточно

---

## 📞 Что отправлять для помощи

### Минимум:
- ✅ Скриншот Debug Logger
- ✅ Описание проблемы
- ✅ Что вы делали

### Идеально:
- ✅ Скриншот Debug Logger (Frontend)
- ✅ Backend логи (последние 200 строк)
- ✅ Описание шагов для воспроизведения
- ✅ Время когда произошло
- ✅ Скриншот экрана где видна ошибка

Готово! Теперь у вас есть вся информация для эффективной отладки! 🎉
