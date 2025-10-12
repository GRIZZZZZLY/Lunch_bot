# 🔧 Исправление проблемы подключения к Telegram API

## ❌ Проблема

```
HttpError: Network request for 'getMe' failed!
code: ECONNRESET
```

Node.js не может установить TLS соединение с `api.telegram.org`.

---

## ✅ Решения

### 1️⃣ Перезапуск (самое простое)

Иногда помогает просто перезапуск:

```powershell
# Закройте окно бэкенда
# Перезапустите start-dev.ps1
.\start-dev.ps1
```

---

### 2️⃣ Проверка файрвола Windows

```powershell
# Запустите PowerShell от администратора
# Добавьте разрешение для Node.js:
New-NetFirewallRule -DisplayName "Node.js HTTPS" -Direction Outbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow -Protocol TCP -RemotePort 443
```

---

### 3️⃣ Антивирус

**Временно отключите** антивирус (Kaspersky, Avast, Norton и т.д.) и попробуйте снова.

Если помогло - добавьте Node.js в исключения антивируса.

---

### 4️⃣ VPN (если Telegram заблокирован)

Если ваш провайдер блокирует Telegram:

1. Включите VPN
2. Перезапустите бэкенд

---

### 5️⃣ Использование HTTP прокси (advanced)

Если у вас есть HTTP/HTTPS прокси:

#### Вариант A: Через переменные окружения

```powershell
# В PowerShell перед запуском:
$env:HTTPS_PROXY="http://your-proxy:port"
$env:HTTP_PROXY="http://your-proxy:port"

cd backend
npm run dev
```

#### Вариант B: Настройка в коде

Создайте файл `telegram-food-bot/backend/src/config/telegram-proxy.ts`:

```typescript
import { Bot } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

export function createBotWithProxy(token: string) {
  const proxyUrl = process.env.TELEGRAM_PROXY;
  
  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl);
    return new Bot(token, {
      client: {
        baseFetchConfig: {
          agent,
        }
      }
    });
  }
  
  return new Bot(token);
}
```

Установите зависимость:
```bash
npm install https-proxy-agent
```

---

### 6️⃣ Обновление Node.js

Иногда помогает обновление Node.js:

```powershell
# Проверить версию
node --version

# Обновить через официальный сайт:
# https://nodejs.org/
```

---

### 7️⃣ Очистка DNS кеша

```powershell
# Запустите от администратора:
ipconfig /flushdns
```

---

### 8️⃣ Временное решение (НЕ для production!)

⚠️ **Только для локальной разработки!**

В `telegram-food-bot/backend/.env` добавьте:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Перезапустите бэкенд.

**ВАЖНО:** Удалите эту строку перед деплоем в production!

---

## 🧪 Проверка подключения

Запустите тест:

```bash
cd telegram-food-bot
node test-telegram-api.js
```

Должно быть:
```
✅ Test 1: HTTPS connection successful
✅ Test 2: Bot API request successful
✅ Test 3: Bot authenticated
🎉 All tests passed!
```

---

## 🆘 Если ничего не помогло

### Используйте webhook вместо polling:

1. Запустите ngrok:
```bash
ngrok http 3001
```

2. В `.env` измените:
```bash
BOT_MODE=webhook
BOT_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/webhook
```

3. Перезапустите бэкенд

Webhook работает иначе - Telegram сам отправляет запросы на ваш сервер, не нужно подключаться к api.telegram.org.

---

## 📋 Чек-лист диагностики

- [ ] Перезапустил бэкенд
- [ ] Проверил файрвол Windows
- [ ] Отключил антивирус (временно)
- [ ] Попробовал VPN
- [ ] Очистил DNS кеш
- [ ] Обновил Node.js
- [ ] Запустил test-telegram-api.js

---

## 🎯 Рекомендуемый порядок действий

1. **Перезапустите** - помогает в 50% случаев
2. **Файрвол** - добавьте правило для Node.js
3. **Антивирус** - временно отключите
4. **VPN** - если провайдер блокирует Telegram
5. **Webhook режим** - если ничего не помогло

---

## ✅ После исправления

Когда подключение заработает, в логах должно быть:

```
✅ Webhook удален
🚀 Бот запущен в polling режиме {"username":"rocket_lunch_bot"}
🤖 Бот инициализирован {"id":8298516078,"username":"rocket_lunch_bot"}
```

Без ошибок `ECONNRESET`.
