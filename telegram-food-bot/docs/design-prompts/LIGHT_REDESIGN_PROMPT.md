# Лёгкий редизайн — Rocket Lunch

## Что это

**Rocket Lunch** — Telegram Mini App для голосования команды за обед. React + TypeScript + Vite + Tailwind + собственные CSS-переменные. Работает только в Telegram на мобильном (viewport до 430px).

**Прикладываю:** кодовая база `design-upload/` — стили, все страницы и визуально значимые компоненты. Бизнес-логика и сервисы намеренно не включены.

---

## Задача — лёгкий редизайн визуала

Не редизайн архитектуры, не новые экраны. **Только визуальный слой.** Нужно обновить:

1. **Цветовую палитру** light и dark темы — полная свобода. Можно сохранить warm-beige/peach характер, а можно предложить совершенно другое настроение (например, графит + мята + персик, или нежный лавандовый + кремовый). Главное — обоснование.

2. **Систему кнопок** — размеры, padding, радиусы, тени, tap-таргеты. Сейчас много inconsistency: где-то `h-12`, где-то `py-2`, где-то `rounded-xl`, где-то `rounded-full`. Нужна унифицированная шкала.

3. **Типографику** — шрифты (можно заменить Inter + JetBrains Mono на что-то более выразительное), scale размеров (hero / h1 / h2 / body / meta / caption), line-height, letter-spacing.

4. **Тени и border'ы карточек** — сейчас шум из смешанных подходов (местами inline `shadow-xl`, местами `border border-border`, местами ничего).

5. **Расположение кнопок** — BottomNavigation, FAB, primary CTA на каждой странице. Унифицировать z-index, отступы от safe-area, иерархию (какая кнопка primary, какая secondary).

---

## Что НЕ трогать (жёсткое ограничение)

❌ **Любая бизнес-логика** — контракты API, типы данных, props-интерфейсы компонентов, state-менеджмент, сервисы. В кодовой базе их нет, но Claude может предложить — это недопустимо.

❌ **Структура компонентов** — если есть `<Button variant="primary" size="lg">`, нельзя менять сигнатуру на `<Button kind="cta" priority="high">`. Меняется только то, что внутри — размеры, цвета, стили.

❌ **Новые экраны, новые фичи, новый flow** — скоуп только визуальный.

❌ **Замена Tailwind на другой UI-kit** — не предлагать shadcn, chakra, MUI, Radix.

❌ **Framer-motion оркестры** — текущие анимации оставить. Можно предложить микро-анимации (hover/tap/focus ring), но не сложные.

---

## Что ждать в ответе

Один документ (можно HTML-виджетом с фильтрами, как у Rocket Lunch UI Audit), разделённый на 5 блоков:

### Блок 1 — Палитра

- **Mood statement** (1-2 предложения): какое настроение передаёт новая палитра, почему.
- **Таблица токенов light/dark** — текущее vs предлагаемое. Все HSL/hex + wcag-контраст.
- **Применение** — где какой токен используется (background, surface, card, primary, accent, muted, destructive, success, warning). Какие токены добавить/удалить/переименовать.
- **Миграция CSS** — diff для `src/styles/globals.css` и при необходимости `tailwind.config.js`.

### Блок 2 — Типографика

- **Шрифты** — предлагаемые семейства (с обоснованием), fallback-стеки.
- **Scale** — таблица:
  | Token | Current | New | Use case |
  | --- | --- | --- | --- |
  | `text-hero` | — | 28px bold 1.1 | Greeting, page title |
- **Diff** для `src/styles/globals.css` + любых типографических helpers.
- Если предлагаете подключить Google Fonts — укажите `<link>` или импорт.

### Блок 3 — Кнопки

- **Шкала размеров** — таблица Button sm/md/lg + FAB + icon-only. Padding, min-height, font-size, radius.
- **Варианты** — primary / secondary / ghost / destructive. Fill/stroke/elevation.
- **Tap-targets** — гарантия ≥44×44 для всех интерактивных элементов.
- **Diff** для `src/components/ui/button.tsx`, `FloatingActionButton.tsx`, `.admin-action-btn` в `globals.css`.

### Блок 4 — Тени и border'ы

- **Система теней** — 3-4 уровня (flat, rest, raised, floating). Current vs new.
- **Система border'ов** — толщина, radius-scale, когда использовать border vs shadow.
- **Применение к карточкам** — `PastelCard`, `GlassCard`, `Card` (ui/card.tsx) — унификация.
- **Diff** по каждому файлу карточек.

### Блок 5 — Расположение кнопок

- **BottomNavigation** — высота, padding, safe-area, активное состояние (underline/background/dot/icon-scale?).
- **FAB** — когда показывать, где позиционировать, размер, shadow.
- **Primary CTA на страницах** — как решить, какая кнопка главная на экране (Home, Menu, Profile, etc.).
- **Diff** для `BottomNavigation.tsx`, `FloatingActionButton.tsx`, `Layout.tsx`.

---

## Формат каждого diff

```tsx
// path/to/file.tsx:line
- старая строка
+ новая строка
```

или

```css
/* path/to/file.css */
- --token-name: hsl(old);
+ --token-name: hsl(new); /* reason, wcag ratio */
```

---

## Текущее состояние (для ориентира)

- Палитра: warm beige + peach (#D86A2C primary) + lavender accent. Уже добавлен `--primary-text: 21 72% 38%` (#9A4410 для WCAG AA на светлом).
- Шрифты: Inter (UI) + JetBrains Mono (числа), `font-variant-numeric: tabular-nums` на body.
- Кнопки: mix Tailwind/shadcn-стиля + кастомный `.admin-action-btn` + FAB `size-16 rounded-full bg-lavender-500`.
- Карточки: `PastelCard`, `GlassCard`, `Card` — три разные истории, никогда не объединялись.
- BottomNav: `h-16` fixed внизу, безопасная зона через `env(safe-area-inset-bottom)`.

---

## Главный вопрос

**Предложите связную визуальную систему (палитра + типографика + кнопки + тени + расположение), которая:**

1. **Смотрится современно** и выделяется на фоне типичных Telegram Mini App.
2. **Согласована** — все 5 блоков выглядят как часть одного дизайна, а не как пять разных идей.
3. **Применима точечно** — предложите миграцию как diff'ы, чтобы я мог применять поэтапно и получать работающий UI на каждом шаге.
4. **Не требует рефакторинга бизнес-логики** — не меняет props-интерфейсы и не вынуждает переделывать страницы.

Если считаете, что текущая warm-beige палитра — лучший выбор и надо только отполировать её, **скажите прямо** с обоснованием, не предлагайте изменение ради изменения.
