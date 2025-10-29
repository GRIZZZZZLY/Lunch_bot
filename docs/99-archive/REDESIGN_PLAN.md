# 🎨 План редизайна PollManagementPage

## ✅ Что уже сделано:

1. Обновлены импорты:
   - ✅ Button → shadcn/ui
   - ✅ GlassCard → shadcn/ui
   - ✅ MediumWaveGradient
   - ✅ Badge, ThemeToggle

## 🔄 Что нужно сделать:

### 1. Обновить основной return (строки 290-608)
- Заменить `<>` на структуру с MediumWaveGradient
- Обернуть в motion.div с анимациями
- Добавить container variants

### 2. Переделать Hero Card (строки ~300-320)
- Убрать старый GlassHeroCard
- Создать новый GlassCard с:
  - Gradient overlay (lavender/mint)
  - Иконка Vote (lavender градиент)
  - Статистика (3 колонки с цветами)
  - ThemeToggle

### 3. Обновить предупреждение (строки ~325-350)
- Обернуть в GlassCard
- Добавить border-l-4 border-yellow-500
- Использовать shadcn Button

### 4. Обновить секцию выбора группы (строки ~355-395)
- GlassCard с header
- Users иконка с lavender цветом

### 5. Обновить секцию времени (строки ~400-445)
- GlassCard с header
- Clock иконка
- Кнопки быстрого выбора с lavender акцентом

### 6. Обновить секцию блюд (строки ~450-550)
- GlassCard с header
- Карточки блюд с GlassCard intensity="low"
- Ring-2 ring-lavender-500 для выбранных
- CheckCircle2 с lavender градиентом

### 7. Обновить кнопку создания
- Фиксированная внизу
- Button variant="lavender" size="lg"

---

Это большая задача. Лучше создать отдельный файл с новой версией страницы, а затем заменить старую?
