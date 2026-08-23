# 10 — `any` на границе API: 336 вхождений, включая возвращаемые типы сервисов

- **Приоритет:** P2, **но пункт 10.1 — P1 и делается до задачи 04**
- **Оценка:** 0.5 дня на пункт 10.1, 1 день на остальную границу API
- **Тип:** потеря типов
- **Область:** `backend/src` (правило **явно выключено**), `frontend-new/src` (правило на уровне `warn`)

## Что не так

336 вхождений `any` / `as any` / `@ts-ignore` / `@ts-expect-error` в 79 файлах
`backend/src` + `frontend-new/src`. Само число не главное — важно **где** они
стоят.

### Худшие места: возвращаемые типы сервисов

```ts
// backend/src/services/poll.service.ts
static async getActivePolls(groupIds?: number[]): Promise<any[]>
private static async fetchActivePollsRaw(groupIds?: number[]): Promise<any[]>
static async savePollResult(data: {...}): Promise<any>
static async getPollHistory(...): Promise<{ polls: any[]; total: number }>
```

**Почему правило выключено — это было решением, а не забывчивостью.** Перенесено
из удалённого `TECHNICAL_AUDIT_2026-07-19.md` (см. [15.2](15-repo-hygiene.md)):
правила явного `any`, обязательной аннотации возвращаемого типа и локальных
неиспользуемых объявлений сознательно **не включили для старого слоя служб**,
«чтобы не переписывать параллельно изменяемый код». То есть включать правило
надо не раньше, чем этот слой перестанут активно править, — иначе гейт будет
конфликтовать с чужой работой. Мёртвые файлы, зависимости, импорты и циклы при
этом контролирует Knip, а необработанные обещания и ошибки типов остались
блокирующими.

Это не «any в углу», а **разрыв контракта на самом нагруженном пути продукта**:
`getActivePolls` → `poll.controller.getActivePolls` → `GET /api/polls/active` →
`frontend-new/src/hooks/usePolls.ts` → `HomePage`. Тип теряется на первом же
шаге, поэтому:

- фронт описывает форму заново в своих типах, и рассинхрон обнаруживается в
  рантайме;
- рефакторинг Prisma-запроса (`select`/`include`) не ломает компиляцию —
  ломает продакшен;
- `HomePage.tsx` — файл с **6 багфиксами** и меткой `bug_magnet`; часть этих
  багов ровно про форму данных.

### Топ файлов по `any`

| Файл | `any` |
|---|---|
| `services/__tests__/notification.service.test.ts` | 20 |
| `services/poll-flow.service.ts` | 16 |
| `services/notification.service.ts` | 14 |
| `bot/keyboards/poll.keyboard.ts` | 13 |
| `scripts/migrate-sqlite-to-postgres.ts` | 10 |
| `services/poll.service.extensions.ts` | 9 |
| `services/__tests__/menu-suggestion.service.test.ts` | 9 |
| `services/order-calculation.service.ts` | 8 |
| `services/multi-category-responsible.service.ts` | 8 |
| `api/middleware/telegram-auth.ts` | 8 |

### Пункт 10.1 — ✅ СДЕЛАНО

> Закрыт 2026-08-23. Итог отличается от плана по причине, которую стоит
> прочитать до задачи 04: **расширение типа Express уже существовало**
> (`types/api.types.ts`), и 86 приведений не добавляли тип, а глушили две
> вещи, которые компилятор нашёл сразу же, как их убрали.
>
> **1. Объявленный тип был неверным.** Стояло `user?: RequestUser`
> (`id`, `telegramId?`, `isAdmin?`), а `telegramAuthMiddleware` кладёт туда
> результат `UserService.getUserById`/`createUser` — полную Prisma-модель
> `User`. Контроллеры читали `firstName`, `username`, `isActive`, `createdAt`,
> `updatedAt`, `photoUrl`, `lastName` — **16 чтений полей, которых в
> объявленном типе не было.** Приведение скрывало не отсутствие типа, а его
> несоответствие. Объявление исправлено на `user?: User`.
>
> **2. Необязательность `user` — настоящая, и её игнорировали в 34 местах.**
> Аутентификация навешивается ПОМАРШРУТНО (`telegramAuthMiddleware` в
> `routes/*.ts`), а не на весь `/api`. Значит маршрут без неё возможен, и на
> нём `user.id` даёт 500 вместо 401 — в логах это выглядит как «сломался
> контроллер», а не «нет доступа». Добавлен один общий
> `api/middleware/require-auth-user.ts` с `requireAuthUser(req, res)`,
> применён **в 34 местах**.
>
> Проверено, что это защита в глубину, а не смена контракта: у всех 34 сайтов
> маршрут действительно монтирует `telegramAuthMiddleware` (`menu.routes.ts`
> 11/11, `poll.routes.ts` 23/23, `sse.routes.ts` 2/2, `user.routes.ts` 2/2,
> `season.routes.ts` 3/3, `admin.routes.ts` через `router.use`). То есть
> сегодня 401 никому не прилетит — но маршрут, где middleware забудут,
> получит 401 вместо 500.
>
> Локальный `getAuthUser` из `poll.controller.ts` удалён, **четыре** его
> вызова переведены на общий хелпер.

#### Чего 10.1 НЕ сделал — точная мера остатка

Заявлять «аутентификация теперь в одном месте» было бы неправдой, и первая
редакция этого раздела так и заявляла. По факту:

- Объявлений `const X = req.user;` в `src/api` осталось **35**.
- Из них **34 несут собственную рукописную проверку** с ответом об отказе —
  то есть рядом с 34 вызовами общего хелпера живут 34 самодельных дубля.
- Формы ответа у них **не совпадают между собой**: `401 UNAUTHORIZED` (8),
  `401 NOT_AUTHENTICATED` (7, `user.controller.ts:64,105,139,213`),
  `403` без кода (`gamification.controller.ts:222,277`,
  `season.controller.ts:226,268`), `400` (`gamification.controller.ts:284`,
  `group-admin.ts:21`), тело без поля `success`
  (`budget.controller.ts`), и наконец сам хелпер — `401 UNAUTHORIZED` плюс
  `timestamp`. Пять разных представлений одного события «ты не авторизован».
- Ровно **один** сайт действительно не требует пользователя —
  `auth.controller.ts:359`.

Отсюда правильная цель, и она принадлежит **задаче
[04](04-authorization-layer.md)**: настоящий `requireAuth` как middleware в
`routes/*.ts`, который снимает и 34 вызова хелпера, и 34 рукописных дубля
сразу. Единый код ответа при этом должен прийти из словаря задачи
[03](03-single-error-contract.md) — сейчас фронт ветвится по `code`, а кодов
на одно событие пять.
>
> Удалены как ставшие мёртвыми: `RequestUser`, `AuthenticatedRequestFull`.
> `AuthenticatedRequest` оставлен псевдонимом `Request` — подпись
> `(req: AuthenticatedRequest, ...)` читается как документация о том, что
> маршрут обязан идти через middleware.

### Пункт 10.1 (исходная формулировка): `(req as any).user`

**84 сайта в 18 продакшен-файлах.** Есть в `poll.controller.ts:17`,
`category-order.controller.ts:16` и далее. Правильное решение — расширение
типа Express (`declare global { namespace Express { interface Request { user?: AuthUser } } }`)
в одном `.d.ts`.

**Порядок важен:** это должно быть сделано **до** задачи 04, где `getAuthUser`
переезжает в middleware. Иначе перенос придётся типизировать вторым проходом по
тем же файлам.

**Чего пункт 10.1 НЕ закрывает.** Всего форм `req as any` в продакшене — 88.
Остаток после `.user` — это `.telegramUser` (2), `.validatedId` (1),
`.pagination` (1), причём последние два живут **внутри**
`api/middleware/validation.ts` (строки 195 и 240) и уйдут только вместе с
задачей 02. Поэтому критерий «`grep -rn "req as any" backend/src` пусто»
достижим не здесь, а после 02 — см. критерии готовности.

### Правило eslint не «отсутствует», а выключено

`backend/eslint.config.cjs` содержит
`'@typescript-eslint/no-explicit-any': 'off'` **в двух блоках** — строки **34**
и **69**. Включать надо в обоих, иначе часть дерева останется без проверки и
это будет выглядеть как «правило не работает».

## Что делать (минимально достаточное)

Не «убрать все 336». Порядок по отдаче:

1. **`(req as any).user`** → расширение типа Express. Одна правка, ~20 файлов
   чище, попутно закрывает часть задачи 04 (там `getAuthUser` переезжает в
   middleware и типизируется).
2. **Возвращаемые типы `poll.service`** (`getActivePolls`, `fetchActivePollsRaw`,
   `savePollResult`, `getPollHistory`). Тип выводится из Prisma-запроса:
   `Prisma.PollGetPayload<typeof pollWithDetailsArgs>`. В файле уже есть
   правильный пример — `PollWithDetails` и `votePublicUserSelect` в
   `types/poll.types.ts`. Повторите этот приём, не изобретайте второй.
3. **`initialize(bot: any)`** в `notification.service.ts` — уходит вместе с
   задачей 09.1.
4. **`bot/keyboards/poll.keyboard.ts` (13)** — там `any` на данных разбивки
   голосов; типизируется от `getPollVoteBreakdown`, то есть после шага 2.
5. **Переключить правило с `off` на `warn`** в `backend/eslint.config.cjs`
   на строках 34 и 69 (на фронте уже `warn`). Не `error` — иначе CI встанет на
   336 нарушениях и правило вернут в `off`. `warn` + запрет роста (см. ниже).

**Что НЕ делать:** трогать `any` в тестах (20+9 вхождений) и в
`scripts/migrate-sqlite-to-postgres.ts` (10, одноразовый скрипт миграции).
Отдача нулевая.

## Подводные камни

- **`Promise<any[]>` может скрывать неоднородность.** `getActivePolls` собирает
  результат из нескольких запросов; вполне возможно, что форма элементов
  массива **разная** в разных ветках. Пока стоит `any`, это не видно. Первое,
  что покажет типизация, — что контракт не один. Не «подгоняйте» тип
  объединением `A | B` ради компиляции: если формы разные, это баг, и его надо
  зафиксировать тестом до правки.
- **`serializeBigInt` меняет типы.** Он превращает `bigint` в `string`.
  Типизация «до сериализации» и «после» — разные типы. Опишите оба
  (`PollDTO` для ответа API) и не выдавайте одно за другое.
- **Не включайте `noImplicitAny` там, где его нет.** В `backend/tsconfig.json`
  уже `strict: true`, так что `noImplicitAny` активен; проблема именно в явных
  `any`. То есть один флаг ничего не решит — только точечная типизация.
- **Фронт вычисляет формы сам.** `frontend-new/src/lib/pollMappers.ts`,
  `adminMappers.ts` уже нормализуют ответы. Когда бэкенд начнёт отдавать
  типизированный DTO, эти мапперы могут стать частично лишними — но **не
  удаляйте их в этой задаче**, они защищают от рассинхрона версий (фронт и
  бэк деплоятся не атомарно).

## Критерии готовности

- [x] `grep -rn "req as any).user" backend/src` пусто (это пункт 10.1) —
      остались только упоминания в комментариях, объясняющих правку.
      Проверено: `tsc --noEmit` 0 ошибок, lint чист, 3548 тестов зелёные.
- [x] `grep -rn "req as any" backend/src` пусто — в коде остались только
      упоминания в комментариях. `.validatedId` и `.pagination` не типизированы,
      а удалены вместе с мёртвыми middleware; `.telegramUser` объявлен на
      `Request`.
- [x] В `poll.service.ts` нет `Promise<any>` / `Promise<any[]>`.
- [x] `no-explicit-any` = `warn` в **обоих** блоках `backend/eslint.config.cjs`.
- [x] Число `any` в `backend/src` (без тестов и `scripts/`) зафиксировано в
      CI как не растущее: `npm --prefix backend run any:check`, порог 159
      (замер скриптом, не из плана).
- [x] `npm --prefix backend run build:prod` зелёный.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run any:check
npm --prefix backend run build:prod
npm --prefix backend test
npm --prefix frontend-new run type-check
```

## Что выяснилось при исполнении остатка (2026-08-24)

Остаток закрыт. Главное: типизация нашла **четыре пользовательских дефекта в
одном сообщении бота**, и все четыре были зелёными в тестах.

### `req as any` — не типизировать, а удалить

`.validatedId` и `.pagination` (`validation.ts:195,240`) писались, но НЕ читались
ни в одном продакшен-файле: единственные читатели — их собственные тесты.
Middleware `validateIdParam` и `validatePaginationParams` при этом не подключены
ни на одном маршруте (после задачи 02 разбор входа делают контракты из
`validate.ts`, и в его заголовке это уже было написано). Объявлять такие поля на
`Request` значило бы закрепить типом сломанный контракт — один слот на запрос,
второй `:id` молча перетирает первый. Обе функции и их тесты удалены.

`.telegramUser` (2 сайта в `telegram-auth.ts`) объявлен на `Request` и приведения
убраны. Читателей у поля тоже нет, а оба пишущих middleware
(`validateInitDataMiddleware`, `optionalAuthMiddleware`) не подключены — но это
код аутентификации, и удалять его «попутно с типизацией» нельзя; помечено
комментарием как рудимент.

Попутно нашлись **два разных типа `TelegramUser`**: локальный в
`utils/telegram-auth.ts` (правильный) и `types/bot.types.ts`, где `is_bot`
объявлен обязательным, чего Telegram не обещает. Компилятор отказал сразу же на
попытке использовать второй. Он не используется больше нигде; слот на `Request`
получил `TelegramWebAppUser` из `api.types.ts`.

### Возвращаемые типы: `Promise<any>` был не единственной формой лжи

`getActivePolls`, `fetchActivePollsRaw` и `getPollHistory` из плана уже
типизированы — это сделала задача 06 (выведенные типы плюс
`ReturnType<...>`-псевдонимы). Остался `savePollResult`: обе его ветки
(обновление и создание) выписывали `include` по отдельности, а в подписи стоял
`Promise<any>` — расхождение форм между «первым расчётом» и «повторным» ничего бы
не сломало при компиляции. Теперь один `include` (`satisfies
Prisma.PollResultInclude`) и тип `PollResultWithDetails`.

Хуже оказалось рядом: `PollService.getPollResult` объявлял `Promise<PollResult>`,
а возвращал запись со связями (`poll` + `group` + `votes`, `winnerMenuItem`,
`responsibleUser`). Это не `any`, но эффект тот же — связи стирались в подписи.
Через `completePoll` (тоже `Promise<PollResult>`) значение уезжало в бота.

### Четыре дефекта в сообщении «Результаты голосования»

`bot/keyboards/poll.keyboard.ts` принимал `poll: any`, `result?: any`,
`breakdown: any[]`. За этим скрывалось:

1. `poll.handlers.ts` передавал в поле `poll` **сам итог** (`PollResult`), а не
   опрос. `poll.title` читался как `undefined`, `escapeMarkdown(undefined)`
   падал, и группа получала «❌ Ошибка при завершении голосования» на уже
   завершённом голосовании. Опрос теперь берётся из связи `result.poll`.
2. Победитель печатался под условием `result?.winnerItem` — поля с таким именем
   нет ни в одном ответе, то есть строка не выводилась НИКОГДА. А если бы
   вывелась, сорвалась бы на `result.winnerMenuItem.name`. Условие переведено на
   саму связь.
3. То же с ответственным: гейт `result?.responsible`, чтение
   `result.responsibleUser.firstName`.
4. Остаток времени для активного голосования считался от `poll.endTime` —
   такого поля в схеме нет и не было. Теперь от `startedAt` + `duration`.

Почему тесты молчали: фикстуры были написаны под ошибку. В
`poll.handlers.test.ts` мок `completePoll` возвращал плоский
`{ id, status, title }` (сервис так не отвечает), а в `keyboards.test.ts` стояли
`endTime`, `winnerItem: 1`, `responsible: 1`. Три новых теста в
`poll.handlers.test.ts` (название, победитель, ответственный) сначала падали на
реальной фикстуре — это и есть доказательство. Фикстуры и старые утверждения
исправлены, причина расхождения записана рядом.

### Правило и гейт

`no-explicit-any` переведён с `off` на `warn` в **обоих** блоках
`backend/eslint.config.cjs`. Не `error`: сейчас 233 предупреждения, и `error`
остановил бы CI на первом же запуске — такое правило возвращают в `off`.

Рост числа `any` держит `scripts/check-any-count.mjs` (`npm run any:check`,
добавлен в CI перед `build:prod`). Считает не регуляркой, а срабатываниями
самого ESLint — иначе в счёт попадали бы слова `any` из комментариев. Тесты и
`src/scripts/**` исключены по решению плана. **Порог 159 — измеренный, не из
плана:** число 336 в заголовке задачи считало `any`/`as any`/`@ts-ignore` во всём
дереве вместе с тестами и одноразовыми скриптами.

Типы получили ещё хранимые экземпляры бота: `PollSchedulerService.botInstance` и
`feedbackService.bot` были `any`. Подпись — не `Bot<BotContext>`, а узкий
`TelegramSender` (`api.sendMessage`) из `bot.types.ts`: сервисы пользуются только
отправкой сообщения, а требование целого бота заставило бы каждый тест собирать
заглушку размером с grammy.

### Чего не сделано

- **159 явных `any` в продакшене остались.** Крупнейший — `poll-flow.service.ts`
  (16), там `any` стоит на `resultData` из `rouletteData`, то есть на разборе
  JSON-поля; это отдельная работа с типом хранимого документа, а не переименование
  аннотации.
- **`Promise<any>` вне поллов не тронуты**: `group.service` (6),
  `gamification.service` (5), `quest.service` (2), `budget.service` (3),
  `insights.service` (1). План требовал только `poll.service`, и объём остальных
  сравним со всей этой задачей.
- **Мёртвые middleware аутентификации не удалены** (`validateInitDataMiddleware`,
  `optionalAuthMiddleware`) — только помечены. Удаление кода, отвечающего за
  доступ, стоит делать отдельно и с проверкой, а не внутри задачи про типы.
- **`types/bot.types.ts::TelegramUser` оставлен**, хотя не используется нигде и
  содержит неверное `is_bot: boolean`. Удаление — в разбор рудиментов.
- **`any` во фронтенде не считается** этим гейтом; правило там и так `warn`.
- **Полный прогон не выполнен**: `npm --prefix backend test` требует PostgreSQL.
  Прогнаны `lint` (0 ошибок, 233 предупреждения — это новое правило),
  `any:check`, `build:prod`, `knip`, `test:unit` (130 наборов, 3761 тест).
