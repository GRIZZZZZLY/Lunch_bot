# 🚀 Быстрая настройка WebApp для @rocket_lunch_bot

## ✅ Что уже работает:
- Backend: http://localhost:3001 ✅
- Бот: @rocket_lunch_bot ✅
- База данных: SQLite ✅
- Prisma Studio: http://localhost:5555 ✅

## 📋 Быстрая настройка (5 минут)

### Шаг 1: Запустить Frontend

```powershell
# В новом терминале
cd C:\BOT_V2\telegram-food-bot\frontend
npm run dev
```

Frontend запустится на: http://localhost:5173

### Шаг 2: Установить и запустить ngrok

**Скачать:** https://ngrok.com/download

```powershell
# В еще одном новом терминале
ngrok http 5173
```

Скопируйте HTTPS URL (например: `https://abc123-45-67-89.ngrok-free.app`)

### Шаг 3: Настроить Menu Button в BotFather

1. Откройте @BotFather
2. Отправьте: `/mybots`
3. Выберите: **Food Order Bot** (@rocket_lunch_bot)
4. Нажмите: **Bot Settings**
5. Выберите: **Menu Button**
6. Нажмите: **Configure menu button**
7. Когда спросит текст, отправьте: `Меню 🍕`
8. Когда спросит URL, отправьте ваш ngrok URL: `https://ваш-ngrok-url.ngrok-free.app`

### Шаг 4: Проверить бота

1. Откройте @rocket_lunch_bot в Telegram
2. Нажмите на кнопку **Меню** внизу (появится после настройки)
3. Должен открыться WebApp с интерфейсом управления меню

## 🔧 Дополнительные настройки

### Установить команды бота

В @BotFather отправьте:
```
/setcommands
```

Выберите @rocket_lunch_bot и отправьте:
```
start - Начать работу
help - Справка
menu - Управление меню
startpoll - Создать голосование
stats - Статистика
```

### Настроить описание

```
/setdescription
```

Выберите бота и отправьте:
```
🍕 Бот для организации заказов еды в группе

• Голосования за блюда
• Рулетка для выбора ответственного
• Управление меню через WebApp
• Статистика заказов

Добавьте в группу и сделайте администратором!
```

## 🎯 Проверка работы

### В Prisma Studio (http://localhost:5555):

Посмотрите таблицы:
- **users** - зарегистрированные пользователи
- **groups** - группы с ботом
- **menu_items** - блюда в меню
- **polls** - голосования
- **votes** - голоса

### Команды для тестирования:

В личке с ботом:
- `/start` - регистрация
- `/help` - справка
- `/menu` - открыть WebApp

В группе (нужно добавить бота):
- `/startpoll` - начать голосование (только для админов)

## ⚠️ Важно для WebApp

### Обновить frontend/.env:

```env
VITE_API_URL=http://localhost:3001/api
VITE_BOT_USERNAME=rocket_lunch_bot
```

### Если ngrok показывает ошибку CORS:

Добавьте ngrok URL в backend/.env:
```env
CORS_ORIGIN=https://ваш-ngrok-url.ngrok-free.app
```

И перезапустите backend.

## 📱 Альтернатива: Тестирование без WebApp

Если ngrok недоступен, бот все равно работает:
- Все команды работают в Telegram
- WebApp можно настроить позже
- Или использовать для деплоя на сервер

## 🐛 Решение проблем

### Frontend не запускается:
```powershell
cd C:\BOT_V2\telegram-food-bot\frontend
npm install
npm run dev
```

### ngrok не работает:
- Скачайте с сайта ngrok.com
- Зарегистрируйтесь (бесплатно)
- Выполните: `ngrok config add-authtoken ВАШ_ТОКЕН`

### WebApp не открывается:
- Проверьте, что frontend запущен
- Проверьте, что ngrok запущен и показывает статус "online"
- Проверьте правильность URL в BotFather

## ✨ Следующие шаги

1. ✅ Настроить WebApp
2. Добавить блюда в меню через WebApp
3. Создать тестовую группу
4. Добавить бота в группу
5. Протестировать голосование
6. Протестировать рулетку
