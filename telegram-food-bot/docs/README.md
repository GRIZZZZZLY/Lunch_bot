# Документация Rocket Lunch

Этот каталог содержит только живые руководства и спецификации, которые нужны
для разработки, эксплуатации или проверки текущего приложения. Завершённые
планы и старые отчёты доступны через историю Git.

## Начало работы

- [Установка и первый запуск](01-getting-started/README.md)
- [Разработка](02-development/README.md)
- [Тестирование](05-testing/README.md)
- [Обзор API](07-api/README.md)

## Архитектура и эксплуатация

- [Архитектура](ARCHITECTURE.md)
- [Развёртывание](../DEPLOYMENT.md)
- [Резервное копирование](BACKUP_RESTORE_GUIDE.md)
- [Карта продакшен-системы](09-production-readiness/SYSTEM_MAP.md)
- [Порядок выпуска и отката](09-production-readiness/RELEASE_RUNBOOK.md)
- [Остаточные риски](09-production-readiness/RESIDUAL_RISKS.md)
- [Проверка продакшена](09-production-readiness/PRODUCTION_SMOKE_TEST.md)

## Telegram

- [Настройка BotFather](04-deployment/BOTFATHER_SETUP.md)
- Ограничения личных и групповых чатов описаны в
  [настройке BotFather](04-deployment/BOTFATHER_SETUP.md).

## Основной интерфейс

Текущие документы дизайна и поведения находятся рядом с кодом:

- [`frontend-new/README.md`](../frontend-new/README.md)
- [`frontend-new/docs/design-guidelines/`](../frontend-new/docs/design-guidelines/)
- [`frontend-new/docs/design-handoff/`](../frontend-new/docs/design-handoff/)
- [`frontend-new/docs/frontend-redesign/`](../frontend-new/docs/frontend-redesign/)
- [матрица сквозных тестов](../frontend-new/tests/e2e/COVERAGE.md)

## Правило актуальности

Если документ описывает текущее поведение, обновляйте его вместе с кодом.
Одноразовые исследования, журналы сессий и завершённые планы не должны
оставаться отдельными источниками истины.
