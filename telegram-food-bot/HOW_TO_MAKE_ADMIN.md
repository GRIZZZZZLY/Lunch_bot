# 🔐 Как сделать пользователя администратором

## 🚀 Быстрый способ (рекомендуется)

### Шаг 1: Узнать свой Telegram ID

**Вариант A: Через бота**
1. Откройте бота [@userinfobot](https://t.me/userinfobot) в Telegram
2. Нажмите Start
3. Скопируйте ваш `Id:` (например: `123456789`)

**Вариант B: Через Mini App**
1. Откройте ваш Mini App
2. Откройте DevTools браузера (F12)
3. В Console найдите строку с `telegramId`
4. Или выполните: `Telegram.WebApp.initDataUnsafe.user.id`

### Шаг 2: Запустить скрипт

```bash
cd telegram-food-bot/backend
npm run make-admin <ваш_telegram_id>
```

**Пример:**
```bash
npm run make-admin 123456789
```

**Вывод:**
```
🔍 Searching for user with Telegram ID: 123456789...

✅ Found user:
   - ID: 1
   - Telegram ID: 123456789
   - Username: username
   - Name: Иван Иванов
   - Current admin status: ❌ NO

🔄 Setting admin rights...

✅ SUCCESS! User is now an admin.
   - ID: 1
   - Telegram ID: 123456789
   - Username: username
   - Name: Иван Иванов
   - Admin: ✅ YES

📱 Next steps:
   1. User needs to reopen the Mini App
   2. Open Profile page
   3. Click "Панель администратора" button
   4. Admin Dashboard will open with stats
```

### Шаг 3: Проверить доступ

1. **Закройте** Mini App полностью
2. **Откройте** заново
3. Перейдите в **Профиль** (нижняя панель)
4. Увидите **жёлтую кнопку** "Панель администратора"
5. Нажмите на неё → откроется Dashboard

---

## 🛠️ Альтернативный способ (SQL)

### Через командную строку

```bash
cd telegram-food-bot/backend
sqlite3 prisma/dev.db
```

```sql
-- Показать всех пользователей
SELECT id, telegramId, username, firstName, isAdmin FROM users;

-- Сделать пользователя админом (замените 123456789 на ваш ID)
UPDATE users SET isAdmin = 1 WHERE telegramId = 123456789;

-- Проверить
SELECT id, telegramId, username, firstName, isAdmin FROM users WHERE isAdmin = 1;

-- Выход
.quit
```

---

## 📊 Проверка статуса

### Посмотреть всех админов:

```bash
cd telegram-food-bot/backend
sqlite3 prisma/dev.db "SELECT id, telegramId, username, firstName FROM users WHERE isAdmin = 1;"
```

### Проверить конкретного пользователя:

```bash
sqlite3 prisma/dev.db "SELECT id, telegramId, username, firstName, isAdmin FROM users WHERE telegramId = 123456789;"
```

---

## ❌ Убрать админские права

```bash
cd telegram-food-bot/backend
npm run make-admin 123456789  # Если скрипт поддерживает --remove
```

**Или через SQL:**
```sql
UPDATE users SET isAdmin = 0 WHERE telegramId = 123456789;
```

---

## 🔍 Troubleshooting

### Проблема: Пользователь не найден

**Причина:** Пользователь ещё не заходил в Mini App

**Решение:**
1. Откройте Mini App хотя бы один раз
2. Дождитесь авторизации
3. Запустите скрипт снова

### Проблема: Кнопка "Панель администратора" не появилась

**Причина:** Frontend кэшировал старые данные

**Решение:**
1. **Полностью закройте** Mini App
2. В Telegram: Settings → Advanced → Clear cache
3. **Откройте** Mini App заново
4. Проверьте в Console браузера: `user.isAdmin` должен быть `true`

### Проблема: Двойное уведомление "Требуются права"

**Статус:** ✅ Исправлено!

Это было вызвано React Strict Mode. Теперь уведомление показывается только 1 раз.

### Проблема: 403 Forbidden при доступе к Admin API

**Причина:** Backend не видит `isAdmin = true`

**Решение:**
```bash
# Проверить в БД
cd telegram-food-bot/backend
sqlite3 prisma/dev.db "SELECT * FROM users WHERE telegramId = <ваш_id>;"

# Убедиться что isAdmin = 1
# Если 0, запустить:
npm run make-admin <ваш_id>
```

---

## 📚 Что дальше?

После получения админских прав вы сможете:

✅ **Создавать голосования** через Dashboard  
✅ **Завершать активные голосования**  
✅ **Отменять голосования**  
✅ **Редактировать меню** (добавлять/удалять блюда)  
✅ **Просматривать статистику** системы  
✅ **Видеть логи действий** других админов  

---

## 🎯 Полезные команды

```bash
# Показать список всех пользователей
cd telegram-food-bot/backend
npm run make-admin

# Сделать админом
npm run make-admin 123456789

# Посмотреть логи админских действий
tail -f logs/combined.log | grep "completed via API"
tail -f logs/combined.log | grep "cancelled via API"

# Перезапустить backend (после изменений в БД)
npm run dev
```

---

## 📖 Дополнительная документация

- **ADMIN_SYSTEM_IMPLEMENTATION.md** — полная техническая документация
- **ADMIN_QUICK_START.md** — быстрый старт для админов
- **UX_AUDIT_REPORT.md** — UX аудит системы
- **UX_ACTION_PLAN.md** — план улучшений

---

**Готово!** Теперь вы администратор системы. 🎉
