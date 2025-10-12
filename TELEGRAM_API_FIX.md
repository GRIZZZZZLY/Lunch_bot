# ⚡ Быстрое решение проблемы с Telegram API

## 🔴 Проблема
```
ETIMEDOUT: connect ETIMEDOUT 149.154.167.220:443
Network request for 'getMe' failed!
```

**Причина:** Telegram API заблокирован в России

---

## ✅ Решение (3 простых шага)

### Шаг 1: Получите прокси или VPN

**Вариант A: VPN (самое простое)**
- Установите любой VPN (ProtonVPN, Mullvad, WireGuard)
- Включите VPN
- Всё! Больше ничего не нужно

**Вариант B: HTTP прокси**
Бесплатные прокси (для теста):
- https://free-proxy-list.net/
- https://hidemy.name/ru/proxy-list/
- https://www.proxy-list.download/

Платные прокси (для production):
- https://proxy6.net/ (российский, от 50₽/мес)
- https://brightdata.com/
- https://smartproxy.com/

### Шаг 2: Настройте `.env` файл

Откройте файл:
```
telegram-food-bot/backend/.env.prod-dev
```

Найдите секцию `# PROXY SETTINGS` и измените:

```bash
# Для HTTP/HTTPS прокси:
USE_PROXY=true
PROXY_URL=http://185.123.123.123:8080

# Или с авторизацией:
PROXY_URL=http://username:password@proxy-server.com:8080

# Для SOCKS5:
PROXY_URL=socks5://localhost:1080
```

### Шаг 3: Перезапустите бота

```powershell
# Остановите текущие процессы (Ctrl+C в каждом окне)
# Затем запустите снова:
.\telegram-food-bot\start-prod-dev.ps1
```

---

## 🧪 Проверка работы

В логах бэкенда должно быть:

✅ **С прокси:**
```
🔧 Используется прокси для подключения к Telegram API
🤖 Бот инициализирован { username: 'rocket_lunch_bot' }
🚀 Бот запущен в polling режиме
```

❌ **Без прокси (ошибка):**
```
❌ Ошибка запуска бота: Network request for 'getMe' failed!
ETIMEDOUT: connect ETIMEDOUT 149.154.167.220:443
```

---

## 📋 Быстрая проверка прокси

Проверьте, работает ли прокси:

### PowerShell:
```powershell
# Проверка без прокси (должна упасть в России)
curl https://api.telegram.org/

# Проверка с прокси (должна работать)
$env:HTTPS_PROXY = "http://185.123.123.123:8080"
curl https://api.telegram.org/
```

### Node.js тест:
Создайте файл `telegram-food-bot/test-proxy.js`:

```javascript
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

const PROXY = 'http://185.123.123.123:8080'; // Замените на ваш прокси
const BOT_TOKEN = '8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk';

const agent = new HttpsProxyAgent(PROXY);

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { agent })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      console.log('✅ Прокси работает! Бот:', data.result.username);
    } else {
      console.error('❌ Ошибка API:', data);
    }
  })
  .catch(err => console.error('❌ Прокси не работает:', err.message));
```

Запустите:
```bash
cd telegram-food-bot
npm install node-fetch@2
node test-proxy.js
```

---

## ⚙️ Примеры конфигурации

### HTTP прокси без авторизации:
```bash
USE_PROXY=true
PROXY_URL=http://185.123.123.123:8080
```

### HTTP прокси с авторизацией:
```bash
USE_PROXY=true
PROXY_URL=http://user:pass@proxy-server.com:8080
```

### SOCKS5 (например, через SSH туннель):
```bash
USE_PROXY=true
PROXY_URL=socks5://localhost:1080
```

### Локальный Telegram Bot API сервер:
```bash
USE_LOCAL_API=true
LOCAL_API_URL=http://localhost:8081
```

---

## 🚨 Troubleshooting

### Ошибка "ETIMEDOUT" остается
1. Проверьте, что прокси работает (см. "Быстрая проверка прокси")
2. Попробуйте другой прокси из списка
3. Убедитесь, что `USE_PROXY=true` (без кавычек!)

### Ошибка "ENOTFOUND"
Неверный адрес прокси. Проверьте формат:
```
http://host:port  ❌ без http://
http://host:port  ✅ правильно
```

### "Proxy authentication required"
Добавьте логин/пароль:
```bash
PROXY_URL=http://username:password@host:port
```

### Прокси медленный
- Попробуйте прокси ближе к вам (Россия/Европа)
- Используйте платный прокси
- Рассмотрите VPN на всю систему (проще!)

---

## 🎯 Рекомендации

**Для разработки:**
- ✅ VPN на всю систему (самое простое!)
- ✅ Бесплатный HTTP прокси (для теста)

**Для production:**
- ✅ Платный прокси (proxy6.net от 50₽/мес)
- ✅ VPS за границей + локальный Telegram Bot API
- ❌ НЕ используйте бесплатные прокси!

---

## 📚 Дополнительная информация

Полная инструкция: `telegram-food-bot/TELEGRAM_API_PROXY_SETUP.md`

---

## 💬 Нужна помощь?

1. Проверьте логи бэкенда (окно Backend PROD-DEV)
2. Убедитесь, что прокси работает (см. "Быстрая проверка прокси")
3. Попробуйте VPN (самый простой вариант!)

---

**После настройки прокси бот должен запуститься без ошибок! 🚀**
