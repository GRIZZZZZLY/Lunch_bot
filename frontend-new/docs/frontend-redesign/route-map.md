# Route Map — frontend-new (аудит маршрутов и app shell)

> Источник истины — код (`src/App.tsx:28-40`), состояние на 2026-07-17.
> Все ссылки `file:line` — внутри `frontend-new/`.

## 1. Текущие маршруты

Роутер: `BrowserRouter` (`App.tsx:19`). Все маршруты объявлены плоским списком внутри общего shell (`App.tsx:20-46`): `Header` (`App.tsx:21`) и `BottomNavigation` (`App.tsx:44`) стоят **вне** `<Routes>`, поэтому рендерятся на каждом маршруте. Lazy loading отсутствует — все 10 страниц импортируются статически (`App.tsx:6-15`), `React.lazy`/`Suspense` в src/ нет ни одного.

| Path | Route (App.tsx) | Компонент | Global Header | BottomNav | Внутренний BackHeader | Lazy | Точки входа в UI |
|---|---|---|---|---|---|---|---|
| `/` | `:29` | `HomePage` | да | да (таб, бейдж активных голосований `BottomNavigation.tsx:41`) | нет | нет | таб (`BottomNavigation.tsx:13`); CTA из пустого состояния Stats (`StatsPage.tsx:232`) |
| `/menu` | `:30` | `MenuPage` (default export) | да | да (таб) | нет | нет | таб (`BottomNavigation.tsx:14`); quick action «manage-menu» из админки (`AdminPage.tsx:76`) |
| `/stats` | `:31` | `StatsPage` | да | да (таб) | нет | нет | таб (`BottomNavigation.tsx:15`) |
| `/profile` | `:32` | `ProfilePage` | да | да (таб) | нет | нет | таб (`BottomNavigation.tsx:16`) |
| `/admin` | `:33` | `AdminPage` | да | да (ни один таб не активен) | нет (свои внутренние табы Обзор/Люди/Долги/Очистка/Напомин., `AdminPage.tsx:23-30`) | нет | **нет ни одной внутренней навигации** — только прямой URL |
| `/budget-demo` | `:34` | `BudgetDemoPage` | да | да | нет | нет | **нет** — dev-витрина `BudgetWidget` |
| `/poll/history` | `:35` | `PollHistoryPage` | да | да | да (`PollHistoryPage.tsx:24`, `onBack={() => navigate(-1)}`) | нет | Profile → «История голосований» (`ProfilePage.tsx:96`) |
| `/poll/:id/results` | `:36` | `PollResultsPage` | да | да | да (`PollResultsPage.tsx:51`, `navigate(-1)`; плюс `onToggle={() => navigate(-1)}` на виджете `:67`) | нет | история (`PollHistoryPage.tsx:60`); админ-дашборд (`AdminPage.tsx:131`); deep-link redirect (`HomePage.tsx:92`); «детали» последнего опроса (`HomePage.tsx:389`) |
| `/store-run/:id` | `:37` | `StoreRunPage` | да | да | да (`StoreRunPage.tsx:56-58`, `navigate(-1)`) | нет | после создания закупки (`HomePage.tsx:317`); карточка активной закупки (`HomePage.tsx:353`) |
| `/suggestions` | `:38` | `SuggestionsPage` | да | да | да (`SuggestionsPage.tsx:51-55`, `navigate(-1)`, + action-кнопка «plus») | нет | **прямых переходов нет** (внутри страницы чипы Все/Мои переключают состояние, не URL — `SuggestionsPage.tsx:60-66`) |
| `/suggestions/mine` | `:39` | `SuggestionsPage onlyMine` | да | да | да (тот же) | нет | FAB на Home (`HomePage.tsx:329`); Profile → «Мои предложения» (`ProfilePage.tsx:95`) |

Fallback-маршрута (`*` / 404) нет — неизвестный path рендерит пустой `<main>` c Header и BottomNav.
`PlaceholderPage.tsx` существует (61 строка), но не привязан ни к какому маршруту и никем не импортируется.

## 2. Задокументированные проблемы shell

1. **Глобальный shell на detail-экранах.** `Header` («Rocket Lunch» + переключатель темы) и `BottomNavigation` рендерятся на всех маршрутах, включая detail (`App.tsx:21,44`). На `/poll/:id/results`, `/poll/history`, `/store-run/:id`, `/suggestions*` под глобальной шапкой (sticky, 56px, `Header.tsx:12-22`) рендерится второй заголовок `BackHeader` (`parts.tsx:7-31`) — двухэтажная навигация: «Rocket Lunch» и тут же «История голосований» со стрелкой назад.

2. **Назад — только in-page кнопкой, Telegram BackButton не задействован.** Все 4 detail-страницы делают `navigate(-1)` через собственный `BackHeader` (`PollHistoryPage.tsx:24`, `PollResultsPage.tsx:51`, `StoreRunPage.tsx:58`, `SuggestionsPage.tsx:53`). `Telegram.WebApp.BackButton` объявлен в типах (`lib/telegram.ts:59-65`), но нигде не вызывается (grep по src/ — только объявление). Аппаратный/системный «назад» Telegram-клиента не синхронизирован с роутером.

3. **BottomNavigation активна там, где не должна.** На `/admin`, `/budget-demo`, `/poll/*`, `/store-run/*`, `/suggestions*` ни один таб не подсвечен, но бар занимает место (fixed, `bottom: calc(12px + env(safe-area-inset-bottom))`, `BottomNavigation.tsx:30`) и `<main>` резервирует под него 88px (`App.tsx:25`). Плюс `useActivePolls()` для бейджа (`BottomNavigation.tsx:20-21`) выполняется на каждом экране.

4. **Тема: двойная подписка на `themeChanged` без отписки и с конфликтом.** `lib/telegram.ts:116-119` (ставит `data-theme = wa.colorScheme`, игнорируя ручной override) и `main.tsx:38` (`applyTheme`, учитывает `localStorage['rl-theme']`, `main.tsx:18-33`) слушают одно событие; `offEvent` не вызывается нигде. Итог при активном override зависит от порядка регистрации; обработчик из telegram.ts не трогает класс `.dark` → возможен рассинхрон с `applyTheme` (`main.tsx:31`). Подробнее — code-map.md §5.

5. **Safe area только снизу и только через CSS.** `env(safe-area-inset-bottom)` в 5 местах (`App.tsx:25`, `BottomNavigation.tsx:30`, `Fab.tsx:41`, `BottomSheet.tsx:35`, `ProfilePage.tsx:39`); `safe-area-inset-top` не используется, Telegram viewport API (`viewportHeight`/`viewportStableHeight`, объявлены `lib/telegram.ts:31-32`) и события `viewportChanged`/`safeAreaChanged` не читаются. Fullscreen-режимы новых клиентов Telegram шапкой не учитываются.

6. **`Header` — фиктивно настраиваемый.** Принимает `title`/`right` (`Header.tsx:5-10`), но единственный call-site `App.tsx:21` — без props. Страницы не могут задать контекстный заголовок через shell — вместо этого городят собственный `BackHeader`.

7. **Маршруты-сироты.** `/admin` недостижим из UI (нет ни `navigate('/admin')`, ни `Link`), `/budget-demo` — dev-артефакт, `/suggestions` (без `/mine`) не имеет прямых входов. `PlaceholderPage` — мёртвый файл.

8. **Нет code splitting и нет 404.** Все страницы в одном чанке (`App.tsx:6-15`, grep `lazy(` — пусто); неизвестный URL рендерит пустой экран без сообщения.

## 3. Предложение: классификация root-tab vs pushed-detail

Правила из брифа: root tabs — Home, Menu, Stats(?), Profile; pushed — результаты опросов, история, предложения, закупка, админка, create/edit-флоу.

### Root-tab экраны (полный shell)
Показывают: глобальный `Header` + `BottomNavigation`. Telegram BackButton скрыт.

| Path | Экран | Примечание |
|---|---|---|
| `/` | HomePage | таб «Главная», бейдж активных голосований |
| `/menu` | MenuPage | таб «Меню» |
| `/stats` | StatsPage | таб «Статистика»; кандидат на пересмотр (по брифу «Stats?») — если уйдёт из табов, становится pushed-экраном из Profile |
| `/profile` | ProfilePage | таб «Профиль» |

### Pushed-detail экраны (без BottomNavigation, назад через Telegram BackButton)
Показывают: компактный контекстный заголовок (единый, вместо нынешней пары Header+BackHeader). `BottomNavigation` скрыт, паддинг `<main>` без резерва 88px. Навигация назад: `Telegram.WebApp.BackButton.show()` + `onClick(() => navigate(-1))` при mount, `hide()`/`offClick` при unmount (сейчас API объявлен в `lib/telegram.ts:59-65`, но не используется); in-page стрелка остаётся fallback-ом для десктопа/браузера.

| Path | Экран | Откуда пушится |
|---|---|---|
| `/poll/:id/results` | PollResultsPage | Home (последний опрос, deep-link не-ACTIVE), PollHistory, Admin |
| `/poll/history` | PollHistoryPage | Profile |
| `/suggestions`, `/suggestions/mine` | SuggestionsPage | Home (FAB), Profile |
| `/store-run/:id` | StoreRunPage | Home (карточка/создание закупки) |
| `/admin` | AdminPage | требуется добавить точку входа (например, Row в Profile для админов) — сейчас недостижим из UI |
| create/edit-флоу | сейчас реализованы как `BottomSheet` поверх страниц (`CreatePollSheet` на Home/Admin, `CreateStoreRunSheet` на Home, форма в SuggestionsPage) | если останутся шторками — классификация не нужна; если станут экранами — pushed |

### Технический эскиз внедрения
1. Ввести layout-маршруты: `<Route element={<TabShell/>}>` (Header + BottomNav + Outlet) для 4 табов и `<Route element={<DetailShell/>}>` (контекстный заголовок + Outlet + управление Telegram BackButton) для остальных — тогда `App.tsx:21,44` перестают быть безусловными.
2. `DetailShell` центральное место для: показа/скрытия `BackButton`, заголовка страницы (через prop/route handle), отключения нижнего паддинга 88px из `App.tsx:25`.
3. Удалить локальные `BackHeader` из 4 страниц (`PollHistoryPage.tsx:24`, `PollResultsPage.tsx:51`, `StoreRunPage.tsx:56`, `SuggestionsPage.tsx:51`) в пользу заголовка `DetailShell` (action-слот, как у `SuggestionsPage.tsx:54`, сохранить).
4. `/budget-demo` — исключить из prod-роутинга (или спрятать за `import.meta.env.DEV`); `PlaceholderPage.tsx` удалить; добавить маршрут `*` с заглушкой.
