# Аудит компонентов frontend-new

Дата: 2026-07-17. Ветка: `main`.
Метод: полный граф импортов построен от точки входа `src/main.tsx` (указана в `index.html`) → `src/App.tsx` → маршруты. Файл считается «живым» (LIVE), если до него есть цепочка импортов от entry; иначе — «мёртвым» (DEAD). Алиас `@/` → `src/` (см. `vite.config.ts`).

**Итого:** 116 файлов в `src/`, из них 70 компонентов/страниц. Классификация:

| Категория | Кол-во |
|---|---|
| preserve (оставить как есть) | 28 |
| refactor (переструктурировать) | 4 |
| preserve logic, replace UI | 7 |
| investigate | 1 |
| delete after migration | 30 |

Мёртвого кода: ~2350 строк TS/TSX + ~1470 строк CSS (без учёта demo-слоя budget: ещё ~1600 строк TS + 730 CSS живут только через маршрут `/budget-demo`).

---

## 1. Маршруты (src/App.tsx, 50 строк)

Все страницы подключены напрямую, **без `React.lazy()`** (code splitting отсутствует — заметка для рефакторинга):

| Маршрут | Страница |
|---|---|
| `/` | HomePage |
| `/menu` | MenuPage |
| `/stats` | StatsPage |
| `/profile` | ProfilePage |
| `/admin` | AdminPage |
| `/budget-demo` | BudgetDemoPage |
| `/poll/history` | PollHistoryPage |
| `/poll/:id/results` | PollResultsPage |
| `/store-run/:id` | StoreRunPage |
| `/suggestions`, `/suggestions/mine` | SuggestionsPage |

`PlaceholderPage` — **не подключён ни к одному маршруту**.

---

## 2. Инвентарь: страницы (src/pages/**)

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `src/pages/HomePage.tsx` | 512 | route `/` | **refactor** | Монолит: greeting + active/completed poll + budget + store runs + FAB. Инлайновая логика сценариев budget (использует `useDebts/useCredits/useMarkPaid` напрямую, минуя `useBudgetWidget`) |
| `src/pages/MenuPage.tsx` | 582 | route `/menu` | **refactor** | Самый большой файл страниц; инлайновые skeleton'ы, поиск, сортировка, sheet'ы — стоит разрезать |
| `src/pages/StatsPage.tsx` | 422 | route `/stats` | **refactor** | Живая замена мёртвого `components/stats/*`; инлайновый skeleton |
| `src/pages/ProfilePage.tsx` | 219 | route `/profile` | preserve | Живая замена мёртвого `components/profile/ProfileScreen.tsx` |
| `src/pages/AdminPage.tsx` | 272 | route `/admin` | preserve | Живая замена мёртвого `AdminDashboard.tsx` |
| `src/pages/PollHistoryPage.tsx` | 96 | route `/poll/history` | preserve | |
| `src/pages/PollResultsPage.tsx` | 101 | route `/poll/:id/results` | preserve | |
| `src/pages/StoreRunPage.tsx` | 315 | route `/store-run/:id` | preserve | |
| `src/pages/SuggestionsPage.tsx` | 248 | routes `/suggestions*` | preserve | |
| `src/pages/BudgetDemoPage.tsx` | 31 | route `/budget-demo` | **investigate** | Demo-полигон. Единственный потребитель всей цепочки `components/budget/**` + `hooks/useBudgetWidget.ts` + `lib/budgetMappers.ts` (~1600 строк). Решить: оставить как playground или удалить вместе с маршрутом |
| `src/pages/PlaceholderPage.tsx` | 62 | **нигде** (нет маршрута) | **delete after migration** | Единственный потребитель `components/ui/*` и `lib/cn.ts` |

---

## 3. Инвентарь: компоненты (src/components/**)

### 3.1 admin/

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `admin/AdminDashboard.tsx` | 258 | **нигде** | **delete after migration** | Старая админка; живая — `pages/AdminPage.tsx`. Единственный импортёр `styles/admin.css` |
| `admin/CreatePollSheet.tsx` | 261 | AdminPage, HomePage | preserve | |
| `admin/DataCleanupCard.tsx` | 88 | AdminPage | preserve | |
| `admin/DebtManagementCard.tsx` | 97 | AdminPage | preserve | |
| `admin/ReminderSettingsCard.tsx` | 107 | AdminPage | preserve | |
| `admin/SuccessSheet.tsx` | 47 | AdminPage | preserve | |
| `admin/UserManagementCard.tsx` | 88 | AdminPage | preserve | |
| `admin/types.ts` | 123 | AdminPage, HomePage, adminMappers, CreatePollSheet, AdminDashboard | preserve | После удаления AdminDashboard остаётся живым |

### 3.2 budget/ (живёт ТОЛЬКО через /budget-demo)

Вся ветка — вторая, параллельная реализация budget-виджета. На реальном экране Home рендерится `BudgetWidget` из `components/rl/homeWidgets.tsx`, а не этот.

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `budget/BudgetWidget.tsx` | 77 | BudgetDemoPage | **preserve logic, replace UI** | Импортирует `styles/budget.css` + `budget-overrides.css` |
| `budget/CalculatorModal.tsx` | 168 | BudgetDemoPage | **preserve logic, replace UI** | |
| `budget/subviews/admin.tsx` | 59 | BudgetWidget | **preserve logic, replace UI** | |
| `budget/subviews/hidden.tsx` | 13 | BudgetWidget | **preserve logic, replace UI** | |
| `budget/subviews/participant.tsx` | 167 | BudgetWidget | **preserve logic, replace UI** | |
| `budget/subviews/responsible.tsx` | 192 | BudgetWidget, participant | **preserve logic, replace UI** | |
| `budget/types.ts` | 66 | BudgetWidget, subviews, useBudgetWidget, budgetMappers | **preserve logic, replace UI** | Сценарная модель (6 сценариев) — ценность здесь |

Смежные живые-только-через-demo: `src/hooks/useBudgetWidget.ts` (100 строк, только BudgetDemoPage), `src/lib/budgetMappers.ts` (193 строки, только useBudgetWidget). Логику сценариев стоит слить с живым `homeWidgets.BudgetWidget`, после чего ветку удалить.

### 3.3 common/, layout/

| Файл | Строк | Используется где | Классификация |
|---|---|---|---|
| `common/ErrorBoundary.tsx` | 71 | App.tsx | preserve |
| `common/ToastContainer.tsx` | 45 | App.tsx | preserve |
| `layout/BottomNavigation.tsx` | 50 | App.tsx | preserve |
| `layout/Header.tsx` | 59 | App.tsx | preserve |

### 3.4 home/ — мёртвый слой целиком

Старый слой «Redisign v2»; живой Home собран из `rl/homeWidgets.tsx`.

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `home/ActionsGrid.tsx` | 39 | **нигде** | **delete after migration** | Импортирует lucide-react |
| `home/HeroCard.tsx` | 58 | **нигде** | **delete after migration** | |
| `home/InlineVotingCard.tsx` | 235 | только `import type { VoteOption }` из `lib/pollMappers.ts` + мёртвый WinnerCard | **delete after migration** | Type-only импорт стирается при сборке — в runtime-бандл компонент не попадает. Перед удалением перенести тип `VoteOption` в `src/types/` или в `pollMappers.ts` |
| `home/UrgentDebtBanner.tsx` | 21 | **нигде** | **delete after migration** | |
| `home/WinnerCard.tsx` | 127 | **нигде** | **delete after migration** | |

### 3.5 modals/

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `modals/DonationModal.tsx` | 110 | ProfilePage | preserve | Построен на `rl/BottomSheet` |
| `modals/FeedbackModal.tsx` | 97 | ProfilePage | preserve | Построен на `rl/BottomSheet` |
| `modals/Modal.tsx` | 70 | только мёртвые TopDishModal, WelcomeModal | **delete after migration** | Центрированный modal-примитив, конкурент BottomSheet |
| `modals/TopDishModal.tsx` | 58 | **нигде** | **delete after migration** | |
| `modals/WelcomeModal.tsx` | 104 | **нигде** | **delete after migration** | |

### 3.6 profile/ — мёртвый слой, кроме одного файла

Живой профиль — `pages/ProfilePage.tsx`; ветка `ProfileScreen` не подключена.

| Файл | Строк | Используется где | Классификация |
|---|---|---|---|
| `profile/EditPaymentInfoSheet.tsx` | 73 | ProfilePage | preserve |
| `profile/ProfileScreen.tsx` | 81 | **нигде** | **delete after migration** |
| `profile/FeedbackCard.tsx` | 43 | только ProfileScreen | **delete after migration** |
| `profile/HistoryScreen.tsx` | 79 | **нигде** | **delete after migration** |
| `profile/ProfileFoot.tsx` | 16 | только ProfileScreen | **delete after migration** |
| `profile/ProfileHero.tsx` | 26 | только ProfileScreen, ProfileStates | **delete after migration** |
| `profile/ProfileStates.tsx` | 53 | только ProfileScreen | **delete after migration** |
| `profile/ProfileStats3.tsx` | 23 | только ProfileScreen | **delete after migration** |
| `profile/RecentHistory.tsx` | 36 | только ProfileScreen | **delete after migration** |
| `profile/SettingsList.tsx` | 42 | только ProfileScreen | **delete after migration** |
| `profile/types.ts` | 81 | только мёртвые файлы + мёртвый `lib/profileMappers.ts` | **delete after migration** |

### 3.7 rl/ — живой слой редизайна «Графит и мёд»

| Файл | Строк | Используется где | Классификация | Заметка |
|---|---|---|---|---|
| `rl/homeWidgets.tsx` | **973** | HomePage, PollResultsPage | **refactor** | Монолит: HomeGreeting, EmptyPollCard, ActivePollWidget, CompletedPollWidget, BudgetWidget (живой!) + inline skeleton/spinner. Разрезать на файлы |
| `rl/primitives.tsx` | 417 | 23 файла (все страницы + admin/modals/rl) | preserve | Живой UI-kit: Spinner, Button, IconButton, Field, SearchBar, Switch, Checkbox, Badge, Chip, Segmented, Avatar, CountUp, Confetti, Dots |
| `rl/Icon.tsx` | 287 | 21 файл | preserve | Собственный SVG-набор; полностью заменяет lucide-react в живом коде |
| `rl/parts.tsx` | 171 | 6 страниц | preserve | BackHeader, CircularTimer, AvatarStack, Trophy, SectionTitle |
| `rl/BottomSheet.tsx` | 54 | 9 файлов (sheets, modals, pages) | preserve | Единственный живой modal-примитив |
| `rl/Fab.tsx` | 93 | HomePage, MenuPage | preserve | Единственная реализация FAB |
| `rl/CreateStoreRunSheet.tsx` | 63 | HomePage | preserve | |
| `rl/RouletteRevealOverlay.tsx` | 103 | PollResultsPage | preserve | |
| `rl/SchemeThemeToggle.tsx` | 28 | Header, ProfilePage | preserve | |

### 3.8 stats/ — мёртвый слой целиком

Живая статистика — `pages/StatsPage.tsx`; ветка `StatsScreen` не подключена. `styles/stats.css` импортируется только отсюда.

| Файл | Строк | Используется где | Классификация |
|---|---|---|---|
| `stats/StatsScreen.tsx` | 47 | **нигде** | **delete after migration** |
| `stats/InsightsView.tsx` | 32 | только StatsScreen | **delete after migration** |
| `stats/LeaderboardView.tsx` | 75 | только StatsScreen | **delete after migration** |
| `stats/OverviewView.tsx` | 130 | только StatsScreen | **delete after migration** |
| `stats/StatesView.tsx` | 56 | только StatsScreen | **delete after migration** |
| `stats/StatsTopBar.tsx` | 57 | только StatsScreen | **delete after migration** |
| `stats/types.ts` | 107 | только мёртвые stats/* | **delete after migration** |

### 3.9 ui/ — мёртвый kit целиком

Используется только неподключённым `PlaceholderPage.tsx`. Тянет за собой `lib/cn.ts` → зависимости `clsx` + `tailwind-merge`.

| Файл | Строк | Используется где | Классификация |
|---|---|---|---|
| `ui/Button.tsx` | 56 | только PlaceholderPage | **delete after migration** |
| `ui/Card.tsx` | 49 | только PlaceholderPage | **delete after migration** |
| `ui/Badge.tsx` | 34 | только PlaceholderPage | **delete after migration** |

---

## 4. Дубликаты примитивов

### Button
| Реализация | Кто использует |
|---|---|
| `src/components/rl/primitives.tsx` → `Button`, `IconButton` (variants/sizes, spinner-state) | **живая**, 23 потребителя |
| `src/components/ui/Button.tsx` → `Button` (clsx/tailwind-merge, свой inline-spinner) | только мёртвый PlaceholderPage |

### Card
| Реализация | Кто использует |
|---|---|
| CSS-класс `rl-card*` в `styles/redesign-v2.css` (120 `rl-*` классов) | живые страницы/виджеты |
| `src/components/ui/Card.tsx` → `Card`, `CardHeader` | только мёртвый PlaceholderPage |

### Badge / Chip
| Реализация | Кто использует |
|---|---|
| `src/components/rl/primitives.tsx` → `Badge` (tone), `Chip` | живая (HomePage и др.) |
| `src/components/ui/Badge.tsx` → `Badge` | только мёртвый PlaceholderPage |

### Modal / Sheet / BottomSheet
| Реализация | Кто использует |
|---|---|
| `src/components/rl/BottomSheet.tsx` → `BottomSheet` | **живая**: CreatePollSheet, SuccessSheet, DonationModal, FeedbackModal, EditPaymentInfoSheet, CreateStoreRunSheet, MenuPage, StoreRunPage, SuggestionsPage |
| `src/components/modals/Modal.tsx` → `Modal` (центрированный) | только мёртвые TopDishModal, WelcomeModal |
| `src/components/budget/CalculatorModal.tsx` (свой overlay, без общего примитива) | только demo-ветка budget |
| `src/components/rl/RouletteRevealOverlay.tsx` (свой fullscreen-overlay) | PollResultsPage — специализированный, не дубликат по сути |

### Loading / Skeleton / Spinner — 7 независимых реализаций
| Реализация | Статус |
|---|---|
| `rl/primitives.tsx` → `Spinner` | живая, канонічная |
| CSS-класс `skeleton` в `styles/redesign-v2.css` + inline-разметка в `rl/homeWidgets.tsx`, `pages/MenuPage.tsx`, `pages/PollHistoryPage.tsx`, `pages/StatsPage.tsx` | живые, но каждый экран верстает skeleton сам — нет общего компонента `<Skeleton>` |
| inline-spinner в `ui/Button.tsx` | мёртвая |
| inline-spinner в `budget/subviews/admin.tsx` | demo-only |
| `stats/StatesView.tsx` → `LoadingView` | мёртвая |
| `profile/ProfileStates.tsx` → `ProfileLoadingView` | мёртвая |

### Empty / Error state
| Реализация | Статус |
|---|---|
| `rl/homeWidgets.tsx` → `EmptyPollCard` | живая |
| `stats/StatesView.tsx` → `EmptyView` | мёртвая |
| `profile/ProfileStates.tsx` → `ProfileEmptyView` | мёртвая |
| `common/ErrorBoundary.tsx` | живая (глобальная) |
| Общего `<EmptyState>`/`<ErrorState>` примитива нет — экраны верстают сами | — |

### Заголовки экрана
| Реализация | Статус |
|---|---|
| `layout/Header.tsx` → `Header` (глобальный top bar) | живая |
| `rl/parts.tsx` → `BackHeader` (заголовок с «назад» для подстраниц) | живая — 6 страниц |
| `stats/StatsTopBar.tsx` → `StatsTopBar` | мёртвая |
| `ui/Card.tsx` → `CardHeader` | мёртвая |

### FAB
Единственная реализация: `src/components/rl/Fab.tsx` → `Fab` (+CSS `fab-*` в redesign-v2.css). Дубликатов нет; в мёртвом `styles/menu.css` остался класс `m-fab-sm`.

### BudgetWidget — главный «двойник» проекта
| Реализация | Статус |
|---|---|
| `rl/homeWidgets.tsx` → `BudgetWidget` | **живая** (HomePage) |
| `components/budget/BudgetWidget.tsx` + subviews + `useBudgetWidget` + `budgetMappers` (~1600 строк) | достижима только через `/budget-demo` |

---

## 5. Мёртвый код (сводный список к удалению)

**Компоненты/страницы (30 файлов, ~2150 строк):**
- `src/components/admin/AdminDashboard.tsx`
- `src/components/home/ActionsGrid.tsx`, `HeroCard.tsx`, `InlineVotingCard.tsx` (сначала вынести тип `VoteOption`), `UrgentDebtBanner.tsx`, `WinnerCard.tsx`
- `src/components/modals/Modal.tsx`, `TopDishModal.tsx`, `WelcomeModal.tsx`
- `src/components/profile/` — все, кроме `EditPaymentInfoSheet.tsx` (10 файлов, включая `types.ts`)
- `src/components/stats/` — целиком (7 файлов)
- `src/components/ui/` — целиком (3 файла)
- `src/pages/PlaceholderPage.tsx`

**lib/services (4 файла, ~200 строк):**
- `src/lib/cn.ts` (импортёры — только мёртвые ui/*)
- `src/lib/greeting.ts` (0 импортёров)
- `src/lib/profileMappers.ts` (0 импортёров)
- `src/services/index.ts` (barrel, 0 импортёров — сервисы импортируются напрямую)

**CSS (5 файлов, 1473 строки):** см. раздел 7.

**Прочее:** `src/vite-env.d.ts` формально «не импортируется», но это ambient-декларации TypeScript — **не удалять**.

---

## 6. Зависимости (package.json)

### dependencies
| Пакет | Импортов в src/ | Вердикт |
|---|---|---|
| `react`, `react-dom` | 41 / 1 | используется |
| `react-router-dom` | 10 | используется |
| `@tanstack/react-query` | 13 | используется |
| `axios` | 1 (`services/api.service.ts`) | используется |
| `zustand` | 2 (`store/useAppStore.ts`, `store/useToastStore.ts`) | используется |
| `@sentry/react` | 2 (`lib/sentry.ts`, `lib/monitoring.ts`) | используется |
| `framer-motion` | **0** | **не используется — удалить** |
| `recharts` | **0** | **не используется — удалить** |
| `clsx` | 1, но только в мёртвом `lib/cn.ts` | **удалить вместе с ui/*** |
| `tailwind-merge` | 1, но только в мёртвом `lib/cn.ts` | **удалить вместе с ui/*** |
| `lucide-react` | 5 файлов, **все мёртвые** (`home/ActionsGrid`, `home/InlineVotingCard`, `home/WinnerCard`, `modals/Modal`, `pages/PlaceholderPage`) | **эффективно не используется** — живые иконки идут через `rl/Icon.tsx`; удалить вместе с мёртвым кодом |

### devDependencies
`typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/*` — все нужны сборке. Ничего лишнего.

---

## 7. CSS-аудит (src/styles/)

| Файл | Строк | Импортируется где | Статус |
|---|---|---|---|
| `index.css` | 182 | `src/main.tsx` | живой: `@tailwind`-директивы + старый набор токенов (42 переменных: `--peach-400` и т.д.) |
| `redesign-v2.css` | 474 | `src/main.tsx` | живой: актуальный слой «Графит и мёд» (74 переменных, классы `rl-*`(120), `btn-*`(27), `fab-*`, `chip-*`, `field-*`, `badge-*`, `skeleton`) |
| `toast.css` | 90 | `common/ToastContainer.tsx` | живой |
| `budget.css` | 675 | `budget/BudgetWidget.tsx` | demo-only (загружается только через `/budget-demo`) |
| `budget-overrides.css` | 55 | `budget/BudgetWidget.tsx` | demo-only |
| `admin.css` | 262 | только мёртвый `admin/AdminDashboard.tsx` | **мёртвый** |
| `home.css` | 354 | **никем** | **мёртвый** |
| `menu.css` | 138 | **никем** | **мёртвый** |
| `profile.css` | 173 | только мёртвые `profile/ProfileScreen.tsx`, `profile/HistoryScreen.tsx` | **мёртвый** |
| `stats.css` | 546 | только мёртвый `stats/StatsScreen.tsx` | **мёртвый** (живой `pages/StatsPage.tsx` его не импортирует) |

**Конфликты:** `index.css` и `redesign-v2.css` оба грузятся из `main.tsx` и оба определяют токен-системы; прямое пересечение переменных одно — `--card-grad` (побеждает `redesign-v2.css` как загруженный вторым). Старые токены `index.css` частично продублированы хардкодом в `tailwind.config.js` (peach/lavender/mint/coral/butter). При рефакторинге стоит слить токены в один файл.

---

## 8. Тесты и линт — отсутствуют

- `package.json` scripts: только `dev`, `build`, `build:prod-dev`, `preview`, `type-check`. **Нет `test`, нет `lint`.**
- В корне `frontend-new/` **нет** конфигов eslint/vitest/jest/prettier (проверен полный список файлов корня).
- `vitest`, `eslint` не установлены даже в devDependencies.
- Единственная проверка качества — `tsc --noEmit` (`type-check`) и `tsc -b` внутри `build`.

**Смежная находка по сборке:** в корне закоммичены и `vite.config.ts`, и скомпилированные `vite.config.js` + `vite.config.d.ts` + `tsconfig.*.tsbuildinfo`. Vite при старте берёт `vite.config.js` (он в порядке разрешения раньше `.ts`), поэтому правки `vite.config.ts` вступают в силу только после `tsc -b`. В git status правится именно `.js` — источник правды двоится; стоит оставить один `.ts` и добавить артефакты в `.gitignore`.

---

## 9. Пересечение слоёв: components/home vs rl/homeWidgets vs ui

На экране реально живёт **только слой `rl/`**:

| Слой | Что это | На экране? |
|---|---|---|
| `components/rl/**` (homeWidgets, primitives, parts, Icon, BottomSheet, Fab) | редизайн «Графит и мёд» | **да** — единственный живой UI-слой |
| `components/home/**` | старый слой «Redisign v2» (виджеты Home) | нет — 0 живых импортов (кроме type-only `VoteOption`) |
| `components/ui/**` + `lib/cn.ts` | заготовка «классического» kit'а (clsx+tailwind-merge) | нет — использует только неподключённый PlaceholderPage |
| `components/stats/**`, `components/profile/**` (кроме EditPaymentInfoSheet), `components/modals/Modal|TopDish|Welcome`, `admin/AdminDashboard` | экраны до порта в `pages/*` | нет |
| `components/budget/**` | параллельный budget-виджет | только на `/budget-demo`; на Home рендерится `homeWidgets.BudgetWidget` |

Вывод: миграция на слой `rl/` фактически завершена, но старые слои не были удалены. Три поколения кода сосуществуют в репозитории, из них живо одно.
