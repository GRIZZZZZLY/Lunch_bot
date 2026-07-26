# Code Map — frontend-new (аудит app shell и Telegram-интеграции)

> Источник истины — код на ветке `main`, состояние на 2026-07-17.
> Все ссылки вида `file:line` указывают на файлы внутри `frontend-new/`.

## 1. Точки входа

### index.html
- `index.html:19` — CDN-скрипт `https://telegram.org/js/telegram-web-app.js` подключается синхронно в `<head>` **до** бандла приложения.
- `index.html:12-17` — шрифты Google Fonts: `Unbounded` (500/600/700) + `Onest` (400–800), с `preconnect`.
- `index.html:5` — `viewport-fit=cover` (обязательное условие для работы `env(safe-area-inset-*)`).
- `index.html:23` — единственный entry: `/src/main.tsx`.

### Цепочка запуска (main.tsx)
Порядок выполнения при загрузке модуля `src/main.tsx`:

| Шаг | Код | Что делает |
|---|---|---|
| 1 | `main.tsx:13` `initSentry()` | инициализация Sentry (`src/lib/sentry.ts`, 31 строка) |
| 2 | `main.tsx:14` `installGlobalHandlers()` | глобальные обработчики ошибок (`src/lib/monitoring.ts`) |
| 3 | `main.tsx:35` `applyTheme()` | первичное применение темы: localStorage `rl-theme` → `tg.colorScheme` → `prefers-color-scheme` (`main.tsx:18-33`) |
| 4 | `main.tsx:37` `initTelegramWebApp()` | `ready()` + `expand()` + синхронизация header/background + подписка на `themeChanged` (`src/lib/telegram.ts:105-122`) |
| 5 | `main.tsx:38` | **вторая** подписка на `themeChanged` → `applyTheme` |
| 6 | `main.tsx:40` | подписка на `matchMedia('(prefers-color-scheme: dark)')` → `applyTheme` |
| 7 | `main.tsx:42-44` `bootstrapAuth()` | асинхронная аутентификация, запускается fire-and-forget **до** рендера |
| 8 | `main.tsx:46-52` | `ReactDOM.createRoot(...).render(<QueryClientProvider><App/></QueryClientProvider>)` в `StrictMode` |

### bootstrapAuth (src/lib/bootstrap.ts)
- `bootstrap.ts:7-39` — единственная функция: `getInitData()` → `authService.validateInitData()` → `setToken` → загрузка групп (`userService.getMyGroups()`, `bootstrap.ts:20-22`) и выбор активной группы **до** переключения `authStatus` в `authenticated` (комментарий `bootstrap.ts:17-18`), чтобы первые group-scoped запросы уже несли `groupId`.
- Результат кладётся в Zustand: `setUser`, `setAuthStatus`, `setCurrentGroupId` (`bootstrap.ts:22,26-27`).

### App.tsx (shell)
- `App.tsx:19-47` — `BrowserRouter` → колонка `max-w-[430px]` → `Header` (`App.tsx:21`) → `<main>` с `paddingBottom: calc(88px + env(safe-area-inset-bottom))` (`App.tsx:25`) → `ErrorBoundary` → `Routes` (`App.tsx:28-40`) → `BottomNavigation` (`App.tsx:44`) → `ToastContainer` (`App.tsx:45`).
- **Header и BottomNavigation стоят вне `<Routes>` — рендерятся на всех 11 маршрутах без исключений.**
- Все страницы импортируются статически (`App.tsx:6-15`) — `React.lazy`/`Suspense` в src/ отсутствуют полностью (grep `lazy\(|Suspense` — 0 совпадений). Code splitting по маршрутам нет.
- `App.tsx:11` — `MenuPage` единственная страница с default export, остальные named.

## 2. Карта модулей src/

| Папка | Файлов | Строк | Назначение |
|---|---|---|---|
| `src/pages/` | 11 | 2849 | экраны-маршруты; крупнейшие: `MenuPage.tsx` (581), `HomePage.tsx` (511), `StatsPage.tsx` (421), `StoreRunPage.tsx` (314), `AdminPage.tsx` (271), `SuggestionsPage.tsx` (247), `ProfilePage.tsx` (218), `PollResultsPage.tsx` (100), `PollHistoryPage.tsx` (95), `PlaceholderPage.tsx` (61, **сирота — не импортируется никем**), `BudgetDemoPage.tsx` (30) |
| `src/components/` | 59 | 6281 | по доменам, см. таблицу ниже |
| `src/hooks/` | 14 | 1169 | React Query-обёртки над services: `useAdmin` (214), `usePolls` (166), `useStoreRun` (143), `useSSE` (112), `useBudgetWidget` (99), `useBudget` (89), `useMenu` (87), `useRecurringPoll` (75), `useSuggestions` (61), `useUser` (58), `useToast` (26), `useStreak` (16), `useAuth` (15), `useFeedback` (8) |
| `src/services/` | 12 | 860 | HTTP-слой: `api.service.ts` (125, axios-клиент), доменные сервисы `admin` (143), `store-run` (110), `polls` (94), `auth` (88), `suggestions` (58), `recurring-poll` (59), `user`/`menu`/`budget` (по 52), `feedback` (21), `index.ts` |
| `src/store/` | 2 | 71 | Zustand: `useAppStore.ts` (36 — user, authStatus, authError, currentGroupId), `useToastStore.ts` (35) |
| `src/lib/` | 13 | 1025 | инфраструктура: `telegram.ts` (158), `budgetMappers` (192), `profileMappers` (110), `adminMappers` (106), `pollMappers` (96), `streakCalc` (80), `greeting` (71), `queryClient` (59), `appearance` (41), `bootstrap` (39), `monitoring` (36), `sentry` (31), `cn` (6) |
| `src/styles/` | 10 | 2939 | CSS: `budget.css` (674), `stats.css` (545), `redesign-v2.css` (473, токены «Графит и мёд»), `home.css` (353), `admin.css` (261), `index.css` (181), `profile.css` (172), `menu.css` (137), `toast.css` (89), `budget-overrides.css` (54) |
| `src/types/` | 2 | 131 | `models.ts` (105), `api.ts` (26) |

### src/components/ по подпапкам

| Подпапка | Строк | Ключевые файлы |
|---|---|---|
| `rl/` | 2180 | дизайн-система «Графит и мёд»: `primitives.tsx` (Button, Chip, Badge, Avatar, IconButton), `parts.tsx` (**BackHeader** `parts.tsx:7-31`, CircularTimer, SectionTitle), `Icon.tsx`, `Fab.tsx`, `BottomSheet.tsx`, `SchemeThemeToggle.tsx`, `homeWidgets.tsx`, `CreateStoreRunSheet.tsx`, `RouletteRevealOverlay.tsx` |
| `admin/` | 939 | `CreatePollSheet`, `SuccessSheet`, `UserManagementCard`, `DebtManagementCard`, `DataCleanupCard`, `ReminderSettingsCard`, `AdminDashboard`, `types.ts` |
| `budget/` | 670 (рекурсивно, вкл. `subviews/`) | `BudgetWidget.tsx` + subviews (в т.ч. admin-subviews) |
| `home/` | 475 | виджеты HomePage |
| `profile/` | 462 | виджеты ProfilePage |
| `modals/` | 434 | `FeedbackModal` и др. |
| `stats/` | 391 | виджеты StatsPage |
| `common/` | 114 | `ErrorBoundary.tsx`, `ToastContainer.tsx` |
| `ui/` | 136 | базовые UI-элементы |
| `layout/` | 107 | `Header.tsx` (58), `BottomNavigation.tsx` (49) |

## 3. Кто кого импортирует (верхний уровень)

```
index.html ── telegram-web-app.js (CDN), fonts
    └─ main.tsx
        ├─ styles/index.css, styles/redesign-v2.css
        ├─ lib/sentry, lib/monitoring
        ├─ lib/telegram   (getWebApp, initTelegramWebApp)
        ├─ lib/queryClient (QueryClient instance + queryKeys)
        ├─ lib/bootstrap ──┬─ services/auth.service
        │                  ├─ services/user.service
        │                  └─ store/useAppStore
        └─ App.tsx
            ├─ components/layout/{Header, BottomNavigation}
            ├─ components/common/{ErrorBoundary, ToastContainer}
            └─ pages/* (11 статических импортов, App.tsx:6-15)
```

- `Header` (`components/layout/Header.tsx:10`) принимает props `title`/`right`, но единственный call-site — `App.tsx:21` `<Header />` без props: **props-API мёртвый**, заголовок всегда «Rocket Lunch».
- `BottomNavigation` (`BottomNavigation.tsx:20`) сам ходит за данными: `useActivePolls()` для бейджа — значит опрос активных голосований выполняется на каждом маршруте, включая detail-экраны.
- Страницы никогда не импортируют друг друга; общие виджеты — через `components/rl/` и доменные папки. `HomePage` и `AdminPage` разделяют `components/admin/CreatePollSheet` (`HomePage.tsx:24`, `AdminPage.tsx:3`).

## 4. Поток данных

```
axios (api.service.ts) → services/*.service.ts → hooks/use*.ts (React Query) → pages/*.tsx
                                                        ↕
                         store/useAppStore (auth, currentGroupId) — Zustand
                                                        ↕
                         lib/*Mappers.ts (API-модель → UI-props)
```

- **`services/api.service.ts`**: axios-инстанс; `baseURL = '/api'` в production, иначе `VITE_API_URL` (`api.service.ts:12-15`); токен из `sessionStorage['auth_token']`; request-interceptor добавляет `Authorization: Bearer` и **автоматически инжектит `groupId`** из `useAppStore.getState().currentGroupId` в query-параметры каждого запроса (`api.service.ts:25-36`) — мульти-тенантность прозрачна для вызывающих.
- **`lib/queryClient.ts:3-15`** — глобальные дефолты: `retry: 1`, `refetchOnWindowFocus: true`, `staleTime: 30s`, `gcTime: 5m`. `queryKeys` (`queryClient.ts:17-59`) — единый реестр ключей (polls, menu, suggestions, budget, storeRuns, admin).
- **Real-time**: `hooks/useSSE.ts` — EventSource на активное голосование с backoff-реконнектом (`useSSE.ts:21-22`: задержки 1–15 с, до 20 попыток); подключается из `HomePage.tsx:101`.
- **Mappers** (`lib/adminMappers.ts`, `pollMappers.ts`, `budgetMappers.ts`, `profileMappers.ts`) — чистые функции преобразования ответа API в props виджетов; вызываются в страницах через `useMemo` (пример: `AdminPage.tsx:55-58` `buildDashboard`).

## 5. Telegram-интеграция (src/lib/telegram.ts)

- `telegram.ts:20-71` — рукописный тип `TelegramWebApp` (не SDK-пакет): объявлены `MainButton` (`:42-58`), `BackButton` (`:59-65`), `HapticFeedback` (`:66-70`), `viewportHeight`/`viewportStableHeight` (`:31-32`).
- **Использование в UI: ноль.** grep `MainButton|BackButton|HapticFeedback` по src/ находит только сами объявления типов (`telegram.ts:42,59,66`). `viewportHeight`/`viewportStableHeight` тоже нигде не читаются. Из всего Telegram API реально используются: `ready`, `expand`, `colorScheme`, `themeParams` (косвенно), `setHeaderColor`/`setBackgroundColor` (`telegram.ts:92-93`), `initData`/`initDataUnsafe.start_param`, `onEvent('themeChanged')`.
- `initTelegramWebApp()` (`telegram.ts:105-122`): `wa.ready()` (`:109`) и `wa.expand()` (`:110`) — **вызываются ровно по одному разу за жизнь приложения** (единственный call-site `main.tsx:37`).
- `syncTelegramChrome()` (`telegram.ts:85-97`) — красит header/background Telegram в токен `--bg-base`; `resyncTelegramChrome()` (`:100-103`) дёргается из `lib/appearance.ts:40` при ручной смене темы.
- **Deep link** — `getDeepLinkPollId()` (`telegram.ts:145-158`): сначала `?pollId=` из `window.location.search` (`:147`), затем `initDataUnsafe.start_param` со срезанием префикса `vote_` (`:153-155`). Единственный потребитель — `HomePage.tsx:83` (`useMemo` при монтировании): найденный опрос подменяет активный (`HomePage.tsx:87`), а если он не `ACTIVE` — редирект на `/poll/:id/results` с `replace: true` (`HomePage.tsx:90-94`). Отдельного роута обработки deep link нет — всё завязано на HomePage как стартовый маршрут.

### Обработка темы — 3 подписки + 1 императивный сеттер, без отписок

| # | Где | Что делает | Отписка |
|---|---|---|---|
| 1 | `lib/telegram.ts:116-119` (внутри `initTelegramWebApp`) | анонимный обработчик `themeChanged`: `data-theme = wa.colorScheme` + `syncTelegramChrome` — **игнорирует ручной override `rl-theme`** | нет (`offEvent` не вызывается нигде в src/) |
| 2 | `main.tsx:38` | `applyTheme` — учитывает `localStorage['rl-theme']` (`main.tsx:18-33`) | нет |
| 3 | `main.tsx:40` | `matchMedia('prefers-color-scheme')` → `applyTheme` | нет |
| 4 | `lib/appearance.ts:35-41` `setTheme()` | ручной переключатель (из `SchemeThemeToggle`): пишет `data-theme`, класс `.dark`, localStorage, `resyncTelegramChrome()` | — |

Конфликт: обработчики #1 и #2 висят на одном событии и пишут в один атрибут `data-theme` разные значения при активном override (например, override=`light`, Telegram переключился в dark: #1 поставит `dark`, #2 вернёт `light`). Итог зависит от порядка вызова обработчиков (сейчас #1 регистрируется первым в `main.tsx:37`, #2 вторым — «правильный» побеждает случайно). Кроме того, #1 не трогает класс `.dark`, а `applyTheme` трогает (`main.tsx:31`) — возможен рассинхрон `data-theme` ↔ `.dark`. Централизованного менеджера темы нет.

### Safe area
Обрабатывается **только** через CSS `env(safe-area-inset-bottom)`, Telegram viewport/safe-area API не используется:
- `App.tsx:25` — паддинг `<main>`;
- `components/layout/BottomNavigation.tsx:30` — позиция плавающего нав-бара;
- `components/rl/Fab.tsx:41` — позиция FAB;
- `components/rl/BottomSheet.tsx:35` — нижний паддинг шторки;
- `pages/ProfilePage.tsx:39` — нижний паддинг списка.

`safe-area-inset-top` не используется нигде; события `viewportChanged`/`safeAreaChanged` не слушаются.

## 6. Прочие наблюдения

- `pages/PlaceholderPage.tsx` — не подключён ни к одному маршруту и не импортируется (grep `PlaceholderPage` — только сам файл). Мёртвый код.
- `pages/BudgetDemoPage.tsx` — маршрут `/budget-demo` (`App.tsx:34`) существует, но ни одной внутренней навигации на него нет: чисто dev-витрина `BudgetWidget`.
- Кнопка «назад» в `BackHeader` — иконка `chevronRight`, повёрнутая на 180° (`components/rl/parts.tsx:20-23`).
- Аутентификация стартует до рендера и не блокирует его: страницы обязаны сами обрабатывать `authStatus !== 'authenticated'` (через `useAuth`).
