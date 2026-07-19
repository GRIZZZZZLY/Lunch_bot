# 🚀 WebApp Setup - Настройка туннелей для разработки

## Зачем нужны HTTPS туннели?

Telegram WebApp **требует HTTPS** для работы. В dev режиме используем туннели (ngrok/localtunnel) для получения HTTPS URL.

---

## 🎯 Быстрый старт (5 минут)

### Вариант 1: Один туннель через Proxy (РЕКОМЕНДУЕТСЯ)

**Плюсы:**
- ✅ Один URL для frontend и API
- ✅ Проще настроить
- ✅ Меньше путаницы

**Шаги:**

1. **Настройте proxy-server.js** (уже есть):
```javascript
// E:\BOT_V2\Lunch_bot\telegram-food-bot\proxy-server.js
const proxy = require('http-proxy');

proxy.createProxyServer({
  target: 'http://localhost:3001', // Backend
  changeOrigin: true,
}).listen(8080);
```

2. **Запустите все сервисы**:

```powershell
# Терминал 1: Backend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\backend
npm run dev

# Терминал 2: Frontend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
npm run dev

# Терминал 3: Proxy
cd E:\BOT_V2\Lunch_bot\telegram-food-bot
node proxy-server.js

# Терминал 4: ngrok
ngrok http 8080
```

3. **Скопируйте ngrok URL**:
```
https://abc123.ngrok-free.app
```

4. **Обновите конфиги**:

```bash
# Backend: E:\BOT_V2\Lunch_bot\telegram-food-bot\backend\.env
WEBAPP_URL=https://abc123.ngrok-free.app
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://abc123.ngrok-free.app

# Frontend: E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend\.env
VITE_API_URL=https://abc123.ngrok-free.app/api
```

5. **Перезапустите backend** (Ctrl+C, потом `npm run dev`)

✅ **Готово!** WebApp доступен по https://abc123.ngrok-free.app

---

### Вариант 2: Два отдельных туннеля

**Плюсы:**
- ✅ Прямой доступ к каждому сервису
- ✅ Легче дебажить

**Минусы:**
- ⚠️ Два URL нужно обновлять
- ⚠️ Больше терминалов

**Шаги:**

1. **Запустите сервисы**:

```powershell
# Терминал 1: Backend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\backend
npm run dev

# Терминал 2: Frontend
cd E:\BOT_V2\Lunch_bot\telegram-food-bot\frontend
npm run dev

# Терминал 3: Backend tunnel
ngrok http 3001
# → https://backend-xyz.ngrok-free.app

# Терминал 4: Frontend tunnel
ngrok http 5173
# → https://frontend-abc.ngrok-free.app
```

2. **Обновите конфиги**:

```bash
# Backend .env
WEBAPP_URL=https://frontend-abc.ngrok-free.app
CORS_ORIGIN=https://frontend-abc.ngrok-free.app

# Frontend .env
VITE_API_URL=https://backend-xyz.ngrok-free.app/api
```

3. **Перезапустите backend и frontend**

---

## 📦 Установка ngrok

### Windows:

```powershell
# Через winget
winget install ngrok

# Или скачайте с https://ngrok.com/download
```

### Регистрация (опционально, но рекомендуется):

1. Зарегистрируйтесь на https://ngrok.com
2. Получите authtoken
3. Настройте:

```powershell
ngrok config add-authtoken YOUR_TOKEN
```

**Плюсы регистрации:**
- Дольше живут туннели
- Меньше ограничений
- Можно использовать статичные домены (платно)

---

## 🔄 Альтернатива: localtunnel

**Проще установить, не требует регистрации:**

```powershell
# Установка
npm install -g localtunnel

# Запуск
lt --port 8080 --subdomain myfoodbot
# → https://myfoodbot.loca.lt

# Для двух туннелей:
lt --port 3001 --subdomain foodbot-api
lt --port 5173 --subdomain foodbot-app
```

**Минусы:**
- Может быть медленнее
- Иногда требует подтверждение в браузере

---

## ⚙️ Настройка proxy-server.js (для варианта 1)

Обновите файл для правильного роутинга:

```javascript
// E:\BOT_V2\Lunch_bot\telegram-food-bot\proxy-server.js
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  // API запросы → Backend (3001)
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    proxy.web(req, res, {
      target: 'http://localhost:3001',
      changeOrigin: true
    });
  } 
  // Все остальное → Frontend (5173)
  else {
    proxy.web(req, res, {
      target: 'http://localhost:5173',
      changeOrigin: true
    });
  }
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Proxy error');
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🔗 Proxy server running on http://localhost:${PORT}`);
  console.log(`   → Frontend: http://localhost:5173`);
  console.log(`   → Backend:  http://localhost:3001`);
});
```

---

## 🧪 Проверка работы

### 1. Проверьте что все запущено:

```powershell
# Backend
curl http://localhost:3001/health

# Frontend
curl http://localhost:5173

# Proxy (если используете)
curl http://localhost:8080
```

### 2. Проверьте ngrok:

```powershell
curl https://your-ngrok-url.ngrok-free.app/health
```

### 3. Откройте бота в Telegram:

1. Найдите @rocket_lunch_bot
2. Нажмите "Меню" внизу
3. Должен открыться WebApp!

---

## 🐛 Troubleshooting

### Menu Button не появился:

**Проблема:** WebApp URL не HTTPS

**Решение:**
```bash
# Проверьте backend/.env
WEBAPP_URL=https://...  # Должен быть HTTPS!
```

### CORS ошибки:

**Проблема:** Frontend не в CORS_ORIGIN

**Решение:**
```bash
# backend/.env
CORS_ORIGIN=https://your-ngrok-url.ngrok-free.app
```

### WebApp не загружается:

1. Проверьте что frontend запущен: http://localhost:5173
2. Проверьте что ngrok работает
3. Проверьте в браузере: https://your-ngrok-url.ngrok-free.app
4. Откройте DevTools в Telegram Desktop для дебага

### ngrok URL изменился:

**Проблема:** При перезапуске ngrok URL меняется

**Решение:**
1. Зарегистрируйтесь на ngrok.com
2. Используйте статичный домен (платно)
3. ИЛИ просто обновите .env файлы и перезапустите

---

## 📝 Checklist запуска

- [ ] ngrok установлен
- [ ] Backend запущен (localhost:3001)
- [ ] Frontend запущен (localhost:5173)
- [ ] Proxy запущен (localhost:8080) - если используете вариант 1
- [ ] ngrok туннель создан
- [ ] WEBAPP_URL обновлен в backend/.env
- [ ] CORS_ORIGIN обновлен в backend/.env
- [ ] VITE_API_URL обновлен в frontend/.env
- [ ] Backend перезапущен
- [ ] В логах backend: "Default menu button set for private chats"
- [ ] Menu Button появился в боте
- [ ] WebApp открывается

---

## 🎯 Production

Для production используйте реальный домен с HTTPS:

```bash
# backend/.env (production)
WEBAPP_URL=https://foodbot.yourdomain.com
CORS_ORIGIN=https://foodbot.yourdomain.com

# frontend/.env (production)
VITE_API_URL=https://api.yourdomain.com/api
```

См. [руководство по развёртыванию](./README.md) для инструкций по деплою.

---

## 💡 Советы

1. **Используйте Вариант 1** (один туннель) - проще
2. **Добавьте ngrok URL в избранное** - при разработке
3. **Используйте Telegram Desktop** - есть DevTools для дебага
4. **Сохраните команды в скрипт** - для быстрого запуска

---

**Готово! Теперь можете разрабатывать WebApp локально! 🚀**
