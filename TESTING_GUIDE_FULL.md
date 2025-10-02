# 🚀 Полное руководство по тестированию Telegram Food Bot

## 📋 Оглавление
1. [Установка ngrok](#1-установка-ngrok)
2. [Настройка backend](#2-настройка-backend)
3. [Настройка frontend](#3-настройка-frontend)
4. [Подключение к Telegram](#4-подключение-к-telegram)
5. [Тестирование проекта](#5-тестирование-проекта)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Установка ngrok

### Шаг 1.1: Регистрация

1. Перейдите на **https://ngrok.com**
2. Нажмите **Sign up** (Регистрация)
3. Зарегистрируйтесь через:
   - GitHub
   - Google
   - Email

### Шаг 1.2: Скачивание ngrok

После регистрации:

1. Перейдите в **Dashboard** → **Getting Started** → **Your Authtoken**
2. Скачайте ngrok для Windows:
   - **https://ngrok.com/download**
   - Или прямая ссылка: https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip

3. Распакуйте `ngrok.exe` в удобную папку, например:
   ```
   C:\ngrok\ngrok.exe
   ```

### Шаг 1.3: Получение Auth Token

1. В Dashboard ngrok найдите **Your Authtoken**
2. Скопируйте токен (выглядит как: `2abc...xyz`)
3. Или перейдите: https://dashboard.ngrok.com/get-started/your-authtoken

### Шаг 1.4: Авторизация ngrok

Откройте PowerShell в папке с ngrok:

```powershell
cd C:\ngrok
.\ngrok.exe config add-authtoken YOUR_AUTH_TOKEN
```

Замените `YOUR_AUTH_TOKEN` на ваш токен.

**Результат:**
```
Authtoken saved to configuration file: C:\Users\YourName\.ngrok2\ngrok.yml
```

---

## 2. Настройка backend

### Шаг 2.1: Настройка переменных окружения

Откройте `backend/.env`:

```env
# Database
DATABASE_URL="file:./dev.db"

# Telegram Bot
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_FROM_BOTFATHER"

# Server
PORT=3000
NODE_ENV=development

# Frontend URL (будет добавлен после запуска ngrok)
WEBAPP_URL="https://YOUR-NGROK-URL.ngrok-free.app"

# API URL (для CORS)
API_URL="http://localhost:3000"
```

### Шаг 2.2: Установка зависимостей

```powershell
cd C:\BOT_V2\telegram-food-bot\backend
npm install
```

### Шаг 2.3: Применение миграций

```powershell
npx prisma migrate deploy
npx prisma generate
```

### Шаг 2.4: (Опционально) Заполнение тестовыми данными

```powershell
npx prisma db seed
```

---

## 3. Настройка frontend

### Шаг 3.1: Настройка переменных окружения

Создайте `frontend/.env`:

```env
# API URL
VITE_API_URL=http://localhost:3000

# Режим (для мок-данных, если backend не запущен)
VITE_USE_MOCK_API=false
```

### Шаг 3.2: Установка зависимостей

```powershell
cd C:\BOT_V2\telegram-food-bot\frontend
npm install
```

---

## 4. Подключение к Telegram

### Шаг 4.1: Создание Telegram бота

Если ещё не создали:

1. Откройте Telegram
2. Найдите **@BotFather**
3. Отправьте команду `/newbot`
4. Введите название бота: `My Food Bot`
5. Введите username: `my_food_order_bot` (должен заканчиваться на `_bot`)
6. Скопируйте **токен** (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Шаг 4.2: Настройка Mini App в боте

После получения ngrok URL (см. Шаг 5.2):

1. В @BotFather отправьте: `/mybots`
2. Выберите вашего бота
3. Нажмите **Bot Settings** → **Menu Button**
4. Выберите **Edit menu button URL**
5. Отправьте ваш ngrok URL: `https://abc123.ngrok-free.app`

### Шаг 4.3: Настройка команд бота

В @BotFather:

```
/setcommands
```

Выберите бота и отправьте:

```
start - Начать работу с ботом
help - Показать справку
menu - Управление меню
startpoll - Создать голосование (админ)
stats - Показать статистику
profile - Мой профиль
```

---

## 5. Тестирование проекта

### Шаг 5.1: Запуск backend

Откройте **первый терминал** PowerShell:

```powershell
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev
```

**Ожидаемый результат:**
```
[info]: API сервер запущен на порту 3000
[info]: Бот запущен в polling режиме
```

### Шаг 5.2: Запуск ngrok для frontend

Откройте **второй терминал** PowerShell:

```powershell
cd C:\ngrok
.\ngrok.exe http 5173
```

**Результат:**
```
Session Status                online
Account                       your@email.com
Version                       3.x.x
Region                        Europe (eu)
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:5173
```

📝 **ВАЖНО:** Скопируйте URL `https://abc123xyz.ngrok-free.app`

### Шаг 5.3: Обновление WEBAPP_URL

1. Скопируйте ngrok URL из шага 5.2
2. Откройте `backend/.env`
3. Обновите:
   ```env
   WEBAPP_URL="https://abc123xyz.ngrok-free.app"
   ```
4. **Перезапустите backend** (Ctrl+C в первом терминале, затем `npm run dev`)

### Шаг 5.4: Запуск frontend

Откройте **третий терминал** PowerShell:

```powershell
cd C:\BOT_V2\telegram-food-bot\frontend
npm run dev
```

**Результат:**
```
VITE v4.5.14  ready in 213 ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### Шаг 5.5: Настройка Mini App URL в @BotFather

Используя ваш ngrok URL:

1. Откройте @BotFather
2. `/mybots` → выберите бота
3. **Bot Settings** → **Menu Button** → **Edit menu button URL**
4. Отправьте: `https://abc123xyz.ngrok-free.app`

### Шаг 5.6: Раскомментируйте кнопки Mini App

Откройте `backend/src/bot/commands/menu.ts` и раскомментируйте:

**Строки 70-78:**
```typescript
[
  {
    text: '📱 Открыть Mini App',
    web_app: {
      url: process.env.WEBAPP_URL || 'https://example.com'
    }
  }
],
```

**Строки 200-203:**
```typescript
[
  { text: '📱 Открыть Mini App', web_app: { url: process.env.WEBAPP_URL || 'https://example.com' } }
],
```

**Перезапустите backend!**

---

## 6. Полное тестирование

### Шаг 6.1: Проверка backend API

Откройте браузер:

```
http://localhost:3000/health
```

Должно вернуть:
```json
{
  "status": "ok",
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

### Шаг 6.2: Проверка frontend

Откройте браузер:

```
http://localhost:5173
```

Должна открыться главная страница приложения.

### Шаг 6.3: Проверка ngrok

Откройте браузер:

```
https://abc123xyz.ngrok-free.app
```

Должна открыться та же страница (через HTTPS).

**Если видите предупреждение ngrok:**
- Нажмите **Visit Site**
- Это нормально для бесплатной версии

### Шаг 6.4: Тестирование в Telegram

#### Тест 1: Команды бота

1. Найдите вашего бота в Telegram
2. Отправьте `/start`
3. Отправьте `/menu`
4. Отправьте `/help`

**Ожидаемое поведение:**
- Бот отвечает на команды
- В логах backend видны запросы
- Нет ошибок

#### Тест 2: Mini App через Menu Button

1. Нажмите на **кнопку меню** (иконка ☰ рядом с полем ввода)
2. Должен открыться Mini App

**Ожидаемое поведение:**
- Открывается встроенный браузер Telegram
- Загружается ваше приложение
- Видна навигация внизу: Меню, Статистика, Голосования, Профиль

#### Тест 3: Mini App через inline кнопку

1. Отправьте `/menu`
2. Нажмите **"📱 Открыть Mini App"**

**Ожидаемое поведение:**
- Открывается Mini App
- Все работает

#### Тест 4: Создание группы и голосования

1. Создайте новую группу в Telegram
2. Добавьте вашего бота в группу
3. Сделайте бота администратором
4. Отправьте `/menu` в группе
5. Попробуйте создать голосование

---

## 7. Структура запущенных процессов

У вас должно быть **3 открытых терминала**:

### Терминал 1: Backend
```powershell
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev
```
**Порт:** 3000  
**Логи:** Telegram updates, API requests

### Терминал 2: ngrok
```powershell
cd C:\ngrok
.\ngrok.exe http 5173
```
**URL:** https://abc123xyz.ngrok-free.app  
**Указывает на:** http://localhost:5173

### Терминал 3: Frontend
```powershell
cd C:\BOT_V2\telegram-food-bot\frontend
npm run dev
```
**Порт:** 5173  
**Логи:** Vite HMR, компиляция

---

## 8. Проверка функционала

### ✅ Checklist для тестирования:

#### Backend:
- [ ] Backend запущен без ошибок
- [ ] База данных подключена
- [ ] Бот отвечает на команды в Telegram
- [ ] API эндпоинты отвечают (`/health`)

#### Frontend:
- [ ] Frontend запущен
- [ ] Приложение открывается в браузере
- [ ] Нет ошибок в консоли браузера
- [ ] React Query DevTools видны внизу справа

#### ngrok:
- [ ] ngrok запущен
- [ ] URL работает в браузере
- [ ] HTTPS сертификат валиден

#### Telegram:
- [ ] Бот отвечает на `/start`
- [ ] Бот отвечает на `/menu`
- [ ] Кнопка меню открывает Mini App
- [ ] Inline кнопка "Открыть Mini App" работает
- [ ] В группе бот работает корректно

#### Mini App:
- [ ] Открывается без ошибок
- [ ] Навигация работает (4 вкладки внизу)
- [ ] Меню загружается
- [ ] Можно добавить блюдо (если админ)
- [ ] Можно создать голосование
- [ ] PWA индикаторы работают (offline, update)

---

## 9. Troubleshooting (Решение проблем)

### Проблема 1: ngrok не запускается

**Ошибка:**
```
ERR_NGROK_102: Failed to authenticate
```

**Решение:**
```powershell
.\ngrok.exe config add-authtoken YOUR_TOKEN
```

---

### Проблема 2: Backend не может подключиться к БД

**Ошибка:**
```
Can't reach database server
```

**Решение:**
```powershell
cd C:\BOT_V2\telegram-food-bot\backend
npx prisma migrate deploy
npx prisma generate
```

---

### Проблема 3: Frontend не открывается

**Ошибка:**
```
Port 5173 is already in use
```

**Решение:**
```powershell
# Закройте процесс на порту 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Или используйте другой порт
npx vite --port 5174
```

И обновите ngrok:
```powershell
.\ngrok.exe http 5174
```

---

### Проблема 4: Mini App не открывается в Telegram

**Возможные причины:**

1. **Не настроен WEBAPP_URL в backend/.env**
   - Проверьте правильность URL
   - Перезапустите backend

2. **Не раскомментированы кнопки в menu.ts**
   - Откройте `backend/src/bot/commands/menu.ts`
   - Раскомментируйте строки с web_app

3. **ngrok URL изменился**
   - При каждом перезапуске ngrok генерирует новый URL
   - Обновите WEBAPP_URL в .env
   - Обновите URL в @BotFather

4. **Не настроен Menu Button в @BotFather**
   - Зайдите в @BotFather
   - `/mybots` → Bot Settings → Menu Button
   - Укажите ngrok URL

---

### Проблема 5: CORS ошибки в браузере

**Ошибка в консоли:**
```
Access to fetch at 'http://localhost:3000/api/...' has been blocked by CORS policy
```

**Решение:**

1. Проверьте `backend/src/api/server.ts`:
   ```typescript
   const corsOrigin = process.env.WEBAPP_URL || 'http://localhost:5173';
   ```

2. Убедитесь что WEBAPP_URL в .env правильный

3. Перезапустите backend

---

### Проблема 6: Telegram показывает "Invalid Web App URL"

**Решение:**

1. URL должен быть **HTTPS** (не HTTP)
2. URL должен быть доступен из интернета
3. Проверьте что ngrok запущен
4. Откройте URL в браузере - должен открыться сайт

---

### Проблема 7: "Auth middleware error" в логах

Это не критично, просто TODO в коде. Игнорируйте пока или исправьте:

```typescript
// В backend/src/bot/middleware/auth.ts закомментировано:
// await GroupService.addMemberToGroup(group.id, dbUser.id);
```

---

## 10. Полезные команды

### Backend:

```powershell
# Запуск в dev режиме
npm run dev

# Сборка
npm run build

# Запуск production
npm start

# Применить миграции
npx prisma migrate deploy

# Открыть Prisma Studio (GUI для БД)
npx prisma studio

# Посмотреть логи
# Логи пишутся в консоль
```

### Frontend:

```powershell
# Запуск в dev режиме
npm run dev

# Сборка production
npm run build

# Предпросмотр production build
npm run preview

# Storybook
npm run storybook

# Линтинг
npm run lint:fix
```

### ngrok:

```powershell
# Запуск туннеля на порт 5173
.\ngrok.exe http 5173

# Запуск с custom subdomain (требует платный план)
.\ngrok.exe http 5173 --subdomain=my-food-bot

# Просмотр активных туннелей
.\ngrok.exe tunnel list

# Остановить все туннели
# Ctrl+C в терминале

# Веб-интерфейс ngrok (статистика)
# http://localhost:4040
```

### База данных:

```powershell
cd backend

# Создать новую миграцию
npx prisma migrate dev --name migration_name

# Применить миграции
npx prisma migrate deploy

# Сбросить БД (УДАЛЯЕТ ВСЕ ДАННЫЕ!)
npx prisma migrate reset

# Открыть Prisma Studio
npx prisma studio

# Заполнить тестовыми данными
npx prisma db seed
```

---

## 11. Мониторинг в реальном времени

### Логи backend:
Смотрите в терминале где запущен `npm run dev`

### Логи frontend:
Откройте браузер → DevTools (F12) → Console

### ngrok статистика:
Откройте: **http://localhost:4040**
- Все HTTP запросы
- Время ответа
- Headers
- Response bodies

### React Query DevTools:
В Mini App внизу справа будет иконка - кликните для просмотра:
- Кэш запросов
- Статус загрузки
- Данные в кэше

---

## 12. Платный ngrok (опционально)

### Бесплатный план:
- ✅ 1 ngrok процесс одновременно
- ✅ HTTPS туннель
- ✅ 40 подключений/минуту
- ⚠️ URL меняется при перезапуске
- ⚠️ Предупреждение "Visit Site" для пользователей

### Платный план ($8/месяц):
- ✅ Постоянный subdomain
- ✅ Нет предупреждения "Visit Site"
- ✅ Больше туннелей
- ✅ Custom domains

**Для production:**
Лучше использовать реальный хостинг:
- Vercel (frontend) - бесплатно
- Railway/Render (backend) - $5/месяц
- Или VPS (DigitalOcean, Hetzner)

---

## 13. Следующие шаги

После успешного тестирования:

1. ✅ Добавьте больше блюд в меню
2. ✅ Создайте тестовое голосование
3. ✅ Протестируйте все страницы Mini App
4. ✅ Проверьте работу в группе
5. ✅ Протестируйте на разных устройствах
6. 🚀 Разверните на production хостинг
7. 📝 Настройте мониторинг и логирование

---

## 14. Быстрый старт (краткая версия)

Если всё уже настроено:

```powershell
# Терминал 1: Backend
cd C:\BOT_V2\telegram-food-bot\backend
npm run dev

# Терминал 2: ngrok  
cd C:\ngrok
.\ngrok.exe http 5173

# Скопируйте ngrok URL и обновите backend/.env:
# WEBAPP_URL="https://YOUR-URL.ngrok-free.app"

# Перезапустите backend (Ctrl+C, затем npm run dev)

# Терминал 3: Frontend
cd C:\BOT_V2\telegram-food-bot\frontend
npm run dev

# Откройте Telegram → найдите бота → нажмите Menu Button
```

---

## 15. Контакты и поддержка

Если возникли проблемы:

1. Проверьте раздел **Troubleshooting** выше
2. Откройте логи всех 3 терминалов
3. Проверьте консоль браузера (F12)
4. Проверьте ngrok dashboard (localhost:4040)

---

**🎉 Готово! Удачного тестирования!**
