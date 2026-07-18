# Аудит визуального слоя frontend-new

Дата: 2026-07-17. Область: `frontend-new/src` (токены, CSS, inline-стили, паттерны «AI-generated»).
Методика: точечное чтение `src/styles/index.css`, `src/styles/redesign-v2.css`, `src/components/rl/*`; количественные метрики — `grep -ro/-rc` по `src/` (маски `*.tsx`, `*.css`), см. раздел «Метрики».

---

## 1. Текущие системы токенов

В проекте **две параллельные системы CSS-переменных** плюс Tailwind-конфиг, который почти не используется.

### 1.1. Обзор

| | `src/styles/index.css` | `src/styles/redesign-v2.css` |
|---|---|---|
| Размер | 181 строка / 5.7 KB | 473 строки / 23.7 KB |
| Определений `--var` | 55 (42 уникальных имени) | 88 (58 уникальных имён) |
| Ключ темы | класс `.dark` на `<html>` | атрибут `[data-theme="light\|dark"]` |
| Скоуп компонентов | глобальный (`body`, keyframes) | утилиты и компоненты под `.rl` |
| Происхождение | порт из `Rocket Lunch Design System.html` (старый макет) | порт из «Redisign v2» → «Графит и мёд» |

### 1.2. Таблица переменных (сопоставление)

| Роль | index.css | redesign-v2.css | Конфликт значений |
|---|---|---|---|
| Поверхность карточки | `--surface` (#1E2025 dark) | `--bg-elevated` (#1E2025 dark) | нет — дубликат под разными именами |
| Фон-подложка | `--surface-2` (#17181C dark / #F3F5F8 light) | `--bg-base` (**#121317** dark / **#F1F3F6** light) | **да — значения расходятся** |
| Текст основной | `--ink` (#F1F3F7) | `--text-primary` (#F1F3F7) | нет — дубликат |
| Текст вторичный | `--ink-2` (#AEB5C0) | `--text-secondary` (#AEB5C0) | нет — дубликат |
| Текст третичный | `--ink-3` (#787F8C) | `--text-tertiary` (#787F8C) | нет — дубликат |
| Разделитель | `--line` / `--line-2` | `--border-subtle` / `--border-strong` | `--line`=`--border-subtle`; `--line-2`≠`--border-strong` (у второго акцентный цвет) |
| Акцент | `--pri` (**#D68914** light / #F0AB46 dark) | `--accent` (**#B27708** light / #F0AB46 dark) | **да — light-значения разные** |
| Текст на акценте | `--pri-ink` (#261A02) | `--accent-foreground` (#261A02) | нет — дубликат |
| Градиент карточки | `--card-grad` | `--card-grad` | **единственное буквальное совпадение имени**: определён в обоих файлах с одинаковыми значениями, но ключуется по-разному (`.dark` vs `[data-theme]`) |
| Тень карточки | `--shadow-card` | `--shadow-1` | близки, не идентичны (у `--shadow-1` два слоя) |
| Тень elevated | `--shadow-elev` | `--shadow-2` | идентичные значения — дубликат |
| Фон страницы | `--page-bg` | `--bg-page` | идентичные значения, **имя зеркально перевёрнуто**; `body::before` в index.css:122 читает `var(--bg-page, var(--page-bg))` — цепляет обе системы сразу |
| Шрифты | `--sans`, `--display`, `--mono` | `--font-body`, `--font-head` | дубликаты (кроме `--mono`, который есть только в index.css) |
| Только в index.css | бренд-палитра `--peach/lav/mint/coral/butter-*` (13 шт.), пастельные градиенты `--g-peach…--g-peachlav` (9 шт.), алиасы `--page-ink/muted/line` | — | наследие старого дизайна, живо из-за budget.css/admin.css/profile.css |
| Только в redesign-v2.css | — | шкалы: `--sp-1…16`, `--r-card/block/btn/pill`, `--t-11…28`, `--ease-spring/out`, `--dur-1/2/3`, `--nav-h`, `--safe-top`; семантика: `--accent-hover/active/tint/ring/grad(-hover/-active)`, `--success/danger/warning/info` (+`-tint`, `-foreground`), `--float-grad`, `--surface-glass`, `--glass-blur`, `--shadow-3`, `--accent-glow` | это де-факто «настоящая» система |

Вывод: redesign-v2.css — рабочая система; index.css несёт (а) дублирующий слой под старыми именами и (б) легаси-палитру пастельных градиентов. `body` в index.css:111 смешивает обе: `color: var(--text-primary, var(--ink))`.

### 1.3. tailwind.config.js

- `darkMode: 'class'`, палитра `peach/lavender/mint/coral/butter`, семантические цвета через `var(--surface)`/`var(--ink)`/`var(--pri)` (т.е. привязан к **старой** системе index.css), `backgroundImage` с 11 градиентами (`grad-peach`… `btn-primary-dark`), `fontFamily` Onest/Unbounded, `boxShadow: var(--shadow-card/elev)`.
- **Фактическое использование Tailwind ничтожно**: из 743 `className=` в `*.tsx` только ~20 содержат utility-классы (метод: grep по `flex|grid|px-|py-|text-(xs|sm…)|bg-|rounded` внутри `className="…"`). Практически единственный потребитель — `src/components/ui/Card.tsx` (варианты `bg-grad-peach`, `backdrop-blur-nav`, `shadow-elev`).
- Директивы `@tailwind base/components/utilities` подключены в index.css:1-3 — т.е. preflight и вся инфраструктура тянутся ради одного файла.

Реальная стилизация приложения: **кастомные классы `.rl *` из redesign-v2.css + 628 inline-объектов `style={{…}}`**. Tailwind — мёртвый груз (кандидат на удаление вместе с ui/Card.tsx после миграции).

---

## 2. Feature CSS

Все файлы — порты HTML-экспортов из claude.ai/design; активно потребляют токены (`var(--…)`), но тащат свои хардкод-цвета и локальные keyframes.

| Файл | Строк / байт | Что определяет | Свои `--var` | Хардкод hex | Градиенты | box-shadow | backdrop-filter | @keyframes | `var(--` |
|---|---|---|---|---|---|---|---|---|---|
| admin.css | 261 / 17.9 KB | админ-панель: hero c градиентным `h1 em` (`--g-peach` text-clip), карточки, табы | 0 | 15 | 8 | 6 | 1 | 3 | 154 |
| budget.css | 674 / 19.4 KB | виджет бюджета `.bw*` (порт Budget Widget.html) | 1 (`--page-card`) | **45** | 11 | 10 | 0 | 5 | 99 |
| budget-overrides.css | 54 / 1.2 KB | React-надстройки над budget.css | 0 | 1 | 0 | 0 | 0 | 1 | 7 |
| home.css | 353 / 12 KB | HomePage (порт Rocket Lunch Home.html) | 0 | 24 | 6 | 5 | 1 | 0 | 84 |
| menu.css | 137 / 15 KB | MenuPage; сверхдлинные строки (минифицированный порт) | 0 | 17 | 12 | 12 | 4 | 3 | 115 |
| profile.css | 172 / 11.4 KB | Profile + History; тот же hero-паттерн с `--g-peach` | 0 | 13 | 4 | 7 | 0 | 1 | 90 |
| stats.css | 545 / 16.9 KB | StatsPage (порт Stats Page.html) | 0 | 20 | 5 | 8 | 0 | 3 | 109 |
| toast.css | 89 / 1.7 KB | тост-стек | 0 | 2 | 0 | 1 | 0 | 1 | 11 |

Итого по feature CSS: **137 хардкод-hex**, **17 локальных @keyframes** (дублируют pulse/fade-варианты из index.css и redesign-v2.css), подключаются точечно из компонентов (`import '@/styles/admin.css'` в AdminDashboard.tsx:8 и т.д.) — порядок каскада зависит от порядка загрузки чанков.

---

## 3. Метрики

Методика: `grep -ro '<pattern>' src --include='*.tsx'|--include='*.css' | wc -l`; топ файлов — `grep -rc | sort -rn`.

| Метрика | Значение | Заявлено ранее | Вердикт |
|---|---|---|---|
| `style={{` в `*.tsx` | **628** (`style={` любых — 630) | ~628 | подтверждено точно |
| Градиенты (linear+radial+conic) | **88** (75 linear + 11 radial + 2 conic); из них 82 в CSS, 8 в TSX (по слову `gradient`) | ~92 | уточнено: 88 |
| Glassmorphism | `backdrop-filter` в CSS: **14** (в т.ч. `-webkit-` дубли); `blur(` всего: 17; `backdropFilter` в TSX: 0 | ~20 | уточнено: 14 деклараций |
| box-shadow | 77 в CSS + 24 `boxShadow` в TSX = **101** | — | — |
| Цветное свечение (glow) | `--accent-glow` (3-слойная тень с rgba(220,150,25,.5)) на `.btn--primary`, `.fab`, Header; boxShadow c rgba в TSX: 1 | — | — |
| border-radius ≥ 20px | TSX `borderRadius: 20–99+`: 42, из них pill (999/50%): 34; CSS `border-radius: ≥20px`: 7; плюс `--r-card: 26px` применяется через var во всех `.card` | — | — |
| Анимации | `@keyframes`: **28** (4 index.css + 7 redesign-v2 + 17 feature CSS); `animation:` в CSS: 36; `animationDelay` в TSX (stagger): 11; классы `anim-rise/anim-pop` в TSX: 16 | — | — |
| `transition: all` | 2 (почти чисто) | — | — |
| `className=` всего / с Tailwind-утилитами | 743 / ~20 | — | Tailwind фактически не используется |

**Топ-10 файлов по `style={{`:**

| # | Файл | Кол-во |
|---|---|---|
| 1 | `src/components/rl/homeWidgets.tsx` | 114 |
| 2 | `src/pages/MenuPage.tsx` | 49 |
| 3 | `src/pages/StatsPage.tsx` | 45 |
| 4 | `src/pages/AdminPage.tsx` | 37 |
| 5 | `src/pages/StoreRunPage.tsx` | 34 |
| 6 | `src/pages/SuggestionsPage.tsx` | 26 |
| 7 | `src/pages/ProfilePage.tsx` | 21 |
| 8 | `src/components/admin/CreatePollSheet.tsx` | 21 |
| 9 | `src/components/admin/DebtManagementCard.tsx` | 17 |
| 10 | `src/components/admin/UserManagementCard.tsx` | 16 |

---

## 4. Каталог анти-паттернов

Для каждого: описание → примеры file:line → чем заменить по брифу (типографика, отступы, разделители вместо карточек и свечений).

### 4.1. Карточка вокруг каждого блока + вложенные карточки
`.rl .card` (градиентный фон + `--shadow-2` + radius 26px) использован **65 раз** в TSX. Каждый виджет главной — карточка; внутри карточек — вложенные `tile`/строки со своими рамками и фонами.
- `src/components/rl/homeWidgets.tsx:255` — `<div className="card" style={{ padding: 18 }}>` (skeleton-карточка)
- `src/components/rl/homeWidgets.tsx:277`, `:537` — карточки с `position: relative; overflow: hidden` под глоу
- `src/components/rl/homeWidgets.tsx:487` — `className="card press"` (карточка-кнопка)

**Замена:** плоские секции на канвасе; иерархия — размером/весом шрифта (`--t-22/--t-18` + Unbounded только для экранного заголовка), вертикальным ритмом (`--sp-6/--sp-8`) и hairline-разделителями (`--border-subtle`, уже есть `.row-divider` в redesign-v2.css:431). Карточка остаётся только там, где блок реально интерактивен целиком.

### 4.2. Декоративная радиальная засветка в карточках (CardGlow)
- `src/components/rl/homeWidgets.tsx:22-37` — компонент `CardGlow`: абсолютный круг 220×220, `radial-gradient(circle, var(--accent-tint), transparent 70%)`; вставлен в карточки на `:143`, `:278` и далее.
- Фон всей страницы — те же засветки: `--page-bg`/`--bg-page` (index.css:61-63, 79-81; redesign-v2.css:49-51, 83-85) — два radial + вертикальный linear, рисуются через `body::before` (index.css:116-123), плюс SVG-шум `body::after` c `z-index: 999` (index.css:126-140).

**Замена:** удалить CardGlow полностью; фон страницы — плоский `canvas`-токен. Если фактура нужна — одна, на уровне канваса, без z-index 999 (перекрывает stacking-context поверх модалок).

### 4.3. Glass navigation / glass-поверхности
- `.rl .bottomnav` — `backdrop-filter: blur(16px)` + `--float-grad` + `--shadow-3` (redesign-v2.css:440-448)
- `.rl .glass` — `blur(var(--glass-blur)) saturate(1.4)` (redesign-v2.css:131-136); применён в `src/components/layout/Header.tsx:14` и `src/components/rl/RouletteRevealOverlay.tsx:66`
- `.rl .surf-floating` — blur(16px) (redesign-v2.css:123-130); `ui/Card.tsx:12` — glass-вариант через `backdrop-blur-nav`

**Замена:** непрозрачный `surface` + верхний hairline-бордер для нижней навигации; blur оставить максимум для одного слоя (например, overlay), убрав `saturate(1.4)`.

### 4.4. Glow-свечение акцента
`--accent-glow` — трёхслойная цветная тень (redesign-v2.css:77, 111) висит на **каждой** primary-кнопке (`.btn--primary`, redesign-v2.css:256), на FAB (redesign-v2.css:288) и на иконке в шапке (`src/components/layout/Header.tsx:36` — `boxShadow: 'var(--accent-glow)'`).
**Замена:** primary-кнопка = плоский `accent` фон + `accent-foreground`; состояние — изменение фона (hover/active-токены уже есть), не свечение. Тени — только нейтральные, по слою elevation.

### 4.5. Градиентные кнопки и индикаторы
- `.rl .btn` по умолчанию красится в `--accent-grad` = `linear-gradient(135deg, #F6BE5F, #D68914)` с hover/active-градиентами (redesign-v2.css:208-213, 67-69, 101-103)
- `.rl .votebar > i` — `linear-gradient(90deg, #D68914, #F6BE5F)` с хардкодом (redesign-v2.css:413)
- `.switch.on`, `.checkbox.on`, `.qvote.on` — тоже `--accent-grad` (redesign-v2.css:347, 357, 424)
- Легаси: 9 пастельных `--g-*` (index.css:28-36), 11 `backgroundImage` в tailwind.config.js, pastel-варианты `ui/Card.tsx:13-15`, текст-градиент `h1 em` в admin.css/profile.css

**Замена:** одноцветный `accent`; градиентный слой оставить максимум одному «hero»-элементу приложения (по брифу — лучше ноль). Легаси-пастель удалять после рефактора callsites (см. memory: ~20 использований gradient-вариантов Button в старом frontend/ — в frontend-new проверить перед выпилом).

### 4.6. Kickers и декоративные чипы
- `src/components/rl/homeWidgets.tsx:41` — `CardKicker` (11px uppercase с разрядкой) — над каждой карточкой: `:291` («Голосование идёт»), `:542` («Итоги голосования»)
- `src/pages/StatsPage.tsx:126` — свой дубль `Kicker` c иконкой (`:256` — crown-иконка в цвет акцента)

**Замена:** kicker допустим как один паттерн уровня страницы, не на каждой карточке; убрать дубль в StatsPage, вынести в общий компонент типографики. Статус («Голосование идёт») — это текст со смыслом, ему хватает `text-secondary` без uppercase-разрядки.

### 4.7. Staggered-появление каждого блока
- `src/pages/HomePage.tsx:70` — каждый виджет обёрнут в `anim-rise` c `animationDelay: i*55ms`
- `src/components/home/InlineVotingCard.tsx:183`, `src/components/home/WinnerCard.tsx:93` — бары с задержкой `i*60ms`
- `src/components/rl/Fab.tsx:74` — пункты speed-dial с обратной задержкой
- Всего: 11 `animationDelay` в TSX, 16 использований `anim-rise/anim-pop`, 28 `@keyframes`

**Замена:** контент рендерится сразу; анимация — только у смены состояния (голос засчитан, тост, skeleton→content одним fade). `prefers-reduced-motion` уже обработан глобально (redesign-v2.css:192-199) — сохранить.

### 4.8. Speed-dial FAB
`src/components/rl/Fab.tsx` (92 строки): `useState(open)`, поворот `+` на 45° (`.fab.is-open`, redesign-v2.css:294), выпадающие пункты со staggered-задержкой (`:74`), glow-тень. FAB 58×58 поверх нижней навигации.
**Замена:** прямые действия в контексте экрана (кнопка в секции) или один пункт в навигации; если действий несколько — bottom sheet (уже есть `src/components/rl/BottomSheet.tsx`), а не парящее меню.

### 4.9. Избыток бейджей
`<Badge` — 19 использований, 6 тоновых вариантов (`.badge--neutral/accent/success/danger/warning/info`, redesign-v2.css:359-370) + `nav-badge` на навигации (redesign-v2.css:462-468).
**Замена:** бейдж — только для счётчиков/статусов, требующих мгновенного считывания; текстовые статусы — обычным `text-secondary`.

### 4.10. Inline-стили как система вёрстки
628 `style={{…}}` — вся сетка, отступы, типографика размазаны по JSX (топ — homeWidgets.tsx: 114). Даже базовые примитивы дополняются inline (`parts.tsx:17, 25, 100`).
**Замена:** после введения семантического слоя (раздел 7) — небольшой набор layout-утилит (stack/row/gap на токенах) или CSS-модули на компонент; inline остаётся только для действительно динамических значений (проценты прогресса, координаты).

---

## 5. Шрифты

- **Загрузка:** Google Fonts CDN, `index.html:12-17` — preconnect к `fonts.googleapis.com` / `fonts.gstatic.com`, один css2-запрос: `Unbounded 500;600;700` + `Onest 400;500;600;700;800`, `display=swap`.
- **Роли:** `--font-head`/`--display` = Unbounded (заголовки, `letter-spacing: -0.03em`), `--font-body`/`--sans` = Onest. Дублирование определений в двух файлах токенов (index.css:44-46 vs redesign-v2.css:22-23).
- **`--mono` = 'JetBrains Mono'** (index.css:46) используется 9 раз в feature CSS, **но нигде не загружается** — молча падает на `ui-monospace/SF Mono/Menlo`. Либо загрузить, либо убрать из стека первое имя.
- **Fallback:** system-ui-стек прописан везде — при недоступности CDN текст останется читаемым (swap), но Unbounded-заголовки деградируют до системного гротеска и потеряют идентичность; FOUT гарантирован.
- **Риск CDN:** аудитория — Telegram (RU-регион), `fonts.googleapis.com` периодически замедляется/блокируется. Рекомендация: self-host woff2 (subset latin+cyrillic, это 2 семьи × 3-4 веса ≈ 150-250 KB) через `@font-face` c `font-display: swap`, preload для body-regular. Пять весов Onest — много; хватит 400/600/700.

---

## 6. Темизация

**Механизм — двойной, оба ключа ставятся одновременно:**
1. `src/main.tsx:27-32` — до рендера: тема = localStorage-override → иначе `tg.colorScheme` → иначе `prefers-color-scheme`; ставит `data-theme` **и** `classList.toggle('dark')`.
2. `src/lib/appearance.ts:37-38` — то же дублирование (`setAttribute('data-theme')` + `classList.toggle('dark')`).
3. `src/lib/telegram.ts:112-117` — при `themeChanged` от Telegram обновляет `data-theme` (подписка на colorScheme).

Двойной ключ существует потому, что redesign-v2.css ключуется по `[data-theme]`, а index.css и tailwind (`darkMode: 'class'`) — по `.dark`. Единый семантический слой позволит оставить один механизм (`data-theme`).

**Связь с Telegram:**
- Используется только `colorScheme` (light/dark). **`themeParams` (bg_color, text_color, button_color…) не используются ни в одном компоненте** — вся палитра «Графит и мёд» захардкожена. Это осознанное решение (свой бренд), но см. маппинг в разделе 7 для деградации к нативным цветам.
- `src/lib/telegram.ts:89-93` — обратная связь: приложение само красит шапку/фон Telegram (`setHeaderColor`/`setBackgroundColor`) хардкод-значением по текущей теме.
- CSS-переменные `--tg-theme-*` нигде не читаются.

**Браузерный fallback:** `prefers-color-scheme` в main.tsx:27; в CSS media-query нет — тема целиком управляется из JS (до выполнения main.tsx действует light-набор из `:root`).

---

## 7. src/components/rl/primitives.tsx и parts.tsx

- **primitives.tsx (416 строк)** — Spinner, Button (9 вариантов: primary/secondary/outline/ghost/link/success/warning/danger/info), IconButton, Field, SearchBar, Switch, Checkbox, Badge (6 тонов), Chip, Segmented, Avatar, CountUp, Confetti, Dots. Построены **правильно**: классы из redesign-v2.css (`.btn`, `.field`, `.badge`…), inline-стилей всего 7 (динамика: размер спиннера, confetti-координаты). Это хороший фундамент — проблема не в примитивах, а в том, что страницы их обходят и верстают inline.
- **parts.tsx (170 строк)** — BackHeader, CircularTimer (SVG), AvatarStack, Trophy, SectionTitle. Здесь 14 inline-стилей, включая статическую вёрстку (`:17` — flex-контейнер, `:25` — типографика заголовка) — кандидаты на классы.
- **Fab.tsx (92 строки)** — speed-dial, см. 4.8.
- Примитивы импортируются в 23 файлах — покрытие есть, но однородность ломают страницы с 628 inline-стилями и параллельный `src/components/ui/Card.tsx` (Tailwind-вариант карточки с pastel/glass — легаси, дублирует `.rl .card`).

---

## 8. Рекомендуемый семантический слой токенов

Один файл `tokens.css`, один ключ темы (`[data-theme]`), никаких `.dark`-классов и вторых имён. Все компонентные и feature-CSS читают только этот слой.

### 8.1. Цвета (с маппингом на Telegram theme variables)

| Токен | Назначение | Telegram-переменная (приоритет) | Fallback dark | Fallback light |
|---|---|---|---|---|
| `--canvas` | фон страницы | `--tg-theme-bg-color` | `#121317` | `#F1F3F6` |
| `--surface` | основная поверхность (списки, sheet) | `--tg-theme-section-bg-color` | `#1E2025` | `#FFFFFF` |
| `--surface-secondary` | вторичная поверхность (поля, sunken) | `--tg-theme-secondary-bg-color` | `#17181C` | `#F3F5F8` |
| `--elevated` | плавающий слой (sheet, popover, nav) | — | `#26282F` | `#FFFFFF` |
| `--text-primary` | основной текст | `--tg-theme-text-color` | `#F1F3F7` | `#1D2127` |
| `--text-secondary` | вторичный текст | `--tg-theme-subtitle-text-color` | `#AEB5C0` | `#5D646F` |
| `--text-tertiary` | подписи, placeholder | `--tg-theme-hint-color` | `#787F8C` | `#8B929E` |
| `--divider` | hairline-разделители | `--tg-theme-section-separator-color` | `rgba(228,235,248,.08)` | `rgba(55,65,90,.10)` |
| `--accent` | бренд-акцент («мёд») | `--tg-theme-button-color`* | `#F0AB46` | `#B27708` |
| `--accent-foreground` | текст на акценте | `--tg-theme-button-text-color`* | `#261A02` | `#261A02` |
| `--success` | позитив | — | `#8FCB7F` | `#47823A` |
| `--warning` | предупреждение | — | `#E8B54A` | `#A97B0E` |
| `--danger` | ошибка/долг | `--tg-theme-destructive-text-color` | `#EE7A5F` | `#C2503B` |
| `--overlay` | затемнение под sheet | — | `rgba(0,0,0,.55)` | `rgba(29,33,39,.45)` |
| `--focus-ring` | focus-visible | — | `rgba(240,171,70,.5)` | `rgba(214,137,20,.55)` |

\* Если бренд-акцент важнее нативности — не маппить `--accent` на Telegram, оставить хардкод (текущее решение); маппинг указан для варианта «нативная деградация». Схема подключения: `--canvas: var(--tg-theme-bg-color, #121317);` внутри `[data-theme="dark"]` — в браузере без Telegram срабатывает fallback.

К каждому статусному цвету — один `-tint` (фон 10-14% альфы) вместо нынешних пар tint/foreground × 4 статуса × 2 системы.

### 8.2. Шкалы

| Шкала | Значения | Комментарий |
|---|---|---|
| spacing | `--space-1..8`: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 | взять готовую `--sp-*` из redesign-v2, переименовать единообразно |
| type | `--text-caption` 11 / `--text-small` 13 / `--text-body` 15 / `--text-emphasis` 16 / `--text-title` 18 / `--text-headline` 22 / `--text-display` 28; line-height 1.6 body, 1.2 заголовки; `--font-display` только для headline/display | текущая `--t-*` покрывает, нужны семантические имена |
| radius | `--radius-sm` 8 / `--radius-md` 12 / `--radius-lg` 16 / `--radius-pill` 999 | сегодняшние 26/24/20/17/12/10/9/7px схлопнуть до трёх ступеней; 26px — главный источник «AI-look» |
| control-height | `--control-sm` 36 / `--control-md` 44 / `--control-lg` 52 | уже фактические высоты `.btn`; закрепить токеном |
| icon | `--icon-sm` 16 / `--icon-md` 20 / `--icon-lg` 24 | сейчас размеры разбросаны числами по `<Icon size={…}>` |
| motion | `--duration-fast` 150ms / `--duration-base` 220ms / `--duration-slow` 300ms; `--ease-out`, `--ease-spring` | взять из redesign-v2 как есть; анимируются только transform/opacity |
| z-index | `--z-base` 0 / `--z-sticky` 10 / `--z-nav` 20 / `--z-overlay` 40 / `--z-toast` 50 | сейчас грейн сидит на `z-index: 999` (index.css:130) — выше любых модалок |

### 8.3. Тени (нейтральные, по elevation)

- `--shadow-raised`: маленькая нейтральная (списки не нуждаются в тени вовсе)
- `--shadow-floating`: для sheet/popover/nav
- Удалить: `--accent-glow`, inset-хайлайты, `--shadow-elev/-2/-3` дубли.

### 8.4. План сведения

1. Ввести `tokens.css`; в переходный период старые имена объявить алиасами (`--ink: var(--text-primary)` и т.д.).
2. Разрешить конфликты значений в пользу redesign-v2 (`--accent` light `#B27708`, `--bg-base` → `--canvas #121317`), убрать `--pri`/`--surface-2`.
3. Выпилить `.dark`-ключ (main.tsx:31, appearance.ts:38) и Tailwind (+ ui/Card.tsx) после миграции последних потребителей.
4. Feature CSS переводить по одному файлу, заменяя 137 хардкод-hex на токены; параллельно снимать анти-паттерны из раздела 4.
