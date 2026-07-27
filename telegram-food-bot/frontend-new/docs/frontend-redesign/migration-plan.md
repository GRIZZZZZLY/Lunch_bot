# План миграции frontend-new

> **Прогресс (обновлено 2026-07-26):** Фазы 1, 2A/2B/2C и 3 (3A–3F)
> завершены.
> Store Run целиком на `features/store-run` (4 статуса × роли), legacy-экран
> удалён, баги B1/B2/B3 (+B4 для Store Run) закрыты. Визуальный слой — временный
> baseline: финальный дизайн придёт из Penpot (`../design-handoff/`).
> Следующее: Phase 4 (Home/polls) — только после подтверждения; Telegram device
> QA — обязательный gate перед релизом.

Синтез аудита Фазы 1 + решения владельца от 2026-07-17. Детали и доказательства:
[code-map.md](code-map.md), [route-map.md](route-map.md), [domain-flows.md](domain-flows.md),
[component-audit.md](component-audit.md), [design-audit.md](design-audit.md),
[store-run-state-machine.md](store-run-state-machine.md), [store-run-design.md](store-run-design.md).

## Решения владельца (2026-07-17, аудит утверждён)

- **Q1 Multi-select**: только одиночное голосование. Новые опросы — `isMultiSelect=false`, `maxSelections=1` (или без него, если контракт позволяет). `voteMultiple` в service НЕ удалять, UI multi-select не делать — будущая продуктовая функция.
- **Q2 Tailwind**: удалить после миграции последних живых call-sites. Целевая стратегия — семантические CSS-токены + CSS Modules / колокированные feature-стили. На Tailwind не переводить. Inline styles — только для действительно динамических значений.
- **Q3 Stats**: убрать из нижней навигации. Bottom navigation = **Главная, Меню, Профиль**. Stats — pushed-экран из Profile. На Home допустима одна компактная персональная метрика, не dashboard.
- **Q4 BudgetDemoPage**: исключить маршрут из production; временно dev-only playground через `import.meta.env.DEV`. Сначала перенести сценарную модель бюджета в живой виджет и покрыть PENDING→PAID→CONFIRMED тестами, потом удалить BudgetDemoPage, старые budget-компоненты и CSS.
- **Q5 Шрифты**: self-host woff2 — Onest 400/500/600/700, Unbounded 600/700. Unbounded — только бренд и редкие экранные заголовки. System fallback + `font-display: swap`. Google Fonts CDN не использовать.
- **Group context**: interceptor с автоподстановкой groupId пока сохранить для обратной совместимости; все group-scoped query keys и мутации постепенно перевести на явный groupId. Когда все вызовы покрыты тестами и передают groupId явно — удалить автоподстановку. Group-agnostic endpoints groupId получать не должны.
- **Store Run** — первый вертикальный срез. Серверную семантику не менять: price за строку; quantity информационный; удалять/редактировать только свои позиции; после collectUntil истина — status с сервера; REQUESTED не входят в settle; settle response без breakdown.
- **Порядок**: перед реализацией Store Run — дизайн-пакет на утверждение ([store-run-design.md](store-run-design.md)). После утверждения — только Phase 2A; к 2B не переходить автоматически.

## Принципы

1. Код и тесты — источник истины. `README.md` содержит актуальный порядок
   запуска; исторические цифры аудита ниже не следует принимать за текущее
   состояние без сверки с кодом.
2. Сохраняем все реальные потоки из `domain-flows.md` (раздел 10): API-контракты, hooks, services, типы, TanStack Query, Zustand (auth + group), SSE, deep links.
3. Вертикальные срезы, не «большой переезд»: фундамент → Store Run → остальное.
4. Мёртвый код удаляем только после того, как живой путь мигрировал (фаза 7).
5. После каждой фазы: список изменённых файлов → `type-check` → lint → тесты → production build → отчёт о нерешённом. Без подавления ошибок кастами и disable-комментариями.

## Итоговая картина аудита (кратко)

- Живой UI — один слой `components/rl/*`; `components/home`, `stats`, почти весь `profile`, `ui/*` — мёртвые поколения (~2350 строк TS + 1473 CSS).
- Shell: `Header` + `BottomNavigation` на всех 11 маршрутах; detail-экраны рисуют второй `BackHeader`; Telegram BackButton/MainButton/Haptics объявлены, но не вызываются.
- Токены: две параллельные системы (`index.css` 42 переменные / `.dark` и `redesign-v2.css` 58 / `[data-theme]`), 2 конфликта значений; Telegram `themeParams` не используются.
- 628 inline-style объектов, 88 градиентов, 14 glass-деклараций; Tailwind фактически мёртв (~20 utility-классов из 743 `className=`).
- Store Run: state machine на бэкенде полная (cron авто-переходы), фронт — 2 бага и ~8 UX-разрывов.
- На момент исходного аудита тестов и линта не было. Сейчас настроены ESLint,
  Vitest, Playwright, проверка TypeScript и production build в CI.

## Реестр багов

| # | Баг | Где | Фаза |
|---|-----|-----|------|
| B1 | Пресет «60 мин» против лимита бэкенда 3–30 → гарантированный 400 | `CreateStoreRunSheet.tsx:5` vs backend `store-run.controller.ts:12` | 3 |
| B2 | Инициатору показана кнопка удаления чужих позиций → 403 | `StoreRunPage.tsx:98` | 3 |
| B3 | Таймер опроса не тикает: `Date.now()` в `useMemo` без интервала | `HomePage.tsx:142-147` | 4 |
| B4 | Menu toggle без явного groupId — риск действия в чужой группе | `domain-flows.md` §8e | 5 |
| B5 | Кнопка «Напомнить» у сборщика не прокинута (`onRemind`) | `domain-flows.md` §3 | 6 |
| B6 | AdminPage создаёт опрос без catch и без выбора группы | `AdminPage.tsx` | 5 |
| B7 | Три разных критерия «админства» на разных страницах | `domain-flows.md` | 2A |
| B8 | Две конфликтующие подписки `themeChanged`, `offEvent` нигде | `telegram.ts:116`, `main.tsx:38` | 2A |
| B9 | 401 молча чистит токен; `refreshAuth` не вызывается; ошибка auth выглядит как пустое состояние | `api.service.ts:43` | 2A |
| B10 | SVG-грейн на `z-index: 999` поверх модалок | `design-audit.md` | 2B |
| B11 | `--mono: 'JetBrains Mono'` используется 9 раз, шрифт не загружается | `design-audit.md` | 2B |
| B12 | Закоммичен скомпилированный `vite.config.js`, перекрывает `vite.config.ts` | корень frontend-new | 2A |
| B13 | multi-select заявлен при создании, UI голосует одним | `domain-flows.md` §1 | 4 (решение Q1: создавать с `isMultiSelect=false`) |

## Phase 2A — инфраструктура и безопасность

Без изменения визуального слоя.

1. **Тест-инфраструктура**: Vitest + React Testing Library + ESLint; скрипты `test`, `lint`.
2. **B12**: удалить конфликтующий `vite.config.js`.
3. **AuthGate** с явными состояниями: initializing / authenticated / auth error + retry / вне Telegram (production) / dev fallback.
4. **Контролируемый retry auth после 401** — использовать существующий `refreshAuth`, без бесконечного цикла (одна попытка refresh на запрос, счётчик/флаг). Убирает B9.
5. **Одна подписка на Telegram themeChanged** с cleanup (убирает B8); конфликт с ручным override `rl-theme` разрешить в одном месте.
6. **Единый permission helper** `isAdmin`/права (убирает B7).
7. **Regression-тесты**: AuthGate (успех, ошибка+retry, вне Telegram), 401→refresh→повтор→не-цикл, подписка/отписка темы, override темы.

**Verify**: type-check, lint, тесты, build; поведение UI не изменилось.
**СТОП после 2A — к 2B не переходить без команды.**

## Phase 2B — shell и тема

1. **RootLayout** (BottomNavigation: **Главная, Меню, Профиль** — 3 таба по Q3) и **DetailLayout** (без нижней навигации) для `/poll/history`, `/poll/:id/results`, `/store-run/:id`, `/suggestions`, `/admin`, `/stats` (новый pushed-маршрут из Profile).
2. **Telegram BackButton** для pushed-экранов и оверлеев (оверлей закрывается раньше навигации); **browser fallback** back-кнопка только вне Telegram; двойной кнопки «назад» не бывает.
3. **Safe-area и stable viewport**: адаптер поверх Telegram viewport API (`viewportStableHeight`, contentSafeArea) с fallback на `env()`; hooks `useTelegramViewport`, `useTelegramBackButton`, `useTelegramTheme`, `useTelegramHaptics`.
4. **Единая система токенов**: один слой вместо `index.css`+`redesign-v2.css` — 16 семантических цветовых токенов + шкалы spacing/type/radius/control-height/icon/motion/z-index; маппинг на `--tg-theme-*` с fallback; один ключ темы; разрешить 2 конфликта значений по макету «Графит и мёд». B10, B11.
5. **Self-host шрифты** (Q5): woff2 Onest 400/500/600/700 + Unbounded 600/700, system fallback, `font-display: swap`; убрать Google Fonts CDN.
6. **Доступный BottomSheet/Dialog** на базе живого `rl/BottomSheet.tsx`: focus trap, Escape, восстановление фокуса, scroll lock, `aria-labelledby`, закрытие BackButton.
7. 404-маршрут.

## Phase 2C — минимум примитивов

Только компоненты, реально необходимые для Store Run (список — в [store-run-design.md](store-run-design.md)). Универсальный UI-kit заранее не строить. Generic Card как базовый контейнер НЕ создавать. Стайлинг: CSS Modules на токенах (Q2), inline — только динамические значения.

## Фаза 3 — Store Run (первый вертикальный срез)

По [store-run-state-machine.md](store-run-state-machine.md) и утверждённому [store-run-design.md](store-run-design.md). Реальные hooks/services, без моков. Серверная семантика неприкосновенна (см. решения владельца). Фиксы B1, B2, подключение `useUpdateStoreItem`, живой таймер `collectUntil` (общий `useCountdown`), группировка по участникам, подтверждения, inline-цены, прогресс, settle-валидация, error/retry, breakdown на клиенте для SETTLED.

## Фаза 4 — Home и опросы

- Разбить `HomePage.tsx` (511 строк, 16 зон) и `homeWidgets.tsx` (973 строки) по фичам; серверные данные не переезжают в UI-стор.
- B3: countdown через `useCountdown`.
- Активный опрос: голос/отзыв, SSE, complete/cancel для админа, рулетка, deep link — сохранить.
- Создание: разовые + recurring; `isMultiSelect=false`, `maxSelections=1` или опустить (Q1); явный выбор группы.
- Store-run вход с Home — компактно. Одна компактная персональная метрика допустима (Q3), не dashboard.

## Фаза 5 — Menu, Suggestions, Admin

- MenuPage (582 строки): локальный селектор группы → глобальный group context; B4 (toggle с явным groupId); поиск, категории, admin CRUD, read-only участника, все состояния.
- Suggestions: создание/удаление своих, admin approve/reject, фильтры all/mine.
- Admin: B6 (catch + выбор группы), достижимость `/admin` из UI, user/debt management, cleanup, reminders.

## Фаза 6 — Profile, Stats, Budget, история

- Удалить фейковые настройки (switch уведомлений без персиста, строка «Язык»).
- Profile: реальные данные, СБП/payment info, streak, feedback, donation; вход в Stats (pushed, Q3).
- Budget: перенести сценарную модель `components/budget/**` в живой виджет + тесты PENDING→PAID→CONFIRMED; `/budget-demo` — dev-only через `import.meta.env.DEV`, затем удалить вместе со старыми budget-компонентами и CSS (Q4). B5.
- Stats: pushed-экран, меньше метрик-карточек.
- Poll history / results — на DetailLayout.

## Фаза 7 — Чистка

- Удалить 30 мёртвых файлов (~2350 строк TS; список в `component-audit.md`), 5 мёртвых CSS, старые токен-файлы после переезда. Перед чисткой `pollMappers`: вынести type `VoteOption`.
- Зависимости: удалить `framer-motion`, `recharts`, `clsx`, `tailwind-merge`, `lucide-react`; **удалить Tailwind** (tailwindcss, autoprefixer при ненадобности, конфиги) после миграции последних живых call-sites (Q2).
- Group context: когда все вызовы передают groupId явно и покрыты тестами — удалить автоподстановку из interceptor.
- Route-level lazy loading — если реально уменьшает бандл.
- Production build и проверка обновления deep-link; `frontend-new` выбран
  основным в `FRONTEND_DIR` и сценариях развёртывания.

## Тестирование (сквозное)

Vitest + RTL с Phase 2A; Playwright — малый набор мобильных сценариев после фазы 4.
Распределение: auth/theme (2A), BackButton+sheet, group switch (2B/5), countdown+resume (3/4), vote/withdraw + дубль-мутации (4), create poll с группой (4), store-run все роли/статусы (3), budget PENDING→PAID→CONFIRMED (6), длинные русские строки, 320px, обе темы, safe-area, network error+retry (по мере экранов). Без пиксельных снапшотов; скриншоты только главных состояний.

## Quality gate (финальная проверка)

Поведение сохранено; root/detail разделены; BackButton и safe-area работают; фейковых настроек нет; group context явный; store-run юзабелен во всех статусах; таймер тикает; одна дизайн-система; мёртвый код и Tailwind удалены; иерархия без glass/glow/карточных стопок; всё достижимо на 320px; обе темы осмысленны; все состояния реализованы; type-check+lint+тесты+build зелёные.
