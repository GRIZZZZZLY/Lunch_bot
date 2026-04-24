# SECURITY TODO — отложенные действия

> ⚠️ Этот файл — личное напоминание владельцу проекта. Не удалять без выполнения.

## 🔴 Ротация скомпрометированных секретов

**Статус:** ОТЛОЖЕНО (репозиторий приватный, паники нет)
**Дата фиксации:** 2026-04-17

### Что произошло
В git-истории закоммичены `.env`, `.env.production`, `.env.development`, `.env.backup` со значениями:
- `BOT_TOKEN=REDACTED-BOT-TOKEN`
- `JWT_SECRET=REDACTED-JWT-SECRET…`

### Когда обязательно выполнить (триггеры)
- [ ] **ДО** перевода репозитория в public
- [ ] **ДО** добавления collaborator'ов
- [ ] **ДО** настройки CI с внешним runner'ом
- [ ] **ДО** переноса в организацию

### Чек-лист действий (~4 часа)

```bash
# 1. Отозвать токен бота (1 минута)
# Telegram → @BotFather → /revoke → выбрать @rocket_lunch_bot → подтвердить
# Скопировать новый токен в backend/.env

# 2. Сгенерировать новый JWT_SECRET (1 минута)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Заменить значение в backend/.env

# 3. Очистить историю git (~1 час, аккуратно!)
cd e:/Launch_bot/telegram-food-bot
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env backend/.env.production backend/.env.development backend/.env.backup" \
  --prune-empty --tag-name-filter cat -- --all

# Альтернатива (быстрее и безопаснее) — git-filter-repo:
# pip install git-filter-repo
# git filter-repo --path backend/.env --invert-paths

# 4. Force-push (предупредить всех клонов!)
git push origin --force --all
git push origin --force --tags

# 5. Передеплой на VPS с новыми значениями
./update-vps.sh
```

### Проверка после ротации
- [ ] Старый токен `8298516078:...` не работает (проверить через Telegram API: `curl https://api.telegram.org/bot<OLD_TOKEN>/getMe` → должен вернуть 401)
- [ ] `.env*` не появляются в `git log --all --full-history -- backend/.env*`
- [ ] Бот работает с новым токеном
- [ ] Mini App открывается, авторизация проходит

### Источник
Найдено в аудитах:
- `docs/99-archive/AUDIT_EXECUTIVE_SUMMARY.md` (2026-01-12)
- `docs/AUDIT_REPORT_2026-04-17.md`
