# 🔄 Что делать при перезапуске ngrok

## 📋 Кратко

Каждый раз когда **ngrok перезапускается**, его URL меняется. Нужно:

1. ✅ Обновить `.env` файлы (4 файла)
2. ✅ Обновить Telegram webhook
3. ✅ Перезапустить backend

**Наш скрипт делает ВСЁ это автоматически!** 🎉

---

## 🚀 Автоматический способ (Рекомендуется)

### Запуск проекта:

```powershell
.\start-dev.ps1
```

**Что произойдет:**
1. Откроются 5 окон терминала:
   - Window 1: Backend (port 3001)
   - Window 2: Frontend (port 5173)
   - Window 3: Proxy (port 8080)
   - Window 4: ngrok (туннель)
   - Window 5: URL Updater (автоматизация)

### В окне "URL Updater":

1. **Скопируйте ngrok URL** из окна 4 (ngrok)
   ```
   Forwarding: https://abc123.ngrok-free.app -> http://localhost:8080
   ```

2. **Вставьте URL** в окне 5 (URL Updater)
   ```
   Paste your ngrok URL: https://abc123.ngrok-free.app
   ```

3. **Скрипт автоматически:**
   - ✅ Обновит все 4 `.env` файла
   - ✅ Закроет старый backend
   - ✅ Откроет новый backend
   - ✅ Установит Telegram webhook
   - ✅ Проверит что всё работает

4. **Готово!** Тестируйте бота в Telegram

---

## 🔧 Ручной способ

Если нужно обновить URL вручную:

### 1. Обновить .env файлы:

```powershell
.\update-urls.ps1 -NgrokUrl "https://YOUR_URL.ngrok-free.app"
```

Или интерактивно:
```powershell
.\update-urls.ps1
# Затем вставьте URL когда попросит
```

### 2. Готово!

Скрипт автоматически:
- Обновит все `.env` файлы
- Перезапустит backend
- Установит webhook

---

## ❌ Частые ошибки

### ERR_NGROK_3200 в Telegram

**Причина:** Telegram webhook указывает на старый ngrok URL

**Решение:**
```powershell
# Вариант 1: Используйте наш скрипт
.\update-urls.ps1

# Вариант 2: Установите webhook вручную
$botToken = "YOUR_BOT_TOKEN"
$ngrokUrl = "https://YOUR_URL.ngrok-free.app"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/setWebhook?url=$ngrokUrl/api/webhook" -Method POST
```

---

### Backend не перезапустился

**Причина:** Порт 3001 занят старым процессом

**Решение:**
```powershell
# Убить процесс на порту 3001
$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
$connections.OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Запустить backend заново
cd backend
npm run dev
```

---

### WebApp не открывается в Telegram

**Проверьте:**

1. **Backend работает?**
   ```powershell
   # Должен показать процесс на порту 3001
   Get-NetTCPConnection -LocalPort 3001
   ```

2. **ngrok работает?**
   ```powershell
   # Должен показать туннель
   Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
   ```

3. **Webhook установлен?**
   ```powershell
   $botToken = "YOUR_BOT_TOKEN"
   Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo"
   ```

4. **Endpoint доступен?**
   ```powershell
   Invoke-WebRequest -Uri "https://YOUR_URL.ngrok-free.app"
   ```

---

## 📝 Что обновляется автоматически

### .env файлы (4 шт):

| Файл | Переменная | Значение |
|------|-----------|----------|
| `backend/.env` | WEBAPP_URL | https://xxx.ngrok-free.app |
| `backend/.env` | CORS_ORIGIN | localhost + ngrok URL |
| `backend/.env.development` | WEBAPP_URL | https://xxx.ngrok-free.app |
| `backend/.env.development` | CORS_ORIGIN | localhost + ngrok URL |
| `frontend/.env` | VITE_API_URL | https://xxx.ngrok-free.app/api |
| `frontend/.env.development` | VITE_API_URL | https://xxx.ngrok-free.app/api |

### Telegram Webhook:

```
URL: https://xxx.ngrok-free.app/api/webhook
```

### Backend:

- Старый процесс убит
- Старое окно закрыто
- Новое окно открыто с обновленными настройками

---

## 🎯 Checklist после обновления URL

- [ ] Все 4 `.env` файла обновлены
- [ ] Backend перезапущен в новом окне
- [ ] Telegram webhook установлен
- [ ] ngrok туннель активен
- [ ] Endpoint доступен (https://xxx.ngrok-free.app)
- [ ] Backend работает на порту 3001
- [ ] Бот отвечает в Telegram
- [ ] WebApp открывается по кнопке "Menu"

---

## 💡 Советы

### 1. Используйте ngrok с постоянным доменом

Если у вас **ngrok Pro**, используйте постоянный домен:
```powershell
ngrok http 8080 --domain=your-static-domain.ngrok-free.app
```

Тогда URL не будет меняться при перезапуске!

### 2. Сохраните последний ngrok URL

Файл `backups/` содержит все предыдущие версии `.env` файлов.

### 3. Проверяйте webhook регулярно

```powershell
# Быстрая проверка
$botToken = (Select-String -Path "backend\.env" -Pattern "BOT_TOKEN=(.+)").Matches.Groups[1].Value
Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo" | ConvertTo-Json
```

---

## 📞 Поддержка

Если что-то не работает:

1. Проверьте логи backend в окне терминала
2. Проверьте ngrok dashboard: http://127.0.0.1:4040
3. Проверьте Telegram webhook info
4. Посмотрите backups для отката изменений

---

**Последнее обновление:** 2025-10-06
