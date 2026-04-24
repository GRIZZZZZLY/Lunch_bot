# Screenshots — автоматически сняты через Playwright

**Обновлено:** 2026-04-24 (финальный проход)
**Всего файлов:** 68
**Viewport:** 430×932 @2x

## ✅ Хорошие скриншоты (использовать для дизайна)

Эти скрины показывают реальный UI со смысловыми данными:

### Home / Voting
- `home_empty_light/dark` — пустой, "Голосования ещё нет"
- `home_active_light/dark` — идёт голосование, 5 блюд, таймер
- `home_voted_light/dark` — уже проголосовал
- `home_ending_light/dark` — завершается
- `home_urgent-debt_light/dark` — с баннером срочного долга
- `home_loading_light/dark` — ранний кадр (скелет/заставка)

### Menu
- `menu_with-items_light/dark` — 6 блюд в сетке, кнопки edit/delete, FAB
- `menu_add-sheet_light/dark` — открытый sheet «Добавить блюдо»
- `menu_search_light/dark` — поисковое поле с вводом
- `menu_search-empty_light/dark` — поиск без результатов

### Stats (4 таба: Мой/Группа/Глобально/Инсайты)
- `stats_personal_light/dark` — Мой (default)
- `stats_group_light/dark` — Группа
- `stats_global_light/dark` — Глобально
- `stats_insights_light/dark` — Инсайты

### Profile
- `profile_admin_light/dark` — с короной, доступом к /admin
- `profile_regular_light/dark` — обычный юзер (без короны)
- `profile_streak_light/dark` — с историей голосований
- `profile_feedback-modal_light/dark` — модалка отзыва открыта
- `profile_donation-modal_light/dark` — модалка «Поддержать» открыта

### History
- `history_with-polls_light/dark` — список завершённых
- `history_empty_light/dark` — «Пока нет голосований»

### User Stats (отдельная страница)
- `user-stats_light/dark` — 42 голоса, 70% активность, любимые блюда

### Прочее
- `my-suggestions_light/dark` — предложения пользователя
- `admin_suggestions_light/dark` — админская страница предложений

---

## ⚠️ Проблемные (не использовать или использовать с оговоркой)

### 🔴 Полная ошибка React (НЕ использовать)
- `admin_dashboard_*` и `admin_create-poll-sheet_*` — показывают стектрейс «Cannot read properties of undefined (reading 'toFixed')».
  **Причина:** мой mock не предоставляет все поля, на которых старый фронт вызывает `.toFixed()`. В дизайне **игнорируйте эти файлы** — они только собьют Claude.

### 🟡 Частично работают (дизайн-осмысленный layout, но не во всех секциях есть данные)
- `results_completed_*` — показан header «Результаты голосования 11», но «Завершено: Invalid Date», нет winner-блюда и breakdown.
- `budget_*` (5 файлов: overview, urgent-debt, waiting-confirm, success, responsible) — **все 5 идентичны** и показывают HomePage без budget-виджета. Старый фронт рендерит budget внутри HomePage только при конкретном sequence poll-данных, который через моки полностью воспроизвести сложно.

### 🟡 Mock-сценарий не применился (показывают default)
- `menu_empty_*` — идентичен `menu_with-items`. Старый фронт кэширует меню через React Query persist, моки пустого меню не перекрывают первый успешный запрос.
- `stats_empty_*` — идентичен `stats_personal`. Та же причина.

---

## 📸 Что рекомендую доснять вручную

Чтобы Claude Design получил полную картину, снимите в **Chrome DevTools (Ctrl+Shift+M, iPhone 14 Pro 430×932)**:

1. **Budget Widget** во всех 6 сценариях — через воспроизведение в Telegram с реальными транзакциями, либо из `/budget-demo` в новом фронте (если оттуда будете черпать идеи).
2. **AdminDashboardPage** — нужно перейти в Telegram под админом, чтобы дашборд рендерился с живыми данными.
3. **Menu empty** и **Stats empty** — снять на свежем аккаунте без истории.
4. **Poll Results** с реальным завершённым опросом.
5. **Все модалки (CalculatorModal, EditPaymentInfoSheet, DeleteConfirmSheet, CreatePollSheet)** — открыть вручную и снять.

Шаги:
1. Откройте Mini App в Telegram Desktop.
2. Разрешите отладку: Settings → Advanced → Enable WebView devtools.
3. Правый клик внутри Mini App → Inspect.
4. В DevTools: Toggle device toolbar → iPhone 14 Pro.
5. Правый клик страницы → Capture full size screenshot.

---

## Как снимались

Скрипт [`scripts/screenshot-runner/screenshot-all.mjs`](../../../scripts/screenshot-runner/screenshot-all.mjs):
- Встроенный Node HTTP-сервер с SPA-fallback → `frontend/dist/`.
- Mock `window.Telegram.WebApp` + принудительный `.dark` класс для тёмной темы.
- Service Worker заблокирован → API-моки не обходятся PWA-кэшем.
- Playwright `page.route(/\/api\//)` → моки из [`mocks.mjs`](../../../scripts/screenshot-runner/mocks.mjs).

## Перезапуск

```bash
cd scripts/screenshot-runner
node screenshot-all.mjs
```

## Рекомендация для Claude Design

Приложите **только скриншоты из «✅ Хорошие»** + промпт [`../REDESIGN_PROMPT_TEMPLATE.md`](../REDESIGN_PROMPT_TEMPLATE.md). Дополнения из «⚠️ Проблемные» и «📸 Что доснять» — по возможности после ручной съёмки.
