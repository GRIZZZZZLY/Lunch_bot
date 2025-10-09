# 📚 Migration Guide - Animated Gradients

**Версия:** 1.0.0  
**Дата:** Январь 2025  
**Статус:** ✅ Ready for Use

---

## 🎯 Быстрый старт для новых страниц

### Шаг 1: Импорты

```tsx
import { SubtleDiagonalGradient } from '../components/background';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';
import { useTelegram } from '../hooks/useTelegram';
```

### Шаг 2: Setup хуков

```tsx
const { colorScheme } = useTelegram();
const isDark = colorScheme === 'dark';
const { from, to, textColor, label } = useTimeBasedGradient(isDark);
```

⚠️ **ВАЖНО:** Передавайте `isDark` (boolean), а **НЕ** `colorScheme` (string)!

### Шаг 3: Добавить градиент в Layout

```tsx
<Layout>
  <SubtleDiagonalGradient
    timeOfDay="auto"
    theme={isDark ? 'dark' : 'light'}
    className="fixed inset-0 -z-10"
  />
  
  {/* Ваш контент */}
</Layout>
```

### Шаг 4 (опционально): Использовать в GlassHeroCard

```tsx
<GlassHeroCard
  gradient={{ from, to }}
  value="₽1,450"
  label={`Заказ · ${label}`}
  sublabel="3 блюда"
  textColor={textColor}
  icon={<ShoppingCart size={24} />}
/>
```

---

## 🗺️ Выбор градиента по типу страницы

| Тип страницы | Градиент | Обоснование |
|--------------|----------|-------------|
| Dashboard/Home | `SubtleDiagonalGradient` | Нейтральный, не отвлекает |
| Content-heavy (Menu) | `MediumWaveGradient` | Динамика, но не навязчив |
| Focus (Profile) | `SubtleRadialGradient` | Центрирует внимание на пользователе |
| Action (Voting) | `MediumWaveGradient` | Движение, энергия выбора |
| Forms | `SubtleDiagonalGradient` | Не отвлекает от ввода |
| Stats/Analytics | `SubtleRadialGradient` | Spotlight эффект на данные |
| Admin/Management | `SubtleDiagonalGradient` | Деловая атмосфера |

---

## ❌ Частые ошибки

### Ошибка #1: Неправильный вызов useTimeBasedGradient

```tsx
// ❌ НЕПРАВИЛЬНО
const { gradient, textColor, label } = useTimeBasedGradient(colorScheme);
const { from, to } = gradient;
// ОШИБКА: colorScheme это string ('light' | 'dark'), 
// а hook ожидает boolean (isDark)

// ✅ ПРАВИЛЬНО
const isDark = colorScheme === 'dark';
const { from, to, textColor, label } = useTimeBasedGradient(isDark);
```

**Почему:** Hook возвращает объект напрямую, а не вложенный `gradient`.

---

### Ошибка #2: Забыли вычислить isDark

```tsx
// ❌ НЕПРАВИЛЬНО
const gradient = useTimeBasedGradient(true);
// Всегда dark theme, не реагирует на изменение темы

// ✅ ПРАВИЛЬНО
const { colorScheme } = useTelegram();
const isDark = colorScheme === 'dark';
const { from, to } = useTimeBasedGradient(isDark);
// Динамически реагирует на изменение темы
```

---

### Ошибка #3: Неправильное позиционирование

```tsx
// ❌ НЕПРАВИЛЬНО
<SubtleDiagonalGradient className="absolute" />
// Конфликт с Layout, градиент может скрыться

// ✅ ПРАВИЛЬНО
<SubtleDiagonalGradient className="fixed inset-0 -z-10" />
// fixed = всегда видим, -z-10 = под контентом
```

---

### Ошибка #4: Layout перекрывает градиент

```tsx
// ❌ НЕПРАВИЛЬНО в Layout.tsx
<div style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
// Inline style перекрывает CSS градиент!

// ✅ ПРАВИЛЬНО
<div className="bg-gray-50 dark:bg-gray-900 relative">
// Fallback через Tailwind, без inline style
```

---

### Ошибка #5: GlassHeroCard требует children

```tsx
// ❌ НЕПРАВИЛЬНО (TypeScript error)
<GlassHeroCard
  gradient={{ from, to }}
  value="₽1,450"
  label="Заказ"
/>
// ERROR: Property 'children' is missing

// ✅ ПРАВИЛЬНО
// Компонент исправлен, теперь children не требуется
<GlassHeroCard
  gradient={{ from, to }}
  value="₽1,450"
  label="Заказ"
/>
```

**Решение:** Interface изменён на `extends Omit<GlassCardProps, 'children' | 'gradient'>`

---

## 📋 Проверочный чеклист

Перед тем как считать интеграцию завершённой:

### Импорты
- [ ] Импортирован градиент из `'../components/background'`
- [ ] Импортирован `useTimeBasedGradient` hook
- [ ] Импортирован `useTelegram` hook (если нужен theme)

### Хуки
- [ ] `isDark` вычисляется из `colorScheme`
- [ ] `useTimeBasedGradient` вызван с `isDark` (boolean)
- [ ] Destructuring правильный: `{ from, to, textColor, label }`

### Компонент
- [ ] Градиент имеет `className="fixed inset-0 -z-10"`
- [ ] `timeOfDay="auto"` (или явно указан)
- [ ] `theme={isDark ? 'dark' : 'light'}`

### Layout
- [ ] Layout **НЕ** имеет `backgroundColor` в inline style
- [ ] Layout имеет `relative` класс
- [ ] Main content имеет `relative z-0`

### Визуальная проверка
- [ ] Градиент виден в light theme
- [ ] Градиент виден в dark theme
- [ ] Градиент плавно анимируется
- [ ] Текст читаем на фоне градиента
- [ ] Переключение темы работает корректно

---

## 🔄 Миграция существующих страниц

### Пример: MenuPage

**Было:**
```tsx
export const MenuPage: React.FC = () => {
  const { colorScheme } = useTelegram();
  // ... нет градиента
  
  return (
    <Layout>
      {/* Контент без градиента */}
    </Layout>
  );
};
```

**Стало:**
```tsx
import { MediumWaveGradient } from '../components/background';
import { useTimeBasedGradient } from '../hooks/useTimeBasedGradient';

export const MenuPage: React.FC = () => {
  const { colorScheme } = useTelegram();
  const isDark = colorScheme === 'dark';
  const { from, to, textColor, label } = useTimeBasedGradient(isDark);
  
  return (
    <Layout>
      <MediumWaveGradient
        timeOfDay="auto"
        theme={isDark ? 'dark' : 'light'}
        className="fixed inset-0 -z-10"
      />
      
      {/* Контент с градиентом */}
    </Layout>
  );
};
```

---

## 🎨 Кастомизация

### Изменить вариант градиента

```tsx
// Вместо готового варианта
<SubtleDiagonalGradient />

// Можно использовать базовый компонент с настройками
<AnimatedGradientBackground
  variant="wave"          // diagonal | radial | wave | mesh | aurora
  speed="medium"          // slow | medium | fast
  intensity="subtle"      // subtle | medium | vibrant
  timeOfDay="auto"
  theme="auto"
  className="fixed inset-0 -z-10"
/>
```

### Кастомная цветовая палитра

```tsx
<AnimatedGradientBackground
  variant="diagonal"
  customColors={{
    primary: [
      'rgba(255, 0, 0, 0.3)',
      'rgba(255, 165, 0, 0.4)',
      'rgba(255, 255, 0, 0.3)',
    ],
    secondary: [
      'rgba(0, 255, 0, 0.2)',
      'rgba(0, 0, 255, 0.2)',
    ]
  }}
  className="fixed inset-0 -z-10"
/>
```

### Добавить overlay для читаемости

```tsx
<AnimatedGradientBackground
  variant="mesh"
  intensity="vibrant"
  overlay={true}
  overlayOpacity={0.05}  // 0-1
  className="fixed inset-0 -z-10"
/>
```

---

## 🔧 Troubleshooting

### Градиент не виден

**Возможные причины:**

1. **Layout перекрывает:**
   - Проверьте что Layout не имеет `backgroundColor` в inline style
   - Добавьте `relative` к Layout container

2. **Z-index проблема:**
   - Убедитесь что градиент имеет `className="fixed inset-0 -z-10"`
   - Main content должен иметь `relative z-0`

3. **Тема не определяется:**
   - Проверьте что `isDark` вычисляется корректно
   - Убедитесь что `useTelegram` hook работает

### Градиент слишком яркий/тусклый

```tsx
// Слишком яркий? Уменьшите intensity
<SubtleDiagonalGradient />  // intensity="subtle" по умолчанию

// Слишком тусклый? Увеличьте intensity
<AnimatedGradientBackground
  variant="diagonal"
  intensity="medium"  // или "vibrant"
/>
```

### TypeScript ошибки

```tsx
// ERROR: Property 'children' is missing in GlassHeroCard
// РЕШЕНИЕ: Обновите src/components/glass/GlassCard.tsx
export interface GlassHeroCardProps extends Omit<GlassCardProps, 'children' | 'gradient'>

// ERROR: Property 'from' does not exist on type 'String'
// РЕШЕНИЕ: Исправьте вызов useTimeBasedGradient
const isDark = colorScheme === 'dark';
const { from, to } = useTimeBasedGradient(isDark);  // не colorScheme!
```

---

## 📊 Примеры для всех страниц

### HomePage
```tsx
<SubtleDiagonalGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

### MenuPage
```tsx
<MediumWaveGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

### StatsPage
```tsx
<SubtleRadialGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

### VotingPage
```tsx
<MediumWaveGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

### ProfilePage
```tsx
<SubtleRadialGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

### PollManagementPage
```tsx
<SubtleDiagonalGradient timeOfDay="auto" theme={isDark ? 'dark' : 'light'} className="fixed inset-0 -z-10" />
```

---

## 🔗 Дополнительные ресурсы

**Документация:**
- [`ANIMATED_GRADIENTS.md`](./ANIMATED_GRADIENTS.md) - Полная документация градиентов
- [`COLOR_PALETTE.md`](./COLOR_PALETTE.md) - Цветовая палитра
- [`FRONTEND_TRANSFORMATION_PLAN.md`](./FRONTEND_TRANSFORMATION_PLAN.md) - Общий план трансформации

**Код:**
- `src/components/background/` - Компоненты градиентов
- `src/hooks/useTimeBasedGradient.ts` - Hook для time-based логики
- `src/lib/animatedGradients.ts` - Утилиты и константы

---

**Автор:** Factory Droid AI Assistant  
**Версия:** 1.0.0  
**Дата:** Январь 2025

**Вопросы?** Обратитесь к `ANIMATED_GRADIENTS.md` для подробной информации.
