# 📱 MiniApp не открывается на смартфоне

## 🔍 Проблема

MiniApp открывается на **Telegram Desktop** (компьютер), но НЕ открывается на **смартфоне**.

## 🎯 Возможные причины

### 1. ⚠️ ngrok требует подтверждения на новом устройстве

**ЭТО САМАЯ ЧАСТАЯ ПРИЧИНА!**

ngrok показывает предупреждающую страницу при первом открытии с нового устройства:

```
You are about to visit: https://d8328ab355a6.ngrok-free.app
This site is served by ngrok. Click to proceed.
```

### 2. Разные ngrok URLs

Если backend был перезапущен, ngrok URL мог измениться.

### 3. WEBAPP_URL в боте устарел

Bot Menu Button может ссылаться на старый ngrok URL.

## ✅ Решение

### Шаг 1: Проверьте ngrok URL на смартфоне

1. **На смартфоне** откройте браузер (Chrome/Safari)
2. Введите URL: `https://d8328ab355a6.ngrok-free.app`
3. Должна появиться **страница подтверждения ngrok**
4. Нажмите **"Visit Site"** или **"Proceed"**
5. Должна открыться ваша webapp

**Если не открывается** - значит ngrok URL устарел!

### Шаг 2: Получите актуальный ngrok URL

#### Способ A: Из логов backend

В терминале с backend найдите:
```
Default menu button set for private chats {"webappUrl":"https://..."}
```

#### Способ B: Из окна ngrok

В отдельном окне ngrok ищите:
```
Forwarding: https://ваш-url.ngrok-free.app -> http://localhost:8080
```

#### Способ C: Через ngrok API

```powershell
Invoke-RestMethod http://127.0.0.1:4040/api/tunnels | Select-Object -ExpandProperty tunnels | Select-Object public_url
```

### Шаг 3: Обновите ngrok URL

Используйте скрипт:

```powershell
.\update-ngrok-url.ps1 "https://ваш-актуальный-url.ngrok-free.app"
```

### Шаг 4: Перезапустите backend

**ВАЖНО!** Нужно перезапустить только backend, чтобы обновить Menu Button:

```powershell
# В окне с backend нажмите Ctrl+C, затем:
cd backend
npm run dev
```

В логах должно появиться:
```
Default menu button set for private chats {"webappUrl":"https://новый-url.ngrok-free.app"}
```

### Шаг 5: Перезапустите Telegram на смартфоне

1. **Закройте** Telegram на смартфоне (убедитесь что полностью закрыт)
2. **Откройте** Telegram заново
3. Найдите бота `@rocket_lunch_bot`
4. Нажмите **Menu**

## 🧪 Проверка что все работает

### На смартфоне:

1. Откройте браузер
2. Перейдите: `https://d8328ab355a6.ngrok-free.app`
3. Нажмите "Visit Site" если появляется предупреждение
4. Должна открыться webapp
5. В адресной строке скопируйте URL

### В Telegram на смартфоне:

1. Откройте `@rocket_lunch_bot`
2. Нажмите **Menu** (внизу)
3. WebApp должен открыться

Если не открывается:
- Закройте и откройте Telegram полностью
- Проверьте что Menu Button URL совпадает с ngrok URL

## 🔍 Дополнительная диагностика

### Проверка Menu Button

Через Telegram Bot API:

```powershell
$token = "REDACTED-BOT-TOKEN"
Invoke-RestMethod "https://api.telegram.org/bot$token/getChatMenuButton"
```

Ответ должен содержать:
```json
{
  "ok": true,
  "result": {
    "type": "web_app",
    "text": "Menu",
    "web_app": {
      "url": "https://d8328ab355a6.ngrok-free.app"
    }
  }
}
```

### Вручную обновить Menu Button

```powershell
$token = "REDACTED-BOT-TOKEN"
$url = "https://d8328ab355a6.ngrok-free.app"

$body = @{
  menu_button = @{
    type = "web_app"
    text = "Menu"
    web_app = @{
      url = $url
    }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setChatMenuButton" -Body $body -ContentType "application/json"
```

## 🚀 Быстрое решение

Если нужно СРОЧНО:

```powershell
# 1. Получите новый ngrok URL
# Смотрите в окно ngrok или в логи backend

# 2. Обновите .env файлы
.\update-ngrok-url.ps1 "https://новый-url.ngrok-free.app"

# 3. Перезапустите ТОЛЬКО backend
# В окне backend: Ctrl+C, затем npm run dev

# 4. Подождите 5 секунд

# 5. На смартфоне:
#    - Закройте Telegram ПОЛНОСТЬЮ
#    - Откройте заново
#    - Нажмите Menu в боте
```

## 💡 Для стабильной работы

### Используйте постоянный ngrok домен (платная версия)

Или используйте альтернативы:
- **localtunnel**: `npm install -g localtunnel`
- **cloudflared**: `cloudflared tunnel`
- **serveo**: `ssh -R 80:localhost:8080 serveo.net`

### Используйте webhook вместо polling (продакшен)

В продакшене используйте фиксированный домен и webhook.

---

**Создано:** 2025-01-06  
**Статус:** 🔧 Diagnostic Guide  
**Приоритет:** 🔥 Critical
