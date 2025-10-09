# 🤖 Настройка бота в BotFather для работы в группах

## Проблема
Menu Button (кнопка меню Telegram) работает **только в личных чатах**. В группах она не отображается.

## ✅ Решение
Вместо Menu Button используем **inline-кнопки** с `web_app` параметром в сообщениях бота.

---

## 📋 Настройка бота в BotFather

### 1. Откройте [@BotFather](https://t.me/BotFather)

### 2. Базовые настройки

```
/mybots
→ Выберите @rocket_lunch_bot
→ Bot Settings
```

#### 2.1 **Inline Mode** (для работы в группах)
```
→ Inline Mode: ON
→ Inline Feedback: 100%
```

#### 2.2 **Group Privacy** (для чтения сообщений в группах)
```
→ Group Privacy: DISABLED
```
⚠️ **Важно:** Отключите Privacy Mode, чтобы бот мог видеть сообщения в группах.

#### 2.3 **Allow Groups?**
```
→ Allow in Groups: YES
```

### 3. Настройка команд бота

```
/mybots
→ Выберите @rocket_lunch_bot
→ Edit Bot
→ Edit Commands
```

Вставьте список команд:

```
start - Начать работу с ботом
help - Показать справку
menu - Открыть меню (Mini App)
startpoll - Запустить голосование (только админы)
history - История голосований
```

### 4. Настройка Menu Button (для личных чатов)

```
/mybots
→ Выберите @rocket_lunch_bot
→ Bot Settings
→ Menu Button
→ Edit Menu Button URL
```

**URL для Mini App:**
```
https://2072f129141b.ngrok-free.app
```

⚠️ **Важно:** Если ngrok URL изменится, обновите здесь!

### 5. Настройка Domain (опционально, для production)

```
/mybots
→ Выберите @rocket_lunch_bot
→ Bot Settings
→ Domain
```

Добавьте ваш домен (если используете свой, а не ngrok).

---

## 🎯 Как использовать Mini App в группах

### Вариант 1: Через команды бота
1. Добавьте бота в группу
2. Дайте боту права администратора
3. Используйте команды:
   - `/menu` - открыть меню с кнопкой Mini App
   - `/start` - приветствие с кнопкой Mini App
   - `/help` - справка с кнопкой Mini App

### Вариант 2: Через кнопки в сообщениях
Бот автоматически добавляет кнопку "🚀 Открыть Mini App" во все сообщения с меню.

### Вариант 3: Создать команду только для Mini App (рекомендуется)

Можно создать отдельную команду `/app` для быстрого открытия Mini App в группах.

---

## 🔧 Дополнительные настройки для администраторов группы

### Права бота в группе

Чтобы бот работал полноценно в группе, дайте ему права:

1. **Обязательные права:**
   - ✅ Send Messages
   - ✅ Delete Messages (для управления голосованиями)
   - ✅ Pin Messages (опционально)

2. **Опциональные права:**
   - ✅ Add Users (для приглашения участников)
   - ✅ Manage Topics (если используются топики)

### Как дать права:

1. Откройте группу в Telegram
2. Нажмите на название группы → Administrators
3. Add Administrator → найдите @rocket_lunch_bot
4. Выберите нужные права
5. Нажмите ✓ (галочка)

---

## 🧪 Тестирование

### 1. Тест в личном чате:
```
1. Откройте @rocket_lunch_bot
2. Отправьте /start
3. Нажмите кнопку "🚀 Открыть Mini App"
4. Должен открыться интерфейс приложения
```

### 2. Тест в группе:
```
1. Добавьте бота в тестовую группу
2. Дайте боту права администратора
3. Отправьте /menu в группу
4. Нажмите кнопку "🚀 Открыть Mini App"
5. Должен открыться интерфейс приложения
```

### 3. Тест голосования в группе:
```
1. В группе отправьте /startpoll
2. Выберите блюда для голосования
3. Участники голосуют кнопками
4. По завершении выбирается победитель
```

---

## ❓ Решение проблем

### Проблема: "Кнопка Mini App не отображается в группе"

**Решение:**
- Menu Button работает только в личных чатах
- В группах используйте команду `/menu` или `/start`
- Кнопка появится в ответном сообщении бота

### Проблема: "Бот не отвечает на команды в группе"

**Причины:**
1. **Privacy Mode включен** → отключите в BotFather
2. **Бот не админ** → дайте права администратора
3. **Команда начинается не с /**  → используйте `/menu`, а не `menu`

**Решение:**
```
1. @BotFather → @rocket_lunch_bot → Bot Settings → Group Privacy → DISABLED
2. В группе: Administrators → Add @rocket_lunch_bot
3. Используйте команды с /
```

### Проблема: "Mini App открывается, но не загружается"

**Причины:**
1. Backend не запущен
2. ngrok туннель неактивен
3. URL в .env не обновлён

**Решение:**
```powershell
# 1. Проверьте backend
curl http://localhost:3001/health

# 2. Проверьте ngrok
curl https://2072f129141b.ngrok-free.app/health

# 3. Обновите URL
.\update-ngrok-url.ps1 -NewUrl "https://НОВЫЙ-URL.ngrok-free.app"

# 4. Перезапустите backend
cd backend
npm run dev
```

### Проблема: "CORS ошибка при открытии Mini App"

**Решение:**
Убедитесь, что в `backend/.env` прописан правильный CORS:
```env
CORS_ORIGIN=http://localhost:5173,https://2072f129141b.ngrok-free.app,https://web.telegram.org
```

---

## 📝 Чеклист настройки

### BotFather:
- [ ] Inline Mode: ON
- [ ] Group Privacy: DISABLED
- [ ] Allow in Groups: YES
- [ ] Commands настроены
- [ ] Menu Button URL обновлён
- [ ] Domain добавлен (если есть свой)

### Backend:
- [ ] WEBAPP_URL в .env настроен
- [ ] CORS_ORIGIN содержит ngrok и telegram
- [ ] Webhook установлен
- [ ] Backend запущен

### Группа:
- [ ] Бот добавлен в группу
- [ ] Бот имеет права администратора
- [ ] Команды работают
- [ ] Mini App открывается через /menu

---

## 🎓 Полезные ссылки

- [Telegram Bot API - Web Apps](https://core.telegram.org/bots/webapps)
- [Telegram Bot API - Commands](https://core.telegram.org/bots#commands)
- [Telegram Bot API - Group Privacy](https://core.telegram.org/bots#privacy-mode)
- [BotFather Documentation](https://core.telegram.org/bots#botfather)

---

## 🚀 Готово!

Теперь ваш бот будет работать как в личных чатах, так и в группах. Участники группы смогут открывать Mini App через команды `/menu`, `/start` или `/help`.

**Следующие шаги:**
1. Протестируйте бота в группе
2. Убедитесь, что все команды работают
3. Проверьте открытие Mini App
4. Запустите тестовое голосование
