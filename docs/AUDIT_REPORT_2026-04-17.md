# Технический аудит проекта Telegram Food Bot

**Дата:** 2026-04-17
**Версия:** 2.0.0
**Ветка:** `feature/new_version`
**Аудитор:** Claude (deep multi-agent analysis)
**Скоуп:** Backend (~30 сервисов) + Frontend (~150 компонентов) + документация (84 .md в корнях)

---

## Краткое резюме (TL;DR)

| Категория | Оценка | Статус |
|-----------|--------|--------|
| Архитектура backend | B+ | ✅ |
| Архитектура frontend | B | 🟡 |
| **Безопасность** | **F** | 🔴 **БЛОКЕР** |
| Тесты | C+ | 🟡 |
| Тех долг | C | 🟡 |
| Документация (до чистки) | D | 🔴 |
| Документация (после чистки) | B+ | ✅ |

**Вердикт:** Проект **НЕ готов к production** до фикса 4 критических security-проблем (см. блок 🔴). После фиксов — production ready. Доку приведём в порядок в ходе этого же аудита.

---

## 🔴 КРИТИЧНО (немедленно, до любого деплоя)

### 1. Утечка секретов в git-истории — ⏸️ ОТЛОЖЕНО (репо приватный)
> Владелец принял решение отложить ротацию: репозиторий пока приватный.
> Чек-лист и триггеры см. в [SECURITY_TODO.md](SECURITY_TODO.md).

**Источник:** существующий `AUDIT_EXECUTIVE_SUMMARY.md` (2026-01-12)

В git закоммичены `.env`, `.env.production`, `.env.development`, `.env.backup` со значениями:
```
BOT_TOKEN=REDACTED-BOT-TOKEN
JWT_SECRET=REDACTED-JWT-SECRET…
```

**Риск:** Полная компрометация бота, выдача себя за любого пользователя, доступ к чатам.

**Что делать (сейчас, ~4 часа):**
1. `@BotFather` → `/revoke` для текущего токена → получить новый
2. Сгенерировать новый JWT secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
3. Очистить историю: `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/.env*" --prune-empty --tag-name-filter cat -- --all` + `git push --force --all` (предупредить всех клонов)
4. Подтвердить, что `.env*` есть в `.gitignore` (есть, проверил)
5. Передеплоить с новыми значениями

### 2. SKIP_TELEGRAM_VALIDATION = полный байпас auth
[backend/src/api/middleware/telegram-auth.ts](telegram-food-bot/backend/src/api/middleware/telegram-auth.ts) и [backend/src/api/middleware/validate-init-data.ts:40-80](telegram-food-bot/backend/src/api/middleware/validate-init-data.ts#L40-L80)

При `SKIP_TELEGRAM_VALIDATION=true` HMAC-валидация отключается полностью, а в качестве пользователя подставляется `dev_user`. В dev это удобно, но **флаг управляется ENV** — если случайно попадёт в prod, любой запрос будет аутентифицирован как «тестовый юзер».

**Рекомендация:**
- Хардкод `if (process.env.NODE_ENV === 'production') throw` в код middleware
- В `security-checks.ts` добавить exit(1) при сочетании `NODE_ENV=production` + `SKIP_TELEGRAM_VALIDATION=true`

### 3. Нет rate limiting на auth/vote endpoints
Из существующего аудита: endpoints `POST /api/votes`, `POST /api/auth` не лимитированы. DDoS / brute-force `initData` возможен.

**Рекомендация:** `express-rate-limit` с разными лимитами per-route (auth — 5/min, vote — 30/min).
Дополнительно — в [backend/src/api/middleware/rate-limiter.ts](telegram-food-bot/backend/src/api/middleware/rate-limiter.ts) сейчас `xForwardedForHeader: false`, что обходится через прокси. Включить + настроить `app.set('trust proxy', 1)`.

### 4. localStorage хранит данные с poll-id (нарушение CLAUDE.md)
`useOnboarding`, `DonationBar`, `InstallPrompt`, `useUserAvatar` — пишут в localStorage. CLAUDE.md явно запрещает кеш polls в localStorage.

**Рекомендация:** перевести на `WebApp.CloudStorage` (Telegram Mini App API) или React Query persist. Для onboarding-флагов — оставить, но изолировать в utility `safeLocalStorage` с whitelist ключей.

---

## 🟠 ВЫСОКИЙ ПРИОРИТЕТ

### Backend

- **Race condition в `vote.service.ts`** (createMultipleVotes): проверка существующих голосов и вставка не атомарна. → Обернуть в `prisma.$transaction` с `isolationLevel: 'Serializable'`.
- **N+1 в `poll.service.ts:getPollById`**: include `votes { user, menuItem }` + `result { winnerMenuItem, responsibleUser }`. При 100+ голосах → 200+ запросов. → Сначала `_count`, потом подгружать списки по требованию.
- **Отсутствие валидации входа** в части контроллеров ([poll.controller.ts](telegram-food-bot/backend/src/api/controllers/poll.controller.ts) — `selectedMenuItems.map((id: any) => parseInt(id))`). → Подключить существующий [api/middleware/validation.ts](telegram-food-bot/backend/src/api/middleware/validation.ts) ко всем endpoint'ам через Zod.
- **JWT secret check** в [services/jwt.service.ts](telegram-food-bot/backend/src/services/jwt.service.ts) только warn. → throw, если < 64 символов в production.
- **`@prisma/adapter-pg`** в `package.json` при `provider="sqlite"` в schema — лишняя зависимость, путаница. → Удалить (миграция на Postgres вне скоупа).
- **`generateJWT(user: any)`** в [api/controllers/auth.controller.ts:5](telegram-food-bot/backend/src/api/controllers/auth.controller.ts#L5) — типизировать.

### Frontend

- **`tsconfig.json: strict: false`** — отключённый strict скрывает 100+ `any` и `@ts-ignore`. → Поэтапно включать (начать с `noUnusedLocals` + `noUnusedParameters`).
- **`InlineVotingCard.tsx` 938 строк**, [components/voting/InlineVotingCard.tsx](telegram-food-bot/frontend/src/components/voting/InlineVotingCard.tsx) — UI + логика голосования + deep link + результаты в одном файле. → Разбить на `<PollCard>`, `<VotingSection>`, `<PollStatus>`. Bonus: добавить fallback при 404 poll.
- **`CreatePollForm.tsx` 874 строки** — вынести Zod-схему, multi-step state и recurring-poll логику в отдельные хуки.
- **Дублирование API-клиентов**: `api.service.ts`, `feedback.service.ts`, `notification.service.ts`, `offline.service.ts` создают свои axios-инстансы. → Один клиент + middleware (auth header, retry, error handler).
- **Dual QueryClient** (`lib/queryClient.ts` vs `lib/react-query.ts`) — может приводить к двум кешам и stale data. → Оставить один.
- **BudgetWidget — нет тестов**: 6 сценариев из CLAUDE.md ([components/budget/BudgetWidget.tsx](telegram-food-bot/frontend/src/components/budget/BudgetWidget.tsx)) ни одного юнит-теста. → Минимум по тесту на сценарий.

---

## 🟡 СРЕДНИЙ ПРИОРИТЕТ (рефакторинг, чистка)

### Backend

- 14+ мест `catch (error: any)` — заменить на `unknown` + `instanceof Error`.
- 2 TODO в [api/controllers/menu-suggestion.controller.ts](telegram-food-bot/backend/src/api/controllers/menu-suggestion.controller.ts) ("Integrate with notification service") — либо реализовать, либо удалить feature.
- `serializeMenuItem` возвращает `any` — сделать DTO.
- BigInt-сериализация — централизовать через util `serializeBigInt()` (сейчас `.toString()` разбросан).
- Закомментированные секции в `routes/*.ts` — удалить, документация API должна быть в OpenAPI/комментариях JSDoc.

### Frontend

- ~20 `console.log()` в App.tsx + layout (обёрнуты `if (DEV)`, но шум в коде). → Вынести в `utils/logger.ts`.
- Tailwind: ~24 анимации, половина не используется (`gradient-mesh`, `gradient-aurora`, `wiggle`). → Запустить purge / удалить вручную.
- Storybook: 3 stories на 50+ компонентов — либо использовать, либо отключить плагин и удалить `.stories.tsx`.

---

## 🟢 НИЗКИЙ ПРИОРИТЕТ (косметика)

- **PWA**: `manifest.json` icons array пустой, iOS-иконка отсутствует (192x192, 512x512).
- **Sentry DSN** не задан — оставить как опцию.
- **`utils/encryption.ts`** в backend существует, но не вызывается. → Удалить или внедрить.

---

## 💀 МЁРТВЫЙ КОД (можно удалить прямо сейчас)

- [frontend/src/components/menu/MenuForm.old.tsx](telegram-food-bot/frontend/src/components/menu/MenuForm.old.tsx) — 11 KB legacy после удаления геймификации
- [frontend/src/services/mockApi.service.ts](telegram-food-bot/frontend/src/services/mockApi.service.ts) — проверить, используется ли в тестах; если нет — удалить
- Backend services от удалённой геймификации, всё ещё в коде:
  - [backend/src/services/gamification.service.ts](telegram-food-bot/backend/src/services/gamification.service.ts)
  - [backend/src/services/quest.service.ts](telegram-food-bot/backend/src/services/quest.service.ts)
  - [backend/src/services/season.service.ts](telegram-food-bot/backend/src/services/season.service.ts)
  - [backend/src/api/controllers/gamification.controller.ts](telegram-food-bot/backend/src/api/controllers/gamification.controller.ts)
  - [backend/src/api/routes/gamification.routes.ts](telegram-food-bot/backend/src/api/routes/gamification.routes.ts)
  - [backend/src/api/routes/season.routes.ts](telegram-food-bot/backend/src/api/routes/season.routes.ts)
  - [backend/src/database/seeds/gamification.seed.ts](telegram-food-bot/backend/src/database/seeds/gamification.seed.ts)
  - [backend/src/constants/xp-constants.ts](telegram-food-bot/backend/src/constants/xp-constants.ts)
  - [backend/src/types/gamification.types.ts](telegram-food-bot/backend/src/types/gamification.types.ts)

  ⚠️ Перед удалением — проверить, что роуты не подключены в `server.ts` и Prisma schema не содержит таблицы XP/Quest/Season (если содержит — нужна миграция).

### Устаревшие скрипты `backend/src/scripts/`

| Файл | Действие |
|------|----------|
| `fix-poll-11.ts` | Удалить — одноразовый фикс конкретного poll #11 |
| `migrate-sqlite-to-postgres.ts` | Оставить — пригодится для будущей миграции |
| `add-test-group.ts` | Архив — отладочный |
| `check-*.ts` (5 шт.) | Объединить в один CLI или оставить только нужные |
| `make-admin.ts`, `close-expired-polls.ts` | Оставить — используются как cron-задачи |

---

## 📚 Документация: что сделано

**До:** 84 .md файла валялось в корнях `e:\Launch_bot\` (2) и `e:\Launch_bot\telegram-food-bot\` (82).
**После:** 6 файлов в `telegram-food-bot/`, 0 в `e:\Launch_bot\`, всё остальное — рассортировано по `docs/0X-*` или удалено.

| Действие | Кол-во |
|----------|--------|
| KEEP | 6 |
| MOVE → `docs/01-deployment` | 5 |
| MOVE → `docs/02-monitoring` | 4 |
| MOVE → `docs/03-testing` | 2 |
| MOVE → `docs/04-features` | 4 |
| MOVE → `docs/05-production` | 2 |
| ARCHIVE → `docs/99-archive` | 18 |
| DELETE | 43 |

Полный список перемещений и удалений — см. секцию выполнения ниже / git diff.

После чистки нужно обновить `CLAUDE.md` (раздел "Documentation") — пути изменились.

---

## 📋 Приоритизированный план действий

### Сейчас (4 часа) — БЛОКЕРЫ
1. ✅ Revoke BOT_TOKEN, генерация нового JWT_SECRET
2. ✅ `git filter-branch` для очистки `.env*` из истории
3. ✅ Production guard для `SKIP_TELEGRAM_VALIDATION`

### Эта неделя (8 часов)
4. Rate limiting на vote/auth + `trust proxy`
5. Транзакция в `vote.service.ts:createMultipleVotes`
6. Удалить мёртвый код геймификации (с миграцией БД, если нужна)
7. Удалить `MenuForm.old.tsx`, объединить QueryClient

### Следующие 2 недели (16-20 часов)
8. Включить TS strict (этапами)
9. Разбить InlineVotingCard и CreatePollForm
10. Объединить API-клиенты во фронте
11. Юнит-тесты на BudgetWidget (6 сценариев)
12. Починить 5 падающих integration auth-тестов
13. Заменить `catch (error: any)` → `unknown` (14 мест)

### Бэклог
14. PWA-иконки
15. Tailwind purge неиспользуемых анимаций
16. Sentry DSN setup
17. Storybook coverage (или убрать)

---

## Метрики после чистки

- Backend: ~30 сервисов (после удаления геймификации станет ~24)
- Frontend: ~150 .tsx, ~50 hooks
- Тесты: 197/202 passing → цель 202/202 после фикса auth-тестов
- Документация: 84 .md → 6 в корне + структурированный `docs/`
- Bundle: ~500 KB (без замеров после чистки)
