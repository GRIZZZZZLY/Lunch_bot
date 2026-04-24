# Чек-лист скриншотов для редизайна

## Как снимать

**Вариант 1 — Chrome DevTools (быстрее всего):**
1. Откройте tunnel-URL в Chrome: `https://<ваш-tunnel>.trycloudflare.com`
2. DevTools → Toggle device toolbar (Ctrl+Shift+M).
3. Размер: **iPhone 14 Pro (430×932)** или кастомный **430×932**.
4. Правый клик на странице → Screenshot → Capture full size screenshot.
5. Для тёмной темы: DevTools → Rendering → Emulate CSS media feature `prefers-color-scheme: dark`.

**Вариант 2 — Telegram Desktop:**
- Win+Shift+S (снимок области) или PrintScreen.
- Свет/тёмная тема переключается в Telegram: Settings → Chat Settings → Night Mode.

**Соглашение об именах файлов:**
`[page]_[state]_[theme].png` — например `home_empty_light.png`, `budget_urgent-debt_dark.png`.

---

## Инвентарь экранов × состояний

### 1. HomePage (/)

| Состояние | Как воспроизвести | Файл |
|---|---|---|
| Empty (нет активного опроса, есть админ-права) | Нет активного опроса в группе | `home_empty_light/dark.png` |
| Empty (обычный юзер) | Не админ ни в одной группе | `home_empty-noadmin.png` |
| Active poll (ещё не голосовал) | Создать опрос, зайти с другого акка или без голоса | `home_active.png` |
| Active poll (уже голосовал) | Проголосовать | `home_voted.png` |
| Poll ending soon (<2 мин) | Создать опрос на 2 мин и дождаться | `home_ending.png` |
| With UrgentDebtBanner | После закрытия опроса, до оплаты | `home_urgent-debt.png` |
| Loading | Первый заход, slow connection | `home_loading.png` |
| Error | Отключить backend | `home_error.png` |

### 2. Budget Widget (интегрируется в HomePage + BudgetDemoPage /budget-demo)

| Сценарий | Как воспроизвести |
|---|---|
| Urgent Debt (< 5 мин после закрытия) | Закрыть опрос, зайти как должник |
| Waiting Confirmation | Пометить оплату |
| Success Message | Ответственный подтвердил |
| Overview (всё оплачено) | Все транзакции CONFIRMED |
| Responsible View | Зайти как ответственный с должниками |
| Compact Responsible Banner | Ответственный, ждёт калькуляцию |
| Calculator Modal (открыт) | Ответственный → «Ввести сумму» |

### 3. MenuPage (/menu)

| Состояние | Как |
|---|---|
| Empty (нет блюд) | Пустая БД |
| With items | 5+ блюд разных категорий |
| Search open (без результатов) | Поиск по несуществующему слову |
| Search open (с результатами) | Обычный поиск |
| Add dish sheet открыт | Тапнуть + |
| Edit dish sheet открыт | Тапнуть по карточке |
| Delete confirm открыт | Через меню карточки |
| Category filter активен | Выбрать категорию |

### 4. StatsPage (/stats)

| Таб × Период | Как |
|---|---|
| Overview / Week | Default |
| Overview / Month | |
| Overview / All | |
| Insights / Week | |
| Insights / Month | |
| Leaderboard / Month | |
| Empty (нет истории) | Новый юзер |
| Loading | |

### 5. UserStatsPage (/user/stats — только старый фронт)

| Состояние | Как |
|---|---|
| С данными | Юзер с 10+ голосами |
| Empty | Юзер без голосов |
| Loading | |

### 6. ProfilePage (/profile)

| Состояние | Как |
|---|---|
| Default | Обычный юзер |
| Admin (с короной) | isAdmin=true |
| With streak pill (🔥 N дней) | Голосовать 3+ дня подряд |
| EditPaymentInfoSheet открыт | Тап «Реквизиты СБП» |
| FeedbackModal открыт | Кнопка «Оставить отзыв» |
| DonationModal открыт | Тап donation |
| History view (свитч в истории) | |

### 7. PollHistoryPage (/poll/history)

| Состояние | Как |
|---|---|
| С историей | 5+ завершённых опросов |
| Empty | Новая группа |
| Фильтры: all/won/participated/skipped | Переключить |

### 8. PollResultsPage (/poll/:id/results)

| Состояние | Как |
|---|---|
| Active (идёт голосование) | Открыть URL активного |
| Completed (есть победитель) | Открыть URL закрытого |
| Tie (ничья) | Редкий случай |

### 9. AdminDashboardPage (/admin/dashboard)

| Блок | Сделать скрин |
|---|---|
| Checklist (с пунктами) | Default |
| Quick Actions | |
| Stats tiles | |
| Week chart | |
| Suspicious alert | Если есть подозрение |
| UserManagementCard | Раскрытая карточка |
| DebtManagementCard | С долгами |
| DataCleanupCard | |
| ReminderSettingsCard | Раскрытая |
| CreatePollSheet открыт | Тап «Создать опрос» |

### 10. SuggestionsPage (/admin/suggestions) + MySuggestionsPage

| Состояние | Как |
|---|---|
| Админ: список с новыми | Default |
| Админ: фильтры | Approved/rejected |
| Юзер: мои предложения | MySuggestions |
| Sheet «Добавить предложение» открыт | |

### 11. Модалки (любая страница)

| Модалка | Как |
|---|---|
| TopDishModal | Открывается авто после закрытия опроса |
| WelcomeModal | Первый запуск (очистить localStorage) |

---

## Итого

**~65-80 скриншотов**: 10 страниц × 2 темы × ~3-4 состояния среднее.

Минимум для понимания дизайна: **20 скриншотов** (все страницы в light default + ключевые состояния).
