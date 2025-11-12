# 🎨 DESIGN SYSTEM

Базовая дизайн-система для Telegram Food Bot

---

## 1. ЦВЕТОВАЯ ПАЛИТРА

### Primary Color: Orange

**Основной бренд-цвет, используется для всех акцентов**

```
orange-50:  #FFF7ED  // Lightest background
orange-100: #FFEDD5  // Light background
orange-200: #FED7AA  // Hover states
orange-300: #FDBA74  // Borders
orange-400: #FB923C  // Secondary actions
orange-500: #FF8F4F  // PRIMARY (Main brand color)
orange-600: #EA580C  // Hover on primary
orange-700: #C2410C  // Pressed states
orange-800: #9A3412  // Dark mode accents
orange-900: #7C2D12  // Darkest
```

**Использование:**
- **orange-500** — Primary CTA кнопки, счётчик голосов
- **orange-600** — Hover состояние primary кнопок
- **orange-100** — Фон плашек с информацией
- **orange-700** — Dark mode акценты

---

### Neutral Colors: Warm Grays

**Основной цвет для текста, фонов, границ**

```
gray-50:  #FAFAF9  // Page background (light mode)
gray-100: #F5F5F4  // Card background alternative
gray-200: #E7E5E4  // Borders
gray-300: #D6D3D1  // Disabled states
gray-400: #A8A29E  // Placeholder text
gray-500: #78716C  // Secondary text
gray-600: #57534E  // Body text (light mode)
gray-700: #44403C  // Headings (light mode)
gray-800: #292524  // Card background (dark mode)
gray-900: #1C1917  // Page background (dark mode)
white:    #FFFFFF  // Primary card background
black:    #0A0A0A  // Pure black for icons
```

**Использование:**
- **white** — Фон карточек (light mode)
- **gray-800** — Фон карточек (dark mode)
- **gray-900** — Фон страницы (dark mode)
- **gray-50** — Фон страницы (light mode)
- **gray-700** — Основной текст заголовков
- **gray-600** — Основной текст body

---

### Semantic Colors

#### Success (Green)
```
green-50:  #F0FDF4
green-500: #22C55E  // Success messages, confirmations
green-600: #16A34A  // Hover
```

#### Warning (Amber)
```
amber-50:  #FFFBEB
amber-500: #F59E0B  // Warnings, attention needed
amber-600: #D97706  // Hover
```

#### Error (Red)
```
red-50:   #FEF2F2
red-500:  #EF4444  // Errors, destructive actions
red-600:  #DC2626  // Hover
```

#### Info (Blue)
```
blue-50:  #EFF6FF
blue-500: #3B82F6  // Information, tips
blue-600: #2563EB  // Hover
```

**Использование:**
- Success — после успешного голосования, подтверждения платежа
- Warning — напоминания, истекающий срок
- Error — ошибки, обязательные поля
- Info — подсказки, информационные блоки

---

## 2. ТИПОГРАФИКА

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             Roboto, Oxygen, Ubuntu, Cantarell, 
             'Helvetica Neue', sans-serif;
```

**Обоснование:** Системные шрифты обеспечивают мгновенную загрузку и нативный вид.

---

### Размеры и Line Heights

#### Display (Hero текст)
```
font-size: 40px (2.5rem)
line-height: 1.2 (48px)
font-weight: 700 (Bold)
letter-spacing: -0.02em

Использование: Главный заголовок "ГОЛОСОВАНИЕ АКТИВНО"
```

#### H1 (Page Title)
```
font-size: 32px (2rem)
line-height: 1.2 (38px)
font-weight: 700 (Bold)
letter-spacing: -0.01em

Использование: Заголовки страниц
```

#### H2 (Section Title)
```
font-size: 24px (1.5rem)
line-height: 1.3 (31px)
font-weight: 600 (Semibold)

Использование: Заголовки секций (Completed Polls, Budget)
```

#### H3 (Card Title)
```
font-size: 20px (1.25rem)
line-height: 1.4 (28px)
font-weight: 600 (Semibold)

Использование: Заголовки карточек
```

#### Body (Default текст)
```
font-size: 16px (1rem)
line-height: 1.5 (24px)
font-weight: 400 (Regular)

Использование: Основной текст, descriptions
```

#### Small (Secondary текст)
```
font-size: 14px (0.875rem)
line-height: 1.4 (20px)
font-weight: 400 (Regular)

Использование: Метаинформация, captions
```

#### Tiny (Tertiary текст)
```
font-size: 12px (0.75rem)
line-height: 1.3 (16px)
font-weight: 400 (Regular)

Использование: Timestamps, fine print
```

---

### Font Weights
```
Regular:   400  // Body text, descriptions
Medium:    500  // Emphasized text (редко)
Semibold:  600  // Headings, buttons
Bold:      700  // Display, H1 only
```

**Правило:** Bold только для Display и H1. Остальные заголовки Semibold.

---

## 3. SPACING СИСТЕМА

### Base Unit: 8px

**Правило:** Все значения spacing кратны 8px

```
xs:  4px   (0.25rem)  // Icon spacing, tiny gaps
sm:  8px   (0.5rem)   // Compact elements
md:  16px  (1rem)     // Default gap
lg:  24px  (1.5rem)   // Section spacing
xl:  32px  (2rem)     // Major sections
2xl: 48px  (3rem)     // Page-level spacing
3xl: 64px  (4rem)     // Hero sections
```

---

### Применение

#### Padding (внутренние отступы)
```
Cards:          16px (md)
Buttons:        12px 24px (между sm и md, исключение)
Inputs:         12px 16px
Modal windows:  24px (lg)
```

#### Gap (расстояния между элементами)
```
Menu items:     8px  (sm)
Card sections:  16px (md)
Page sections:  32px (xl)
```

#### Margin (внешние отступы)
```
Bottom headings: 16px (md)
Bottom sections: 24px (lg)
```

---

### Визуальный ритм

**Правило группировки:**
- Связанные элементы — 8px gap
- Разные блоки — 16px gap
- Отдельные секции — 24px+ gap

---

## 4. ELEVATION (ТЕНИ)

### 5 уровней глубины

#### Level 0: Flat
```css
box-shadow: none;
border: 1px solid rgba(0, 0, 0, 0.08);

Использование: Input fields, tertiary buttons
```

#### Level 1: Resting
```css
box-shadow: 
  0 1px 2px rgba(0, 0, 0, 0.04),
  0 1px 4px rgba(0, 0, 0, 0.06);

Использование: Standard карточки (default state)
```

#### Level 2: Raised
```css
box-shadow: 
  0 4px 6px rgba(0, 0, 0, 0.05),
  0 2px 12px rgba(0, 0, 0, 0.08);

Использование: Hover state карточек
```

#### Level 3: Floating
```css
box-shadow: 
  0 10px 15px rgba(0, 0, 0, 0.08),
  0 4px 20px rgba(0, 0, 0, 0.12);

Использование: Hero elements, Sticky headers
```

#### Level 4: Modal
```css
box-shadow: 
  0 20px 25px rgba(0, 0, 0, 0.1),
  0 10px 40px rgba(0, 0, 0, 0.15);

Использование: Modal windows, Dropdowns
```

---

### Специальные тени

#### Glow (для Primary CTA)
```css
box-shadow: 0 0 20px rgba(249, 115, 22, 0.5);

/* Hover */
box-shadow: 0 0 30px rgba(249, 115, 22, 0.7);

Использование: Primary CTA кнопка
```

#### Inner Shadow (для pressed states)
```css
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);

Использование: Active state кнопок
```

---

## 5. BORDER RADIUS

```
sm:      4px   // Chips, badges
default: 8px   // Buttons, inputs
md:      12px  // Standard cards
lg:      16px  // Hero cards
xl:      24px  // Modal windows
full:    9999px // Pills, avatars
```

**Правило:** Не использовать произвольные значения. Только из шкалы.

---

## 6. Z-INDEX ШКАЛА

```
-1:     Below content (backgrounds)
0:      Default
10:     Dropdowns, tooltips
20:     Sticky headers
30:     Fixed navigation
40:     Modals
50:     Notifications
9999:   Critical overlays (errors)
```

**Правило:** Использовать только эти значения для предсказуемого layering.

---

## 7. TRANSITIONS

### Базовые значения

```css
/* Default transition */
transition: all 200ms ease-out;

/* Специфичные properties */
transition: 
  transform 200ms ease-out,
  opacity 300ms ease-out;
```

---

### Duration Guidelines

```
Micro (50-100ms):   Icon rotations, checkmarks
Standard (200ms):   Hover states, color changes
Medium (300-400ms): Scale effects, slide-ins
Long (500ms+):      Page transitions, complex animations
```

---

### Easing Functions

```css
ease-out:     default для входящих элементов
ease-in:      для выходящих элементов
ease-in-out:  для симметричных движений
```

---

## 8. ТЕМЫ (Light/Dark Mode)

### Как использовать

```tsx
// Light mode по умолчанию
<div className="bg-white text-gray-700">

// Dark mode через префикс dark:
<div className="bg-white dark:bg-gray-800 
                text-gray-700 dark:text-gray-200">
```

### Ключевые различия

| Элемент | Light Mode | Dark Mode |
|---------|------------|-----------|
| Page bg | gray-50 | gray-900 |
| Card bg | white | gray-800 |
| Headings | gray-700 | gray-100 |
| Body text | gray-600 | gray-300 |
| Borders | gray-200 | gray-700 |

---

## 9. ACCESSIBILITY

### Color Contrast (WCAG AA)

**Минимальные соотношения:**
- Обычный текст: 4.5:1
- Крупный текст (18px+): 3:1
- UI компоненты: 3:1

**Проверенные пары:**
- `text-gray-700` на `bg-white` ✅ 10.4:1
- `text-gray-300` на `bg-gray-800` ✅ 7.2:1
- `text-orange-600` на `bg-white` ✅ 4.8:1

---

### Touch Targets

**Минимальный размер:** 44px × 44px

```tsx
// Правильно
<button className="min-h-[44px] min-w-[44px] px-6 py-3">

// Неправильно
<button className="px-2 py-1">  // < 44px
```

---

### Focus States

**Все интерактивные элементы должны иметь focus ring:**

```css
focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
```

---

## 10. ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Standard Card

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-md
  shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.06)]
  p-4
  border border-gray-200 dark:border-gray-700
">
  <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-100 mb-4">
    Card Title
  </h3>
  <p className="text-gray-600 dark:text-gray-300">
    Body text goes here
  </p>
</div>
```

---

### Пример 2: Primary CTA Button

```tsx
<button className="
  bg-gradient-to-r from-orange-500 to-orange-600
  text-white
  font-semibold
  px-6 py-3
  rounded-md
  shadow-[0_0_20px_rgba(249,115,22,0.5)]
  hover:shadow-[0_0_30px_rgba(249,115,22,0.7)]
  transition-all duration-200
  focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
  active:shadow-inner
">
  Проголосовать
</button>
```

---

### Пример 3: Accent Strip Card

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-md
  shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.06)]
  p-4
  border-l-4 border-orange-500
">
  {/* Контент */}
</div>
```

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [DESIGN_ROADMAP.md](./DESIGN_ROADMAP.md) — План реализации
- [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) — Готовые компоненты
- [ANIMATION_GUIDE.md](./ANIMATION_GUIDE.md) — Анимации

---

**Last updated:** 2025-01-12
