# Развёртывание Rocket Lunch

Выпуск один: `bash deploy-vps.sh` на сервере, из исходного чекаута. Скрипт
собирает релиз из конкретного коммита в отдельном каталоге и переключает на
него PM2. GitHub Actions в проекте нет, и перед выкатом никто, кроме вас, не
проверяет, что коммит зелёный.

## Требования к серверу

- Ubuntu с Node.js 22, npm 10, PostgreSQL 16, Redis, Nginx и PM2;
- репозиторий с основной веткой `main`;
- заполненный `backend/.env` с `NODE_ENV=production`,
  `FRONTEND_DIR=frontend-new`, `REDIS_ENABLED=true` и безопасными секретами;
- настроенный TLS и проксирование Nginx;
- за Cloudflare — настоящий адрес клиента в Nginx (раздел
  «[Адрес клиента за Cloudflare](#адрес-клиента-за-cloudflare)»);
- проверенная резервная копия PostgreSQL.

Полный список условий выпуска:
[RELEASE_RUNBOOK.md](docs/09-production-readiness/RELEASE_RUNBOOK.md).

Секреты приложения остаются в `backend/.env` исходного чекаута и не копируются
в Git. Скрипт кладёт копию этого файла в каждый релиз.

## Перед выпуском

Выкатывается то, что лежит в `origin/main`. Проверки на GitHub нет, поэтому
коммит должен пройти полный прогон локально:

```bash
bash scripts/check-all.sh
```

Этот скрипт — единственный список проверок проекта. Git-хук
`.githooks/pre-push` запускает его при каждом пуше в `main`, если в клоне
выполнено `git config core.hooksPath .githooks`. Пушить в `main` с
`--no-verify` нельзя: тогда на сервер попадёт непроверенный коммит.

Проект Playwright `integration` (`tests/e2e/specs/integration.spec.ts`) и
прод-смоук (`ops/production-smoke`) ищут тексты интерфейса. Переименовали экран
или подпись — поищите старый текст в этих файлах до выката.

## Выпуск

```bash
cd <любой каталог репозитория на сервере>   # исходный чекаут или текущий релиз
bash deploy-vps.sh
```

Скрипт делает `git fetch` в исходном чекауте, создаёт worktree на коммит в
`<repo>-releases/<sha>/`, собирает сервер и `frontend-new`, применяет миграции,
переключает `current`, пересоздаёт процесс PM2 и проверяет `/health`. Если
новый релиз не поднялся, скрипт сам возвращает предыдущий.

Переменные: `REF` (по умолчанию `origin/main`) — что выкатывать; `ENV_SUFFIX`
(`production` | `prod-dev`) — режим сборки Vite; `SOURCE_CHECKOUT`,
`RELEASES_DIR`, `BACKEND_ENV`, `PM2_APP`, `HEALTH_URL` — если раскладка на
сервере отличается от принятой.

После успешной проверки `/health` скрипт удаляет старые релизы: остаются
`current`, предыдущий и `KEEP_RELEASES` свежих (по умолчанию три). Каждый релиз
несёт свои `node_modules` — около 800 МБ, поэтому без уборки серия выпусков
съедает диск. Уборка идёт последней и не влияет на результат выпуска.

Смену релиза выполняйте только через этот скрипт. `pm2 reload` и
`pm2 startOrReload` сохраняют путь к скрипту у запущенного процесса: команда
завершится успехом, а работать продолжит прошлый релиз.

Сценарий `update-vps.sh` обновляет рабочий каталог через `git pull` и релизную
раскладку не знает: он остался для стендов, где нет каталогов релизов.

## Откат

```bash
ROLLBACK=1 bash deploy-vps.sh
```

Откат ничего не собирает: он переключает `current` на релиз из
`.previous-release` и пересоздаёт процесс PM2. Текущий релиз становится
«предыдущим», поэтому повторный `ROLLBACK=1` возвращает обратно. Миграции базы
откат не отменяет: если выпуск менял схему, сначала прочитайте раздел об откате
в [RELEASE_RUNBOOK.md](docs/09-production-readiness/RELEASE_RUNBOOK.md).

## Проверка после выпуска

```bash
curl --fail https://rocketlunch.dpdns.org/health
curl --fail https://rocketlunch.dpdns.org/health/ready
pm2 status
pm2 logs rocket-lunch-bot --lines 100
```

Порядок проверки миграций, дымовой проверки и отката:
[RELEASE_RUNBOOK.md](docs/09-production-readiness/RELEASE_RUNBOOK.md).

## Адрес клиента за Cloudflare

Домен проксирует Cloudflare. Без отдельной настройки Nginx видит вместо
пользователя адрес узла Cloudflare, и приложение получает его как `req.ip`.
Все лимиты по IP тогда общие для всех, кого Cloudflare провёл через один узел.
Первым упирается лимит входа `/api/auth/validate`: 120 за 15 минут, а Mini App
проходит вход при каждом открытии. Настоящих адресов нет и в журналах.

[ops/nginx/cloudflare-realip.conf](ops/nginx/cloudflare-realip.conf) берёт
адрес из заголовка `CF-Connecting-IP`, но только для соединений из сетей
Cloudflare: в обход Cloudflare заголовок не подделать. Установка:

```bash
sudo install -m 644 ops/nginx/cloudflare-realip.conf /etc/nginx/snippets/
# в server { } сайта: include snippets/cloudflare-realip.conf;
sudo nginx -t && sudo systemctl reload nginx
```

Проверка: у запросов `/api/` в `/var/log/nginx/access.log` стоят адреса
пользователей, а не `162.158.*`, `172.64–71.*` или `104.16–27.*`. Список сетей
Cloudflare опубликован на https://www.cloudflare.com/ips/. Если он изменится,
обновите файл.

## Резервные копии

Ежедневные копии снимает таймер systemd: `backup-db.sh` делает `pg_dump` в
формате custom, проверяет архив через `pg_restore --list`, пишет `.sha256` и
удаляет всё, кроме `KEEP` последних (по умолчанию 14). Ротация трогает только
файлы `foodbot_auto_*`; ручные дампы вроде `foodbot_pre_<sha>_*` остаются.

Установка на сервере:

```bash
bash ops/backup-db/install-vps.sh /путь/к/исходному/чекауту
```

Установщик подставляет рабочий каталог в юнит, делает пробный запуск и включает
расписание только после успешного. Проверка и ручной запуск:

```bash
systemctl list-timers telegram-food-bot-backup-db.timer
sudo systemctl start telegram-food-bot-backup-db.service
journalctl -u telegram-food-bot-backup-db.service -n 50 --no-pager
```

До миграций дополнительно создайте отдельный дамп и проверьте его размер.
Инструкция: [BACKUP_RESTORE_GUIDE.md](docs/BACKUP_RESTORE_GUIDE.md).

## Оповещения о падениях

Регулярные проверки — прод-смоук и резервное копирование — сообщают о провале в
Telegram: у обоих юнитов есть `OnFailure=telegram-food-bot-alert@%n.service`.
Сообщение содержит имя юнита, код возврата и хвост журнала, чтобы разбор не
начинался с похода на сервер.

```bash
bash ops/alerting/install-vps.sh /путь/к/исходному/чекауту
```

Установщик ставит шаблонный юнит и проверяет доставку на заведомо падающем
пробном юните — оповещения считаются работающими только после дошедшего
сообщения. Получатель берётся из `ALERT_TELEGRAM_CHAT_ID`, иначе из
`ADMIN_USER_IDS` боевого `backend/.env`; токен — `BOT_TOKEN` оттуда же, поэтому
отдельный секрет не нужен и ротация токена не ломает доставку.

После изменения строки `OnFailure` в юните переустановите его собственным
установщиком (`ops/production-smoke/install-vps.sh`, `ops/backup-db/install-vps.sh`).

Тот же установщик ставит сторожа приложения — `telegram-food-bot-watch-app`,
каждые 5 минут. `OnFailure` покрывает только падения регулярных заданий, а сам
бот падает и поднимается молча: pm2 перезапускает процесс и никому не сообщает.
Сторож проверяет наличие процесса в pm2 и статус `online`, рост счётчика
перезапусков, ответ `/health` и всплеск новых строк в `backend/logs/error.log`.

Сообщения шлются на переходе состояния, а не на каждой проверке — иначе
сломанный прод пишет каждые пять минут, и на сообщения перестают смотреть.
Возврат в норму тоже сообщается: молчание неотличимо от умершего сторожа. У
всплеска ошибок свой порог (`ERROR_BURST`, по умолчанию 30 строк) и час тишины
после сообщения (`ERROR_COOLDOWN_MIN`).

Ошибки приложения в рантайме сторож не заменяет: для них в коде есть Sentry или
GlitchTip, но он выключен — нужны `SENTRY_DSN` (или `GLITCHTIP_DSN`) и
`ENABLE_SENTRY=true` в боевом `backend/.env`.
