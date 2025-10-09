# ⚠️ Ограничение Telegram: WebApp кнопки в группах

## Проблема

При попытке использовать inline-кнопки с типом `web_app` в групповых чатах, Telegram возвращает ошибку:

```
GrammyError: Call to 'sendMessage' failed! 
(400: Bad Request: BUTTON_TYPE_INVALID)
```

## Причина

**Это ограничение Telegram API**, а не ошибка в коде!

Telegram **не поддерживает** кнопки типа `web_app` в следующих контекстах:
- ❌ Групповые чаты (groups)
- ❌ Супергруппы (supergroups)
- ❌ Каналы (channels)

Кнопки `web_app` работают **только** в:
- ✅ Личных сообщениях (private chats)
- ✅ Inline-режиме (inline queries)

**Источник:** [Telegram Bot API Documentation - WebApp](https://core.telegram.org/bots/webapps#keyboard-button-mini-apps)

---

## ✅ Решение

Мы реализовали **условную логику** в командах бота:

### В личных чатах:
```typescript
// Показываем кнопку Mini App
{
  text: '🚀 Открыть Mini App',
  web_app: { url: 'https://your-domain.com' }
}
```

### В группах:
```typescript
// Показываем обычные кнопки + инструкцию
// Кнопку web_app НЕ показываем
[
  { text: '🍽️ Меню', callback_data: 'menu' },
  { text: '📖 Команды', callback_data: 'help' }
]
```

---

## 🔧 Что было исправлено

### 1. Команда `/start` (`src/bot/commands/start.ts`)
- Добавлена проверка `isGroup = ctx.chat.type !== 'private'`
- В группах: обычные кнопки + инструкция как открыть Mini App
- В личке: кнопка Mini App работает

### 2. Команда `/menu` (`src/bot/commands/menu.ts`)
- Условные кнопки в зависимости от типа чата
- В группах добавлена подсказка: "Откройте бота в личных сообщениях"

### 3. Команда `/help` (`src/bot/commands/help.ts`)
- Разные клавиатуры для групп и личных чатов
- Обновлен текст помощи для групп

### 4. Команда `/app` (`src/bot/commands/app.ts`)
- Объясняет ограничение Telegram в группах
- Показывает инструкцию как открыть Mini App через личку

---

## 📱 Как пользователи открывают Mini App в группах

### Способ 1: Через личку с ботом (рекомендуется)
1. Нажать на имя бота в группе
2. Открыть личный чат с ботом
3. Нажать кнопку **Menu** внизу экрана
4. Или отправить `/menu` в личке

### Способ 2: Напрямую открыть бота
1. Найти бота: [@rocket_lunch_bot](https://t.me/rocket_lunch_bot)
2. Нажать **Start**
3. Нажать кнопку **Menu** или кнопку **🚀 Открыть Mini App**

### Способ 3: Menu Button (только в личных чатах)
1. Открыть бота в личке
2. Нажать на иконку Menu (≡) рядом с полем ввода
3. Mini App откроется автоматически

---

## 🎯 Альтернативные решения (не реализованы)

### 1. Inline Mode
Можно использовать inline-запросы:
```
@rocket_lunch_bot menu
```

Но требует:
- Включения Inline Mode в BotFather
- Дополнительной реализации inline handlers
- Пользователи должны знать команды

### 2. Web Link кнопка
Вместо `web_app` можно использовать `url`:
```typescript
{
  text: '🚀 Открыть Mini App',
  url: 'https://t.me/rocket_lunch_bot/app'
}
```

Но это открывает внешний браузер, а не WebApp внутри Telegram.

### 3. Deep Links
```typescript
{
  text: '🚀 Открыть Mini App',
  url: 'https://t.me/rocket_lunch_bot?start=menu'
}
```

Открывает бота в личке, но не сразу Mini App.

---

## 📊 Текущая реализация

### Команды бота в группах:

| Команда | Что показывает | Кнопка Mini App |
|---------|----------------|-----------------|
| `/start` | Приветствие + инструкция | ❌ Нет |
| `/help` | Справка | ❌ Нет |
| `/menu` | Управление меню + подсказка | ❌ Нет |
| `/app` | Инструкция как открыть | ❌ Нет |
| `/startpoll` | Запуск голосования | N/A |

### Команды бота в личке:

| Команда | Что показывает | Кнопка Mini App |
|---------|----------------|-----------------|
| `/start` | Приветствие | ✅ Есть |
| `/help` | Справка | ✅ Есть |
| `/menu` | Управление меню | ✅ Есть |
| `/app` | Быстрое открытие | ✅ Есть |
| **Menu Button** | Встроенная кнопка Telegram | ✅ Работает |

---

## 🧪 Тестирование

### Тест в группе:
```bash
1. Добавьте бота в группу
2. Отправьте /start
3. ✅ Должно работать без ошибок
4. ❌ Кнопка Mini App НЕ должна появиться
5. ✅ Должна быть инструкция как открыть
```

### Тест в личке:
```bash
1. Откройте бота в личных сообщениях
2. Отправьте /start
3. ✅ Кнопка "🚀 Открыть Mini App" должна появиться
4. ✅ Нажмите - должен открыться Mini App
```

---

## 🔗 Ссылки

- [Telegram Bot API - Web Apps](https://core.telegram.org/bots/webapps)
- [Telegram Bot API - Keyboard Buttons](https://core.telegram.org/bots/api#keyboardbutton)
- [Telegram Bot API - Inline Keyboard](https://core.telegram.org/bots/api#inlinekeyboardbutton)
- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)

---

## ✅ Итог

Проблема решена путем **адаптации логики под ограничения Telegram**:

✅ В личных чатах - кнопки Mini App работают  
✅ В группах - показываем инструкцию как открыть через личку  
✅ Пользователи получают понятное объяснение  
✅ Нет ошибок в логах  
✅ Все команды работают корректно

**Это не баг - это особенность (feature) Telegram API!** 🎯
