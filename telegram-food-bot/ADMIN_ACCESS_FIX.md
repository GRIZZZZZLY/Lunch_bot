# 🔧 Исправление доступа к Admin Dashboard

## Проблема
Вы администратор в БД (`isAdmin = 1`), но Dashboard не открывается.

**Причина:** Старый JWT токен не содержит `isAdmin: true`

## ✅ Решение

### Способ 1: Очистить токен в браузере (5 секунд)

1. Откройте Mini App
2. Нажмите **F12** (откроется DevTools)
3. Перейдите на вкладку **Console**
4. Выполните команду:
   ```javascript
   localStorage.clear()
   ```
5. **Перезагрузите страницу** (F5 или Ctrl+R)
6. Приложение переавторизуется с новым токеном
7. Проверьте что `isAdmin = true`:
   ```javascript
   // Должно показать: true
   JSON.parse(localStorage.getItem('auth_token') || '{}')
   ```

### Способ 2: Очистить кэш Telegram (30 секунд)

1. Откройте Telegram
2. **Settings** → **Advanced** → **Clear Cache**
3. Подтвердите очистку
4. **Закройте Telegram полностью**
5. Откройте Telegram снова
6. Откройте Mini App
7. Теперь токен будет новый

### Способ 3: Использовать API refresh (для разработки)

1. Откройте Mini App
2. F12 → Console
3. Выполните:
   ```javascript
   // Получить текущий токен
   const token = localStorage.getItem('auth_token');
   console.log('Current token:', token);
   
   // Запросить новый токен с обновлёнными правами
   fetch('http://localhost:3001/api/auth/refresh', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   })
   .then(r => r.json())
   .then(data => {
     console.log('New token:', data);
     if (data.success && data.token) {
       localStorage.setItem('auth_token', data.token);
       console.log('✅ Token updated! Reload the page.');
       location.reload();
     }
   });
   ```

## 🧪 Проверка что всё работает

После очистки токена:

1. Откройте Mini App
2. F12 → Console
3. Проверьте пользователя:
   ```javascript
   // Должно показать ваши данные с isAdmin: true
   window.__user
   ```
4. Перейдите в **Профиль**
5. Должна быть **жёлтая кнопка** "Панель администратора"
6. Нажмите на неё
7. Dashboard откроется со статистикой

## ⚠️ Если всё ещё не работает

### Проверка 1: isAdmin в БД
```bash
cd telegram-food-bot/backend
npm run list-users | grep 555502880
```
**Должно быть:** `✅ YES` в колонке Admin

### Проверка 2: Токен в localStorage
```javascript
// В Console браузера
const token = localStorage.getItem('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('isAdmin in token:', payload.isAdmin);
```
**Должно быть:** `true`

### Проверка 3: API отвечает правильно
```javascript
// В Console браузера
fetch('http://localhost:3001/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
})
.then(r => r.json())
.then(data => console.log('User from API:', data.data));
```
**Должно показать:** `isAdmin: true`

## 🎯 Почему это происходит?

JWT токен создаётся **один раз** при авторизации и содержит данные на момент создания:

```javascript
// Старый токен (до установки admin прав)
{
  userId: 1,
  telegramId: "555502880",
  username: "igo_kravts",
  isAdmin: false  // ❌ Старое значение
}

// Новый токен (после установки admin прав)
{
  userId: 1,
  telegramId: "555502880",
  username: "igo_kravts",
  isAdmin: true   // ✅ Обновлённое значение
}
```

**Решение:** Очистить старый токен → получить новый токен → доступ открыт

## 🚀 После исправления

Вы сможете:
- ✅ Видеть кнопку "Панель администратора"
- ✅ Открывать Admin Dashboard
- ✅ Создавать и завершать голосования
- ✅ Управлять меню
- ✅ Видеть статистику и логи
