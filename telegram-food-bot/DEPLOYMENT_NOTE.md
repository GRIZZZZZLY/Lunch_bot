# 🚀 Деплой на Production VPS

**Домен:** rocket-lunch.duckdns.org  
**Ветка:** feature/new_version

---

## ⚡ Быстрый старт

Все готово к деплою! Откройте файл в корне проекта:

**→ `../START_HERE.md`** ← НАЧНИТЕ ОТСЮДА

---

## 📚 Документация по деплою

Все файлы находятся в корневой директории проекта (`E:\Lunch_bot\`):

1. **START_HERE.md** - главная точка входа
2. **QUICK_VPS_DEPLOY.md** - быстрая шпаргалка
3. **VPS_DEPLOYMENT_GUIDE_NEW.md** - полное руководство
4. **DEPLOYMENT_CHECKLIST.md** - чек-лист проверки

---

## ✅ Что готово

- ✅ Все .env файлы настроены для `rocket-lunch.duckdns.org`
- ✅ Deployment скрипты созданы и автоматизированы
- ✅ Nginx конфигурация готова
- ✅ Документация полная (~85 KB)
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

```bash
# Откройте главный файл в корне проекта
cat ../START_HERE.md

# Или перейдите в корень
cd ..
ls -la *.md
```

**Следуйте инструкциям в START_HERE.md!**
