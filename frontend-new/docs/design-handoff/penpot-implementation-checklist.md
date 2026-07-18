# Чеклист внедрения Penpot-макетов

> Store Run полностью на новом feature (Phase 3F): 4 статуса × роли, legacy
> удалён. Рестайл Store Run = CSS-модули + tokens.css; JSX — только по §4.
> Реальный Telegram device QA ещё не выполнялся.

## 1. Сопоставление токенов

Penpot design tokens → `src/styles/tokens.css` (канонические имена, НЕ aliases):

- цвет: canvas, surface, surface-secondary, elevated, text-primary/secondary/
  tertiary, divider, accent(+hover/active/tint/foreground), success/warning/
  danger/info(+tints/foregrounds), overlay, focus-ring;
- шкалы: space-*, text-*, radius-*, control-*, motion-*;
- шрифты: font-body / font-brand (self-host woff2 в `public/fonts/` — при смене
  гарнитуры заменить файлы и @font-face).

Двойной комплект значений: light + dark (`[data-theme]`). Канвас может
подхватываться из Telegram (`tg-synced`) — уточнить в макете, допустим ли
переменный фон.

## 2. Что уже существует (рестайл без изменения API/JSX)

Только CSS (module.css / tokens.css):
- Button, IconButton, TextField, Status, Skeleton, EmptyState, ErrorState,
  InlineNotice (shared/ui/*.module.css);
- ShoppingProgress, строки, секции, sticky CTA (StoreRunPage.module.css);
- BottomSheet-поверхность, ScreenHeader, BottomNavigation (глобальные классы
  redesign-v2.css — при рестайле переносить в module-стратегию).

## 3. Композиционные изменения без правки JSX

- отступы/ритм/разделители секций, выравнивание owner-подписи;
- порядок визуальных акцентов внутри строки (CSS-grid/flex перестановки);
- вид полосы прогресса, стили нотисов, радиусы/тени поверхностей.

## 4. Изменения, требующие правки JSX

- другая иконография (набор в `components/rl/Icon.tsx`);
- перестановка блоков экрана (порядок секций/notices) — правка view;
- новые элементы строки (например, фото товара) — правка ShoppingItemRow;
- смена паттерна inline-editor на другой (например, шторка) — правка
  ShoppingItemRow + тесты;
- вынос Status из header-action в тело — правка view + useScreenHeader-вызов.

## 5. Бизнес-инварианты (нарушать нельзя)

- одна primary CTA на экран; порядок «оверлей закрывается раньше навигации»;
- touch-цели ≥44px; текстовые статусы (цвет не единственный канал);
- price за строку, 0 допустим; REQUESTED не в расчёте; возврата в REQUESTED нет;
- server status = истина (никаких локальных переходов по таймерам);
- pending-блокировки: строка/settle/повторный сабмит;
- confirm-диалоги на: удаление, отмену, раннее закрытие, settle с REQUESTED.

## 6. Порядок работ после утверждения макетов

1. Замапить Penpot tokens → tokens.css (оба режима темы).
2. Рестайл shared/ui по инвентарю состояний (без API-изменений).
3. Рестайл Store Run module.css; JSX-правки — только по списку §4.
4. Прогнать тесты (логика не должна меняться) + скриншот-раннеры
   `scripts/screenshot-runner/screenshot-2c|3c|3d.mjs` для сравнения с макетами.
5. Telegram manual QA по `../frontend-redesign/safe-area-qa-checklist.md`.
