# Развёртывание Rocket Lunch

Канонический способ выпуска — защищённое окружение GitHub Actions и неизменяемая
сборка из конкретного коммита. Рабочий процесс:
`.github/workflows/deploy.yml`.

## Требования к серверу

- Ubuntu с Node.js 22, npm 10, PostgreSQL, Redis, Nginx и PM2 (на действующем
  сервере PostgreSQL 14.24, хотя CI и `docker-compose.production.yml`
  рассчитаны на 16 — расхождение известно и не устранено);
- репозиторий с основной веткой `main`;
- заполненный `backend/.env` с `NODE_ENV=production`,
  `FRONTEND_DIR=frontend-new`, `REDIS_ENABLED=true` и безопасными секретами;
- настроенный TLS и проксирование Nginx;
- проверенная резервная копия PostgreSQL.

Полный список условий выпуска:
[RELEASE_RUNBOOK.md](docs/09-production-readiness/RELEASE_RUNBOOK.md).

## Секреты GitHub Actions

В окружении `production` или `staging` должны быть:

| Секрет | Назначение |
|---|---|
| `SSH_PRIVATE_KEY` | закрытый ключ для подключения |
| `SERVER_HOST` | имя или адрес сервера |
| `SERVER_USER` | пользователь SSH |
| `SERVER_PATH` | путь к клону репозитория на сервере |

Секреты приложения остаются в `backend/.env` на сервере и не копируются в Git.

## Выпуск

1. Убедитесь, что нужный коммит находится в `main`.
2. Дождитесь обязательных проверок CI.
3. Создайте тег вида `vX.Y.Z` или запустите `Deploy to Production` вручную.
4. Следите за заданием GitHub Actions.
5. Проверьте `/health`, `/health/ready` и основной сценарий Mini App.

Рабочий процесс создаёт отдельный каталог релиза, собирает сервер и
`frontend-new`, применяет миграции, переключает символическую ссылку и
перезапускает PM2. При ошибке выполняется возврат к предыдущему релизу.

## Ручное обновление

Ручной сценарий нужен только при недоступности GitHub Actions. `deploy-vps.sh`
повторяет шаги рабочего процесса: worktree на коммит, сборка сервера и клиента,
миграции, переключение `current`, пересоздание процесса PM2, проверка `/health`
и возврат к предыдущему релизу при неудаче.

```bash
cd <любой каталог репозитория на сервере>   # исходный чекаут или текущий релиз
bash deploy-vps.sh
```

Переменные: `REF` (по умолчанию `origin/main`) — что выкатывать; `ENV_SUFFIX`
(`production` | `prod-dev`) — режим сборки Vite; `SOURCE_CHECKOUT`,
`RELEASES_DIR`, `BACKEND_ENV`, `PM2_APP`, `HEALTH_URL` — если раскладка на
сервере отличается от принятой.

После успешной проверки `/health` скрипт удаляет старые релизы по тем же
правилам, что шаг `Prune old releases` рабочего процесса: остаются `current`,
предыдущий и `KEEP_RELEASES` свежих (по умолчанию три). Каждый релиз несёт свои
`node_modules` — около 800 МБ, поэтому без уборки серия ручных выпусков съедает
диск. Уборка идёт последней и не влияет на результат выпуска.

Смену релиза выполняйте только через этот скрипт или рабочий процесс.
`pm2 reload` и `pm2 startOrReload` сохраняют путь к скрипту у запущенного
процесса: команда завершится успехом, а работать продолжит прошлый релиз.

Сценарий `update-vps.sh` обновляет рабочий каталог через `git pull` и релизную
раскладку не знает: он остался для стендов, где нет каталогов релизов.

## Проверка и откат

```bash
curl --fail https://rocketlunch.dpdns.org/health
curl --fail https://rocketlunch.dpdns.org/health/ready
pm2 status
pm2 logs rocket-lunch-bot --lines 100
```

Порядок проверки миграций, дымовой проверки и отката:
[RELEASE_RUNBOOK.md](docs/09-production-readiness/RELEASE_RUNBOOK.md).

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
