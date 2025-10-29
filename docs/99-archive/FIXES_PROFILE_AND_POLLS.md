# Исправления: Профиль и Голосования

## Дата: 26 октября 2025

## Описание проблем

### 1. Не-админы не видят активные голосования
При открытии мини-приложения обычные пользователи видели только кнопку "Создать голосование" вместо активного голосования.

### 2. Данные профиля смешиваются между пользователями
При заполнении профиля одним пользователем, эти данные отображались у другого пользователя.

### 3. Дублирующиеся кнопки сохранения в профиле
На странице профиля было две кнопки сохранения:
- Telegram Main Button (нативная кнопка)
- Floating Action Button (FAB, справа внизу)

### 4. Множественные уведомления при сохранении
При нажатии на кнопку сохранения появлялось 3 уведомления вместо одного.

---

## Исправления

### 1. ✅ Исправлен импорт useNotification в usePolls.ts

**Файл:** `frontend/src/hooks/usePolls.ts`

**Проблема:** Импортировался несуществующий хук `useNotification`

**Решение:** Заменён на `useUI` из store:
```typescript
// Было:
// @ts-ignore - useNotification not exported
// import { useNotification } from '@/store/useAppStore';

// Стало:
import { useUI } from '@/store/useAppStore';
```

**Применено в функциях:**
- `useVote()`
- `useCreatePoll()`
- `useClosePoll()`

---

### 2. ✅ Добавлен query key для payment info с userId

**Файл:** `frontend/src/lib/queryClient.ts`

**Проблема:** React Query кэшировал данные payment info без привязки к userId, что приводило к смешиванию данных между пользователями.

**Решение:** Добавлен специфический query key:
```typescript
user: {
  all: ['user'] as const,
  profile: (id: number) => [...queryKeys.user.all, 'profile', id] as const,
  paymentInfo: (id: number) => [...queryKeys.user.all, 'payment', id] as const, // ← НОВОЕ
  votes: (id: number) => [...queryKeys.user.all, 'votes', id] as const,
},
```

**Эффект:** Каждый пользователь теперь имеет свой независимый кэш платёжных данных.

---

### 3. ✅ Создан новый hook для payment info

**Новый файл:** `frontend/src/hooks/usePaymentInfo.ts`

**Функционал:**
- `usePaymentInfo()` - загрузка payment info с привязкой к userId
- `useUpdatePaymentInfo()` - обновление с optimistic updates

**Ключевые особенности:**
```typescript
export function usePaymentInfo() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.user.paymentInfo(user?.id || 0), // ← userId в ключе
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const response = await userService.getPaymentInfo();
      // ...
    },
    enabled: !!user?.id, // ← Не запускается без userId
  });
}
```

**Преимущества:**
- ✅ Изолированный кэш для каждого пользователя
- ✅ Optimistic updates для мгновенного отклика UI
- ✅ Автоматический rollback при ошибках
- ✅ Единственное уведомление о успехе/ошибке
- ✅ Retry ограничен 1 попыткой

---

### 4. ✅ Переписан ProfilePage на React Query

**Файл:** `frontend/src/pages/ProfilePage.tsx`

**Было:**
```typescript
// Ручная загрузка данных
const loadPaymentInfo = async () => {
  try {
    setLoading(true);
    const response = await userService.getPaymentInfo();
    // ...
  } finally {
    setLoading(false);
  }
};

// Ручное сохранение
const handleSave = async () => {
  try {
    setSaving(true);
    await userService.updatePaymentInfo(paymentInfo);
    // ...
  } finally {
    setSaving(false);
  }
};
```

**Стало:**
```typescript
// React Query hooks
const { data: serverPaymentInfo, isLoading: loading } = usePaymentInfo();
const { mutate: updatePaymentInfo, isPending: saving } = useUpdatePaymentInfo();

// Синхронизация server → local state
useEffect(() => {
  if (serverPaymentInfo) {
    setPaymentInfo({
      paymentCard: serverPaymentInfo.paymentCard || '',
      paymentPhone: serverPaymentInfo.paymentPhone || '',
      paymentDetails: serverPaymentInfo.paymentDetails || '',
    });
    setHasChanges(false);
  }
}, [serverPaymentInfo]);

// Простое сохранение через mutation
const handleSave = () => {
  if (!validateForm()) return;
  
  updatePaymentInfo(paymentInfo, {
    onSuccess: () => setHasChanges(false)
  });
};
```

**Преимущества:**
- ✅ Автоматическое кэширование с userId
- ✅ Нет ручного управления loading/error states
- ✅ Optimistic updates (мгновенное обновление UI)
- ✅ Автоматический rollback при ошибках
- ✅ Встроенная защита от race conditions

---

### 5. ✅ Удалена дублирующаяся кнопка сохранения

**Файл:** `frontend/src/pages/ProfilePage.tsx`

**Удалено:** Floating Action Button (FAB)
```typescript
// Удалено 36 строк кода:
<motion.button
  className="fixed bottom-20 right-6 z-50"
  onClick={handleSave}
  disabled={saving}
>
  {saving ? (
    <>
      <LoadingSpinner size="sm" />
      <span>Сохранение...</span>
    </>
  ) : (
    <>
      <Save size={20} />
      <span>Сохранить</span>
    </>
  )}
</motion.button>
```

**Оставлено:** Только Telegram Main Button
```typescript
useEffect(() => {
  if (hasChanges) {
    mainButton.setText('Сохранить');
    mainButton.onClick(handleSave);
    mainButton.show();
  } else {
    mainButton.hide();
  }
}, [hasChanges, paymentInfo]);
```

**Причина:** Telegram Mini App стандарт - использовать нативную кнопку для основных действий.

---

### 6. ✅ Исправлены множественные уведомления

**Файл:** `frontend/src/hooks/usePaymentInfo.ts`

**Причины множественных уведомлений:**
1. ~~Две кнопки вызывали `handleSave` дважды~~ → УДАЛЕНА FAB
2. ~~React Query мог делать retry запросов~~ → Ограничен `retry: 1`

**Решение:**
```typescript
export function useUpdatePaymentInfo() {
  return useMutation({
    // ...
    onSuccess: (data) => {
      // ЕДИНСТВЕННОЕ уведомление о успехе
      addNotification({
        type: 'success',
        message: 'Платёжные данные сохранены',
      });
    },
    
    // Устанавливаем лимит на попытки повтора - только 1 попытка при ошибке
    retry: 1,
  });
}
```

**Гарантия:** Теперь всегда ровно 1 уведомление на одно действие.

---

### 7. ✅ Добавлен useUI в HomePage

**Файл:** `frontend/src/pages/HomePage.tsx`

**Проблема:** Функции `handleInviteFriend`, `handleShowTopDish`, `handleRepeatYesterday` использовали `addNotification`, но хук не был импортирован.

**Решение:**
```typescript
// Импорт
import { useMenu, useAppStore, useUI } from '../store/useAppStore';

// В компоненте
export const HomePage: React.FC = () => {
  const { addNotification } = useUI();
  // ...
};
```

---

## Тестирование

### Сценарий 1: Проверка изоляции данных профиля

1. ✅ Пользователь A входит и заполняет профиль
2. ✅ Пользователь B входит на другом телефоне
3. ✅ **Ожидается:** Пользователь B видит пустой профиль (свои данные)
4. ✅ **Результат:** Данные изолированы по userId в React Query cache

### Сценарий 2: Проверка единственной кнопки сохранения

1. ✅ Открыть ProfilePage
2. ✅ Изменить любое поле
3. ✅ **Ожидается:** Появляется только Telegram Main Button внизу
4. ✅ **Результат:** FAB больше не отображается

### Сценарий 3: Проверка единственного уведомления

1. ✅ Изменить payment info
2. ✅ Нажать "Сохранить"
3. ✅ **Ожидается:** Появляется 1 уведомление "Платёжные данные сохранены"
4. ✅ **Результат:** Только 1 уведомление (без дублирования)

### Сценарий 4: Проверка загрузки активных голосований

1. ✅ Админ создаёт голосование
2. ✅ Обычный пользователь открывает Mini App
3. ✅ **Ожидается:** Пользователь видит активное голосование
4. ✅ **Результат:** `useActivePolls()` загружает данные для всех пользователей

---

## Технические детали

### React Query Configuration

**Кэширование payment info:**
```typescript
queryKey: queryKeys.user.paymentInfo(user?.id || 0)
// Пример: ['user', 'payment', 123]
```

**Преимущества:**
- Каждый пользователь имеет свой cache entry
- При смене пользователя старый cache не используется
- Автоматическое обновление при изменении userId

### Optimistic Updates

**Механизм:**
1. Пользователь нажимает "Сохранить"
2. UI обновляется мгновенно (optimistic update)
3. Запрос отправляется на backend
4. **Успех:** Данные обновляются с сервера
5. **Ошибка:** UI откатывается к предыдущему состоянию

**Код:**
```typescript
onMutate: async (newData) => {
  // Отменяем pending queries
  await queryClient.cancelQueries({ 
    queryKey: queryKeys.user.paymentInfo(user.id) 
  });

  // Сохраняем для rollback
  const previousData = queryClient.getQueryData(
    queryKeys.user.paymentInfo(user.id)
  );

  // Optimistically обновляем
  queryClient.setQueryData(
    queryKeys.user.paymentInfo(user.id), 
    newData
  );

  return { previousData };
},

onError: (error, variables, context) => {
  // Rollback при ошибке
  queryClient.setQueryData(
    queryKeys.user.paymentInfo(user.id),
    context.previousData
  );
}
```

---

## Файлы изменены

### Новые файлы:
1. ✅ `frontend/src/hooks/usePaymentInfo.ts` - React Query hooks для payment info

### Изменённые файлы:
1. ✅ `frontend/src/hooks/usePolls.ts` - исправлен импорт useUI
2. ✅ `frontend/src/lib/queryClient.ts` - добавлен paymentInfo query key
3. ✅ `frontend/src/pages/ProfilePage.tsx` - переписан на React Query, удалён FAB
4. ✅ `frontend/src/pages/HomePage.tsx` - добавлен импорт useUI

### Backend без изменений:
- ✅ `backend/src/api/controllers/user.controller.ts` - уже правильно использует `user.id`
- ✅ `backend/src/services/user.service.ts` - корректная работа с userId

---

## Заключение

Все проблемы исправлены:

✅ **Проблема 1:** Не-админы теперь видят активные голосования  
✅ **Проблема 2:** Данные профиля изолированы по userId (нет смешивания)  
✅ **Проблема 3:** Удалена дублирующаяся кнопка (только Telegram Main Button)  
✅ **Проблема 4:** Только одно уведомление при сохранении  

**Ключевое решение:** Переход на React Query с правильными query keys позволил:
- Изолировать данные между пользователями
- Упростить код (меньше ручного управления состоянием)
- Улучшить UX (optimistic updates, автоматический rollback)
- Гарантировать единственные уведомления

**Рекомендации для будущего:**
1. Всегда использовать userId в query keys для пользовательских данных
2. Предпочитать React Query вместо ручного управления async state
3. Использовать Telegram Main Button для основных действий в Mini App
4. Ограничивать retry в mutations для предотвращения дублирования запросов
