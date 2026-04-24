# Frontend Parity Roadmap — `frontend/` vs `frontend-new/`

**Дата:** 2026-04-20
**Контекст:** Новый фронт `frontend-new/` должен достичь parity со старым `frontend/` перед выключением старого.

---

## Сводка готовности

| Область | Готовность | Комментарий |
|---|---|---|
| Pages (роутинг) | 90% | 9/10 страниц есть, UserStatsPage отсутствует |
| Services | 70% | 12/17 — нет offline, recurring-poll, streak, category-order, notification |
| Budget widget | 15% | 2/15 компонентов — большая дыра по 6 сценариям |
| Poll creation | 0% | `onCreate` — заглушка (P0) |
| SSE realtime | 0% | Нет `useSSE`, нет подключения к `/polls/:id/stream` |
| Admin UI | 80% | Карточки есть, need verification vs backend endpoints |
| Общая готовность | **~55%** | Основной скелет + некоторые фичи работают |

---

## P0 — Блокеры (без этого фронт не функционален)

### 1. Создание голосования из Mini App
- **Где сейчас:** [HomePage.tsx:144](src/pages/HomePage.tsx#L144) — `onCreate={() => undefined}`
- **Что нужно:**
  - Реализовать `useCreatePoll()` в [hooks/usePolls.ts](src/hooks/usePolls.ts)
  - В `polls.service.ts` добавить `createPollFromWebApp({groupId, duration, title})` — см. старый [frontend/src/services/polls.service.ts:219](../frontend/src/services/polls.service.ts#L219)
  - UI — либо BottomSheet с формой (`CreatePollSheet.tsx` уже есть в [admin/](src/components/admin/CreatePollSheet.tsx), но не прикреплён к HomePage), либо инлайн
  - После создания — navigate на `/` с автообновлением активного опроса
- **Backend готов:** `POST /api/polls/create` — есть

### 2. Выбор группы перед созданием опроса
- В Telegram Mini App групп может быть несколько — нужен select
- **Старый фронт:** см. `CreatePollForm.tsx` (логика выбора группы)
- **Сервис:** `user.service.getMyGroups()` — проверить, есть ли

### 3. SSE real-time обновления голосования
- **Где отсутствует:** во всём `frontend-new/src/`
- **Что делать:** портировать [frontend/src/hooks/useSSE.ts](../frontend/src/hooks/useSSE.ts), подключить к `GET /api/polls/:id/stream`
- **Альтернатива временная:** агрессивный refetch (уже есть в React Query config)

---

## P1 — Важные фичи (есть, но неполные)

### 4. Budget Widget — 6 сценариев
**Старый фронт:** 15 компонентов в `components/budget/`:
- `BudgetWidget.tsx` (root)
- `BudgetWidgetCompact.tsx`, `BudgetWidgetWithCalculator.tsx`
- **6 состояний:** `UrgentDebtView`, `WaitingConfirmationView`, `WaitingCalculationView`, `SuccessMessageView`, `OverviewView`, `ResponsibleView`
- `CompactResponsibleBanner`, `CostBreakdownView`, `CostEntryForm`, `OrderItemForm`, `CategoryOrderCalculator`, `CalculatorModal`

**Новый фронт:** `BudgetWidget.tsx`, `CalculatorModal.tsx` — только 2 из 15.

**Что делать:** портировать 6 view-компонентов + `CategoryOrderCalculator` + логику сценариев из `useBudgetWidget.ts`.

### 5. UserStatsPage (персональная статистика)
- **Старый:** `frontend/src/pages/UserStatsPage.tsx` — детальная стата пользователя
- **Новый:** объединена с `StatsPage`? Проверить содержимое.
- Если объединена — ок. Если нет — добавить маршрут `/stats/me` или tab внутри `StatsPage`.

### 6. Notification Service (client-side)
- **Старый:** `services/notification.service.ts` — in-app нотификации
- **Новый:** отсутствует. Только сервер шлёт push через Telegram.
- **Что делать:** портировать, подключить toast-систему (headerless-lib или свой mini-toast).

### 7. Recurring Polls (повторяющиеся голосования)
- **Старый:** `services/recurring-poll.service.ts` + tab «Recurring» в CreatePollForm
- **Новый:** нет
- **Backend:** endpoints есть — проверить и подключить

### 8. Streak Service (стрики участия)
- **Старый:** `services/streak.service.ts` — данные для profile/stats
- **Новый:** нет
- **Backend:** `GET /api/user/streak` — если есть, добавить хук и виджет в Profile/Stats

---

## P2 — Улучшения (nice to have)

### 9. Offline mode
- `services/offline.service.ts` в старом — локальная очередь запросов
- Низкий приоритет — в Telegram Mini App сеть обычно есть

### 10. Category Orders (заказы по категориям в budget)
- `services/category-order.service.ts` + `CategoryOrderCalculator.tsx`
- Часть расширенного Budget-флоу

### 11. Animated backgrounds / gradients
- Старый: `components/background/AnimatedGradientBackground.tsx`, `useAnimatedGradient.ts`
- Новый: статический CSS градиент. Достаточно для MVP.

### 12. Sentry / monitoring parity
- В новом `sentry.ts` есть, но DSN может быть не настроен
- Проверить `initSentry()` и `installGlobalHandlers()` работают

### 13. Storybook
- Старый: 20+ `.stories.tsx` файлов (Button, Badge, Chip и др.)
- Новый: без Storybook
- Можно отложить или не переносить вовсе

### 14. Тесты (Vitest)
- Старый: минимальное покрытие
- Новый: нет вообще
- Фронт-тесты не блокируют production

---

## Рекомендованный порядок реализации (Top-10 next steps)

1. **[P0] Реализовать `useCreatePoll()` + API вызов + UI кнопки** на HomePage — 2-4ч
2. **[P0] Подключить `CreatePollSheet`** к HomePage (есть готовый компонент) — 1-2ч
3. **[P0] Портировать `useSSE` и подключить к активному опросу** — 2-3ч
4. **[P1] Портировать 6 Budget view-компонентов** с логикой сценариев — 6-10ч
5. **[P1] Проверить/доделать UserStatsPage** (раздел в StatsPage или отдельный) — 2-4ч
6. **[P1] Notification service + toast система** — 2-3ч
7. **[P1] Recurring polls tab** в CreatePollSheet — 2-3ч
8. **[P1] Streak service + виджет** в Profile — 1-2ч
9. **[P2] Category orders** в budget флоу — 3-5ч
10. **[P2] Проверка всех admin-endpoints** (UserManagement, DebtManagement, DataCleanup, Reminders) — 2-4ч

**Итого грубая оценка до 100% parity:** 23-40 часов активной работы.

---

## Что НЕ переносить (осознанно не делаем)

- `mockApi.service.ts` — mock для оффлайн разработки, не нужен в prod
- Gamification — удалено по решению проекта (см. CLAUDE.md)
- Storybook — можно отложить на потом
- `AnimatedGradientBackground` — не критично, статика ок

---

## Следующий шаг для пользователя

Начинать рекомендую с пункта **#1 — создание опроса**. Без этого админ не может стартовать голосование из Mini App и парити с `/startpoll` в боте не достигается. Сообщите — реализовать сейчас?
