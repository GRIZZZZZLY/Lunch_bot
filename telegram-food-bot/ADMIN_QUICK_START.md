# 🔐 Admin System — Quick Start

## TL;DR

✅ **Реализовано:** Система администрирования с Dashboard  
🎯 **Доступ:** ProfilePage → "Панель администратора"  
🔒 **Безопасность:** Все API защищены middleware

---

## 🚀 Как использовать

### Для обычных пользователей:
Ничего не изменилось. Приложение работает как обычно.

### Для администраторов:

**1. Проверить что вы админ:**
```sql
SELECT isAdmin FROM users WHERE telegramId = '<your_id>';
-- Должно быть: 1 (true)
```

**2. Открыть Admin Dashboard:**
```
1. Откройте приложение
2. Перейдите в "Профиль" (иконка снизу)
3. Нажмите на жёлтую кнопку "Панель администратора"
```

**3. Что доступно на Dashboard:**
- 📊 Статистика: всего голосований, активные, завершённые
- 📝 Последние 10 действий админов
- ⚡ Быстрые действия: создать голосование, управление меню

---

## 🔒 Что защищено

**Эти операции доступны ТОЛЬКО админам:**
- ✅ Создание голосований
- ✅ Завершение голосований
- ✅ Отмена голосований
- ✅ Редактирование меню
- ✅ Удаление блюд из меню

**Попытка доступа обычным пользователем:**
```
→ 403 Forbidden
→ "Admin access required"
```

---

## 🛠️ Сделать пользователя админом

### Способ 1: Через SQL (рекомендуется)
```sql
UPDATE users 
SET isAdmin = 1 
WHERE telegramId = '<telegram_id>';
```

### Способ 2: Через скрипт (если есть)
```bash
cd backend
npm run make-admin <telegram_id>
```

### Проверить права:
```sql
SELECT id, username, firstName, isAdmin 
FROM users 
WHERE isAdmin = 1;
```

---

## 📊 Структура

### Backend:
```
✅ middleware/telegram-auth.ts  → adminMiddleware
✅ routes/poll.routes.ts        → защищены критичные роуты  
✅ routes/menu.routes.ts        → защищены все изменения
✅ controllers/poll.controller  → логирование действий
```

### Frontend:
```
🆕 pages/AdminDashboardPage.tsx  → новая страница
✏️ pages/ProfilePage.tsx         → кнопка для админов
✏️ App.tsx                       → роут /admin/dashboard
```

---

## 🧪 Быстрый тест

### Проверка защиты API:
```bash
# Без админских прав (должно вернуть 403)
curl -X PATCH http://localhost:3001/api/polls/1/complete \
  -H "Authorization: Bearer USER_TOKEN"

# С админскими правами (должно работать)
curl -X PATCH http://localhost:3001/api/polls/1/complete \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Проверка Dashboard:
```
1. Зайти как обычный пользователь → кнопки НЕТ
2. Открыть /admin/dashboard → редирект + уведомление
3. Зайти как админ → кнопка ЕСТЬ
4. Открыть Dashboard → видны метрики
```

---

## 📝 Логи

**Где смотреть:**
```bash
# Все логи
tail -f backend/logs/combined.log

# Только ошибки
tail -f backend/logs/error.log

# Найти админские действия
grep "completed via API" backend/logs/combined.log
grep "cancelled via API" backend/logs/combined.log
```

**Формат:**
```
2025-10-12 14:32:15 [info]: Poll completed via API {
  "pollId": 45,
  "completedBy": 1,
  "totalVotes": 12
}
```

---

## ⚠️ Troubleshooting

### Кнопки "Панель администратора" нет
**Причина:** `isAdmin = false` в БД  
**Решение:**
```sql
UPDATE users SET isAdmin = 1 WHERE id = <your_id>;
```

### 403 при попытке завершить poll
**Причина:** Нет админских прав или токен устарел  
**Решение:**
```bash
# Проверить токен
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <token>"
  
# Если isAdmin: false → сделать админом (см. выше)
```

### Dashboard пустой
**Причина:** Нет созданных голосований  
**Решение:** Создать хотя бы одно голосование

---

## 🔗 Дополнительно

📄 **Полная документация:** `ADMIN_SYSTEM_IMPLEMENTATION.md`  
📊 **UX Audit:** `UX_AUDIT_REPORT.md`  
🎯 **Action Plan:** `UX_ACTION_PLAN.md`

---

## ✅ Готово!

Система администрирования работает. Доступ через профиль, защита на уровне API.

**Нужна помощь?** Смотрите полную документацию в `ADMIN_SYSTEM_IMPLEMENTATION.md`
