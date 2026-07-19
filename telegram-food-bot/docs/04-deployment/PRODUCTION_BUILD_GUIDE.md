# 🚀 Production Build через ngrok (Локальное тестирование)

Запуск production билда локально с ngrok для тестирования перед реальным деплоем.

## 🎯 Зачем это нужно?

- ✅ Протестировать production производительность
- ✅ Проверить что всё работает без hot reload
- ✅ Убедиться что bundle собирается корректно
- ✅ Тестировать с реальными данными Telegram
- ✅ Измерить скорость загрузки

## 📋 Быстрый старт

### Шаг 1: Собрать production билд

```powershell
.\build-all.ps1
```

Это:
- Скомпилирует backend TypeScript → JavaScript (в `backend/dist/`)
- Соберёт frontend bundle через Vite (в `frontend/dist/`)

**Время:** ~30-60 секунд

### Шаг 2: Запустить production

```powershell
.\start-production.ps1
```

Откроется 5 окон:
1. **Backend** (production compiled JS)
2. **Frontend** (static server с dist/)
3. **Proxy** (8080 → backend/frontend)
4. **ngrok** (HTTPS tunnel)
5. **URL Updater** (автоматическое обновление .env)

### Шаг 3: Тестировать

1. Скопируйте ngrok URL из окна 4
2. Вставьте в окно 5 (URL Updater)
3. Откройте Telegram → `@rocket_lunch_bot` → Menu
4. Наслаждайтесь **быстрой загрузкой**! ⚡

---

## 🔧 Опции запуска

### Без билда (если уже собрано)

```powershell
.\start-production.ps1 -NoBuild
```

### Без ngrok (если URL уже настроен)

```powershell
.\start-production.ps1 -NoNgrok
```

### Только билд (без запуска)

```powershell
.\build-all.ps1
```

### Пересобрать только frontend

```powershell
.\build-all.ps1 -SkipBackend
```

### Пересобрать только backend

```powershell
.\build-all.ps1 -SkipFrontend
```

---

## 📊 Что изменится в Production?

### ✅ Производительность

| Метрика | Development | Production |
|---------|------------|-----------|
| **Первая загрузка** | 3-5 сек | 0.5-1 сек ⚡ |
| **Bundle size** | ~5-10 MB | ~500 KB - 1 MB |
| **JS файлов** | 50-100 | 3-5 |
| **Backend startup** | 2-3 сек | 0.5 сек |

### 🔐 Безопасность

```env
# Development
SKIP_TELEGRAM_VALIDATION=true  ✅ Можно отключить
CORS_ORIGIN=*                   ✅ Все разрешены
LOG_LEVEL=debug                 ✅ Всё логируется

# Production
SKIP_TELEGRAM_VALIDATION=false ❌ ВСЕГДА включена
CORS_ORIGIN=specific-domain     ❌ Только разрешённые
LOG_LEVEL=warn                  ❌ Только важное
```

### 🛠️ Технические отличия

| | Development | Production |
|---|---|---|
| **Frontend** | Vite dev server | Static files (serve) |
| **Backend** | ts-node (on-the-fly) | Compiled JS |
| **Hot Reload** | ✅ Да | ❌ Нет |
| **Source Maps** | ✅ Да | ❌ Нет |
| **Минификация** | ❌ Нет | ✅ Да |
| **Tree Shaking** | Минимум | ✅ Максимум |

---

## 🔍 Проверка production билда

### 1. Проверить размер bundle

```powershell
Get-ChildItem frontend\dist -Recurse | Measure-Object -Property Length -Sum | Select-Object @{Name="Size (MB)"; Expression={$_.Sum / 1MB}}
```

Должно быть: **< 2 MB**

### 2. Проверить скорость загрузки

Откройте DevTools в браузере:
- **Network** → Clear → Refresh
- Смотрите на **DOMContentLoaded** и **Load** время

Production должен быть **в 5-10 раз быстрее** dev!

### 3. Проверить оптимизацию

```powershell
# Посмотреть структуру bundle
dir frontend\dist\assets
```

Должны быть файлы типа:
- `index-[hash].js` (main bundle)
- `vendor-[hash].js` (dependencies)
- `index-[hash].css` (styles)

---

## 🐛 Отладка production

### Backend логи

В production меньше логов. Чтобы включить debug:

**backend/.env.production:**
```env
LOG_LEVEL=debug
```

Затем перезапустите backend.

### Frontend Source Maps

По умолчанию в production нет source maps. Чтобы включить:

**frontend/vite.config.ts:**
```typescript
build: {
  sourcemap: true,  // Добавьте эту строку
}
```

Пересоберите:
```powershell
.\build-all.ps1 -SkipBackend
```

### Включить SKIP_TELEGRAM_VALIDATION

Для тестирования можно временно включить:

**backend/.env.production:**
```env
SKIP_TELEGRAM_VALIDATION=true
```

⚠️ **ВАЖНО:** В реальном production это НИКОГДА нельзя делать!

---

## 🎨 Сравнение загрузки

### Development Mode:
```
Request 1: main.tsx          (150 KB)
Request 2: App.tsx           (50 KB)
Request 3: hooks/useAuth.ts  (20 KB)
Request 4: ...               (ещё 50 файлов)
---
Total: ~5 MB, 100 requests, 3-5 секунд
```

### Production Mode:
```
Request 1: index-abc123.js   (300 KB gzip: 80 KB)
Request 2: vendor-def456.js  (200 KB gzip: 60 KB)
Request 3: index-ghi789.css  (50 KB gzip: 10 KB)
---
Total: ~500 KB, 3 requests, 0.5-1 секунда ⚡
```

---

## 📦 Структура билдов

### Backend (backend/dist/)
```
dist/
├── index.js               # Entry point
├── bot/
│   ├── bot.js
│   ├── commands/
│   └── handlers/
├── api/
│   ├── server.js
│   ├── routes/
│   └── middleware/
└── services/
    └── ...
```

### Frontend (frontend/dist/)
```
dist/
├── index.html             # Entry HTML
├── assets/
│   ├── index-abc123.js    # Main bundle (~300 KB)
│   ├── vendor-def456.js   # Dependencies (~200 KB)
│   └── index-ghi789.css   # Styles (~50 KB)
├── favicon.ico
└── manifest.json
```

---

## 🔄 Workflow: Development → Production

### 1. Разработка (сейчас)
```powershell
.\start-dev.ps1 -NoNgrok
```

### 2. Тестирование production локально
```powershell
.\build-all.ps1
.\start-production.ps1
```

### 3. Деплой на VPS (будущее)
```bash
# На сервере
git pull
npm run build:all
pm2 restart all
```

---

## 🚨 Важные отличия

### ❌ Не работает в Production:

1. **Hot Reload** - изменения требуют rebuild
2. **SKIP_TELEGRAM_VALIDATION=true** - игнорируется (если NODE_ENV=production)
3. **CORS для всех** - только разрешённые домены
4. **Debug логи** - минимальное логирование

### ✅ Работает лучше:

1. **Скорость** - 10-20x быстрее загрузка
2. **Безопасность** - все проверки включены
3. **Стабильность** - меньше багов
4. **SEO** - лучше индексируется

---

## 💡 Советы

### Перед production билдом:

✅ Убедитесь что dev версия работает
✅ Закройте все dev окна (чтобы не путать)
✅ Проверьте что `.env` настроены правильно

### После production билда:

✅ Проверьте размер bundle (должен быть < 2 MB)
✅ Откройте в DevTools → Network → проверьте скорость
✅ Протестируйте на телефоне через Telegram
✅ Проверьте что нет ошибок в Console

### Если что-то не работает:

1. Пересоберите: `.\build-all.ps1`
2. Проверьте логи backend (окно 1)
3. Откройте DevTools Console в браузере
4. Проверьте что все сервисы запущены: `.\test-api-connection.ps1`

---

## 📚 Дополнительно

См. также:
- `docs/DEVELOPMENT_VS_PRODUCTION.md` - подробное сравнение
- `README.md` - деплой на реальный VPS
- `TESTING_GUIDE.md` - тестирование

---

**Создано:** 2025-01-06  
**Статус:** ✅ Ready to use  
**Команда для старта:** `.\build-all.ps1 && .\start-production.ps1`
