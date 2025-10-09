# 🚀 Dev Environment - Быстрый старт

> Конфигурация для локальной разработки и ручного тестирования

## ⚡ Быстрый запуск (3 минуты)

### 1️⃣ Запустить Backend

```powershell
# Из папки telegram-food-bot
.\dev-start-backend.ps1
```

**Готово!** Бот работает на http://localhost:3001

### 2️⃣ Протестировать в Telegram

1. Откройте бота: [@rocket_lunch_bot](https://t.me/rocket_lunch_bot)
2. Отправьте `/start`
3. Отправьте `/menu` - увидите 15 тестовых блюд

### 3️⃣ Запустить голосование (в группе)

1. Создайте группу в Telegram
2. Добавьте бота в группу
3. Отправьте `/quick`
4. Голосуйте за блюда! 🗳️

---

## 📋 Что уже настроено

- ✅ SQLite база данных (`backend/prisma/dev.db`)
- ✅ 15 тестовых блюд в 6 категориях
- ✅ Админ пользователь (Telegram ID: 555502880)
- ✅ Polling режим (без webhook)
- ✅ CORS для localhost
- ✅ Debug логирование

---

## 🎯 Конфигурация

### Backend (.env)
```bash
DATABASE_URL=file:./prisma/dev.db
BOT_TOKEN=REDACTED-BOT-TOKEN
API_PORT=3001
NODE_ENV=development
```

### Frontend (.env.development)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_USE_MOCK_API=false
```

---

## 📦 Тестовые данные

### Блюда в меню (15 шт):

**🍕 Пицца (4)**
- Маргарита - 450₽
- Пепперони - 520₽
- Четыре сыра - 580₽
- Гавайская - 490₽

**🍝 Паста (3)**
- Карбонара - 380₽
- Болоньезе - 390₽
- Альфредо - 420₽

**🥗 Салаты (2)**
- Цезарь - 320₽
- Греческий - 290₽

**🍔 Бургеры (2)**
- Чизбургер - 350₽
- Двойной бургер - 480₽

**🍰 Десерты (2)**
- Тирамису - 250₽
- Чизкейк - 280₽

**🥤 Напитки (2)**
- Кока-Кола - 120₽
- Капучино - 180₽

---

## 🧪 Основные команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Начать работу с ботом |
| `/menu` | Посмотреть меню блюд |
| `/quick` | Быстрое голосование (в группе) |
| `/startpoll <минут>` | Голосование с таймером |
| `/help` | Справка по командам |

---

## 🛠️ Полезные команды

### Управление данными

```powershell
# Пересоздать БД с нуля
cd backend
Remove-Item prisma\dev.db
npx prisma migrate deploy
npx tsx prisma/seed.ts

# Просмотр БД через UI
npx prisma studio
# Откроется http://localhost:5555

# Добавить еще тестовых данных
npx tsx prisma/seed.ts
```

### Проверка состояния

```powershell
# Статус миграций
npx prisma migrate status

# Генерация Prisma Client
npx prisma generate

# Проверка API
curl http://localhost:3001/api/health
curl http://localhost:3001/api/menu
```

---

## 📁 Структура проекта

```
telegram-food-bot/
├── backend/                    # Node.js + Express + Grammy
│   ├── src/
│   │   ├── bot/               # Telegram bot handlers
│   │   ├── api/               # REST API
│   │   ├── services/          # Business logic
│   │   └── database/          # Prisma client
│   ├── prisma/
│   │   ├── dev.db            # SQLite база (dev)
│   │   ├── schema.prisma     # Схема БД
│   │   └── seed.ts           # Тестовые данные
│   ├── .env                  # Конфигурация (создается автоматически)
│   └── .env.development      # Шаблон dev конфига
│
├── frontend/                  # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/       # UI компоненты
│   │   ├── pages/            # Страницы
│   │   └── services/         # API клиент
│   ├── .env                  # Production config (tunnel)
│   └── .env.development      # Dev config (localhost)
│
├── dev-start-backend.ps1     # 🚀 Скрипт запуска backend
├── dev-start-frontend.ps1    # 🎨 Скрипт запуска frontend
├── DEV_MANUAL_TESTING.md     # 📖 Полное руководство по тестированию
└── DEV_README.md             # 📄 Этот файл
```

---

## 🐛 Решение проблем

### Backend не запускается

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Бот не отвечает

1. Проверьте что backend запущен
2. Проверьте `BOT_TOKEN` в `.env`
3. Убедитесь что `BOT_WEBHOOK_URL` пустой
4. Проверьте логи в консоли

### Нет блюд в меню

```powershell
cd backend
npx tsx prisma/seed.ts
```

### База данных повреждена

```powershell
cd backend
Remove-Item prisma\dev.db -Force
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

---

## 🔄 Переключение между dev и production

### Dev режим (текущий):
```powershell
cd backend
Copy-Item .env.development -Destination .env
npm run dev
```

### Production режим:
```powershell
cd backend
Copy-Item .env.backup -Destination .env  # Если есть бэкап
# Или отредактируйте .env вручную
npm run build
npm start
```

---

## 📚 Дополнительная документация

- **[DEV_MANUAL_TESTING.md](./DEV_MANUAL_TESTING.md)** - Детальное руководство по тестированию
- **[TIMEWEB_DEPLOY.md](./TIMEWEB_DEPLOY.md)** - Деплой на production
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Автоматические тесты
- **[CURRENT_ISSUES.md](./CURRENT_ISSUES.md)** - Известные проблемы

---

## ⚡ Дополнительные возможности

### Запуск Frontend (опционально)

```powershell
.\dev-start-frontend.ps1
```

Откроется на http://localhost:5173

**⚠️ Внимание:** Для работы Telegram WebApp нужен HTTPS туннель!

### Использование с ngrok

```powershell
# Терминал 1: Backend
.\dev-start-backend.ps1

# Терминал 2: ngrok
ngrok http 3001

# Обновите WEBAPP_URL в backend/.env
# Обновите VITE_API_URL в frontend/.env

# Терминал 3: Frontend
.\dev-start-frontend.ps1
```

---

## 🎯 Сценарий быстрого теста

1. **Запуск** - `.\dev-start-backend.ps1`
2. **Бот** - Откройте @rocket_lunch_bot, `/start`
3. **Меню** - `/menu` - должно быть 15 блюд
4. **Группа** - Создайте группу, добавьте бота
5. **Голосование** - В группе: `/quick`
6. **Голос** - Нажмите на любое блюдо
7. **Результат** - Дождитесь окончания (30 мин)

**✅ Все работает!**

---

## 📊 Мониторинг

### Логи в консоли:
- `INFO` - информационные сообщения
- `WARN` - предупреждения
- `ERROR` - ошибки

### Просмотр БД:
```powershell
cd backend
npx prisma studio
```

Откроется UI на http://localhost:5555 где можно:
- Смотреть все таблицы
- Редактировать данные
- Добавлять записи вручную

---

## 🚀 Готово к работе!

Теперь у вас есть:
- ✅ Локальный backend с polling
- ✅ База данных с тестовыми данными
- ✅ Рабочий бот в Telegram
- ✅ Возможность ручного тестирования

**Начинайте тестировать! 🎉**

---

## 💡 Советы

1. **Используйте Prisma Studio** для просмотра данных в реальном времени
2. **Следите за логами** в консоли - там много полезной информации
3. **Создайте несколько аккаунтов** для тестирования голосований
4. **Используйте отдельную группу** для тестов, чтобы не спамить в рабочих чатах
5. **Сохраняйте .env файлы** перед экспериментами

---

**Удачного тестирования! 🧪✨**
