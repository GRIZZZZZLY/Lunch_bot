# Резервное копирование PostgreSQL

Резервная копия считается рабочей только после успешного пробного
восстановления в отдельную базу той же основной версии PostgreSQL.

## Продакшен

На сервере PostgreSQL 16 работает без контейнера, поэтому скрипты разработки
ниже (они обращаются к контейнеру `foodbot-postgres`) там не подходят.

Ежедневную копию снимает таймер systemd `telegram-food-bot-backup-db`
(`backup-db.sh`, установка — `ops/backup-db/install-vps.sh`, подробности —
[DEPLOYMENT.md](../DEPLOYMENT.md)): дамп в формате custom с файлом `.sha256` в
`~/backups/rocket-lunch`, хранится 14 копий. Внеочередная копия перед выкатом:
`sudo systemctl start telegram-food-bot-backup-db.service`.

Пробное восстановление — только в отдельную базу:

```bash
cd ~/backups/rocket-lunch && sha256sum -c <копия>.dump.sha256
sudo -u postgres createdb foodbot_restore_check
sudo -u postgres pg_restore --no-owner --no-acl --exit-on-error \
  -d foodbot_restore_check < <копия>.dump
# сверить число строк ключевых таблиц и сумму долгов с foodbot_db
sudo -u postgres dropdb foodbot_restore_check
```

Время восстановления записывайте по продовой базе: оно и есть фактический RTO.

`scripts/backup-postgres-offsite.sh` (копия вне сервера через restic) на сервер
не установлен: restic там нет. Если его ставить — порядок проверки в шапке
скрипта, тоже только в отдельную базу: его дамп снят с `--clean --if-exists`.

## Создание копии (разработка, Docker)

Из корня проекта:

```powershell
.\backup-postgres.ps1 -Compress
```

На Linux:

```bash
./scripts/backup-postgres.sh --compress
```

Перед продолжением проверьте код завершения, наличие файла и его ненулевой
размер. Не храните дампы в репозитории.

## Восстановление

Windows:

```powershell
.\restore-postgres.ps1
```

Linux:

```bash
./scripts/restore-postgres.sh /path/to/backup
```

Сначала восстанавливайте в отдельную проверочную базу. После восстановления:

```bash
psql "$RESTORED_DATABASE_URL" -c "SELECT 1"
DATABASE_URL="$RESTORED_DATABASE_URL" npm --prefix backend run db:generate
```

Затем проверьте ключевые таблицы, миграции и запуск API.

## Перед выпуском

1. Зафиксируйте время и имя копии.
2. Проверьте, что копия находится вне каталога релиза.
3. Запишите версию PostgreSQL.
4. Убедитесь, что известны ответственный, срок хранения, RPO и RTO.
5. Не применяйте миграцию, если последняя копия не проверена.

## Безопасность

- шифруйте удалённые копии;
- ограничивайте доступ отдельной учётной записью;
- не записывайте пароль в командную историю;
- не пересылайте дампы через общедоступные каналы;
- регулярно удаляйте копии по утверждённому сроку хранения.

Условия выпуска и отката:
[RELEASE_RUNBOOK.md](09-production-readiness/RELEASE_RUNBOOK.md).
