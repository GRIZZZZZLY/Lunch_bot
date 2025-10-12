# 🎯 Режимы разработки - Краткая справка

## Выбор режима

```
┌─────────────────────────────────────────────────────────────┐
│                    Какой режим использовать?                 │
└─────────────────────────────────────────────────────────────┘

Активная разработка UI?
  └─→ ✅ DEV (.\start-dev.ps1)

Тестирование производительности?
  └─→ ✅ PROD-DEV (.\start-prod-dev.ps1)

Финальная проверка перед деплоем?
  └─→ ✅ PROD (.\start-prod.ps1)
```

---

## 📊 Сравнительная таблица

| Критерий | DEV | **PROD-DEV** | PROD |
|----------|-----|--------------|------|
| **Запуск** | `.\start-dev.ps1` | `.\start-prod-dev.ps1` | `.\start-prod.ps1` |
| **Скорость загрузки** | 🐌 Медленно | 🚀 **Быстро** | 🚀 Быстро |
| **Bundle Size** | ~5-10 MB | ✅ **~500KB-1MB** | ~500KB-1MB |
| **Hot Reload** | ✅ Мгновенно | ⚠️ ~5-10 сек | ❌ Нужна пересборка |
| **console.log** | ✅ Видны | ✅ **Видны** | ❌ Удалены |
| **Source Maps** | ✅ Есть | ✅ **Есть** | ❌ Нет |
| **Минификация** | ❌ Нет | ✅ **Да** | ✅ Да |
| **Code Splitting** | ❌ Нет | ✅ **Да** | ✅ Да |
| **React DevTools** | ✅ Полные | ✅ **Полные** | ⚠️ Ограничены |
| **SKIP_VALIDATION** | ✅ Да | ✅ **Да** | ❌ Нет |
| **Отладка** | 😊 Легко | 😊 **Легко** | 😢 Сложно |
| **Для продакшн** | ❌ НЕТ | ❌ **НЕТ** | ✅ ДА |

---

## 🎯 Детальное описание

### 1️⃣ DEV режим (`.\start-dev.ps1`)

**Для чего:**
- ✅ Активная разработка новых фич
- ✅ Быстрые итерации (instant reload)
- ✅ Экспериментирование с UI/UX
- ✅ Написание нового кода

**Характеристики:**
- **NODE_ENV=development** (backend)
- **SKIP_TELEGRAM_VALIDATION=true**
- TypeScript напрямую (tsx watch)
- Vite dev server
- HMR (hot module replacement)
- Несжатый код
- Полная отладка
- Swagger API включен
- Детальное логирование (debug)

**Команды:**
```powershell
.\start-dev.ps1
```

**Окна:**
1. Backend Dev (tsx watch)
2. Frontend Dev (Vite dev server)
3. Proxy Server
4. ngrok
5. URL Updater

---

### 2️⃣ PROD-DEV режим (`.\start-prod-dev.ps1`) ⭐ РЕКОМЕНДУЕТСЯ

**Для чего:**
- ✅ Тестирование производительности
- ✅ Проверка на мобильных
- ✅ Демонстрация заказчику
- ✅ Финальное тестирование фичи
- ✅ **ИДЕАЛЕН ДЛЯ ЕЖЕДНЕВНОЙ РАБОТЫ!**

**Характеристики:**
- **NODE_ENV=development** (backend) ← ИСПРАВЛЕНО!
- **SKIP_TELEGRAM_VALIDATION=true**
- Production build frontend (минифицирован, оптимизирован)
- НО с console.log (отладка!)
- НО с source maps (breakpoints!)
- Watch mode (автопересборка)
- Swagger API включен
- Мягкие CORS правила

**Команды:**
```powershell
.\start-prod-dev.ps1
```

**Окна:**
1. Backend PROD-DEV (tsx watch)
2. Frontend PROD-DEV (build --watch)
3. Proxy Server
4. ngrok
5. URL Updater

**Файлы конфигурации:**
- `vite.config.prod-dev.ts`
- `backend/.env.prod-dev`
- `frontend/.env.prod-dev`

📖 **Подробнее:** [PROD-DEV-MODE.md](./PROD-DEV-MODE.md)

---

### 3️⃣ PROD режим (`.\start-prod.ps1`)

**Для чего:**
- ✅ Финальная проверка перед деплоем
- ✅ Тестирование настоящего production build
- ✅ Проверка безопасности (SKIP_VALIDATION=false)

**Характеристики:**
- **NODE_ENV=production** (backend)
- **SKIP_TELEGRAM_VALIDATION=false**
- Полная сборка (tsc + vite build)
- Минификация
- Удаление console.log
- Без source maps
- Строгая валидация Telegram
- Swagger API отключен
- Строгие CORS правила

**Команды:**
```powershell
.\start-prod.ps1
```

**Окна:**
1. Backend PROD (node dist/index.js)
2. Frontend PROD (static files)
3. Proxy Server
4. ngrok
5. URL Updater

**⚠️ Важно:**
- Каждое изменение = полная пересборка (~30-60 сек)
- Нет автопересборки
- Сложная отладка (минифицированный код)

---

## 🚀 Рекомендуемый Workflow

### Вариант 1: Для большинства задач

```
1. Разработка фичи:
   .\start-dev.ps1
   (быстрые итерации, instant HMR)

2. Готово? Проверка:
   .\start-prod-dev.ps1
   (реальная производительность + отладка)

3. Всё отлично? Коммит:
   git commit -m "feat: новая фича"
```

### Вариант 2: Если PROD-DEV работает отлично

```
1. Работайте ТОЛЬКО в PROD-DEV:
   .\start-prod-dev.ps1
   (хорошая производительность + удобство)

2. Перед коммитом:
   .\start-prod.ps1
   (финальная проверка)

3. Коммит и деплой
```

### Вариант 3: Максимальная скорость (старый подход)

```
1. Вся разработка:
   .\start-dev.ps1
   (максимально быстро)

2. Финальная проверка:
   .\start-prod.ps1
   (1 раз перед деплоем)

3. Деплой
```

---

## 💡 Советы

### Когда что использовать?

**Используйте DEV если:**
- Пишете новый компонент
- Часто меняете стили
- Экспериментируете с логикой
- Секунды имеют значение

**Используйте PROD-DEV если:**
- ⭐ **ОСНОВНОЙ РЕЖИМ ДЛЯ РАБОТЫ**
- Тестируете производительность
- Показываете другим людям
- Хотите видеть реальную скорость
- Нужна отладка БЕЗ компромиссов

**Используйте PROD если:**
- Финальная проверка перед деплоем
- Тестируете безопасность
- Проверяете что build собирается

---

## ⚙️ Переключение между режимами

### Из DEV в PROD-DEV:

```powershell
# 1. Закройте все окна DEV (Ctrl+C в каждом)
# 2. Запустите PROD-DEV:
.\start-prod-dev.ps1
```

### Из PROD-DEV в PROD:

```powershell
# 1. Закройте все окна PROD-DEV
# 2. Запустите PROD:
.\start-prod.ps1
```

### Восстановление .env файлов:

Каждый режим создает `.env.backup`, если что-то сломалось:

```powershell
# Backend
cd backend
copy .env.backup .env

# Frontend
cd frontend
copy .env.backup .env
```

---

## 🎯 Итоговая рекомендация

### Для вас (опытный разработчик):

```
✅ ОСНОВНОЙ РЕЖИМ: PROD-DEV
   - Запускайте: .\start-prod-dev.ps1
   - Работайте весь день в этом режиме
   - Производительность + удобство

✅ ИНОГДА: DEV
   - Когда нужна максимальная скорость HMR
   - Активное экспериментирование

✅ РЕДКО: PROD
   - Финальная проверка перед коммитом
   - Тестирование настоящего production build
```

---

## 📝 Резюме команд

```powershell
# Основная работа (рекомендуется)
.\start-prod-dev.ps1

# Быстрая разработка
.\start-dev.ps1

# Финальная проверка
.\start-prod.ps1

# Очистка
# Закройте все окна (Ctrl+C)
```

---

## 📚 Дополнительная информация

- **PROD-DEV подробно:** [PROD-DEV-MODE.md](./PROD-DEV-MODE.md)
- **Production деплой:** [PRODUCTION_DEPLOYMENT_GUIDE.md](../PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Troubleshooting:** [MOBILE_TROUBLESHOOTING.md](./MOBILE_TROUBLESHOOTING.md)
