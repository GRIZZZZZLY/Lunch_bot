# PROD-DEV Mode - Исправление скрипта запуска

## Проблема (было раньше)

Скрипт `start-prod-dev.ps1` **неправильно** запускал backend:

```powershell
# ❌ БЫЛО:
npm run dev  # tsx watch - DEV режим, не production
```

И включал **ненужные сервисы**:
- Proxy server на порту 8080
- ngrok туннелировал порт 8080

## Решение (стало теперь)

### Исправленная архитектура:

```
Telegram → ngrok → Backend:3001 ─┬─ /api → API
                                  └─ /    → Static (frontend/dist/)
```

**БЕЗ:**
- Proxy server (не нужен, backend сам отдает статику)
- Frontend dev server (используется собранный dist/)

### Исправленный скрипт запускает:

**Window 1 - Backend:**
```powershell
npm run build  # Компиляция TypeScript
npm start      # Запуск скомпилированного кода (production)
```

**Window 2 - Frontend:**
```powershell
npm run build:prod-dev  # Production build + watch mode
```

**Window 3 - ngrok:**
```powershell
ngrok http 3001  # ✅ Правильный порт (было 8080)
```

**Window 4 - URL Updater:**
```powershell
.\update-urls-prod.ps1  # Автообновление .env
```

---

## Отличия режимов (итоговое)

### DEV режим (`.\start-dev.ps1`)
- Backend: `tsx watch` (TypeScript напрямую)
- Frontend: Vite dev server (5173)
- Proxy: Объединяет frontend + backend (8080)
- ngrok: Туннелирует proxy (8080)
- **5 окон**

**Архитектура:**
```
Telegram → ngrok:8080 → Proxy:8080 ─┬─ / → Vite:5173 (HMR)
                                     └─ /api → Backend:3001
```

### PROD-DEV режим (`.\start-prod-dev.ps1`) ✅ ИСПРАВЛЕНО
- Backend: Скомпилированный JS (production build)
- Frontend: Production build с watch mode
- Proxy: НЕТ (backend отдает статику)
- ngrok: Туннелирует backend (3001)
- **4 окна**

**Архитектура:**
```
Telegram → ngrok:3001 → Backend:3001 ─┬─ /api → API
                                       └─ / → Static (dist/)
```

### PROD режим (`.\start-prod.ps1`)
- Backend: Скомпилированный JS
- Frontend: Production build (без watch)
- Proxy: НЕТ
- ngrok: Туннелирует backend (3001)
- **3 окна**

**Архитектура:**
```
Telegram → ngrok:3001 → Backend:3001 ─┬─ /api → API
                                       └─ / → Static (dist/)
```

---

## Когда использовать PROD-DEV

✅ **Используй PROD-DEV когда:**
- Проверяешь как работает production сборка
- Тестируешь минификацию и оптимизации
- Нужны production условия, но с возможностью отладки
- Готовишься к деплою на VPS

❌ **НЕ используй PROD-DEV когда:**
- Активно разрабатываешь UI (используй DEV - быстрее HMR)
- Нужна максимальная скорость изменений (используй DEV)
- Финальное тестирование перед деплоем (используй PROD)

---

## Проверка что режим работает правильно

После запуска `.\start-prod-dev.ps1`:

**Window 1 (Backend):**
```
✅ "Building TypeScript..." 
✅ "OK Build completed"
✅ "Port: 3001"
✅ "OK Production build"
✅ "OK Serving static from dist/"
```

**Window 2 (Frontend):**
```
✅ "vite build --watch"
✅ "dist/index.html ... kB"
✅ "watching for file changes..."
```

**Window 3 (ngrok):**
```
✅ "Tunneling: http://localhost:3001"  # НЕ 8080!
✅ HTTPS URL отображается
```

**Window 4 (URL Updater):**
```
✅ Запрашивает ngrok URL
✅ Обновляет .env файлы
```

---

## Дата исправления
2025-10-31

## Затронутые файлы
- `start-prod-dev.ps1` - исправлена архитектура запуска
