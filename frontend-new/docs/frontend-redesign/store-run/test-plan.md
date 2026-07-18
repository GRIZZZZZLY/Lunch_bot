# Store Run — план тестов

Юнит — Vitest; компонентные — RTL; визуал/ручное — Playwright + Telegram.
Привязка к этапам реализации в скобках.

## Domain (selectors.test.ts) — 3B

- `price` — сумма строки; `quantity` НЕ умножает сумму.
- breakdown группирует BOUGHT по `userId`; суммы верны.
- personal total пользователя = сумма его BOUGHT `price`.
- позиции инициатора не создают долг (`isOwnerDebtFree`).
- REQUESTED не входят в breakdown/итог.
- NOT_FOUND не входят в сумму.
- `priceNum`: `null`/`undefined`/нечисло → `null`; `"320"`→320; `0`→0 (не null).
- `cancelReason`: `shoppingAt==null`→manual, `!=null`→auto.
- `COLLECT_PRESETS === [5,15,30]` (в диапазоне backend 3..30, B1).
- `boughtWithoutPrice` / `hasRequested` — корректный подсчёт.

## COLLECTING — 3C

- participant добавляет позицию (sheet → onSubmit → мутация).
- владелец редактирует свою (useUpdateStoreItem подключён, B3).
- владелец удаляет свою (через ConfirmDialog).
- инициатор **не видит** удаление/редактирование чужой (B2).
- countdown тикает (fake timers).
- countdown=0 → вызывает refetch, но `status` локально не меняется на SHOPPING.
- пустая закупка → EmptyState; «Закрыть сбор» disabled.
- close confirmation (ConfirmDialog обязателен).
- cancel confirmation.

## SHOPPING — 3D

- только инициатор видит контролы (participant — read-only).
- BOUGHT с `price=0` допустим (сохраняется).
- `quantity>1` → label «Цена за всё (×N), ₽».
- NOT_FOUND ставится без цены.
- BOUGHT ↔ NOT_FOUND переключается.
- progress «X из Y» пересчитывается.
- settle при наличии REQUESTED → ConfirmDialog с точным числом.
- settle при BOUGHT без цены → заблокирован, показана конкретная ошибка.
- повторный submit settle заблокирован (pending).

## Терминальные — 3E

- SETTLED read-only (нет mutation-контролов).
- CANCELLED read-only.
- personal total отображается первой строкой должнику.
- participant breakdown построен из items.
- 403 → ErrorState forbidden (раздельно, B4).
- 404 → ErrorState notFound.
- network error → retry вызывает рефетч.

## Визуал / ручное — 3F

- 320px без горизонтального скролла.
- длинные русские названия магазина/товара/имени — без обрезки/переполнения.
- light/dark — обе осмысленны.
- iOS safe area; Android safe area (по safe-area-qa-checklist.md).
- клавиатура над inline-полем цены не перекрывает поле.
- Telegram BackButton: закрывает edit-sheet раньше навигации; закрывает
  ConfirmDialog раньше навигации.

## Не делаем

- Пиксельные снапшоты каждого компонента. Скриншоты — только 4 главных статуса.
