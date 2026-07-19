# 🖥️ Установка проекта на новом компьютере

## ✅ Требования

### 1. Обязательное ПО

```bash
# Проверьте установлено ли:
node --version    # Требуется: v18.0.0 или выше
npm --version     # Требуется: v9.0.0 или выше
git --version     # Любая современная версия
```

**Если не установлено:**
- **Node.js**: https://nodejs.org/ (скачайте LTS версию)
- **Git**: https://git-scm.com/downloads

---

### 2. Опциональное ПО

- **VS Code**: https://code.visualstudio.com/ (рекомендуемый редактор)
- **Postman/Insomnia**: для тестирования API
- **SQLite Browser**: https://sqlitebrowser.org/ (для просмотра БД)

---

## 🚀 Установка проекта

### Шаг 1: Клонирование (если нужно)

```bash
git clone <repository-url>
cd telegram-food-bot
```

### Шаг 2: Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Шаг 3: Конфигурация

```bash
# Backend - файл backend/.env уже настроен
# Проверьте следующие параметры:

DATABASE_URL=file:./dev.db                    # SQLite
BOT_TOKEN=<telegram-bot-token>                # Telegram Bot Token
API_PORT=3001
API_HOST=127.0.0.1
```

### Шаг 4: База данных

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### Шаг 5: Запуск

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (новое окно)
cd frontend
npm run dev
```

---

## 🔥 Решение проблемы с Telegram API

### Ошибка: `Network request for 'getMe' failed! ECONNRESET`

**Причины:**
1. ❌ Файрвол/антивирус блокирует api.telegram.org
2. ❌ Требуется VPN (Telegram может быть заблокирован)
3. ❌ Прокси настройки
4. ❌ Проблемы с SSL сертификатами

---

### Решение 1: Проверка подключения

```bash
# Windows PowerShell
Test-NetConnection api.telegram.org -Port 443

# Или через curl
curl -I https://api.telegram.org
```

**Ожидаемый результат:**
```
TcpTestSucceeded : True
```

Если **False** → проблема с сетью/файрволом.

---

### Решение 2: Отключение антивируса/файрвола (временно)

**Windows Defender:**
1. Откройте "Безопасность Windows"
2. "Брандмауэр и защита сети"
3. Выключите для частной сети (временно)
4. Попробуйте запустить backend снова

**Kaspersky/Avast/другие:**
- Временно отключите "Проверку HTTPS"
- Добавьте Node.js в исключения

---

### Решение 3: Настройка прокси (если нужен VPN)

Если Telegram заблокирован в вашей стране:

#### Вариант A: Использовать SOCKS5 прокси

```bash
# backend/.env
# Добавьте:
TELEGRAM_API_PROXY=socks5://127.0.0.1:1080
```

Затем обновите `backend/src/bot/bot.ts`:

```typescript
import { Bot } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';

const agent = process.env.TELEGRAM_API_PROXY 
  ? new SocksProxyAgent(process.env.TELEGRAM_API_PROXY)
  : undefined;

export const bot = new Bot(token, {
  client: {
    baseFetchConfig: {
      agent,
    },
  },
});
```

Установите зависимость:
```bash
cd backend
npm install socks-proxy-agent
```

#### Вариант B: HTTP прокси

```env
HTTP_PROXY=http://proxy-server:port
HTTPS_PROXY=http://proxy-server:port
```

---

### Решение 4: Использовать локальный Bot API Server

Если api.telegram.org недоступен, используйте локальный сервер:

```bash
# Скачайте Telegram Bot API Server
# https://github.com/tdlib/telegram-bot-api

# Запустите
telegram-bot-api --api-id=YOUR_API_ID --api-hash=YOUR_API_HASH

# Обновите backend/src/config/bot.config.ts
export const botConfig = {
  token: process.env.BOT_TOKEN,
  apiRoot: 'http://localhost:8081', // Локальный API
};
```

---

### Решение 5: Обход блокировки через DNS

Попробуйте изменить DNS:

**Windows:**
1. Откройте "Параметры сети и Интернет"
2. "Настройка параметров адаптера"
3. Правой кнопкой на вашем подключении → "Свойства"
4. IP версии 4 (TCP/IPv4) → "Свойства"
5. Использовать следующие адреса DNS-серверов:
   - Предпочитаемый: `8.8.8.8` (Google)
   - Альтернативный: `1.1.1.1` (Cloudflare)

---

### Решение 6: Временно отключить Bot (только для Frontend разработки)

Если нужен только API для Frontend:

```typescript
// backend/src/index.ts
async function startApplication(): Promise<void> {
  try {
    // Запуск API сервера
    startApiServer(app);
    
    // ЗАКОММЕНТИРУЙТЕ запуск бота:
    // if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
    //   await setupWebhook(bot, botConfig.webhookUrl);
    // } else {
    //   startPolling(bot);
    // }
    
    logger.info('✅ API сервер запущен (без бота)');
  } catch (error) {
    logger.error('Ошибка:', error);
  }
}
```

---

## 🧪 Проверка установки

### 1. Backend API

```bash
# Проверка health endpoint
curl http://localhost:3001/health

# Или в PowerShell
Invoke-WebRequest http://localhost:3001/health
```

**Ожидаемый результат:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 5.234
}
```

### 2. Frontend

Откройте в браузере: http://localhost:5173

### 3. База данных

```bash
cd backend
npx prisma studio
```

Откроется веб-интерфейс на http://localhost:5555

---

## 📋 Чеклист перед началом работы

- [ ] Node.js v18+ установлен
- [ ] Зависимости установлены (backend и frontend)
- [ ] База данных инициализирована (prisma migrate)
- [ ] backend/.env настроен
- [ ] Backend запускается на :3001
- [ ] Frontend запускается на :5173
- [ ] API отвечает на /health
- [ ] (Опционально) Telegram Bot подключается

---

## 🐛 Troubleshooting

### "Cannot find module 'xxx'"
```bash
# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install
```

### "Port 3001 already in use"
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Или PowerShell
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

### "Prisma Client not found"
```bash
cd backend
npx prisma generate
```

### "Database is locked"
```bash
# SQLite используется другим процессом
# Закройте все приложения, использующие dev.db
# Или перезапустите компьютер
```

---

## 📚 Дополнительные ресурсы

- **Основная документация**: [QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)
- **Настройка туннеля**: [XTUNNEL_SETUP.md](XTUNNEL_SETUP.md)
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Grammy Framework**: https://grammy.dev/
- **Prisma Docs**: https://www.prisma.io/docs/

---

## 🔐 Важные замечания

1. **Не коммитьте .env файлы** - они содержат секреты
2. **Используйте .gitignore** - проверьте что секреты не попадают в репозиторий
3. **Регулярно обновляйте зависимости**: `npm audit fix`
4. **Делайте бэкапы dev.db** перед большими изменениями схемы

---

**Версия:** 2.0  
**Дата:** 03.10.2025  
**Для вопросов**: создайте Issue в репозитории
