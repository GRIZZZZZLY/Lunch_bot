# 06 — `poll.service.ts`: 1770 строк, метод на 314 строк, и файл-приставка `poll.service.extensions.ts`

- **Приоритет:** P1
- **Оценка:** 2 дня
- **Предпосылки:** пункт 09.4 (кодировка — 1 строка в этом файле) и пункт 14.1
  (плюрализация — `getVotesWord` живёт в `poll.service.extensions.ts:353`).
  Оба дешёвые; без них мусор и дубликаты разъедутся по четырём новым файлам.
- **Тип:** god-file + рудиментарное разбиение
- **Область:** `backend/src/services/poll.service.ts`, `backend/src/services/poll.service.extensions.ts`
- **Метод:** TDD, extract-method под защитой существующих тестов

## Почему первым делом именно этот файл

Repowise указывает его как `fix_first`: **44.6% всего weighted-gap репозитория**
приходится на него (`weighted_deficit` 8784 при следующем 7442). Причина —
«изменения разбросаны по шумным коммитам, top-1% change entropy», исторически
сильный предиктор дефектов.

| Показатель | Значение |
|---|---|
| Строк | 1770 (крупнейший файл продукта) |
| NLOC | 1440, churn-персентиль **99.8** |
| Health / Maintainability | 1.9 / 4.8 |
| Max CCN | 29 |
| Багфиксов | 2 |

## Крупнейшие методы

| Метод | Строки | Объём |
|---|---|---|
| `completePollMultiWinner` | 1404–1717 | **314** |
| `completePoll` | 581–715 | 135 |
| `getPollHistory` | 948–1047 | 100 |
| `fetchActivePollsRaw` | 484–580 | 97 |
| `getTodayCompletedPoll` | 323–416 | 94 |
| `getUserParticipationStats` | 1156–1246 | 91 |
| `createPoll` | 67–148 | 82 |
| `getPollStats` | 1084–1150 | 67 |
| `getPollVoteBreakdown` | 1270–1333 | 64 |
| `checkQuorumAndComplete` | 184–242 | 59 |

Метод на 314 строк внутри транзакции — это отдельный модуль, а не метод.

## Отдельная проблема: `poll.service.extensions.ts`

488 строк, названы «extensions», по факту содержат:

- `createPollFromWebApp` — сценарий создания опроса с отправкой в Telegram;
- `autoCompletePoll` — авто-завершение с редактированием сообщения;
- `sendPersonalNotifications` — личные уведомления участникам;
- `createPollResultsMessage` + `getVotesWord` — форматирование текста сообщения.

Это **не расширение сервиса, а три разные ответственности** (сценарий создания,
сценарий завершения, форматирование сообщений бота), сложенные в файл по
принципу «в poll.service.ts уже не влезло». Разбиение по строке «слишком
большой файл» вместо разбиения по домену — сам по себе долг: следующий, кто
добавит функцию про опросы, не сможет решить, в какой из двух файлов её
положить.

Дополнительно там же:

- динамический `await import('../bot/keyboards/poll.keyboard')` внутри
  функции — обход циклического импорта; надо разорвать цикл нормально, а не
  прятать импорт в рантайм;
- шумные логи с эмодзи (`logger.info('🎬 Starting createPollFromWebApp')`,
  `'✅ Bot instance confirmed'`) — трассировка отладки, оставленная в продукте;
- `getVotesWord` — одна из четырёх реализаций русской плюрализации в backend
  (см. задачу **14**, пункт 14.1 — он делается до этой задачи).

## Что делать

**Разрезать по домену, а не по размеру.** Предлагаемая нарезка (проверьте
против фактических импортов перед началом):

| Новый модуль | Что забирает |
|---|---|
| `poll-query.service.ts` | `getPollById`, `getPollGroupId`, `getActivePolls`, `fetchActivePollsRaw`, `getPollHistory`, `getLastCompletedPoll`, `getTodayCompletedPoll`, `getExpiredPolls` |
| `poll-stats.service.ts` | `getPollStats`, `getUserParticipationStats`, `getPollVoteBreakdown` |
| `poll-completion.service.ts` | `completePoll`, `completePollMultiWinner`, `checkQuorumAndComplete`, `checkAutoComplete`, `cancelExpiredPolls` |
| `poll.service.ts` (остаётся) | `createPoll`, `updatePoll`, `cancelPoll`, `runRoulette`, `savePollResult`, `createParticipantSnapshot` |
| `poll-message.formatter.ts` | из `extensions`: `createPollResultsMessage`, форматирование (плюрализация — из общего util) |
| `poll-flow` (уже существует) | из `extensions`: `createPollFromWebApp`, `autoCompletePoll`, `sendPersonalNotifications` — проверьте, не дублируют ли они `poll-flow.service.ts` (477 строк), который делает похожее |

После этого `poll.service.extensions.ts` **удаляется целиком**, а не остаётся
пустой оболочкой с реэкспортами.

Внутри `completePollMultiWinner` (314) — Repowise предлагает конкретный
extract-method: строки 1651–1693 с параметром `pollId`
(`impact_delta` 0.324, effort M, confidence high). Это отдельный первый шаг,
безопасный и измеримый.

## TDD-порядок

1. Перед разрезанием убедиться, что `backend/src/services/__tests__/poll.service.test.ts`
   покрывает все переносимые методы. Что не покрыто — покрыть **до** переноса.
2. Перенос — механический, тесты не меняются, только импорты в них.
3. `completePollMultiWinner` разбирать после переноса: сначала extract-method по
   подсказке Repowise, затем — по границам транзакции.

## Подводные камни

- **Транзакции.** `completePoll` и `completePollMultiWinner` работают внутри
  `prisma.$transaction`. Комментарий в коде прямо говорит: транзакция здесь
  чинила race condition. Если при разрезании часть логики уедет за пределы
  транзакции — гонка вернётся, и тесты её, скорее всего, не поймают. Правило:
  извлечённые функции принимают `tx` параметром, а не берут глобальный `prisma`.
- **Циклические импорты.** `poll.service` ↔ `notification.service` ↔
  `poll.service.extensions` уже образуют цикл, который сейчас обходится
  динамическим `await import`. Разрезание файла на четыре **умножит** число
  рёбер. Перед началом постройте граф: `cycles` уже входит в
  `npm --prefix backend run knip` (в отличие от `exports` — см. задачу 09.1),
  так что этой проверке можно доверять. Убедитесь, что новая нарезка цикл
  **разрывает**, а не переносит.
- **`Promise<any[]>`** в `getActivePolls` и `fetchActivePollsRaw`, `Promise<any>`
  в `savePollResult` — при переносе не тащите `any` дальше (см. задачу 10).
- **Mojibake.** В этом файле 14 повреждённых маркеров на **одной строке**
  (`poll.service.ts:1335`, см. задачу 09.4) — починить до разрезания, чтобы не
  разбираться потом, в какой из четырёх файлов она уехала.
- **Порог `functions: 89`.** Тот же риск, что в задаче 05, и здесь он выше:
  извлечение 4 модулей из 1770 строк создаёт десятки новых функций.
- **Не заводить `*.extensions.ts` заново** ни под каким именем
  (`*.helpers.ts`, `*.utils.ts`, `*-part2.ts`). Если для куска кода не находится
  доменного имени — значит нарезка неверная.

## Критерии готовности

- [ ] Ни одного файла > 600 строк среди новых модулей.
- [ ] Ни одного метода > 80 строк.
- [ ] `poll.service.extensions.ts` удалён.
- [ ] `npm --prefix backend run knip` не сообщает о новых циклах.
- [ ] Нет динамических `await import` для разрыва циклов в затронутых файлах.
- [ ] Health-скор `poll.service.ts` > 4.0.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run knip
npm --prefix backend run build:prod
npm --prefix backend test
```
