# 💰 Адаптивный виджет бюджет-трекера - Готово к тестированию

## ✅ Реализовано

### Backend API (E:\Lunch_bot\telegram-food-bot\backend\src\api)
```
✅ budget.controller.ts    - 6 контроллеров
✅ budget.routes.ts        - роутинг с auth middleware  
✅ server.ts               - регистрация /api/budget/*
```

**Endpoints:**
- `GET  /api/budget/debts?userId={id}&status={status}` 
- `GET  /api/budget/credits?userId={id}&status={status}`
- `POST /api/budget/mark-paid` (body: {transactionId})
- `POST /api/budget/confirm-payment` (body: {transactionId})
- `POST /api/budget/cancel-mark` (body: {transactionId})
- `GET  /api/budget/stats?userId={id}&from={date}&to={date}`

### Backend Service (E:\Lunch_bot\telegram-food-bot\backend\src\services)
```
✅ budget.service.ts       - добавлены методы getUserDebts, getUserCredits, getUserStats, cancelMarkAsPaid
✅ responsible.service.ts  - уже было (выбор ответственного)
✅ poll.service.ts         - интеграция с ResponsibleService
```

### Frontend Components (E:\Lunch_bot\telegram-food-bot\frontend\src\components\budget)
```
✅ BudgetWidget.tsx                  - главный адаптивный виджет
✅ UrgentDebtView.tsx                - сценарий 1: срочный долг
✅ WaitingConfirmationView.tsx       - сценарий 2: ожидание
✅ SuccessMessageView.tsx            - сценарий 3: успех с конфетти
✅ ResponsibleView.tsx               - сценарий 5: я ответственный
✅ OverviewView.tsx                  - сценарий 4: обзор всех финансов
✅ index.ts                          - экспорты
```

### Frontend Services & Hooks (E:\Lunch_bot\telegram-food-bot\frontend\src)
```
✅ services/budget.service.ts        - API client для бюджета
✅ hooks/useBudgetWidget.ts          - логика определения сценария
✅ hooks/useWindowSize.ts            - для анимации конфетти
```

### Интеграция
```
✅ HomePage.tsx                      - виджет добавлен перед "Быстрыми действиями"
✅ react-confetti                    - установлена библиотека для анимации
```

---

## 🎭 6 сценариев виджета

### 1️⃣ Urgent Debt (Срочный долг) 🔥
**Триггер:** Голосование завершено <5 минут + есть долг  
**Внешний вид:**
- 🎨 Gradient: coral→red
- 🔥 Badge "НОВОЕ"
- 💳 Пульсирующий border

**Показывает:**
```
💸 Ваш долг по голосованию
━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ТОЛЬКО ЧТО ЗАВЕРШЕНО

🍽️ Ваш заказ: Паста Карбонара
💰 К оплате: 380₽
👤 Ответственный: Алексей Иванов

💳 Реквизиты для оплаты:
┌─────────────────────────┐
│ 💳 Карта: **** 1234     │
│ 📱 Телефон: +7 900...   │
│ ℹ️  СБП по номеру        │
└─────────────────────────┘

[Оплатил(а) ✅] [Открыть СБП 💳]

⚡ Также:
• 2 старых долга (450₽)
• Вам должны: 600₽
[Все финансы →]
```

---

### 2️⃣ Waiting Confirmation (Ожидание) ⏳
**Триггер:** Долг помечен как PAID, ждем подтверждения  
**Внешний вид:**
- 🎨 Gradient: amber→yellow
- ⏳ Steady border

**Показывает:**
```
⏳ Ожидаем подтверждения
━━━━━━━━━━━━━━━━━━━━━━━━━
      ⏰
    (ждем)

✅ Вы отметили оплату

🍽️ Паста Карбонара — 380₽
👤 Алексей проверит платеж

⏱️ Отмечено 2 минуты назад

[Отменить отметку]

⚡ Другие финансы:
• 2 долга (450₽)
• Вам должны: 600₽
[Подробнее →]
```

---

### 3️⃣ Success Message (Успех) 🎉
**Триггер:** Платеж подтвержден (status=CONFIRMED)  
**Внешний вид:**
- 🎨 Gradient: mint→green
- 🎊 Конфетти анимация
- ⏱️ Auto-hide через 3 секунды

**Показывает:**
```
🎉 Оплата подтверждена!
━━━━━━━━━━━━━━━━━━━━━━━━━
    🎊
  ✨ ✨
 (bounce)

  ✨ СПАСИБО! ✨

✅ Алексей получил(а) 380₽
🍽️ Паста Карбонара

(Исчезнет через несколько секунд...)
```

---

### 4️⃣ Overview (Обзор) 💰
**Триггер:** Нет текущего голосования ИЛИ прошло >5 минут  
**Внешний вид:**
- 🎨 Gradient: yellow→amber
- 📊 Компактные списки

**Показывает:**
```
💰 Финансы
━━━━━━━━━━━━━━━━━━━━━━━━━
💸 Мои долги: 830₽
┌─────────────────────────┐
│ 🍝 Паста — 380₽        │
│ → Алексей Иванов       │
│ 📅 вчера, 13:00        │
│ [Оплатил(а) ✅]        │
├─────────────────────────┤
│ 🍕 Пицца — 450₽        │
│ → Мария Петрова        │
│ 📅 2 дня назад         │
│ [Оплатил(а) ✅]        │
└─────────────────────────┘
+ еще 1 долг

💰 Мне должны: 600₽
┌─────────────────────────┐
│ 👤 Иван — 600₽        │
│ ⏰ Ожидается [🔔]      │
└─────────────────────────┘

[Подробная статистика →]
```

---

### 5️⃣ Responsible View (Я ответственный) 👑
**Триггер:** Пользователь - ответственный + <5 минут  
**Внешний вид:**
- 🎨 Gradient: lavender→purple
- 👑 Badge
- 💎 High intensity glass

**Показывает:**
```
🎯 Вы - ответственный
━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Вы оплатили: 1280₽
🍽️ Ваша доля: 450₽
💵 Вернут вам: 830₽

💳 Ожидаются переводы:
┌─────────────────────────┐
│ 👤 Мария — 380₽       │
│ ⏰ Ожидается           │
├─────────────────────────┤
│ 👤 Иван — 450₽        │
│ ✅ Оплачено            │
│ [Подтвердить ✅] [❌]  │
└─────────────────────────┘

[Напомнить 🔔] [Все оплатили ✅]

⚡ Другие финансы: ...
[Подробнее →]
```

---

### 6️⃣ Hidden (Скрыт)
**Триггер:** Нет долгов И нет кредитов  
**Действие:** Виджет полностью скрыт

---

## 🔄 Lifecycle (Жизненный цикл)

```
Голосование завершено
    ↓
ResponsibleService выбирает ответственного
    ↓
BudgetService создает Transactions (PENDING)
    ↓
[0-5 мин] Виджет = Сценарий 1 (Urgent Debt)
    ↓
Пользователь: "Оплатил(а) ✅"
    ↓
Transaction.status = PAID
    ↓
Виджет = Сценарий 2 (Waiting Confirmation)
    ↓
Ответственный: "Подтвердить ✅"
    ↓
Transaction.status = CONFIRMED
    ↓
Виджет = Сценарий 3 (Success Message) - 3 сек
    ↓
[>5 мин] Виджет = Сценарий 4 (Overview)
    или
[Нет долгов] Виджет = Сценарий 6 (Hidden)
```

---

## 🧪 Как протестировать

### 1. Запустить dev окружение

```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-dev.ps1
```

Откроется 5 окон:
- Окно #1: Backend (3001)
- Окно #2: Frontend (5173)
- Окно #3: Proxy (8080)
- Окно #4: ngrok
- Окно #5: URL updater

### 2. Настроить ngrok

1. Скопировать URL из окна #4 (ngrok)
2. Вставить в окно #5 (URL updater)
3. Дождаться "✅ Updated successfully"

### 3. Открыть Mini App

1. Telegram → @rocket_lunch_bot
2. Menu → Mini App
3. Откроется главная страница

### 4. Создать тестовое голосование

**В группе:**
```
/startpoll
```

Или через Mini App (если админ):
- Нажать "Создать голосование"
- Выбрать блюда
- Установить время (5 минут для быстрого теста)

### 5. Проголосовать

**Вариант A:** Через Mini App
- Нажать "Проголосовать" в группе
- Откроется личный чат с ботом
- Нажать кнопку Mini App
- Выбрать блюда

**Вариант B:** Через команды
```
/vote
```

### 6. Дождаться завершения

После истечения времени:
- ✅ Автоматически выбирается ответственный (волонтер или рулетка)
- ✅ Создаются транзакции
- ✅ Отправляются уведомления

### 7. Проверить виджет

На главной странице Mini App:

**Если вы НЕ ответственный:**
- Должен появиться виджет **Сценарий 1** (Urgent Debt)
- С реквизитами ответственного
- С кнопками оплаты

**Если вы ответственный:**
- Должен появиться виджет **Сценарий 5** (Responsible View)
- Со списком кто должен
- С кнопками подтверждения

### 8. Протестировать flow

1. **Нажать "Оплатил(а) ✅"**
   - Виджет → Сценарий 2 (Waiting)
   - Toast: "Оплата отмечена!"

2. **Ответственный подтверждает**
   - Виджет → Сценарий 3 (Success) с конфетти
   - Toast: "Платеж подтвержден!"
   - Auto-hide через 3 сек

3. **После 5 минут**
   - Виджет → Сценарий 4 (Overview)
   - Показывает все долги/кредиты

4. **Если нет долгов**
   - Виджет → Сценарий 6 (Hidden)
   - Полностью скрыт

---

## 🐛 Troubleshooting

### Виджет не появляется

**Проверьте:**
1. Голосование завершено?
2. Есть долги у пользователя?
3. Backend работает? `http://localhost:3001/health`
4. Проверьте консоль браузера (F12)

**Debug:**
```javascript
// В консоли браузера:
localStorage.clear()
location.reload()
```

### Кнопки не работают

**Проверьте:**
1. API endpoints доступны?
2. Аутентификация работает?
3. Проверьте Network tab в DevTools

**Test API:**
```bash
curl http://localhost:3001/api/budget/debts?userId=1
```

### Анимации не работают

**Проверьте:**
1. react-confetti установлен?
   ```bash
   cd frontend
   npm list react-confetti
   ```
2. useWindowSize хук работает?
3. framer-motion установлен?

### Виджет не обновляется

**React Query cache:**
```javascript
// Invalidate queries manually
queryClient.invalidateQueries({ queryKey: ['budget'] })
```

---

## 📊 API Testing

### Получить долги

```bash
# Request
GET http://localhost:3001/api/budget/debts?userId=1

# Response
[
  {
    "id": 1,
    "amount": 380,
    "status": "PENDING",
    "menuItem": { "name": "Паста Карбонара" },
    "toUser": {
      "firstName": "Алексей",
      "paymentCard": "1234567890123456",
      "paymentPhone": "+79001234567"
    }
  }
]
```

### Пометить как оплаченное

```bash
# Request
POST http://localhost:3001/api/budget/mark-paid
Content-Type: application/json

{
  "transactionId": 1
}

# Response
{
  "success": true
}
```

### Подтвердить платеж

```bash
# Request
POST http://localhost:3001/api/budget/confirm-payment
Content-Type: application/json

{
  "transactionId": 1
}

# Response
{
  "success": true
}
```

---

## 🎨 Кастомизация

### Изменить время показа срочного долга

```typescript
// frontend/src/hooks/useBudgetWidget.ts
const pollJustCompleted = useMemo(() => {
  // Изменить с 5 на другое значение (в минутах)
  return minutesSinceEnd <= 5; // ← здесь
}, [activePoll]);
```

### Изменить время auto-hide для success

```typescript
// frontend/src/components/budget/BudgetWidget.tsx
useEffect(() => {
  if (scenario === 'success-message') {
    const timer = setTimeout(() => {
      // Изменить с 3000 на другое (в мс)
      // ...
    }, 3000); // ← здесь
  }
}, [scenario]);
```

### Изменить цвета виджета

```typescript
// frontend/src/components/budget/BudgetWidget.tsx
const scenarioStyles = {
  'urgent-debt': {
    gradientClass: 'bg-gradient-to-br from-coral-50 to-red-50', // ← здесь
    borderClass: 'border-2 border-coral-500 animate-pulse',
    // ...
  },
  // ...
}
```

---

## ✅ Checklist тестирования

- [ ] Виджет появляется при завершении голосования
- [ ] Показываются правильные реквизиты ответственного
- [ ] Кнопка "Оплатил(а)" работает
- [ ] Виджет переключается на "Ожидание"
- [ ] Ответственный видит кнопки подтверждения
- [ ] Подтверждение работает
- [ ] Показывается success с конфетти
- [ ] Auto-hide через 3 секунды
- [ ] После 5 минут переход в Overview
- [ ] Overview показывает все долги/кредиты
- [ ] Виджет скрывается когда нет долгов
- [ ] Кнопка "Открыть СБП" работает
- [ ] Кнопка "Отменить отметку" работает
- [ ] Анимации плавные
- [ ] Все тосты показываются
- [ ] Haptic feedback работает (на mobile)

---

## 📝 Следующие шаги

### Обязательно:
- [ ] Протестировать все 6 сценариев
- [ ] Проверить на mobile устройствах
- [ ] Проверить haptic feedback
- [ ] Убедиться что уведомления приходят в Telegram

### Опционально:
- [ ] Создать `/budget` страницу с полным списком
- [ ] Добавить `/budget/stats` с графиками
- [ ] Реализовать ReminderService
- [ ] Добавить систему споров
- [ ] Добавить экспорт истории транзакций

---

## 🎉 Готово!

Адаптивный виджет бюджет-трекера полностью реализован и готов к тестированию!

**Время разработки:** ~5 часов  
**Статус:** ✅ Backend compiled, ✅ Frontend built  
**Компонентов:** 6 view-компонентов + 1 главный виджет  
**API endpoints:** 6 endpoints  
**Анимации:** Framer Motion + Confetti  

Запускайте `.\start-dev.ps1` и тестируйте! 🚀
