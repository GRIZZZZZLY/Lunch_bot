# Как вносить изменения

## Подготовка

```bash
git clone https://github.com/GRIZZZZZLY/Lunch_bot.git
cd Lunch_bot
git switch -c codex/short-description
```

Требования и первый запуск описаны в
[README.md](../README.md) и
[руководстве по установке](../docs/01-getting-started/README.md).

## Правила

- Не работайте напрямую в `main`.
- Не сохраняйте `.env`, токены, дампы базы и пользовательские данные.
- Единственный интерфейс находится в `frontend-new/`. Каталог `frontend/`
  удалён 2026-08-22.
- Соблюдайте правила из [AGENTS.md](../AGENTS.md).
- Для изменения поведения добавляйте или обновляйте тесты.
- Не создавайте отчёты `*_COMPLETE.md`; обновляйте живую документацию.

## Перед запросом на слияние

```powershell
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test

npm --prefix frontend-new run type-check
npm --prefix frontend-new run type-check:e2e
npm --prefix frontend-new run lint
npm --prefix frontend-new test
npm --prefix frontend-new run build
```

Для изменений пользовательского сценария запустите соответствующие проверки
Playwright.

## Запрос на слияние

Опишите:

1. что изменилось;
2. зачем это нужно;
3. как проверено;
4. есть ли миграции, новые переменные окружения или риск отката.

Не включайте в один запрос несвязанные изменения.
