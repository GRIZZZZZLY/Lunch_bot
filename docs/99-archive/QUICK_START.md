# ⚡ Quick Start - Шпаргалка

## 🚀 Запуск за 10 секунд

```powershell
cd E:\BOT_V2\Lunch_bot_V2\telegram-food-bot
.\start-prod-dev.ps1
```

**Готово!** Откроется 5 окон. В окне #5 вставить ngrok URL из окна #4.

---

## 📱 Проверка что работает

1. ✅ Backend: http://localhost:3001/health
2. ✅ Proxy: http://localhost:8080  
3. ✅ Telegram: Открыть бота → Menu → Mini App

---

## 🐛 Быстрые решения

### 409 Conflict
```powershell
.\delete-webhook.ps1
```

### Не работает на мобильном
См. `telegram-food-bot/MOBILE_TROUBLESHOOTING.md`

### Нужна максимальная скорость HMR
```powershell
.\start-dev.ps1  # Вместо prod-dev
```

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| `CONTINUE_HERE.md` | **Промпт для нового диалога** |
| `SESSION_SUMMARY_2025-01-11.md` | Полный отчет последней сессии |
| `telegram-food-bot/PROD-DEV-MODE.md` | Гибридный режим |
| `telegram-food-bot/MODES-COMPARISON.md` | Сравнение режимов |
| `README.md` | Обзор проекта |

---

## 🎯 Для нового диалога скопируй:

```
Telegram Food Bot проект в E:\BOT_V2\Lunch_bot_V2\telegram-food-bot

✅ Backend и Frontend работают
✅ Mini App на mobile (iOS/Android) работает
✅ PROD-DEV режим создан (быстрый + удобный)

Запуск: .\start-prod-dev.ps1
Контекст: SESSION_SUMMARY_2025-01-11.md
```
