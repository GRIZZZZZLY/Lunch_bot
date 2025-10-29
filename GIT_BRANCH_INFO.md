# ⚠️ Важно: Проект на ветке feature/new_version

## Текущая конфигурация

- **Рабочая ветка:** `feature/new_version`
- **Основная ветка:** `main` (не используется для деплоя)
- **Деплой ветка:** `feature/new_version`

---

## 🚨 Критично: Всегда используйте feature/new_version!

Все deployment скрипты и документация обновлены для работы с веткой `feature/new_version`.

### Автоматическая проверка

Скрипты `deploy-vps.sh` и `update-vps.sh` автоматически:
- ✅ Проверяют текущую ветку
- ✅ Переключаются на `feature/new_version` если нужно
- ✅ Предупреждают если ветка не та

---

## 📝 Команды для работы

### На локальной машине

```bash
# Проверить текущую ветку
git branch

# Переключиться на feature/new_version
git checkout feature/new_version

# Закоммитить изменения
git add .
git commit -m "Ваше сообщение"

# Запушить в feature/new_version
git push origin feature/new_version
```

### На VPS

```bash
# Клонирование (первый раз)
git clone YOUR_REPO_URL telegram-food-bot
cd telegram-food-bot
git checkout feature/new_version

# Обновление (каждый раз)
cd /root/telegram-food-bot
./update-vps.sh
# Скрипт автоматически переключится на feature/new_version
```

---

## 🔄 Merge в main (когда будете готовы)

Когда проект протестирован и готов к production:

```bash
# На локальной машине
git checkout main
git merge feature/new_version
git push origin main

# Обновить документацию для использования main
# (или оставить feature/new_version как production ветку)
```

---

## ⚙️ Что обновлено для feature/new_version

### Скрипты:
- ✅ `deploy-vps.sh` - автопроверка ветки
- ✅ `update-vps.sh` - автопереключение на feature/new_version

### Документация:
- ✅ `QUICK_VPS_DEPLOY.md` - все команды используют feature/new_version
- ✅ `VPS_DEPLOYMENT_GUIDE_NEW.md` - инструкции обновлены
- ✅ `DEPLOYMENT_READY_SUMMARY.md` - указана ветка

---

## 📊 Workflow

```
Local (feature/new_version)
  ↓ git push origin feature/new_version
GitHub/GitLab (feature/new_version)
  ↓ git pull origin feature/new_version
VPS (feature/new_version) → Production
```

---

## ✅ Готово!

Все настроено для работы с веткой `feature/new_version`.  
Скрипты автоматически проверят и переключат ветку при необходимости.
