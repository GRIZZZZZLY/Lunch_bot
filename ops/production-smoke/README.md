# Безопасная проверка продакшена на VPS

Набор открывает настоящее приложение и API, но блокирует любые изменяющие
запросы. Разрешены `GET`, `HEAD`, `OPTIONS` и три необходимых для входа или
чтения `POST`: `/api/auth/validate`, `/api/auth/refresh` и
`/api/user/avatars/batch`.

## Подготовка

1. Создайте в рабочей группе отдельного пользователя с ролью `MEMBER`. Не
   выдавайте ему права администратора и не используйте личную учётную запись.
2. На VPS установите Docker с Compose и разместите репозиторий в
   `/opt/telegram-food-bot`.
3. Не передавайте `.env`, токен или сформированный `initData` в Git.

Рекомендуемый установщик читает `BOT_TOKEN` непосредственно из
`backend/.env`, не печатает его и включает расписание только после первого
успешного прогона:

```bash
cd /opt/telegram-food-bot/ops/production-smoke
bash install-vps.sh \
  https://app.example.ru \
  700000101 \
  'Проверка продакшена'
```

Первые три параметра обязательны: адрес приложения, Telegram ID отдельного
участника и точное название его группы. При необходимости далее передаются имя,
фамилия и username.

Ручная установка без установщика:

```bash
cd /opt/telegram-food-bot/ops/production-smoke
cp .env.example .env
chmod 600 .env
docker compose build --pull production-smoke
docker compose run --rm production-smoke
```

HTML-отчёт сохраняется в `artifacts/report`, снимки и видео ошибок — в
`artifacts/results`. Оба подкаталога находятся внутри одной точки монтирования,
чтобы Playwright мог безопасно пересоздавать их при каждом прогоне.
Трассировка отключена, чтобы временная подпись Telegram не попала в артефакты.

## Запуск по расписанию

Установщик сам подставляет фактическое расположение репозитория. При ручной
установке файлы службы рассчитаны на `/opt/telegram-food-bot`; если путь
отличается, измените `WorkingDirectory`.

```bash
sudo cp telegram-food-bot-production-smoke.service /etc/systemd/system/
sudo cp telegram-food-bot-production-smoke.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now telegram-food-bot-production-smoke.timer
systemctl list-timers telegram-food-bot-production-smoke.timer
```

Ручная проверка и просмотр журнала:

```bash
sudo systemctl start telegram-food-bot-production-smoke.service
journalctl -u telegram-food-bot-production-smoke.service -n 100 --no-pager
```

После обновления репозитория пересоберите образ:

```bash
cd /opt/telegram-food-bot/ops/production-smoke
docker compose build --pull production-smoke
```

## Токен и его ротация

Служба запускает не `docker compose` напрямую, а `run-smoke.sh`: обёртка перед
каждым прогоном сверяет `E2E_PRODUCTION_BOT_TOKEN` в `.env` с `BOT_TOKEN` из
боевого `backend/.env` и обновляет его при расхождении. Без этого ротация токена
тихо ломает подпись `initData`: прод отвечает `401`, падают все сценарии,
которым нужен вход, а причина не видна ни в одном из них.

Путь к боевому `.env` берётся из `BACKEND_ENV`, иначе из `BACKEND_ENV_PATH`
в `.env` стенда, иначе `../../backend/.env`. Последнее подходит, только когда
стенд лежит внутри рабочей копии; при раскладке с каталогами релизов укажите
`BACKEND_ENV_PATH` явно — например,
`/home/<user>/projects/telegram-food-bot/backend/.env`.

## Фикстура: группа и сверка с Telegram

Тестовый участник состоит в отдельной группе, и её название совпадает с
`E2E_PRODUCTION_GROUP_NAME`. Если у этой группы нет настоящего чата в Telegram,
внесите её id в `GROUP_RECONCILE_SKIP_IDS` боевого `backend/.env`: иначе
регулярная сверка увидит «chat not found», сочтёт бота выгнанным и деактивирует
группу. Дальше приложение перестаёт отдавать её в списке групп, `/api/menu`
отвечает `400`, и стенд краснеет по собственной вине.

## Защитные ограничения

- Нужны одновременно `E2E_ALLOW_PRODUCTION=1` и адрес с HTTPS.
- Любой неразрешённый `POST`, `PUT`, `PATCH` или `DELETE` к `/api` блокируется,
  а проверка завершается ошибкой.
- Сценарии не нажимают кнопки голосования, оплаты, управления меню, закупками
  или администраторами.
- Команды Prisma, `e2e:seed` и `e2e:cleanup` здесь не используются.
- Авторизация может обновить служебные поля отдельного тестового пользователя;
  остальные данные остаются только для чтения.
