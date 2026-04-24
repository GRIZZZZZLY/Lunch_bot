# 🚀 Деплой на Production VPS

**Домен:** TBD  
**Ветка:** feature/new_version

---

## ⚡ Быстрый старт

Актуальное руководство:

- **DEPLOYMENT.md** (Ubuntu VPS + Nginx + SSL)
- **docs/04-deployment/README.md** (детали по деплою)

---

## 📚 Документация по деплою

Основные файлы в корне проекта:

1. **DEPLOYMENT.md** - актуальная инструкция для Ubuntu VPS
2. **DEPLOY_PROD_DEV_TO_VPS.md** - существующий сценарий деплоя
3. **PRODUCTION_READINESS_CHECKLIST.md** - чек-лист готовности

---

## ✅ Что готово

- ✅ Deployment скрипты созданы и автоматизированы
- ✅ Nginx конфигурация готова
- ✅ Документация подготовлена
- ✅ Автоматическая работа с веткой `feature/new_version`

---

## 🎯 Deployment скрипты

В корне проекта:
- `deploy-vps.sh` - полный деплой
- `update-vps.sh` - быстрое обновление
- `backup-db.sh` - бэкап базы данных
- `setup-cron-backup.sh` - автоматические бэкапы

Все скрипты автоматически работают с веткой `feature/new_version`.

---

## 📖 Для начала

Откройте **DEPLOYMENT.md** и следуйте шагам.
