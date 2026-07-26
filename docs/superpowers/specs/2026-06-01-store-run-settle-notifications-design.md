# Store Run — уведомления и групповой пост при завершении

**Дата:** 2026-06-01
**Статус:** design approved, ожидает плана реализации
**Ветка:** `main`

## Проблема

После завершения забега (`settle`):
- Участники без долга (их позиции не куплены / не нашли) не получают ничего —
  непонятно, чем кончился забег.
- Групповой пост «🛒 <Имя> идёт в «<магазин>» … Заказать» остаётся с живой
  inline-кнопкой, хотя сбор уже закрыт и забег завершён.

Должники уже получают корректный ДМ (позиции + сумма + реквизиты инициатора из
Профиля + кнопка «Оплатил ✅») — это `BudgetService.notifyStoreRunSettled` /
`sendStoreRunDebtNotification`. Раньше эти ДМ не приходили только потому, что ни
одна позиция не отмечалась «куплено» (отдельный баг, уже исправлен).

## Решение (подтверждено пользователем)

На `settle` выполнять три действия, все fire-and-forget из
`StoreRunController.settle`:

1. **Должникам** — существующий долговой ДМ (без изменений).
2. **Участникам без долга** — короткий ДМ «забег завершён, платить не надо».
3. **Групповой пост** — отредактировать в «завершён» и убрать inline-кнопку.

## Дизайн

### 1. Должникам (существующее, без изменений)

`BudgetService.notifyStoreRunSettled(storeRunId)` уже вызывается в
`StoreRunController.settle`. Шлёт должникам их позиции + сумму + реквизиты
инициатора (`UserService.getPaymentInfo`, заполняются на странице Профиль) +
кнопку «Оплатил ✅», инициатору — сводку. Не трогаем.

### 2. Участникам без долга — новый метод

`notificationService.notifyStoreRunParticipantsNoDebt(storeRunId)`:

- Участники = `distinct StoreItem.userId` по этому забегу, **кроме** инициатора.
- Фильтр получателей: `User.isActive = true` и `participatesInPolls = true`
  (как в `notifyShoppingStarted`).
- Должники = `distinct fromUserId` из `Transaction` где `storeRunId` и
  `status = PENDING`.
- Получатели уведомления = участники − должники.
- Текст: «✅ Забег в «{storeName}» завершён. Из твоего ничего не куплено —
  платить не надо.»
- Отправка через `this.send(...)` (или прямой `bot.api.sendMessage`),
  толерантно к сбоям (один сбой не мешает остальным).
- Нет получателей → выход без ошибки.

### 3. Групповой пост — новый метод

`notificationService.markStoreRunGroupCompleted(storeRunId)`:

- Загрузить run (`group.telegramId`, `groupMessageId`, `storeName`).
- Нет `groupMessageId` → пропуск (нечего редактировать), лог info.
- `bot.api.editMessageText(Number(group.telegramId), groupMessageId, text,
  { parse_mode: 'HTML' })`, где text = «✅ Забег в «{storeName}» завершён.
  Должникам ушли суммы и реквизиты в личку.»
- `reply_markup` НЕ передаём ⇒ Telegram убирает inline-кнопку «Заказать».
- try/catch — терпит «message is not modified», «message to edit not found»,
  устаревание (>48ч). Лог warn при сбое.

### 4. Провод в контроллере

`StoreRunController.settle`, после успешного `StoreRunService.settle`, рядом с
существующим вызовом `BudgetService.notifyStoreRunSettled(id)` добавить два
fire-and-forget вызова с `.catch(logger.error)`:

```
notificationService.notifyStoreRunParticipantsNoDebt(id).catch(...)
notificationService.markStoreRunGroupCompleted(id).catch(...)
```

### Крайние случаи

- Инициатор не заполнил реквизиты → существующий долговой ДМ уже пишет
  «не заполнил — уточни перевод лично». Не наша забота здесь.
- Участник с частью купленных позиций → он должник (есть PENDING-транзакция) →
  попадает в п.1, отдельный «без долга» ему НЕ шлём (исключён как должник).
- Забег без единой купленной позиции → должников нет, все участники получают
  «без долга»-ДМ; групповой пост всё равно редактируется.
- `groupMessageId` пуст (пост не публиковался) → п.3 пропускается.

### Затрагиваемые файлы

**Backend:**
- `backend/src/services/notification.service.ts` — два новых метода
  (`notifyStoreRunParticipantsNoDebt`, `markStoreRunGroupCompleted`).
- `backend/src/api/controllers/store-run.controller.ts` — два fire-and-forget
  вызова в `settle`.
- `backend/src/services/__tests__/notification.service.test.ts` — тесты на оба
  новых метода.

**Frontend:** не меняется.

## Тестирование

Backend unit (Jest, мок prisma + фейковый bot):
- `notifyStoreRunParticipantsNoDebt`: шлёт только участникам без долга;
  исключает инициатора и должников; пропускает неактивных
  (`isActive`/`participatesInPolls`); не падает при сбое отправки одному;
  пустой список получателей → без ошибки.
- `markStoreRunGroupCompleted`: вызывает `editMessageText` с верными
  аргументами и без `reply_markup`; пропускает при отсутствии `groupMessageId`;
  терпит выброс из `editMessageText`; run не найден → без ошибки.

## Вне охвата (YAGNI)

- Изменение текста/логики существующего долгового ДМ и сводки инициатору.
- Редактирование группового поста при `cancel` (там удаление) и при старте
  шопинга.
- Отдельный пересчёт/повторная отправка при повторном `settle` (settle
  идемпотентен по статусу: повторный вызов отклоняется `WRONG_STATUS`).
