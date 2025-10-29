# 🎯 ИТОГОВЫЙ FLOW: От голосования до получения денег

## 📌 Интеграция с существующей системой

### ✅ Что уже реализовано и будет использоваться:

#### 1. **Платежные реквизиты в профиле** (Frontend + Backend)
**Где:** `ProfilePage.tsx`, `user.service.ts` (backend/frontend)

**Поля:**
- `paymentCard` - номер карты (с маскированием `userService.maskCardNumber()`)
- `paymentPhone` - телефон для СБП/звонков
- `paymentDetails` - доп. информация (комментарий к переводу)

**API:**
- `GET /api/user/payment-info` - получить реквизиты
- `PUT /api/user/payment-info` - обновить реквизиты

**Использование:**
```typescript
// Получаем реквизиты ответственного
const responsiblePaymentInfo = await UserService.getPaymentInfo(responsibleUserId);

// Отправляем участникам
const message = `
💳 РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ:
${responsiblePaymentInfo.paymentCard ? `Карта: ${maskCardNumber(responsiblePaymentInfo.paymentCard)}` : ''}
${responsiblePaymentInfo.paymentPhone ? `📱 ${responsiblePaymentInfo.paymentPhone}` : ''}
${responsiblePaymentInfo.paymentDetails ? `ℹ️ ${responsiblePaymentInfo.paymentDetails}` : ''}
`;
```

#### 2. **Multi-winner голосование**
**Где:** `PollService.completePollMultiWinner()`

**Что делает:**
- Группирует участников по выбранным блюдам
- Создает PollResult с данными в `rouletteData` (JSON)
- Отправляет уведомления о результатах

**Структура rouletteData:**
```json
{
  "version": 1,
  "mode": "multi-winner",
  "winners": [
    {
      "menuItemId": 1,
      "menuItemName": "Пицца Маргарита",
      "menuItemSnapshot": { "price": 450, "category": "..." },
      "voters": [
        { "userId": 2, "firstName": "Алексей" },
        { "userId": 5, "firstName": "Иван" }
      ],
      "voteCount": 2
    }
  ],
  "bringOwn": { "voters": [...], "count": 1 },
  "skipped": { "voters": [...], "count": 0 }
}
```

#### 3. **Рулетка для выбора ответственного**
**Где:** `RouletteService`, `PollService.runRoulette()`

**Использование:**
- Случайный выбор из массива голосовавших
- Обновление `PollResult.responsibleUserId`
- Уведомление ответственному через `notificationService.notifyResponsible()`

---

## 🔄 ПОЛНЫЙ FLOW (с точками интеграции)

### Фаза 1: Голосование
*(без изменений)*

```
1. Админ: /startpoll в группе
2. Бот → компактное сообщение с кнопкой "Проголосовать 🗳️"
3. Deep Link → личный чат → Mini App
4. Участники выбирают блюда
5. Счетчик обновляется в группе
```

---

### Фаза 2: Завершение голосования
*(текущая реализация)*

```typescript
// Вызывается при:
// - Истечении времени (startpoll.ts: autoCompletePoll)
// - Админ нажал "Завершить"
// - 100% явка (poll.handlers.ts: checkAutoComplete)

await PollService.completePollMultiWinner(pollId, userId, {
  minVotes: 1,
  tieBreakMethod: 'earliest'
});
```

**Что происходит:**
1. `Poll.status` → `'COMPLETED'`, `Poll.endedAt` → `NOW()`
2. Подсчет голосов, группировка по блюдам
3. Создание `PollResult` с multi-winner данными
4. Отправка уведомлений о результатах:
   ```typescript
   await notificationService.sendPollCompletionNotifications(pollId);
   ```
   - В личку каждому: "Кто что заказывает"
   - В группу: сводка результатов

---

### Фаза 3: Выбор ответственного 🚀 НОВОЕ

#### 🎯 ТОЧКА ИНТЕГРАЦИИ #1

**Где добавить:** `backend/src/services/poll.service.ts`

```typescript
// В конце метода completePollMultiWinner()
// ПОСЛЕ:
// return result;

// ДОБАВИТЬ:
// Запускаем выбор ответственного
const { ResponsibleService } = await import('./responsible.service.js');
await ResponsibleService.startResponsibleSelection(pollId);

return result;
```

#### Реализация ResponsibleService

**Файл:** `backend/src/services/responsible.service.ts` *(создать новый)*

```typescript
export class ResponsibleService {
  /**
   * Запуск процесса выбора ответственного
   */
  static async startResponsibleSelection(pollId: number): Promise<void> {
    const poll = await PollService.getPollById(pollId);
    const settings = await GroupService.getGroupSettings(poll.groupId);
    
    const mode = settings.responsibleSelectionMode || 'volunteer_with_fallback';
    
    // Создаем запись процесса
    const selection = await prisma.responsibleSelection.create({
      data: {
        pollId,
        mode,
        status: 'WAITING',
        timeoutAt: mode.includes('volunteer') 
          ? new Date(Date.now() + (settings.volunteerTimeoutMinutes || 3) * 60 * 1000)
          : null,
        chatId: poll.chatId,
      }
    });
    
    if (mode === 'roulette') {
      // Сразу рулетка
      await this.runRouletteAndProceed(pollId);
    } else {
      // Отправляем кнопку в группу
      await this.sendVolunteerPrompt(pollId, selection);
    }
  }
  
  /**
   * Отправка сообщения с кнопкой "Я оформлю!"
   */
  static async sendVolunteerPrompt(
    pollId: number, 
    selection: ResponsibleSelection
  ): Promise<void> {
    const poll = await PollService.getPollById(pollId);
    const resultData = JSON.parse(poll.result.rouletteData);
    
    // Рассчитываем общую сумму
    const totalAmount = resultData.winners.reduce((sum, w) => 
      sum + (w.menuItemSnapshot.price || 0) * w.voteCount, 0
    );
    
    const message = `
✅ *Голосование завершено!*

📊 *РЕЗУЛЬТАТЫ:*

${resultData.winners.map((w, i) => 
  `${i+1}. ${w.menuItemName} — ${w.voteCount} чел. (${(w.menuItemSnapshot.price || 0) * w.voteCount}₽)`
).join('\n')}

${resultData.bringOwn.count > 0 ? `\n🥪 Принесут своё — ${resultData.bringOwn.count} чел.` : ''}

💰 *Общая сумма: ${totalAmount}₽*
👥 *Участников: ${resultData.winners.reduce((sum, w) => sum + w.voteCount, 0)}*

🙋‍♂️ *Кто готов оформить заказ и оплатить?*

⏱️ Ожидание: ${selection.timeoutMinutes || 3} минуты
Если никто не откликнется, запустится рулетка.
`;

    const keyboard = {
      inline_keyboard: [[
        { text: '🙋‍♂️ Я оформлю!', callback_data: `volunteer:${pollId}` }
      ]]
    };
    
    const sentMessage = await botInstance.api.sendMessage(
      Number(poll.chatId),
      message,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
    
    // Сохраняем messageId
    await prisma.responsibleSelection.update({
      where: { id: selection.id },
      data: { messageId: sentMessage.message_id }
    });
    
    // Устанавливаем таймаут
    setTimeout(
      () => this.handleVolunteerTimeout(pollId), 
      (selection.timeoutMinutes || 3) * 60 * 1000
    );
  }
  
  /**
   * Обработка отклика добровольца
   */
  static async handleVolunteer(pollId: number, telegramId: number): Promise<void> {
    const selection = await prisma.responsibleSelection.findUnique({
      where: { pollId }
    });
    
    if (!selection || selection.status !== 'WAITING') {
      return; // Уже выбран
    }
    
    const user = await UserService.getUserByTelegramId(BigInt(telegramId));
    if (!user) return;
    
    // Обновляем selection
    await prisma.responsibleSelection.update({
      where: { id: selection.id },
      data: {
        status: 'VOLUNTEER_SELECTED',
        selectedUserId: user.id,
        volunteerUserId: user.id,
        completedAt: new Date()
      }
    });
    
    // Обновляем сообщение в группе
    if (selection.messageId && selection.chatId) {
      await botInstance.api.editMessageText(
        Number(selection.chatId),
        selection.messageId,
        `✅ *Голосование завершено!*\n\n🎯 *Ответственный:* ${user.firstName}\n\n💰 Детали заказа и реквизиты отправлены всем в личные сообщения.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // 🚀 ПЕРЕХОД К ФАЗЕ 4
    const { BudgetService } = await import('./budget.service.js');
    await BudgetService.processResponsibleSelected(pollId, user.id);
  }
  
  /**
   * Обработка таймаута (fallback на рулетку)
   */
  static async handleVolunteerTimeout(pollId: number): Promise<void> {
    const selection = await prisma.responsibleSelection.findUnique({
      where: { pollId }
    });
    
    if (!selection || selection.status !== 'WAITING') {
      return;
    }
    
    await prisma.responsibleSelection.update({
      where: { id: selection.id },
      data: { status: 'TIMEOUT' }
    });
    
    if (selection.messageId && selection.chatId) {
      await botInstance.api.editMessageText(
        Number(selection.chatId),
        selection.messageId,
        `⏰ *Время истекло!*\n\n🎲 Никто не откликнулся, запускаем рулетку...`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await this.runRouletteAndProceed(pollId);
  }
  
  /**
   * Запуск рулетки и переход к созданию транзакций
   */
  static async runRouletteAndProceed(pollId: number): Promise<void> {
    const rouletteService = new RouletteService();
    const result = await rouletteService.runRoulette(pollId);
    
    // Сохраняем результат (существующая логика)
    await PollService.savePollResult({
      pollId,
      winnerMenuItemId: result.winnerMenuItemId,
      responsibleUserId: result.responsibleUserId,
      totalVotes: result.totalVotes,
      rouletteData: JSON.stringify(result.animationData)
    });
    
    await prisma.responsibleSelection.update({
      where: { pollId },
      data: {
        status: 'ROULETTE_RUN',
        selectedUserId: result.responsibleUserId,
        rouletteWinnerId: result.responsibleUserId,
        completedAt: new Date()
      }
    });
    
    // 🚀 ПЕРЕХОД К ФАЗЕ 4
    const { BudgetService } = await import('./budget.service.js');
    await BudgetService.processResponsibleSelected(pollId, result.responsibleUserId);
  }
}
```

**Bot callback handler:** `backend/src/bot/bot.ts`

```typescript
bot.callbackQuery(/^volunteer:(\d+)$/, async (ctx) => {
  const pollId = parseInt(ctx.match[1]);
  await ResponsibleService.handleVolunteer(pollId, ctx.from.id);
  await ctx.answerCallbackQuery('✅ Спасибо! Вы выбраны ответственным');
});
```

---

### Фаза 4: Создание транзакций 🚀 НОВОЕ

#### 🎯 ТОЧКА ИНТЕГРАЦИИ #2

**Файл:** `backend/src/services/budget.service.ts` *(создать новый)*

```typescript
export class BudgetService {
  /**
   * Обработка выбранного ответственного
   */
  static async processResponsibleSelected(
    pollId: number, 
    responsibleUserId: number
  ): Promise<void> {
    
    // 1. Создаем транзакции
    const transactions = await this.createTransactionsFromPoll(
      pollId, 
      responsibleUserId
    );
    
    // 2. Отправляем уведомления с реквизитами
    await this.sendBudgetNotifications(pollId, responsibleUserId, transactions);
  }
  
  /**
   * Создание транзакций из голосования
   */
  static async createTransactionsFromPoll(
    pollId: number,
    responsibleUserId: number
  ): Promise<Transaction[]> {
    
    const poll = await PollService.getPollById(pollId);
    const resultData = JSON.parse(poll.result.rouletteData);
    
    const transactionsData: Prisma.TransactionCreateManyInput[] = [];
    
    // Для каждого winner создаем транзакции
    for (const winner of resultData.winners) {
      const price = winner.menuItemSnapshot.price || 0;
      
      for (const voter of winner.voters) {
        // Ответственный не платит себе
        if (voter.userId === responsibleUserId) continue;
        
        transactionsData.push({
          pollId,
          fromUserId: voter.userId,
          toUserId: responsibleUserId,
          amount: price,
          menuItemId: winner.menuItemId,
          status: 'PENDING',
        });
      }
    }
    
    if (transactionsData.length > 0) {
      await prisma.transaction.createMany({ data: transactionsData });
    }
    
    // Возвращаем с relations
    return await prisma.transaction.findMany({
      where: { pollId },
      include: {
        fromUser: true,
        toUser: true,
        menuItem: true
      }
    });
  }
  
  /**
   * Расчет итоговых сумм
   */
  static async calculateTotals(pollId: number, responsibleUserId: number) {
    const transactions = await prisma.transaction.findMany({
      where: { pollId, toUserId: responsibleUserId }
    });
    
    const totalToReturn = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    const poll = await PollService.getPollById(pollId);
    const resultData = JSON.parse(poll.result.rouletteData);
    
    const totalOrder = resultData.winners.reduce((sum, w) => 
      sum + (w.menuItemSnapshot.price || 0) * w.voteCount, 0
    );
    
    const responsibleItem = resultData.winners.find(w =>
      w.voters.some(v => v.userId === responsibleUserId)
    );
    const responsibleShare = responsibleItem?.menuItemSnapshot.price || 0;
    
    return {
      totalOrder,
      totalToReturn,
      responsibleShare,
      netCost: responsibleShare
    };
  }
}
```

---

### Фаза 5: Уведомления с реквизитами 🚀 НОВОЕ

#### 🎯 ТОЧКА ИНТЕГРАЦИИ #3 - Используем ProfilePage.paymentInfo

```typescript
// В BudgetService
static async sendBudgetNotifications(
  pollId: number,
  responsibleUserId: number,
  transactions: Transaction[]
): Promise<void> {
  
  // 1. Получить реквизиты ответственного ИЗ ПРОФИЛЯ
  const responsiblePaymentInfo = await UserService.getPaymentInfo(responsibleUserId);
  const responsible = await UserService.getUserById(responsibleUserId);
  
  // 2. Рассчитать итоги
  const totals = await this.calculateTotals(pollId, responsibleUserId);
  
  // 3. Отправить ответственному
  await this.sendResponsibleNotification(pollId, responsible, transactions, totals);
  
  // 4. Отправить участникам с реквизитами
  for (const tx of transactions) {
    await this.sendDebtNotification(tx, responsible, responsiblePaymentInfo);
  }
  
  // 5. Обновить группу
  await this.updateGroupMessage(pollId, responsible, totals);
}

/**
 * Уведомление участнику с реквизитами
 */
static async sendDebtNotification(
  transaction: Transaction,
  responsible: User,
  responsiblePaymentInfo: PaymentInfo
): Promise<void> {
  
  let message = `🍽️ *Результаты голосования*\n\n`;
  message += `Ваш заказ: ${transaction.menuItem.name}\n`;
  message += `💰 *Ваша сумма: ${transaction.amount}₽*\n\n`;
  message += `👤 *Ответственный:* ${responsible.firstName}`;
  if (responsible.lastName) message += ` ${responsible.lastName}`;
  message += `\n\n`;
  
  // 🔑 РЕКВИЗИТЫ ИЗ ПРОФИЛЯ (ProfilePage)
  message += `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ:*\n\n`;
  
  if (responsiblePaymentInfo.paymentCard) {
    const masked = userService.maskCardNumber(responsiblePaymentInfo.paymentCard);
    message += `💳 Карта: ${masked}\n`;
  }
  
  if (responsiblePaymentInfo.paymentPhone) {
    message += `📱 Телефон: ${responsiblePaymentInfo.paymentPhone} (СБП)\n`;
  }
  
  if (responsiblePaymentInfo.paymentDetails) {
    message += `ℹ️ ${responsiblePaymentInfo.paymentDetails}\n`;
  }
  
  message += `\n💬 Комментарий: Обед ${new Date().toLocaleDateString('ru')}\n`;
  message += `⏰ Заказ на 13:00`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Оплатил(а) ✅', callback_data: `budget:mark_paid:${transaction.id}` }],
      [{ text: 'Открыть СБП 💳', url: `https://qr.nspk.ru/...` }]
    ]
  };
  
  await botInstance.api.sendMessage(
    Number(transaction.fromUser.telegramId),
    message,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
}
```

---

### Фаза 6: Подтверждение оплаты 🚀 НОВОЕ

```typescript
// Bot callback handlers
bot.callbackQuery(/^budget:mark_paid:(\d+)$/, async (ctx) => {
  const txId = parseInt(ctx.match[1]);
  await BudgetService.markAsPaid(txId, ctx.from.id);
  await ctx.answerCallbackQuery('✅ Отмечено как оплачено');
});

bot.callbackQuery(/^budget:confirm:(\d+)$/, async (ctx) => {
  const txId = parseInt(ctx.match[1]);
  await BudgetService.confirmPayment(txId);
  await ctx.answerCallbackQuery('✅ Оплата подтверждена');
});

// BudgetService methods
static async markAsPaid(txId: number, telegramId: number) {
  const tx = await prisma.transaction.update({
    where: { id: txId },
    data: { status: 'PAID', paidAt: new Date() },
    include: { fromUser: true, toUser: true, menuItem: true }
  });
  
  // Уведомляем ответственного
  await botInstance.api.sendMessage(
    Number(tx.toUser.telegramId),
    `💳 *Получена оплата!*\n\n${tx.fromUser.firstName} оплатил(а) ${tx.amount}₽`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Подтвердить ✅', callback_data: `budget:confirm:${txId}` }
        ]]
      }
    }
  );
}

static async confirmPayment(txId: number) {
  const tx = await prisma.transaction.update({
    where: { id: txId },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
    include: { fromUser: true, toUser: true }
  });
  
  // Уведомляем участника
  await botInstance.api.sendMessage(
    Number(tx.fromUser.telegramId),
    `✅ *Оплата подтверждена!*\n\n${tx.toUser.firstName} подтвердил(а) получение ${tx.amount}₽\n\nСпасибо! 🎉`,
    { parse_mode: 'Markdown' }
  );
  
  // Проверяем, все ли оплатили
  await this.checkAllPaid(tx.pollId, tx.toUserId);
}
```

---

## 📊 Новые модели БД

**Файл:** `backend/prisma/schema.prisma`

```prisma
model Transaction {
  id              Int       @id @default(autoincrement())
  pollId          Int       @map("poll_id")
  fromUserId      Int       @map("from_user_id")
  toUserId        Int       @map("to_user_id")
  amount          Float
  menuItemId      Int?      @map("menu_item_id")
  status          String    @default("PENDING")
  paidAt          DateTime? @map("paid_at")
  confirmedAt     DateTime? @map("confirmed_at")
  disputedReason  String?   @map("disputed_reason")
  reminderCount   Int       @default(0) @map("reminder_count")
  lastReminderAt  DateTime? @map("last_reminder_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  
  poll            Poll      @relation(fields: [pollId], references: [id], onDelete: Cascade)
  fromUser        User      @relation("UserDebts", fields: [fromUserId], references: [id])
  toUser          User      @relation("UserCredits", fields: [toUserId], references: [id])
  menuItem        MenuItem? @relation(fields: [menuItemId], references: [id])
  reminders       PaymentReminder[]
  
  @@index([pollId])
  @@index([fromUserId, status])
  @@index([toUserId, status])
  @@map("transactions")
}

model ResponsibleSelection {
  id                  Int       @id @default(autoincrement())
  pollId              Int       @unique @map("poll_id")
  mode                String
  status              String    @default("WAITING")
  selectedUserId      Int?      @map("selected_user_id")
  volunteerUserId     Int?      @map("volunteer_user_id")
  rouletteWinnerId    Int?      @map("roulette_winner_id")
  timeoutAt           DateTime? @map("timeout_at")
  timeoutMinutes      Int       @default(3) @map("timeout_minutes")
  completedAt         DateTime? @map("completed_at")
  messageId           Int?      @map("message_id")
  chatId              BigInt?   @map("chat_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  
  poll                Poll      @relation(fields: [pollId], references: [id], onDelete: Cascade)
  selectedUser        User?     @relation("ResponsibleUser", fields: [selectedUserId], references: [id])
  volunteerUser       User?     @relation("VolunteerUser", fields: [volunteerUserId], references: [id])
  rouletteWinner      User?     @relation("RouletteWinner", fields: [rouletteWinnerId], references: [id])
  
  @@map("responsible_selections")
}

model PaymentReminder {
  id              Int       @id @default(autoincrement())
  transactionId   Int       @map("transaction_id")
  type            String    @default("AUTO")
  sentBy          Int?      @map("sent_by")
  message         String?
  sentAt          DateTime  @default(now()) @map("sent_at")
  
  transaction     Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  sender          User?       @relation(fields: [sentBy], references: [id])
  
  @@map("payment_reminders")
}

// Обновления в существующих моделях:
model User {
  // ... existing fields ...
  debts                   Transaction[]           @relation("UserDebts")
  credits                 Transaction[]           @relation("UserCredits")
  responsibleSelections   ResponsibleSelection[]  @relation("ResponsibleUser")
  volunteerSelections     ResponsibleSelection[]  @relation("VolunteerUser")
  rouletteWins            ResponsibleSelection[]  @relation("RouletteWinner")
  sentReminders           PaymentReminder[]
}

model Poll {
  // ... existing fields ...
  transactions          Transaction[]
  responsibleSelection  ResponsibleSelection?
}

model MenuItem {
  // ... existing fields ...
  transactions  Transaction[]
}
```

---

## ✅ План реализации по фазам

### **MVP (Фаза 1): 2-3 недели**

**Backend:**
- [ ] Миграция БД: `Transaction`, `ResponsibleSelection`, `PaymentReminder`
- [ ] `ResponsibleService` (только roulette mode)
  - [ ] `startResponsibleSelection()`
  - [ ] `runRouletteAndProceed()`
- [ ] `BudgetService`
  - [ ] `createTransactionsFromPoll()`
  - [ ] `calculateTotals()`
  - [ ] `sendBudgetNotifications()`
  - [ ] `sendDebtNotification()` (с реквизитами из ProfilePage)
  - [ ] `markAsPaid()`, `confirmPayment()`
- [ ] Интеграция с `PollService.completePollMultiWinner()`
- [ ] Bot callbacks: `mark_paid`, `confirm`
- [ ] API: `GET /budget/debts`, `GET /budget/credits`

**Frontend:**
- [ ] Страница `/budget/debts`
- [ ] Страница `/budget/credits`
- [ ] `DebtCard`, `CreditCard` компоненты

### **Фаза 2: Добровольный выбор - 1-2 недели**

**Backend:**
- [ ] `ResponsibleService`: volunteer mode
  - [ ] `sendVolunteerPrompt()`
  - [ ] `handleVolunteer()`
  - [ ] `handleVolunteerTimeout()`
- [ ] Bot callback: `volunteer`
- [ ] Group settings: `responsibleSelectionMode`

**Frontend:**
- [ ] Admin: настройки выбора ответственного

### **Фаза 3: Напоминания - 1 неделя**

**Backend:**
- [ ] `ReminderService`
  - [ ] `sendDebtReminder()`
  - [ ] `sendScheduledReminders()`
- [ ] Cron job для автоматических напоминаний

### **Фаза 4: Статистика - 1-2 недели**

**Backend:**
- [ ] `BudgetService`: методы статистики
- [ ] API endpoints

**Frontend:**
- [ ] Страница `/budget/stats`
- [ ] Графики

---

## 🎯 Итоговая диаграмма

```
ГОЛОСОВАНИЕ
    ↓
completePollMultiWinner()
    ├─ PollResult с multi-winner
    ├─ Уведомления о результатах
    └─ startResponsibleSelection() 🚀 NEW
            ↓
        ┌───┴───┐
  volunteer    roulette
        ↓           ↓
   Кнопка      Случайный
   в группу     выбор
        └───┬───┘
            ↓
    selectedUserId
            ↓
    createTransactionsFromPoll() 🚀 NEW
            ├─ Transaction для каждого
            └─ amount = menuItem.price
            ↓
    sendBudgetNotifications() 🚀 NEW
            ├─ Ответственному (детали + кто должен)
            ├─ Участникам (долг + РЕКВИЗИТЫ ИЗ ПРОФИЛЯ)
            └─ В группу (сводка)
            ↓
    ПОДТВЕРЖДЕНИЕ ОПЛАТЫ 🚀 NEW
            ├─ "Оплатил" → PAID
            ├─ "Подтвердить" → CONFIRMED
            └─ "Все оплатили!" 🎊
```

---

**ИТОГО: 6-9 недель полной реализации**

Все компоненты спроектированы с учетом максимальной интеграции с существующей системой, особенно с ProfilePage для реквизитов!
