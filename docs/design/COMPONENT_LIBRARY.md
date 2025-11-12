# 🧩 COMPONENT LIBRARY

Библиотека переиспользуемых UI компонентов

---

## 1. КНОПКИ

### 1.1 Primary CTA Button

**Когда использовать:** Главное действие на экране (только ОДНА на весь экран)

**Характеристики:**
- Градиент orange-500 → orange-600
- Glow эффект (shadow)
- Белый текст, semibold
- Минимум 44px высота

```tsx
<button className="
  bg-gradient-to-r from-orange-500 to-orange-600
  text-white
  font-semibold text-base
  px-6 py-3
  min-h-[44px]
  rounded-md
  shadow-[0_0_20px_rgba(249,115,22,0.5)]
  hover:shadow-[0_0_30px_rgba(249,115,22,0.7)]
  hover:scale-[1.02]
  active:scale-[0.98]
  active:shadow-inner
  focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
  transition-all duration-200
">
  Проголосовать
</button>
```

**Состояния:**
- **Default:** Градиент + glow
- **Hover:** Усиленный glow, scale 1.02
- **Active:** Scale 0.98, inner shadow
- **Focus:** Orange ring 2px
- **Disabled:** Opacity 50%, no shadow, no hover

**Примеры использования:**
- "Проголосовать" в активном голосовании
- "Создать голосование" в форме
- "Отметить как оплачено" в Budget Widget

---

### 1.2 Secondary Button

**Когда использовать:** Второстепенные действия, альтернативы primary

**Характеристики:**
- Solid orange-500 фон (НЕ градиент)
- Белый текст, semibold
- Без glow эффекта
- Чуть меньше prominence

```tsx
<button className="
  bg-orange-500
  text-white
  font-semibold text-base
  px-5 py-2.5
  min-h-[44px]
  rounded-md
  hover:bg-orange-600
  active:bg-orange-700
  focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-all duration-200
">
  Добавить блюдо
</button>
```

**Примеры использования:**
- "Добавить блюдо" в управлении меню
- "Изменить" в настройках
- "Сохранить" в формах (если не primary action)

---

### 1.3 Tertiary (Outline) Button

**Когда использовать:** Менее важные действия, отмены

**Характеристики:**
- Прозрачный фон
- Orange-500 border и текст
- Hover → subtle orange-50 фон

```tsx
<button className="
  bg-transparent
  border-2 border-orange-500
  text-orange-500
  font-semibold text-base
  px-5 py-2.5
  min-h-[44px]
  rounded-md
  hover:bg-orange-50 dark:hover:bg-orange-900/20
  active:bg-orange-100 dark:active:bg-orange-900/30
  focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-all duration-200
">
  Отменить голосование
</button>
```

**Примеры использования:**
- "Отменить голосование" (админ)
- "Отмена" в модальных окнах
- "Назад" в навигации

---

### 1.4 Ghost Button

**Когда использовать:** Минимальная визуальная нагрузка, tertiary actions

**Характеристики:**
- Прозрачный фон
- Нет border
- Orange-600 текст
- Hover → subtle фон

```tsx
<button className="
  bg-transparent
  text-orange-600 dark:text-orange-400
  font-medium text-base
  px-4 py-2
  min-h-[44px]
  rounded-md
  hover:bg-gray-100 dark:hover:bg-gray-700
  active:bg-gray-200 dark:active:bg-gray-600
  focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-all duration-200
">
  Показать ещё
</button>
```

**Примеры использования:**
- "Показать ещё" в списках
- "Подробнее" в карточках
- "Пропустить" в onboarding

---

### 1.5 Правило "Один Primary CTA"

**Важно:** На одном экране должна быть только ОДНА primary CTA кнопка.

**Примеры:**

❌ **Неправильно:**
```
[Проголосовать] Primary
[Создать новое голосование] Primary  ← Conflict!
```

✅ **Правильно:**
```
[Проголосовать] Primary
[Создать новое голосование] Secondary
```

---

## 2. КАРТОЧКИ

### 2.1 Standard Card

**Когда использовать:** Основной контейнер для контента

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-md
  shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.06)]
  p-4
  border border-gray-200 dark:border-gray-700
  transition-all duration-200
">
  {/* Контент */}
</div>
```

**Характеристики:**
- Нейтральный фон (white/gray-800)
- Level 1 elevation
- 8px border radius
- 16px padding

**Hover для интерактивных карточек:**
```tsx
hover:shadow-[0_4px_6px_rgba(0,0,0,0.05),0_2px_12px_rgba(0,0,0,0.08)]
hover:scale-[1.01]
cursor-pointer
```

---

### 2.2 Hero Card

**Когда использовать:** Ключевой элемент страницы (активное голосование)

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-lg
  shadow-[0_10px_15px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.12)]
  p-6
  border border-gray-200 dark:border-gray-700
">
  {/* Контент */}
</div>
```

**Характеристики:**
- Level 3 elevation (более глубокая тень)
- 16px border radius (lg)
- 24px padding (больше воздуха)
- Более доминантная позиция

---

### 2.3 Accent Strip Card

**Когда использовать:** Карточка со статусом (urgent, success, info)

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-md
  shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.06)]
  p-4
  border-l-4 border-orange-500
  border-t border-r border-b border-gray-200 dark:border-gray-700
">
  {/* Контент */}
</div>
```

**Варианты цветов:**
- **orange-500** — Активность, внимание
- **green-500** — Success, подтверждение
- **blue-500** — Информация
- **amber-500** — Предупреждение
- **red-500** — Ошибка, срочность

**Примеры использования:**
- Budget Widget с urgent debt (orange)
- Success message после голосования (green)
- Информационные подсказки (blue)

---

### 2.4 Empty State Card

**Когда использовать:** Нет данных для отображения

```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-md
  shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_4px_rgba(0,0,0,0.06)]
  p-8
  border border-gray-200 dark:border-gray-700
  text-center
">
  <div className="flex flex-col items-center gap-4">
    {/* SVG иллюстрация */}
    <svg className="w-24 h-24 text-gray-300 animate-float">
      {/* ... */}
    </svg>
    
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
      Нет активных голосований
    </h3>
    
    <p className="text-gray-500 dark:text-gray-400 max-w-sm">
      Создайте новое голосование, чтобы начать 🚀
    </p>
    
    <button className="...">
      Создать голосование
    </button>
  </div>
</div>
```

**Характеристики:**
- Центрированный контент
- Дружелюбная иллюстрация (с subtle анимацией)
- Ясный призыв к действию
- Emoji для эмоциональности

---

## 3. BADGES И CHIPS

### 3.1 Count Badge

**Когда использовать:** Счётчики, количество элементов

```tsx
<div className="
  inline-flex items-center
  bg-orange-100 dark:bg-orange-900/30
  text-orange-700 dark:text-orange-300
  text-sm font-semibold
  px-3 py-1
  rounded-full
">
  <span>5 голосов</span>
</div>
```

**Варианты:**
- **Orange** — Активность, голоса
- **Green** — Успешные действия
- **Gray** — Нейтральная информация

---

### 3.2 Status Badge

**Когда использовать:** Статусы (active, completed, cancelled)

```tsx
{/* Active */}
<span className="
  inline-flex items-center gap-1
  bg-green-100 dark:bg-green-900/30
  text-green-700 dark:text-green-300
  text-xs font-medium
  px-2 py-1
  rounded-full
">
  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
  Активно
</span>

{/* Completed */}
<span className="
  inline-flex items-center
  bg-gray-100 dark:bg-gray-700
  text-gray-700 dark:text-gray-300
  text-xs font-medium
  px-2 py-1
  rounded-full
">
  Завершено
</span>
```

**Характеристики:**
- Маленький размер (xs)
- Rounded-full (pill shape)
- Цвет соответствует статусу
- Анимированная точка для "active"

---

## 4. INPUTS И FORMS

### 4.1 Text Input

```tsx
<input
  type="text"
  placeholder="Название блюда"
  className="
    w-full
    bg-white dark:bg-gray-800
    border border-gray-200 dark:border-gray-700
    text-gray-700 dark:text-gray-200
    placeholder:text-gray-400
    px-4 py-3
    rounded-md
    focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
    focus:border-orange-500
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
  "
/>
```

---

### 4.2 Textarea

```tsx
<textarea
  placeholder="Описание..."
  rows={4}
  className="
    w-full
    bg-white dark:bg-gray-800
    border border-gray-200 dark:border-gray-700
    text-gray-700 dark:text-gray-200
    placeholder:text-gray-400
    px-4 py-3
    rounded-md
    focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
    focus:border-orange-500
    disabled:opacity-50 disabled:cursor-not-allowed
    resize-none
    transition-all duration-200
  "
/>
```

---

### 4.3 Checkbox

```tsx
<label className="flex items-center gap-3 cursor-pointer group">
  <input
    type="checkbox"
    className="
      w-5 h-5
      text-orange-500
      bg-white dark:bg-gray-800
      border-gray-300 dark:border-gray-600
      rounded
      focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
      transition-all duration-200
    "
  />
  <span className="
    text-gray-700 dark:text-gray-200
    group-hover:text-orange-600 dark:group-hover:text-orange-400
    transition-colors duration-200
  ">
    Согласен с условиями
  </span>
</label>
```

---

## 5. LOADING STATES

### 5.1 Skeleton Loader

```tsx
<div className="animate-pulse space-y-4">
  {/* Заголовок */}
  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
  
  {/* Текст */}
  <div className="space-y-2">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
  </div>
</div>
```

**С shimmer эффектом:**
```tsx
<div className="relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded">
  <div className="
    absolute inset-0
    -translate-x-full
    bg-gradient-to-r from-transparent via-white/40 to-transparent
    animate-shimmer
  " />
</div>

{/* В tailwind.config.js */}
animation: {
  shimmer: 'shimmer 2s infinite',
}
keyframes: {
  shimmer: {
    '100%': { transform: 'translateX(100%)' },
  }
}
```

---

### 5.2 Spinner

```tsx
<div className="
  inline-block
  w-6 h-6
  border-3 border-gray-200 dark:border-gray-700
  border-t-orange-500
  rounded-full
  animate-spin
" />
```

**Центрированный на странице:**
```tsx
<div className="flex items-center justify-center min-h-screen">
  <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
</div>
```

---

## 6. MODAL WINDOWS

### 6.1 Standard Modal

```tsx
{/* Overlay */}
<div className="
  fixed inset-0
  bg-black/50
  z-40
  animate-fade-in
" />

{/* Modal */}
<div className="
  fixed inset-0
  z-50
  flex items-center justify-center
  p-4
  animate-scale-in
">
  <div className="
    bg-white dark:bg-gray-800
    rounded-xl
    shadow-[0_20px_25px_rgba(0,0,0,0.1),0_10px_40px_rgba(0,0,0,0.15)]
    p-6
    max-w-md w-full
    border border-gray-200 dark:border-gray-700
  ">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-100">
        Подтвердите действие
      </h2>
      <button className="text-gray-400 hover:text-gray-600">
        ✕
      </button>
    </div>
    
    {/* Body */}
    <p className="text-gray-600 dark:text-gray-300 mb-6">
      Вы уверены, что хотите завершить голосование?
    </p>
    
    {/* Actions */}
    <div className="flex gap-3 justify-end">
      <button className="...">Отмена</button>
      <button className="...">Подтвердить</button>
    </div>
  </div>
</div>
```

**Анимации:**
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

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
```

---

## 7. TOAST NOTIFICATIONS

```tsx
<div className="
  fixed bottom-4 right-4
  bg-white dark:bg-gray-800
  border-l-4 border-green-500
  rounded-md
  shadow-[0_10px_15px_rgba(0,0,0,0.08),0_4px_20px_rgba(0,0,0,0.12)]
  p-4
  max-w-sm
  animate-slide-in-right
  z-50
">
  <div className="flex items-start gap-3">
    <span className="text-2xl">✅</span>
    <div className="flex-1">
      <h4 className="font-semibold text-gray-700 dark:text-gray-100 mb-1">
        Успешно!
      </h4>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Ваш голос учтён
      </p>
    </div>
    <button className="text-gray-400 hover:text-gray-600">
      ✕
    </button>
  </div>
</div>
```

**Варианты:**
- **Success (green):** ✅ Успешные действия
- **Error (red):** ❌ Ошибки
- **Warning (amber):** ⚠️ Предупреждения
- **Info (blue):** ℹ️ Информация

---

## 8. NAVIGATION

### 8.1 Bottom Navigation (Mobile)

```tsx
<nav className="
  fixed bottom-0 left-0 right-0
  bg-white dark:bg-gray-800
  border-t border-gray-200 dark:border-gray-700
  shadow-[0_-4px_6px_rgba(0,0,0,0.05)]
  z-30
">
  <div className="flex items-center justify-around px-4 py-3">
    {/* Nav Item */}
    <a href="/" className="
      flex flex-col items-center gap-1
      text-orange-500 dark:text-orange-400
      transition-colors duration-200
    ">
      <HomeIcon className="w-6 h-6" />
      <span className="text-xs font-medium">Главная</span>
    </a>
    
    {/* Inactive Item */}
    <a href="/polls" className="
      flex flex-col items-center gap-1
      text-gray-400 dark:text-gray-500
      hover:text-gray-600 dark:hover:text-gray-300
      transition-colors duration-200
    ">
      <PollIcon className="w-6 h-6" />
      <span className="text-xs font-medium">Голосования</span>
    </a>
  </div>
</nav>
```

---

## 9. УТИЛИТЫ

### 9.1 Divider

```tsx
{/* Horizontal */}
<hr className="border-t border-gray-200 dark:border-gray-700 my-4" />

{/* With text */}
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
      или
    </span>
  </div>
</div>
```

---

### 9.2 Avatar

```tsx
{/* С изображением */}
<img
  src={user.avatar}
  alt={user.name}
  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
/>

{/* Initials fallback */}
<div className="
  w-10 h-10
  rounded-full
  bg-orange-500
  text-white
  font-semibold text-sm
  flex items-center justify-center
">
  {user.initials}
</div>
```

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — Базовая система
- [ANIMATION_GUIDE.md](./ANIMATION_GUIDE.md) — Анимации
- [DESIGN_ROADMAP.md](./DESIGN_ROADMAP.md) — План реализации

---

**Last updated:** 2025-01-12
