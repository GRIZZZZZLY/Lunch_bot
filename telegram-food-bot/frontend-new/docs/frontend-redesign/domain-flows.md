# Доменные потоки frontend-new — как они реализованы в коде

Аудит от 2026-07-17. Источник истины — код `frontend-new/src`, не README.
Все пути относительно `frontend-new/`. Формат ссылок: `file:line`.

Цель: при редизайне ни один из описанных потоков не должен потеряться.

---

## 0. Инфраструктура (общая для всех доменов)

### 0.1 Bootstrap и авторизация

- Точка входа: `src/main.tsx:42` — `bootstrapAuth()` вызывается один раз при старте, вне React.
- `src/lib/bootstrap.ts:7-39`:
  1. `authStatus = 'authenticating'` (`:9`);
  2. `getInitData()` из Telegram WebApp (`src/lib/telegram.ts:124-133`; dev-заглушка `VITE_DEV_INIT_DATA`);
  3. `POST /auth/validate` (`src/services/auth.service.ts:30-49`), токен → `apiService.setToken` (sessionStorage, ключ `auth_token`, `src/services/api.service.ts:5,68-71`);
  4. **до** установки `authStatus='authenticated'` резолвится активная группа: `GET /user/groups`, берётся первая `isActive` или `groups[0]` → `setCurrentGroupId(String(active.id))` (`src/lib/bootstrap.ts:19-22`);
  5. при ошибке — `authStatus='error'` + `authError` (`:31-33, :36-37`).
- `useAuth` (`src/hooks/useAuth.ts:3-15`) — только чтение zustand: `user`, `status`, `error`, `isAuthenticated`, `isLoading` (`isLoading = authenticating || idle`, т.е. при `error` isLoading=false).
- Стор: `src/store/useAppStore.ts:19-36` — `user`, `authStatus`, `authError`, `currentGroupId`. Не персистится.

### 0.2 API-клиент

`src/services/api.service.ts`:
- baseURL: prod `/api`, dev `VITE_API_URL` (`:12-15`).
- Request-interceptor (`:25-36`): Bearer-токен + **автоматическая подстановка `groupId` в query каждого запроса** из `useAppStore.getState().currentGroupId`. Явные `config.params` перекрывают инжект (`{ groupId, ...(config.params ?? {}) }`, `:33`).
- Response-interceptor (`:38-65`): при 401 — `clearToken()` (`:43`), **без** повторной авторизации, редиректа или сообщения пользователю. Ошибки нормализуются в `{ success:false, error, code, status }`.

### 0.3 React Query

`src/lib/queryClient.ts`:
- дефолты: `retry:1`, `refetchOnWindowFocus:true`, `staleTime:30s`, `gcTime:5m` (`:3-15`);
- реестр ключей `queryKeys` (`:17-59`): `polls.*`, `menu.*`, `suggestions.*`, `budget.*`, `storeRuns.*`, `admin.*`, `me`.

### 0.4 SSE realtime

`src/hooks/useSSE.ts:35-112`:
- URL `GET /api/polls/:pollId/stream?token=<jwt>` — токен в query, не в заголовке (`:24-33`);
- событие `poll_updated` инвалидирует `polls.byId`, `polls.active`, `polls.myVotes`, `polls.results` (`:72-83`);
- reconnect с backoff `[1s,2s,5s,10s,15s]`, максимум 20 попыток (`:21-22, :85-98`);
- статус (`idle|connecting|connected|disconnected|error`) возвращается, но нигде в UI не отображается.
- Подключения: HomePage `:101` (активный опрос), PollResultsPage `:21` (только пока `status === 'ACTIVE'`).

### 0.5 Роутинг и навигация

`src/App.tsx:28-40` — 11 маршрутов: `/`, `/menu`, `/stats`, `/profile`, `/admin`, `/budget-demo`, `/poll/history`, `/poll/:id/results`, `/store-run/:id`, `/suggestions`, `/suggestions/mine`.
- `BottomNavigation` (`src/components/layout/BottomNavigation.tsx:12-17`) — только 4 пункта: Главная/Меню/Статистика/Профиль; бейдж на «Главной» = число активных опросов (`:20-21,41`).
- **`/admin` и `/budget-demo` не доступны из навигации** — только прямой URL.
- `Header` (`src/components/layout/Header.tsx`) — лого + `SchemeThemeToggle`, никакой логики.
- Тема: ручной override `localStorage['rl-theme']` > Telegram colorScheme > prefers-color-scheme (`src/main.tsx:18-40`); синхронизация header/background Mini App — `src/lib/telegram.ts:85-122`.

### 0.6 Тосты

`src/store/useToastStore.ts` + `src/hooks/useToast.ts` + `ToastContainer` в `App.tsx:45`. Почти все мутации пушат success/error-тосты из хуков (см. домены).

---

## 1. Polls (голосования)

### 1.1 Endpoints (все — `src/services/polls.service.ts`)

| Метод | Endpoint | Строка |
|---|---|---|
| getActive | `GET /polls/active` | :26-28 |
| getActiveForGroup | `GET /polls/active/:groupId` (не используется в UI) | :30-32 |
| getById | `GET /polls/:id` | :34-36 |
| getResults | `GET /polls/:pollId/results` | :38-40 |
| getHistory | `GET /polls` (limit/offset/groupId) | :42-54 |
| getLastCompleted | `GET /polls/last-completed` | :56-59 |
| createFromWebapp | `POST /polls/create-from-webapp` | :65-67 |
| vote | `POST /polls/:pollId/vote` `{menuItemId}` | :69-71 |
| voteMultiple | `POST /polls/:pollId/vote-multiple` — **нигде не вызывается** | :73-75 |
| getMyVotes | `GET /polls/:pollId/my-votes` → `{menuItemIds:[]}` | :77-79 |
| withdrawVote | `DELETE /polls/:pollId/vote` | :81-83 |
| complete | `PATCH /polls/:pollId/complete` | :85-87 |
| cancel | `PATCH /polls/:pollId/cancel` `{reason}` | :89-91 |

### 1.2 Query keys / хуки (`src/hooks/usePolls.ts`)

- `useActivePolls` — key `['polls','active']`, `staleTime:0`, `refetchInterval:30s`, enabled по auth (`:13-25`). `useActivePoll` = первый элемент (`:27-30`).
- `usePollById(id)` — `['polls', id]` (`:32-43`).
- `useLastCompletedPoll` — `['polls','last-completed']`, refetch 15s (`:45-57`).
- `usePollResults(id)` — `['polls', id, 'results']` (`:59-70`).
- `useMyVotes(id)` — `['polls', id, 'my-votes']`; **не гейтится по authStatus** (`:72-82`).
- Мутации и инвалидации:
  - `useVote` → invalidate active, byId, myVotes + тост «Голос учтён» (`:84-100`);
  - `useWithdrawVote` → invalidate active, myVotes + тост «Голос снят» (`:113-127`);
  - `useCreatePoll` → invalidate active, last-completed (`:102-111`);
  - `useCompletePoll` / `useCancelPoll` (admin) → invalidate active, byId, last-completed + тосты (`:129-166`).

### 1.3 Поток голосования на HomePage

- Активный опрос: deep link имеет приоритет над `useActivePoll` (`src/pages/HomePage.tsx:83-88`).
- Deep link: `?pollId=` в URL или `start_param` формата `vote_<id>` (`src/lib/telegram.ts:145-158`); если опрос не ACTIVE — редирект на `/poll/:id/results` (`HomePage.tsx:90-94`).
- View-model опций: `mapPollToOptions` (`src/lib/pollMappers.ts:31-79`) — приоритет `selectedMenuItemIds` (JSON-строка или массив) + обогащение из меню, чтобы блюда с 0 голосов не исчезали; подсчёт голосов из `menuItems[]._count.votes` или сырого `votes[]`.
- **Выбор одиночный**: `selectedId: number|null` (`HomePage.tsx:125`), `myChoiceId = myVotesData.menuItemIds[0]` (`:137`), `useVote` шлёт один `menuItemId` (`:477-479`). При этом опрос **создаётся** с `isMultiSelect:true, maxSelections:3` (`:268-269`; `AdminPage.tsx:89-90`). `voteMultiple` в UI не подключён — multi-select фактически не реализован на фронте.
- Отзыв голоса: кнопка «Изменить» в плашке «Ваш голос учтён» (`src/components/rl/homeWidgets.tsx:396-401`) → `withdrawMutation` (`HomePage.tsx:480`).
- Admin-панель виджета: шестерёнка → «Закрыть досрочно» (`completePoll`) / «Отменить» (`cancelPoll`) (`homeWidgets.tsx:416-427`, `HomePage.tsx:483-486`). Права = `canCreate` (см. 1.5).
- UI-состояния: loading-скелетоны (`HomePage.tsx:413-419`, `homeWidgets.tsx:253-266`), error-карточка (`:421-432`), empty `EmptyPollCard` (`homeWidgets.tsx:112-199`) с CTA только при `canCreate`.

### 1.4 Создание опроса (разовый и recurring)

- Форма: `CreatePollSheet` (`src/components/admin/CreatePollSheet.tsx`) — группа (чипы, если >1 админ-группы, `:100-111`), длительность 15м/30м/1ч/custom (`:7-12,113-120`), переключатель «Повторяющийся опрос» (`:122-143`) с днями недели и временем (`:145-163`), выбор блюд с валидацией min 2 / max 8 (`:70-79,165-198`; `maxItems = min(8, max(2, items.length))` — `HomePage.tsx:225`), аудитория (radio, реально только «Вся группа», `:200-234`).
- Сабмит разового: `POST /polls/create-from-webapp` с `groupId, duration, selectedMenuItems, title?, isMultiSelect:true, maxSelections:3` (`HomePage.tsx:263-271`). Выбор группы: форма → текущая → первая админская (`:232-240`, комментарий о старом баге «опрос молча уходил не в ту группу»).
- Recurring: `POST /recurring` с `groupId, daysOfWeek (0-6, Вс=0), timeOfDay, duration, selectedMenuItemIds|null` (`HomePage.tsx:250-261`, маппинг дней `:54-56`).
- Recurring CRUD целиком: `src/services/recurring-poll.service.ts` (`GET/POST /recurring`, `PATCH /recurring/:id`, `PATCH /recurring/:id/toggle`, `DELETE /recurring/:id`) + `src/hooks/useRecurringPoll.ts` (key `['recurring', groupId]`, тосты). **`useRecurringSchedule`/update/toggle/delete не имеют UI** — из интерфейса можно только создать расписание; посмотреть/выключить/удалить его негде.
- Форма пересобирается на каждое открытие шита (`CreatePollSheet.tsx:52-59`); смена группы сбрасывает выбранные блюда и дёргает `onGroupChange` → родитель перезагружает меню группы (`:61-66`, `HomePage.tsx:110,210-211,408`).

### 1.5 Права на создание/управление

`HomePage.tsx:198-207`: `adminGroups` = активные группы, где `user.isAdmin` (глобальный) ИЛИ `role ∈ {ADMIN, CREATOR}`; `canCreate = adminGroups.length > 0 || (user.isAdmin && currentGroupId)` (`:207`). Не-админу FAB-пункт «Запустить голосование» не показывается (`:325-327`), а прямой вызов даёт тост-отказ (`:281-287`).

### 1.6 Результаты, ответственный, рулетка

- `PollResultsPage` (`src/pages/PollResultsPage.tsx`): грузит `usePollById` + `usePollResults`; поддерживает **два формата ответа** — плоский `{winnerId, winnerName, totalVotes, responsible}` и вложенный `{result:{winnerMenuItemId, responsibleUserId,...}}` (`:28-41`).
- Карточка ответственного «выбран рулеткой» + кнопка «Крутить» (`:69-83`).
- `RouletteRevealOverlay` (`src/components/rl/RouletteRevealOverlay.tsx`) — чисто декоративный replay: победитель уже известен, анимация перебирает имена проголосовавших и замедляется точно на `winnerName` (`:43-55`); уважает `prefers-reduced-motion` (`:33-38`); конфетти в фазе `done`.
- На HomePage итоги последнего опроса — `CompletedPollWidget` (`homeWidgets.tsx:472-663`): свёрнутая пилюля/развёрнутая карточка, победитель, ответственный, кнопка «Скинуться · СБП» (реально = `markPaid` первого PENDING-долга, `HomePage.tsx:390`), у админа «Отменить итоги» → `cancelPoll` (`:392`).
- История: `PollHistoryPage` (`src/pages/PollHistoryPage.tsx`) — `usePollHistory({limit:60})`, карточки «Опрос #id» со статус-бейджем, клик → results. Пагинация в API есть (`polls.service.ts:42-54`), в UI не используется.

---

## 2. Menu (меню)

### 2.1 Endpoints (`src/services/menu.service.ts`)

`GET /menu`, `GET /menu/active`, `GET /menu/:id`, `POST /menu`, `PUT /menu/:id`, `DELETE /menu/:id`, `PATCH /menu/:id/toggle`, `GET /menu/search` (search в UI не используется — поиск клиентский).
Все CRUD-методы принимают опциональный `groupId`, который кладётся в `config.params` и **перекрывает** инжект interceptor'а (`:14-16` — комментарий об этом). **Исключение: `toggle(id)` groupId не принимает** (`:43-45`) — при переключении блюда чужой группы уйдёт `groupId` текущей.

### 2.2 Хуки (`src/hooks/useMenu.ts`)

- `useMenuItems({activeOnly?, groupId?})` — ключ `['menu'(, 'active')(, groupId)]`; groupId включается в ключ, чтобы явная группа не делила кэш с текущей (`:16-33`, комментарий `:22`).
- CRUD-мутации: create/update/delete/toggle → все инвалидируют `['menu']` (toggle ещё `['menu','active']`) + тосты (`:35-87`). Расшифровка ошибок `ACCESS_DENIED` / `NOT_AUTHENTICATED` в человекочитаемые (`:8-14`).

### 2.3 MenuPage (`src/pages/MenuPage.tsx`)

- Права: `isAdmin = !!user?.isAdmin` — **только глобальный флаг**, per-group роль не учитывается (`:62-63`), в отличие от `canCreate` на HomePage.
- Per-group: локальный `menuGroupId` (`:68`), чипы групп при `activeGroups.length > 1` (`:113-129`), `effectiveGroupId = menuGroupId ?? currentGroupId` (`:70`). Глобальный `currentGroupId` не меняется.
- Поиск — клиентский по имени/категории (`:88-95`); категории строятся из данных + счётчики (`:38-44`).
- Admin CRUD: FAB «Добавить блюдо» (`:183-185`), `DishSheet` создания/редактирования (`:495-581`; поля name/desc/price/category/isActive; валидация name + price>0), Switch вкл/выкл (toggle, `:172-173`), удаление через alertdialog-шит с предупреждением (`:218-251`). Все мутации передают `groupId: effectiveGroupId` (`:194,210,235`), кроме toggle (см. 2.1).
- Read-only участник: вместо контролов — бейдж «Активно/Архив» (`:342-344`).
- Состояния: skeleton `LoadingList` (`:349-364`), error-карточка (`:156-160`), `EmptyMenu` с CTA для админа (`:395-478`), `NoResults` по поиску (`:480-482`).

---

## 3. Budget (бюджет)

### 3.1 Endpoints (`src/services/budget.service.ts`)

`GET /budget/debts?status=`, `GET /budget/credits?status=`, `POST /budget/mark-paid`, `POST /budget/confirm-payment`, `POST /budget/cancel-mark`, `GET /budget/stats` (не используется), `POST /budget/send-reminder`, `POST /budget/send-reminders-all` (не используется).

### 3.2 Хуки (`src/hooks/useBudget.ts`)

- `useDebts`/`useCredits` — ключи `['budget','debts'|'credits', params]`, `staleTime:10s`, `refetchInterval:15s` (`:11-37`).
- Мутации `useMarkPaid`/`useConfirmPayment`/`useCancelMark` — все инвалидируют весь `['budget']` + тосты (`:43-80`); `useSendReminder` — только тост (`:82-89`).
- Статусная машина транзакции: `PENDING → PAID (mark-paid) → CONFIRMED (confirm-payment)`; `cancel-mark` возвращает PAID→PENDING.

### 3.3 Два параллельных виджета бюджета (важно не перепутать!)

1. **Реально используемый на HomePage** — упрощённый `BudgetWidget` из `src/components/rl/homeWidgets.tsx:700-972`. Сценарий вычисляется прямо в HomePage (`src/pages/HomePage.tsx:151-180`):
   - `hidden` — нет долгов и кредитов (рендерится свёрнутая пилюля «Нет активных расчётов», `homeWidgets.tsx:713-743`);
   - `urgent` — есть PENDING-долг → аватар кредитора, сумма, кнопка «Оплатить через СБП» (**реально вызывает `markPaid`, не СБП** — `HomePage.tsx:304`);
   - `awaiting` — есть PAID-долг → спиннер «Ждём подтверждения» (`homeWidgets.tsx:801-816`);
   - `collector` — есть credits → прогресс «Собрано X/Y», список должников со статусами Оплатил/Ждём/«Напомнить» (кнопка `onRemind` **не прокинута из HomePage** → не работает, `HomePage.tsx:294-306` не передаёт `onRemind`);
   - `overview` — плитки «Вам должны/Вы должны» + итог месяца;
   - сценарий `success` в типе есть (`homeWidgets.tsx:678`), но ветка HomePage его **никогда не выдаёт** (`:162-171`).
2. **Полная система из старого фронта** — `src/hooks/useBudgetWidget.ts` + `src/lib/budgetMappers.ts:57-187` (роли responsible/participant/admin, `awaitingCalculation`, `rouletteSpinning`, P1/P2/P3-сценарии, свежесть опроса < 20 мин, подтверждение < 3 мин) + `src/components/budget/*`. Подключена **только к `/budget-demo`** (`src/pages/BudgetDemoPage.tsx`). В `useBudgetWidget` колбэки `onShareSbp`, `onDmResponsible`, `onPaySbp` — заглушки (`useBudgetWidget.ts:57-63`); `onRemindDebtor` ищет транзакцию по debtorId и шлёт reminder (`:58-61`).
- Связь со store run: `useSettleStoreRun` инвалидирует `['budget']` (`src/hooks/useStoreRun.ts:124`) — после расчёта закупки долги появляются в том же бюджетном виджете.
- Admin-«прощение» долга тоже инвалидирует `['budget']` (`src/hooks/useAdmin.ts:92-94`).

---

## 4. Suggestions (предложения блюд)

### 4.1 Endpoints (`src/services/suggestions.service.ts`)

`GET /suggestions?status&limit&offset`, `POST /suggestions`, `POST /suggestions/:id/approve`, `POST /suggestions/:id/reject {reason}`, `DELETE /suggestions/:id`, `GET /suggestions/stats` и `/pending-count` (не используются).

### 4.2 Хуки (`src/hooks/useSuggestions.ts`)

Ключи `['suggestions','list',params]` / инвалидация `['suggestions']`; **approve дополнительно инвалидирует `['menu']`** (одобренное блюдо попадает в меню, `:35-44`).

### 4.3 SuggestionsPage (`src/pages/SuggestionsPage.tsx`)

- Два маршрута: `/suggestions` и `/suggestions/mine` (`onlyMine`, `App.tsx:38-39`).
- Фильтр all/mine: **клиентский** — `suggestions.filter(s => s.suggestedBy === user.id)` (`:44-47`); таб-переключатель виден только админу (`:58-67`), не-админ всегда в «mine» (`:35`).
- Статусы: PENDING/APPROVED/REJECTED с бейджами (`:21-25`); причина отказа выводится (`:152-154`).
- Admin-действия: «Одобрить»/«Отклонить» для PENDING (`:155-164`), «Удалить» для REJECTED (`:165-171`). Причина отказа — через `window.prompt`, удаление — `window.confirm` (`:95-99`) — не-нативные для Telegram диалоги.
- Создание: BottomSheet-форма name (min 2 символа)/description/price (`:186-247`).
- Удаление «своих» предложений участником в UI **отсутствует** — кнопка Удалить показана только админу для REJECTED.
- Состояния: «Загрузка…», empty-карточка (`:69-86`).

---

## 5. Admin (админ-панель)

### 5.1 Endpoints (`src/services/admin.service.ts:71-143`)

Все принимают **обязательный** `groupId` в query: `GET /admin/users`, `PUT /admin/users/:id/admin`, `PUT /admin/users/:id/active`, `GET /admin/debtors`, `GET /admin/debt-stats`, `POST /admin/debts/:id/forgive`, `POST /admin/debts/remind-all`, `POST /admin/debts/:id/remind`, `DELETE /admin/cleanup/old-polls?daysOld=`, `DELETE /admin/cleanup/old-transactions?daysOld=`, `GET /admin/cleanup/stats`, `GET|PUT /admin/reminder-settings/:groupId`, `GET|PUT /admin/notification-settings/:groupId`.

### 5.2 Хуки (`src/hooks/useAdmin.ts`)

Все берут groupId из `useAppStore.currentGroupId` через локальный `useGroupId()` (`:6-11`), при отсутствии — `throw new Error('No group')`. Ключи `['admin', <sub>, groupId]`; мутации инвалидируют `['admin']` целиком, forgive/cleanup-transactions ещё `['budget']`, cleanup-polls ещё `['polls']` (`:83-160`).

### 5.3 AdminPage (`src/pages/AdminPage.tsx`)

- Право: `user.isAdmin` (клиентская проверка, `:42-43`); не-админ видит карточку-отказ (`:122-128`). Роут не в навигации.
- 5 табов (`:23-30`): Обзор (dashboard из `buildDashboard`, `src/lib/adminMappers.ts`), Люди (`UserManagementCard`), Долги (`DebtManagementCard`), Очистка (`DataCleanupCard`), Напоминания (`ReminderSettingsCard`).
- Dashboard: чеклист, quick actions (create-poll → шит, manage-menu → `/menu`; broadcast/moderation — без обработчиков, `:74-77`), статистика, график по дням недели, список активных опросов → results.
- Создание опроса из AdminPage (`:79-99`): **отдельный путь**, минуя `useCreatePoll` — прямой `pollsService.createFromWebapp` + ручная инвалидация только `polls.active`; groupId — только текущий (нет выбора группы); `try/finally` **без catch** — ошибка создания не показывается пользователю и уходит в unhandled rejection. Успех → `SuccessSheet` с временем закрытия (`:139-145`).

---

## 6. Profile / Stats

### 6.1 Данные пользователя (`src/services/user.service.ts`, `src/hooks/useUser.ts`)

- `GET /user/me` (`useMe`, ключ `['user','me']` — на страницах не используется, все берут `user` из стора), `GET /user/groups` (`useMyGroups`, `['user','groups']`), `GET|PUT /user/payment-info` (`usePaymentInfo`/`useUpdatePaymentInfo`, `['user','payment-info']`), аватары (`getAvatar`, `getAvatarsBatch` — в новом UI не вызываются, аватары рисуются инициалами через `Avatar`).
- История опросов: `usePollHistory(params)` — ключ `['polls','history',params]`, `GET /polls` (`useUser.ts:46-58`).

### 6.2 ProfilePage (`src/pages/ProfilePage.tsx`)

- Шапка: имя/username из `user`, streak-бейдж при `streak.current >= 3` (`:56-61`).
- Мини-статы (`:67-71`): «Голосований» = `history.length`, «Завершено» = число COMPLETED-опросов группы (не личных побед!), «Активность» = их отношение (`:34-35`).
- Настройки (`:74-90`): Оформление (`SchemeThemeToggle` — работает), Уведомления (см. гипотезу b), Реквизиты СБП (открывает `EditPaymentInfoSheet` → `PUT /user/payment-info`; телефон маскируется `maskPhone`, `:13-17`), Язык (см. гипотезу c).
- Навигация: «Мои предложения» → `/suggestions/mine`, «История голосований» → `/poll/history` (`:93-98`).
- Действия: «Поддержать проект» → `DonationModal` (получает `sbpPhone`), «Сообщить о проблеме» → `FeedbackModal` (`:101-128, :141-142`).
- Feedback: `useSendFeedback` → `POST /feedback` (`src/hooks/useFeedback.ts`, `src/services/feedback.service.ts:16-18`).
- Streak: `useStreak` (`src/hooks/useStreak.ts`) = `usePollHistory({limit:90})` + чистая функция `computeStreak` (`src/lib/streakCalc.ts`); вычисление полностью клиентское.

### 6.3 StatsPage (`src/pages/StatsPage.tsx`)

Всё считается **клиентски** из `usePollHistory({limit:60})` (`:161-162`, `buildVM` `:37-109`):
- лидерборд топ-5 по числу обедов + streak «сколько последних опросов подряд голосовал» (`:69-79`), подсветка «вы»;
- «Ваш профиль обеда» — топ-3 блюда пользователя + процент участия (`:101-105`);
- «Обеды по неделям» — 4 недельных бакета текущего месяца (`:81-95`).
- Состояния: скелетоны (`:164-186`), эмпти с CTA «Запустить голосование» → `/` (`:189-239`).
- Никаких серверных stats-endpoint'ов не используется.

---

## 7. Store Run (закупки) — смежный домен, завязан на Home и Budget

- Сервис `src/services/store-run.service.ts:79-110`: `POST /store-runs`, `GET /store-runs/active`, `GET /store-runs/:id`, `POST /store-runs/:id/items`, `PATCH|DELETE /store-runs/:runId/items/:itemId`, `POST .../items/:itemId/price`, `POST /store-runs/:id/start-shopping`, `/settle`, `/cancel`. Статусы: `COLLECTING → SHOPPING → SETTLED | CANCELLED`; item: `REQUESTED | BOUGHT | NOT_FOUND`.
- Хуки `src/hooks/useStoreRun.ts`: ключи `['storeRuns','active']` (refetch 30s) и `['storeRuns','detail',id]` (адаптивный refetch: 15s пока активна, off для SETTLED/CANCELLED, `:42-47`); `settle` инвалидирует `['budget']` (`:124`).
- HomePage: список активных закупок (`HomePage.tsx:344-374`) + создание через FAB → `CreateStoreRunSheet` (groupId = текущая группа, после создания навигация на `/store-run/:id`, `:308-321`).
- StoreRunPage (`src/pages/StoreRunPage.tsx`): роли — `isInitiator = run.initiatorId === user.id` (`:51`). Участник: добавляет позиции пока COLLECTING (`:129-133`), удаляет свои (`:98`). Инициатор: удаляет любые, «Отменить»/«Закрыть сбор» при COLLECTING (`:136-145`), в SHOPPING проставляет цены/«Не нашли» через `PriceSheet` (`:115-117, :263-313`), затем «Рассчитать и разослать счета» (`:146-150`). SETTLED — карточка-итог (`:151-161`).

---

## 8. Проверка гипотез

### a) Таймер опроса не тикает — ПОДТВЕРЖДЕНО

`src/pages/HomePage.tsx:142-147`: `remaining` считается в `useMemo` от `Date.now()` с зависимостью только `[activePoll]`. Ни `setInterval`, ни тика нет; `ActivePollWidget` просто рендерит `fmtClock(remaining)` (`src/components/rl/homeWidgets.tsx:306-308`). Значение обновляется только при рефетче опроса (интервал 30s у `useActivePolls`, `usePolls.ts:23`) или SSE-инвалидации. Проп `total` в `ActivePollWidget` объявлен, но даже не деструктурируется (`homeWidgets.tsx:232-251`) — прогресс-кольца по времени нет.

### b) Переключатель уведомлений — только локальный useState — ПОДТВЕРЖДЕНО

`src/pages/ProfilePage.tsx:30`: `const [notif, setNotif] = useState(true);` → Switch в строке «Уведомления» (`:78-81`). Никакого API-вызова, стора или localStorage; при перезаходе сбрасывается в `true`.

### c) «Язык — Русский» без действия — ПОДТВЕРЖДЕНО

`src/pages/ProfilePage.tsx:88`: `<Row icon="globe" label="Язык" value="Русский" />` — без `onClick` и без `control`; `Row` при этом рендерит `cursor: default` и не является кнопкой (`:184-191`). Чистая декорация.

### d) Глобального AuthGate нет — ПОДТВЕРЖДЕНО

- `App.tsx` рендерит все маршруты безусловно; проверок auth в дереве нет.
- Ошибка авторизации оседает в сторе (`bootstrap.ts:31-37`), `useAuth().error` её отдаёт (`useAuth.ts:6,11`), но **ни один компонент `authError` не читает** (grep: `authError` встречается только в store и useAuth).
- Защита данных — только `enabled: authStatus === 'authenticated'` в query-хуках. При `authStatus='error'`: `isLoading=false` (`useAuth.ts:13`), disabled-запросы не считаются loading → HomePage проваливается в ветку «нет активного опроса» и показывает `EmptyPollCard` «Сегодня ещё не решали» (`HomePage.tsx:435-457`) — пользователь видит пустой, а не ошибочный экран.
- 401 в рантайме: interceptor молча чистит токен (`api.service.ts:43`), повторной авторизации/редиректа нет; `refreshAuth` (`auth.service.ts:51-68`) реализован, но **никем не вызывается**.

### e) Group context — ПОДТВЕРЖДЕНО с уточнениями

- `currentGroupId` выбирается один раз в `bootstrapAuth` (`bootstrap.ts:19-22`) и далее **нигде не меняется** (единственный вызов `setCurrentGroupId`).
- Interceptor подставляет его во все запросы (`api.service.ts:29-34`); явные params побеждают.
- MenuPage — локальный селектор `menuGroupId` (`MenuPage.tsx:68,113-129`), глобальный контекст не трогает. Аналогичный локальный селектор в форме создания опроса — `sheetGroupId` (`HomePage.tsx:110`).

Таблица: кто передаёт groupId явно, а кто полагается на interceptor (= «первая группа» из bootstrap):

| Запрос/мутация | groupId |
|---|---|
| menu getAll/getActive/create/update/remove | **явно** (проп `groupId`, `menu.service.ts:16-41`) |
| menu **toggle** | **неявно** (interceptor; `menu.service.ts:43-45` — нет параметра, риск для чужой группы) |
| polls createFromWebapp | **явно** в body (`HomePage.tsx:263`, `AdminPage.tsx:84-91`) |
| recurring create/update/toggle | **явно** в body/payload (`recurring-poll.service.ts:42-56`) |
| store-runs createRun | **явно** в payload (`HomePage.tsx:314`) |
| admin.* (все 14) | **явно** в query из `currentGroupId` (`useAdmin.ts:6-11`) |
| polls getActive/getById/vote/withdraw/my-votes/results/history/last-completed/complete/cancel | **неявно** (interceptor) |
| budget debts/credits/mark-paid/confirm/cancel-mark/send-reminder | **неявно** |
| suggestions list/create/approve/reject/remove | **неявно** |
| user me/groups/payment-info, feedback | **неявно** (groupId им не нужен, но всё равно уходит в query) |
| store-runs active/detail/items/price/start-shopping/settle/cancel | **неявно** |

Следствие: для мульти-группового пользователя опросы, бюджет и предложения всегда показываются по группе, выбранной при старте; сменить её из UI невозможно.

### f) HomePage.tsx — зоны ответственности — ПОДТВЕРЖДЕНО (god-component)

Файл `src/pages/HomePage.tsx`, **511 строк**, один компонент `HomePage`:

| Зона | Строки |
|---|---|
| Авторизация (useAuth) | 81 |
| Deep link на опрос + редирект на results | 83-94 |
| Активный опрос: голос/отзыв/complete/cancel | 96-100, 465-487 |
| SSE-подписка | 101 |
| Последний завершённый опрос + VM итогов | 103-104, 183-195, 380-394 |
| Меню (все блюда + меню группы формы) | 106, 210-211 |
| Группы, права `canCreate`, `adminGroups` | 107, 198-207 |
| Создание разового и recurring-опроса | 110-113, 232-287, 396-410 |
| Бюджет: загрузка, вывод сценария, markPaid | 115-118, 151-180, 294-306 |
| Закупки: список активных, создание, навигация | 120-123, 308-321, 332-378 |
| Таймер опроса (не тикающий) | 142-147 |
| VM опций опроса | 132-140 |
| FAB speed-dial (3 действия) | 324-330, 452, 493 |
| Локальный UI-стейт (6 useState) | 110, 125-130 |
| Приветствие | 58-62, 289-292 |
| Ветки loading / error / empty / active | 412-419 / 421-432 / 434-457 / 459-497 |

---

## 9. Неожиданности и риски (не потерять/учесть при редизайне)

1. **Multi-select заявлен, но не реализован**: опросы создаются с `isMultiSelect:true, maxSelections:3`, а UI позволяет один голос; `voteMultiple` мёртвый (`polls.service.ts:73-75`).
2. **Кнопки «СБП» не ведут в СБП**: и на HomePage (`:304`), и в CompletedPollWidget (`:390`) — это `markPaid`. В `useBudgetWidget` sbp-колбэки — заглушки.
3. **`onRemind` в collector-сценарии HomePage не прокинут** — кнопка «Напомнить» в списке должников ничего не делает (`HomePage.tsx:294-306` vs `homeWidgets.tsx:902-904`).
4. **AdminPage создаёт опрос без обработки ошибок** (`AdminPage.tsx:79-99`, try/finally без catch) и без выбора группы.
5. **Recurring-расписание можно только создать** — просмотр/toggle/удаление есть в хуках/сервисе, но без UI.
6. **Два поколения компонентов сосуществуют**: живые — `components/rl/*`, `components/admin/*`, `components/modals/*`, `components/profile/EditPaymentInfoSheet`; легаси без ссылок из роутов — `components/profile/ProfileScreen|SettingsList|HistoryScreen|...`, `components/home/*` (кроме типа `VoteOption` из `InlineVotingCard`, который импортирует `pollMappers.ts:1`), `components/stats/*`, `components/budget/*` (жив только через `/budget-demo`).
7. **`/admin` и `/budget-demo` недостижимы из навигации** — только прямой URL/диплинк.
8. **Разные критерии «админства»**: MenuPage — только `user.isAdmin` (`MenuPage.tsx:63`); HomePage — `isAdmin || role ADMIN/CREATOR` (`:198-207`); AdminPage — `user.isAdmin` (`:43`).
9. **Метрики профиля вводят в заблуждение**: «Завершено»/«Активность» считаются от опросов группы, а не от действий пользователя (`ProfilePage.tsx:34-35`).
10. **SSE-статус не виден пользователю**; при обрыве соединения после 20 ретраев данные обновляются только поллингом.
11. Подтверждение оплаты кредитором (`useConfirmPayment`) в новом UI подключено только в demo/`components/budget`-ветке; на HomePage collector видит статусы, но подтвердить оплату не может.
12. `useMyVotes` не гейтится по auth (`usePolls.ts:80`) — уходит запросом и до авторизации, если есть pollId.

---

## 10. Сводный список потоков, обязательных к сохранению

1. Bootstrap: validate initData → токен → выбор группы → `authenticated` (порядок важен — группа до статуса).
2. Deep link `?pollId=` / `start_param=vote_<id>` → активный опрос на Home или редирект на results.
3. Голос → SSE/поллинг-обновление баров → отзыв голоса («Изменить»).
4. Admin: создать разовый опрос (мин 2 блюда, группа, длительность) и recurring (дни+время); закрыть досрочно; отменить.
5. Итоги: победитель + ответственный + рулетка-replay + переход в results/историю.
6. Меню per-group: просмотр/поиск/категории для всех; CRUD+toggle для админа; селектор групп.
7. Бюджет: цепочка PENDING→PAID→CONFIRMED, сценарии hidden/urgent/awaiting/collector/overview, связь с итогами опроса и settle закупки.
8. Закупки: create → COLLECTING (все добавляют) → SHOPPING (инициатор ценит) → SETTLE → счета в бюджет.
9. Предложения: создание участником, approve (→ меню)/reject/удаление админом, фильтр mine.
10. Профиль: реквизиты СБП (edit sheet + маска), streak, история, feedback, donation, переключатель темы.
11. Статистика: клиентские лидерборд/профиль обеда/недельные бары из history.
12. Админ-панель: 5 табов (users/debts/cleanup/reminder+notification settings) — все с обязательным groupId.
