# 🚀 START HERE - Быстрый Старт Деплоя

**Домен:** rocket-lunch.duckdns.org  
**Ветка:** feature/new_version  
**Статус:** ✅ ГОТОВ К ДЕПЛОЮ

---

## ⚡ За 3 минуты

### 1️⃣ Прочитайте это (1 мин)

**Важные факты:**
- ✅ Домен настроен: `rocket-lunch.duckdns.org`
- ✅ Все .env файлы обновлены
- ✅ Все скрипты готовы
- ⚠️ **Проект на ветке `feature/new_version` (не main)**

### 2️⃣ Выберите свой путь (1 мин)

#### 🏃 Быстрый старт (опытные пользователи)
→ Откройте: **`QUICK_VPS_DEPLOY.md`**
- Все команды в одном месте
- Копировать-вставить-готово
- 40 минут до production

#### 📖 Подробное руководство (новички)
→ Откройте: **`VPS_DEPLOYMENT_GUIDE_NEW.md`**
- Пошаговые инструкции с объяснениями
- Траблшутинг
- Все детали настройки

#### 📋 Чек-лист (для проверки)
→ Откройте: **`DEPLOYMENT_CHECKLIST.md`**
- Убедитесь, что ничего не забыли
- Отметьте выполненные пункты
- Финальная проверка

### 3️⃣ Начните деплой (1 мин)

```bash
# На VPS
ssh root@YOUR_VPS_IP
cd /root
git clone YOUR_REPO_URL telegram-food-bot
cd telegram-food-bot
git checkout feature/new_version
chmod +x deploy-vps.sh
./deploy-vps.sh
```

**Всё!** Скрипт сделает остальное.

---

## 📚 Все документы

| Документ | Для кого | Время чтения |
|----------|----------|--------------|
| `QUICK_VPS_DEPLOY.md` | Опытные | 5 мин |
| `VPS_DEPLOYMENT_GUIDE_NEW.md` | Все | 20 мин |
| `DEPLOYMENT_CHECKLIST.md` | Все | 10 мин |
| `DEPLOYMENT_FILES_README.md` | Интересующиеся | 15 мин |
| `GIT_BRANCH_INFO.md` | Работа с Git | 5 мин |
| `BRANCH_UPDATE_SUMMARY.md` | Технические детали | 10 мин |

---

## ⚠️ Критически важно

### 1. Ветка Git
Проект на ветке **`feature/new_version`**, НЕ на `main`!

**Скрипты автоматически:**
- ✅ Проверяют ветку
- ✅ Переключаются на `feature/new_version`
- ✅ Предупреждают если что-то не так

### 2. DuckDNS домен
Убедитесь, что:
- ✅ Домен `rocket-lunch.duckdns.org` создан
- ✅ IP VPS привязан к домену
- ✅ DNS резолвится: `nslookup rocket-lunch.duckdns.org`

### 3. Окружение
Все .env файлы уже настроены на:
- ✅ `https://rocket-lunch.duckdns.org`
- ✅ Production режим
- ✅ Правильные CORS настройки

---

## 🎯 Типичный workflow

### Первый деплой (делаете 1 раз)

```bash
# 1. На VPS - установите зависимости (10 мин)
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2

# 2. Клонируйте и деплой (10 мин)
cd /root
git clone YOUR_REPO_URL telegram-food-bot
cd telegram-food-bot
git checkout feature/new_version
chmod +x deploy-vps.sh
./deploy-vps.sh

# 3. Настройте Nginx (5 мин)
cp nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot
ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 4. SSL сертификат (5 мин)
systemctl stop nginx
certbot certonly --standalone -d rocket-lunch.duckdns.org
systemctl start nginx

# 5. Telegram настройки (2 мин)
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://rocket-lunch.duckdns.org/webhook"

curl -X POST "https://api.telegram.org/bot<TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"web_app","text":"🍴 Открыть меню","web_app":{"url":"https://rocket-lunch.duckdns.org"}}}'
```

### Обновления (делаете каждый раз)

```bash
# На локальной машине
git add .
git commit -m "Изменения"
git push origin feature/new_version

# На VPS (одна команда!)
ssh root@YOUR_VPS_IP
cd /root/telegram-food-bot
./update-vps.sh
```

---

## 🔍 Проверка после деплоя

```bash
# Статус
pm2 status

# Логи
pm2 logs rocket-lunch-bot

# Проверка сайта
curl -I https://rocket-lunch.duckdns.org

# Проверка API
curl https://rocket-lunch.duckdns.org/api/health

# Проверка webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 🛠️ Если что-то пошло не так

1. **Проверьте логи:**
   ```bash
   pm2 logs rocket-lunch-bot --err
   tail -f /var/log/nginx/rocket-lunch-bot.error.log
   ```

2. **Перезапустите:**
   ```bash
   pm2 restart rocket-lunch-bot
   systemctl restart nginx
   ```

3. **См. траблшутинг:**
   - `VPS_DEPLOYMENT_GUIDE_NEW.md` → раздел "Траблшутинг"

---

## 📞 Основные команды

```bash
# PM2
pm2 status                     # Статус
pm2 logs rocket-lunch-bot      # Логи
pm2 restart rocket-lunch-bot   # Перезапуск
pm2 monit                      # Мониторинг

# Nginx
nginx -t                       # Проверка конфига
systemctl reload nginx         # Перезагрузка

# Обновление
./update-vps.sh                # Обновить приложение

# Бэкап
./backup-db.sh                 # Бэкап БД
./setup-cron-backup.sh         # Автобэкапы (настроить 1 раз)
```

---

## ✅ Готово!

**Выберите документ и начните:**

1. **Хочу быстро** → `QUICK_VPS_DEPLOY.md`
2. **Хочу понять детали** → `VPS_DEPLOYMENT_GUIDE_NEW.md`
3. **Хочу проверить всё** → `DEPLOYMENT_CHECKLIST.md`

---

## 🎉 Успешного деплоя!

**Домен:** https://rocket-lunch.duckdns.org  
**Telegram:** @rocket_lunch_bot  
**Ветка:** feature/new_version

_Все готово к production!_ 🚀
