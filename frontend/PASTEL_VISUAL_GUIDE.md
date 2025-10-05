# 🎨 ВИЗУАЛЬНЫЙ СПРАВОЧНИК ПАСТЕЛЬНЫХ ЦВЕТОВ

**Быстрая справка по новым цветам для темной темы**

---

## 🧊 BLUEGRAY (Голубовато-серый)

```
███████████  Bluegray-50  #F0F4F8  (Lightest)
████████████ Bluegray-100 #D9E2EC
█████████████ Bluegray-200 #BCCCDC  (Borders)
██████████████ Bluegray-300 #9FB3C8  ⭐ PRIMARY (6.8:1 AA)
███████████████ Bluegray-400 #829AB1  (Hover)
████████████████ Bluegray-500 #627D98  (Active)
█████████████████ Bluegray-600 #486581
██████████████████ Bluegray-700 #334E68
███████████████████ Bluegray-800 #243B53
████████████████████ Bluegray-900 #102A43  (Darkest)
```

**Использование:**
- Информационные виджеты
- Статистические карточки
- Основные контейнеры
- Нейтральные кнопки

**Код:**
```tsx
<div className="bg-bluegray-300 text-slate-900 p-4 rounded-lg">
  Primary Widget
</div>

<div className="glass-widget-bluegray rounded-xl p-6">
  Glass Widget
</div>
```

---

## 💜 LAVENDER (Нежно-лиловый)

```
███████████  Lavender-50  #F5F3FF  (Lightest)
████████████ Lavender-100 #EDE9FE
█████████████ Lavender-200 #DDD6FE  (Borders)
██████████████ Lavender-300 #C4B5FD  ⭐ PRIMARY (7.2:1 AA)
███████████████ Lavender-400 #A78BFA  (Hover)
████████████████ Lavender-500 #8B5CF6  (Active)
█████████████████ Lavender-600 #7C3AED
██████████████████ Lavender-700 #6D28D9
███████████████████ Lavender-800 #5B21B6
████████████████████ Lavender-900 #4C1D95  (Darkest)
```

**Использование:**
- Premium функции
- Специальные предложения
- VIP элементы
- Акцентные блоки

**Код:**
```tsx
<div className="bg-lavender-300 text-slate-900 p-4 rounded-lg">
  Premium Feature
</div>

<button className="btn-lavender px-6 py-3 rounded-lg">
  VIP Offer
</button>
```

---

## 🍑 PEACH (Приглушенный оранжевый)

```
███████████  Peach-50   #FBF5F0  (Lightest)
████████████ Peach-100  #F5EBE1
█████████████ Peach-200  #E6D4BF  (Borders)
██████████████ Peach-300  #D4A574  ⭐ PRIMARY (6.1:1 AA)
███████████████ Peach-400  #C78A5C  (Hover)
████████████████ Peach-500  #B97447  (Active)
█████████████████ Peach-600  #A05E35
██████████████████ Peach-700  #824A28
███████████████████ Peach-800  #63381D
████████████████████ Peach-900  #462814  (Darkest)
```

**Использование:**
- Food buttons
- Заказ еды
- Primary actions
- Цены

**Код:**
```tsx
<button className="btn-peach px-6 py-3 rounded-lg font-semibold">
  Order Now
</button>

<div className="bg-peach-300 text-slate-900 p-3 rounded">
  $12.99
</div>
```

---

## ✅ SUCCESS-SOFT (Приглушенный зеленый)

```
█████████████ Success-soft-200 #C5E6D5  (Light BG)
██████████████ Success-soft-300 #9FD4B3  ⭐ PRIMARY (7.5:1 AAA)
███████████████ Success-soft-400 #6BA882  (Hover)
```

**Использование:**
- Мягкие успешные уведомления
- Активные статусы
- Завершенные задачи

**Код:**
```tsx
<span className="bg-success-soft-300 text-slate-900 px-3 py-1 rounded-full">
  ✓ Delivered
</span>
```

---

## ⚠️ WARNING-SOFT (Приглушенный желтый)

```
█████████████ Warning-soft-200 #E6DEBA  (Light BG)
██████████████ Warning-soft-300 #D9D394  ⭐ PRIMARY (8.1:1 AAA)
███████████████ Warning-soft-400 #C5A66D  (Hover)
```

**Использование:**
- Мягкие предупреждения
- Ожидающие статусы
- Информация о задержках

**Код:**
```tsx
<div className="bg-warning-soft-300 text-slate-900 p-3 rounded">
  ⚠ Payment Pending
</div>
```

---

## ❌ ERROR-SOFT (Приглушенный красный)

```
█████████████ Error-soft-200 #E6C5C5  (Light BG)
██████████████ Error-soft-300 #D4A5A5  ⭐ PRIMARY (6.9:1 AA)
███████████████ Error-soft-400 #B87171  (Hover)
```

**Использование:**
- Мягкие ошибки
- Отмененные статусы
- Неудачные попытки

**Код:**
```tsx
<span className="bg-error-soft-300 text-slate-900 px-3 py-1 rounded-full">
  ✗ Failed
</span>
```

---

## 🎨 СРАВНЕНИЕ: ЯРКИЕ vs ПАСТЕЛЬНЫЕ

### В СВЕТЛОЙ ТЕМЕ:
```
Orange-500 ████████████ #F97316 (Яркий оранжевый)
                VS
Peach-300  ████████████ #D4A574 (Приглушенный - НЕ нужен в light)
```

### В ТЕМНОЙ ТЕМЕ:
```
🌙 Фон: #1E293B (Slate-800)

Orange-400  ████████████ #FB923C (Слишком яркий)
                VS
Peach-300   ████████████ #D4A574 (Комфортный) ⭐ ИСПОЛЬЗУЙТЕ
```

---

## 📏 КОНТРАСТНЫЕ ТАБЛИЦЫ

### На темном фоне (#1E293B):

| Цвет | Визуал | Контраст | WCAG |
|------|--------|----------|------|
| **Bluegray-300** | `██████` #9FB3C8 | 6.8:1 | ✅ AA |
| **Lavender-300** | `██████` #C4B5FD | 7.2:1 | ✅ AA |
| **Peach-300** | `██████` #D4A574 | 6.1:1 | ✅ AA |
| **Success-soft-300** | `██████` #9FD4B3 | 7.5:1 | ✅ AAA |
| **Warning-soft-300** | `██████` #D9D394 | 8.1:1 | ✅ AAA |
| **Error-soft-300** | `██████` #D4A5A5 | 6.9:1 | ✅ AA |

### Текст на виджетах:

```
██████████████ Bluegray-300 BG
  Slate-900 Text (8.9:1 AAA) ✅

██████████████ Lavender-300 BG
  Slate-900 Text (9.2:1 AAA) ✅

██████████████ Peach-300 BG
  Slate-900 Text (7.8:1 AAA) ✅
```

---

## 🔄 БЫСТРЫЕ ЗАМЕНЫ

### Cards & Widgets:
```diff
- <div className="bg-slate-700">
+ <div className="glass-widget-bluegray">
```

### Food Buttons:
```diff
- <button className="bg-orange-400 text-white">
+ <button className="btn-peach">
```

### Success Badges:
```diff
- <span className="bg-green-300 text-slate-900">
+ <span className="bg-success-soft-300 text-slate-900">
```

### Info Elements:
```diff
- <div className="bg-blue-300 text-slate-900">
+ <div className="bg-bluegray-300 text-slate-900">
```

---

## 🎯 МАТРИЦА ПРИМЕНЕНИЯ

| Компонент | Яркая версия | Пастельная версия | Когда использовать пастель |
|-----------|--------------|-------------------|----------------------------|
| **Menu Card** | orange-400 | peach-300 | Всегда в темной теме |
| **Stats Widget** | blue-300 | bluegray-300 | Информационные блоки |
| **Premium Badge** | purple-400 | lavender-300 | VIP элементы |
| **Success Status** | green-300 | success-soft-300 | Неинвазивные уведомления |
| **Warning Alert** | yellow-300 | warning-soft-300 | Мягкие предупреждения |
| **Error Message** | red-300 | error-soft-300 | Некритичные ошибки |

---

## 🌈 ГРАДИЕНТЫ

### Bluegray → Lavender (Информация → Premium)
```tsx
<div className="bg-gradient-to-r from-bluegray-300 to-lavender-300">
  ████████████████████████████████
  #9FB3C8 --------→ #C4B5FD
</div>
```

### Peach → Lavender (Food → Special)
```tsx
<button className="bg-gradient-to-r from-peach-300 to-lavender-300">
  ████████████████████████████████
  #D4A574 --------→ #C4B5FD
</button>
```

### Success → Info (Завершено → Обработка)
```tsx
<div className="bg-gradient-to-r from-success-soft-300 to-bluegray-300">
  ████████████████████████████████
  #9FD4B3 --------→ #9FB3C8
</div>
```

---

## 💡 СОВЕТЫ ПО ИСПОЛЬЗОВАНИЮ

### ✅ ПРАВИЛЬНО:

```tsx
// Используйте Slate-900 для текста на пастельных фонах
<div className="bg-bluegray-300 text-slate-900">
  High Contrast Text
</div>

// Используйте glass для виджетов в темной теме
<div className="dark">
  <div className="glass-widget-bluegray">
    Soft, Elegant Widget
  </div>
</div>

// Используйте Peach вместо Orange в темной теме
<button className="dark:btn-peach">
  Order Food
</button>
```

### ❌ НЕПРАВИЛЬНО:

```tsx
// НЕ используйте светлый текст на пастельных фонах
<div className="bg-bluegray-300 text-white">
  Low Contrast (плохо) ❌
</div>

// НЕ смешивайте яркие и пастельные цвета рядом
<div className="bg-orange-500">
  <span className="bg-bluegray-300">❌</span>
</div>

// НЕ используйте пастель для critical alerts
<div className="bg-error-soft-300">
  CRITICAL ERROR ❌ (используйте error-500)
</div>
```

---

## 📱 МОБИЛЬНЫЙ ПРЕВЬЮ

```
┌─────────────────────────┐
│  Telegram Food Bot      │ ← Slate-800 BG
├─────────────────────────┤
│                         │
│  ┌──────────────────┐   │
│  │ Daily Stats      │   │ ← glass-widget-bluegray
│  │ Orders: 12       │   │
│  │ ████████░░ 80%   │   │ ← bluegray-300 progress
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ ✨ VIP Offer     │   │ ← glass-widget-lavender
│  │ 50% OFF Today!   │   │
│  └──────────────────┘   │
│                         │
│  ┌──────────────────┐   │
│  │ 🍔 Burger $12.99 │   │ ← Peach-300 accent
│  │ [Order Now]      │   │ ← btn-peach
│  └──────────────────┘   │
│                         │
│  Status: ✓ Delivered    │ ← success-soft-300
│                         │
└─────────────────────────┘
```

---

## 🚀 БЫСТРЫЙ СТАРТ

### 1. Widget Card
```tsx
import { TrendingUp } from 'lucide-react';

<div className="glass-widget-bluegray rounded-xl p-6">
  <div className="flex items-center gap-3 mb-4">
    <div className="w-12 h-12 rounded-full bg-bluegray-400 
                    flex items-center justify-center">
      <TrendingUp size={24} className="text-slate-900" />
    </div>
    <div>
      <h3 className="text-slate-50 font-semibold text-lg">
        Statistics
      </h3>
      <p className="text-slate-300 text-sm">
        Last 7 days
      </p>
    </div>
  </div>
  
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-slate-300">Orders</span>
      <span className="text-slate-50 font-medium">248</span>
    </div>
    <div className="bg-bluegray-200/20 h-2 rounded-full">
      <div className="bg-bluegray-300 h-full rounded-full" 
           style={{width: '75%'}} />
    </div>
  </div>
</div>
```

### 2. Food Order Button
```tsx
import { ShoppingCart } from 'lucide-react';

<button className="btn-peach w-full px-6 py-3 rounded-lg 
                   font-semibold flex items-center justify-center gap-2
                   transition-all hover:scale-105 active:scale-95">
  <ShoppingCart size={20} />
  <span>Add to Cart - $12.99</span>
</button>
```

### 3. Status Badges
```tsx
import { Check, Clock, X } from 'lucide-react';

<div className="flex gap-2">
  <span className="bg-success-soft-300 text-slate-900 
                   px-3 py-1 rounded-full text-sm font-medium
                   inline-flex items-center gap-1.5">
    <Check size={14} />
    Delivered
  </span>
  
  <span className="bg-warning-soft-300 text-slate-900 
                   px-3 py-1 rounded-full text-sm font-medium
                   inline-flex items-center gap-1.5">
    <Clock size={14} />
    Pending
  </span>
  
  <span className="bg-error-soft-300 text-slate-900 
                   px-3 py-1 rounded-full text-sm font-medium
                   inline-flex items-center gap-1.5">
    <X size={14} />
    Canceled
  </span>
</div>
```

---

**Готово! Используйте эти пастельные цвета для создания мягкой и элегантной темной темы** 🎨✨
