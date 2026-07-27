# Развёртывание Rocket Lunch

Канонический способ выпуска — защищённое окружение GitHub Actions и неизменяемая
сборка из конкретного коммита. Рабочий процесс:
`.github/workflows/deploy.yml`.

## Требования к серверу

- Ubuntu с Node.js 22, npm 10, PostgreSQL 16, Redis, Nginx и PM2;
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

Ручной сценарий нужен только при недоступности GitHub Actions:

```bash
cd /opt/telegram-food-bot
BRANCH=main FRONTEND_DIR=frontend-new ./update-vps.sh
```

Всегда задавайте `BRANCH=main` явно, если локальная копия сценария ещё содержит
старое значение по умолчанию.

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

До миграций создайте дамп и проверьте его размер. Инструкция:
[BACKUP_RESTORE_GUIDE.md](docs/BACKUP_RESTORE_GUIDE.md).
