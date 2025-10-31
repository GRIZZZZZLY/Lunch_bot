# Исправление ошибки ECONNRESET (Telegram API заблокирован)

## Проблема

При запуске бэкенда появляется ошибка:
```
HttpError: Network request for 'getMe' failed!
reason: Client network socket disconnected before secure TLS connection was established
code: ECONNRESET
```

Это означает, что **Telegram API заблокирован** (обычно в России).

## ✅ Решения (выберите одно)

### Вариант 1: Включить VPN (РЕКОМЕНДУЕТСЯ)

**Самый простой способ:**

1. Включите любой VPN на компьютере (Psiphon, ProtonVPN, или ваш обычный VPN)
2. Перезапустите бэкенд:
   ```powershell
   cd telegram-food-bot\backend
   npm run dev
   ```
3. Если видите `🚀 Бот запущен в polling режиме` - всё работает! ✅

---

### Вариант 2: Настроить прокси

Если у вас есть прокси-сервер:

1. Откройте `telegram-food-bot/backend/.env`
2. Измените:
   ```env
   USE_PROXY=true
   PROXY_URL=http://proxy.example.com:8080  # или ваш прокси
   ```
3. Примеры PROXY_URL:
   - HTTP: `http://proxy.example.com:8080`
   - С авторизацией: `http://user:password@proxy.example.com:8080`
   - SOCKS5: `socks5://proxy.example.com:1080`
4. Перезапустите бэкенд

---

### Вариант 3: Локальный Telegram Bot API сервер

Для продвинутых пользователей:

1. Установите [Telegram Bot API сервер](https://github.com/tdlib/telegram-bot-api)
2. Запустите локальный сервер на порту 8081
3. В `.env` установите:
   ```env
   USE_LOCAL_API=true
   LOCAL_API_URL=http://localhost:8081
   ```
4. Перезапустите бэкенд

---

## Проверка работоспособности

После применения исправления, в логах должно быть:

✅ **Успешный запуск:**
```
2025-10-31 07:23:19 [info]: 🚀 Бот запущен в polling режиме {"username":"rocket_lunch_bot"}
```

❌ **Всё ещё ошибка:**
- Убедитесь, что VPN включен и работает
- Попробуйте другой VPN
- Проверьте, что прокси-сервер доступен (если используете прокси)

---

## Redis (необязательно)

Redis теперь опциональный для dev режима. Если видите ошибки Redis - это нормально, они не мешают работе:

```
❌ Redis error: {"code":"EACCES"}
⚠️ Redis disabled via REDIS_ENABLED=false, running without cache
```

Бот будет работать без кэша. Для production рекомендуется установить Redis.

---

## Дополнительная помощь

- Документация: [CLAUDE.md](../../CLAUDE.md)
- VPS deployment: [START_HERE.md](../../START_HERE.md)
- Режимы работы: [MODES-COMPARISON.md](MODES-COMPARISON.md)
