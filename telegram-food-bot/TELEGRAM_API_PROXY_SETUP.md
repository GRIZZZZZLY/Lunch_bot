# 🌐 Настройка прокси для Telegram API

## 🔴 Проблема

Telegram API (`api.telegram.org`) может быть заблокирован в России, что приводит к ошибкам:
```
ETIMEDOUT: connect ETIMEDOUT 149.154.167.220:443
Network request for 'getMe' failed!
```

## ✅ Решения

### **Вариант 1: HTTP/HTTPS прокси (Рекомендуется)**

#### 1. Получите рабочий прокси
Варианты:
- **VPN с HTTP прокси** (ExpressVPN, NordVPN, ProtonVPN)
- **Бесплатные прокси** (не рекомендуется для production):
  - https://www.proxy-list.download/
  - https://free-proxy-list.net/
  - https://hidemy.name/ru/proxy-list/
- **Платные прокси сервисы**:
  - https://brightdata.com/
  - https://smartproxy.com/
  - https://proxy6.net/ (российский)

#### 2. Настройте в `.env` файле

Откройте `telegram-food-bot/backend/.env.prod-dev` и добавьте:

```bash
# Включаем прокси
USE_PROXY=true

# HTTP прокси без авторизации
PROXY_URL=http://proxy-server.com:8080

# Или с авторизацией
PROXY_URL=http://username:password@proxy-server.com:8080
```

#### 3. Перезапустите бэкенд

```powershell
# Остановите текущий процесс (Ctrl+C)
# Затем перезапустите
cd telegram-food-bot/backend
npm run dev
```

---

### **Вариант 2: SOCKS5 прокси**

#### 1. Установите SOCKS5 прокси
Варианты:
- **Shadowsocks** (популярный в Китае/России)
- **Tor** (медленно, но бесплатно): `socks5://localhost:9050`
- **SSH туннель** на свой сервер за границей:
  ```bash
  ssh -D 1080 -f -C -q -N user@your-server.com
  ```

#### 2. Настройте в `.env` файле

```bash
USE_PROXY=true
PROXY_URL=socks5://localhost:1080

# Или с авторизацией
PROXY_URL=socks5://username:password@proxy-server.com:1080
```

#### 3. Перезапустите бэкенд

---

### **Вариант 3: Локальный Telegram Bot API сервер (Продвинутый)**

Этот вариант запускает собственный сервер Telegram Bot API на вашей машине или VPS за границей.

#### 1. Установите локальный Telegram Bot API сервер

**На Windows (Docker):**
```powershell
docker run -d -p 8081:8081 --name telegram-bot-api aiogram/telegram-bot-api:latest
```

**На Linux/VPS:**
```bash
git clone https://github.com/tdlib/telegram-bot-api.git
cd telegram-bot-api
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build . --target install
```

#### 2. Запустите сервер

```bash
telegram-bot-api --api-id=YOUR_API_ID --api-hash=YOUR_API_HASH --local
```

Где взять `api-id` и `api-hash`: https://my.telegram.org/apps

#### 3. Настройте в `.env` файле

```bash
USE_LOCAL_API=true
LOCAL_API_URL=http://localhost:8081
```

#### 4. Перезапустите бэкенд

---

### **Вариант 4: VPN на всю систему (Самый простой)**

Если у вас уже есть VPN:

1. Включите VPN
2. Убедитесь, что VPN работает:
   ```powershell
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
   ```
3. Запустите бота без изменений в `.env`

**Рекомендуемые VPN для разработки:**
- WireGuard (быстрый, open-source)
- OpenVPN (стабильный)
- ProtonVPN (бесплатный план)
- Mullvad (приватный)

---

## 🧪 Проверка подключения

После настройки проверьте подключение к Telegram API:

### Windows PowerShell:
```powershell
# С прокси (замените на свой)
$proxy = "http://proxy-server.com:8080"
$env:HTTPS_PROXY = $proxy
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

### Или через Node.js:
```javascript
// test-telegram-connection.js
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

const BOT_TOKEN = '8298516078:AAF3QAaoVURt634PcNtwMKiExF2nILnziGk';
const PROXY_URL = 'http://proxy-server.com:8080'; // Ваш прокси

const agent = new HttpsProxyAgent(PROXY_URL);

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, {
  agent,
})
  .then(res => res.json())
  .then(data => console.log('✅ Подключение успешно:', data))
  .catch(err => console.error('❌ Ошибка:', err));
```

Запуск:
```bash
node test-telegram-connection.js
```

---

## 📋 Troubleshooting

### "ETIMEDOUT" ошибка остается

1. **Проверьте прокси**:
   ```bash
   curl -x http://proxy-server.com:8080 https://api.telegram.org/
   ```

2. **Убедитесь, что прокси поддерживает HTTPS**

3. **Попробуйте другой прокси сервер**

### "ENOTFOUND" ошибка

Прокси сервер не найден, проверьте URL в `PROXY_URL`

### Прокси требует авторизацию

Добавьте `username:password` в URL:
```bash
PROXY_URL=http://myuser:mypass@proxy-server.com:8080
```

### Медленная работа

- Попробуйте прокси ближе к вам географически
- Используйте платный прокси вместо бесплатного
- Рассмотрите вариант с локальным Telegram Bot API на VPS

---

## 🎯 Рекомендации

**Для локальной разработки:**
- ✅ Вариант 4 (VPN на всю систему) - самый простой
- ✅ Вариант 1 (HTTP прокси) - стабильно и быстро

**Для production:**
- ✅ Вариант 3 (Локальный Telegram Bot API на VPS за границей)
- ✅ Вариант 1 (Надежный платный прокси)

**НЕ рекомендуется для production:**
- ❌ Бесплатные прокси (медленно, ненадежно)
- ❌ Tor (очень медленно)

---

## 📚 Полезные ссылки

- [Grammy документация по прокси](https://grammy.dev/guide/deployment-types.html#long-polling)
- [Telegram Bot API локальный сервер](https://github.com/tdlib/telegram-bot-api)
- [Lista бесплатных прокси](https://free-proxy-list.net/)
- [WireGuard VPN setup](https://www.wireguard.com/quickstart/)

---

## 💡 Быстрый старт (самый простой вариант)

Если у вас есть прокси:

1. Откройте `telegram-food-bot/backend/.env.prod-dev`
2. Найдите секцию `# PROXY SETTINGS`
3. Измените:
   ```bash
   USE_PROXY=true
   PROXY_URL=http://ваш-прокси:порт
   ```
4. Сохраните файл
5. Перезапустите `start-prod-dev.ps1`

Готово! 🚀
