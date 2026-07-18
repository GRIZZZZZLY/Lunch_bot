# Store Run — план компонентов и данных

## Файловая структура

```
src/features/store-run/
├── StoreRunPage.tsx          # контейнер: fetch, роль, диспетчер по status, wiring мутаций, overlay/confirm-state
├── StoreRunPage.module.css
├── views/
│   ├── CollectingView.tsx    # COLLECTING (participant + initiator)
│   ├── ShoppingView.tsx      # SHOPPING (initiator-контролы / participant read-only)
│   ├── SettledView.tsx       # SETTLED read-only + breakdown
│   └── CancelledView.tsx     # CANCELLED read-only
├── components/
│   ├── StoreRunSummary.tsx
│   ├── CollectionCountdown.tsx
│   ├── ParticipantSection.tsx
│   ├── StoreItemRow.tsx        # строка в COLLECTING (own/foreign)
│   ├── ShoppingProgress.tsx
│   ├── ShoppingItemRow.tsx     # строка в SHOPPING (inline bought/not-found/price)
│   ├── ParticipantBreakdown.tsx
│   ├── AddStoreItemSheet.tsx
│   ├── EditStoreItemSheet.tsx
│   └── StoreRunActions.tsx     # sticky CTA-зона по статусу+роли
├── lib/
│   ├── selectors.ts            # чистая доменная логика
│   └── selectors.test.ts
└── (CreateStoreRunSheet — переносится из components/rl, фикс пресетов B1)
```

Не переносим в feature: `src/services/store-run.service.ts` (API-контракт) и
`src/hooks/useStoreRun.ts` (их использует и Home). Страница дополнительно
подключает уже существующий, но не задействованный `useUpdateStoreItem`
(фикс B3, useStoreRun.ts:76).

**Generic Card не создаём.** Секции — плоские, на `StoreRunPage.module.css` +
токенах Phase 2B.

## Новые компоненты

Для каждого: ответственность · props · где · есть ли domain-logic внутри ·
что остаётся на странице.

### StoreRunSummary
- **Ответственность**: шапка-сводка (инициатор, для COLLECTING — счётчик
  участников/позиций; слот под countdown). Презентационный.
- **props**: `{ run: StoreRunWithRelations; participantsCount: number; itemsCount: number; children?: ReactNode }`.
- **где**: CollectingView (и как лёгкий вариант в терминальных).
- **domain-logic**: нет (числа считает страница/селекторы).

### CollectionCountdown
- **Ответственность**: живой таймер до `collectUntil` + прогресс-полоса; при
  нуле — текст «Сбор закрывается…».
- **props**: `{ collectUntil: string; onExpire?: () => void }`.
- **где**: StoreRunSummary в COLLECTING.
- **domain-logic**: нет — использует `useCountdown` (shared/lib). `onExpire`
  дёргает страница для refetch.

### ParticipantSection
- **Ответственность**: заголовок секции участника + список его `StoreItemRow`.
- **props**: `{ title: ReactNode; items: StoreItem[]; renderRow: (item) => ReactNode; note?: string }`.
- **где**: CollectingView.
- **domain-logic**: нет (группировку даёт селектор).

### StoreItemRow (COLLECTING)
- **Ответственность**: строка позиции; для своей — `[✎]`/`[🗑]`, для чужой — read-only.
- **props**: `{ item: StoreItem; canEdit: boolean; onEdit?: () => void; onDelete?: () => void }`.
- **где**: ParticipantSection.
- **domain-logic**: нет — `canEdit` вычисляет страница (`isOwner`).

### ShoppingProgress
- **props**: `{ processed: number; total: number }`. Полоса + «Обработано X из Y».
- **domain-logic**: нет (числа из селектора `computeProgress`).

### ShoppingItemRow
- **Ответственность**: крупная строка чеклиста; inline «Куплено»/«Не нашли» и
  поле цены; переключение статуса.
- **props**: `{ item: StoreItem; editable: boolean; onSetBought: (price: number) => void; onSetNotFound: () => void; pending?: boolean }`.
- **где**: ShoppingView (initiator). Для participant — `editable=false`.
- **domain-logic**: локальный UI-state поля цены (useState в строке); нормализацию
  `price` для отображения берёт из `selectors.priceNum`.

### ParticipantBreakdown
- **Ответственность**: разбивка по участникам из `items` (клиентский расчёт),
  пометка позиций инициатора «своё, без долга».
- **props**: `{ breakdown: BreakdownEntry[]; currentUserId: number }`.
- **где**: SettledView.
- **domain-logic**: нет — принимает готовый результат `computeBreakdown`.

### AddStoreItemSheet
- **props**: `{ open; busy; onClose; onSubmit: (input: AddItemInput) => void }`. Поля
  name (≤200)/quantity (1..99)/notes (≤500) на `TextField`. Single-add (OQ3).
- **domain-logic**: локальная валидация формы; отправка через страницу.

### EditStoreItemSheet
- **props**: `{ open; item; busy; onClose; onSubmit: (data: UpdateItemInput) => void }`.
- Тот же набор полей; подключает `useUpdateStoreItem` через страницу (B3).

### StoreRunActions
- **Ответственность**: sticky CTA-зона — рендерит нужные кнопки по `status`+роли
  (Закрыть сбор / Отменить / Рассчитать / На главную), пробрасывает клики.
- **props**: `{ run; isInitiator; canClose; canSettle; onClose; onCancel; onSettle; pending }`.
- **domain-logic**: нет — предикаты (`canClose`, `canSettle`) считает страница.

### CreateStoreRunSheet (перенос + фикс B1)
- Пресеты `[15,30,60]` → `[5,15,30]` (backend 3..30). Остальное поведение как есть;
  вызывается с Home (group-context снаружи).

## Переиспользуемые примитивы (Phase 2C)

`Button`, `IconButton`, `TextField`, `Status`, `Skeleton`, `EmptyState`,
`ErrorState`, `InlineNotice`, `ConfirmDialog`, `useCountdown`. BottomSheet —
базовый для Add/Edit-sheet и ConfirmDialog.

## State и данные

- **Источник server-state**: `useStoreRun(id)` → `StoreRunWithRelations`
  (initiator, items[]+user, group?). refetch: 15s в COLLECTING/SHOPPING, `false`
  в SETTLED/CANCELLED (useStoreRun.ts:42-47) — уже так.
- **Существующие мутации** (useStoreRun.ts): `useAddStoreItems`,
  `useUpdateStoreItem` (**подключить**, B3), `useDeleteStoreItem`,
  `useSetItemPrice`, `useStartShopping`, `useSettleStoreRun`, `useCancelStoreRun`.
  Все инвалидируют `storeRuns.detail(runId)` (+active; settle ещё `['budget']`).
  Ничего нового создавать не нужно.
- **UI-state** — только локальный `useState` на странице/в строке: какой sheet
  открыт, target редактирования, какой confirm открыт, значение inline-поля цены.
  **Server-state в Zustand не переносим.**
- **Блокировка повторных мутаций**: `mutation.isPending` → disabled контрола +
  `pending` в ConfirmDialog (Escape/отмена/backdrop заблокированы на время
  settle/cancel/close). Идемпотентность create/settle/… дополнительно
  гарантирует idempotency middleware бэкенда.
- **Инвалидация**: по onSuccess хуков (уже настроено). После settle
  инвалидируется `['budget']`.
- **refetch после countdown=0**: `CollectionCountdown.onExpire` → страница вызывает
  `queryClient.invalidateQueries(storeRuns.detail(id))` один раз (guard, чтобы не
  спамить), статус локально не меняем.
- **breakdown**: `computeBreakdown(items, initiatorId)` — группирует по `userId`
  **ВСЕ** позиции (REQUESTED/BOUGHT/NOT_FOUND), чтобы показать в группе и
  ненайденные/необработанные; денежный `total` группы — только `BOUGHT && price!=null`.
  Запись инициатора помечается `isInitiator` (для «своё, без долга»).
- **role-aware суммы SETTLED**:
  - `purchasedTotal(items)` — Σ BOUGHT `price` (Итого закупки).
  - `personalDebtTotal(items, userId, initiatorId)` — Σ BOUGHT `price` строк
    пользователя; **для инициатора = 0** (свои позиции не долг).
  - `initiatorOwnTotal(items, initiatorId)` — Σ BOUGHT `price` позиций инициатора
    (Ваши покупки, не долг).
  - `receivableTotal(items, initiatorId)` — Σ BOUGHT `price` НЕ-инициаторских
    позиций (Вам должны). Инвариант: `purchasedTotal == receivableTotal + initiatorOwnTotal`.
- **price**: две разные функции.
  - `priceNum(valueFromApi)` — для значений API (`string|number|null`):
    null/undefined/нечисло → null; numeric string → number; `0` не превращается в
    null. Точка-десятичный (API формат).
  - `parsePriceInput(valueFromTextField)` — для ввода: trim; пустая → null;
    десятичная запятая поддержана; `0` допустим; отрицательные/NaN/Infinity → null.
  - `formatPrice(n)` — ru-RU + ₽.
- **cancellationKind(run)** — `'manual' | 'auto'` по `shoppingAt` (см. CANCELLED copy).
