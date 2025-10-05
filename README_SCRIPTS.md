# 📜 Dev Scripts Reference

## 🚀 Main Scripts

### `start-dev.ps1` - Start Everything (RECOMMENDED)
Запускает ВСЁ окружение автоматически:
- Backend, Frontend, Proxy, ngrok
- **URL Updater для автоматической настройки**

```powershell
.\start-dev.ps1
```

**Опции:**
```powershell
.\start-dev.ps1 -SkipChecks    # Пропустить проверку зависимостей
.\start-dev.ps1 -NoNgrok       # Без ngrok
```

**Что происходит:**
1. Проверяет зависимости (Node.js, ngrok)
2. Открывает 5 окон терминала
3. Окно 5 запрашивает ngrok URL
4. Автоматически обновляет `.env` файлы
5. Автоматически перезапускает Backend
6. Готово к тестированию! ✅

---

### `update-urls.ps1` - Update ngrok URLs
Автоматически обновляет ngrok URL в `.env` файлах.

```powershell
.\update-urls.ps1
```

**С параметром:**
```powershell
.\update-urls.ps1 -NgrokUrl "https://abc123.ngrok-free.app"
```

**Что делает:**
1. Запрашивает ngrok URL (если не указан)
2. Проверяет формат URL
3. Создает backup файлов `.env`
4. Обновляет:
   - `backend\.env` → `WEBAPP_URL`
   - `backend\.env` → `CORS_ORIGIN`
   - `frontend\.env` → `VITE_API_URL`
5. Предлагает перезапустить Backend

**Backups:** Сохраняются в `backups\env_YYYYMMDD_HHmmss\`

---

### `stop-dev.ps1` - Stop All Services
Останавливает все dev процессы.

```powershell
.\stop-dev.ps1
```

**Что делает:**
- Убивает все процессы Node.js
- Убивает все процессы ngrok

---

## 📦 Legacy Scripts (для совместимости)

### `dev-start-proxy.ps1` - Manual Start with Proxy
Ручной запуск с Proxy (требует ручной настройки URL).

```powershell
.\dev-start-proxy.ps1
```

### `dev-start-ngrok.ps1` - Manual Start with 2 Tunnels
Ручной запуск с двумя ngrok туннелями.

```powershell
.\dev-start-ngrok.ps1
```

---

## 📖 Документация

- **START_HERE.md** - Быстрый старт (начните здесь!)
- **WEBAPP_QUICK_START.md** - Детальная инструкция
- **WEBAPP_SETUP.md** - Настройка туннелей
- **DEV_README.md** - Информация о dev окружении

---

## 🧪 Typical Workflow

### Первый запуск:
```powershell
# 1. Установить ngrok
winget install ngrok

# 2. Запустить всё
.\start-dev.ps1

# 3. В окне 5 (URL Updater):
#    - Скопировать ngrok URL из окна 4
#    - Вставить и нажать Enter
#    - Дождаться автоматической настройки

# 4. Тестировать в Telegram!
```

### Повторные запуски:
```powershell
# Если ngrok URL не изменился:
.\start-dev.ps1 -SkipChecks

# Окно 5 автоматически использует сохраненный URL
# или можно ввести новый
```

### Обновление только URL:
```powershell
# Если нужно только обновить URL:
.\update-urls.ps1

# Введите новый ngrok URL
# Backend перезапустится автоматически
```

### Остановка:
```powershell
# Остановить всё:
.\stop-dev.ps1

# Или закрыть окна терминалов вручную
```

---

## 🔧 Troubleshooting

### "ngrok not installed"
```powershell
winget install ngrok
# или
choco install ngrok
```

### "Node.js not installed"
```powershell
winget install OpenJS.NodeJS
```

### Backend не перезапускается автоматически
```powershell
# Вручную:
# 1. Найти окно Backend
# 2. Ctrl+C
# 3. npm run dev
```

### Порты заняты
```powershell
# Остановить все процессы:
.\stop-dev.ps1

# Затем запустить снова:
.\start-dev.ps1
```

### Нужно изменить ngrok URL
```powershell
# Запустить скрипт обновления:
.\update-urls.ps1

# Ввести новый URL
```

---

## 💡 Tips & Tricks

### Сохраните ngrok URL
При первом запуске, сохраните ngrok URL в блокноте.  
При следующих запусках можно быстро вставить его.

### Используйте authtoken ngrok
```powershell
ngrok config add-authtoken YOUR_TOKEN
```
Это даст:
- Более длительные туннели
- Меньше ограничений
- Возможность статических доменов

### Отключите проверки для быстрого запуска
```powershell
.\start-dev.ps1 -SkipChecks
```

### Используйте один ngrok туннель
Proxy объединяет Backend и Frontend → один URL для всего!

---

**Готово! Удачной разработки! 🚀**
