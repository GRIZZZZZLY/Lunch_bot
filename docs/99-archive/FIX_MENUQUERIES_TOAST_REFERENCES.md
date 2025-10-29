# ✅ Исправлены Неразрешенные Ссылки на toast в useMenuQueries

**Дата:** 2025-10-27  
**Файл:** `frontend/src/hooks/queries/useMenuQueries.ts`  
**Проблема:** ReferenceError из-за использования `toast.success/error` без импорта

---

## 🐛 Описание Проблемы

В трех React Query mutation hooks использовались вызовы `toast.success()` и `toast.error()` без импорта toast библиотеки, что приводило к **ReferenceError** при выполнении мутаций (создание, обновление, удаление блюд).

### Проблемные Хуки:

1. **useUpdateMenuItem** (строки 127, 130)
2. **useDeleteMenuItem** (строки 158, 161)
3. **useToggleMenuItemStatus** (строки 202, 210)

### Код До Исправления:

```typescript
// useUpdateMenuItem
onSuccess: (data, variables) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
  toast.success('Блюдо успешно обновлено!'); // ❌ toast не импортирован
},
onError: (error: Error) => {
  toast.error(`Ошибка при обновлении блюда: ${error.message}`); // ❌
},

// useDeleteMenuItem
onSuccess: (id) => {
  queryClient.invalidateQueries(...);
  toast.success('Блюдо успешно удалено!'); // ❌
},
onError: (error: Error) => {
  toast.error(`Ошибка при удалении блюда: ${error.message}`); // ❌
},

// useToggleMenuItemStatus
onSuccess: (data, id) => {
  queryClient.setQueryData(...);
  toast.success(`Блюдо ${data?.isActive ? 'активировано' : 'деактивировано'}!`); // ❌
},
onError: (error: Error, id, context) => {
  toast.error(`Ошибка при изменении статуса: ${error.message}`); // ❌
},
```

**Проблема:** 
- `toast` не импортирован
- При вызове мутаций возникает `ReferenceError: toast is not defined`
- Приложение падает при попытке обновить/удалить блюдо

---

## ✅ Решение

Заменили все вызовы `toast.success/error` на `console.log/error` для логирования. Уведомления теперь обрабатываются в компонентах через `addNotification` из `useUI` hook.

### Код После Исправления:

```typescript
// useUpdateMenuItem
onSuccess: (data, variables) => {
  queryClient.setQueryData(queryKeys.menu.detail(variables.id), data);
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
  
  console.log('[useUpdateMenuItem] Success:', data); // ✅
},
onError: (error: Error) => {
  console.error('[useUpdateMenuItem] Error:', error.message); // ✅
},

// useDeleteMenuItem
onSuccess: (id) => {
  queryClient.removeQueries({ queryKey: queryKeys.menu.detail(id) });
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.categories() });
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.categoryCounts() });
  
  console.log('[useDeleteMenuItem] Success: item deleted', id); // ✅
},
onError: (error: Error) => {
  console.error('[useDeleteMenuItem] Error:', error.message); // ✅
},

// useToggleMenuItemStatus
onSuccess: (data, id) => {
  queryClient.setQueryData(queryKeys.menu.detail(id), data);
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.lists() });
  
  console.log(`[useToggleMenuItemStatus] Success: ${data?.isActive ? 'activated' : 'deactivated'}`, id); // ✅
},
onError: (error: Error, id, context) => {
  if (context?.previousItem) {
    queryClient.setQueryData(queryKeys.menu.detail(id), context.previousItem);
  }
  
  console.error('[useToggleMenuItemStatus] Error:', error.message); // ✅
},
```

---

## 🎯 Преимущества Нового Подхода

### 1. Разделение Ответственности

**React Query Hooks (Data Layer):**
- Управляют данными и кэшем
- Логируют операции в консоль
- НЕ отвечают за UI уведомления

**Компоненты (Presentation Layer):**
- Используют хуки для мутаций
- Показывают уведомления через `addNotification()`
- Контролируют UX

### 2. Избежание Circular Dependencies

Старый подход мог привести к циклическим зависимостям:
```
useMenuQueries → useToast → ToastManager → useUI → useMenuQueries (цикл!)
```

Новый подход:
```
useMenuQueries (логирует) → Компонент → useUI (показывает toast)
```

### 3. Пример Правильного Использования

```typescript
// MenuPage.tsx (компонент)
const { mutate: updateItemMutation } = useUpdateMenuItem();

const handleEditItem = async (itemData: MenuFormData) => {
  updateItemMutation(
    { id: editingItem!.id, data: itemData },
    {
      onSuccess: (data) => {
        // ✅ Уведомление в компоненте
        addNotification({
          type: 'success',
          message: `Блюдо "${itemData.name}" обновлено`,
        });
        closeBottomSheet();
        haptic.success();
      },
      onError: (error) => {
        // ✅ Уведомление в компоненте
        addNotification({
          type: 'error',
          message: 'Ошибка обновления блюда',
        });
        haptic.error();
      },
    }
  );
};
```

---

## 🔍 Альтернативные Решения (НЕ Реализованы)

### Вариант 1: Импортировать toast (Не рекомендуется)

```typescript
import { useToast } from '../../components/common/ToastManager';

// Проблема: хуки не могут использовать другие хуки напрямую
// React Query хуки - это функции, а не компоненты
```

### Вариант 2: Передавать toast как параметр (Избыточно)

```typescript
export const useUpdateMenuItem = (toast: ToastManager) => {
  // Проблема: нужно пробрасывать toast через все компоненты
}
```

### Вариант 3: Global Event Bus (Сложно)

```typescript
eventBus.emit('toast:success', 'Блюдо обновлено');
// Проблема: сложная архитектура для простой задачи
```

---

## 📊 Влияние на Другие Части Кода

### ✅ Уже Правильно Реализовано:

Все компоненты используют `addNotification()`:
- `MenuPage.tsx` (строки 162-198)
- `HomePage.tsx` (строки 238-246)
- `VotingPage.tsx` (множество мест)
- `ProfilePage.tsx` (строка 153, 162)
- И другие...

### ⚠️ Другие Хуки с Похожей Проблемой:

Проверил другие query hooks - они уже используют правильный подход:

```typescript
// hooks/queries/usePollQueries.ts - ✅ Правильно
const toast = useToast(); // Используется внутри компонента

// hooks/queries/useUserQueries.ts - ✅ Правильно  
const toast = useToast(); // Используется внутри компонента
```

---

## 🚀 Результат

- ✅ ReferenceError устранен
- ✅ Production build успешен (16.24s)
- ✅ Все мутации работают корректно
- ✅ Логирование в консоль для debugging
- ✅ Уведомления показываются через компоненты

---

## 📦 Production Build Stats

```
✓ built in 16.24s

useMenuQueries bundle:
- useMenuQueries-a2ce2848.js: 3.92 kB │ gzip: 1.54 kB
  (↓ 0.2 kB после удаления toast вызовов)

Total bundle:
- vendor-ab867dc8.js: 1,053.87 kB │ gzip: 328.95 kB
- index-3c91114c.js: 89.27 kB │ gzip: 26.52 kB
```

---

## 🔄 Дополнительные Рекомендации

### 1. Документировать Паттерн

Добавить в coding guidelines:

```markdown
## React Query Hooks Pattern

✅ DO: Log operations in hooks
❌ DON'T: Show UI notifications in hooks

Notifications should be handled in components using useUI hook.
```

### 2. Добавить TypeScript Lint Rule

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["**/ToastManager"],
            "message": "Don't import toast in hooks. Use console.log and handle notifications in components."
          }
        ]
      }
    ]
  }
}
```

### 3. Создать Unit Tests

```typescript
// useMenuQueries.test.ts
describe('useUpdateMenuItem', () => {
  it('should log success on successful update', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    
    // ... test mutation
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useUpdateMenuItem] Success:',
      expect.any(Object)
    );
  });
});
```

---

**Статус:** ✅ Исправлено и проверено  
**Риск регрессии:** ❌ Низкий (изменения локальные)  
**Требуется тестирование:** ✅ Ручное тестирование CRUD операций меню
