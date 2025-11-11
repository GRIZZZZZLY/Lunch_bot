# Countdown Timer Implementation

**Дата:** 2025-11-10  
**Автор:** Claude (Factory AI)  
**Задача:** Замена статического текста "Live" на таймер обратного отсчёта в виджете голосования

---

## 📝 Описание изменений

Заменён статический текст "Live" в виджете активного голосования на **динамический таймер обратного отсчёта** до конца голосования.

### До:
```tsx
<span className="font-medium">Live</span>
```

### После:
```tsx
<CountdownBadge endTime={poll.endTime} />
// Отображает: "15:30", "2:45", "00:15" и т.д.
```

---

## 🎯 Мотивация

### Проблемы старой реализации:
1. ❌ Текст "Live" не информативен - не показывает, сколько времени осталось
2. ❌ Пользователь не знает, когда закончится голосование
3. ❌ Приходится переходить на VotingPage чтобы увидеть оставшееся время
4. ❌ Низкая engagement - пользователи забывают проголосовать

### Преимущества нового решения:
1. ✅ **Информативность** - пользователь сразу видит оставшееся время
2. ✅ **Urgency** - создаёт ощущение срочности, особенно когда осталось <1 минуты
3. ✅ **UX** - не нужно переходить на другую страницу для получения информации
4. ✅ **Engagement** - мотивирует проголосовать до истечения времени

---

## 🛠️ Технические детали

### 1. Создан новый хук `useCountdownTimer`

**Файл:** `frontend/src/hooks/useCountdownTimer.ts`

**Возможности:**
- Обратный отсчёт в реальном времени (обновление каждую секунду)
- Форматирование времени в "MM:SS" или "HH:MM:SS"
- Определение состояния: `isExpired`, `isLastMinute`
- Callback при истечении времени: `onExpire`
- Вычисление прогресса: `progress` (0-1)

**Пример использования:**
```tsx
const { formattedTime, isLastMinute, isExpired } = useCountdownTimer(poll.endTime);

return (
  <div className={isLastMinute ? 'text-red-500' : 'text-mint-600'}>
    {isExpired ? 'Завершено' : formattedTime}
  </div>
);
```

### 2. Создан компонент `CountdownBadge`

**Файл:** `frontend/src/components/voting/InlineVotingCard.tsx` (внутренний компонент)

**Особенности:**
- 🟢 **Нормальный режим** (>1 минуты):
  - Цвет: mint-600 (зелёный)
  - Иконка: Clock (статичная)
  - Анимация: нет
  
- 🔴 **Режим срочности** (<1 минуты):
  - Цвет: red-500 (красный)
  - Иконка: Clock (с pulse анимацией)
  - Анимация: scale pulse (1 → 1.05 → 1)
  
- ⚫ **Завершено**:
  - Цвет: gray-400 (серый)
  - Текст: "Завершено"

**Код:**
```tsx
const CountdownBadge: React.FC<{ endTime: string | Date }> = ({ endTime }) => {
  const { formattedTime, isLastMinute, isExpired } = useCountdownTimer(endTime);

  if (isExpired) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        <span className="font-medium">Завершено</span>
      </div>
    );
  }

  return (
    <motion.div
      animate={isLastMinute ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        isLastMinute
          ? "text-red-500 dark:text-red-400"
          : "text-mint-600 dark:text-mint-400"
      )}
    >
      <Clock className={cn("w-3 h-3", isLastMinute && "animate-pulse")} />
      <span>{formattedTime}</span>
    </motion.div>
  );
};
```

### 3. Обновлён InlineVotingCard

**Изменения:**
```diff
- {/* P1: Live Updates Badge */}
- {poll.status === 'ACTIVE' && (
-   <motion.div ...>
-     <div className="w-2 h-2 bg-mint-500 rounded-full animate-pulse" />
-     <span className="font-medium">Live</span>
-   </motion.div>
- )}
+ {/* P1: Countdown Timer Badge */}
+ {poll.status === 'ACTIVE' && <CountdownBadge endTime={poll.endTime} />}
```

---

## 📊 Форматы отображения времени

| Оставшееся время | Формат | Цвет | Анимация |
|------------------|--------|------|----------|
| 2+ часа | `2:30:15` | 🟢 Зелёный | Нет |
| 1+ час | `1:45:30` | 🟢 Зелёный | Нет |
| 15+ минут | `15:30` | 🟢 Зелёный | Нет |
| 2-15 минут | `5:45` | 🟢 Зелёный | Нет |
| <1 минута | `0:45` | 🔴 Красный | Scale pulse + icon pulse |
| Завершено | `Завершено` | ⚫ Серый | Нет |

---

## 🎨 UX паттерны

### 1. Visual Hierarchy
- Таймер находится в верхней части карточки рядом с количеством голосов
- Увеличенный размер шрифта для лучшей видимости
- Контрастные цвета для привлечения внимания

### 2. Urgency Indicators
- **Цветовая кодировка:**
  - Зелёный: "Всё хорошо, время есть"
  - Красный: "Срочно! Осталось мало времени"
  - Серый: "Уже поздно, голосование завершено"

- **Анимация:**
  - Нормальное состояние: статичный
  - Последняя минута: пульсирующий scale + иконка pulse
  - Завершено: статичный

### 3. Information Scent
- Пользователь сразу видит точное время до конца
- Не нужно гадать или переходить на другую страницу
- Ясное понимание срочности действия

---

## 🧪 Тестирование

### Ручное тестирование:

1. **Создать голосование на 30 минут:**
   ```
   Ожидаемо: таймер показывает "30:00", цвет зелёный
   ```

2. **Подождать 28 минут:**
   ```
   Ожидаемо: таймер показывает "2:00", цвет зелёный
   ```

3. **Подождать до последней минуты:**
   ```
   Ожидаемо: таймер показывает "0:59", цвет красный, анимация пульсации
   ```

4. **Дождаться окончания:**
   ```
   Ожидаемо: таймер показывает "Завершено", цвет серый
   ```

### Автоматическое тестирование (TODO):

```tsx
describe('useCountdownTimer', () => {
  it('should format time correctly', () => {
    const { result } = renderHook(() => 
      useCountdownTimer(new Date(Date.now() + 90000))
    );
    expect(result.current.formattedTime).toBe('1:30');
  });

  it('should detect last minute', () => {
    const { result } = renderHook(() => 
      useCountdownTimer(new Date(Date.now() + 45000))
    );
    expect(result.current.isLastMinute).toBe(true);
  });

  it('should call onExpire when time runs out', () => {
    const onExpire = jest.fn();
    renderHook(() => 
      useCountdownTimer(new Date(Date.now() - 1000), { onExpire })
    );
    expect(onExpire).toHaveBeenCalled();
  });
});
```

---

## 📈 Метрики для отслеживания

После внедрения рекомендуется отследить:

1. **Conversion Rate** - изменение % проголосовавших пользователей
2. **Time to Vote** - изменение среднего времени до первого голоса
3. **Late Votes** - количество голосов в последние 5 минут (должно вырасти)
4. **Bounce Rate** - уменьшение % пользователей покидающих страницу без голосования

---

## 🔄 Возможные улучшения (Future)

1. **Прогресс-бар:**
   ```tsx
   <div className="w-full h-1 bg-gray-200 rounded-full">
     <div 
       className="h-full bg-mint-500 rounded-full transition-all"
       style={{ width: `${(1 - progress) * 100}%` }}
     />
   </div>
   ```

2. **Звуковое уведомление:**
   ```tsx
   useEffect(() => {
     if (remainingSeconds === 60) {
       playSound('reminder');
     }
   }, [remainingSeconds]);
   ```

3. **Push notification:**
   ```tsx
   useEffect(() => {
     if (remainingSeconds === 300) { // 5 минут
       sendNotification('Осталось 5 минут!');
     }
   }, [remainingSeconds]);
   ```

4. **Точный прогресс (требует startTime):**
   ```tsx
   const totalDuration = endTime - startTime;
   const elapsed = Date.now() - startTime;
   const progress = elapsed / totalDuration; // 0-1
   ```

---

## ✅ Checklist

- [x] Создан хук `useCountdownTimer`
- [x] Создан компонент `CountdownBadge`
- [x] Заменён "Live" в `InlineVotingCard`
- [x] Добавлена цветовая кодировка (зелёный/красный/серый)
- [x] Добавлена анимация для последней минуты
- [x] Проверена компиляция TypeScript
- [x] Сборка прошла успешно
- [ ] Ручное тестирование в dev режиме
- [ ] Автоматические тесты для хука
- [ ] Обновление документации (DONE)

---

## 📝 Related Files

- `frontend/src/hooks/useCountdownTimer.ts` - основной хук
- `frontend/src/components/voting/InlineVotingCard.tsx` - компонент бейджа
- `frontend/src/pages/HomePage.tsx` - использование InlineVotingCard

---

## 🎓 Lessons Learned

1. ✅ **Framer Motion** отлично подходит для subtle анимаций (scale pulse)
2. ✅ **useEffect cleanup** важен для таймеров (clearInterval)
3. ✅ **Цветовая кодировка** эффективна для передачи urgency
4. ✅ **Inline компоненты** удобны для small, related UI элементов

---

**Status:** ✅ Completed  
**Last Updated:** 2025-11-10  
**Next Steps:** Ручное тестирование + сбор метрик
