# 🚀 Руководство по скриптам запуска

## 📋 Какой скрипт использовать?

### Для локальной разработки через ngrok:

```powershell
# ✅ РЕКОМЕНДУЕТСЯ
.\start-prod-dev.ps1
```

**Особенности:**
- ✅ Production сборка (быстро, оптимизировано)
- ✅ Watch mode (автопересборка при изменениях)
- ✅ `SKIP_TELEGRAM_VALIDATION=true` (работает с ngrok)
- ✅ Console.log сохранен для отладки
- ✅ Source maps включены
- ✅ 5 окон: Backend, Frontend, Proxy, ngrok, URL Updater

**Когда использовать:**
- Разработка с тестированием на реальном устройстве
- Нужна скорость production, но удобство development
- Работа через ngrok

---

### Для классической локальной разработки:

```powershell
.\start-dev.ps1
```

**Особенности:**
- 🔥 Hot Module Replacement (HMR)
- 🐌 Медленнее, чем prod-dev
- ✅ `SKIP_TELEGRAM_VALIDATION=true`
- ✅ Console.log и отладка
- ✅ 4 окна: Backend, Frontend dev server, Proxy, ngrok

**Когда использовать:**
- Активная разработка интерфейса
- Нужен HMR для мгновенного обновления
- Не важна скорость

---

### Для production на сервере:

```powershell
.\start-prod.ps1
```

**Особенности:**
- 🔒 Полная проверка безопасности
- ⚠️ `SKIP_TELEGRAM_VALIDATION=false` (НЕ работает с ngrok!)
- ✅ Production сборка
- ❌ Нет watch mode
- 🚀 Только 3 окна: Backend, ngrok, URL Updater

**Когда использовать:**
- Деплой на реальный сервер
- Финальное тестирование перед production
- **НЕ для локальной разработки через ngrok!**

---

## 🆚 Сравнение

| Функция | `start-dev.ps1` | `start-prod-dev.ps1` | `start-prod.ps1` |
|---------|----------------|---------------------|------------------|
| Скорость сборки | 🐌 Медленная | ⚡ Быстрая | ⚡ Быстрая |
| HMR | ✅ Да | ❌ Нет | ❌ Нет |
| Watch mode | ✅ Да | ✅ Да | ❌ Нет |
| Minification | ❌ Нет | ✅ Да | ✅ Да |
| Source maps | ✅ Да | ✅ Да | ❌ Нет |
| Console.log | ✅ Да | ✅ Да | ❌ Удален |
| SKIP_VALIDATION | ✅ true | ✅ true | ⚠️ false |
| Работает с ngrok | ✅ Да | ✅ Да | ❌ Нет |
| Окон | 4 | 5 | 3 |
| Для разработки | ✅ Да | ✅ Да | ❌ Нет |
| Для production | ❌ Нет | ❌ Нет | ✅ Да |

---

## 🎯 Рекомендации

### Вы разрабатываете локально через ngrok?
👉 **Используйте `start-prod-dev.ps1`**

### Вы работаете над UI и нужен HMR?
👉 **Используйте `start-dev.ps1`**

### Вы деплоите на сервер?
👉 **Используйте `start-prod.ps1`** (или Docker)

---

## ⚠️ Частые проблемы

### "Invalid Telegram hash" при открытии в Telegram

**Причина:** Используется `start-prod.ps1` с `SKIP_TELEGRAM_VALIDATION=false`

**Решение:** 
```powershell
# Остановите все окна (Ctrl+C)
# Запустите правильный скрипт:
.\start-prod-dev.ps1
```

---

### Frontend не обновляется при изменениях

**Причина:** Используется `start-prod.ps1` без watch mode

**Решение:** Используйте `start-prod-dev.ps1` (есть watch mode)

---

### "Cannot find module" при запуске

**Причина:** Не установлены зависимости

**Решение:**
```powershell
cd telegram-food-bot
# Backend
cd backend
npm install
npm run build
cd ..

# Frontend  
cd frontend
npm install
npm run build
cd ..

# Теперь запускайте скрипт
.\start-prod-dev.ps1
```

---

## 📚 Связанная документация

- **Быстрый старт:** `QUICK_START.md`
- **Production деплой:** `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Troubleshooting:** `MOBILE_TROUBLESHOOTING.md`
- **Прокси для Telegram API:** `TELEGRAM_API_FIX.md`

---

## 💡 Совет

**Для 90% случаев локальной разработки используйте:**

```powershell
.\start-prod-dev.ps1
```

Это золотая середина между скоростью production и удобством development! 🚀
