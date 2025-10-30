# 🔧 Инструкции по исправлению VPS

**Проблемы:**
1. ❌ Frontend НЕ собрался (vite: Permission denied)
2. ❌ Nginx показывает дефолтную страницу вместо приложения
3. ⚠️ SSL сертификат не настроен

---

## 🚀 БЫСТРОЕ ИСПРАВЛЕНИЕ (5 минут)

Выполните команды по порядку:

### 1. Исправьте права и пересоберите frontend

```bash
# Исправьте права на node_modules
cd ~/Lunch_bot/telegram-food-bot/frontend
chmod -R +x node_modules/.bin

# Пересоберите frontend
npm run build

# Проверьте что сборка успешна
ls -la dist/
```

---

### 2. Настройте Nginx

```bash
# Проверьте что конфигурация существует
ls -la ~/Lunch_bot/telegram-food-bot/nginx-vps.conf

# Скопируйте конфигурацию Nginx
sudo cp ~/Lunch_bot/telegram-food-bot/nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot

# Удалите старую ссылку если есть
sudo rm -f /etc/nginx/sites-enabled/rocket-lunch-bot

# Создайте новую ссылку
sudo ln -s /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/

# Удалите дефолтную конфигурацию
sudo rm -f /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
sudo nginx -t

# Если ошибка - исправьте и повторите nginx -t
```

---

### 3. Получите SSL сертификат

```bash
# Остановите Nginx (нужно для standalone режима)
sudo systemctl stop nginx

# Получите сертификат
sudo certbot certonly --standalone -d rocket-lunch.duckdns.org --agree-tos --email your-email@example.com

# Запустите Nginx
sudo systemctl start nginx

# Проверьте статус
sudo systemctl status nginx
```

---

### 4. Проверьте работу

```bash
# Проверьте HTTP (должен редиректить на HTTPS)
curl -I http://rocket-lunch.duckdns.org

# Проверьте HTTPS
curl -I https://rocket-lunch.duckdns.org

# Откройте в браузере
# https://rocket-lunch.duckdns.org
```

---

## 📋 Подробное объяснение проблем

### Проблема 1: Frontend не собрался

**Ошибка:**
```
sh: 1: vite: Permission denied
```

**Причина:** Node modules установлены без executable прав

**Решение:**
```bash
cd ~/Lunch_bot/telegram-food-bot/frontend
chmod -R +x node_modules/.bin
npm run build
```

---

### Проблема 2: Nginx показывает дефолтную страницу

**Признаки:**
- `curl -I http://localhost:80` возвращает Content-Length: 615
- Last-Modified показывает старую дату
- В браузере не открывается сайт

**Причина:** Nginx использует дефолтную конфигурацию вместо rocket-lunch-bot

**Решение:**
```bash
# Скопируйте конфигурацию
sudo cp ~/Lunch_bot/telegram-food-bot/nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot

# Активируйте её
sudo ln -sf /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/

# Удалите default
sudo rm -f /etc/nginx/sites-enabled/default

# Перезагрузите
sudo systemctl reload nginx
```

---

### Проблема 3: SSL не настроен

**Причина:** Certbot не запущен, сертификат не получен

**Решение:**
```bash
# Остановите Nginx
sudo systemctl stop nginx

# Получите сертификат
sudo certbot certonly --standalone -d rocket-lunch.duckdns.org

# Запустите Nginx
sudo systemctl start nginx
```

---

## ⚡ ВСЁ ОДНОЙ КОМАНДОЙ (полное исправление)

```bash
# Исправление прав и сборка frontend
cd ~/Lunch_bot/telegram-food-bot/frontend && \
chmod -R +x node_modules/.bin && \
npm run build && \
echo "✅ Frontend собран" && \

# Настройка Nginx
cd ~/Lunch_bot/telegram-food-bot && \
sudo cp nginx-vps.conf /etc/nginx/sites-available/rocket-lunch-bot && \
sudo ln -sf /etc/nginx/sites-available/rocket-lunch-bot /etc/nginx/sites-enabled/ && \
sudo rm -f /etc/nginx/sites-enabled/default && \
sudo nginx -t && \
echo "✅ Nginx настроен" && \

# Остановка Nginx для получения SSL
sudo systemctl stop nginx && \

# Получение SSL (замените email!)
sudo certbot certonly --standalone -d rocket-lunch.duckdns.org --agree-tos --email your-email@example.com --non-interactive && \
echo "✅ SSL получен" && \

# Запуск Nginx
sudo systemctl start nginx && \
echo "✅ Nginx запущен" && \

# Проверка
curl -I https://rocket-lunch.duckdns.org && \
echo "" && \
echo "🎉 Всё готово! Откройте https://rocket-lunch.duckdns.org"
```

**⚠️ ВАЖНО:** Замените `your-email@example.com` на ваш реальный email!

---

## 🔍 Проверка после исправления

### Checklist:

```bash
# 1. Frontend собран?
ls -la ~/Lunch_bot/telegram-food-bot/frontend/dist/index.html
# Должен существовать

# 2. Nginx конфигурация активна?
ls -la /etc/nginx/sites-enabled/ | grep rocket-lunch-bot
# Должна быть ссылка

# 3. Дефолт удалён?
ls -la /etc/nginx/sites-enabled/ | grep default
# Не должно быть

# 4. Nginx работает?
sudo systemctl status nginx
# Должен быть active (running)

# 5. SSL сертификат получен?
sudo ls -la /etc/letsencrypt/live/rocket-lunch.duckdns.org/
# Должны быть файлы: cert.pem, chain.pem, fullchain.pem, privkey.pem

# 6. Сайт доступен?
curl -I https://rocket-lunch.duckdns.org
# Должен вернуть 200 OK

# 7. HTTP редиректит на HTTPS?
curl -I http://rocket-lunch.duckdns.org
# Должен вернуть 301 или 308 с Location: https://...
```

---

## 🆘 Если что-то не работает

### Ошибка: nginx -t выдаёт ошибку

**Проверьте конфигурацию:**
```bash
sudo nginx -t
```

**Если ошибка про SSL:**
```
nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/rocket-lunch.duckdns.org/fullchain.pem"
```

**Решение:** Сначала получите SSL сертификат, затем настройте Nginx

---

### Ошибка: certbot не может получить сертификат

**Проверьте:**
```bash
# Nginx остановлен?
sudo systemctl status nginx

# Порт 80 свободен?
sudo netstat -tuln | grep :80

# DuckDNS домен доступен?
ping rocket-lunch.duckdns.org
```

**Решение:**
```bash
# Убедитесь что Nginx остановлен
sudo systemctl stop nginx

# Убедитесь что порт 80 свободен
sudo netstat -tuln | grep :80
# Не должно быть вывода

# Попробуйте снова
sudo certbot certonly --standalone -d rocket-lunch.duckdns.org
```

---

### Ошибка: frontend не собирается

```bash
# Проверьте права
ls -la ~/Lunch_bot/telegram-food-bot/frontend/node_modules/.bin/vite

# Должно быть -rwxr-xr-x (с x)

# Если нет - исправьте
chmod +x ~/Lunch_bot/telegram-food-bot/frontend/node_modules/.bin/*

# Попробуйте собрать
cd ~/Lunch_bot/telegram-food-bot/frontend
npm run build
```

---

## 📝 Финальная проверка

После выполнения всех шагов:

```bash
# Статус всех компонентов
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== Nginx Status ==="
sudo systemctl status nginx | head -20

echo ""
echo "=== Frontend Build ==="
ls -lh ~/Lunch_bot/telegram-food-bot/frontend/dist/index.html

echo ""
echo "=== Nginx Config ==="
ls -la /etc/nginx/sites-enabled/

echo ""
echo "=== SSL Certificate ==="
sudo ls -la /etc/letsencrypt/live/rocket-lunch.duckdns.org/

echo ""
echo "=== HTTP Test ==="
curl -I http://localhost:3001

echo ""
echo "=== HTTPS Test ==="
curl -I https://rocket-lunch.duckdns.org 2>&1 | head -20
```

---

## ✅ Успех!

Если все проверки прошли, откройте в браузере:

```
https://rocket-lunch.duckdns.org
```

Должна открыться главная страница приложения! 🎉

---

## 🔄 Автоматическое обновление SSL

Certbot автоматически настраивает обновление, но проверьте:

```bash
# Проверьте таймер
sudo systemctl status certbot.timer

# Тест обновления (dry run)
sudo certbot renew --dry-run
```

Если всё ОК - сертификат будет обновляться автоматически каждые 60 дней.

---

**Следующий шаг:** Выполните команды выше и проверьте работу! 🚀
