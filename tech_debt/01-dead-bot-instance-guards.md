# 01 — Мёртвые guard'ы `if (!botInstance)` и 33 небезопасных `botInstance()!`

> **СДЕЛАНО.** Все девять локальных хелперов `function botInstance()` удалены,
> 33 сайта `botInstance()!` переведены на «один вызов, один `const`». Внешнее
> ревью: 7/10, все MAJOR закрыты (см. «Что оказалось сверх плана»).

- **Приоритет:** P0 (реальный дефект, не косметика)
- **Оценка:** 2–3 часа
- **Тип:** баг + рудимент
- **Область:** `backend/src/services/*`
- **Метод:** TDD (сначала падающий тест на «бота нет»)

## Что не так

В шести сервисах живёт локальный хелпер:

```ts
function botInstance() {
  return getBotInstance();
}
```

Дальше по коду стоят проверки вида `if (!botInstance) { ... return; }`. Это
проверка **ссылки на функцию**, а не результата вызова: объявленная функция
всегда truthy, поэтому ветка «бота нет» **никогда не исполняется**. Сразу за
проверкой идёт разыменование с `!`: `await botInstance()!.api.sendMessage(...)`.
Когда бот действительно не поднят (`getBotInstance()` → `null`), вместо
запланированного тихого выхода получаем
`TypeError: Cannot read properties of null (reading 'api')`.

Это не гипотетика: соседние файлы (`budget.service.ts`) пишут `if (botInstance())`
корректно — то есть автор задумывал именно graceful skip, а часть сайтов
разъехалась.

## Точные адреса

**Мёртвые guard'ы — 12 штук в 6 файлах** (все эти файлы объявляют
`function botInstance()`):

| Файл | Строки |
|---|---|
| `backend/src/services/multi-category-responsible.service.ts` | 79, 222, 519 |
| `backend/src/services/poll-flow.service.ts` | 224, 372, 435 |
| `backend/src/services/poll.service.extensions.ts` | 43, 204, 381 |
| `backend/src/services/order-calculation.service.ts` | 384 |
| `backend/src/services/reminder.service.ts` | 103 |
| `backend/src/services/responsible.service.ts` | 73 |

**Небезопасные `botInstance()!` — 33 сайта, и они НЕ однородны.** Это важно:

- **20 сайтов** — в шести файлах из таблицы выше, где guard мёртв. Здесь
  исправление guard'а само снимает необходимость в `!`.
- **13 сайтов** — в файлах, где guard **уже корректный**
  (`budget.service.ts:62,288,295,453`, `store-run-budget.service.ts:297,362`,
  `recurring-poll.service.ts:466`, `multi-category-responsible.service.ts:308,332`
  и др.). Здесь снятие `!` требует **поднять результат в `const`**:
  пара «`if (botInstance())` … `botInstance()!.api`» дважды вызывает
  `getBotInstance()`, то есть между проверкой и использованием состояние может
  измениться (TOCTOU при рестарте или тир-дауне бота). Правка не «убрать
  восклицательный знак», а «один вызов, один `const`».

**Не трогать:** `backend/src/services/group.service.ts:635,644` — там
`botInstance` это **локальная переменная** (`let botInstance = bot`), и проверка
корректна. Аналогично строка 866 в
`backend/src/__tests__/unit/services/order-calculation.service.test.ts`.

## Что уже есть в коде и не используется

`backend/src/bot/bot-instance.ts` экспортирует ровно то, что нужно:

- `getBotInstance(): Bot | null` — «бота может не быть, это допустимо»;
- `getRequiredBotInstance(): Bot` — «без бота операция бессмысленна, бросаем».

`getRequiredBotInstance` **не вызывается ни в одном месте продукта** (0 реальных
потребителей). То есть решение уже написано и просто не подключено.

## Что делать

1. Удалить локальные `function botInstance()` во всех шести файлах.
2. Для каждого сайта принять решение — оно бинарное и должно быть явным:
   - **уведомление/побочный эффект**, отсутствие бота допустимо →
     `const bot = getBotInstance(); if (!bot) { logger.warn(...); return; }`
     и дальше `bot.api...` без `!`;
   - **операция без бота бессмысленна** (например, отправка сообщения — часть
     контракта метода, вызывающий ждёт messageId) →
     `const bot = getRequiredBotInstance();` и пусть падает громко.
3. Убрать все `!` после `botInstance()` — после шага 2 они не нужны, а именно
   они прячут проблему от TypeScript.

## TDD-порядок

Для каждого файла — сначала тест, потом правка:

```ts
// пример каркаса
jest.mock('../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(() => null),
  getRequiredBotInstance: jest.fn(() => { throw new Error('Bot instance is not initialized'); }),
}));

it('без бота не бросает и не отправляет ничего', async () => {
  await expect(PollFlowService.someMethod(1)).resolves.toBeUndefined();
  // никаких unhandled TypeError
});
```

Тест на текущем коде должен **падать с TypeError** — это доказательство, что
guard мёртв. Если тест зелёный сразу, значит вы замокали не тот модуль.

## Подводные камни

- **`jest.mock` пути.** Сервисы импортируют `'../bot/bot-instance'`, тесты
  живут в `src/services/__tests__/` и `src/__tests__/unit/services/` — путь мока
  отличается между этими двумя расположениями. Существующие тесты уже мокают
  бот по-разному; смотрите, как это сделано в
  `backend/src/services/__tests__/` рядом, и не плодите третий способ.
- **Смена контракта.** Замена «тихо выйти» на `getRequiredBotInstance()` меняет
  поведение вызывающего: там, где раньше метод возвращал `void`, теперь полетит
  исключение. Проверьте вызывающих (`poll.service.extensions.autoCompletePoll`
  вызывается из планировщика — там исключение уронит cron-тик, если не
  обёрнуто). По умолчанию выбирайте graceful skip; `getRequiredBotInstance`
  только там, где вызывающий уже в try/catch.
- **`poll.service.extensions.ts:143`** возвращает `sentMessage.message_id`
  наружу — это как раз кандидат на `getRequiredBotInstance`, потому что
  вернуть «messageId, которого нет» нельзя.
- Не делайте массовую sed-замену: сайты не однородны, решение «skip vs throw»
  принимается по каждому.
- **Существующий тест держит шим.**
  `backend/src/__tests__/unit/services/poll.service.extensions.test.ts:407`
  содержит `expect(() => initializePollServiceBot({})).not.toThrow()`. Если в
  рамках этой задачи (или задачи 09.1) удалить шим, тест сломается — его надо
  удалить тем же коммитом. Единственный продакшен-вызывающий —
  `backend/src/index.ts:63` (импорт на строке 13).

## Что оказалось сверх плана

Найдено при исполнении, в плане не значилось:

1. **Ветка 503 в `poll.controller.ts` была мертва.** Контроллер искал в тексте
   ошибки подстроку `'Bot not initialized'`, а сервис бросал
   `'Bot not initialized in PollService'` → после перехода на
   `getRequiredBotInstance()` формулировка разошлась бы окончательно. Введён тип
   `BotNotInitializedError` (`bot-instance.ts`), контроллер ловит по типу.
   Тест на 503 существовал и проходил, потому что **сам сочинял текст ошибки** —
   заменён на настоящий тип.
2. **`getRealMemberCount` получал ссылку на функцию, а не бота**
   (`poll.service.extensions.ts:96`). У функции нет `.api`, поэтому метод молча
   отдавал `null`, и `expectedParticipants` никогда не обновлялся из Telegram.
   **Это изменение поведения в проде:** порог автозакрытия опросов теперь
   считается по реальному числу участников группы. Сохранить старое (сломанное)
   поведение было невозможно: без локального хелпера передавать туда нечего, а
   при пустом аргументе `getRealMemberCount` сам достаёт синглтон.
3. **Ещё два мёртвых guard'а сверх 12 из плана:** `budget.service.ts:370`
   (`&& botInstance`) и пять `&& botInstance` в `responsible.service.ts`.
4. **Два места, где ранний выход был бы регрессией:**
   `sendVolunteerPromptForCategory` и `sendVolunteerPrompt` не отправляют
   сообщений сами — они ставят таймаут фолбэка на рулетку. Мёртвый guard не
   мешал таймауту; ранний выход оставил бы категорию в `VOLUNTEER_OPEN`
   навсегда. Guard там снят/ослаблен, причина записана в коде.

## Критерии готовности

- [x] `grep -rn "if (!botInstance)" backend/src --include=*.ts` даёт только
      `group.service.ts` и тестовый файл.
- [x] `grep -rn "botInstance()!" backend/src --include=*.ts` пусто.
- [x] `grep -rn "function botInstance" backend/src --include=*.ts` пусто.
- [x] На каждый затронутый сервис есть тест «бота нет» — падение до правки
      подтверждено прогоном на исходном `reminder.service.ts`
      (`Bot not available` против `Internal error`).
- [x] `npm --prefix backend run test:unit` зелёный: 3486 тестов, 111 наборов.
      Полный `npm test` требует PostgreSQL и в этой среде не запускался;
      порог покрытия не менялся.

## Проверка

```powershell
npm --prefix backend run lint
npm --prefix backend run build:prod
npm --prefix backend test
```
