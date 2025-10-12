# 🔧 PRODUCTION-DEV MODE

**Гибридный режим разработки** - комбинация производительности production и удобства development.

---

## 🎯 Зачем это нужно?

**Проблема:**
- **DEV режим** - удобный, но медленный
- **PRODUCTION режим** - быстрый, но неудобный для разработки (нет hot reload, минифицированный код)

**Решение:**
**PROD-DEV режим** - лучшее из обоих миров!

---

## ✅ Что вы получаете?

| Фича | DEV | PROD | **PROD-DEV** |
|------|-----|------|-------------|
| **Скорость загрузки** | ❌ Медленно | ✅ Быстро | ✅ **Быстро** |
| **Оптимизация кода** | ❌ Нет | ✅ Да (минификация, tree-shaking) | ✅ **Да** |
| **Hot Reload** | ✅ Да | ❌ Нет | ⚠️ **Частично** (watch mode) |
| **console.log** | ✅ Видны | ❌ Удалены | ✅ **Видны** |
| **Source Maps** | ✅ Есть | ❌ Нет | ✅ **Есть** |
| **SKIP_TELEGRAM_VALIDATION** | ✅ Да | ❌ Нет | ✅ **Да** |
| **Отладка** | ✅ Удобная | ❌ Сложная | ✅ **Удобная** |
| **Bundle Size** | 5-10 MB | 500 KB - 1 MB | ✅ **500 KB - 1 MB** |

---

## 🚀 Как запустить?

### Простой способ:

```powershell
cd E:\BOT_V2\Lunch_bot_V2\telegram-food-bot
.\start-prod-dev.ps1
```

Откроется **5 окон:**
1. **Backend PROD-DEV** - watch mode (перезапуск при изменениях)
2. **Frontend PROD-DEV** - watch mode (пересборка при изменениях)
3. **Proxy Server** - раздача статики + API
4. **ngrok** - туннель для Telegram
5. **URL Updater** - обновление конфигурации

---

## ⚙️ Как это работает?

### Frontend:

**Используется специальный конфиг:** `vite.config.prod-dev.ts`

```typescript
// Отличия от production:
{
  sourcemap: true,              // ✅ Включены (для отладки)
  drop_console: false,          // ✅ Оставляем console.log
  minify: 'terser',             // ✅ Минификация (как в prod)
  chunkSizeWarningLimit: 500    // ✅ Code splitting (как в prod)
}
```

**Команда:** `npm run build:prod-dev`
- Собирает production build
- С source maps
- С console.log
- В watch mode (пересборка при изменениях)

### Backend:

**Используется:** `.env.prod-dev`

```bash
NODE_ENV=production              # Production оптимизация
SKIP_TELEGRAM_VALIDATION=true    # Удобно для ngrok
```

**Команда:** `npm run dev`
- Запускает через tsx (TypeScript напрямую)
- Watch mode (перезапуск при изменениях)
- Production окружение

---

## 📁 Файлы конфигурации

```
telegram-food-bot/
├── vite.config.prod-dev.ts        # Frontend конфиг для prod-dev
├── backend/.env.prod-dev           # Backend конфиг для prod-dev
├── frontend/.env.prod-dev          # Frontend env для prod-dev
└── start-prod-dev.ps1              # Скрипт запуска
```

---

## 🔄 Workflow

### 1. Запуск
```powershell
.\start-prod-dev.ps1
```

### 2. Разработка
- Меняете файлы в `src/`
- **Frontend** автоматически пересобирается (~5-10 сек)
- **Backend** автоматически перезапускается (~2-3 сек)

### 3. Тестирование
- Открываете Mini App в Telegram (desktop или mobile)
- Видите **production производительность**
- Но с **dev удобством** (console.log, stack traces)

### 4. Отладка
- Открываете DevTools
- Видите **source maps** - можете ставить breakpoints в исходном коде
- Видите **console.log** - никуда не делись!

---

## ⚡ Performance

### Время сборки:

```
DEV:
├── Backend: instant (tsx watch)
└── Frontend: instant (Vite dev server)

PROD:
├── Backend: ~15-30 сек (tsc build)
└── Frontend: ~20-40 сек (vite build)

PROD-DEV:
├── Backend: instant (tsx watch)
└── Frontend: ~20-40 сек (initial), ~5-10 сек (rebuild)
```

### Bundle size:

```
DEV:        ~5-10 MB (несжатый)
PRODUCTION: ~500 KB - 1 MB (gzip)
PROD-DEV:   ~500 KB - 1 MB (gzip) ← КАК В PRODUCTION!
```

---

## 🐛 Отладка

### Console.log работает:
```typescript
// В любом компоненте:
console.log('User data:', userData);
// ✅ Видно в DevTools!
```

### Source Maps работают:
```
DevTools → Sources
✅ Видите src/pages/HomePage.tsx (не минифицированный!)
✅ Можете ставить breakpoints
✅ Stack traces читаемые
```

### React DevTools работают:
```
✅ Видите компоненты
✅ Видите props
✅ Видите state
```

---

## 📊 Когда использовать?

### Используйте **DEV** (`start-dev.ps1`) когда:
- Активно пишете новый компонент
- Нужен instant hot reload (секунды имеют значение)
- Экспериментируете с UI

### Используйте **PROD-DEV** (`start-prod-dev.ps1`) когда:
- ✅ Тестируете производительность
- ✅ Проверяете на реальных условиях
- ✅ Показываете заказчику
- ✅ Тестируете на мобильном
- ✅ Финальное тестирование перед коммитом

### Используйте **PROD** (`start-prod.ps1`) когда:
- Финальная проверка перед деплоем
- Проверка production build без изменений
- Деплой на сервер

---

## 🎯 Рекомендуемый Workflow

```
┌──────────────────────────────────────┐
│ Новая фича                           │
│ ↓                                    │
│ DEV режим (быстрые итерации)       │
└──────────────────────────────────────┘
          ↓
┌──────────────────────────────────────┐
│ Фича готова (базовая работает)      │
│ ↓                                    │
│ PROD-DEV режим                       │
│ (тестирование производительности)   │
└──────────────────────────────────────┘
          ↓
┌──────────────────────────────────────┐
│ Всё отлично?                         │
│ ↓                                    │
│ PROD режим (финальная проверка)     │
└──────────────────────────────────────┘
          ↓
┌──────────────────────────────────────┐
│ git commit + push + deploy           │
└──────────────────────────────────────┘
```

---

## ⚠️ Важные замечания

### 1. Watch mode != Hot Module Replacement
- **HMR (DEV)**: изменения видны мгновенно БЕЗ перезагрузки страницы
- **Watch mode (PROD-DEV)**: нужно обновить страницу (Cmd/Ctrl+R)

### 2. Первая сборка медленная
- **Первый запуск**: ~20-40 сек (полная сборка)
- **Последующие**: ~5-10 сек (incremental rebuild)

### 3. SKIP_TELEGRAM_VALIDATION
- ⚠️ Включен для удобства с ngrok
- ❌ НЕ используйте в настоящем production!

### 4. Source maps увеличивают размер
- Build с source maps: ~2-3 MB
- Но пользователи **не скачивают** source maps (только при открытии DevTools)

---

## 🔧 Кастомизация

### Убрать source maps (еще быстрее):

```typescript
// vite.config.prod-dev.ts
export default defineConfig({
  build: {
    sourcemap: false,  // ← измените на false
  }
})
```

### Убрать console.log:

```typescript
// vite.config.prod-dev.ts
export default defineConfig({
  build: {
    terserOptions: {
      compress: {
        drop_console: true,  // ← измените на true
      }
    }
  }
})
```

---

## 📝 Резюме

**PROD-DEV режим** - идеальный баланс для:
- Разработки с реальной производительностью
- Тестирования на мобильных устройствах
- Отладки с production оптимизацией
- Демонстрации заказчику

**Используйте:**
```powershell
.\start-prod-dev.ps1
```

**И получайте удовольствие от разработки!** 🚀
