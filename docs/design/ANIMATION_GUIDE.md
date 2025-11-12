# 🎬 ANIMATION GUIDE

Руководство по анимациям и микроинтеракциям

---

## 1. ПРИНЦИПЫ АНИМАЦИИ

### Disney's 12 Principles (адаптация для UI)

**1. Squash and Stretch** — Bounce эффекты для checkmarks, кнопок
**2. Anticipation** — Slight scale down перед scale up
**3. Staging** — Focus пользователя на анимируемом элементе
**4. Straight Ahead vs Pose to Pose** — Используем CSS transitions (pose to pose)
**5. Follow Through** — Trailing effects, stagger animations
**6. Slow In and Slow Out** — ease-in-out для natural движения
**7. Secondary Action** — Subtle фон blur при модалах
**8. Timing** — Быстрые анимации (200ms) для responsiveness
**9. Exaggeration** — Subtle (scale 1.02, не 1.2)
**10. Solid Drawing** — Чёткие boundaries, avoid blurry states
**11. Appeal** — Приятные, smooth transitions

---

## 2. DURATION GUIDELINES

### Базовые правила

```
Micro (50-100ms):   Icon rotations, subtle highlights
Standard (200ms):   Hover states, color changes, scale
Medium (300-400ms): Slide-ins, fade-ins, transforms
Long (500ms+):      Page transitions, complex sequences
```

### Таблица duration по типу анимации

| Анимация | Duration | Обоснование |
|----------|----------|-------------|
| Button hover | 200ms | Instant feedback |
| Card hover | 200ms | Responsive |
| Modal open | 300ms | Smooth entrance |
| Toast slide-in | 400ms | Noticeable but quick |
| Page transition | 500ms | Complex layout change |
| Confetti burst | 1000ms | Celebration (одноразовая) |
| Number ticker | 2000ms | Countup для больших чисел |

---

## 3. EASING FUNCTIONS

### Основные кривые

```css
/* Default - для большинства UI */
transition-timing-function: ease-out;

/* Для выходящих элементов */
transition-timing-function: ease-in;

/* Для симметричных движений (модалы) */
transition-timing-function: ease-in-out;
```

### Custom cubic-bezier

```css
/* Bounce (для checkmarks) */
cubic-bezier(0.68, -0.55, 0.265, 1.55)

/* Elastic (для celebrations) */
cubic-bezier(0.68, -0.6, 0.32, 1.6)

/* Smooth (для плавных transitions) */
cubic-bezier(0.4, 0.0, 0.2, 1)
```

---

### Применение

```tsx
{/* Standard ease-out */}
<button className="transition-all duration-200 ease-out">

{/* Custom bounce */}
<div className="
  transition-transform duration-300
  [transition-timing-function:cubic-bezier(0.68,-0.55,0.265,1.55)]
">
```

---

## 4. HOVER STATES

### 4.1 Кнопки

```tsx
{/* Primary CTA */}
<button className="
  transition-all duration-200
  hover:scale-[1.02]
  hover:shadow-[0_0_30px_rgba(249,115,22,0.7)]
  active:scale-[0.98]
">
```

**Ключевые принципы:**
- **Hover:** Scale up (1.02), усиление эффектов
- **Active:** Scale down (0.98), inner shadow
- **Duration:** 200ms (быстрый feedback)

---

### 4.2 Карточки

```tsx
{/* Standard Card */}
<div className="
  transition-all duration-200
  hover:shadow-[0_4px_6px_rgba(0,0,0,0.05),0_2px_12px_rgba(0,0,0,0.08)]
  hover:scale-[1.01]
  hover:-translate-y-0.5
  cursor-pointer
">
```

**Эффекты:**
- **Elevation up:** Level 1 → Level 2 shadow
- **Subtle scale:** 1.01 (едва заметно)
- **Slight lift:** -translate-y-0.5 (2px вверх)

---

### 4.3 Иконки

```tsx
{/* Icon rotation */}
<svg className="
  transition-transform duration-200
  hover:rotate-12
  hover:scale-110
">
```

---

## 5. FOCUS STATES

**Для accessibility критически важно иметь чёткие focus states**

```tsx
<button className="
  focus:ring-2 
  focus:ring-orange-500 
  focus:ring-offset-2
  focus:outline-none
  transition-all duration-200
">
```

**Характеристики:**
- **Ring width:** 2px
- **Ring color:** Orange-500 (primary color)
- **Ring offset:** 2px (отступ от элемента)
- **Transition:** 200ms для smooth появления

---

## 6. СПЕЦИАЛЬНЫЕ АНИМАЦИИ

### 6.1 Stagger Animation (списки)

**Когда использовать:** Списки блюд, результаты голосования

```tsx
// Родительский контейнер
<div className="space-y-2">
  {items.map((item, index) => (
    <div
      key={item.id}
      className="animate-fade-in-up"
      style={{
        animationDelay: `${index * 50}ms`, // 50ms между элементами
        animationFillMode: 'both'
      }}
    >
      {/* Элемент */}
    </div>
  ))}
</div>
```

**CSS:**
```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 400ms ease-out;
}
```

---

### 6.2 Checkmark Bounce

**Когда использовать:** После успешного голосования, подтверждения

```tsx
<svg className="
  w-16 h-16 
  text-green-500
  animate-checkmark-bounce
">
  <path d="M5 13l4 4L19 7" />
</svg>
```

**CSS:**
```css
@keyframes checkmark-bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  75% {
    transform: scale(0.9);
  }
}

.animate-checkmark-bounce {
  animation: checkmark-bounce 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

---

### 6.3 Number Ticker

**Когда использовать:** Счётчики голосов, статистика

```tsx
import { useSpring, animated } from '@react-spring/web';

function NumberTicker({ value }) {
  const { number } = useSpring({
    from: { number: 0 },
    number: value,
    config: { duration: 2000 }
  });
  
  return (
    <animated.span>
      {number.to(n => Math.floor(n))}
    </animated.span>
  );
}
```

**Альтернатива (pure CSS):**
```css
@property --num {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

.counter {
  animation: counter 2s ease-out forwards;
  counter-reset: num var(--num);
}

.counter::after {
  content: counter(num);
}

@keyframes counter {
  to {
    --num: 25; /* Целевое значение */
  }
}
```

---

### 6.4 Shimmer Effect (Skeleton)

**Когда использовать:** Loading states

```tsx
<div className="relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded h-4">
  <div className="
    absolute inset-0
    -translate-x-full
    bg-gradient-to-r from-transparent via-white/40 to-transparent
    animate-shimmer
  " />
</div>
```

**Tailwind config:**
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        shimmer: 'shimmer 2s infinite',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
};
```

---

### 6.5 Pulse (Для "active" статусов)

```tsx
<span className="relative flex h-3 w-3">
  <span className="
    animate-ping 
    absolute inline-flex h-full w-full 
    rounded-full bg-green-400 
    opacity-75
  " />
  <span className="
    relative inline-flex 
    rounded-full h-3 w-3 
    bg-green-500
  " />
</span>
```

---

### 6.6 Confetti Burst

**Когда использовать:** После голосования, достижения milestone (10, 25, 50 голосов)

```tsx
import confetti from 'canvas-confetti';

function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FF8F4F', '#22C55E', '#3B82F6']
  });
}

// В компоненте
useEffect(() => {
  if (voteSuccess) {
    triggerConfetti();
  }
}, [voteSuccess]);
```

**Lightweight альтернатива (CSS-only):**
```css
@keyframes confetti-fall {
  0% {
    transform: translateY(-100vh) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

.confetti {
  position: fixed;
  width: 10px;
  height: 10px;
  background: #FF8F4F;
  animation: confetti-fall 3s linear;
}
```

---

### 6.7 Float Animation (Empty states)

**Когда использовать:** Иллюстрации в empty states

```tsx
<svg className="w-32 h-32 animate-float">
  {/* SVG illustration */}
</svg>
```

**CSS:**
```css
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
```

---

## 7. PAGE TRANSITIONS

### 7.1 Fade Crossfade

**Когда использовать:** Переходы между страницами

```tsx
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

---

### 7.2 Slide Transitions

```tsx
<motion.div
  initial={{ x: 300, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: -300, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
>
  {children}
</motion.div>
```

---

## 8. MODAL ANIMATIONS

### 8.1 Overlay Fade In

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-overlay {
  animation: fade-in 200ms ease-out;
}
```

---

### 8.2 Modal Scale In

```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-content {
  animation: scale-in 300ms cubic-bezier(0.4, 0.0, 0.2, 1);
}
```

---

## 9. TOAST NOTIFICATIONS

### 9.1 Slide In from Right

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast {
  animation: slide-in-right 400ms cubic-bezier(0.4, 0.0, 0.2, 1);
}
```

---

### 9.2 Slide Out (при закрытии)

```css
@keyframes slide-out-right {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast-exit {
  animation: slide-out-right 300ms ease-in;
}
```

---

## 10. PERFORMANCE

### 10.1 GPU-Accelerated Properties

**Используйте только эти properties для 60fps:**
- `transform` (translate, scale, rotate)
- `opacity`

**Избегайте анимировать:**
- `width`, `height` (вызывают reflow)
- `margin`, `padding` (вызывают reflow)
- `top`, `left` (используйте translate вместо)

---

### 10.2 Will-Change

**Для сложных анимаций используйте will-change:**

```tsx
<div className="
  will-change-transform
  hover:scale-110
">
```

**Но осторожно:** Не используйте will-change везде, только для анимируемых элементов.

---

### 10.3 Reduce Motion

**Уважайте предпочтения пользователей:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**В Tailwind:**
```tsx
<div className="
  transition-transform duration-200
  motion-reduce:transition-none
">
```

---

## 11. EASTER EGGS И DELIGHTERS

### 11.1 Round Number Celebration

**Когда:** Голоса достигают 10, 25, 50

```tsx
useEffect(() => {
  if (votes === 10 || votes === 25 || votes === 50) {
    triggerConfetti();
    showToast(`🎉 ${votes} голосов! Отличный результат!`);
  }
}, [votes]);
```

---

### 11.2 Time-based Greetings

```tsx
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '☀️ Доброе утро';
  if (hour < 18) return '👋 Добрый день';
  return '🌙 Добрый вечер';
}

<h1 className="text-2xl font-semibold animate-fade-in">
  {getGreeting()}, {userName}!
</h1>
```

---

### 11.3 Hover Surprises (Subtle)

```tsx
{/* Logo hover */}
<img 
  src="/logo.png" 
  className="
    transition-transform duration-500
    hover:rotate-[360deg]
    hover:scale-110
  " 
/>
```

---

## 12. ПОЛНЫЙ ПРИМЕР: VOTING SUCCESS FLOW

```tsx
function VotingSuccessAnimation() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    // Step 1: Button transform (0ms)
    setStep(1);
    
    // Step 2: Checkmark bounce (300ms)
    setTimeout(() => setStep(2), 300);
    
    // Step 3: Confetti burst (600ms)
    setTimeout(() => {
      setStep(3);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }, 600);
    
    // Step 4: Success message stagger (900ms)
    setTimeout(() => setStep(4), 900);
  }, []);
  
  return (
    <div className="space-y-4">
      {/* Step 1: Button transforms to success state */}
      <button className={`
        transition-all duration-300
        ${step >= 1 ? 'bg-green-500' : 'bg-orange-500'}
        ${step >= 1 ? 'scale-110' : 'scale-100'}
      `}>
        {step < 1 ? 'Проголосовать' : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              type: 'spring',
              stiffness: 260,
              damping: 20 
            }}
          >
            ✓
          </motion.div>
        )}
      </button>
      
      {/* Step 2-3: Checkmark + Confetti */}
      {step >= 2 && (
        <div className="flex justify-center">
          <svg className="
            w-16 h-16 text-green-500
            animate-checkmark-bounce
          ">
            <circle cx="32" cy="32" r="30" fill="currentColor" />
            <path d="M20 32l8 8 16-16" stroke="white" strokeWidth="3" />
          </svg>
        </div>
      )}
      
      {/* Step 4: Success message */}
      {step >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h3 className="text-2xl font-semibold text-gray-700 mb-2">
            Голос учтён! 🎉
          </h3>
          <p className="text-gray-600">
            Спасибо за участие
          </p>
        </motion.div>
      )}
    </div>
  );
}
```

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — Базовая система
- [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) — UI компоненты
- [DESIGN_ROADMAP.md](./DESIGN_ROADMAP.md) — План реализации

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

**Библиотеки:**
- **Framer Motion** — React анимации (рекомендуется)
- **React Spring** — Physics-based animations
- **canvas-confetti** — Confetti effects
- **GSAP** — Advanced timeline animations (если нужно)

**Инструменты:**
- **cubic-bezier.com** — Визуальный редактор easing curves
- **Lottie** — JSON-based animations (для сложных иллюстраций)

---

**Last updated:** 2025-01-12
