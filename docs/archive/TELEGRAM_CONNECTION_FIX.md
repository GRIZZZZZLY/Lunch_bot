# 🔧 Исправление ошибки подключения к Telegram API

## Проблема

```
HttpError: Network request for 'getMe' failed!
ECONNRESET: Client network socket disconnected before secure TLS connection
```

---

## ✅ Быстрая диагностика

### Шаг 1: Проверьте доступность Telegram API

**Windows PowerShell:**
```powershell
Test-NetConnection api.telegram.org -Port 443
```

**Результат OK:**
```
TcpTestSucceeded : True
RemoteAddress    : 149.154.167.220
```

**Результат FAIL:**
```
TcpTestSucceeded : False
```
→ **Telegram заблокирован или проблема с сетью**

---

### Шаг 2: Проверьте через браузер

Откройте: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe

Замените `<YOUR_BOT_TOKEN>` на ваш токен из `.env`

**Ожидаемый результат:**
```json
{
  "ok": true,
  "result": {
    "id": 8298516078,
    "is_bot": true,
    "first_name": "Food Order Bot",
    "username": "rocket_lunch_bot"
  }
}
```

**Если видите ошибку** → Telegram API недоступен

---

## 🛠️ Решения

### Решение 1: Отключите HTTPS проверку антивируса

Многие антивирусы (Kaspersky, Avast, ESET) проверяют HTTPS трафик и могут блокировать Telegram.

**Действия:**
1. Откройте настройки антивируса
2. Найдите "Проверка HTTPS" или "SSL Scanning"
3. Добавьте `api.telegram.org` в исключения
4. Или временно отключите проверку HTTPS

---

### Решение 2: Смените DNS на Google или Cloudflare

**Windows:**
1. `Win + R` → `ncpa.cpl` → Enter
2. Правый клик на вашем подключении → "Свойства"
3. Выберите "IP версии 4 (TCP/IPv4)" → "Свойства"
4. Выберите "Использовать следующие адреса DNS-серверов":
   - **Предпочитаемый**: `8.8.8.8`
   - **Альтернативный**: `1.1.1.1`
5. OK → Перезапустите браузер и backend

---

### Решение 3: Используйте VPN (если Telegram заблокирован)

Если в вашей стране Telegram заблокирован, используйте VPN:

**Рекомендуемые VPN:**
- ProtonVPN (бесплатный)
- Windscribe
- Cloudflare WARP

**После подключения VPN:**
```bash
# Проверьте снова
Test-NetConnection api.telegram.org -Port 443
```

---

### Решение 4: Настройте SOCKS5 прокси в боте

Если у вас есть SOCKS5 прокси (например, через Shadowsocks):

#### 1. Установите зависимость

```bash
cd backend
npm install socks-proxy-agent
```

#### 2. Обновите `backend/src/bot/bot.ts`

```typescript
import { Bot } from 'grammy';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Создаем прокси агент если указан в .env
const agent = process.env.TELEGRAM_API_PROXY 
  ? new SocksProxyAgent(process.env.TELEGRAM_API_PROXY)
  : undefined;

export function createBot(): Bot {
  const bot = new Bot(botConfig.token, {
    client: {
      baseFetchConfig: {
        agent, // Добавляем прокси
        compress: true,
      },
    },
  });
  
  // ... остальной код
  
  return bot;
}
```

#### 3. Добавьте в `backend/.env`

```env
# SOCKS5 прокси (если используете)
TELEGRAM_API_PROXY=socks5://127.0.0.1:1080
```

---

### Решение 5: Используйте HTTP прокси

Если у вас HTTP/HTTPS прокси:

```bash
# Windows PowerShell (временно для текущей сессии)
$env:HTTP_PROXY="http://proxy-server:port"
$env:HTTPS_PROXY="http://proxy-server:port"

# Запустите backend в этом же окне
cd backend
npm run dev
```

Или добавьте в `backend/.env`:
```env
HTTP_PROXY=http://proxy-server:port
HTTPS_PROXY=http://proxy-server:port
```

---

### Решение 6: Временно отключите бота (только API)

Если нужно только API для разработки Frontend:

**Отредактируйте `backend/src/index.ts`:**

```typescript
async function startApplication(): Promise<void> {
  try {
    logger.info('Запуск Telegram Food Bot...');
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // Запуск API сервера
    startApiServer(app);
    
    // ВРЕМЕННО ОТКЛЮЧАЕМ БОТ
    // if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
    //   await setupWebhook(bot, botConfig.webhookUrl);
    // } else {
    //   startPolling(bot);
    // }
    
    logger.info('✅ API сервер запущен (бот отключен)');
    
  } catch (error) {
    logger.error('❌ Ошибка при запуске:', error);
    process.exit(1);
  }
}
```

**Теперь запустится только API без Telegram бота.**

---

## 🧪 Проверка после исправления

### 1. Проверьте backend логи

Должно быть:
```
✅ Подключение к базе данных успешно установлено
🚀 API сервер запущен на http://127.0.0.1:3001
🤖 Бот инициализирован
🚀 Бот запущен в polling режиме
```

**БЕЗ ошибок** `Network request for 'getMe' failed!`

### 2. Проверьте API

```bash
curl http://localhost:3001/health
```

### 3. Отправьте команду боту

В Telegram: `/start` → `@rocket_lunch_bot`

Бот должен ответить.

---

## 🔍 Дополнительная диагностика

### Проверка сертификатов

```bash
# Windows
certutil -verify https://api.telegram.org

# PowerShell
[Net.ServicePointManager]::SecurityProtocol
# Должно быть: Tls12, Tls13
```

### Проверка через Node.js

Создайте тестовый файл `test-telegram.js`:

```javascript
const https = require('https');

const BOT_TOKEN = 'ВАШ_ТОКЕН_ЗДЕСЬ';

https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('✅ Успех:', data);
  });
}).on('error', (err) => {
  console.error('❌ Ошибка:', err.message);
});
```

Запустите:
```bash
node test-telegram.js
```

---

## 📞 Если ничего не помогло

1. **Используйте другую сеть** (мобильный интернет, другой Wi-Fi)
2. **Попробуйте на другом компьютере**
3. **Свяжитесь с системным администратором** (если корпоративная сеть)
4. **Используйте webhook режим** вместо polling (требует публичный URL)

---

## ✅ Лучшая практика для production

В production используйте **webhook режим** вместо polling:

```typescript
// backend/src/index.ts
if (process.env.NODE_ENV === 'production' && botConfig.webhookUrl) {
  // Production: webhook режим (более надежно)
  await setupWebhook(bot, botConfig.webhookUrl);
} else {
  // Development: polling режим
  startPolling(bot);
}
```

**Преимущества webhook:**
- Более надежное соединение
- Меньше проблем с файрволами
- Лучшая производительность

---

**Версия:** 1.0  
**Дата:** 03.10.2025
