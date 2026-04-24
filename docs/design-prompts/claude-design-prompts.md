# Серия промтов для claude.ai/design

Воспроизведение дизайна **Telegram Food Bot** / **Rocket Lunch** (Mini App для группового голосования за еду).

---

## Два режима использования

### Режим A — с нуля (новый проект в claude.ai/design)
1. Скопируй **промт №0** — получи дизайн-систему и базовые компоненты.
2. Далее промты **№1–№7** — каждый экран отдельным артефактом.
3. В каждом промте упоминай: *"Use the design system from the previous artifact"*.

### Режим B — продолжение (новый чат + прикреплённые HTML-экспорты)
Если у тебя уже есть готовые HTML-артефакты в `exports/` (Design System, HomePage, MenuPage, Voting Flow) и ты открываешь **новый чат** в claude.ai/design:

1. Прикрепи HTML-файлы как attachments.
2. Используй **Continuation Prompt** (см. в конце этого файла) как первое сообщение — он ссылается на прикреплённые файлы как на source-of-truth и инструктирует Claude не пересоздавать дизайн-систему, а переиспользовать её.
3. Дальше — промты №1–№7 для недостающих экранов (либо промты `update-*` для обновления уже сделанных).

> Почему разные режимы: промт №0 создаёт дизайн-систему с нуля. Если ты уже её получил и хочешь продолжить — повторять это расточительно; лучше прикрепить готовый HTML и работать в режиме B.

---

**Общий контекст для всех промтов** (добавляй в начало, если работаешь в новом чате без attachments):

> Контекст: Telegram Mini App для голосования за еду в рабочих чатах. Пользователь открывает мини-приложение внутри Telegram на мобильном (375×667 базовый viewport, max 430px). UI должен ощущаться нативным в Telegram: поддержка dark/light темы, плотная информация, тактильные микро-анимации, округлые карточки, пастельная палитра с мягким ощущением еды/уюта.
>
> **Важно про навигацию:** в проекте **4 экрана в Bottom Navigation**: Home, Menu, Stats, Profile. Отдельного экрана "Vote" нет — голосование встроено в виджет на HomePage, который меняет состояние. Если где-то в промтах упоминается 5-я вкладка Vote — игнорируй, это устаревший черновик.

---

## Промт №0 — Design System & Component Library

```
Design a complete design system and component library for a Telegram Mini App called "Rocket Lunch" — a mobile-first group food voting app. Output as a single artifact: a visual style guide page showing the palette, typography, primitives, and core components side-by-side in both dark and light themes.

VIEWPORT: Mobile-first, base 375px wide, max 430px. Everything must feel native inside Telegram.

COLOR PALETTE (use HSL/hex exactly):
Primary (Peach/Orange, warm CTA):
- peach-400 #FF9D66 (dark mode primary)
- peach-500 #D86A2C (light mode primary)
- peach-600 #B84D12 (hover/pressed)

Accent (Lavender, highlights + nav):
- lavender-400 #A78BFA (dark)
- lavender-500 #8B5CF6 (light)

Success (Mint): mint-400 #34D399 / mint-500 #22B573
Error (Coral): coral-400 #F87171 / coral-500 #E55A4F
Warning (Butter): butter-400 #F4C15D / butter-500 #E6A93D

Desaturated variants for dark mode (softer):
- success-soft-300 #9FD4B3
- warning-soft-300 #D9D394
- error-soft-300 #D4A5A5

Dark theme background: #17212B (Telegram native dark). Card surface: gradient from #1F2A36 → #17212B.
Light theme background: gradient #F2EADF → #FBF7F1. Card surface: gradient #FFFDF9 → #F6EFE5.

SIGNATURE GRADIENTS (use for hero cards, badges, backgrounds):
- Pastel Peach: linear-gradient(135deg, #F3C4A7 → #F7D5C1)
- Pastel Lavender: linear-gradient(135deg, #D1C1FC → #E5DDFE)
- Pastel Sage: linear-gradient(135deg, #8CE0B9 → #B3EBD1)
- Pastel Sky: linear-gradient(135deg, #7DD3FC → #BAE6FD)
- Pastel Rose: linear-gradient(135deg, #FCA5A5 → #FECACA)

TYPOGRAPHY:
- Font family: Inter (system-ui fallback)
- Scale: H1 (28px/bold), H2 (22px/semibold), Subtitle (18px/medium), Body (15px/regular), Caption (13px/medium), Tiny (11px/medium)
- Line-height: 1.4 for body, 1.2 for headings

RADII:
- Small card: 12px (0.75rem)
- Large card / modals: 16px (1rem)
- Buttons: 12px
- Pills/badges: 999px (full)

SPACING: 4px base scale. Screen padding: 16px horizontal.

SHADOWS (subtle, layered):
- Card rest: 0 2px 8px rgba(0,0,0,0.04) light / 0 2px 12px rgba(0,0,0,0.3) dark
- Elevated (modals, active cards): 0 8px 24px rgba(0,0,0,0.08) / 0 8px 32px rgba(0,0,0,0.5)
- Glass-morphism variant: backdrop-filter blur(24px), semi-transparent surface

COMPONENTS TO SHOW (both dark and light side-by-side):

1. Buttons: Primary (peach gradient), Secondary (outlined), Ghost (text-only), Destructive (coral). Sizes sm/md/lg. States: default, hover, pressed, disabled, loading (with spinner).

2. Cards: 
   - PastelCard (soft gradient background + subtle border)
   - GlassCard (frosted blur + translucent)
   - Standard Card (flat surface + shadow)
   Each with header (title + optional icon), body, optional footer.

3. Badges: Status badges (active=mint, completed=lavender, urgent=coral, pending=butter). Pill-shaped with 11px text, 8px horizontal padding.

4. Inputs: Text input, search input with leading icon + clear button, number input with +/- stepper. Focus state uses peach ring.

5. Tabs: Underline-style tabs (shadcn-inspired), active indicator uses peach, icon + label layout.

6. Progress bar: Horizontal, 6px tall, 999px radius, peach fill on muted track. Also show animated shimmer variant for skeleton loading.

7. Bottom Sheet: Modal from bottom with 16px top radius, drag handle (36×4px muted), title, content, action buttons.

8. Skeleton loaders: Card skeleton, list item skeleton — use shimmer animation (translateX -100% → 100% over 1.5s).

9. Empty state: Centered layout — soft illustration circle (peach/lavender gradient, 96px), title, subtitle in muted color, primary CTA.

10. Bottom Navigation: **4 icons** (lucide-react style) with label below — Home, Menu (utensils), Stats (trending-up), Profile (user). There is NO separate "Vote" tab — voting happens in a widget on HomePage that changes state. Active item highlighted with peach pill background. Sticky bottom, glass-morphism background, safe-area padding.

11. Top Header: App title left (with small bot icon), action icons right (notifications, settings). 56px tall, glass background.

12. Toasts (Sonner-style): Top-center, pill-shaped, success/error/info variants.

LAYOUT EXAMPLE:
Show a sample screen wireframe at the bottom demonstrating the full chrome: header + scrollable content + bottom nav. Use a placeholder card in the content area.

Deliverable: A single long-scroll artifact presenting this entire system as a browsable style guide, with dark/light toggle at the top. Annotate each section with its name.
```

---

## Промт №1 — HomePage (главный экран)

```
Use the "Rocket Lunch" design system (peach/lavender pastel palette, Inter font, 12–16px radii, mobile 375px). Design the HomePage — the heart of the app where users see today's food poll and interact with it.

STRUCTURE (top to bottom, scrollable):

1. HomeHeroCard (adaptive greeting):
   - Full-width card, pastel gradient background that adapts to time of day:
     · Morning (6–11): peach gradient
     · Afternoon (11–17): butter/warm gradient
     · Evening (17–23): lavender gradient
   - Greeting text: "Доброе утро, Игорь ☀️" (H1, white/dark text depending on contrast)
   - Subtitle: "Что едим сегодня?" (Subtitle, 80% opacity)
   - Small avatar cluster right side (3 overlapping circles = other participants)

2. InlineVotingCard (the main interactive widget) — show THREE variants stacked:

   Variant A — No active poll (empty state):
   - Muted card with illustration (peach gradient circle with utensils icon)
   - Title: "Пока нет активного голосования"
   - Subtitle: "Запустите опрос, чтобы выбрать обед"
   - Primary button: "Создать опрос"

   Variant B — Active poll, user hasn't voted:
   - PastelCard, peach-tinted header
   - Title: "Голосование: Обед"
   - Countdown badge (peach pill): "⏱ 12:34" (animated, pulses last minute)
   - Participant count: "👥 5 участников · 3 проголосовали"
   - 4 menu items stacked as rows, each: food emoji (40px circle), name, current votes count, and a radio-style select circle right side
   - Big primary CTA at bottom: "Проголосовать" (disabled until selection)
   - Live vote counter above options: "Голоса обновляются в реальном времени"

   Variant C — Active poll, user has voted:
   - Same card but each option now shows horizontal bar chart (mint fill for the user's pick, peach gradient for others), percentage label right, count label left
   - Checkmark badge on user's chosen option; user's row has mint-tinted background
   - Confirmation footer inside the card (mint-tinted pill): "✅ Вы проголосовали за Пельмени"
   - **Two action buttons side-by-side below the footer** (both ghost/secondary, not primary):
     · "Изменить выбор" (peach text) — reopens the radio-select list
     · "Отозвать голос" (coral text) — removes user's vote, card returns to Variant B
   - Do NOT replace the CTA with a single "Изменить голос" link — users must see both affordances.

3. HomeActionsSection:
   - 2×2 grid of pastel action cards (each 96px tall, different gradient):
     · "Меню" (peach, utensils icon)
     · "История" (lavender, clock icon)
     · "Статистика" (sage, trending-up icon)
     · "Пригласить" (sky, user-plus icon)

4. BudgetWidgetCompact (only shown if user has open debt):
   - Coral-tinted card, "Долг за обед" title, amount "450 ₽" big, "Оплатить через СБП" CTA

5. Sticky Bottom Navigation (from design system): Home tab active.

STATES TO INCLUDE ON THE SAME CANVAS (stack vertically, label each):
- Loading: full-page skeleton (hero card shimmer, 3 voting skeleton rows, action grid skeletons)
- Empty (variant A above)
- Active poll not voted (variant B)
- Voted (variant C)
- Completed poll — CompletedPollWidget (NOT just a collapsed winner):
  · WinnerCard at top (butter gradient, crown emoji, winner dish name H1, "5 из 9 голосов · Pho & Roll", delivery ETA "25 мин · ≈ 13:15")
  · Duty banner (lavender): "Сегодня дежурит: Анна" with her avatar, role "принимает заказ · раздаёт", chevron right
  · **Expandable full results section** below WinnerCard:
    - Header row: "Все результаты (4)" + chevron toggle
    - When expanded: all 4 dish options as horizontal bar rows (same visual language as Variant C), sorted by votes desc, winner row has crown badge
    - Each row also shows list of voter avatars who picked that dish (stacked, +N chip if more than 3)
  · Footer actions: "Новое голосование" (primary) + "История" (ghost)

ANIMATIONS TO ANNOTATE:
- Greeting card fades in + slides up on mount
- Vote count numbers tick/roll when updated
- Countdown badge pulses red in final minute
- Bars fill with 300ms ease-out on vote

Dark + light theme versions side by side.
```

---

## Промт №2 — Voting Flow & Results (рулетка + победитель)

```
Use the "Rocket Lunch" design system. Design the full voting flow from tapping a menu option to the roulette reveal and results announcement. One artifact, five sequential frames stacked vertically, each labeled.

FRAME 1 — Selecting a dish:
Expanded InlineVotingCard showing 4 dish options as tactile rows. Selected row has peach-tinted background + peach checkmark badge. Others have hover-lift on tap. Dish row anatomy: 48px rounded food-emoji circle, dish name (body, bold), description (caption, muted), current votes badge ("2 🗳"), radio indicator.

FRAME 2 — Vote submitted, live results:
Same card but options now render as animated horizontal bar rows. User's pick: mint fill. Others: peach gradient fill. Each row: dish name, bar (60–100% width proportional), "X votes · Y%" right-aligned label. Top confirmation ribbon: "✅ Ваш голос учтён".

FRAME 3 — Timer expired / poll closing:
Hero banner peach-to-lavender gradient animated overlay, text: "Подводим итоги...", spinner, sub-caption: "Ищем ответственного". Background content blurs (backdrop-filter 12px).

FRAME 4 — RouletteRevealOverlay (the wow moment):
Full-screen modal, dark overlay (rgba 0,0,0,0.7). Center: horizontal roulette strip of participant avatars (48px circles) scrolling right-to-left with momentum decay. Selected avatar snaps to center with scale bounce (1→1.2→1), confetti particles explode outward, haptic indicator. Below strip: big H1 text "🎉 Сегодня дежурит" + participant name in peach, role badge "Ответственный за заказ". Close button (X) top-right.

FRAME 5 — PollResultsPage (dedicated results screen):
Header: back chevron + "Результаты" + share icon.
Hero WinnerCard: pastel peach gradient background, crown emoji watermark, winner dish big (H1) with emoji, "Победитель" label above, vote count "5 из 8 голосов (62%)" below.
Responsible banner: lavender card, avatar + name + "дежурит сегодня" + "Написать" ghost button.
Vote breakdown section: each dish as bar row (like Frame 2) sorted by votes desc, winner row highlighted.
Participants section: avatar grid, "Проголосовали: 8/12", list of who picked what (collapsible).
Footer: "Новое голосование" primary button, "История" ghost button.

EDGE CASES TO SHOW (smaller thumbnails at the bottom):
- Tie / Multi-winner: two dishes side-by-side with shared crown, "Ничья!" badge, roulette picks between them
- No votes: muted state "Никто не проголосовал", option to restart
- Solo voter: "Голосовал только ты — выбор автоматически засчитан"

Provide dark and light variants.
```

---

## Промт №3 — MenuPage (управление блюдами)

```
Use the "Rocket Lunch" design system. Design the MenuPage — where users browse and manage the dish catalog.

STRUCTURE:

1. PageHeader: title "Меню", right side: search icon + filter icon + "+" add button (peach circular FAB-style, 40px).

2. GlassSearchBar (appears when search tapped): full-width frosted-glass input with leading magnifier, placeholder "Поиск блюд...", clear X right. Animates down from header.

3. SortSelector: right-aligned dropdown "По популярности ▾" (options: популярности, алфавиту, цене).

> Note: **category filter chips** (Супы/Горячее/Салаты/etc.) are NOT part of the current product — do not design them. Filtering is done only via search input. If you want to propose category chips as a future enhancement, put them in a separate "proposed additions" thumbnail at the bottom of the artifact, clearly labeled.

5. Menu list (virtual scroll, MenuItemCard rows):
   - Each card: 72px tall, horizontal layout
   - Left: 56px rounded-card food image/emoji placeholder with pastel gradient background
   - Middle: dish name (body bold), description (caption muted, single line truncated), price pill ("350 ₽" peach pill)
   - Right: status badge (mint "Активно" / muted "Архив"), kebab menu (⋮) for edit/delete
   - Swipe-left reveals red delete action
   - Long-press → haptic → edit mode (whole card lifts with shadow)

6. Floating Action Button (bottom-right above nav): peach circular 56px "+" opens bottom sheet for adding.

7. Bottom sheet "Добавить блюдо" (MenuForm):
   - 16px top radius, drag handle
   - Form fields: image upload (dashed peach border box, "Загрузить фото"), name input, description textarea, price input with "₽" suffix, category dropdown, toggle "Активно"
   - Footer: "Сохранить" primary + "Отмена" ghost

8. Empty state: illustration of empty plate, "Меню пустое", "Добавьте первое блюдо" CTA.

9. Suggestions panel (collapsible section): "Предложено участниками (3)", each suggestion card shows dish name, who suggested, "Принять" mint button / "Отклонить" coral ghost button.

STATES TO INCLUDE:
- Loading: MenuGridSkeleton (6 skeleton rows with shimmer)
- Empty menu (described above)
- Search active with results
- Search active no results ("Ничего не найдено", shrug emoji)
- Edit mode card
- Delete confirmation bottom sheet ("Удалить Пельмени?", destructive CTA)

Show dark and light versions.
```

---

## Промт №4 — BudgetWidgetWithCalculator (priority-based adaptive widget)

```
Use the "Rocket Lunch" design system. Design the BudgetWidgetWithCalculator — an adaptive card that lives on HomePage and changes based on the user's ROLE + lunch state after a poll closes.

IMPORTANT: the widget is **priority-driven**, not a flat list of 6 fixed screens. The backend exposes user role (responsible / admin / participant) and transaction state (pending / paid / confirmed). Claude must design the widget as ONE intelligent component that resolves to the highest-priority applicable scenario.

Produce ONE artifact showing all scenarios as separate labeled cards stacked vertically. Each card is ~340px wide (mobile), rounded 16px.

RESOLUTION PRIORITY (top wins if multiple apply):

┌─ PRIORITY 1: User is the RESPONSIBLE person (they paid for everyone) ─┐
│  1a. Calculation not yet completed → CompactResponsibleBanner          │
│  1b. Calculation done, awaiting payments → ResponsibleView             │
│  1c. All paid + confirmed → SuccessResponsibleView                     │
└────────────────────────────────────────────────────────────────────────┘

┌─ PRIORITY 2: User is ADMIN with pending orders (not responsible) ──────┐
│  2a. Selection of responsible in progress → SelectionInProgressCard    │
│  2b. Waiting for responsible to calculate → WaitingForCalculationCard  │
└────────────────────────────────────────────────────────────────────────┘

┌─ PRIORITY 3: User is PARTICIPANT with a debt ──────────────────────────┐
│  3a. Urgent debt (< 5 min after calc, action needed) → UrgentDebtView  │
│  3b. User marked paid, awaiting confirmation → WaitingConfirmationView │
│  3c. Payment confirmed → SuccessMessageView (auto-collapse after 5s)   │
└────────────────────────────────────────────────────────────────────────┘

┌─ FALLBACK: No active debts/orders ────────────────────────────────────┐
│  HiddenState: widget collapsed to thin pill or not rendered at all    │
└───────────────────────────────────────────────────────────────────────┘

DETAILED SCREENS TO DESIGN:

P1a — CompactResponsibleBanner (peach gradient, compact 88px tall):
- Crown emoji + "Вы ответственный сегодня"
- Sub: "Рассчитайте расходы после получения заказа"
- Primary CTA: "Рассчитать" (opens CalculatorModal)

P1b — ResponsibleView (peach gradient, expanded):
- Crown watermark top-right
- Title: "Вы ответственный сегодня 👑"
- "Вы заплатили: 1 800 ₽" big number
- Progress: "Получено: 900 ₽ из 1 800 ₽" with mint progress bar (50%)
- Debtors list: avatar rows with name, amount, status pill (mint "Оплачено" / butter "Ожидание" / coral "Просрочено"), "Напомнить" ghost button per row
- Secondary CTA: "Поделиться реквизитами СБП"

P1c — SuccessResponsibleView (mint gradient):
- Big checkmark, "Все оплатили! 🎉"
- Summary: "1 800 ₽ получено от 5 участников"
- Auto-collapses after 5s

P2a — SelectionInProgressCard (lavender-soft gradient):
- Spinner (lavender-400, rotating)
- Title: "Выбираем ответственного"
- Sub: "Рулетка запущена, подождите..."

P2b — WaitingForCalculationCard (butter-soft gradient):
- Clock icon (slow rotate)
- Title: "Ожидаем расчёт"
- Sub: "<Имя> получает заказ и скоро рассчитает расходы"

P3a — UrgentDebtView (coral gradient):
- Pulsing "🔥 Срочно" pill top-left
- Big "450 ₽" (H1 bold)
- Sub: "Вы должны Анне за обед"
- Countdown: "⏱ Оплатите в течение 5 минут"
- 5-min progress bar depleting right-to-left
- Two CTAs: Primary "Оплатить через СБП" (white bg + QR icon) + Ghost "Отметить как оплачено"
- Creditor avatar top-right (40px)

P3b — WaitingConfirmationView (butter-soft):
- Clock icon
- Title: "Ожидаем подтверждения"
- Body: "Вы отметили оплату 450 ₽ Анне. Ждём подтверждения."
- Timestamp: "Отмечено 2 минуты назад"
- Ghost: "Отменить отметку"

P3c — SuccessMessageView (mint gradient):
- Big checkmark + confetti burst
- Title: "Оплата подтверждена! 🎉"
- Body: "Анна получила 450 ₽"
- Also show the auto-collapsed compact variant (single mint pill: "✓ 450 ₽ оплачено")

HiddenState: NOT rendered, OR ultra-thin pill "💰 Бюджет в балансе" at the very bottom of HomePage.

CALCULATOR MODAL (bottom sheet, triggered from P1a):
- Title "Рассчитать расходы"
- Input "Общая сумма заказа" with ₽ suffix
- Participants list with checkboxes (default all checked), per-person amount auto-calculated
- Option "Разделить поровну" toggle OR "Ввести вручную" (reveals per-person inputs)
- Live total preview at bottom
- Primary CTA: "Создать транзакции"

ANNOTATION REQUIREMENT: At the top of the artifact, include a small flowchart showing the priority resolution — so viewers understand this is ONE widget with branches, not 6 separate screens.

Show dark and light variants for each scenario.
```

---

## Промт №5 — StatsPage (графики, инсайты, лидерборд)

```
Use the "Rocket Lunch" design system. Design the StatsPage — personal and group analytics with a playful "lunch DNA" vibe.

STRUCTURE:

1. Header: "Статистика", period selector right ("Неделя / Месяц / Всё время" tabs).

2. Three main tabs (underline style): "Обзор" (active), "Инсайты", "Лидерборд".

TAB 1 — Обзор:
   a. LunchDnaCard (signature hero): pastel gradient card (peach→lavender), title "Ваше ДНК обеда", three stats in a row:
      · 🍜 Любимое блюдо: "Пельмени" (42%)
      · ⏱ Среднее время выбора: "23 сек"
      · 🎯 Голосует за победителя: "71%"
      Circular progress rings around each.

   b. Donut chart card: "Ваши предпочтения", donut of top 5 dish categories with legend right. Use pastel palette (peach, lavender, mint, sky, rose).

   c. Line chart card: "Активность голосований" — 30-day line chart, peach line, area fill gradient peach→transparent. X-axis dates, Y-axis vote count. Tooltip on hover.

   d. Stat tiles grid (2×2): "Участвовали: 47 опросов", "Выигрыш: 12 раз", "Пропустили: 3", "Самый активный день: Среда". Each tile: icon + number (H1) + label (caption).

   e. BudgetInsightsWidget: "Финансы", small peach card with arrows (spent/received), same style as BudgetWidget Overview.

TAB 2 — Инсайты (recommendations):
   - List of InsightsCard rows, each a pastel-gradient horizontal card:
     · 💡 "Вы чаще всего голосуете за супы по понедельникам" + "Изучить паттерн →"
     · 🎯 "Попробуйте азиатскую кухню — 80% коллег голосуют ЗА" + CTA
     · 📊 "Ваш выбор совпадает с Аней в 73% случаев"
   - Each card tappable to expand, different pastel gradient backgrounds.
   - TopDishModal trigger: card "Блюдо месяца" with dish photo and "Открыть детали".

TAB 3 — Лидерборд:
   - Podium top 3: 3 avatars on pastel blocks (gold peach, silver lavender, bronze butter), name + score
   - Full ranking list: rows with rank number, avatar, name, score, delta arrow (↑3 green / ↓1 red)
   - Current user row: highlighted with peach outline, sticks to bottom when scrolling past

3. Include a parallax scroll effect annotation: background pastel gradient blobs move slower than content.

STATES:
- Loading: 3 skeleton cards with shimmer
- Empty (new user): "Пока нет статистики, проголосуйте впервые!" with CTA

Show dark + light variants.
```

---

## Промт №6 — ProfilePage + PollHistoryPage

```
Use the "Rocket Lunch" design system. Design TWO screens side-by-side in one artifact.

SCREEN A — ProfilePage:

1. Header: "Профиль", settings gear icon right.

2. ProfileHero card (lavender pastel gradient, centered):
   - Large avatar 96px, peach ring border if user is admin
   - Name "Игорь Кравцов" (H1)
   - Username "@grizzzzly" (caption muted)
   - Role badge row: "👑 Админ" (peach pill) + "🏆 12 побед" (mint pill)
   - Join date: "В команде с января 2026"

3. Stats summary card (3-column grid):
   - "47 опросов" / "12 побед" / "71% активность"
   - Each column: big number + tiny label

4. Section "Ваша история голосований" (preview of 3 recent):
   - Compact PollCard rows: date, dish emoji, dish name, "Вы выбрали ✓" or "Вы пропустили" badge
   - "Вся история →" ghost button

5. Section "Настройки":
   - List rows: "🔔 Уведомления" (toggle right), "🌙 Тёмная тема" (toggle), "💳 Реквизиты СБП" (chevron), "🌐 Язык: Русский" (chevron)

6. Section "Обратная связь":
   - Expandable feedback form: textarea "Ваше мнение...", "Отправить" primary, "Сообщить об ошибке" ghost link.

7. Footer: "Выйти из аккаунта" muted destructive button, app version "v2.0.0" tiny text.

SCREEN B — PollHistoryPage:

1. Header: "История голосований", back chevron, filter icon right.

2. Filter chips (scrollable): "Все", "Я победил", "Я участвовал", "Пропустил".

3. Timeline layout — each day is a section:
   - Date header sticky "Вчера, 15 апреля" (caption muted)
   - Poll cards stacked beneath (PollCard):
     · Horizontal card, left: winning dish emoji circle 48px
     · Middle: dish name (body bold), "Победитель из 4 вариантов" caption, your result ribbon: "✓ Вы выбрали" (mint) or "✗ Не совпало" (muted)
     · Right: chevron + count "5 голосов"
   - Tap → navigates to PollResultsPage

4. Load more / infinite scroll skeleton at bottom.

5. Empty state: "История пуста", "Участвуйте в первом опросе" CTA.

STATES ON BOTH:
- Loading skeletons
- Empty states
- With data (the default shown)

Dark + light variants side-by-side.
```

---

## Промт №7 — AdminDashboard + Poll Creation Flow

```
Use the "Rocket Lunch" design system. Design the admin surfaces: AdminDashboardPage and the full poll creation wizard. Two sections in one artifact.

SECTION A — AdminDashboardPage:

1. Header: "Админ-панель", badge "Только для админов" (peach pill).

2. AdminChecklist hero: peach gradient card, "3 задачи требуют внимания", 3 checklist rows:
   ☐ "Подтвердить 2 новые заявки" (chevron)
   ☐ "Закрыть просроченный опрос" (chevron coral)
   ☐ "Добавить меню на понедельник" (chevron)

3. Quick actions grid (2×2 pastel cards):
   - "Создать опрос" (peach, + icon)
   - "Рассылка" (lavender, megaphone)
   - "Управление меню" (sage, utensils)
   - "Модерация" (rose, shield)

4. AdminInsights section:
   - Stat tiles: "Активных пользователей: 24", "Средняя явка: 71%", "Опросов за месяц: 18"
   - Mini bar chart: "Явка по дням недели"
   - "Подозрительная активность" alert card if any (butter/coral)

5. Users section (AdminControls):
   - Search user input
   - List rows: avatar, name, role badge, "Сделать админом" ghost button or "Заблокировать" destructive
   - Pagination at bottom

6. Poll management section:
   - Active polls list (mint "Активен" pills), admin actions: "Закрыть досрочно", "Удалить"
   - Scheduled polls (lavender "Запланирован" pills)

SECTION B — CreatePollForm (single-screen form, NOT a 3-step wizard):

> The real product uses a **single scrollable form**, not a progress-bar wizard. Design accordingly. If you want to show a 3-step variant as a proposed alternative, place it as a smaller "alt proposal" thumbnail at the bottom.

Main form (bottom sheet from FAB, OR full page from admin dashboard):
- Header: drag handle + title "Создать опрос" + close X
- Section "Основное":
  · Input "Название" (prefill "Обед 15 апреля")
  · Duration pill chips: 15 мин / 30 мин / 1 час / Кастомное
  · Toggle "Повторяющийся опрос" (expands to Пн/Вт/Ср/Чт/Пт chips + time picker)
- Section "Блюда": 
  · Multi-select list of MenuItemCards with checkboxes (virtualized, up to 6 selected)
  · "Выбрано: 4 из 6" counter sticky above list
  · Collapsible "Добавить вручную" section with free-text rows ("+ Добавить вариант")
- Section "Участники":
  · Radio group: "Все" / "Только постоянные" / "Выбрать вручную" (last reveals member picker)
- Preview card at bottom: live summary of poll as participants will see it
- Sticky footer with single primary CTA: "Запустить опрос 🚀" (peach gradient, full-width)

Include BottomSheet **quick-create** variant (condensed, triggered from HomePage empty state): just name + duration + "Выбрать из меню" chevron → opens the full form.

STATES:
- Validation errors inline (coral text + red ring)
- Loading state on submit (button spinner)
- Success confirmation bottom sheet: "🚀 Опрос запущен!", "Поделиться в чате" CTA

Dark + light variants.
```

---

## Continuation Mode — для нового чата с прикреплёнными HTML

**Когда использовать:** у тебя уже есть готовые HTML-экспорты (`Rocket Lunch Design System.html`, `Rocket Lunch Home.html`, `Rocket Lunch MenuPage.html`, `Rocket Lunch Voting Flow.html`), ты открываешь **новый чат** в claude.ai/design и хочешь продолжить работу над недостающими экранами без пересоздания дизайн-системы.

### Шаг 1 — Bootstrap-промт (прикрепи все HTML-файлы как attachments и отправь):

```
I'm continuing work on a design project called "Rocket Lunch" — a Telegram Mini App for group food voting. I've attached the existing artifacts from my previous chat:

1. Rocket Lunch Design System (standalone).html — the canonical design system: palette, typography, radii, shadows, primitives (buttons, cards, badges, inputs, tabs, bottom sheet, skeletons, empty state, bottom nav, top header, toasts).
2. Rocket Lunch Home.html — HomePage with 5 states (Loading, Empty morning, Active voting not voted, Voted live results, Closed winner).
3. Rocket Lunch MenuPage.html — MenuPage with search + list + FAB + add-dish bottom sheet.
4. Rocket Lunch Voting Flow.html — voting flow frames (select → submit → timer expire → roulette reveal → results page).

RULES FOR THIS CHAT:
- Treat the attached HTML files as the single source of truth for all design tokens (colors, gradients, shadows, radii, typography) and for any component already designed in them.
- Do NOT regenerate the design system — reuse tokens verbatim.
- When I ask for a new screen, build it in the same visual language: Inter font, pastel gradients (peach/lavender/sage/sky/butter/rose/coral), 12–16px radii, pixel-perfect consistency with the attached exports.
- Mobile viewport: 375px base, 430px max. Mini App running inside Telegram.
- Bottom Navigation has **4 tabs only**: Home, Menu, Stats, Profile. There is NO separate Vote tab — voting is a widget on Home.
- Always produce BOTH dark and light variants side-by-side for every screen.
- At the start of each artifact, briefly restate which tokens you're reusing (1–2 lines), so I can verify consistency.

Acknowledge that you've loaded the attachments and list: (a) all design tokens you extracted, (b) screens that are already designed, (c) screens still missing. Then wait for my next instruction.
```

### Шаг 2 — Запрос недостающих экранов

После bootstrap-промта Claude будет знать контекст. Дальше запрашиваешь оставшиеся экраны **промтами из этого файла** (№4 BudgetWidget, №5 StatsPage, №6 Profile + History, №7 Admin + Create Poll), но **без повторного описания дизайн-системы** — добавляй в начало каждого запроса короткое:

> *"Using the attached design system and the previously-produced Home/Menu/Voting-Flow artifacts as reference, design the following screen:"*

— и затем копируй соответствующий промт (№4 / №5 / №6 / №7).

### Шаг 3 — Обновление уже существующих экранов (`update-*` промты)

Если после сравнения с реальным кодом нашли расхождения в уже сгенерированных HTML — не пересоздавай экран целиком, используй точечные патч-промты. Шаблон:

```
Update the "<Screen Name>" artifact (attached file: <filename>.html). Apply these changes and re-export the whole screen in the same style:

<bullet list of exact changes, e.g.:>
- In Variant C (Voted state), add a SECOND action button "Отозвать голос" (coral ghost) next to "Изменить выбор". Both should be below the mint-tinted confirmation footer.
- Remove the category filter chips row (Супы/Горячее/…) from MenuPage — keep only search + sort dropdown.
- In Completed state, replace the collapsed winner card with an expandable full-results list: winner card on top + "Все результаты (4)" expandable section with bar rows for every option sorted by votes desc.

Keep everything else identical. Preserve all existing tokens and layout. Dark + light side-by-side as before.
```

### Частые патчи, которые, скорее всего, понадобятся (готовые к копированию)

**Patch 1 — HomePage Voted state (двойная кнопка):**
```
Update the Rocket Lunch Home.html artifact. In state 04/05 (Voted — live results), replace the single "Изменить" ghost button with TWO side-by-side secondary buttons below the mint confirmation footer:
- "Изменить выбор" (peach text, no background) — on tap reopens the radio-select list from state 03
- "Отозвать голос" (coral text, no background) — on tap removes the user's vote and returns to state 03

Keep the mint "✓ Вы проголосовали за <Dish>" footer above both buttons. Apply to both dark and light variants.
```

**Patch 2 — HomePage Closed state (expandable full results):**
```
Update the Rocket Lunch Home.html artifact. In state 05/05 (Closed — winner), expand the widget beyond just the WinnerCard:

- Keep the WinnerCard (butter gradient, crown, "Победил: Фо Бо", delivery ETA, duty banner) at the top.
- Below it add "CompletedPollResults" section:
  · Header row "Все результаты (4)" + chevron toggle
  · Expanded view: all dish options as horizontal bar rows (same visual as state 04), sorted votes-desc, winner row has a small crown badge left of the name
  · Each bar row can be tapped to reveal voter avatars (stacked +N chip if >3)
- Footer: "Новое голосование" (primary) + "История" (ghost)

Dark + light variants.
```

**Patch 3 — MenuPage (удалить фильтр-чипы):**
```
Update the Rocket Lunch MenuPage.html artifact. Remove the horizontal FilterChips row (Всё / Супы / Горячее / Салаты / Десерты / Напитки) entirely. Keep: header, search input, sort dropdown, menu list, FAB, bottom sheet, empty state, suggestions panel. The product does not support category filters.
```

---

## Советы по итерации

- **Закрепить дизайн-систему:** после промта №0 (или bootstrap-промта) скажи Claude: *"Save this design system. For all future prompts in this project, reuse these exact colors, typography, radii, and components."*
- **Один экран — один промт:** не пытайся уместить больше, иначе детали теряются.
- **Итерации:** если какой-то экран не нравится — прямо в том же чате: *"Redo the InlineVotingCard — make the countdown more prominent and remove the emoji"*.
- **Экспорт:** claude.ai/design даёт React + Tailwind код — можно использовать как референс для переписывания реальных компонентов в `frontend-new/`.
- **Патчи > перегенерация:** если расхождение небольшое — используй `update-*` патч-промт, а не начинай экран заново.
- **Синхронизация с реальностью:** перед большой генерацией сверяйся с production-кодом в `frontend/` — промты здесь отражают реальный функционал (4 вкладки, «Отозвать голос», priority-driven BudgetWidget, CreatePollForm без wizard'а).
