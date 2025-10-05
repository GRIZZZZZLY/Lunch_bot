# 🎯 ICON MAPPING: CRYPTO → FOOD

## Маппинг иконок для трансформации фронтенда

### 🍽️ Главные действия (4 кнопки)

| Старая (Crypto) | Новая (Food) | Lucide Component | Описание |
|-----------------|--------------|------------------|----------|
| ArrowDownLeft (Receive) | **UtensilsCrossed** | `<UtensilsCrossed />` | Меню блюд |
| ArrowUpRight (Send) | **ShoppingCart** | `<ShoppingCart />` | Заказ/Корзина |
| RefreshCw (Swap) | **ClipboardList** | `<ClipboardList />` | История заказов |
| CreditCard (Buy) | **Vote** | `<Vote />` | Голосование за блюда |

### 🧭 Навигация (Bottom Tab Bar)

| Раздел | Иконка | Lucide Component |
|--------|--------|------------------|
| Меню | **UtensilsCrossed** | `<UtensilsCrossed />` |
| Статистика | **BarChart3** | `<BarChart3 />` |
| Голосования | **Vote** | `<Vote />` |
| Профиль | **User** | `<User />` |

### ✅ Статусы блюд

| Статус | Иконка | Lucide Component | Цвет |
|--------|--------|------------------|------|
| Доступно | **CheckCircle** | `<CheckCircle />` | `#22C55E` (зелёный) |
| Недоступно | **XCircle** | `<XCircle />` | `#EF4444` (красный) |
| Популярное | **TrendingUp** | `<TrendingUp />` | `#F59E0B` (оранжевый) |
| Новое | **Sparkles** | `<Sparkles />` | `#3B82F6` (синий) |
| Вегетарианское | **Leaf** | `<Leaf />` | `#10B981` (зелёный) |
| Веганское | **LeafyGreen** | `<LeafyGreen />` | `#059669` (тёмно-зелёный) |
| Острое | **Flame** | `<Flame />` | `#DC2626` (красный) |
| Скидка | **Tag** | `<Tag />` | `#8B5CF6` (фиолетовый) |

### 🔧 Действия

| Действие | Иконка | Lucide Component |
|----------|--------|------------------|
| Добавить | **Plus** | `<Plus />` |
| Редактировать | **Pencil** | `<Pencil />` |
| Удалить | **Trash2** | `<Trash2 />` |
| Поиск | **Search** | `<Search />` |
| Фильтр | **Filter** | `<Filter />` |
| Сортировка | **ArrowUpDown** | `<ArrowUpDown />` |
| Закрыть | **X** | `<X />` |

### 🍕 Категории еды (примеры)

| Категория | Эмодзи | Иконка Fallback | Lucide Component |
|-----------|--------|-----------------|------------------|
| Пицца | 🍕 | **UtensilsCrossed** | `<UtensilsCrossed />` |
| Суши | 🍣 | **Fish** | `<Fish />` |
| Бургеры | 🍔 | **CircleDot** | `<CircleDot />` |
| Салаты | 🥗 | **Leaf** | `<Leaf />` |
| Десерты | 🍰 | **Cake** | `<Cake />` (если есть) |
| Напитки | ☕ | **Coffee** | `<Coffee />` |
| Супы | 🍲 | **Soup** | `<Soup />` (если есть) |
| Паста | 🍝 | **UtensilsCrossed** | `<UtensilsCrossed />` |

## 📦 Usage Examples

### Пример 1: Action Button (Меню)
```tsx
import { UtensilsCrossed } from 'lucide-react';

<button className="glass-button">
  <UtensilsCrossed size={24} strokeWidth={2} />
  <span>Меню</span>
</button>
```

### Пример 2: Status Badge (Популярное)
```tsx
import { TrendingUp } from 'lucide-react';

<div className="badge badge-popular">
  <TrendingUp size={16} color="#F59E0B" />
  <span>Хит</span>
</div>
```

### Пример 3: Navigation Tab (Голосование)
```tsx
import { Vote } from 'lucide-react';

<div className="nav-tab">
  <Vote size={24} strokeWidth={2} className="text-primary-food-500" />
  <span>Голосования</span>
</div>
```

## 🎨 Стилизация иконок

### Размеры
- **Navigation**: `24px` (size={24})
- **Action Buttons**: `24px` (size={24})
- **Status Icons**: `16-20px` (size={16-20})
- **Menu Items**: `20px` (size={20})

### Stroke Width
- **Default**: `2` (strokeWidth={2})
- **Thin**: `1.5` (strokeWidth={1.5})
- **Bold**: `2.5` (strokeWidth={2.5})

### Цвета
- **Active**: `var(--primary-food-500)` или `#F97316`
- **Inactive**: `#6B7280` (gray-500)
- **Success**: `#22C55E` (green-500)
- **Error**: `#EF4444` (red-500)
- **Warning**: `#F59E0B` (orange-500)

## 🔄 Миграция

### Шаг 1: Импорт
```tsx
// Старое (если были кастомные SVG)
import ArrowIcon from '@/assets/icons/arrow.svg';

// Новое (Lucide React)
import { UtensilsCrossed, ShoppingCart, ClipboardList, Vote } from 'lucide-react';
```

### Шаг 2: Использование
```tsx
// Старое
<img src={ArrowIcon} alt="Menu" />

// Новое
<UtensilsCrossed size={24} strokeWidth={2} className="text-primary-food-500" />
```

### Шаг 3: Стилизация через className
```tsx
<UtensilsCrossed 
  className="w-6 h-6 text-primary-food-500 hover:text-primary-food-600 transition-colors"
/>
```

---

**Статус:** ✅ Готово к использованию
**Обновлено:** 2024
**Источник иконок:** Lucide React v0.544.0
