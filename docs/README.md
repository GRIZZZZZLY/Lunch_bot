# 📚 Документация проекта Telegram Food Bot

Добро пожаловать в документацию! Здесь вы найдете всю информацию о проекте.

---

## 🚀 Быстрый старт

### Для продолжения работы над фронтендом:
1. 📖 **[FRONTEND_QUICK_REFERENCE.md](./FRONTEND_QUICK_REFERENCE.md)** - Краткая справка (начни отсюда!)
2. 📋 **[FRONTEND_CURRENT_STATE.md](./FRONTEND_CURRENT_STATE.md)** - Полное описание текущего состояния
3. 📝 **[SESSION_CHANGES_2025-10-07.md](./SESSION_CHANGES_2025-10-07.md)** - Что было сделано в последней сессии
4. ⭐ **[QUICK_ACTIONS_SPEC.md](./QUICK_ACTIONS_SPEC.md)** - Спецификация Quick Actions v2.0 (в работе)

### Для понимания истории проекта:
4. 🎨 **[FRONTEND_REDESIGN_PROGRESS.md](./FRONTEND_REDESIGN_PROGRESS.md)** - История редизайна (все фазы)
5. ✅ **[HOW_TO_ACTIVATE_NEW_HOMEPAGE.md](./HOW_TO_ACTIVATE_NEW_HOMEPAGE.md)** - Как активировать новую версию

---

## 📂 Структура документации

### 📁 01-getting-started/
Документы для быстрого старта:
- `FRONTEND_QUICK_START.md` - Быстрый старт с фронтендом

### 📁 02-development/
Руководства по разработке:
- `ADD_APP_COMMAND.md` - Добавление команд бота
- `DEBUG_LOGS_GUIDE.md` - Отладка
- `DEV_MODE.md` - Режим разработки
- `QUICK_DEBUG.md` - Быстрая отладка

### 📁 03-architecture/
Архитектура проекта:
- `PROJECT_PLAN_V1.md` - Общий план проекта

### 📁 04-deployment/
Деплой и продакшен:
- `NGROK_RESTART_GUIDE.md` - Работа с ngrok
- `PRODUCTION_BUILD_GUIDE.md` - Билд для продакшена
- `SETUP_GITHUB.md` - Настройка GitHub
- `TIMEWEB_DEPLOY.md` - Деплой на Timeweb

### 📁 05-testing/
Тестирование:
- `TESTING_GUIDE_DETAILED.md` - Подробное руководство по тестированию

### 📁 archive/
Архив старых документов

---

## 🎯 Текущий статус проекта

### Фронтенд: ✅ v2.0 - Полный редизайн завершен
- ✅ Glassmorphism дизайн
- ✅ Динамическая цветовая палитра (peach, mint, lavender, coral, butter)
- ✅ Темная и светлая темы
- ✅ HomePage полностью обновлена
- ✅ DonationBar (swipeable notification)
- ✅ Модалка донатов обновлена
- 🚧 Quick Actions v2.0 (в работе - см. QUICK_ACTIONS_SPEC.md)
- ⏳ Остальные страницы ждут обновления

### Бэкенд: ✅ Работает
- ✅ Prisma ORM
- ✅ API готов
- ✅ Авторизация

---

## 🛠️ Технологии

### Frontend:
- **React** + TypeScript
- **Vite** - build tool
- **Tailwind CSS** - стилизация
- **Framer Motion** - анимации
- **shadcn/ui** - UI компоненты
- **Zustand** - state management
- **React Query** - data fetching

### Backend:
- **Node.js** + Express
- **Prisma** - ORM
- **SQLite** - база данных
- **Telegram Bot API**

---

## 📊 Последние изменения (07.10.2025)

### ✨ Добавлено:
- DonationBar - swipeable баннер поддержки проекта
- Динамический header по времени дня
- Полная документация состояния фронтенда

### 🐛 Исправлено:
- Импорт HomePage
- Фон на светлой/темной теме
- Видимость ThemeToggle

### 🎨 Обновлено:
- DonationModal - новый дизайн
- PaymentMethodCard - GlassCard + новые цвета
- AmountSelector - градиенты

**Подробнее:** [SESSION_CHANGES_2025-10-07.md](./SESSION_CHANGES_2025-10-07.md)

---

## 🎨 Дизайн-система

### Цветовая палитра:
```
🍑 Peach   - Основные действия (#FF7851)
🌿 Mint    - Успех, меню (#5CAE87)
💜 Lavender - Премиум, статистика (#8B5CF6)
🔴 Coral   - Энергия, активность (#FF5A4A)
🌟 Butter  - Предупреждения, донаты (#FFBF1F)
```

### Ключевые компоненты:
- **GlassCard** - glassmorphism карточки (3 уровня)
- **GradientButton** - кнопки с градиентами (7 вариантов)
- **ThemeToggle** - переключатель темы
- **DonationBar** - swipeable notification bar

---

## 🚀 Что делать дальше?

### Приоритет 1 - Quick Actions v2.0 ⭐
- [ ] Реализовать гибридный подход для Quick Actions
- [ ] Hero Action с динамическим контентом (60% пространства)
- [ ] 4 сценария в зависимости от статуса голосования
- [ ] Функция "Повторить прошлое" (доступна всем!)
- [ ] "Выбрать за меня" с конфетти
- [ ] "Результаты Live" с auto-refresh
- [ ] Модалки подтверждения
- [ ] API метод getLastCompletedPoll()

**📋 Детали:** [QUICK_ACTIONS_SPEC.md](./QUICK_ACTIONS_SPEC.md)

### Приоритет 2 - Остальные страницы:
- [ ] MenuPage - применить новый дизайн
- [ ] VotingPage - обновить poll cards
- [ ] StatsPage - новые графики
- [ ] ProfilePage - glassmorphism карточки

### Приоритет 2 - Дополнительные фичи:
- [ ] Toast notifications с GlassCard
- [ ] Loading states с shimmer
- [ ] Empty states
- [ ] Page transitions

### Приоритет 3 - Оптимизация:
- [ ] Code splitting
- [ ] Image optimization
- [ ] Performance monitoring

---

## 📞 Контакты и ссылки

- **GitHub:** (добавьте ссылку)
- **Telegram Bot:** (добавьте ссылку)

---

## 📝 Примечания для AI ассистентов

При работе над проектом:
1. ✅ Всегда читай `FRONTEND_QUICK_REFERENCE.md` для быстрого понимания контекста
2. ✅ Смотри `HomePage.tsx` как эталон использования компонентов
3. ✅ Используй существующую цветовую палитру (peach, mint, lavender, coral, butter)
4. ✅ Применяй GlassCard и GradientButton для консистентности
5. ✅ Добавляй Framer Motion анимации
6. ✅ Тестируй мобильные жесты (свайпы)
7. ✅ Обновляй документацию после изменений

---

**Последнее обновление:** 07.10.2025  
**Версия:** v2.0
