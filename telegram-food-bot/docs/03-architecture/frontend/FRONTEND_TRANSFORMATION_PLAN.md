# 🎨 ПЛАН ТРАНСФОРМАЦИИ ФРОНТЕНДА TELEGRAM FOOD BOT
## От Crypto Premium к Food Premium Experience

---

## 📋 EXECUTIVE SUMMARY

**Цель трансформации:** Адаптировать премиальный криптовалютный дизайн под food bot с сохранением визуальной привлекательности, добавлением food-специфичных метафор и улучшением UX через glassmorphism и адаптивные цветовые схемы.

**Ключевые изменения:**
1. ❄️ Холодный зелёный градиент → 🍑 Тёплая food-палитра
2. 💰 Финансовые метрики → 🍽️ Пищевые индикаторы
3. 📊 Токены и балансы → 🥗 Блюда и бюджеты
4. 🔘 4 крипто-действия → 🍴 4 food-действия
5. 🌈 Адаптивные градиенты по времени суток (завтрак/обед/ужин)

**Используемые MCP инструменты:**
- 🎨 Shadcn - для UI компонентов
- 🎯 Lucide Icons - для food-themed иконок
- ♿ A11y - для accessibility проверок
- 🎨 Color Contrast - для валидации цветов
- ⚡ Lighthouse - для performance мониторинга
- 🎭 Playwright - для visual regression testing
- 📚 Ref - для поиска best practices

---

## 📊 ТЕКУЩИЙ СТАТУС ТРАНСФОРМАЦИИ
**Последнее обновление:** Январь 2025

### Прогресс по фазам:

```
PHASE 1: Анализ и подготовка        ▰▰▰▰▰▰▰▱▱▱  70% ⏳ (baseline пропущен)
PHASE 2: Компонентная трансформация ▰▰▰▰▰▰▰▰▰▰ 100% ✅
PHASE 3: Анимации и взаимодействия  ▰▰▰▰▰▰▰▰▰▰ 100% ✅
PHASE 4: Адаптивность и темы        ▰▰▰▰▰▰▰▰▰▰ 100% ✅
PHASE 5: Тестирование и валидация   ▱▱▱▱▱▱▱▱▱▱   0% ❌
PHASE 6: Документация и Deployment  ▰▰▰▱▱▱▱▱▱▱  30% ⏳

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ОБЩИЙ ПРОГРЕСС:                     ▰▰▰▰▰▰▰▰▱▱  75%
```

### 🎉 Трансформированные страницы (7/7):

1. ✅ **HomePage** - Hero + Quick Stats + Time Greeting + DonationButton
2. ✅ **MenuPage** - Hero + CategoryFilter + MenuItemCard (premium)
3. ✅ **StatsPage** - Hero + Quick Stats + Popular Items + Animated Lists
4. ✅ **PollManagementPage** - Hero + Form + FAB
5. ✅ **ProfilePage** - Hero + User Info + Payment + FAB + Onboarding
6. ✅ **VotingPage** - Hero + Stats + Voting + FAB
7. ✅ **Navigation** - Glassmorphism bottom bar with Lucide icons

### 🎁 Дополнительные фичи (Bonus):

- ✅ **Welcome Onboarding Flow** - 5 slides с horizontal scroll + tracking
- ✅ **Donation System** - Золотая кнопка + modal (Stars/СБП/Crypto)
- ✅ **useOnboarding Hook** - Глобальное состояние с подписками
- ✅ **Time-based Gradients** - 4 адаптивных градиента (утро/день/вечер/ночь)

### 📦 Созданные компоненты:

**Core Components:**
- ✅ `GlassHeroCard` - Hero cards с glassmorphism
- ✅ `useTimeBasedGradient` - Hook для adaptive gradients
- ✅ `glassmorphism.ts` - Utility library (4 variants)

**Onboarding:**
- ✅ `WelcomeModal` - Main modal с 5 slides
- ✅ `OnboardingSlide` - Отдельный slide компонент
- ✅ `SlideIndicator` - Dots progress indicator
- ✅ `useOnboarding` - Global state management

**Donation:**
- ✅ `DonationButton` - Золотая анимированная кнопка
- ✅ `DonationModal` - Modal с выбором метода оплаты
- ✅ `PaymentMethodCard` - Карточки методов
- ✅ `AmountSelector` - Выбор суммы (preset + custom)
- ✅ `PaymentSuccess` - Success screen с confetti

**Redesigned Components:**
- ✅ `MenuItemCard` - Premium food card design
- ✅ `CategoryFilter` - Glass-styled filter chips
- ✅ `PollCard` - Premium poll card с Lucide icons
- ✅ `Navigation` - Glass bottom navigation

### 📚 Документация (частично):

- ✅ `ONBOARDING_COMPLETE.md` - Onboarding feature docs
- ✅ `DONATION_FEATURE.md` - Donation system docs
- ⏳ `COLOR_PALETTE.md` - Pending
- ⏳ `MIGRATION_GUIDE.md` - Pending

---

## ✅ COMPLETED TASKS

### Phase 1: Анализ и подготовка (70%)
- ✅ **1.2.1** Food Color Palette разработана
- ✅ **1.2.1.2** Time-Based Adaptive Gradients реализованы
- ✅ **1.2.1.3** Semantic Food Colors определены
- ✅ **1.2.2** Glassmorphism Design System создан
- ✅ **1.2.3** Typography адаптирована
- ✅ **1.3.1** Food Icons через Lucide MCP (30+ иконок)
- ✅ **1.3.2** Эмодзи для категорий определены
- ❌ **1.1.1** Lighthouse Baseline (пропущен - слишком поздно)
- ❌ **1.1.2** A11y Baseline (пропущен)
- ❌ **1.1.3** Component Inventory (не критично)

### Phase 2: Компонентная трансформация (100%)
- ✅ **2.1.1** GlassHeroCard redesign
- ✅ **2.1.2** Adaptive Time-Based Gradient
- ✅ **2.2.1** Action Buttons redesign (позже упрощены)
- ✅ **2.2.2** Responsive Layout для кнопок
- ✅ **2.3.1** Glassmorphism Search Bar
- ✅ **2.3.2** Category Filter Chips
- ✅ **2.4.1** MenuItemCard redesign
- ✅ **2.4.2** Status Badges с Food Context
- ✅ **2.5.1** Glassmorphism Bottom Navigation
- ✅ **2.6.1** Glassmorphism Modals

### Phase 3: Анимации (100%)
- ✅ **3.1.1** Page Transitions (Framer Motion)
- ✅ **3.1.2** List Animations (staggered everywhere)
- ✅ **3.1.3** Hover Animations на всех элементах
- ✅ **3.2.1** Haptic Feedback готов
- ✅ **3.3.1** Glassmorphism Skeletons

### Phase 4: Адаптивность (100%)
- ✅ **4.1.1** Breakpoint-specific Layouts
- ✅ **4.2.1** Glassmorphism в Dark Theme
- ✅ **4.2.2** Time-Based Gradients в обеих темах

### Phase 5: Тестирование (0%)
- ❌ Все задачи не выполнены (см. Pending Tasks)

### Phase 6: Документация (30%)
- ✅ Частичная документация фич
- ❌ Storybook не обновлен
- ❌ Migration Guide не создан
- ❌ Performance Budgets не настроены

---

## ⏳ PENDING TASKS (Приоритизировано)

### 🔴 HIGH PRIORITY - Критично для Production

#### 1. A11y Audit после изменений
**Задача:** 5.1.1  
**MCP Tool:** A11y  
**Описание:** Запустить accessibility audit на всех трансформированных страницах
**Действия:**
- Audit всех 7 страниц через A11y MCP
- Исправить critical/serious issues
- Keyboard navigation check
- Screen reader compatibility

**Почему критично:** Accessibility - не опционально, требуется для соответствия стандартам

---

#### 2. Color Contrast Validation
**Задача:** 5.1.2  
**MCP Tool:** Color Contrast  
**Описание:** Валидация WCAG AA compliance для всех цветовых пар
**Действия:**
- Проверить primary-food палитру (50-900 оттенков)
- Time-based градиенты + текст
- Glassmorphism text на blur backgrounds
- Status badges контрастность
- Обе темы (light/dark)

**Почему критично:** WCAG compliance обязателен, могут быть нечитаемые элементы

---

#### 3. Lighthouse Performance Audit
**Задача:** 5.2.1  
**MCP Tool:** Lighthouse  
**Описание:** Performance audit после всех изменений
**Действия:**
- Audit всех 7 страниц
- Проверить Core Web Vitals (FCP, LCP, CLS, TBT)
- Performance Score ≥ 85
- Сравнить с target metrics

**Почему критично:** Glassmorphism + animations могут замедлить производительность

---

#### 4. COLOR_PALETTE.md документация
**Задача:** 6.1.2  
**Описание:** Полная документация цветовой системы
**Содержание:**
- Primary food colors (50-900) с hex кодами
- Semantic food colors
- Time-based gradients спецификация
- Glassmorphism parameters
- WCAG contrast ratios таблица
- Usage guidelines и примеры
- Don'ts и anti-patterns

**Почему критично:** Команде нужны guidelines для consistency

---

### 🟡 MEDIUM PRIORITY - Важно для Quality

#### 5. Bundle Size Analysis
**Задача:** 5.2.2  
**Описание:** Проверка размера bundle после добавления фич
**Target:** Main < 400KB, Total < 800KB (gzip)
**Действия:**
- `npm run build` анализ
- Проверить размер chunks
- Оптимизация если нужно

---

#### 6. Playwright Visual Regression
**Задача:** 5.3.1  
**MCP Tool:** Playwright  
**Описание:** Screenshots для visual regression testing
**Действия:**
- Screenshots всех страниц (mobile/tablet/desktop)
- Обе темы
- Создать baseline для будущих сравнений

---

#### 7. MIGRATION_GUIDE.md
**Задача:** 6.2.1  
**Описание:** Инструкция для команды по использованию новых компонентов
**Разделы:**
- Цветовая миграция (crypto colors → food colors)
- Компонентная миграция (Button → GlassButton)
- Иконки маппинг (crypto → food)
- Анимации integration
- Code examples

---

#### 8. Storybook обновление
**Задача:** 6.1.1  
**Описание:** Документация компонентов в Storybook
**Компоненты для stories:**
- GlassHeroCard
- TimeBasedGradient
- DonationButton/Modal
- WelcomeModal
- Redesigned components

---

### 🟢 LOW PRIORITY - Nice to Have

#### 9. Performance Budgets Setup
**Задача:** 6.3.1  
**Описание:** Lighthouse CI configuration для automated monitoring

#### 10. Deployment Strategy
**Задача:** 6.4.1  
**Описание:** Staged rollout plan (canary → gradual)

#### 11. Usability Testing
**Задача:** 5.4.1  
**Описание:** Тестирование с реальными пользователями

---

## 🔌 BACKEND INTEGRATION TASKS
*(Не в оригинальном плане, но необходимо)*

### Donation System Backend:

**Database Schema:**
```prisma
model Donation {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  amount      Float
  currency    String   // XTR, RUB, BTC, USDT, TON
  method      String   // stars, sbp, crypto
  status      String   // pending, completed, failed
  paymentId   String?
  txHash      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model User {
  // ... existing fields
  isDonor              Boolean    @default(false)
  onboardingCompleted  Boolean    @default(false)
  donations            Donation[]
}
```

**API Endpoints:** (TODO)
- [ ] `POST /api/donations/create` - Create invoice
- [ ] `POST /webhook/telegram` - Telegram Stars webhook
- [ ] `POST /webhook/yookassa` - ЮКасса webhook
- [ ] `POST /webhook/cryptobot` - CryptoBot webhook
- [ ] `GET /api/donations/stats` - Statistics

**Payment Integrations:** (TODO)
- [ ] Telegram Stars - Bot API integration
- [ ] ЮКасса - Register + get API keys
- [ ] Тинькофф Acquiring - Alternative for СБП
- [ ] CryptoBot - Register app + get token

**Environment Variables:** (TODO)
```env
TELEGRAM_BOT_TOKEN=
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
CRYPTOBOT_TOKEN=
WEBHOOK_SECRET=
```

### Onboarding Backend:

**Database:** (TODO)
- [ ] Add `User.onboardingCompleted` field
- [ ] Migration: `npx prisma migrate dev --name add_onboarding`

**API:** (TODO)
- [ ] `PATCH /api/users/onboarding` - Update status

---

## 🚀 QUICK START FOR DEVELOPERS

### Использование новых компонентов:

#### GlassHeroCard с Time-Based Gradient
```tsx
import { GlassHeroCard } from '@/components/glass';
import { useTimeBasedGradient } from '@/hooks/useTimeBasedGradient';
import { ShoppingCart } from 'lucide-react';

const MyPage = () => {
  const { gradient, textColor, label } = useTimeBasedGradient();
  const { from, to } = gradient;
  
  return (
    <GlassHeroCard
      gradient={{ from, to }}
      value="₽1,450"
      label={`Текущий заказ · ${label}`}
      sublabel="3 блюда · Средний чек ₽483"
      textColor={textColor}
      icon={<ShoppingCart size={24} />}
    />
  );
};
```

#### Time-Based Gradient Hook
```tsx
// Автоматически меняется по времени суток:
// Утро (6-11): Персиковый
// День (11-16): Зелёный
// Вечер (16-22): Синий
// Ночь (22-6): Лавандовый

const { gradient, textColor, timeOfDay, label } = useTimeBasedGradient();
// gradient: { from: string, to: string }
// textColor: string (white or dark)
// timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
// label: string (locale time description)
```

#### Glassmorphism Utility
```tsx
import { glass } from '@/lib/glassmorphism';

// 4 варианта intensity:
const lightGlass = glass.light();    // Subtle blur
const mediumGlass = glass.medium();  // Standard (recommended)
const heavyGlass = glass.heavy();    // Strong blur
const ultraGlass = glass.ultra();    // Maximum blur

// Специализированные:
const navGlass = glass.navigation();   // Bottom nav bar
const modalGlass = glass.modal();      // Modal overlays
const heroGlass = glass.hero();        // Hero cards

// Применение:
<div className={glass.medium()}>
  Content with glassmorphism
</div>
```

### Цветовая палитра (Primary Food):

```tsx
// Tailwind classes:
bg-primary-food-50   // Lightest cream
bg-primary-food-100  // Light peach
bg-primary-food-200  // Soft peach
bg-primary-food-300  // Warm peach
bg-primary-food-400  // Vibrant orange
bg-primary-food-500  // Primary orange [MAIN] ← Основной
bg-primary-food-600  // Deep orange
bg-primary-food-700  // Rich orange (WCAG AA ✅)
bg-primary-food-800  // Dark orange (WCAG AA ✅)
bg-primary-food-900  // Darkest orange

// Text colors:
text-primary-food-500   // Для light theme
text-primary-food-400   // Для dark theme

// Borders:
border-primary-food-500
```

### Lucide Food Icons (выбранные):

```tsx
import { 
  UtensilsCrossed,  // Меню
  ShoppingCart,     // Заказ
  ClipboardList,    // История
  Vote,             // Голосование
  Heart,            // Donation
  Sparkles,         // New/Special
  TrendingUp,       // Popular
  CheckCircle,      // Available
  XCircle,          // Unavailable
  Leaf,             // Vegetarian
  Flame,            // Spicy
  Users,            // Participants
  Clock,            // Time
  Calendar,         // Date
  BarChart3,        // Stats
  Trophy,           // Winner
  Pizza,            // Category (если есть)
} from 'lucide-react';

// Размеры:
<Icon size={16} /> // Small (badges, labels)
<Icon size={20} /> // Medium (buttons)
<Icon size={24} /> // Large (hero, main actions)
<Icon size={48} /> // XL (empty states, headers)
```

### Framer Motion Animations (паттерны):

```tsx
// Fade + Scale (cards, modals)
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3 }}
>

// Staggered List (menu items, results)
<motion.div
  variants={{
    animate: { transition: { staggerChildren: 0.05 } }
  }}
  initial="initial"
  animate="animate"
>
  {items.map((item, i) => (
    <motion.div
      key={item.id}
      variants={{
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 }
      }}
      transition={{ delay: 0.1 + i * 0.05 }}
    >
      {item.content}
    </motion.div>
  ))}
</motion.div>

// Hover/Tap (buttons, cards)
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
```

### Donation Button Integration:

```tsx
import { DonationButton } from '@/components/donation';

// Просто добавить на страницу:
<DonationButton />

// Автоматически показывает:
// - Золотую анимированную кнопку
// - Modal при клике (3 метода оплаты)
// - Success screen с confetti
```

### Welcome Onboarding:

```tsx
import { useOnboarding } from '@/hooks/useOnboarding';

const App = () => {
  const { isModalOpen, completeOnboarding, showOnboarding } = useOnboarding();
  
  // Автоматически показывается при первом запуске
  // Для принудительного показа:
  // <button onClick={showOnboarding}>Показать инструкцию</button>
  
  return (
    <>
      <YourContent />
      <WelcomeModal isOpen={isModalOpen} onClose={completeOnboarding} />
    </>
  );
};

// Debug: сбросить onboarding
// window.resetOnboarding() в консоли (только dev mode)
```

---

## ✅ TESTING CHECKLIST

### Перед каждым commit:
- [ ] `npm run type-check` - No TypeScript errors
- [ ] `npm run lint` - No lint errors
- [ ] Manual visual check в браузере

### Перед deployment в production:

**Performance:**
- [ ] Lighthouse audit всех страниц (Performance ≥ 85)
- [ ] Bundle size < 800KB (gzip)
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] CLS < 0.1

**Accessibility:**
- [ ] A11y audit через MCP (0 critical issues)
- [ ] Color Contrast validation (WCAG AA)
- [ ] Keyboard navigation работает
- [ ] Screen reader test (если возможно)

**Visual:**
- [ ] Обе темы (light/dark) выглядят корректно
- [ ] Mobile (< 640px) - layout OK
- [ ] Tablet (640-1024px) - layout OK
- [ ] Desktop (> 1024px) - layout OK
- [ ] Glassmorphism эффекты работают
- [ ] Time-based градиенты меняются

**Functional:**
- [ ] Все страницы открываются без ошибок
- [ ] Navigation работает
- [ ] Modals открываются/закрываются
- [ ] Forms submit работает
- [ ] Animations плавные (60fps)
- [ ] No console errors
- [ ] Haptic feedback работает (в Telegram)

**Features:**
- [ ] Onboarding показывается при первом запуске
- [ ] Donation button + modal работает
- [ ] Time-based градиент меняется в течение дня
- [ ] Category filters работают
- [ ] Search функционирует
- [ ] Poll voting работает

---

## 🎯 PHASE 1: АНАЛИЗ И ПОДГОТОВКА

### 1.1 Аудит текущего состояния

#### Задача 1.1.1: Lighthouse Performance Baseline
**Цель:** Установить baseline метрики для сравнения после изменений

**MCP Инструмент:** Lighthouse

**Действия:**
1. Запустить Lighthouse audit на всех основных страницах:
   - MenuPage (/)
   - VotingPage (/vote/:id)
   - StatsPage (/stats)
   - ProfilePage (/profile)
   
2. Зафиксировать текущие метрики:
   - Performance Score
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Total Blocking Time (TBT)
   - Cumulative Layout Shift (CLS)

3. Сохранить отчёты в папку `/frontend/lighthouse-reports/baseline/`

**Ожидаемый результат:** Baseline метрики для отслеживания регрессий

---

#### Задача 1.1.2: Accessibility Audit
**Цель:** Выявить существующие проблемы доступности перед изменениями

**MCP Инструмент:** A11y

**Действия:**
1. Запустить A11y audit на каждой странице
2. Категоризировать issues по severity:
   - Critical (блокирующие)
   - Serious (важные)
   - Moderate (средние)
   - Minor (незначительные)

3. Создать список приоритетных исправлений
4. Проверить контрастность текущих цветов через Color Contrast MCP

**Ожидаемый результат:** Список accessibility issues + baseline контрастности

---

#### Задача 1.1.3: Component Inventory
**Цель:** Полная инвентаризация существующих компонентов

**Действия:**
1. Список всех UI компонентов в `/src/components/`
2. Определение компонентов, требующих redesign:
   - ❌ Кнопки с крипто-стилем → ✅ Food-styled buttons
   - ❌ Холодные цвета → ✅ Тёплые food colors
   - ❌ Финансовые иконки → ✅ Food иконки

3. Маппинг компонентов на Shadcn аналоги

**Ожидаемый результат:** Таблица соответствия компонентов

---

### 1.2 Дизайн-система и цветовая палитра

#### Задача 1.2.1: Разработка Food Color Palette
**Цель:** Создать тёплую, аппетитную цветовую схему с учётом accessibility

**MCP Инструмент:** Color Contrast

**Подзадачи:**

**1.2.1.1 Primary Food Palette (Основная палитра)**
- Базовый цвет: Оранжево-персиковый для food-индустрии
- 10 оттенков (50-900)
- Проверка каждого оттенка на WCAG AA/AAA

**Предложенная палитра:**
```
primary-food: {
  50:  '#FFF7ED'  // Lightest cream
  100: '#FFEDD5'  // Light peach
  200: '#FED7AA'  // Soft peach
  300: '#FDBA74'  // Warm peach
  400: '#FB923C'  // Vibrant orange
  500: '#F97316'  // Primary orange [MAIN]
  600: '#EA580C'  // Deep orange
  700: '#C2410C'  // Rich orange
  800: '#9A3412'  // Dark orange
  900: '#7C2D12'  // Darkest orange
}
```

**Действия через Color Contrast MCP:**
1. Проверить каждую пару text + background
2. Валидировать для обеих тем (light/dark)
3. Оптимизировать недостаточные контрасты

**Ожидаемый результат:** WCAG AA compliant палитра

---

**1.2.1.2 Time-Based Adaptive Gradients**
**Цель:** Динамические градиенты в зависимости от времени суток

**Утренний градиент (6:00-11:00) - Завтрак:**
```
from: '#FFEDD5' (персиковый)
to:   '#FED7AA' (мягкий персик)
Ассоциации: свежесть, начало дня, кофе, круассаны
```

**Обеденный градиент (11:00-16:00) - Обед:**
```
from: '#86EFAC' (свежий зелёный)
to:   '#4ADE80' (яркий зелёный)
Ассоциации: салаты, свежие овощи, энергия
```

**Вечерний градиент (16:00-22:00) - Ужин:**
```
from: '#BFDBFE' (спокойный синий)
to:   '#93C5FD' (мягкий синий)
Ассоциации: расслабление, спокойствие, ужин в кругу семьи
```

**Ночной градиент (22:00-6:00) - Поздний перекус:**
```
from: '#C4B5FD' (лавандовый)
to:   '#A78BFA' (мягкий фиолетовый)
Ассоциации: уют, тепло, домашняя еда
```

**Действия:**
1. Создать утилиту `getTimeBasedGradient()`
2. Проверить все градиенты через Color Contrast
3. Тестировать transitions между градиентами

---

**1.2.1.3 Semantic Food Colors**
**Цель:** Цвета для специфичных food-статусов

```
available:    '#22C55E' // Зелёный - блюдо доступно
unavailable:  '#EF4444' // Красный - блюдо недоступно
popular:      '#F59E0B' // Оранжевый - популярное блюдо
new:          '#3B82F6' // Синий - новое блюдо
vegetarian:   '#10B981' // Изумрудный - вегетарианское
vegan:        '#059669' // Тёмно-зелёный - веганское
spicy:        '#DC2626' // Красный - острое
discount:     '#8B5CF6' // Фиолетовый - скидка
```

**Действие:** Проверить каждый цвет через Color Contrast MCP

---

#### Задача 1.2.2: Glassmorphism Design System
**Цель:** Определить параметры glassmorphism для премиального вида

**Спецификация Glass эффекта:**
```
backdrop-blur: 12px (лёгкое размытие)
background: rgba(255, 255, 255, 0.7) [light]
background: rgba(23, 33, 43, 0.7) [dark]
border: 1px solid rgba(255, 255, 255, 0.2)
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1)
```

**Применение:**
- Hero cards (сумма заказа, баланс)
- Action buttons (Меню, Заказ, История, Голосование)
- Bottom navigation bar
- Modal windows
- Floating Action Button (FAB)

**Проверка через A11y:**
- Читаемость текста на glass background
- Контрастность borders
- Visibility на разных фонах

---

#### Задача 1.2.3: Typography для Food Context
**Цель:** Адаптировать типографику под food-тематику

**Шрифтовая пара:**
- **Display:** Inter Bold (названия блюд, заголовки)
- **Body:** Inter Regular (описания, цены)
- **Accent:** Inter SemiBold (категории, badges)

**Размеры для food items:**
```
Название блюда:    18px / font-semibold
Цена:              20px / font-bold
Описание:          14px / font-normal
Категория:         12px / font-medium
Ингредиенты:       12px / font-normal / text-hint
```

**Иерархия:**
1. Hero число (сумма) - 48px
2. Заголовки страниц - 24px
3. Названия блюд - 18px
4. Body text - 16px
5. Captions - 14px
6. Labels - 12px

---

### 1.3 Иконки и визуальные метафоры

#### Задача 1.3.1: Food Icons через Lucide-Icons MCP
**Цель:** Подобрать food-themed иконки для замены финансовых

**MCP Инструмент:** Lucide Icons

**Маппинг иконок (Crypto → Food):**

**Главные действия (4 кнопки):**
1. **Receive → Меню**
   - Старая иконка: ArrowDownLeft
   - Новая иконка: UtensilsCrossed или ChefHat
   - Поиск через MCP: "food", "utensils", "menu"

2. **Send → Заказ**
   - Старая иконка: ArrowUpRight
   - Новая иконка: ShoppingCart или ShoppingBag
   - Поиск через MCP: "cart", "shopping", "basket"

3. **Swap → История**
   - Старая иконка: RefreshCw
   - Новая иконка: ClipboardList или History
   - Поиск через MCP: "history", "list", "clipboard"

4. **Buy → Голосование**
   - Старая иконка: CreditCard
   - Новая иконка: Vote или CheckSquare
   - Поиск через MCP: "vote", "check", "ballot"

**Навигация:**
- Меню: UtensilsCrossed
- Статистика: BarChart3
- Голосования: Vote
- Профиль: User

**Статусы блюд:**
- Доступно: CheckCircle (зелёный)
- Недоступно: XCircle (красный)
- Популярное: TrendingUp (оранжевый)
- Новое: Sparkles (синий)
- Вегетарианское: Leaf (зелёный)
- Острое: Flame (красный)

**Категории еды:**
- Пицца: Pizza (если есть) или UtensilsCrossed
- Суши: Fish (если нет специальной)
- Бургеры: CircleDot (стилизованный)
- Салаты: Leaf
- Десерты: Cake (если есть)
- Напитки: Coffee или Cup

**Действия:**
1. Поиск через Lucide MCP по категориям
2. Fuzzy search для близких вариантов
3. Получение usage examples для React
4. Документирование выбранных иконок

**Ожидаемый результат:** Полный icon mapping документ

---

#### Задача 1.3.2: Эмодзи для Food Categories
**Цель:** Использовать эмодзи как дополнительные визуальные маркеры

**Маппинг эмодзи по категориям:**
```
Пицца:          🍕
Бургеры:        🍔
Суши:           🍣
Салаты:         🥗
Паста:          🍝
Десерты:        🍰
Супы:           🍲
Напитки:        ☕
Завтраки:       🍳
Снеки:          🍿
Вегетарианское: 🥬
Веганское:      🌱
```

**Применение:**
- Category badges
- Filter chips
- Menu sections headers
- Empty states illustrations

---

## 🎯 PHASE 2: КОМПОНЕНТНАЯ ТРАНСФОРМАЦИЯ

### 2.1 Hero Section - Сумма заказа/Баланс

#### Задача 2.1.1: Redesign Hero Card
**Цель:** Трансформировать crypto balance card в food budget card

**Старый дизайн (Crypto):**
- Большое число с зелёным/красным индикатором изменения
- Метка "Total Balance"
- График цены токена

**Новый дизайн (Food):**
- Большое число с текущей суммой заказа или балансом обедов
- Метка "Текущий заказ" или "Бюджет обедов"
- Индикаторы: сколько блюд в заказе, средний чек

**Компонент через Shadcn:**
- Базовый компонент: Card из Shadcn
- Получить через MCP: `shadcn get_component card`
- Адаптация: glassmorphism + food градиент

**Структура:**
```
┌─────────────────────────────────────┐
│  [Glass Card с gradient background] │
│                                     │
│  Текущий заказ                      │
│  ₽1,450                             │
│  └─ 3 блюда · Средний чек ₽483     │
│                                     │
│  [Mini chart - популярность]        │
└─────────────────────────────────────┘
```

**Glassmorphism параметры:**
```css
backdrop-filter: blur(12px)
background: linear-gradient(135deg, 
  rgba(255, 237, 213, 0.7), 
  rgba(254, 215, 170, 0.7))
border: 1px solid rgba(255, 255, 255, 0.3)
box-shadow: 0 8px 32px rgba(251, 146, 60, 0.15)
```

**Анимации через Framer Motion:**
- Появление: fade + scale (0.95 → 1)
- Число: count-up анимация
- Hover: subtle scale (1 → 1.02)

---

#### Задача 2.1.2: Adaptive Time-Based Gradient
**Цель:** Изменение градиента hero card по времени суток

**Реализация:**
1. Хук `useTimeBasedGradient()`
2. useEffect с setInterval для проверки времени
3. Плавный transition между градиентами (duration: 1000ms)

**Градиенты:**
- Утро (6-11): Персиковый
- День (11-16): Зелёный
- Вечер (16-22): Синий
- Ночь (22-6): Лавандовый

**Проверка через Color Contrast:**
- Текст на каждом градиенте
- Минимум WCAG AA (4.5:1)

---

### 2.2 Action Buttons - Меню/Заказ/История/Голосование

#### Задача 2.2.1: Redesign Action Buttons
**Цель:** 4 glassmorphism кнопки для основных действий

**Старые кнопки (Crypto):**
```
┌──────┬──────┬──────┬──────┐
│ ↙️   │ ↗️   │ 🔄   │ 💳   │
│ Recv │ Send │ Swap │ Buy  │
└──────┴──────┴──────┴──────┘
```

**Новые кнопки (Food):**
```
┌──────┬──────┬──────┬──────┐
│ 🍽️   │ 🛒   │ 📋   │ 🗳️   │
│ Меню │ Зак. │ Ист. │ Гол. │
└──────┴──────┴──────┴──────┘
```

**Компонент через Shadcn:**
- Базовый: Button из Shadcn
- Получить: `shadcn get_component button`
- Вариант: ghost + glassmorphism

**Спецификация одной кнопки:**
```css
/* Glass effect */
backdrop-filter: blur(8px)
background: rgba(255, 255, 255, 0.6) [light]
background: rgba(35, 46, 60, 0.6) [dark]
border: 1px solid rgba(255, 255, 255, 0.25)

/* Layout */
width: 72px
height: 72px
border-radius: 16px
padding: 12px

/* Content */
Icon size: 24px
Text size: 12px
Gap: 4px

/* Hover */
transform: translateY(-2px)
box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15)

/* Active */
transform: translateY(0) scale(0.98)
```

**Иконки из Lucide:**
1. Меню: UtensilsCrossed
2. Заказ: ShoppingCart
3. История: ClipboardList
4. Голосование: Vote

**Haptic Feedback:**
- Нажатие: hapticFeedback.impactOccurred('medium')
- Hover (desktop): subtle highlight

---

#### Задача 2.2.2: Responsive Layout для Action Buttons
**Цель:** Адаптация под разные экраны

**Mobile (< 640px):**
```
Grid: 2x2
Gap: 12px
Size: 72px × 72px
```

**Tablet (640px - 1024px):**
```
Grid: 1x4
Gap: 16px
Size: auto width
```

**Desktop (> 1024px):**
```
Grid: 1x4
Gap: 20px
Size: fixed 120px × 80px
```

---

### 2.3 Search и Filters

#### Задача 2.3.1: Glassmorphism Search Bar
**Цель:** Поиск блюд с премиальным glass эффектом

**Компонент через Shadcn:**
- Базовый: Input из Shadcn
- Получить: `shadcn get_component input`

**Модификации:**
1. Glassmorphism обёртка
2. Иконка поиска слева (Lucide Search)
3. Clear button справа (Lucide X)
4. Placeholder: "Найти блюдо или категорию..."

**Glass спецификация:**
```css
backdrop-filter: blur(10px)
background: rgba(255, 255, 255, 0.8) [light]
background: rgba(35, 46, 60, 0.8) [dark]
border: 1px solid rgba(255, 255, 255, 0.3)
box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05)
```

**Анимации:**
- Focus: border glow + subtle scale
- Type: debounce 300ms
- Clear: fade out results

---

#### Задача 2.3.2: Category Filter Chips
**Цель:** Фильтры категорий с food-themed styling

**Компонент:** Chip из `/components/common/Chip.tsx`

**Модификации:**
1. Добавить эмодзи категорий
2. Glassmorphism для активных
3. Haptic feedback при выборе

**Пример:**
```
[🍕 Пицца (12)] [🍔 Бургеры (8)] [🍣 Суши (15)] [🥗 Салаты (10)]
```

**Стили active chip:**
```css
background: linear-gradient(135deg, 
  rgba(251, 146, 60, 0.2),
  rgba(249, 115, 22, 0.2))
backdrop-filter: blur(8px)
border: 2px solid var(--primary-food-500)
```

---

### 2.4 Menu Item Cards

#### Задача 2.4.1: Redesign MenuItemCard
**Цель:** Карточки блюд с glassmorphism и food визуализацией

**Текущая структура:**
```
┌─────────────────────────────────┐
│ [Название]         [Цена]       │
│ [Категория badge]               │
│ [Описание]                      │
│ [Image]                         │
│ ─────────────────────────────   │
│ [Кнопки действий]               │
└─────────────────────────────────┘
```

**Новая структура с glassmorphism:**
```
┌─────────────────────────────────┐
│ [Image с gradient overlay]      │
│ ┌───────────────────────────┐   │
│ │ [Glass card поверх image] │   │
│ │ 🍕 Название блюда         │   │
│ │ Категория                 │   │
│ │ Краткое описание          │   │
│ │                           │   │
│ │ ₽450  [Статус badge]     │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Компонент через Shadcn:**
- Базовый: Card из Shadcn
- Модификация: glass overlay + gradient

**Glass overlay спецификация:**
```css
position: absolute
bottom: 0
left: 0
right: 0
backdrop-filter: blur(12px)
background: linear-gradient(
  to top,
  rgba(255, 255, 255, 0.9),
  rgba(255, 255, 255, 0.7)
) [light]
background: linear-gradient(
  to top,
  rgba(23, 33, 43, 0.9),
  rgba(23, 33, 43, 0.7)
) [dark]
padding: 16px
border-radius: 0 0 12px 12px
```

**Image обработка:**
1. Aspect ratio 16:9
2. Object-fit: cover
3. Lazy loading
4. Gradient overlay сверху для лучшей читаемости

---

#### Задача 2.4.2: Status Badges с Food Context
**Цель:** Визуальные индикаторы статуса блюда

**Типы badges:**
1. **Доступно** - зелёный CheckCircle
2. **Недоступно** - красный XCircle
3. **Популярное** - оранжевый TrendingUp + "Хит"
4. **Новое** - синий Sparkles + "New"
5. **Вегетарианское** - зелёный Leaf
6. **Веганское** - тёмно-зелёный Sprout
7. **Острое** - красный Flame + "🌶️"
8. **Скидка** - фиолетовый Tag + "-%"

**Badge компонент:**
- Базовый: Badge из Shadcn
- Получить: `shadcn get_component badge`

**Glass вариант badge:**
```css
backdrop-filter: blur(6px)
background: rgba(color, 0.2)
border: 1px solid rgba(color, 0.3)
padding: 4px 8px
font-size: 11px
```

**Проверка через Color Contrast:**
- Каждый badge color на glass background
- Минимум WCAG AA

---

### 2.5 Navigation

#### Задача 2.5.1: Glassmorphism Bottom Navigation
**Цель:** Премиальная нижняя навигация с glass эффектом

**Текущий дизайн:**
- Solid white/dark background
- Простые иконки
- Minimal styling

**Новый дизайн:**
```
┌─────────────────────────────────────────┐
│ [Glass bar с blur]                      │
│                                         │
│  🍽️    📊    🗳️    👤                  │
│ Меню  Стат  Гол.  Проф                 │
│  ●                                      │
└─────────────────────────────────────────┘
```

**Glass спецификация:**
```css
position: fixed
bottom: 0
left: 0
right: 0
height: 72px

backdrop-filter: blur(20px) saturate(180%)
background: rgba(255, 255, 255, 0.8) [light]
background: rgba(23, 33, 43, 0.8) [dark]
border-top: 1px solid rgba(255, 255, 255, 0.2)
box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1)
```

**Active indicator:**
```css
position: absolute
bottom: 2px
width: 32px
height: 4px
border-radius: 2px
background: var(--primary-food-500)

/* Анимация transition */
transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

**Иконки:**
- Size: 24px
- Active: primary-food-500
- Inactive: gray-500
- Haptic: light на каждое нажатие

---

### 2.6 Modals и Overlays

#### Задача 2.6.1: Glassmorphism Modals
**Цель:** Модальные окна с premium glass эффектом

**Компонент через Shadcn:**
- Базовый: Dialog из Shadcn
- Получить: `shadcn get_component dialog`

**Backdrop:**
```css
backdrop-filter: blur(8px)
background: rgba(0, 0, 0, 0.4)
```

**Modal content:**
```css
backdrop-filter: blur(24px)
background: rgba(255, 255, 255, 0.95) [light]
background: rgba(23, 33, 43, 0.95) [dark]
border: 1px solid rgba(255, 255, 255, 0.2)
border-radius: 24px
box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2)
```

**Анимации Framer Motion:**
- Появление: scale 0.9 → 1 + fade
- Закрытие: scale 1 → 0.95 + fade
- Duration: 200ms

---

## 🎯 PHASE 3: АНИМАЦИИ И МИКРОВЗАИМОДЕЙСТВИЯ

### 3.1 Framer Motion Animations

#### Задача 3.1.1: Page Transitions
**Цель:** Плавные переходы между страницами

**Варианты анимаций:**

**Slide:**
```javascript
variants = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -100, opacity: 0 }
}
transition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
```

**Fade + Scale:**
```javascript
variants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 1.05, opacity: 0 }
}
transition = { duration: 0.2 }
```

**Применение:**
- MenuPage ↔ VotingPage: Slide
- Modal windows: Fade + Scale
- Toast notifications: Slide from top

---

#### Задача 3.1.2: List Animations
**Цель:** Staggered анимации для списков блюд

**Stagger effect:**
```javascript
container = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
}

item = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 }
}
```

**Применение:**
- MenuList items
- Search results
- Category filters
- Poll options

---

#### Задача 3.1.3: Hover Animations
**Цель:** Subtle hover эффекты для интерактивных элементов

**Card hover:**
```javascript
whileHover = {
  y: -4,
  scale: 1.02,
  boxShadow: "0 12px 24px rgba(0, 0, 0, 0.15)"
}
transition = { duration: 0.2 }
```

**Button hover:**
```javascript
whileHover = {
  scale: 1.05,
  boxShadow: "0 8px 16px rgba(251, 146, 60, 0.2)"
}
whileTap = { scale: 0.98 }
```

---

### 3.2 Haptic Feedback

#### Задача 3.2.1: Haptic для всех интерактивных элементов
**Цель:** Тактильный отклик для улучшения UX

**Маппинг действий на haptic levels:**

**Light:**
- Tab navigation переключение
- Chip selection
- Checkbox toggle
- Input focus

**Medium:**
- Button clicks
- Card taps
- Menu item selection
- Action button press

**Heavy:**
- Confirm actions (Голосовать, Заказать)
- Delete confirmations
- Error states

**Success/Warning/Error notifications:**
- hapticFeedback.notificationOccurred('success')
- hapticFeedback.notificationOccurred('warning')
- hapticFeedback.notificationOccurred('error')

**Реализация:**
- useHaptic hook
- Обёртка для всех интерактивных компонентов
- Отключение в web версии (только для Telegram)

---

### 3.3 Loading States

#### Задача 3.3.1: Glassmorphism Skeletons
**Цель:** Skeleton loaders с glass эффектом

**Glass skeleton:**
```css
backdrop-filter: blur(8px)
background: linear-gradient(
  90deg,
  rgba(255, 255, 255, 0.4),
  rgba(255, 255, 255, 0.6),
  rgba(255, 255, 255, 0.4)
)
animation: shimmer 1.5s infinite
```

**Shimmer animation:**
```css
@keyframes shimmer {
  0% { background-position: -200% center }
  100% { background-position: 200% center }
}
background-size: 200% 100%
```

**Применение:**
- MenuItemCard skeleton
- Hero card skeleton
- Action buttons skeleton
- List items skeleton

---

## 🎯 PHASE 4: АДАПТИВНОСТЬ И ТЕМЫ

### 4.1 Responsive Design

#### Задача 4.1.1: Breakpoint-specific Layouts
**Цель:** Оптимальная раскладка для каждого устройства

**Mobile (< 640px):**
- Hero card: full-width
- Action buttons: 2x2 grid
- Menu cards: 1 column
- Navigation: bottom tabs

**Tablet (640px - 1024px):**
- Hero card: max-width 600px, centered
- Action buttons: 1x4 horizontal
- Menu cards: 2 columns
- Navigation: bottom tabs или side nav

**Desktop (> 1024px):**
- Hero card: max-width 400px, left-aligned
- Action buttons: 1x4 horizontal
- Menu cards: 3 columns
- Navigation: sidebar

**Playwright Testing:**
- Скриншоты на всех breakpoints
- Visual regression для каждого размера

---

### 4.2 Dark/Light Theme

#### Задача 4.2.1: Glassmorphism в Dark Theme
**Цель:** Адаптация glass эффектов для тёмной темы

**Light theme glass:**
```css
backdrop-filter: blur(12px)
background: rgba(255, 255, 255, 0.7)
border: 1px solid rgba(255, 255, 255, 0.3)
```

**Dark theme glass:**
```css
backdrop-filter: blur(12px)
background: rgba(35, 46, 60, 0.7)
border: 1px solid rgba(255, 255, 255, 0.1)
```

**Проверка через Color Contrast:**
- Все text + glass background pairs
- Обе темы
- WCAG AA minimum

---

#### Задача 4.2.2: Time-Based Gradients в обеих темах
**Цель:** Адаптивные градиенты работают в light и dark

**Light theme - утренний градиент:**
```
from: rgba(255, 237, 213, 0.7)
to:   rgba(254, 215, 170, 0.7)
```

**Dark theme - утренний градиент:**
```
from: rgba(255, 237, 213, 0.15)
to:   rgba(254, 215, 170, 0.15)
```

**Принцип:** Тот же hue, но меньше opacity для dark theme

---

## 🎯 PHASE 5: ТЕСТИРОВАНИЕ И ВАЛИДАЦИЯ

### 5.1 Accessibility Testing

#### Задача 5.1.1: A11y Audit после изменений
**Цель:** Убедиться, что accessibility не пострадал

**MCP Инструмент:** A11y

**Проверки:**
1. Все страницы через A11y MCP
2. Сравнение с baseline (Phase 1.1.2)
3. Новых critical/serious issues: 0
4. Keyboard navigation работает
5. Screen reader compatibility

**Фокус областей:**
- Glassmorphism текст на размытом фоне
- Icon buttons с aria-labels
- Color contrast на градиентах
- Focus indicators видимы

---

#### Задача 5.1.2: Color Contrast Validation
**Цель:** Все цветовые пары соответствуют WCAG AA

**MCP Инструмент:** Color Contrast

**Проверки:**
1. Каждый food color на каждом background
2. Time-based градиенты + текст
3. Glass effects + text
4. Status badges + backgrounds
5. Обе темы (light/dark)

**Критерии успеха:**
- Normal text: минимум 4.5:1
- Large text: минимум 3:1
- UI components: минимум 3:1

---

### 5.2 Performance Testing

#### Задача 5.2.1: Lighthouse Comparison
**Цель:** Производительность не ухудшилась после изменений

**MCP Инструмент:** Lighthouse

**Метрики для сравнения:**
```
                    Baseline → After
Performance Score:  XX       → XX
FCP:                X.Xs     → X.Xs
LCP:                X.Xs     → X.Xs
TBT:                XXXms    → XXXms
CLS:                X.XX     → X.XX
```

**Допустимые изменения:**
- Performance: ±5 points
- FCP: ±200ms
- LCP: ±300ms
- TBT: ±100ms
- CLS: ±0.05

**Если ухудшения:**
1. Оптимизация blur filter
2. Уменьшение количества glass layers
3. Debounce gradient transitions
4. Lazy load glassmorphism effects

---

#### Задача 5.2.2: Bundle Size Analysis
**Цель:** Размер bundle не вырос значительно

**Проверки:**
1. Vite build analyze
2. Размер main chunk
3. Размер lazy chunks
4. Total transfer size

**Целевые метрики:**
- Main chunk: < 400KB
- Lazy chunks: < 100KB each
- Total (gzip): < 800KB

**Оптимизации при превышении:**
- Tree-shake неиспользуемые Framer Motion варианты
- Lazy load time-based gradients
- Optimize glassmorphism CSS

---

### 5.3 Visual Regression Testing

#### Задача 5.3.1: Playwright Screenshots
**Цель:** Визуальное сравнение до/после

**MCP Инструмент:** Playwright

**Сценарий тестирования:**
1. Открыть каждую страницу
2. Сделать screenshot в обеих темах
3. Все breakpoints (mobile, tablet, desktop)
4. Сравнить с baseline screenshots
5. Approval новых визуальных изменений

**Страницы для скриншотов:**
- MenuPage (с меню, без меню)
- MenuPage (с результатами поиска)
- VotingPage (активное голосование)
- VotingPage (результаты)
- StatsPage
- ProfilePage
- Modal windows (MenuForm)

**Результат:** Visual regression report с diff highlights

---

### 5.4 User Testing

#### Задача 5.4.1: Usability Testing
**Цель:** Валидация UX изменений с реальными пользователями

**Тест-кейсы:**
1. **Первое впечатление:** Премиальность дизайна (1-5)
2. **Поиск блюда:** Время на нахождение конкретного блюда
3. **Создание заказа:** Легкость добавления блюд в заказ
4. **Голосование:** Понятность процесса голосования
5. **Навигация:** Интуитивность перемещения между разделами

**Метрики успеха:**
- Премиальность: средний балл ≥ 4.0
- Время поиска: < 10 секунд
- Успешных заказов: > 90%
- Понимание голосования: > 95%
- Легкость навигации: ≥ 4.5

---

## 🎯 PHASE 6: ДОКУМЕНТАЦИЯ И DEPLOYMENT

### 6.1 Design System Documentation

#### Задача 6.1.1: Обновление Storybook
**Цель:** Документировать все новые компоненты в Storybook

**Компоненты для документации:**
1. GlassCard - hero card с glassmorphism
2. GlassButton - action buttons с glass effect
3. GlassMenuItemCard - карточки блюд
4. TimeBasedGradient - компонент с адаптивным градиентом
5. FoodBadge - статус badges для блюд
6. GlassNavigation - bottom nav с glass
7. GlassModal - модальные окна

**Для каждого компонента:**
- Props documentation
- Варианты (variants)
- States (default, hover, active, disabled)
- Обе темы (light/dark)
- Usage examples
- Accessibility notes

---

#### Задача 6.1.2: Color Palette Documentation
**Цель:** Документировать новую food-палитру

**Документ:** `/frontend/design-system/COLOR_PALETTE.md`

**Содержание:**
1. Primary food colors (50-900)
2. Semantic food colors
3. Time-based gradients спецификация
4. Glassmorphism parameters
5. WCAG contrast ratios таблица
6. Usage guidelines
7. Don'ts и anti-patterns

---

### 6.2 Migration Guide

#### Задача 6.2.1: Создание Migration Guide для команды
**Цель:** Инструкция по использованию новых компонентов

**Документ:** `/frontend/MIGRATION_GUIDE.md`

**Разделы:**
1. **Цветовая миграция:**
   - Старые цвета → Новые food colors
   - Как использовать time-based градиенты

2. **Компонентная миграция:**
   - Button → GlassButton
   - Card → GlassCard
   - Badge → FoodBadge

3. **Иконки:**
   - Crypto icons → Food icons маппинг
   - Использование Lucide через MCP

4. **Анимации:**
   - Добавление Framer Motion variants
   - Haptic feedback integration

5. **Темы:**
   - Glassmorphism в dark theme
   - Adaptive gradients

---

### 6.3 Performance Budgets

#### Задача 6.3.1: Установка Performance Budgets
**Цель:** Предотвращение регрессий в будущем

**Lighthouse CI configuration:**
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 300}]
      }
    }
  }
}
```

**Bundle size budgets:**
```json
{
  "main.js": "400KB",
  "vendor.js": "300KB",
  "styles.css": "15KB"
}
```

---

### 6.4 Deployment Strategy

#### Задача 6.4.1: Staged Rollout Plan
**Цель:** Безопасный постепенный deploy новых изменений

**Этапы:**

**Stage 1: Dev Environment (Week 1)**
- Deploy на dev сервер
- Internal testing
- Bug fixes

**Stage 2: Staging Environment (Week 2)**
- Deploy на staging
- External stakeholder review
- Performance validation
- A11y validation

**Stage 3: Canary Release (Week 3)**
- 10% пользователей
- Monitoring метрик
- User feedback collection
- Error tracking

**Stage 4: Gradual Rollout (Week 4)**
- Day 1: 25% пользователей
- Day 2: 50% пользователей
- Day 3: 75% пользователей
- Day 4: 100% пользователей

**Rollback criteria:**
- Performance degradation > 10%
- Error rate increase > 5%
- Accessibility critical issues
- User satisfaction drop > 15%

---

## 📊 DELIVERABLES CHECKLIST

### Design Assets
- [ ] Food color palette спецификация
- [ ] Glassmorphism design system
- [ ] Time-based gradients документация
- [ ] Icon mapping таблица (crypto → food)
- [ ] Component variants guide
- [ ] Typography scale
- [ ] Spacing system

### Code Components
- [ ] GlassCard component
- [ ] GlassButton component
- [ ] GlassMenuItemCard component
- [ ] TimeBasedGradient hook
- [ ] FoodBadge component
- [ ] GlassNavigation component
- [ ] GlassModal component
- [ ] Adaptive animations setup

### Documentation
- [ ] Updated FRONTEND_ARCHITECTURE_DETAILED.md
- [ ] COLOR_PALETTE.md
- [ ] MIGRATION_GUIDE.md
- [ ] Storybook stories для всех компонентов
- [ ] Usage examples
- [ ] Accessibility guidelines

### Testing Artifacts
- [ ] A11y audit reports (before/after)
- [ ] Color contrast validation results
- [ ] Lighthouse reports (before/after)
- [ ] Playwright screenshots (all breakpoints, themes)
- [ ] Visual regression report
- [ ] Performance budget config
- [ ] User testing results

### CI/CD
- [ ] Lighthouse CI setup
- [ ] Bundle size monitoring
- [ ] A11y automated tests
- [ ] Visual regression pipeline
- [ ] Rollback procedures

---

## 🎯 SUCCESS METRICS

### Quantitative Metrics

**Performance:**
- ✅ Lighthouse Performance Score: ≥ 85
- ✅ LCP: < 2.5s
- ✅ FCP: < 1.8s
- ✅ CLS: < 0.1
- ✅ TBT: < 300ms

**Accessibility:**
- ✅ Lighthouse A11y Score: ≥ 95
- ✅ WCAG AA compliance: 100%
- ✅ Keyboard navigation: Full support
- ✅ Screen reader compatibility: 100%

**Bundle Size:**
- ✅ Main chunk: < 400KB
- ✅ Total (gzip): < 800KB
- ✅ No increase > 10% from baseline

### Qualitative Metrics

**User Feedback:**
- ✅ Премиальность дизайна: ≥ 4.0/5.0
- ✅ Легкость использования: ≥ 4.5/5.0
- ✅ Визуальная привлекательность: ≥ 4.3/5.0
- ✅ Понятность food metaphors: ≥ 90%

**Business Metrics:**
- ✅ Время создания заказа: -20% от baseline
- ✅ Вовлечённость в голосования: +30%
- ✅ Retention rate: +15%
- ✅ Session duration: +25%

---

## 🔄 MAINTENANCE PLAN

### Weekly
- Monitor Lighthouse scores
- Review error logs
- Check user feedback

### Monthly
- A11y audit refresh
- Color contrast revalidation
- Performance review
- Bundle size check

### Quarterly
- Design system update
- Component library refresh
- User testing session
- Competitor analysis

---

## 📚 RESOURCES & REFERENCES

### MCP Tools Documentation
- Shadcn UI: https://ui.shadcn.com/
- Lucide Icons: https://lucide.dev/
- Lighthouse: https://developers.google.com/web/tools/lighthouse
- A11y: WCAG 2.1 Guidelines

### Design Inspiration
- Glassmorphism: https://uxdesign.cc/glassmorphism-in-user-interfaces
- Food UI patterns: Behance, Dribbble collections
- Time-based interfaces: Material Design studies

### Technical References
- Framer Motion docs
- Tailwind CSS docs
- React best practices
- TypeScript handbook

---

## 🎉 ЗАКЛЮЧЕНИЕ

Этот план трансформации обеспечивает:

1. **Премиальность дизайна** через glassmorphism
2. **Food-specific метафоры** через цвета, иконки, градиенты
3. **Accessibility** на уровне WCAG AA
4. **Performance** без деградации
5. **Адаптивность** для всех устройств
6. **Качество** через comprehensive testing
7. **Документацию** для команды
8. **Безопасный deployment** через staged rollout

**Roadmap Timeline:** 6 недель
**Team Required:** 2-3 разработчика + 1 дизайнер
**Risk Level:** Низкий (благодаря тестированию и staged rollout)

---

**Документ создан:** 2024
**Версия:** 1.0.0
**Статус:** Ready for Implementation 🚀
