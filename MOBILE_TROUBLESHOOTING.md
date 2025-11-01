# 📱 Troubleshooting: Mini App не открывается на мобильном

## ❌ Проблема
Mini App открывается на десктопе, но НЕ открывается в мобильном приложении Telegram.

---

## 🔍 Диагностика

### Шаг 1: Проверьте что именно происходит на мобильном

**Откройте бота на мобильном и нажмите Menu:**

**A) Белый экран?**
- ✅ Проблема: ngrok блокирует или SSL ошибка
- 🔧 Решение: см. ниже "ngrok интерстициальная страница"

**B) "You are about to visit..." страница?**
- ✅ Проблема: ngrok показывает предупреждение
- 🔧 Решение: Нажмите "Visit Site", затем перезапустите бота

**C) Ничего не происходит (не открывается)?**
- ✅ Проблема: Menu Button не настроен или старый URL
- 🔧 Решение: Обновите Menu Button

**D) Ошибка "Failed to load"?**
- ✅ Проблема: Backend недоступен или CORS
- 🔧 Решение: Проверьте backend логи

---

## 🔧 Решения

### Решение 1: ngrok интерстициальная страница (НАИБОЛЕЕ ВЕРОЯТНО)

ngrok Free показывает предупреждение при первом открытии с нового устройства.

**Способ A: Зарегистрируйте ngrok аккаунт (рекомендуется)**

```bash
# 1. Зарегистрируйтесь на https://dashboard.ngrok.com/signup

# 2. Получите authtoken на https://dashboard.ngrok.com/get-started/your-authtoken

# 3. Установите authtoken:
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE

# 4. Перезапустите ngrok
# Теперь интерстициальной страницы не будет
```

**Способ B: "Whitelist" домен в Telegram**

1. Откройте мобильное приложение Telegram
2. Найдите бота `@rocket_lunch_bot`
3. Нажмите Menu
4. Когда появится "You are about to visit..." - нажмите **"Visit Site"**
5. **Важно:** Telegram запомнит этот домен
6. Закройте и откройте бота снова - теперь должно работать

**Способ C: Используйте альтернативу ngrok**

Если ngrok не работает, попробуйте:

```bash
# localtunnel (бесплатно, без ограничений)
npm install -g localtunnel
lt --port 8080

# Или serveo (ssh туннель)
ssh -R 80:localhost:8080 serveo.net
```

---

### Решение 2: Обновите Menu Button

Возможно Menu Button открывает старый URL.

**Скрипт для обновления Menu Button:**

```bash
cd telegram-food-bot/backend
node -e "
const https = require('https');
const BOT_TOKEN = process.env.BOT_TOKEN || 'REDACTED-BOT-TOKEN';
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://epicritic-uninspiredly-makai.ngrok-free.dev';

const options = {
  hostname: 'api.telegram.org',
  path: \`/bot\${BOT_TOKEN}/setChatMenuButton\`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const data = JSON.stringify({
  menu_button: {
    type: 'web_app',
    text: '📋 Мои группы',
    web_app: { url: WEBAPP_URL }
  }
});

console.log('🔄 Updating Menu Button...');
console.log('URL:', WEBAPP_URL);

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    const result = JSON.parse(responseData);
    if (result.ok) {
      console.log('✅ Menu Button updated!');
      console.log('📱 Now:');
      console.log('  1. Close Telegram app completely');
      console.log('  2. Open again');
      console.log('  3. Try Menu button');
    } else {
      console.log('❌ Error:', result.description);
    }
  });
});

req.write(data);
req.end();
"
```

**После обновления:**
1. **Полностью закройте** Telegram на мобильном (не просто сверните)
2. Откройте снова
3. Попробуйте Menu button

---

### Решение 3: Очистите кэш Telegram на мобильном

**Android:**
```
Настройки → Данные и хранилище → Использование памяти → Очистить кэш
```

**iOS:**
```
Настройки → Данные и память → Очистить кэш
```

Или:
1. Удалите чат с ботом
2. Найдите бота снова
3. Нажмите `/start`
4. Попробуйте Menu

---

### Решение 4: Проверьте CORS настройки

Мобильное приложение может отправлять другие заголовки.

**Проверьте backend/.env:**

```bash
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,https://epicritic-uninspiredly-makai.ngrok-free.dev
```

**Убедитесь что ngrok URL там есть!**

---

### Решение 5: Проверьте что backend запущен

```bash
# Проверка что backend отвечает
curl https://epicritic-uninspiredly-makai.ngrok-free.dev/api/health

# Должен вернуть:
# {"status":"ok","timestamp":"..."}
```

Если ошибка - backend не работает или ngrok не пробрасывает запросы.

---

## 🧪 Тест на мобильном

### Способ 1: Через браузер на мобильном

1. Откройте браузер на мобильном
2. Зайдите на `https://epicritic-uninspiredly-makai.ngrok-free.dev`
3. Если появляется "You are about to visit..." - нажмите "Visit Site"
4. Если открывается - значит ngrok работает
5. Теперь попробуйте через Telegram

### Способ 2: Remote Debug

**На Android:**

1. Подключите телефон к компьютеру по USB
2. Включите "USB Debugging" на телефоне
3. Откройте Chrome на компьютере: `chrome://inspect`
4. Откройте Mini App в Telegram на телефоне
5. В Chrome нажмите "Inspect" для Mini App
6. Смотрите ошибки в Console

**На iOS:**

1. Подключите iPhone к Mac по кабелю
2. Откройте Safari → Develop → [Your iPhone] → [Mini App]
3. Смотрите ошибки в Console

---

## ✅ Быстрое решение (рекомендуется)

**Если срочно нужно заработать:**

1. **Зарегистрируйтесь в ngrok:**
   - https://dashboard.ngrok.com/signup
   - Получите authtoken
   - `ngrok config add-authtoken YOUR_TOKEN`

2. **Перезапустите все:**
   ```bash
   # Закройте все окна start-dev.ps1
   # Запустите заново
   .\start-dev.ps1
   ```

3. **Обновите Menu Button:**
   - Запустите скрипт выше
   - Или через `update-urls.ps1`

4. **Закройте Telegram на мобильном:**
   - Полностью закройте приложение
   - Откройте снова
   - Нажмите Menu

**Должно заработать!**

---

## 🆘 Если ничего не помогло

### Plan B: Используйте localtunnel вместо ngrok

```powershell
# Установите localtunnel
npm install -g localtunnel

# Запустите вместо ngrok
lt --port 8080 --subdomain rocket-lunch-bot

# Скопируйте URL (например: https://rocket-lunch-bot.loca.lt)
# Обновите .env файлы с этим URL
# Обновите Menu Button
```

localtunnel не показывает интерстициальную страницу!

---

## 📊 Чек-лист диагностики

- [ ] ngrok работает (проверил через браузер на мобильном)
- [ ] Нет интерстициальной страницы ngrok
- [ ] Menu Button обновлен с правильным URL
- [ ] Backend запущен и отвечает
- [ ] CORS_ORIGIN содержит ngrok URL
- [ ] Кэш Telegram очищен на мобильном
- [ ] Telegram закрыт полностью и открыт снова
- [ ] initData валидация не блокирует (SKIP_TELEGRAM_VALIDATION=true)

---

## 💡 Лучшая практика

**Для разработки через мобильное:**

1. Зарегистрируйте ngrok аккаунт (бесплатно)
2. Используйте authtoken
3. Или используйте localtunnel (без ограничений)
4. В production используйте реальный HTTPS сервер (не ngrok)

---

## 🎯 Итог

**Наиболее вероятная причина:** ngrok показывает "You are about to visit..." страницу на мобильном.

**Быстрое решение:** 
1. Зарегистрируйтесь в ngrok
2. Добавьте authtoken
3. Перезапустите ngrok
4. Обновите Menu Button
5. Закройте Telegram полностью и откройте снова

Это должно решить проблему в 90% случаев!
