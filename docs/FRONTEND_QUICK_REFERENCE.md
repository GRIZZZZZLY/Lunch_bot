# 🚀 Frontend Quick Reference

Краткая справка для быстрого старта в новой сессии.

---

## ✅ Что уже сделано

### Компоненты UI
- [x] GlassCard - glassmorphism карточки (3 уровня intensity)
- [x] GradientButton - кнопки с градиентами (7 вариантов)
- [x] ThemeToggle - переключатель темы
- [x] DonationBar - swipeable баннер поддержки проекта
- [x] DonationModal - модалка донатов (обновлен дизайн)

### Страницы
- [x] HomePage - полностью обновлена с динамическим header
- [ ] MenuPage - осталась старая версия
- [ ] VotingPage - осталась старая версия
- [ ] StatsPage - осталась старая версия
- [ ] ProfilePage - осталась старая версия

### Фичи
- [x] Динамический header по времени дня (завтрак/обед/ужин/перекус)
- [x] Темная и светлая тема
- [x] Glassmorphism эффекты
- [x] Framer Motion анимации
- [x] Мобильные жесты (swipe to dismiss)
- [x] Haptic feedback
- [x] Auto-refresh активных голосований

---

## 🎨 Цвета (используй эти)

```tsx
// Primary actions
variant="peach"      // Основные действия (голосование, главные кнопки)

// Success/Menu
variant="mint"       // Успех, меню, позитивные действия

// Premium/Stats
variant="lavender"   // Статистика, премиум функции

// Energy/Active
variant="coral"      // Активные процессы, энергичные действия

// Warning/Donate
variant="butter"     // Предупреждения, донаты, внимание
```

---

## 📦 Как использовать компоненты

### GlassCard
```tsx
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';

<GlassCard intensity="medium" hover>
  <div className="absolute inset-0 bg-gradient-to-r from-peach-500/20 to-coral-500/20" />
  <GlassCardContent className="relative">
    Контент
  </GlassCardContent>
</GlassCard>
```

### GradientButton
```tsx
import { GradientButton } from '@/components/ui/gradient-button';

<GradientButton variant="peach" size="lg" shimmer>
  Кнопка
</GradientButton>
```

### Динамический градиент
```tsx
import { useTimeBasedGradient } from '@/hooks/useTimeBasedGradient';

const gradientColors = useTimeBasedGradient(theme === 'dark');
// gradientColors.from, gradientColors.to, gradientColors.label, gradientColors.timeOfDay
```

---

## 🗂️ Структура файлов

```
frontend/src/
├── components/
│   ├── ui/                      # shadcn/ui + custom
│   │   ├── glass-card.tsx       ⭐ Главный UI компонент
│   │   ├── gradient-button.tsx  ⭐ Градиентные кнопки
│   │   ├── theme-toggle.tsx     
│   │   └── ...
│   ├── donation/
│   │   ├── DonationBar.tsx      ⭐ NEW - swipeable banner
│   │   ├── DonationModal.tsx    ⭐ UPDATED
│   │   ├── PaymentMethodCard.tsx ⭐ UPDATED
│   │   └── AmountSelector.tsx   ⭐ UPDATED
│   └── layout/
│       └── Layout.tsx           ⭐ UPDATED (добавлен DonationBar)
│
├── pages/
│   ├── HomePage.tsx             ⭐ UPDATED - динамический header
│   └── ...                      (остальные - старые)
│
├── hooks/
│   ├── useTimeBasedGradient.ts  ⭐ Динамические градиенты
│   ├── useHaptic.ts
│   └── ...
│
├── lib/
│   └── utils.ts                 ⭐ Utility функции
│
└── styles/
    ├── globals.css              ⭐ CSS variables для тем
    └── index.css
```

---

## 🔧 Важные настройки

### DonationBar timing (можно изменить)
```typescript
// src/components/donation/DonationBar.tsx

const DONATION_CONFIG = {
  FIRST_SHOW_DELAY: 30 * 1000,        // Первый показ
  SHOW_INTERVAL: 5 * 60 * 1000,       // Повторы
  AUTO_HIDE_TIMEOUT: 10 * 1000,       // Автоскрытие
  DISMISS_DURATION: 24 * 60 * 60 * 1000, // Dismiss период
  SWIPE_THRESHOLD: 100,                // Порог свайпа
};
```

### Время дня (градиенты)
```typescript
// src/hooks/useTimeBasedGradient.ts

6-11:  morning (завтрак) - оранжевый 🌅
11-16: afternoon (обед) - зеленый ☀️
16-22: evening (ужин) - синий 🌆
22-6:  night (перекус) - фиолетовый 🌙
```

---

## 🐛 Исправленные баги

1. ✅ HomePage импорт (HomePageNew → HomePage)
2. ✅ Фон на светлой теме (bg-gray-50 → bg-background)
3. ✅ ThemeToggle видимость (ghost → outline)
4. ✅ Padding для навигации (pb-24)

---

## 📋 TODO (если нужно продолжить)

### Приоритет 1 - Quick Actions v2.0 ⭐
- [ ] Реализовать гибридный подход для Quick Actions
- [ ] Добавить Hero Action с динамическим контентом
- [ ] Реализовать 4 сценария отображения
- [ ] Добавить функцию "Повторить прошлое" (для всех)
- [ ] Реализовать "Выбрать за меня" с конфетти
- [ ] Добавить "Результаты Live" с auto-refresh
- [ ] Создать модалки подтверждения
- [ ] Добавить API метод getLastCompletedPoll()

**См. детали:** `FRONTEND_CURRENT_STATE.md` → секция "🚧 В работе"  
**Спецификация:** `QUICK_ACTIONS_SPEC.md`

### Приоритет 2 - Остальные страницы
- [ ] MenuPage - применить GlassCard + новые цвета
- [ ] VotingPage - обновить дизайн poll cards
- [ ] StatsPage - графики с новыми цветами
- [ ] ProfilePage - glassmorphism карточки

### Приоритет 2 - Доп. фичи
- [ ] Toast notifications с GlassCard
- [ ] Loading states с shimmer
- [ ] Empty states с иллюстрациями
- [ ] Page transitions

### Приоритет 3 - Оптимизация
- [ ] Code splitting по страницам
- [ ] Image optimization
- [ ] Performance monitoring

---

## 🚨 Частые проблемы

### Проблема: Импорты не работают
```typescript
// Проверь alias в tsconfig.json
"@/*": ["./src/*"]

// Используй правильные импорты:
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
```

### Проблема: Цвета не применяются
```typescript
// Убедись что в globals.css есть CSS variables
// И что tailwind.config.js содержит новые цвета
```

### Проблема: Тема не переключается
```typescript
// Проверь что theme хранится в zustand store
// И что document.documentElement.classList обновляется
const setTheme = useAppStore((state) => state.setTheme);
```

---

## 📚 Полная документация

- `FRONTEND_CURRENT_STATE.md` - Детальное описание всего
- `FRONTEND_REDESIGN_PROGRESS.md` - История изменений
- `HOW_TO_ACTIVATE_NEW_HOMEPAGE.md` - Активация новой версии

---

## 🎯 Быстрый старт в новой сессии

1. Прочитай `FRONTEND_CURRENT_STATE.md`
2. Посмотри `HomePage.tsx` как пример
3. Используй существующие компоненты из `components/ui/`
4. Следуй цветовой палитре (peach, mint, lavender, coral, butter)
5. Добавляй анимации через Framer Motion
6. Тестируй на мобильных (свайпы!)

---

**Дата:** 07.10.2025  
**Версия:** v2.0
