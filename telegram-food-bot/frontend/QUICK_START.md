# ⚡ Quick Start Guide

## 🚀 Быстрый старт после модернизации

### 1. React Query Hooks

```typescript
// Получение данных
import { useMenuItems } from '@/hooks/queries';

const { data, isLoading, error, refetch } = useMenuItems();

// Создание
import { useCreateMenuItem } from '@/hooks/queries';

const createItem = useCreateMenuItem();
await createItem.mutateAsync({
  name: 'Пицца',
  price: 500,
  category: 'Основное'
});

// Обновление
import { useUpdateMenuItem } from '@/hooks/queries';

const updateItem = useUpdateMenuItem();
await updateItem.mutateAsync({
  id: 1,
  data: { price: 550 }
});

// Удаление
import { useDeleteMenuItem } from '@/hooks/queries';

const deleteItem = useDeleteMenuItem();
await deleteItem.mutateAsync(1);
```

### 2. Анимации

```typescript
import { 
  AnimatedPage, 
  StaggerList, 
  StaggerItem,
  AnimatedButton,
  FadeInUp 
} from '@/components/animations';

// Страница с анимацией
<AnimatedPage variant="slideUp">
  <YourPage />
</AnimatedPage>

// Список с последовательной анимацией
<StaggerList>
  {items.map(item => (
    <StaggerItem key={item.id}>
      <Card />
    </StaggerItem>
  ))}
</StaggerList>

// Кнопка
<AnimatedButton onClick={handler}>
  Нажми
</AnimatedButton>

// Элемент с задержкой
<FadeInUp delay={0.2}>
  <Content />
</FadeInUp>
```

### 3. Toast уведомления

```typescript
import { useToast } from '@/components/common/ToastManager';

const toast = useToast();

// Быстрые методы
toast.success('Успешно!');
toast.error('Ошибка!');
toast.warning('Внимание!');
toast.info('Информация');

// Loading toast
const id = toast.loading('Загрузка...');
// После загрузки:
toast.updateToast(id, {
  type: 'success',
  message: 'Готово!',
  duration: 3000
});

// Promise wrapper
await toast.promise(
  fetchData(),
  {
    loading: 'Загрузка...',
    success: 'Успешно!',
    error: 'Ошибка!'
  }
);

// С action
toast.error('Ошибка', {
  action: {
    label: 'Повторить',
    onClick: () => retry()
  }
});
```

### 4. PWA

```typescript
import { usePWA } from '@/hooks/usePWA';

const { isOnline, isUpdateAvailable, updateApp } = usePWA();

// Проверка online
if (!isOnline) {
  toast.warning('Нет соединения');
}

// Обновление приложения
if (isUpdateAvailable) {
  await updateApp();
}

// Компоненты уже добавлены в App.tsx:
// <OfflineIndicator /> - показывает баннер при offline
// <UpdatePrompt /> - предлагает обновить при новой версии
```

### 5. Новые UI компоненты

```typescript
import { 
  SwipeableListItem,
  BottomSheet,
  useBottomSheet,
  FAB,
  SimpleFAB,
  Tabs,
  Badge,
  BadgeWrapper,
  Chip,
  ChipGroup,
  DropdownMenu
} from '@/components/common';

// Swipe Actions
<SwipeableListItem
  leftAction={{
    icon: '⭐',
    label: 'Избранное',
    color: 'orange',
    onClick: () => addToFavorites(id)
  }}
  rightAction={{
    icon: '🗑️',
    label: 'Удалить',
    color: 'red',
    onClick: () => deleteItem(id)
  }}
>
  <MenuItem />
</SwipeableListItem>

// Bottom Sheet
const { isOpen, open, close } = useBottomSheet();

<BottomSheet
  isOpen={isOpen}
  onClose={close}
  title="Фильтры"
  snapPoints={[30, 60, 90]}
>
  <FilterContent />
</BottomSheet>

// FAB
<SimpleFAB
  icon="+"
  label="Добавить"
  onClick={() => navigate('/create')}
/>

// Tabs
<Tabs
  tabs={[
    {
      id: 'active',
      label: 'Активные',
      icon: '🟢',
      content: <ActiveList />
    },
    {
      id: 'completed',
      label: 'Завершённые',
      icon: '✅',
      content: <CompletedList />
    }
  ]}
  variant="underline"
  enableSwipe
/>

// Badge
<BadgeWrapper badge={5} variant="error">
  <button>Notifications</button>
</BadgeWrapper>

// Chips
<ChipGroup
  chips={categories}
  selected={selected}
  onSelect={setSelected}
  multiSelect
/>

// Dropdown Menu
<DropdownMenu
  trigger={<button>⋮</button>}
  items={[
    {
      id: 'edit',
      label: 'Редактировать',
      icon: '✏️',
      onClick: handleEdit
    },
    {
      id: 'delete',
      label: 'Удалить',
      icon: '🗑️',
      onClick: handleDelete,
      variant: 'danger'
    }
  ]}
/>
```

---

## 🛠️ Разработка

### Команды:

```bash
# Запуск dev сервера
npm run dev

# Сборка
npm run build

# Preview
npm run preview

# Storybook
npm run storybook

# Линтинг
npm run lint:fix

# Type check
npm run type-check
```

### Структура:

```
src/
├── components/
│   ├── animations/       # Framer Motion компоненты
│   ├── common/           # Переиспользуемые компоненты
│   ├── layout/           # Layouts
│   ├── menu/             # Меню компоненты
│   └── polls/            # Голосования компоненты
├── hooks/
│   ├── queries/          # React Query хуки
│   │   ├── useMenuQueries.ts
│   │   ├── usePollQueries.ts
│   │   └── useUserQueries.ts
│   ├── useHaptic.ts      # Haptic feedback
│   └── usePWA.ts         # PWA хук
├── lib/
│   └── react-query.ts    # React Query конфигурация
├── pages/                # Страницы (lazy loaded)
├── services/             # API сервисы
├── store/                # Zustand store
└── utils/                # Утилиты
```

---

## 🎯 Частые задачи

### Добавить новую страницу:

```typescript
// 1. Создать компонент в src/pages/
export const MyPage = () => {
  return <AnimatedPage variant="slideUp">...</AnimatedPage>
};

// 2. Добавить lazy import в App.tsx
const MyPage = lazy(() => import('./pages/MyPage'));

// 3. Добавить роут
<Route path="/my-page" element={<MyPage />} />
```

### Создать новый API хук:

```typescript
// src/hooks/queries/useMyQueries.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

export const useMyData = () => {
  return useQuery({
    queryKey: queryKeys.myData.all,
    queryFn: async () => {
      const response = await api.getData();
      return response.data;
    }
  });
};

export const useCreateMyData = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  return useMutation({
    mutationFn: async (data) => {
      return await api.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.myData.all 
      });
      toast.success('Создано!');
    },
    onError: () => {
      toast.error('Ошибка!');
    }
  });
};
```

### Создать Story для компонента:

```typescript
// MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: {
    title: 'Hello',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
```

---

## 🐛 Troubleshooting

### Bundle слишком большой?

```typescript
// vite.config.ts - уже настроено
rollupOptions: {
  output: {
    manualChunks: {
      vendor: ['react', 'react-dom'],
      animations: ['framer-motion'],
      queries: ['@tanstack/react-query'],
    }
  }
}
```

### React Query не обновляет данные?

```typescript
// Проверьте query keys
const { data } = useQuery({
  queryKey: ['menu', filters], // filters должны быть стабильными
  queryFn: fetchData
});

// Или используйте invalidate
queryClient.invalidateQueries({ 
  queryKey: ['menu'] 
});
```

### Service Worker не обновляется?

```bash
# 1. Очистите кэш
Dev Tools -> Application -> Clear storage

# 2. Проверьте registration
Dev Tools -> Application -> Service Workers

# 3. Unregister и reload
await navigator.serviceWorker.getRegistrations()
  .then(registrations => {
    registrations.forEach(r => r.unregister())
  })
```

---

## 📚 Полезные ссылки

- [React Query Docs](https://tanstack.com/query/latest)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Storybook Docs](https://storybook.js.org/docs)

---

Готово! Теперь можно разрабатывать 🚀
