# 🚀 Quick Start - Telegram Food Bot

## Запуск за 3 шага:

### 1️⃣ Установите ngrok:
```powershell
winget install ngrok
```

### 2️⃣ Запустите всё:
```powershell
.\start-dev.ps1
```

Откроется **5 окон терминала**:
- ✅ Backend (порт 3001)
- ✅ Frontend (порт 5173)  
- ✅ Proxy (порт 8080)
- ✅ ngrok (HTTPS)
- ✅ **URL Updater (автонастройка!)** ⭐

### 3️⃣ Скопируйте ngrok URL в окно URL Updater:

**В окне 5 (URL Updater):**
1. Скопируйте ngrok URL из окна 4:
   ```
   https://abc123.ngrok-free.app
   ```
2. Вставьте URL в окно URL Updater и нажмите Enter

**Всё остальное произойдет автоматически!** ✨
- ✅ Обновятся файлы `.env`
- ✅ Перезапустится Backend
- ✅ Готово к тестированию!

---

## ✅ Готово!

Откройте бота в Telegram:
- Найдите `@rocket_lunch_bot`
- Нажмите кнопку "📋 Мои группы" (слева от поля ввода)
- WebApp откроется! 🎉

---

## 🛑 Остановка всех сервисов:

```powershell
.\stop-dev.ps1
```

Или закройте все окна терминалов вручную.

---

## 📖 Документация:

- **WEBAPP_QUICK_START.md** - полная инструкция
- **DEV_README.md** - информация о dev окружении
- **DEV_MANUAL_TESTING.md** - сценарии тестирования
- **WEBAPP_SETUP.md** - детальная настройка туннелей

---

## 🐛 Проблемы?

### WebApp не открывается:
1. Проверьте что ngrok запущен
2. Проверьте что WEBAPP_URL в backend\.env - HTTPS
3. Перезапустите Backend

### Ошибка авторизации:
1. Проверьте что backend перезапущен после обновления .env
2. Проверьте что CORS_ORIGIN содержит ngrok URL
3. В логах backend должно быть: "✅ Default menu button set"

### CORS ошибки:
1. Добавьте ngrok URL в CORS_ORIGIN (backend\.env)
2. Перезапустите Backend

---

**Готово! Приятной разработки! 🚀**
