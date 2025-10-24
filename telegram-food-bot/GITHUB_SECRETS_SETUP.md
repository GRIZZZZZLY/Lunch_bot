# 🔐 Настройка GitHub Secrets для CI/CD

## Зачем нужны Secrets?

GitHub Secrets позволяют безопасно хранить чувствительные данные (токены, пароли, ключи) и использовать их в GitHub Actions workflows без их явного указания в коде.

---

## Список необходимых Secrets

### 1. **Для Sentry (Мониторинг ошибок)**

| Secret Name | Description | Пример |
|------------|-------------|--------|
| `SENTRY_DSN_BACKEND` | DSN для backend проекта в Sentry | `https://xxx@sentry.io/123456` |
| `SENTRY_DSN_FRONTEND` | DSN для frontend проекта в Sentry | `https://yyy@sentry.io/789012` |

### 2. **Для Production Deployment**

| Secret Name | Description | Пример |
|------------|-------------|--------|
| `SSH_PRIVATE_KEY` | SSH ключ для доступа к серверу | `-----BEGIN RSA PRIVATE KEY-----...` |
| `SERVER_HOST` | IP адрес или домен сервера | `example.com` или `123.45.67.89` |
| `SERVER_USER` | Имя пользователя на сервере | `ubuntu` или `root` |
| `SERVER_PATH` | Путь к проекту на сервере | `/var/www/telegram-food-bot` |

### 3. **Для Frontend Build**

| Secret Name | Description | Пример |
|------------|-------------|--------|
| `VITE_API_URL` | URL backend API | `https://api.example.com` |
| `VITE_BOT_USERNAME` | Username Telegram бота | `your_bot_username` |

### 4. **Для Backend (опционально)**

| Secret Name | Description | Когда нужен |
|------------|-------------|-------------|
| `DATABASE_URL` | URL production базы данных | Если используете PostgreSQL |
| `JWT_SECRET` | Секретный ключ для JWT | Если генерируете JWT в CI |
| `TELEGRAM_BOT_TOKEN` | Токен бота | Если запускаете интеграционные тесты |

### 5. **Для Docker Registry (опционально)**

| Secret Name | Description | Пример |
|------------|-------------|--------|
| `DOCKER_USERNAME` | Username в Docker Hub | `your_username` |
| `DOCKER_PASSWORD` | Пароль/токен Docker Hub | `dckr_pat_xxxxx` |

---

## Как добавить Secrets

### Шаг 1: Перейдите в Settings

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** (вкладка справа вверху)
3. В левом меню выберите **Secrets and variables** → **Actions**

### Шаг 2: Добавьте Secret

1. Нажмите **New repository secret**
2. Введите **Name** (точное имя из таблицы выше)
3. Введите **Secret** (значение)
4. Нажмите **Add secret**

### Шаг 3: Повторите для всех Secrets

Добавьте все необходимые secrets из списка выше.

---

## Как получить значения Secrets?

### 1. SSH_PRIVATE_KEY

Сгенерируйте SSH ключ на локальной машине:

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@telegram-food-bot" -f ~/.ssh/github_actions_key
```

**Добавьте публичный ключ на сервер:**

```bash
# Скопируйте содержимое
cat ~/.ssh/github_actions_key.pub

# На сервере добавьте в authorized_keys
echo "ПУБЛИЧНЫЙ_КЛЮЧ" >> ~/.ssh/authorized_keys
```

**Добавьте приватный ключ в GitHub Secrets:**

```bash
# Скопируйте весь приватный ключ
cat ~/.ssh/github_actions_key

# Вставьте в GitHub Secret SSH_PRIVATE_KEY (включая BEGIN/END строки)
```

### 2. SENTRY_DSN

1. Зарегистрируйтесь на [sentry.io](https://sentry.io)
2. Создайте проект для Backend (Node.js)
3. Создайте проект для Frontend (React)
4. Скопируйте DSN из Settings → Client Keys (DSN)

### 3. SERVER_* переменные

**SERVER_HOST:**
```bash
# IP адрес вашего сервера или домен
# Примеры:
123.45.67.89
example.com
subdomain.example.com
```

**SERVER_USER:**
```bash
# Обычно:
ubuntu  # для Ubuntu/Debian
root    # для других дистрибутивов
```

**SERVER_PATH:**
```bash
# Полный путь к проекту на сервере
# Пример:
/var/www/telegram-food-bot
/home/ubuntu/apps/telegram-food-bot
```

### 4. VITE_* переменные

Эти значения берутся из вашего production .env файла:

```bash
# frontend/.env.production
VITE_API_URL=https://api.yourdomain.com
VITE_BOT_USERNAME=your_bot_username
```

---

## Проверка настройки Secrets

### 1. Запустите тестовый workflow

Сделайте коммит и push - GitHub Actions автоматически запустится.

### 2. Проверьте логи

В вкладке **Actions** посмотрите логи выполнения. Secrets будут скрыты (`***`):

```
Setting up SSH with key: ***
Connecting to server: ***@***
```

### 3. Тестовый деплой

Запустите деплой вручную:

1. Перейдите в **Actions**
2. Выберите **Deploy to Production**
3. Нажмите **Run workflow**
4. Выберите окружение и запустите

---

## Безопасность Secrets

### ✅ Best Practices

1. **Никогда не логируйте Secrets**
   ```yaml
   # ❌ ПЛОХО
   run: echo ${{ secrets.API_KEY }}
   
   # ✅ ХОРОШО
   run: echo "Using API key"
   ```

2. **Используйте Environments**
   - Создайте отдельные окружения (staging, production)
   - Настройте разные secrets для каждого
   - Добавьте required reviewers для production

3. **Регулярно ротируйте Secrets**
   - Меняйте SSH ключи раз в 3-6 месяцев
   - Обновляйте API токены
   - Удаляйте неиспользуемые secrets

4. **Ограничивайте доступ**
   - Repository secrets - доступны всем с write доступом
   - Environment secrets - доступны только в specific environment
   - Organization secrets - доступны во всех репозиториях

### ⚠️ Что НЕ стоит делать

1. ❌ Коммитить secrets в код
2. ❌ Выводить secrets в логи
3. ❌ Использовать один secret для всех окружений
4. ❌ Давать secrets слишком широкие права
5. ❌ Забывать об истечении токенов

---

## Environments Setup

### Создание окружений

1. Settings → Environments → **New environment**
2. Создайте окружения:
   - `production`
   - `staging`

### Настройка Protection Rules

Для `production` environment:

1. **Required reviewers**: добавьте себя/команду
2. **Wait timer**: 5 минут (для отмены в случае ошибки)
3. **Deployment branches**: только `main` branch

### Добавление Secrets в Environment

1. Откройте environment
2. **Add secret**
3. Добавьте специфичные secrets (например, разные DATABASE_URL)

---

## Тестирование локально

Для тестирования деплоя локально используйте [act](https://github.com/nektos/act):

```bash
# Установка act
brew install act  # macOS
choco install act # Windows

# Запуск workflow локально
act -s SSH_PRIVATE_KEY="$(cat ~/.ssh/id_rsa)"
```

**⚠️ Внимание:** не используйте production secrets для локального тестирования!

---

## Troubleshooting

### Secret не работает

1. **Проверьте название** - должно точно совпадать
2. **Проверьте доступ** - может быть ограничен environment
3. **Пересоздайте secret** - иногда помогает удаление и повторное создание

### Деплой падает с ошибкой доступа

1. Проверьте SSH ключ - правильный ли приватный ключ
2. Проверьте публичный ключ на сервере - добавлен ли в authorized_keys
3. Проверьте permissions - `chmod 600 ~/.ssh/authorized_keys`

### Workflow не видит secret

1. Убедитесь что secret создан в правильном месте (Repository/Environment)
2. Проверьте что environment указан в workflow
3. Проверьте что используете правильный синтаксис: `${{ secrets.SECRET_NAME }}`

---

## Полезные ссылки

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments)
- [SSH Key Setup](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [act - Local GitHub Actions](https://github.com/nektos/act)

---

## Чеклист настройки

- [ ] Созданы SSH ключи для деплоя
- [ ] Публичный ключ добавлен на сервер
- [ ] Созданы Sentry проекты и получены DSN
- [ ] Все secrets добавлены в GitHub
- [ ] Созданы environments (staging, production)
- [ ] Настроены protection rules для production
- [ ] Протестирован workflow локально
- [ ] Выполнен тестовый деплой на staging
- [ ] Проверен health check после деплоя

---

**Готово!** Теперь ваш CI/CD pipeline полностью настроен и готов к использованию 🚀
