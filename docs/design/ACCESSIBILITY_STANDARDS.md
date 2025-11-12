# ♿ ACCESSIBILITY STANDARDS

Стандарты доступности (WCAG 2.1 Level AA)

---

## 1. COLOR CONTRAST

### 1.1 WCAG Требования

**Level AA (минимум):**
- Обычный текст: **4.5:1** контраст
- Крупный текст (18px+ или 14px+ bold): **3:1** контраст
- UI компоненты: **3:1** контраст

**Level AAA (рекомендуется):**
- Обычный текст: **7:1** контраст
- Крупный текст: **4.5:1** контраст

---

### 1.2 Проверенные комбинации

#### Light Mode

| Текст | Фон | Контраст | WCAG |
|-------|-----|----------|------|
| gray-900 (#1C1917) | white (#FFFFFF) | **15.8:1** | AAA ✅ |
| gray-700 (#44403C) | white (#FFFFFF) | **10.4:1** | AAA ✅ |
| gray-600 (#57534E) | white (#FFFFFF) | **7.8:1** | AAA ✅ |
| gray-500 (#78716C) | white (#FFFFFF) | **4.9:1** | AA ✅ |
| orange-600 (#EA580C) | white (#FFFFFF) | **4.8:1** | AA ✅ |
| orange-500 (#FF8F4F) | white (#FFFFFF) | **3.2:1** | ⚠️ Только для крупного текста |

#### Dark Mode

| Текст | Фон | Контраст | WCAG |
|-------|-----|----------|------|
| white (#FFFFFF) | gray-900 (#1C1917) | **15.8:1** | AAA ✅ |
| gray-100 (#F5F5F4) | gray-900 (#1C1917) | **13.2:1** | AAA ✅ |
| gray-200 (#E7E5E4) | gray-800 (#292524) | **9.7:1** | AAA ✅ |
| gray-300 (#D6D3D1) | gray-800 (#292524) | **7.4:1** | AAA ✅ |
| orange-400 (#FB923C) | gray-900 (#1C1917) | **5.2:1** | AA ✅ |

---

### 1.3 Правила применения

**DO ✅**
```tsx
{/* Основной текст */}
<p className="text-gray-700 dark:text-gray-200">
  Контраст 10.4:1 (light) и 9.7:1 (dark) - AAA
</p>

{/* Заголовки */}
<h1 className="text-gray-900 dark:text-white">
  Максимальный контраст 15.8:1 - AAA
</h1>
```

**DON'T ❌**
```tsx
{/* Orange-500 на white - только 3.2:1 */}
<p className="text-orange-500">
  Плохой контраст для body текста!
</p>

{/* Исправление: используйте orange-600 или крупнее текст */}
<p className="text-orange-600 text-lg font-semibold">
  Крупный текст позволяет 3:1 контраст
</p>
```

---

### 1.4 Инструменты проверки

**Online:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Contrast Ratio](https://contrast-ratio.com/)
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)

**Browser Extensions:**
- axe DevTools (Chrome/Firefox)
- WAVE Evaluation Tool
- Accessibility Insights

**Command line:**
```bash
npm install -g a11y
a11y https://your-site.com
```

---

## 2. KEYBOARD NAVIGATION

### 2.1 Tab Order

**Все интерактивные элементы должны быть доступны через Tab:**

```tsx
{/* Правильный HTML семантик = правильный tab order */}
<button>Первая кнопка</button>  {/* Tab 1 */}
<a href="/link">Ссылка</a>      {/* Tab 2 */}
<input type="text" />           {/* Tab 3 */}
```

**Skip Links для длинных страниц:**
```tsx
<a 
  href="#main-content" 
  className="
    sr-only 
    focus:not-sr-only 
    focus:absolute 
    focus:top-4 
    focus:left-4
    focus:z-50
    focus:bg-orange-500 
    focus:text-white 
    focus:px-4 
    focus:py-2
    focus:rounded
  "
>
  Перейти к основному контенту
</a>

<main id="main-content">
  {/* Контент */}
</main>
```

---

### 2.2 Focus States

**Все интерактивные элементы ОБЯЗАНЫ иметь focus ring:**

```tsx
{/* Кнопки */}
<button className="
  focus:ring-2 
  focus:ring-orange-500 
  focus:ring-offset-2
  focus:outline-none
">

{/* Ссылки */}
<a className="
  focus:ring-2 
  focus:ring-orange-500 
  focus:ring-offset-2
  focus:outline-none
  rounded
">

{/* Inputs */}
<input className="
  focus:ring-2 
  focus:ring-orange-500 
  focus:ring-offset-2
  focus:border-orange-500
  focus:outline-none
" />
```

**НИКОГДА не делайте:**
```css
/* ❌ ПЛОХО */
*:focus {
  outline: none;
}

/* ✅ ХОРОШО - используйте кастомный focus ring */
*:focus {
  outline: none;
}
*:focus-visible {
  ring: 2px solid orange;
  ring-offset: 2px;
}
```

---

### 2.3 Keyboard Shortcuts

**Обязательные shortcuts:**

| Клавиша | Действие |
|---------|----------|
| **Tab** | Следующий элемент |
| **Shift+Tab** | Предыдущий элемент |
| **Enter** | Активировать кнопку/ссылку |
| **Space** | Активировать кнопку, toggle checkbox |
| **Escape** | Закрыть modal/dropdown |
| **Arrow keys** | Навигация в списках/меню |

**Пример реализации:**
```tsx
function Modal({ isOpen, onClose }) {
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  return (
    <div role="dialog" aria-modal="true">
      {/* Modal content */}
    </div>
  );
}
```

---

## 3. SCREEN READERS

### 3.1 Semantic HTML

**Используйте правильные HTML теги:**

```tsx
{/* ✅ ПРАВИЛЬНО */}
<button onClick={handleClick}>Нажми меня</button>
<nav>
  <ul>
    <li><a href="/">Главная</a></li>
  </ul>
</nav>

{/* ❌ НЕПРАВИЛЬНО */}
<div onClick={handleClick}>Нажми меня</div>  {/* Не кликабельно для screen reader */}
<div>
  <div><div onClick={...}>Главная</div></div>  {/* Нет семантики */}
</div>
```

---

### 3.2 ARIA Labels

**Когда использовать:**
- Визуальный контекст понятен зрячим, но не screen reader
- Иконки без текста
- Сложные компоненты

```tsx
{/* Icon buttons ОБЯЗАТЕЛЬНО нужен aria-label */}
<button 
  aria-label="Закрыть модальное окно"
  onClick={onClose}
>
  <XIcon className="w-6 h-6" />
</button>

{/* Links с только иконкой */}
<a 
  href="/settings" 
  aria-label="Открыть настройки"
>
  <SettingsIcon />
</a>

{/* Для декоративных иконок */}
<svg aria-hidden="true">
  {/* Декоративная иконка */}
</svg>
```

---

### 3.3 ARIA Live Regions

**Для динамического контента (уведомления, обновления):**

```tsx
{/* Polite - не прерывает чтение */}
<div 
  role="status" 
  aria-live="polite"
  className="sr-only"
>
  {votes} голосов получено
</div>

{/* Assertive - прерывает чтение (только для критичного) */}
<div 
  role="alert" 
  aria-live="assertive"
  className="sr-only"
>
  Ошибка! Голосование не засчитано
</div>
```

---

### 3.4 ARIA Expanded/Pressed

**Для toggleable элементов:**

```tsx
{/* Dropdown */}
<button
  aria-expanded={isOpen}
  aria-haspopup="true"
  onClick={() => setIsOpen(!isOpen)}
>
  Меню
</button>

{/* Toggle button */}
<button
  aria-pressed={isActive}
  onClick={() => setIsActive(!isActive)}
>
  {isActive ? 'Отключить' : 'Включить'}
</button>
```

---

### 3.5 Visually Hidden (sr-only)

**Для контента, видимого только screen readers:**

```tsx
{/* Tailwind класс sr-only */}
<span className="sr-only">
  Текущая страница:
</span>
<span aria-current="page">Главная</span>

{/* Custom CSS */}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 4. TOUCH TARGETS

### 4.1 Минимальные размеры

**WCAG 2.1 Success Criterion 2.5.5:**
- Минимум **44px × 44px** для touch targets
- Рекомендуется **48px × 48px**

```tsx
{/* ✅ ПРАВИЛЬНО */}
<button className="min-h-[44px] min-w-[44px] px-6 py-3">
  Кнопка
</button>

{/* ❌ НЕПРАВИЛЬНО */}
<button className="px-2 py-1">  {/* < 44px */}
  Маленькая кнопка
</button>
```

---

### 4.2 Spacing между targets

**Минимум 8px между соседними интерактивными элементами:**

```tsx
{/* ✅ ПРАВИЛЬНО */}
<div className="flex gap-3">  {/* 12px между кнопками */}
  <button>Кнопка 1</button>
  <button>Кнопка 2</button>
</div>

{/* ❌ НЕПРАВИЛЬНО */}
<div className="flex gap-1">  {/* 4px - слишком мало */}
  <button>Кнопка 1</button>
  <button>Кнопка 2</button>
</div>
```

---

## 5. FORMS

### 5.1 Labels для всех inputs

```tsx
{/* ✅ ПРАВИЛЬНО - явный label */}
<label htmlFor="email" className="block mb-2">
  Email
</label>
<input 
  id="email" 
  type="email" 
  name="email"
/>

{/* ✅ ПРАВИЛЬНО - неявный label */}
<label className="block">
  Email
  <input type="email" name="email" />
</label>

{/* ❌ НЕПРАВИЛЬНО - нет label */}
<input type="email" placeholder="Email" />  {/* Placeholder не заменяет label! */}
```

---

### 5.2 Error Messages

```tsx
{/* Связать ошибку с input через aria-describedby */}
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <p 
    id="email-error" 
    role="alert"
    className="text-red-500 text-sm mt-1"
  >
    Введите корректный email
  </p>
)}
```

---

### 5.3 Required Fields

```tsx
{/* Обозначить обязательные поля */}
<label htmlFor="name">
  Имя
  <span className="text-red-500" aria-label="обязательное поле">
    *
  </span>
</label>
<input 
  id="name" 
  required 
  aria-required="true"
/>
```

---

## 6. MEDIA

### 6.1 Images

```tsx
{/* Декоративное изображение */}
<img src="/decoration.png" alt="" role="presentation" />

{/* Информативное изображение */}
<img 
  src="/chart.png" 
  alt="График роста продаж за 2024 год: увеличение на 35%"
/>

{/* Сложное изображение с описанием */}
<figure>
  <img 
    src="/diagram.png" 
    alt="Диаграмма архитектуры системы"
    aria-describedby="diagram-desc"
  />
  <figcaption id="diagram-desc">
    Детальное описание: Frontend подключается к API через...
  </figcaption>
</figure>
```

---

### 6.2 Icons

```tsx
{/* Декоративная иконка (дублирует текст) */}
<button>
  <CheckIcon aria-hidden="true" />
  Сохранить
</button>

{/* Иконка БЕЗ текста - ОБЯЗАТЕЛЕН aria-label */}
<button aria-label="Удалить">
  <TrashIcon />
</button>
```

---

## 7. MOTION И АНИМАЦИИ

### 7.1 Prefers Reduced Motion

**Уважайте предпочтения пользователей:**

```css
/* Global disable для пользователей с motion sensitivity */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**В компонентах:**
```tsx
<div className="
  transition-transform duration-300
  motion-reduce:transition-none
  motion-reduce:transform-none
">
```

---

### 7.2 Автоплей контента

**Не автоплейте видео/анимации более 5 секунд без контролов:**

```tsx
{/* ✅ ПРАВИЛЬНО */}
<video controls>
  <source src="/video.mp4" />
</video>

{/* ❌ НЕПРАВИЛЬНО */}
<video autoPlay loop>  {/* Нет способа остановить */}
  <source src="/video.mp4" />
</video>
```

---

## 8. ТЕСТИРОВАНИЕ

### 8.1 Automated Testing

**Инструменты:**
```bash
# axe-core (в CI/CD)
npm install --save-dev @axe-core/react
npm install --save-dev jest-axe

# В тестах
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<App />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

### 8.2 Manual Testing Checklist

**Keyboard Navigation:**
- [ ] Можно пройти весь интерфейс через Tab
- [ ] Видны focus rings на всех элементах
- [ ] Enter/Space активируют кнопки
- [ ] Escape закрывает модалы
- [ ] Arrow keys работают в списках

**Screen Reader:**
- [ ] VoiceOver (Mac): Cmd+F5, Command+Option+стрелки
- [ ] NVDA (Windows): тестирование с закрытыми глазами
- [ ] Все элементы имеют осмысленные labels
- [ ] Уведомления читаются (aria-live)

**Color Contrast:**
- [ ] Весь текст проверен через WebAIM Checker
- [ ] UI элементы минимум 3:1
- [ ] Не используется только цвет для передачи смысла

**Touch Targets:**
- [ ] Все кнопки минимум 44px
- [ ] Расстояние между targets минимум 8px
- [ ] Тест на реальном mobile устройстве

**Forms:**
- [ ] Все inputs имеют labels
- [ ] Error messages связаны через aria-describedby
- [ ] Required fields обозначены

---

### 8.3 Браузерные DevTools

**Chrome Lighthouse:**
```
1. Открыть DevTools (F12)
2. Lighthouse tab
3. Выбрать "Accessibility"
4. Run audit
5. Цель: 100/100
```

**axe DevTools Extension:**
```
1. Установить расширение
2. Открыть DevTools
3. axe DevTools tab
4. Scan All
5. Исправить найденные issues
```

---

## 9. WCAG QUICK REFERENCE

### Level A (Базовый)

- **1.1.1** - Нетекстовый контент имеет alt
- **2.1.1** - Keyboard доступ ко всем функциям
- **3.3.1** - Идентификация ошибок
- **4.1.2** - Name, Role, Value для всех UI

### Level AA (Стандарт)

- **1.4.3** - Контраст 4.5:1 (3:1 для крупного)
- **2.4.7** - Видимый keyboard focus
- **3.2.4** - Согласованная навигация
- **4.1.3** - Status messages (aria-live)

### Level AAA (Расширенный)

- **1.4.6** - Контраст 7:1 (4.5:1 для крупного)
- **2.4.8** - Текущее местоположение
- **2.5.5** - Минимум 44px touch targets

---

## 10. ACCESSIBILITY STATEMENT

**Добавьте на сайт statement о доступности:**

```markdown
## Доступность

Мы стремимся сделать Telegram Food Bot доступным для всех пользователей.

### Соответствие стандартам
- WCAG 2.1 Level AA
- Section 508
- EN 301 549

### Функции доступности
✅ Keyboard navigation
✅ Screen reader support
✅ Высокий контраст текста (10:1+)
✅ Touch targets 44px+
✅ Уважение prefers-reduced-motion

### Обратная связь
Если вы столкнулись с проблемами доступности, свяжитесь с нами:
- Email: support@example.com
- Telegram: @support_bot

Мы ответим в течение 48 часов.

**Последнее обновление:** 2025-01-12
```

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — Цвета с проверенным контрастом
- [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) — Accessible компоненты
- [DESIGN_ROADMAP.md](./DESIGN_ROADMAP.md) — План реализации

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

**Официальные стандарты:**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

**Инструменты:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Pa11y](https://pa11y.org/) - Automated testing

**Обучение:**
- [Web Accessibility by Google](https://www.udacity.com/course/web-accessibility--ud891) - Free course
- [A11ycasts on YouTube](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)

---

**Last updated:** 2025-01-12
