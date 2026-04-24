# Build Modes Guide - Полное руководство по режимам сборки

## 🎯 Краткое сравнение

| Характеристика | DEV Mode | PROD-DEV Mode | PROD Mode |
|---|---|---|---|
| **Скрипт** | `start-dev.ps1` | `start-prod-dev-NEW.ps1` | `start-prod-local.ps1` |
| **Конфиг** | Vite dev server | `vite.config.prod-dev.ts` | `vite.config.ts` |
| **Hot Reload** | ✅ Да | ✅ Да (watch mode) | ❌ Нет |
| **Source Maps** | ✅ Да | ✅ Да | ❌ Нет |
| **console.log** | ✅ Сохранены | ✅ Сохранены | ❌ Удалены |
| **Минификация** | ❌ Нет | ✅ Да (Terser) | ✅ Да (Terser) |
| **Code Splitting** | ❌ Нет | ✅ Да | ✅ Да |
| **Bundle Size** | N/A (dev) | ~500-600 KB | ~450-500 KB |
| **PWA/Service Worker** | ❌ Отключено | ❌ Отключено | ✅ Включено |
| **Port Frontend** | 5173 | N/A (статика) | N/A (статика) |
| **Port Backend** | 3001 | 3001 | 3001 |
| **Proxy Server** | 8080 (объединяет) | ❌ Не нужен | ❌ Не нужен |
| **ngrok** | ✅ Да | ✅ Да | ❌ Нет (локально) |
| **Telegram Validation** | ⚠️ Skip (dev) | ⚠️ Skip (dev) | ✅ Включено |

---

## 📋 Режим 1: DEV Mode

### Запуск
```powershell
cd telegram-food-bot
.\start-dev.ps1
```

### Что происходит
1. **Frontend** - Vite dev server на порту 5173
2. **Backend** - tsx watch на порту 3001
3. **Proxy** - Сервер на порту 8080 объединяет frontend + backend
4. **ngrok** - Туннель для Telegram Mini App
5. **URL Updater** - Автоматическое обновление webhook

### Открываемые окна (5 штук)
- Window 1: Backend (3001)
- Window 2: Frontend (5173)
- Window 3: Proxy (8080)
- Window 4: ngrok tunnel
- Window 5: URL Updater

### Когда использовать
✅ Активная разработка UI
✅ Нужен Hot Module Replacement
✅ Быстрая итерация изменений
✅ Отладка с сохранением состояния

### Плюсы
- 🚀 Мгновенный Hot Reload
- 🐛 Полная отладка (source maps + console.log)
- 🔄 Автоматическая перезагрузка при изменениях
- 💡 Читаемый код в браузере

### Минусы
- ⚠️ НЕ показывает production проблемы
- ⚠️ НЕ тестирует code splitting
- ⚠️ НЕ тестирует минификацию
- ⚠️ 5 окон = много процессов

### Конфигурация
- **Frontend**: Vite dev server (без сборки)
- **Backend**: `backend/.env.development`
- **Validation**: `SKIP_TELEGRAM_VALIDATION=true`

---

## 📋 Режим 2: PROD-DEV Mode (Гибридный)

### Запуск
```powershell
cd telegram-food-bot
.\start-prod-dev-NEW.ps1
```

### Что происходит
1. **Frontend** - Production build с watch mode
   - Использует `vite.config.prod-dev.ts`
   - Команда: `npm run build:prod-dev`
2. **Backend** - Compiled TypeScript с watch mode
   - Команда: `npm run prod-dev`
3. **Backend serves static** - Раздает `frontend/dist/`
4. **ngrok** - Туннель для Telegram Mini App
5. **URL Updater** - Автоматическое обновление webhook

### Открываемые окна (4 штуки)
- Window 1: Frontend build watch
- Window 2: Backend build + serve
- Window 3: ngrok tunnel
- Window 4: URL Updater

### Когда использовать
✅ Тестирование production сборки
✅ Проверка code splitting
✅ Поиск ошибок минификации
✅ Разработка с production-like окружением
✅ Проверка работы статики через backend

### Плюсы
- 🎯 Production-like окружение
- 🔧 Но с отладкой (source maps + console.log)
- 🔄 Watch mode для быстрых изменений
- 📦 Тестирует реальный bundle
- ✅ Один сервер (как в production)

### Минусы
- 🐌 Медленнее чем DEV (пересборка ~5-10 сек)
- 💾 Больше нагрузка на диск (пересборка)
- ⚠️ НЕ тестирует Service Worker / PWA

### Конфигурация
- **Frontend**: `vite.config.prod-dev.ts`
  - Source maps: ✅ Включены
  - console.log: ✅ Сохранены
  - Минификация: ✅ Терser
  - Code splitting: ✅ Manual chunks
  - PWA: ❌ Отключено
- **Backend**: `backend/.env.prod-dev`
- **Validation**: `SKIP_TELEGRAM_VALIDATION=true`

### 🔧 Критические настройки `vite.config.prod-dev.ts`

```typescript
build: {
  sourcemap: true,              // ✅ Для отладки
  terserOptions: {
    compress: {
      drop_console: false,      // ✅ Сохраняем console.log
    }
  },
  rollupOptions: {
    external: ['virtual:pwa-register'],  // ❌ PWA отключено
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // КРИТИЧНО: Весь React в один chunk!
          if (id.includes('react')) {
            return 'react-vendor';  // ✅ Никаких разделений!
          }
          // ... остальные chunks
        }
      }
    }
  }
}

resolve: {
  dedupe: ['react', 'react-dom'],  // ✅ Один React!
}
```

---

## 📋 Режим 3: PROD Mode (Финальный production)

### Запуск
```powershell
cd telegram-food-bot
.\start-prod-local.ps1
```

### Что происходит
1. **Frontend** - Полная production сборка (ONE TIME)
   - Использует `vite.config.ts`
   - Команда: `npm run build`
2. **Backend** - Полная production сборка (ONE TIME)
   - Команда: `npm run build`
3. **Backend serves static** - Раздает `frontend/dist/`
4. **Один процесс** - Только backend на http://localhost:3001

### Открываемые окна (1 штука)
- Window 1: Backend server (production)

### Когда использовать
✅ Финальное тестирование перед deploy
✅ Проверка Service Worker / PWA
✅ Проверка размера bundle
✅ Проверка performance
✅ Тестирование без ngrok (локально)

### Плюсы
- 🎯 100% идентично production
- 📦 Минимальный размер bundle
- ⚡ Максимальная оптимизация
- 🔒 Полная валидация безопасности
- 🚀 PWA и Service Worker работают

### Минусы
- ❌ НЕТ hot reload
- ❌ НЕТ source maps (код нечитаемый)
- ❌ НЕТ console.log (удалены)
- 🔄 Нужна пересборка при каждом изменении
- 🐛 Сложно дебажить

### Конфигурация
- **Frontend**: `vite.config.ts`
  - Source maps: ❌ Отключены
  - console.log: ❌ Удалены (`drop_console: true`)
  - Минификация: ✅ Терser (2 прохода)
  - Code splitting: ✅ Manual chunks (15+ chunks)
  - PWA: ✅ VitePWA plugin включен
- **Backend**: `backend/.env.production`
- **Validation**: ✅ Полная валидация Telegram InitData

### 🔧 Критические настройки `vite.config.ts`

```typescript
build: {
  sourcemap: false,             // ❌ Для production
  terserOptions: {
    compress: {
      drop_console: true,       // ❌ Удаляем console.log
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug'],
      passes: 2,                // Два прохода минификации
    }
  },
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // КРИТИЧНО: Весь React в один chunk!
          if (id.includes('react')) {
            return 'react-vendor';  // ✅ Никаких разделений!
          }
          // 15+ отдельных chunks для оптимального кэширования
          if (id.includes('framer-motion')) return 'framer-motion';
          if (id.includes('@radix-ui')) return 'ui-components';
          if (id.includes('@sentry/')) return 'sentry';
          // ... и т.д.
        }
      }
    }
  }
}

plugins: [
  react(),
  VitePWA({  // ✅ PWA включено
    registerType: 'autoUpdate',
    workbox: {
      runtimeCaching: [/* ... */],
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
    }
  })
]

resolve: {
  dedupe: ['react', 'react-dom'],  // ✅ Один React!
}
```

---

## 🐛 Известные проблемы и решения

### Проблема 1: "Cannot access 'It' before initialization"

**Причина**: `debugLogger.ts` пытался обратиться к `localStorage` во время инициализации модуля

**Решение**: ✅ Исправлено в `frontend/src/utils/debugLogger.ts`
```typescript
// БЫЛО (неправильно):
export const DEBUG_ENABLED = localStorage.getItem('debug') === 'true';

// СТАЛО (правильно):
export const DEBUG_ENABLED = typeof window !== 'undefined' &&
  localStorage.getItem('debug') === 'true';
```

### Проблема 2: "Cannot set properties of undefined (setting 'Children')"

**Причина**: React был разделен на несколько chunks, что создавало дубликаты React

**Решение**: ✅ Исправлено в обоих конфигах
```typescript
// БЫЛО (неправильно):
if (id.includes('/react/') || id.includes('/react-dom/')) {
  return 'react-core';  // ❌ Только часть React
}
if (id.includes('@remix-run/router')) {
  return 'vendor';  // ❌ React Router отдельно
}

// СТАЛО (правильно):
if (id.includes('react')) {
  return 'react-vendor';  // ✅ ВЕСЬ React вместе!
}
if (id.includes('@remix-run/router')) {
  return 'react-router';  // ✅ Но не в react-vendor
}

// + Добавлено:
resolve: {
  dedupe: ['react', 'react-dom'],  // ✅ Гарантия одного React
}
```

### Проблема 3: PROD-DEV не работал после исправлений

**Причина**: Существовало ДВА отдельных конфига:
- `vite.config.ts` - для обычных сборок
- `vite.config.prod-dev.ts` - для `npm run build:prod-dev`

Исправления были применены только к `vite.config.ts`!

**Решение**: ✅ Исправления применены к ОБОИМ конфигам

### Проблема 4: Service Worker кэшировал старые файлы

**Причина**: PWA plugin агрессивно кэширует JS файлы

**Временное решение**: Очистка кэша через DevTools или `clear-cache.js`

**Правильное решение**: ✅ Service Worker отключен в PROD-DEV режиме
```typescript
// vite.config.prod-dev.ts
rollupOptions: {
  external: ['virtual:pwa-register'],  // ❌ Не включать PWA
}
```

---

## 📦 Структура финального bundle (PROD mode)

После правильной сборки должно быть примерно так:

```
frontend/dist/
├── index.html                          # Входная точка
├── assets/
│   ├── js/
│   │   ├── index-D3FUyENN.js          # Main app code (~84 KB)
│   │   ├── react-vendor-BR0qSyTs.js   # React + ReactDOM (~229 KB) ✅
│   │   ├── react-router-c3s0rTgG.js   # React Router (~80 KB)
│   │   ├── framer-motion-Dn4pLCZd.js  # Animations (~100 KB)
│   │   ├── ui-components-1jqlrV-B.js  # Radix UI + Lucide (~120 KB)
│   │   ├── state-http-B5d5v2HU.js     # Zustand + Axios (~40 KB)
│   │   ├── css-utils-cTK6JKSN.js      # Tailwind utils (~20 KB)
│   │   └── ... (другие chunks)
│   └── css/
│       └── index-CtT5GEOS.css         # Main styles
```

### ✅ Правильные признаки сборки:

1. **React vendor chunk**:
   - Название: `react-vendor-{hash}.js`
   - Размер: ~200-250 KB
   - Содержит: react, react-dom, react-is, scheduler

2. **NO старых файлов**:
   - ❌ НЕТ `react-core-DGkr3tva.js` (это старая поломанная сборка!)
   - ❌ НЕТ `index-xU4szPtx.js` (это старая сборка!)

3. **HTML правильный**:
   ```html
   <script type="module" crossorigin src="/assets/js/index-D3FUyENN.js"></script>
   <link rel="modulepreload" href="/assets/js/react-vendor-BR0qSyTs.js">
   ```

---

## 🧪 Как протестировать каждый режим

### Тест 1: DEV Mode
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-dev.ps1

# Проверки:
# ✅ Frontend открылся на http://localhost:5173
# ✅ Backend логи показывают "Server running on port 3001"
# ✅ Proxy показывает "Proxy listening on 8080"
# ✅ ngrok показывает URL
# ✅ Изменения в коде мгновенно применяются
# ✅ Console.log работает
# ✅ В DevTools Sources видны исходные файлы .tsx
```

### Тест 2: PROD-DEV Mode
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-prod-dev-NEW.ps1

# Проверки:
# ✅ Frontend собирается с сообщением "Building for production..."
# ✅ Backend показывает "Serving static from frontend/dist/"
# ✅ Открываем http://localhost:3001
# ✅ В DevTools Network видим файлы react-vendor-{hash}.js
# ✅ НЕТ файлов react-core-*.js (старая сборка)
# ✅ Console.log работает (НЕ удалены)
# ✅ В DevTools Sources видны .js.map файлы
# ✅ Изменения применяются после пересборки (~5-10 сек)
```

### Тест 3: PROD Mode
```powershell
cd E:\Lunch_bot\telegram-food-bot
.\start-prod-local.ps1

# Проверки:
# ✅ Frontend собирается с "Console.log удалены, source maps отключены"
# ✅ Backend показывает "PRODUCTION SERVER (LOCAL TEST)"
# ✅ Открываем http://localhost:3001
# ✅ В DevTools Network видим минифицированные файлы
# ✅ Console.log НЕ работают (удалены)
# ✅ В DevTools Sources НЕТ .map файлов
# ✅ Bundle размер минимальный
# ✅ Service Worker регистрируется (в DevTools Application)
```

---

## 🚀 Рекомендации по workflow

### Для повседневной разработки:
```
1. Используй DEV Mode (start-dev.ps1)
2. Пиши код с Hot Reload
3. Дебажь с console.log
```

### Перед коммитом:
```
1. Запусти PROD-DEV Mode (start-prod-dev-NEW.ps1)
2. Проверь что всё работает с минификацией
3. Проверь что нет ошибок в production bundle
```

### Перед deploy:
```
1. Запусти PROD Mode (start-prod-local.ps1)
2. Проверь финальную сборку локально
3. Проверь что Service Worker работает
4. Проверь размер bundle
5. Запусти тесты: npm test
```

---

## ❓ FAQ

**Q: Почему DEV работает, а PROD-DEV нет?**
A: Разные конфиги! DEV = Vite dev server (без сборки), PROD-DEV = production build с watch. Проверь что `vite.config.prod-dev.ts` идентичен `vite.config.ts` по критическим настройкам (React chunking + dedupe).

**Q: Почему появляется "Cannot set properties of undefined (setting 'Children')"?**
A: React разделен на несколько chunks. Решение: Весь React должен быть в одном `react-vendor` chunk + добавь `dedupe: ['react', 'react-dom']`.

**Q: Нужно ли чистить кэш между режимами?**
A: Рекомендуется! Service Worker может кэшировать старые файлы. Используй DevTools → Clear Storage или скрипт `frontend/public/clear-cache.js`.

**Q: Почему в PROD нет console.log?**
A: Специально! Production сборка удаляет console.log для:
- Уменьшения размера bundle
- Безопасности (не показывать отладочную инфу)
- Производительности

Если нужны логи → используй PROD-DEV Mode.

**Q: Какой режим использовать для тестирования в Telegram?**
A:
- **DEV Mode** - для активной разработки UI
- **PROD-DEV Mode** - для тестирования с production оптимизацией
- **PROD Mode** - для финального тестирования перед deploy (но нужен deploy на сервер или ngrok)

---

## 📝 Checklist перед deploy на VPS

- [ ] Проект работает в DEV Mode
- [ ] Проект работает в PROD-DEV Mode
- [ ] Проект работает в PROD Mode (локально)
- [ ] Все тесты проходят: `npm test` (backend + frontend)
- [ ] TypeScript компилируется: `npm run type-check` (frontend)
- [ ] Нет ESLint ошибок: `npm run lint` (backend + frontend)
- [ ] Bundle размер разумный (<600 KB total)
- [ ] Service Worker работает
- [ ] Проверены переменные окружения в `.env.production`
- [ ] База данных имеет резервную копию
- [ ] Git коммит с описанием изменений

---

**Версия документа**: 1.0
**Дата создания**: 2025-01-12
**Статус**: ✅ Все режимы работают корректно
