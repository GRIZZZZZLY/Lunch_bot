# SECURITY TODO — отложенные действия

> ⚠️ Этот файл — личное напоминание владельцу проекта. Не удалять без выполнения.

## 🔴 Ротация скомпрометированных секретов

**Статус:** ✅ ЗАКРЫТО 2026-07-20 — секреты ротированы (BOT_TOKEN + JWT_SECRET) И git-история очищена + force-push на GitHub.
**Дата фиксации:** 2026-04-17

### Что произошло
В git-истории закоммичены `.env`, `.env.production`, `.env.development`, `.env.backup` со значениями:
- ~~`BOT_TOKEN=REDACTED-BOT-TOKEN`~~ — ОТОЗВАН 2026-07-20 через @BotFather /revoke, прод передеплоен, работает
- ~~`JWT_SECRET=REDACTED-JWT-SECRET…`~~ — РОТИРОВАН 2026-07-20 (новый 128-hex через crypto.randomBytes(64))

### Инцидент 2026-07-20
Токен использовали для перезаписи описания бота (`setMyDescription`) — спам. Причина: токен в git-истории. Revoke закрыл доступ.

### Ротация JWT_SECRET 2026-07-20 (детали)
- Заменён в локальных `.env`, `.env.development`, `.env.prod-dev`, `.env.production` + прод `backend/.env`.
- Прод: `pm2 reload rocket-lunch-bot`. cwd процесса = `/home/zubr/projects/telegram-food-bot/telegram-food-bot/backend`, `dotenv.config()` читает `.env` из cwd → новый секрет применился. `pm2 env` НЕ кэширует JWT_SECRET (нет override-ловушки dotenv).
- Бэкап прод-.env: `backend/.env.bak.jwt-rotate-20260720`.
- ⚠️ Все текущие JWT-сессии инвалидированы — пользователи переоткрывают Mini App (авторизуются заново). Аватары (`/api/avatar` HMAC на JWT_SECRET) перегенерят подписи автоматически.
- Проверено: `/health` 200, `getMe` ok, webhook `rocketlunch.dpdns.org/webhook` активен.

### ✅ Чистка git-истории 2026-07-20 (выполнено)
git root = весь `E:/Launch_bot` (монорепо, 302 коммита, 12 веток на GitHub). Прогнан `git filter-repo` (3 прохода):
1. Удалены все `.env`/`.env.*` (кроме `*.env.example`) из всей истории.
2. `--replace-text`: старые BOT_TOKEN + JWT_SECRET заменены на плейсхолдеры в доках/скриптах/логах/backup-env (десятки файлов).
3. Удалён `backend/prisma/dev.db` (SQLite — содержал токен в telegram-данных, `--replace-text` бинарь не берёт).

Верификация: `git grep` по всем деревьям → **0** вхождений обоих секретов; `.env`/`dev.db` в истории отсутствуют; 17 локальных веток и 3 stash целы.
Force-push: 12 origin-веток перезаписаны (`+refs/heads/*`). Локальные-only ветки (auto-claude×4, multitenant-groups) на origin не отправлены.

**Бэкап для отката** (можно удалить после проверки, что всё работает): `E:/Launch_bot-history-backup-20260720/` — `origin-mirror.git` (снимок GitHub ДО чистки) + `local-all-refs.bundle` + патчи незакоммиченной работы.
Откат origin: `git -C E:/Launch_bot-history-backup-20260720/origin-mirror.git push --mirror https://github.com/GRIZZZZZLY/Lunch_bot.git`.

⚠️ **GitHub может держать старые коммиты в кэше** (доступны по прямому SHA до серверного GC / пока живы форки и открытые PR). Секреты уже невалидны, так что это неопасно; для полной зачистки — обратиться в GitHub Support за GC либо пересоздать репозиторий.

### Триггеры (были обязательны ДО выполнения — теперь закрыты)
- [x] **ДО** перевода репозитория в public
- [x] **ДО** добавления collaborator'ов
- [x] **ДО** настройки CI с внешним runner'ом
- [x] **ДО** переноса в организацию

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
