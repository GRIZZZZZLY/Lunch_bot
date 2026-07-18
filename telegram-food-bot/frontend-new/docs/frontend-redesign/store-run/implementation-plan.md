# Store Run — план реализации (Phase 3B–3F)

> **СТАТУС (2026-07-18): Phase 3 завершена функционально.** Все четыре статуса
> (COLLECTING/SHOPPING/SETTLED/CANCELLED) работают на новом
> `features/store-run`; legacy `pages/StoreRunPage.tsx` удалён; backend/API не
> менялись. Текущий визуал — временный baseline до Penpot (см.
> `../../design-handoff/`). Реальный Telegram device QA не выполнен —
> обязательный pre-release gate (`../safe-area-qa-checklist.md`).

Каждый этап — небольшой самодостаточный коммит. После КАЖДОГО: type-check →
tests → lint → production build. Production StoreRunPage переключается на новый
код только когда соответствующий view готов (см. 3C).

## 3B. Доменные утилиты (без UI)

`src/features/store-run/lib/selectors.ts` + `selectors.test.ts`:
- `priceNum(price: string|number|null|undefined): number | null` — null-safe, `null≠0`.
- `formatPrice(n: number): string` — ru-RU + ₽.
- `groupItemsByParticipant(items, currentUserId)` — секции, «Мои» первой.
- `computeProgress(items)` — `{ processed, total, requested, bought, notFound }`.
- `computeBreakdown(items, initiatorId)` — массив `{ user, total, items, isOwnerDebtFree }`.
- `personalTotal(items, userId)` — сумма BOUGHT `price` пользователя.
- `roleOf(run, userId)` / `isInitiator` / `isOwner`.
- `cancelReason(run)` — `'manual' | 'auto'` по `shoppingAt`.
- `COLLECT_PRESETS = [5,15,30]` (фикс B1).
- `hasRequested(items)`, `boughtWithoutPrice(items)` — для settle-валидации.

Выход: покрытая тестами чистая логика, UI ещё не тронут.

## 3C. COLLECTING

- Каркас `src/features/store-run/StoreRunPage.tsx` (новый) + views/CollectingView,
  components: StoreRunSummary, CollectionCountdown, ParticipantSection,
  StoreItemRow, AddStoreItemSheet, EditStoreItemSheet, StoreRunActions.
- Подключить `useUpdateStoreItem` (B3).
- Роль-зависимые действия: add (P/I), edit/delete own (+ConfirmDialog на delete),
  close/cancel (I, +ConfirmDialog), чужие read-only без корзины (B2).
- countdown + onExpire-refetch; InlineNotice «Сбор закрывается…».
- Раздельные loading/empty/error (B4).
- **Переключение маршрута**: `App.tsx` `/store-run/:id` → новый
  `features/store-run/StoreRunPage`; старый `pages/StoreRunPage.tsx` пока
  остаётся в дереве (удаляется в 3F), но из роутинга уходит.
- Перенести CreateStoreRunSheet в feature с пресетами `[5,15,30]`, обновить
  импорт в HomePage.
- tests: participant add/edit/delete, initiator без корзины на чужих, close
  confirm/disabled, cancel confirm, countdown тикает, countdown=0 → refetch без
  смены статуса.

## 3D. SHOPPING

- views/ShoppingView + ShoppingProgress + ShoppingItemRow.
- Inline «Куплено» (раскрывает поле цены), «Не нашли», переключение
  BOUGHT↔NOT_FOUND; label «Цена за всё (×N), ₽»; price=0 допустим.
- Прогресс «X из Y», секции Осталось/Куплено/Не нашли.
- Settle: ConfirmDialog при REQUESTED (точное N); блок при BOUGHT без цены
  (InlineNotice-critical); иначе settle.
- Participant read-only + personal total.
- tests: только инициатор видит контролы; price=0; quantity>1 label; NOT_FOUND;
  BOUGHT↔NOT_FOUND; progress; settle+REQUESTED confirm; settle-block при BOUGHT
  без цены; блок повторного submit.

## 3E. Терминальные состояния

- views/SettledView (+ParticipantBreakdown, personal total, «долги созданы»,
  ссылка на Home per OQ1) и CancelledView (причина-эвристика, история read-only,
  ссылка per OQ2).
- tests: SETTLED read-only + breakdown + personal total; CANCELLED read-only обе
  причины; 403/404 раздельно; network retry.

## 3F. Чистка

- Удалить старый `pages/StoreRunPage.tsx` и его per-item PriceSheet.
- Удалить Store-Run-specific inline-стили (перенесены в module.css).
- Удалить неиспользуемые импорты; убрать старый CreateStoreRunSheet из
  `components/rl`, если не используется.
- Скриншоты всех 4 статусов (light/dark, 320px), обновить прогон.
- Telegram manual QA по safe-area-qa-checklist (клавиатура над inline-полем цены,
  BackButton с edit-sheet и confirm).

## Порядок безопасности

- Backend/API не трогаем.
- Каждый этап оставляет приложение собираемым и проходящим тесты.
- Старый экран удаляется только в 3F, после того как новый работает во всех
  статусах.
