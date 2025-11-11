# PROD-DEV Script Update

## ✅ Исправлено: MIME Type Error

**Проблема:**
Скрипт `start-prod-dev-NEW.ps1` не пересобирал frontend, если папка `dist/` уже существовала. Это приводило к ошибке:
```
Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"
```

**Причина:**
- В `frontend/dist/` были старые/неполные файлы
- Backend пытался загрузить несуществующий JS файл
- Сервер отдавал fallback HTML вместо JS → MIME type error

## 🔧 Что изменено

Скрипт теперь **всегда пересобирает frontend** при запуске:

```powershell
# Старая логика (НЕПРАВИЛЬНО)
if (-not (Test-Path "frontend\dist")) {
    npm run build  # Собирает только если dist/ не существует
}

# Новая логика (ПРАВИЛЬНО)
npm run build:prod-dev  # ВСЕГДА собирает заново
```

## 📋 Параметры скрипта

```powershell
# Базовый запуск (рекомендуется)
.\start-prod-dev-NEW.ps1

# Без ngrok (только backend)
.\start-prod-dev-NEW.ps1 -NoNgrok

# Пропустить проверки зависимостей (быстрее)
.\start-prod-dev-NEW.ps1 -SkipChecks

# Пропустить сборку frontend (если точно знаете что dist/ актуален)
.\start-prod-dev-NEW.ps1 -SkipBuild

# Комбинация флагов
.\start-prod-dev-NEW.ps1 -SkipChecks -SkipBuild
```

## ⚡ Производительность

- **С пересборкой**: ~20-25 секунд до запуска
- **С -SkipBuild**: ~5-8 секунд до запуска

**Рекомендация:** Используйте `-SkipBuild` только если:
- Вы только что собрали frontend вручную
- Вы перезапускаете скрипт после падения backend
- Вы точно знаете что файлы в `dist/` актуальны

## 🎯 Типичные сценарии

### 1. Первый запуск или после изменений кода
```powershell
.\start-prod-dev-NEW.ps1
```
✅ Гарантирует актуальность всех файлов

### 2. Быстрый перезапуск после падения backend
```powershell
.\start-prod-dev-NEW.ps1 -SkipBuild
```
✅ Экономит 15 секунд, если dist/ уже актуален

### 3. Работа без ngrok (локальное тестирование)
```powershell
.\start-prod-dev-NEW.ps1 -NoNgrok
```
✅ Backend на localhost:3001, без туннеля

## ✅ Результат

Теперь **MIME type ошибка не повторится**, так как скрипт всегда создаёт свежую сборку frontend.

---

**Дата изменений:** 2025-11-07
**Версия скрипта:** 2.0
