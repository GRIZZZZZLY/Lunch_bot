# 🧪 Тестирование виджета бюджета на реальных данных

## 📋 Подготовка

### 1. Проверьте базу данных

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
npm run db:studio
```

Откроется Prisma Studio. Проверьте наличие:
- Users (должны быть реальные пользователи из Telegram)
- MenuItem (должны быть блюда с ценами)
- Group (ваша тестовая группа)

### 2. Убедитесь что у пользователей есть реквизиты

В Prisma Studio → Users → выберите пользователя:
- Добавьте `paymentCard` (например: "1234567890123456")
- Добавьте `paymentPhone` (например: "+79001234567")
- Добавьте `paymentDetails` (например: "СБП по номеру телефона")

**Важно:** Заполните реквизиты для пользователя, который будет **ответственным**!

## 🚀 Создание реального голосования

### Вариант A: Через Mini App (рекомендуется)

1. **Запустите dev окружение**
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-dev.ps1
```

2. **Настройте ngrok**
   - Скопируйте URL из окна #4
   - Вставьте в окно #5 (URL updater)
   - Дождитесь "✅ Updated successfully"

3. **Откройте Mini App**
   - Telegram → @rocket_lunch_bot
   - Нажмите Menu → Mini App
   - Перейдите на HomePage

4. **Создайте голосование**
   - Нажмите "Создать голосование" (если вы админ)
   - Выберите 2-3 блюда **с ценами**
   - Установите длительность: **1-2 минуты** (для быстрого теста)
   - Нажмите "Создать"

5. **Проголосуйте (минимум 2 человека)**
   
   **Способ 1: Через Mini App**
   - Нажмите "Проголосовать" в группе
   - Откроется личный чат с ботом
   - Нажмите кнопку Mini App
   - Выберите блюдо
   - Нажмите "Отправить голос"

   **Способ 2: Через команды (если Mini App не работает)**
   ```
   /vote
   ```
   - Выберите блюдо из inline клавиатуры

6. **Дождитесь завершения**
   - После истечения времени голосование автоматически закроется
   - Бот выберет ответственного (рулетка или волонтёр)
   - Создадутся транзакции
   - Отправятся уведомления с реквизитами

### Вариант B: Через команды в группе

1. **В группе с ботом:**
```
/startpoll
```

2. **Проголосуйте:**
```
/vote
```

3. **Закройте голосование (только админы):**
```
/closepoll
```

## 🔍 Проверка виджета

### Шаг 1: Откройте Mini App

Telegram → @rocket_lunch_bot → Menu → Mini App

### Шаг 2: Проверьте сценарии

#### Если вы НЕ ответственный (сценарий 1: Urgent Debt)

**Должно появиться:**
```
💸 Ваш долг по голосованию
━━━━━━━━━━━━━━━━━━━━━━━━━
✨ ТОЛЬКО ЧТО ЗАВЕРШЕНО

🍽️ Ваш заказ: [название блюда]
💰 К оплате: [сумма]₽
👤 Ответственный: [имя]

💳 Реквизиты для оплаты:
┌─────────────────────────┐
│ 💳 Карта: **** 1234     │
│ 📱 Телефон: +7 900...   │
│ ℹ️  [детали]            │
└─────────────────────────┘

[Оплатил(а) ✅] [Открыть СБП 💳]
```

**Проверьте:**
- ✅ Виджет появился на HomePage
- ✅ Показывается правильная сумма
- ✅ Показываются реквизиты ответственного
- ✅ Кнопки "Оплатил(а)" и "Открыть СБП" видны
- ✅ Badge "НОВОЕ" есть
- ✅ Красный gradient и пульсирующий border

**Тестируем кнопки:**

1. **Нажмите "Оплатил(а) ✅"**
   - Должен показаться toast: "Оплата отмечена! Ожидаем подтверждения"
   - Виджет изменится на сценарий 2 (Waiting)
   - В Telegram ответственному должно прийти уведомление

2. **Виджет должен измениться:**
```
⏳ Ожидаем подтверждения
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Вы отметили оплату
🍽️ [блюдо] — [сумма]₽
👤 [ответственный] проверит платеж
⏱️ Отмечено [время] назад
[Отменить отметку]
```

3. **Нажмите "Отменить отметку"** (опционально)
   - Виджет вернётся в сценарий 1
   - Toast: "Отметка отменена"

#### Если вы ОТВЕТСТВЕННЫЙ (сценарий 5: Responsible View)

**Должно появиться:**
```
🎯 Вы - ответственный
━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Вы оплатили: [общая сумма]₽
🍽️ Ваша доля: [ваша доля]₽
💵 Вернут вам: [разница]₽

💳 Ожидаются переводы:
┌─────────────────────────┐
│ 👤 [имя] — [сумма]₽    │
│ ⏰ Ожидается            │
│ [Подтвердить ✅] [❌]   │
└─────────────────────────┘

[Напомнить 🔔] [Все оплатили ✅]
```

**Проверьте:**
- ✅ Виджет появился
- ✅ Показана общая сумма, ваша доля, сумма к возврату
- ✅ Список должников с кнопками подтверждения
- ✅ Фиолетовый gradient

**Тестируем подтверждение:**

1. **Другой пользователь отметил оплату**
   - В списке должна появиться кнопка "Подтвердить ✅"
   - Статус изменится на "✅ Оплачено"

2. **Нажмите "Подтвердить ✅"**
   - Toast: "Платеж подтвержден!"
   - Плательщику придёт уведомление в Telegram
   - У плательщика виджет покажет сценарий 3 (Success)

3. **Когда все оплатили:**
   - Нажмите "Все оплатили ✅"
   - Придёт итоговое уведомление со списком всех платежей

## 📊 Проверка API напрямую

### 1. Получить долги пользователя

```bash
curl "http://localhost:3001/api/budget/debts?userId=1"
```

**Ожидаемый ответ:**
```json
[
  {
    "id": 1,
    "amount": 380,
    "status": "PENDING",
    "createdAt": "2025-10-25T12:00:00.000Z",
    "menuItem": {
      "id": 5,
      "name": "Паста Карбонара",
      "price": 380
    },
    "toUser": {
      "id": 2,
      "firstName": "Алексей",
      "paymentCard": "1234567890123456",
      "paymentPhone": "+79001234567",
      "paymentDetails": "СБП по номеру телефона"
    },
    "poll": {
      "id": 10,
      "status": "COMPLETED",
      "endedAt": "2025-10-25T12:00:00.000Z"
    }
  }
]
```

### 2. Получить кредиты (кто вам должен)

```bash
curl "http://localhost:3001/api/budget/credits?userId=2"
```

### 3. Отметить как оплаченное

```bash
curl -X POST http://localhost:3001/api/budget/mark-paid \
  -H "Content-Type: application/json" \
  -d '{"transactionId": 1}'
```

### 4. Подтвердить платеж

```bash
curl -X POST http://localhost:3001/api/budget/confirm-payment \
  -H "Content-Type: application/json" \
  -d '{"transactionId": 1}'
```

### 5. Получить статистику

```bash
curl "http://localhost:3001/api/budget/stats?userId=1"
```

**Ожидаемый ответ:**
```json
{
  "totalSpent": 830,
  "totalReceived": 0,
  "balance": -830,
  "averagePerOrder": 415,
  "timesResponsible": 2,
  "totalOrders": 5,
  "confirmedOrders": 3,
  "pendingOrders": 2,
  "topDishes": [
    {
      "name": "Паста Карбонара",
      "count": 3,
      "total": 1140
    }
  ]
}
```

## 🔍 Проверка в базе данных

### 1. Откройте Prisma Studio

```powershell
cd E:\Lunch_bot\telegram-food-bot\backend
npm run db:studio
```

### 2. Проверьте таблицы

**Polls:**
- Найдите последнее голосование
- Проверьте `status = "COMPLETED"`
- Проверьте `endedAt` не null

**PollResults:**
- Должна быть запись с `pollId` вашего голосования
- `responsibleUserId` должен быть заполнен
- `rouletteData` содержит JSON с результатами

**ResponsibleSelection:**
- Должна быть запись с `pollId`
- `selectedUserId` - кто ответственный
- `status = "COMPLETED"`

**Transactions:**
- Должны быть записи для каждого участника
- `fromUserId` - кто должен
- `toUserId` - ответственный
- `amount` - сумма
- `status` - PENDING/PAID/CONFIRMED
- `menuItemId` - что заказал

### 3. Пример SQL запросов

**Все транзакции последнего голосования:**
```sql
SELECT 
  t.id,
  t.amount,
  t.status,
  fromUser.firstName as debtor,
  toUser.firstName as creditor,
  m.name as dish
FROM transactions t
JOIN users fromUser ON t.fromUserId = fromUser.id
JOIN users toUser ON t.toUserId = toUser.id
LEFT JOIN menu_items m ON t.menuItemId = m.id
WHERE t.pollId = (SELECT id FROM polls ORDER BY id DESC LIMIT 1)
ORDER BY t.id;
```

## 🐛 Troubleshooting

### Виджет не появляется

**Причины:**
1. Голосование ещё не завершено
2. У пользователя нет долгов
3. Прошло >5 минут после завершения (должен быть сценарий 4)
4. Виджет скрыт (сценарий 6) - нет долгов и кредитов

**Проверка:**
```javascript
// В консоли браузера:
fetch('http://localhost:3001/api/budget/debts?userId=1')
  .then(r => r.json())
  .then(console.log)
```

### Реквизиты не показываются

**Причина:** У ответственного не заполнены реквизиты

**Решение:**
1. Откройте Prisma Studio
2. Users → найдите ответственного
3. Заполните:
   - `paymentCard`
   - `paymentPhone`
   - `paymentDetails`
4. Сохраните

### Кнопки не работают

**Причина:** API не отвечает или ошибка аутентификации

**Проверка:**
1. Откройте DevTools (F12)
2. Вкладка Network
3. Нажмите кнопку
4. Найдите запрос к `/api/budget/*`
5. Проверьте статус и ответ

### Уведомления не приходят в Telegram

**Причина:** Bot instance не инициализирован

**Проверка логов backend:**
```powershell
# В окне #1 (Backend)
# Должно быть: "BudgetService bot instance initialized"
```

**Решение:**
```powershell
# Перезапустите backend
cd E:\Lunch_bot\telegram-food-bot\backend
npm run dev
```

## 📝 Чек-лист тестирования

### Базовый flow (НЕ ответственный)

- [ ] Создать голосование с блюдами (с ценами)
- [ ] Проголосовать (минимум 2 человека)
- [ ] Дождаться завершения
- [ ] Виджет появился (сценарий 1)
- [ ] Реквизиты ответственного видны
- [ ] Кнопка "Оплатил(а)" работает
- [ ] Виджет перешёл в сценарий 2 (Waiting)
- [ ] Ответственный получил уведомление в Telegram
- [ ] Ответственный подтвердил платеж
- [ ] Виджет перешёл в сценарий 3 (Success)
- [ ] Показалось конфетти
- [ ] Виджет исчез через 3 секунды
- [ ] После 5 минут виджет в сценарии 4 (Overview)

### Расширенный flow (Ответственный)

- [ ] Создать голосование
- [ ] Проголосовать
- [ ] Стать ответственным (рулетка/волонтёр)
- [ ] Виджет показал сценарий 5 (Responsible)
- [ ] Видны суммы: общая, моя доля, к возврату
- [ ] Виден список должников
- [ ] Получены уведомления от плательщиков в Telegram
- [ ] Кнопка "Подтвердить" работает
- [ ] Плательщик получил уведомление о подтверждении
- [ ] Кнопка "Напомнить" работает (опционально)
- [ ] Кнопка "Все оплатили" работает
- [ ] Получено итоговое уведомление

### API тестирование

- [ ] GET /api/budget/debts возвращает данные
- [ ] GET /api/budget/credits возвращает данные
- [ ] POST /api/budget/mark-paid работает
- [ ] POST /api/budget/confirm-payment работает
- [ ] POST /api/budget/cancel-mark работает
- [ ] GET /api/budget/stats возвращает статистику

### UI/UX

- [ ] Анимации плавные (framer-motion)
- [ ] Конфетти работает
- [ ] Haptic feedback есть (на mobile)
- [ ] Toast уведомления показываются
- [ ] Цвета соответствуют сценариям
- [ ] Badge "НОВОЕ" показывается
- [ ] Текст читается на светлой и тёмной теме
- [ ] Responsive на mobile

## 🎯 Готовые тестовые данные

Если хотите протестировать быстро, используйте скрипт для создания тестовых данных:

### Создать тестовое завершённое голосование

```typescript
// backend/src/scripts/create-test-poll.ts
import { PollService } from '../services/poll.service';
import { BudgetService } from '../services/budget.service';
import { ResponsibleService } from '../services/responsible.service';
import { prisma } from '../database/client';

async function createTestPoll() {
  // 1. Создать голосование
  const poll = await prisma.poll.create({
    data: {
      groupId: 1, // Ваша группа
      status: 'COMPLETED',
      duration: 30,
      createdBy: 1, // Ваш user id
      endedAt: new Date(),
      selectedMenuItemIds: JSON.stringify([1, 2, 3]) // ID блюд с ценами
    }
  });

  // 2. Создать голоса
  await prisma.vote.createMany({
    data: [
      { pollId: poll.id, userId: 1, menuItemId: 1 },
      { pollId: poll.id, userId: 2, menuItemId: 2 },
      { pollId: poll.id, userId: 3, menuItemId: 3 }
    ]
  });

  // 3. Создать результат
  const rouletteData = {
    winners: [
      { 
        menuItemId: 1, 
        menuItemName: 'Паста Карбонара',
        menuItemSnapshot: { price: 380 },
        voteCount: 1,
        voters: [{ userId: 1, firstName: 'Вы' }]
      },
      {
        menuItemId: 2,
        menuItemName: 'Пицца Маргарита',
        menuItemSnapshot: { price: 450 },
        voteCount: 1,
        voters: [{ userId: 2, firstName: 'Алексей' }]
      }
    ],
    bringOwn: { count: 0, voters: [] }
  };

  await prisma.pollResult.create({
    data: {
      pollId: poll.id,
      responsibleUserId: 2, // Алексей ответственный
      totalVotes: 2,
      rouletteData: JSON.stringify(rouletteData)
    }
  });

  // 4. Создать выбор ответственного
  await prisma.responsibleSelection.create({
    data: {
      pollId: poll.id,
      mode: 'ROULETTE',
      status: 'COMPLETED',
      selectedUserId: 2,
      rouletteWinnerId: 2,
      completedAt: new Date()
    }
  });

  // 5. Создать транзакции
  await BudgetService.processResponsibleSelected(poll.id, 2);

  console.log('✅ Test poll created:', poll.id);
}

createTestPoll().catch(console.error);
```

**Запуск:**
```powershell
cd backend
npx tsx src/scripts/create-test-poll.ts
```

## 🎉 Готово!

После прохождения всех шагов у вас будет:
- ✅ Реальное завершённое голосование
- ✅ Транзакции с реальными суммами
- ✅ Виджет работает на реальных данных
- ✅ Все сценарии протестированы

Если есть проблемы - проверьте логи backend и browser console!
