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

### Пункт 10.1 (делать первым, до задачи 04): `(req as any).user`

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

- [ ] `grep -rn "req as any).user" backend/src` пусто (это пункт 10.1).
- [ ] `grep -rn "req as any" backend/src` пусто — достижимо **только вместе с
      задачей 02**: `.validatedId` и `.pagination` живут в
      `api/middleware/validation.ts:195,240`.
- [ ] В `poll.service.ts` нет `Promise<any>` / `Promise<any[]>`.
- [ ] `no-explicit-any` = `warn` в **обоих** блоках `backend/eslint.config.cjs`
      (строки 34 и 69).
- [ ] Число `any` в `backend/src` (без тестов и `scripts/`) зафиксировано в
      CI как не растущее — простой счётчик в скрипте, порог = текущее значение.
- [ ] `npm --prefix backend run build:prod` зелёный.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test
npm --prefix frontend-new run type-check
```
