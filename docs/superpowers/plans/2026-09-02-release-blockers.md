# План закрытия блокеров выпуска и дорога к 95–98 % готовности

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть шесть блокеров и две системные проблемы, найденные аудитом 2026-09-02, так, чтобы сквозные сценарии «голосование → итоги → долги → оплата» работали для реального пользователя, затем добить готовность до 95–98 %.

**Architecture:** Точечные исправления в существующих сервисах без новых слоёв. Единственное структурное решение — завершение просроченного голосования выносится из in-memory таймера в единый путь планировщика, а таймеры восстанавливаются при старте под уже существующим advisory-lock. Мёртвый legacy-маршрут расходов удаляется, а не чинится.

**Tech Stack:** backend — TypeScript strict, Express 5, Prisma 7, grammy, jest + `prismaMock`; frontend-new — React 19, TanStack Query 5, vitest.

**Spec:** отчёт аудита `C:/Temp/claude/e--Launch-bot-telegram-food-bot/c2d4f563-3336-4ed5-9c91-1055a3399250/scratchpad/audit-report.md` (23 подтверждённых находки, 33 непроверенных). Разделы «Блокеры» и «Подтверждённые находки» — источник требований для части 1; «Непроверенные находки» и «Не покрыто» — для части 2.

## Global Constraints

- Членство и роль проверяются на сервере; `groupId` и любые id из тела запроса не доказательство доступа (AGENTS.md).
- Изменяющие операции идемпотентны и атомарны; Redis в продакшене обязателен.
- В журналы не пишутся `initData`, JWT, токены, строки подключения.
- Только `logger.*`, только Prisma, `BigInt` через общий сериализатор.
- Точка с запятой обязательна, одинарные кавычки, отступ два пробела, ES5 trailing comma.
- Тесты бэкенда: `npm --prefix backend run test:unit` (без БД), полный `npm --prefix backend test` — только в CI (нужна PostgreSQL). Перед коммитом: `npm --prefix backend run lint`, `npm --prefix backend run build:prod`.
- Тесты фронтенда: `npm --prefix frontend-new test`, `type-check`, `lint --max-warnings 0`, `build`.
- Коммиты — на русском, в стиле `fix(scope): что было сломано → что стало` (см. `git log`).
- Ничего не деплоить вручную через `update-vps.sh` — он продакшен не обновляет; выпуск только тегом через Actions.

---

# Часть 1. Блокеры

Порядок задач — по влиянию на пользователя. Задачи 1, 3, 5, 6, 8 независимы. Задача 2 меняет планировщик и должна идти после задачи 1 (обе трогают завершение голосования). Задача 7 — сквозная по сообщениям бота, идёт после 1 и 5, чтобы не конфликтовать по файлам.

### Task 1: Уведомление о завершении голосования уходит на Telegram chat id

Сейчас в `sendPollCompletionNotifications` в `notificationService.send({ userId })` передаётся `Vote.userId` — внутренний `User.id`, а `send()` кладёт это значение прямо в `bot.api.sendMessage(chat_id)`. Telegram отвечает «chat not found», уведомление не доходит никому. Рядом, в уведомлении об отмене (та же служба, строка ~321), передаётся `Number(voter.telegramId)` — это и есть правильная форма.

**Files:**
- Modify: `backend/src/services/poll-notification.service.ts:230`
- Test: `backend/src/__tests__/unit/services/poll-notification.service.test.ts`

**Interfaces:**
- Consumes: `notificationService.send({ userId: number /* Telegram chat id */, ... })` из `notification.service.ts`.
- Produces: ничего нового; контракт `sendPollEndedNotification(userIds /* Telegram chat ids */, data)` фиксируется JSDoc.

- [ ] **Step 1: Написать падающий тест**

В конец `describe` в `poll-notification.service.test.ts` (мок-стиль файла — `prismaMock` + `jest.mock('../../../services/notification.service')`; если в файле notification.service не замокан, добавить мок рядом с остальными):

```ts
jest.mock('../../../services/notification.service', () => ({
  notificationService: { send: jest.fn().mockResolvedValue({ success: true }) },
}));

it('уведомление о завершении уходит на Telegram id голосовавших, а не на внутренний User.id', async () => {
  prismaMock.poll.findUnique.mockResolvedValue({
    id: 7,
    group: { title: 'Обед' },
    result: { totalVotes: 2, rouletteData: null, winnerMenuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
    votes: [
      { userId: 1, menuItemId: 1, user: { id: 1, telegramId: BigInt(555000001) }, menuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
      { userId: 2, menuItemId: 1, user: { id: 2, telegramId: BigInt(555000002) }, menuItem: { id: 1, name: 'Плов', description: null, price: 300 } },
    ],
  } as never);

  await pollNotificationService.sendPollCompletionNotifications(7);

  const { notificationService } = jest.requireMock('../../../services/notification.service');
  const sentTo = (notificationService.send as jest.Mock).mock.calls.map(([arg]) => arg.userId).sort();
  expect(sentTo).toEqual([555000001, 555000002]);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm --prefix backend run test:unit -- poll-notification.service.test.ts -t "Telegram id"`
Expected: FAIL — фактические `userId` равны `[1, 2]`.

- [ ] **Step 3: Исправить источник id**

В `poll-notification.service.ts` заменить строку

```ts
const voterIds = Array.from(new Set(poll.votes.map(v => v.userId)));
```

на

```ts
/* notificationService.send ждёт Telegram chat id, а не User.id — см. комментарий
   в isUserMuted. Отмена голосования ниже уже передаёт telegramId; здесь было
   то же самое, только со внутренним id, и уведомление не доходило никому. */
const voterIds = Array.from(
  new Set(poll.votes.map(v => Number(v.user.telegramId)))
);
```

И дописать в JSDoc `sendPollEndedNotification`: `@param userIds Telegram chat id получателей (не User.id)`.

- [ ] **Step 4: Прогнать тест и соседей**

Run: `npm --prefix backend run test:unit -- poll-notification.service.test.ts poll-completion.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/poll-notification.service.ts backend/src/__tests__/unit/services/poll-notification.service.test.ts
git commit -m "fix(notifications): итоги голосования уходили на внутренний User.id вместо Telegram chat id"
```

---

### Task 2: Просроченное голосование завершается, а не отменяется; таймеры переживают рестарт

Таймер завершения — `setTimeout` в памяти процесса (`poll-timer.service.ts`), единственный вызывающий — создание голосования. После рестарта cron `cancelExpiredPolls` ставит просроченному голосованию `CANCELLED`: победителя нет, долгов нет. Решение из двух частей: (а) планировщик завершает просроченное голосование с голосами тем же путём, что таймер, и отменяет только пустое; (б) при старте под advisory-lock планировщика таймеры активных голосований восстанавливаются.

**Files:**
- Modify: `backend/src/services/poll-completion.service.ts:496-535` (`cancelExpiredPolls` → `findExpiredActivePolls` + `cancelIfStillActive`)
- Modify: `backend/src/services/poll-timer.service.ts` (добавить `restoreActiveTimers`, вынести `scheduleAfter`)
- Modify: `backend/src/services/poll-scheduler.service.ts:152-160` (`closeExpiredPolls`) и `start()` после захвата лока
- Test: `backend/src/__tests__/unit/services/poll-scheduler.service.test.ts`
- Test: `backend/src/__tests__/unit/services/poll-completion.service.test.ts`
- Test: create `backend/src/__tests__/unit/services/poll-timer.service.test.ts`

**Interfaces:**
- Produces в `poll-completion.service.ts`:
  ```ts
  export interface ExpiredPollRow {
    id: number;
    groupId: number;
    endsAt: Date;
    chatId: bigint | null;
    messageId: number | null;
    votesCount: number;
  }
  static async findExpiredActivePolls(at?: Date): Promise<ExpiredPollRow[]>
  static async cancelIfStillActive(poll: Pick<ExpiredPollRow, 'id' | 'groupId' | 'endsAt'>): Promise<boolean>
  ```
- Produces в `poll-timer.service.ts`:
  ```ts
  export async function restoreActiveTimers(now?: Date): Promise<number> // сколько таймеров поставлено
  ```
- Consumes: `completeByTimer({ pollId, chatId, messageId })` — уже есть.

- [ ] **Step 1: Тест на разделение «завершить vs отменить» в планировщике**

В `poll-scheduler.service.test.ts` (стиль файла: моки сервисов через `jest.mock`, вызов приватного метода через `(PollSchedulerService as any).closeExpiredPolls()`):

```ts
jest.mock('../../../services/poll-timer.service', () => ({
  completeByTimer: jest.fn().mockResolvedValue(undefined),
  restoreActiveTimers: jest.fn().mockResolvedValue(0),
}));

describe('closeExpiredPolls', () => {
  it('голосование с голосами завершается через completeByTimer, пустое — отменяется', async () => {
    const { PollCompletionService } = jest.requireMock('../../../services/poll-completion.service');
    const { completeByTimer } = jest.requireMock('../../../services/poll-timer.service');
    PollCompletionService.findExpiredActivePolls.mockResolvedValue([
      { id: 1, groupId: 10, endsAt: new Date(), chatId: BigInt(-100), messageId: 42, votesCount: 3 },
      { id: 2, groupId: 10, endsAt: new Date(), chatId: BigInt(-100), messageId: 43, votesCount: 0 },
    ]);
    PollCompletionService.cancelIfStillActive.mockResolvedValue(true);

    await (PollSchedulerService as unknown as { closeExpiredPolls: () => Promise<void> }).closeExpiredPolls();

    expect(completeByTimer).toHaveBeenCalledTimes(1);
    expect(completeByTimer).toHaveBeenCalledWith({ pollId: 1, chatId: -100, messageId: 42 });
    expect(PollCompletionService.cancelIfStillActive).toHaveBeenCalledTimes(1);
    expect(PollCompletionService.cancelIfStillActive).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('голосование с голосами, но без chatId/messageId завершается completePoll без объявления в группу', async () => {
    const { PollCompletionService } = jest.requireMock('../../../services/poll-completion.service');
    PollCompletionService.findExpiredActivePolls.mockResolvedValue([
      { id: 3, groupId: 10, endsAt: new Date(), chatId: null, messageId: null, votesCount: 1 },
    ]);
    await (PollSchedulerService as unknown as { closeExpiredPolls: () => Promise<void> }).closeExpiredPolls();
    expect(PollCompletionService.completePoll).toHaveBeenCalledWith(3);
  });
});
```

Убедиться, что мок `poll-completion.service` в этом файле содержит `findExpiredActivePolls`, `cancelIfStillActive`, `completePoll` (добавить в существующий `jest.mock`).

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm --prefix backend run test:unit -- poll-scheduler.service.test.ts -t closeExpiredPolls`
Expected: FAIL — `findExpiredActivePolls is not a function`.

- [ ] **Step 3: Разделить выборку и отмену в `poll-completion.service.ts`**

Заменить `cancelExpiredPolls` (строки 496-535) на:

```ts
export interface ExpiredPollRow {
  id: number;
  groupId: number;
  endsAt: Date;
  chatId: bigint | null;
  messageId: number | null;
  votesCount: number;
}

/**
 * Активные голосования, у которых вышло время. Решение «завершить или
 * отменить» принимает планировщик: ему нужны chat/message для объявления
 * итогов и число голосов, чтобы не завершать пустое голосование.
 */
static async findExpiredActivePolls(at: Date = new Date()): Promise<ExpiredPollRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; groupId: number; endsAt: Date; chatId: bigint | null; messageId: number | null; votesCount: bigint }>
  >`
    SELECT p.id,
           p.group_id   AS "groupId",
           COALESCE(p.ended_at, p.started_at + (p.duration * INTERVAL '1 minute')) AS "endsAt",
           p.chat_id    AS "chatId",
           p.message_id AS "messageId",
           (SELECT COUNT(*) FROM votes v WHERE v.poll_id = p.id) AS "votesCount"
    FROM polls p
    WHERE p.status = 'ACTIVE'
      AND COALESCE(p.ended_at, p.started_at + (p.duration * INTERVAL '1 minute'))
          <= to_timestamp(${at.getTime()}::bigint / 1000.0) at time zone 'UTC'
  `;
  return rows.map(r => ({ ...r, votesCount: Number(r.votesCount) }));
}

/**
 * Отмена одного просроченного голосования. `where: { status: 'ACTIVE' }` —
 * оптимистичная блокировка: если таймер успел завершить его первым, count = 0.
 */
static async cancelIfStillActive(
  poll: Pick<ExpiredPollRow, 'id' | 'groupId' | 'endsAt'>
): Promise<boolean> {
  const result = await prisma.poll.updateMany({
    where: { id: poll.id, status: 'ACTIVE' },
    data: { status: 'CANCELLED', endedAt: poll.endsAt },
  });
  if (result.count === 0) return false;
  void CacheInvalidator.invalidatePoll(poll.id, poll.groupId);
  logger.info(
    `Auto-cancelled expired poll ${poll.id} (group ${poll.groupId}) — timer elapsed, no votes`
  );
  return true;
}

/** Совместимость с прежним вызовом: отменяет все просроченные без голосов. */
static async cancelExpiredPolls(at: Date = new Date()): Promise<number> {
  const expired = await this.findExpiredActivePolls(at);
  let cancelled = 0;
  for (const poll of expired) {
    if (poll.votesCount > 0) continue;
    if (await this.cancelIfStillActive(poll)) cancelled += 1;
  }
  return cancelled;
}
```

Проверить существующий тест `cancelExpiredPolls` в `poll-completion.service.test.ts`/`poll.service.test.ts`: там `$queryRaw` мокается массивом строк — добавить в фикстуры поля `chatId`, `messageId`, `votesCount: 0n`.

- [ ] **Step 4: Планировщик решает, что делать с просроченным**

В `poll-scheduler.service.ts` добавить импорты

```ts
import { completeByTimer, restoreActiveTimers } from './poll-timer.service';
import { PollCompletionService, type ExpiredPollRow } from './poll-completion.service';
```

(существующий импорт `PollCompletionService` расширить типом) и заменить `closeExpiredPolls`:

```ts
/**
 * Просроченные голосования. С голосами — завершаем тем же путём, что таймер
 * (итоги в группу, заказы по категориям); без голосов — отменяем. До этого
 * планировщик отменял всё подряд, и после рестарта процесса обед «отменялся».
 */
private static async closeExpiredPolls(): Promise<void> {
  let expired: ExpiredPollRow[];
  try {
    expired = await PollCompletionService.findExpiredActivePolls();
  } catch (error) {
    logger.error('Poll scheduler: findExpiredActivePolls failed', error);
    return;
  }

  for (const poll of expired) {
    try {
      if (poll.votesCount === 0) {
        await PollCompletionService.cancelIfStillActive(poll);
        continue;
      }
      if (poll.chatId !== null && poll.messageId !== null) {
        await completeByTimer({
          pollId: poll.id,
          chatId: Number(poll.chatId),
          messageId: poll.messageId,
        });
      } else {
        await PollCompletionService.completePoll(poll.id);
      }
      logger.info(`Poll scheduler: completed expired poll ${poll.id} (group ${poll.groupId})`);
    } catch (error) {
      logger.error(`Poll scheduler: failed to close expired poll ${poll.id}`, error);
    }
  }
}
```

`completeByTimer` уже глотает `PollAlreadyCompletedError`, поэтому гонка с восстановленным таймером безопасна: проигравший просто залогирует.

- [ ] **Step 5: Прогнать тесты планировщика**

Run: `npm --prefix backend run test:unit -- poll-scheduler.service.test.ts poll-completion.service.test.ts poll.service.test.ts`
Expected: PASS.

- [ ] **Step 6: Тест восстановления таймеров**

Создать `backend/src/__tests__/unit/services/poll-timer.service.test.ts`:

```ts
import { restoreActiveTimers } from '../../../services/poll-timer.service';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../services/poll-completion.service', () => ({
  PollCompletionService: { completePoll: jest.fn().mockResolvedValue({ totalVotes: 0 }) },
}));
jest.mock('../../../services/poll-query.service', () => ({
  PollQueryService: { getPollById: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
}));
jest.mock('../../../services/poll-announce.service', () => ({
  announceCompletion: jest.fn(), notifyParticipantsLegacy: jest.fn(),
}));
jest.mock('../../../services/poll-stats.service', () => ({ PollStatsService: {} }));
jest.mock('../../../services/poll.service', () => ({ PollService: {} }));
jest.mock('../../../services/category-order.service', () => ({ CategoryOrderService: {} }));
jest.mock('../../../services/multi-category-responsible.service', () => ({ MultiCategoryResponsibleService: {} }));

describe('restoreActiveTimers', () => {
  beforeEach(() => { resetPrismaMock(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('ставит таймер на остаток времени и сразу на просроченные', async () => {
    const now = new Date('2026-09-02T12:00:00Z');
    prismaMock.poll.findMany.mockResolvedValue([
      { id: 1, chatId: BigInt(-1), messageId: 5, startedAt: new Date('2026-09-02T11:50:00Z'), duration: 30 },
      { id: 2, chatId: BigInt(-1), messageId: 6, startedAt: new Date('2026-09-02T10:00:00Z'), duration: 30 },
    ] as never);
    const spy = jest.spyOn(global, 'setTimeout');

    const restored = await restoreActiveTimers(now);

    expect(restored).toBe(2);
    const delays = spy.mock.calls.map(([, ms]) => ms).sort((a, b) => Number(a) - Number(b));
    expect(delays).toEqual([0, 20 * 60 * 1000]);
  });

  it('голосования без chatId/messageId пропускает — их закроет планировщик', async () => {
    prismaMock.poll.findMany.mockResolvedValue([] as never);
    expect(await restoreActiveTimers()).toBe(0);
    expect(prismaMock.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', chatId: { not: null }, messageId: { not: null } } })
    );
  });
});
```

- [ ] **Step 7: Убедиться, что тест падает**

Run: `npm --prefix backend run test:unit -- poll-timer.service.test.ts`
Expected: FAIL — `restoreActiveTimers` не экспортирован.

- [ ] **Step 8: Реализовать восстановление в `poll-timer.service.ts`**

Добавить импорт `import { prisma } from '../database/client';` и заменить `scheduleTimerCompletion`:

```ts
/** Поставить таймер автозавершения на длительность голосования. */
export function scheduleTimerCompletion(params: {
  pollId: number;
  chatId: number;
  messageId: number;
  durationMinutes: number;
}): void {
  scheduleAfter(params, params.durationMinutes * 60 * 1000);
}

function scheduleAfter(
  params: { pollId: number; chatId: number; messageId: number },
  delayMs: number
): void {
  setTimeout(() => {
    void completeIfStillActive(params);
  }, Math.max(0, delayMs));
}

/**
 * Восстановить таймеры после рестарта процесса. Вызывается из планировщика
 * ПОСЛЕ захвата advisory-lock — так таймеры живут ровно в одном процессе.
 * Просроченные ставятся на 0 мс: завершатся сразу, а не через минуту cron'а.
 */
export async function restoreActiveTimers(now: Date = new Date()): Promise<number> {
  const active = await prisma.poll.findMany({
    where: { status: 'ACTIVE', chatId: { not: null }, messageId: { not: null } },
    select: { id: true, chatId: true, messageId: true, startedAt: true, duration: true },
  });

  for (const poll of active) {
    const endsAt = poll.startedAt.getTime() + poll.duration * 60 * 1000;
    scheduleAfter(
      { pollId: poll.id, chatId: Number(poll.chatId), messageId: poll.messageId as number },
      endsAt - now.getTime()
    );
  }

  if (active.length > 0) {
    logger.info(`Restored ${active.length} poll completion timer(s) after restart`);
  }
  return active.length;
}
```

Обновить комментарий в шапке файла: абзац «ВАЖНО… записано в tech_debt/06 как продуктовое решение» заменить на «Таймер живёт в памяти, поэтому при старте `restoreActiveTimers` ставит его заново, а планировщик завершает (не отменяет) просроченные голосования с голосами».

- [ ] **Step 9: Вызвать восстановление из планировщика**

В `PollSchedulerService.start()` сразу после успешного `acquireSingletonLock()` и до `cron.schedule`:

```ts
try {
  await restoreActiveTimers();
} catch (error) {
  logger.error('Poll scheduler: restoreActiveTimers failed', error);
}
```

В `poll-scheduler.lifecycle.test.ts` замокать `poll-timer.service` (`restoreActiveTimers: jest.fn().mockResolvedValue(0)`) и добавить проверку: `start()` вызывает `restoreActiveTimers` один раз, а при провале лока — ни разу.

- [ ] **Step 10: Полный модульный прогон, lint, сборка**

Run:
```bash
npm --prefix backend run test:unit
npm --prefix backend run lint
npm --prefix backend run build:prod
```
Expected: все зелёные (кроме известных 6 падений `category-order-authorization.test.ts` без `JWT_SECRET` — см. часть 2, п. 5).

- [ ] **Step 11: Commit**

```bash
git add backend/src/services/poll-completion.service.ts backend/src/services/poll-timer.service.ts backend/src/services/poll-scheduler.service.ts backend/src/__tests__/unit/services/
git commit -m "fix(polls): просроченное голосование отменялось после рестарта — теперь завершается, таймеры восстанавливаются под lock планировщика"
```

---

### Task 3: Обновление сессии Mini App работает дольше часа

Клиент не сохраняет `refreshToken` (`extractPayload` отбрасывает его) и шлёт access-токен на `/auth/refresh`, где `refreshTokenMiddleware` требует `type === 'refresh'`. Запасной путь — тот же `initData` — протухает за 300 с. Через час любой 401 ведёт к экрану «Сессия истекла».

**Files:**
- Modify: `frontend-new/src/services/api.service.ts:12-72, 178-190` (хранение refresh-токена; явный `Authorization` не перетирается)
- Modify: `frontend-new/src/services/auth.service.ts` (сохранять и использовать refresh-токен)
- Test: `frontend-new/src/services/__tests__/auth.service.test.ts`
- Test: `frontend-new/src/services/__tests__/api.service.test.ts`
- Check: e2e-мок `/auth/refresh` (найти: `grep -rn "auth/refresh" frontend-new/tests`) — должен отвечать 401 на не-refresh токен, иначе продолжит маскировать баг.

**Interfaces:**
- Produces в `api.service.ts`: `setRefreshToken(token: string): void`, `getRefreshToken(): string | null`; `clearToken()` очищает оба.
- Produces в `auth.service.ts`: `AuthResponse` получает поле `refreshToken?: string`; `refreshAuth()` шлёт `Authorization: Bearer <refreshToken>`.
- Consumes: ответ сервера `{ success, user, accessToken, refreshToken, expiresIn }` (`auth.controller.ts:434-443`, оба эндпоинта).

- [ ] **Step 1: Падающие тесты в `auth.service.test.ts`**

Заменить `describe('refreshAuth')` и тесты порядка переавторизации:

```ts
describe('refreshAuth', () => {
  it('шлёт именно refresh-токен в Authorization и сохраняет новую пару', async () => {
    h.getRefreshToken.mockReturnValue('refresh-1');
    h.post.mockResolvedValue({
      success: true,
      data: { user: USER, accessToken: 'access-2', refreshToken: 'refresh-2' },
    });

    await expect(authService.refreshAuth()).resolves.toMatchObject({
      success: true, token: 'access-2', refreshToken: 'refresh-2',
    });
    expect(h.post).toHaveBeenCalledWith('/auth/refresh', undefined, {
      headers: { Authorization: 'Bearer refresh-1' },
    });
  });

  it('без сохранённого refresh-токена не ходит на сервер и возвращает отказ', async () => {
    h.getRefreshToken.mockReturnValue(null);
    await expect(authService.refreshAuth()).resolves.toMatchObject({ success: false });
    expect(h.post).not.toHaveBeenCalled();
  });
});

describe('validateInitData', () => {
  it('сохраняет refresh-токен из ответа', async () => {
    h.post.mockResolvedValue({
      success: true,
      data: { user: USER, accessToken: 'a', refreshToken: 'r' },
    });
    await authService.validateInitData('init');
    expect(h.setRefreshToken).toHaveBeenCalledWith('r');
  });
});
```

В `h` добавить `getRefreshToken: vi.fn()`, `setRefreshToken: vi.fn()` и пробросить их в мок `apiService`. В тесте «успешный refresh не трогает initData» задать `h.getRefreshToken.mockReturnValue('refresh-1')`. В тесте «при отказе refresh переходит к initData» ожидать первый вызов `('/auth/refresh', undefined, { headers: { Authorization: 'Bearer refresh-1' } })`.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm --prefix frontend-new test -- auth.service`
Expected: FAIL — `apiService.getRefreshToken is not a function`, `post` вызван с одним аргументом.

- [ ] **Step 3: Хранение refresh-токена в `api.service.ts`**

```ts
const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
```

Методы рядом с `setToken/getToken/clearToken`:

```ts
setRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_KEY, token);
}

getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

clearToken() {
  this.token = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}
```

В `headersFor` явно переданный заголовок побеждает:

```ts
const token = this.token;
if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
```

Тест в `api.service.test.ts`:

```ts
it('явный Authorization из config не перетирается access-токеном', async () => {
  apiService.setToken('access');
  fetchMock.mockResolvedValue(new Response('{"success":true}', { status: 200 }));
  await apiService.post('/auth/refresh', undefined, { headers: { Authorization: 'Bearer refresh' } });
  const [, init] = fetchMock.mock.calls[0];
  expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer refresh' });
});
```

(имя мока `fetch` взять из существующего файла теста.)

- [ ] **Step 4: `auth.service.ts` — сохранять и использовать refresh-токен**

```ts
export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  refreshToken?: string;
  error?: string;
}

function extractPayload<T extends { user: User; accessToken: string; refreshToken?: string }>(
  response: ApiResponse<T>,
): { user?: User; accessToken?: string; refreshToken?: string } {
  if (response.data && typeof response.data === 'object') {
    const { user, accessToken, refreshToken } = response.data;
    return { user, accessToken, refreshToken };
  }
  const top = response as unknown as { user?: User; accessToken?: string; refreshToken?: string };
  return { user: top.user, accessToken: top.accessToken, refreshToken: top.refreshToken };
}
```

В `validateInitData` и `refreshAuth` после успешного разбора:

```ts
if (response.success && user && accessToken) {
  if (refreshToken) apiService.setRefreshToken(refreshToken);
  return { success: true, user, token: accessToken, refreshToken };
}
```

`refreshAuth` целиком:

```ts
async refreshAuth(): Promise<AuthResponse> {
  const refreshToken = apiService.getRefreshToken();
  if (!refreshToken) {
    return { success: false, user: {} as User, token: '', error: 'No refresh token' };
  }
  try {
    /* Сервер принимает только токен type=refresh; access здесь даёт 401
       INVALID_TOKEN_TYPE — так и жил баг «сессия умирает через час». */
    const response = await apiService.post<AuthValidatePayload>('/auth/refresh', undefined, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    const { user, accessToken, refreshToken: next } = extractPayload(response);
    if (response.success && user && accessToken) {
      if (next) apiService.setRefreshToken(next);
      return { success: true, user, token: accessToken, refreshToken: next };
    }
    throw new Error(response.error || 'Refresh failed');
  } catch (error) {
    const e = error as { error?: string; message?: string };
    return { success: false, user: {} as User, token: '', error: e.error || e.message || 'Refresh failed' };
  }
}
```

Комментарий над `setReauthenticator` поправить: «initData живёт всю сессию» — неверно, он протухает за `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` (300 с по умолчанию); запасной путь работает только в первые минуты после открытия.

- [ ] **Step 5: E2E-мок должен отвергать access на `/auth/refresh`**

Найти мок: `grep -rn "auth/refresh" frontend-new/tests`. Если он отвечает успехом безусловно — сделать: заголовок `Authorization` без префикса `Bearer mock-refresh` → `401 { code: 'INVALID_TOKEN_TYPE' }`, а `/auth/validate` в моке должен отдавать `refreshToken: 'mock-refresh'`. Иначе smoke продолжит проходить на сломанном клиенте.

- [ ] **Step 6: Прогон**

Run:
```bash
npm --prefix frontend-new test
npm --prefix frontend-new run type-check
npm --prefix frontend-new run lint
npm --prefix frontend-new run test:e2e:smoke
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend-new/src/services/api.service.ts frontend-new/src/services/auth.service.ts frontend-new/src/services/__tests__/ frontend-new/tests
git commit -m "fix(auth): клиент не хранил refresh-токен и слал access на /auth/refresh — сессия умирала через час"
```

---

### Task 4: Удалить legacy-маршрут расходов, дававший переписать долги любому

`POST /api/budget/order-costs/:pollId` считает «ответственным» `poll.result.responsibleUserId`, куда в мульти-победительном режиме записывается `completedBy` — id последнего проголосовавшего. Пересчёт берёт `menuItem.price`, которого у категорийных транзакций нет, и обнуляет долги. Фронтенд этот маршрут не вызывает (grep по `frontend-new/src` — 0 совпадений); расходы категорий идут через `PUT /api/category-orders/:id/costs` с проверкой ответственного категории. Решение — удалить запись, оставить чтение.

**Files:**
- Modify: `backend/src/api/routes/budget.routes.ts:70` (удалить маршрут), `:16` (импорт схемы)
- Modify: `backend/src/api/controllers/budget.controller.ts:494-~530` (удалить `setOrderCosts`), импорты `setOrderCostsBody`
- Modify: `backend/src/api/schemas/budget.ts:75` (удалить `setOrderCostsBody`)
- Modify: `backend/src/services/order-costs.service.ts:14-130` (удалить `setOrderCosts`)
- Test: `backend/src/__tests__/unit/services/order-costs.service.test.ts` (снять тесты `setOrderCosts`)
- Test: `backend/src/__tests__/unit/controllers/budget.controller.test.ts` (`orderCostsServiceStub` без `setOrderCosts`)
- Test: `backend/src/__tests__/unit/routes/` — ближайший файл про budget-маршруты; добавить проверку 404
- Docs: `docs/07-api/` — убрать описание маршрута, если есть (`grep -rn "order-costs" docs`)

**Interfaces:**
- Produces: `OrderCostsService` остаётся с `getOrderCosts(pollId)` и `getPollCostBreakdown(pollId)`.
- Альтернатива (если владелец захочет сохранить маршрут): авторизация только по `categoryOrder.findFirst({ where: { pollId, responsibleUserId: userId } })` или `responsibleSelection.selectedUserId`, пересчёт только транзакций с `categoryOrderId: null`, `itemPrice = transaction.itemPrice ?? menuItem.price`. Не рекомендуется: дублирует категорийный путь.

- [ ] **Step 1: Тест на отсутствие маршрута**

В существующий файл тестов маршрутов бюджета (или новый `backend/src/__tests__/unit/routes/budget-routes.test.ts` в стиле соседей с `supertest` и замоканным `telegramAuthMiddleware`):

```ts
it('POST /api/budget/order-costs/:pollId больше не существует', async () => {
  const res = await request(app)
    .post('/api/budget/order-costs/1')
    .set('Authorization', 'Bearer test')
    .send({ deliveryCost: 100, serviceFee: 0, tip: 0 });
  expect(res.status).toBe(404);
  expect(res.body.code).toBe('ROUTE_NOT_FOUND');
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npm --prefix backend run test:unit -- budget-routes`
Expected: FAIL — статус 200/400/403, но не 404.

- [ ] **Step 3: Удалить маршрут, контроллер, схему, метод сервиса**

- `budget.routes.ts`: удалить строку `router.post('/order-costs/:pollId', ...)` и комментарий «Cost splitting POST routes»; убрать `setOrderCostsBody` из импорта.
- `budget.controller.ts`: удалить метод `setOrderCosts` и `setOrderCostsBody` из импорта.
- `schemas/budget.ts`: удалить `export const setOrderCostsBody = bodyContract(...)`.
- `order-costs.service.ts`: удалить метод `setOrderCosts` и, если `logger` больше не используется, его импорт; шапку класса поправить: «Чтение расходов и разбивки; запись расходов — `CategoryOrderService.updateCosts`».

- [ ] **Step 4: Поправить тесты**

- `order-costs.service.test.ts`: удалить `describe('setOrderCosts')`, оставить тесты `getPollCostBreakdown`.
- `budget.controller.test.ts`: из `orderCostsServiceStub()` убрать `setOrderCosts`, удалить его тесты.
- `poll-domain-errors.test.ts` / `poll.service.test.ts`: если ссылаются на `setOrderCosts` — удалить эти кейсы.

Run: `npm --prefix backend run test:unit -- order-costs budget knip`
Затем: `npm --prefix backend run knip` — убедиться, что `setOrderCostsBody` не остался неиспользуемым экспортом.

- [ ] **Step 5: Полный прогон и commit**

```bash
npm --prefix backend run test:unit && npm --prefix backend run lint && npm --prefix backend run build:prod
git add backend/src backend/docs docs
git commit -m "fix(budget): удалён POST /budget/order-costs — переписывал долги от имени последнего голосовавшего и обнулял категорийные суммы"
```

---

### Task 5: Ссылка СБП уходит должникам кнопкой, а не маской карты

`paymentCard` семантически стал ссылкой СБП (сервер принимает только `http/https`, профиль подписан «Ссылка на СБП»), но три места пропускают его через `maskCardNumber`, и должник видит `**** **** **** 1234`.

**Files:**
- Create: `backend/src/utils/payment-link.ts`
- Modify: `backend/src/services/poll-flow.service.ts:326, 383-405` (два места)
- Modify: `backend/src/services/store-run-budget.service.ts:199`
- Test: create `backend/src/__tests__/unit/utils/payment-link.test.ts`
- Test: `backend/src/__tests__/unit/services/poll-flow.service.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function isPaymentLink(value: string): boolean
  export function paymentLinkButton(value: string): { text: string; url: string }
  export function paymentCardLine(value: string): string // текст строки для сообщения
  ```

- [ ] **Step 1: Тест утилиты**

```ts
import { isPaymentLink, paymentCardLine, paymentLinkButton } from '../../../utils/payment-link';

describe('payment-link', () => {
  it('распознаёт http(s)-ссылку', () => {
    expect(isPaymentLink('https://qr.nspk.ru/AS1A00')).toBe(true);
    expect(isPaymentLink('2200 1234 5678 9012')).toBe(false);
  });
  it('для ссылки строка сообщения указывает на кнопку, для legacy-номера — маска', () => {
    expect(paymentCardLine('https://qr.nspk.ru/AS1A00')).toBe('🔗 Ссылка для перевода — кнопкой ниже');
    expect(paymentCardLine('2200123456789012')).toBe('💳 Карта: **** **** **** 9012');
  });
  it('кнопка несёт url как есть', () => {
    expect(paymentLinkButton('https://qr.nspk.ru/AS1A00')).toEqual({
      text: '💳 Перевести по ссылке', url: 'https://qr.nspk.ru/AS1A00',
    });
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает** — Run: `npm --prefix backend run test:unit -- payment-link`. Expected: FAIL, модуль не найден.

- [ ] **Step 3: Реализация `payment-link.ts`**

```ts
import { EncryptionService } from './encryption';

/**
 * Поле `paymentCard` исторически хранило номер карты, а теперь — ссылку СБП
 * (сервер принимает только http/https, см. user.controller). Маскировать
 * ссылку нельзя: должник получает «**** **** **** 1234» и не может заплатить.
 * Legacy-значения из цифр по-прежнему маскируются.
 */
export function isPaymentLink(value: string): boolean {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function paymentLinkButton(value: string): { text: string; url: string } {
  return { text: '💳 Перевести по ссылке', url: value.trim() };
}

/** Строка для текста сообщения (legacy-Markdown: ссылку в текст не кладём). */
export function paymentCardLine(value: string): string {
  return isPaymentLink(value)
    ? '🔗 Ссылка для перевода — кнопкой ниже'
    : `💳 Карта: ${EncryptionService.maskCardNumber(value)}`;
}
```

- [ ] **Step 4: Применить в `poll-flow.service.ts` (`sendDebtNotification`)**

Заменить блок

```ts
if (responsiblePaymentInfo?.paymentCard) {
  const masked = maskCardNumber(responsiblePaymentInfo.paymentCard);
  message += `💳 Карта: ${masked}\n`;
}
```

на

```ts
const paymentCard = responsiblePaymentInfo?.paymentCard ?? null;
if (paymentCard) {
  message += `${paymentCardLine(paymentCard)}\n`;
}
```

и клавиатуру:

```ts
const keyboard = {
  inline_keyboard: [
    ...(paymentCard && isPaymentLink(paymentCard) ? [[paymentLinkButton(paymentCard)]] : []),
    [{ text: 'Оплатил(а) ✅', callback_data: `budget:mark_paid:${transaction.id}` }],
  ],
};
```

Строку 326 (`message += \`Карта: ${maskCardNumber(paymentInfo.paymentCard)}\n\``) заменить на `message += \`${paymentCardLine(paymentInfo.paymentCard)}\n\`` и, если у того сообщения есть клавиатура, добавить кнопку тем же способом. Локальную `maskCardNumber` в файле удалить, если больше не используется. То же в `store-run-budget.service.ts:199`.

- [ ] **Step 5: Тест поведения в `poll-flow.service.test.ts`**

```ts
it('должник получает кнопку со ссылкой СБП, а не маску карты', async () => {
  const sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
  botMock.api.sendMessage = sendMessage; // как получают бот в этом файле
  await PollFlowService.sendDebtNotification(
    { id: 9, amount: 350, menuItem: { name: 'Плов' } },
    { id: 2, firstName: 'Аня', telegramId: BigInt(777) } as never,
    { paymentCard: 'https://qr.nspk.ru/AS1A00', paymentPhone: null, paymentDetails: null }
  );
  const [, text, options] = sendMessage.mock.calls[0];
  expect(text).not.toContain('****');
  expect(options.reply_markup.inline_keyboard[0][0]).toEqual({
    text: '💳 Перевести по ссылке', url: 'https://qr.nspk.ru/AS1A00',
  });
});
```

Run: `npm --prefix backend run test:unit -- poll-flow payment-link store-run-budget`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils/payment-link.ts backend/src/services/poll-flow.service.ts backend/src/services/store-run-budget.service.ts backend/src/__tests__/unit
git commit -m "fix(budget): ссылка СБП уходила должникам замаскированной под номер карты — теперь кнопкой"
```

---

### Task 6: Лимит выбора блюд считается по итогу, а не по одному запросу

`castVotes` сверяет `maxSelections` только с длиной текущего запроса, а `createMultipleVotes` лишь добавляет отсутствующие голоса. Повторные `POST /polls/:id/vote-multiple` накапливают голоса сверх лимита; в режиме одиночного выбора — по одному блюду за запрос.

**Files:**
- Modify: `backend/src/services/vote.service.ts:212-240` (`castVotes`)
- Test: `backend/src/services/__tests__/vote.service.test.ts`

**Interfaces:**
- Consumes: `prisma.vote.count` (уже в моке файла), ошибки `SingleSelectionOnlyError`, `MaxSelectionsExceededError(max)` из `vote.errors.ts`.

- [ ] **Step 1: Падающие тесты**

```ts
describe('castVotes — лимит по итогу, а не по запросу', () => {
  beforeEach(() => {
    (prisma.poll.findUnique as jest.Mock).mockResolvedValue({ isMultiSelect: true, maxSelections: 3 });
  });

  it('отвергает добор сверх maxSelections с учётом уже поданных голосов', async () => {
    (prisma.vote.count as jest.Mock).mockResolvedValue(2); // уже 2 других блюда
    await expect(VoteService.castVotes(1, 5, [10, 11])).rejects.toBeInstanceOf(MaxSelectionsExceededError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('повтор тех же блюд не считается добором', async () => {
    (prisma.vote.count as jest.Mock).mockResolvedValue(0); // notIn исключил их
    (prisma.$transaction as jest.Mock).mockResolvedValue({ allVotes: [], newlyCreatedItemIds: [] });
    await expect(VoteService.castVotes(1, 5, [10, 11, 12])).resolves.toEqual([]);
    expect(prisma.vote.count).toHaveBeenCalledWith({
      where: { pollId: 1, userId: 5, menuItemId: { notIn: [10, 11, 12] } },
    });
  });

  it('в одиночном режиме второе блюдо другим запросом отвергается', async () => {
    (prisma.poll.findUnique as jest.Mock).mockResolvedValue({ isMultiSelect: false, maxSelections: 1 });
    (prisma.vote.count as jest.Mock).mockResolvedValue(1);
    await expect(VoteService.castVotes(1, 5, [11])).rejects.toBeInstanceOf(SingleSelectionOnlyError);
  });
});
```

Импортировать ошибки: `import { MaxSelectionsExceededError, SingleSelectionOnlyError } from '../vote.errors';`.

- [ ] **Step 2: Убедиться, что падает** — Run: `npm --prefix backend run test:unit -- src/services/__tests__/vote.service.test.ts -t "лимит по итогу"`. Expected: FAIL (первый и третий тесты резолвятся вместо reject).

- [ ] **Step 3: Реализация в `castVotes`**

После вычисления `maxSelections` и до `createMultipleVotes`:

```ts
/* Лимит действует на ИТОГ, а не на один запрос: повторный вызов с другими
   блюдами раньше добирал голоса сверх maxSelections, а одиночный режим
   обходился по одному блюду за запрос. Уже поданные голоса за те же блюда
   добором не считаются — createMultipleVotes их и так пропустит. */
const alreadyVotedOthers = await prisma.vote.count({
  where: { pollId, userId, menuItemId: { notIn: menuItemIds } },
});
const resulting = alreadyVotedOthers + menuItemIds.length;

if (!isMultiSelect && resulting > 1) {
  throw new SingleSelectionOnlyError();
}
if (resulting > maxSelections) {
  throw new MaxSelectionsExceededError(maxSelections);
}
```

Существующие две проверки (`!isMultiSelect && menuItemIds.length > 1`, `menuItemIds.length > maxSelections`) удалить — новые их покрывают.

- [ ] **Step 4: Прогон и commit**

Run: `npm --prefix backend run test:unit -- vote.service poll.controller`
Expected: PASS.

```bash
git add backend/src/services/vote.service.ts backend/src/services/__tests__/vote.service.test.ts
git commit -m "fix(votes): лимит выбора обходился повторными vote-multiple — теперь считается по итогу голосов"
```

---

### Task 7: Экранирование подстановок в Markdown-сообщениях бота

Единый корень трёх подтверждённых находок: имена, названия блюд/групп, заголовок голосования и реквизиты вставляются в `parse_mode: 'Markdown'` без экранирования. Символы `_ * \` [` в имени дают `400 can't parse entities` (сообщение не доходит), а реквизиты позволяют вставить ссылку в личное сообщение другому участнику. Утилита `escapeMarkdown` уже есть (`backend/src/utils/telegram-html.ts:39`), применяется не везде.

**Files:**
- Modify: `backend/src/bot/keyboards/poll.keyboard.ts:70` (title)
- Modify: `backend/src/services/notification.templates.ts` (~строки 164, 196: имена, блюда, группа, reason)
- Modify: `backend/src/services/poll-flow.service.ts:378-395` (firstName, lastName, menuItem.name, paymentPhone, paymentDetails)
- Modify: `backend/src/bot/commands/start.ts:216` (first_name)
- Modify по grep: `backend/src/bot/middleware/auth.ts`, `store-run-notification.service.ts`, `responsible.service.ts`, `budget.service.ts`, `bot/commands/menu.ts`, `poll-announce.service.ts`, `poll-scheduler.service.ts`, `store-run-budget.service.ts`, `bot/handlers/poll.handlers.ts`, `admin.service.ts` — все места, где в строку с `parse_mode: 'Markdown'` подставляется пользовательское значение
- Test: `backend/src/__tests__/unit/utils/telegram-html.test.ts` (если нет — создать), тесты шаблонов в `backend/src/__tests__/unit/services/`

**Interfaces:**
- Consumes: `escapeMarkdown(text: string): string` — экранирует `_ * \` [`.
- Правило: экранируются ТОЛЬКО подставляемые данные, не шаблон.

- [ ] **Step 1: Найти все места подстановки**

```bash
cd backend && grep -rn "parse_mode: 'Markdown'\|parseMode: 'Markdown'" src --include=*.ts -l | grep -v __tests__
```

Для каждого файла из списка открыть функции, формирующие текст, и выписать подстановки `${...}` с данными из БД/Telegram: `firstName`, `lastName`, `username`, `title`, `name` (блюдо/категория/группа), `reason`, `notes`, `paymentPhone`, `paymentDetails`, `customOption`.

- [ ] **Step 2: Падающий тест на заголовок голосования**

В тесты клавиатуры/анонса (найти по `grep -rn "poll.keyboard" backend/src/__tests__`):

```ts
it('заголовок с символами Markdown экранируется', () => {
  const text = buildPollAnnouncementText({ title: 'Обед_в *Пловной*', endTime: new Date(), pollId: 1 });
  expect(text).toContain('Обед\\_в \\*Пловной\\*');
});
```

(имя функции — из `poll.keyboard.ts:70`; если текст собирается прямо в `announceNewPoll`, тестировать через мок `bot.api.sendMessage` и проверять аргумент текста.)

- [ ] **Step 3: Применить `escapeMarkdown` во всех найденных местах**

Паттерн замены — в каждом файле:

```ts
import { escapeMarkdown as md } from '../utils/telegram-html';
// было
message += `👤 *Ответственный:* ${responsible.firstName}`;
// стало
message += `👤 *Ответственный:* ${md(responsible.firstName)}`;
```

Конкретно для подтверждённых мест:
- `poll.keyboard.ts:70`: `${md(title)}`.
- `notification.templates.ts:164`: имена победителей/участников и названия блюд → `md(...)`; `:196` — `md(reason)`.
- `poll-flow.service.ts` `sendDebtNotification`: `${md(transaction.menuItem.name)}`, `${md(responsible.firstName)}`, `${md(responsible.lastName)}`, `${md(responsiblePaymentInfo.paymentPhone)}`, `${md(responsiblePaymentInfo.paymentDetails)}`.
- `start.ts:216`: `${md(ctx.from.first_name)}`.

Для каждого затронутого сервиса добавить тест вида «имя `A_b *c*` даёт в тексте `A\\_b \\*c\\*`», по одному на файл.

- [ ] **Step 4: Прогон**

Run: `npm --prefix backend run test:unit && npm --prefix backend run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "fix(bot): подстановки в Markdown не экранировались — сообщения с _ * [ не доходили, реквизиты позволяли вставить ссылку"
```

---

### Task 8: Mini App открывается в Telegram Web

helmet по умолчанию отдаёт `X-Frame-Options: SAMEORIGIN`, `frame-ancestors` в CSP нет; nginx-конфиги добавляют тот же заголовок. Telegram Web (web.telegram.org) грузит Mini App в iframe — браузер блокирует.

**Files:**
- Modify: `backend/src/api/server.ts:103-124`
- Modify: `nginx-vps.conf:42, 157`, `docker/nginx.conf:24`
- Test: `backend/src/__tests__/unit/api/server.test.ts`

- [ ] **Step 1: Падающий тест** (рядом с тестами CSP, стиль — `request(app).get('/api/stats')`):

```ts
it('разрешает встраивание в Telegram Web и не отдаёт X-Frame-Options', async () => {
  const { createApiServer } = loadServer();
  const app = createApiServer();
  const response = await request(app).get('/api/stats');
  expect(response.headers['content-security-policy']).toContain(
    "frame-ancestors 'self' https://web.telegram.org"
  );
  expect(response.headers['x-frame-options']).toBeUndefined();
});
```

- [ ] **Step 2: Убедиться, что падает** — Run: `npm --prefix backend run test:unit -- server.test.ts -t "Telegram Web"`. Expected: FAIL.

- [ ] **Step 3: Исправить `server.ts`**

В `cspDirectives` добавить `frameAncestors: ["'self'", 'https://web.telegram.org'],`. В `helmet({...})` добавить `frameguard: false, // frame-ancestors в CSP — единственный источник правды`. Комментарий у `crossOriginEmbedderPolicy: false` оставить.

В `nginx-vps.conf` (обе строки) и `docker/nginx.conf:24` удалить `add_header X-Frame-Options "SAMEORIGIN" always;` — иначе nginx вернёт запрет для статики, если её когда-нибудь начнут отдавать напрямую.

- [ ] **Step 4: Прогон и commit**

Run: `npm --prefix backend run test:unit -- server.test.ts`

```bash
git add backend/src/api/server.ts backend/src/__tests__/unit/api/server.test.ts nginx-vps.conf docker/nginx.conf
git commit -m "fix(security-headers): Mini App не открывался в Telegram Web — X-Frame-Options заменён на frame-ancestors"
```

---

### Task 9: Выпуск и проверка вживую

- [ ] **Step 1:** `npm --prefix backend run test:unit && npm --prefix backend run lint && npm --prefix backend run build:prod && npm --prefix frontend-new run type-check && npm --prefix frontend-new run lint && npm --prefix frontend-new test && npm --prefix frontend-new run build`
- [ ] **Step 2:** push в `main`, дождаться зелёного CI (там PostgreSQL и полный прогон, в т.ч. сырой SQL `findExpiredActivePolls`).
- [ ] **Step 3:** тег `v1.0.5` → `Deploy to Production`. Во время деплоя **не должно быть активного голосования** в реальной группе — это первый выпуск, где рестарт проверяет восстановление таймеров; лучше проверить сценарий в тестовой группе сразу после.
- [ ] **Step 4:** ручная проверка по `docs/09-production-readiness/RELEASE_RUNBOOK.md`: создать голосование в тестовой группе на 2 минуты, проголосовать двумя аккаунтами, дождаться итогов → оба получают личное уведомление; открыть Mini App в web.telegram.org; оставить Mini App открытым 65 минут и сделать действие → без экрана «Сессия истекла».
- [ ] **Step 5:** `record_work` в хранилище и обновление статус-ноты проекта.

---

# Часть 2. Дорога к 95–98 %

Рубрика аудита даёт 55 %. Часть 1 закрывает все high и половину medium: оценка поднимается примерно до **75 %** (аутентификация 5→8, авторизация 5→7, деньги 4→7, эксплуатация 4→7, фронтенд 5→7, инъекции 6→8, конфигурация 6→7). Дальше — по убыванию цены/эффекта.

## Этап A. Оставшиеся подтверждённые находки (→ ~82 %)

1. **Блокировка участника снимается им самим** (`group.service.ts:168`, medium): в `GroupMember` нет отдельного состояния «заблокирован админом» — это тот же `isActive=false`, что и «вышел». Добавить поле `blockedAt DateTime?` (миграция), `ensureMemberRole`/реактивация по сообщению или deep-link не снимают его; снимает только админ через `PUT /admin/users/:userId/active`. Тест: сообщение в группе от заблокированного не делает его активным.
2. **Кросс-групповая статистика** (`poll-stats.service.ts:134-135`, low ×2): `getUserParticipationStats` фильтровать по `groupId` вызывающего админа — и числитель, и знаменатель (`COMPLETED` голосования только этой группы).
3. **Иерархия ролей** (`admin.service.ts:286`, low): `requireGroupAdminOverUser` отказывает, если цель — `CREATOR`, а вызывающий — `ADMIN`.
4. **Порядок проверок в `POST /store-runs`** (`store-run.controller.ts:61`, low): сначала членство вызывающего, потом `getChatMember`.
5. **Ошибка БД в auth-middleware как 401** (`telegram-auth.ts:222`, low): исключения Prisma → 503 `AUTH_UNAVAILABLE`, а не 401; клиент тогда не стирает сессию.
6. **Донаты: сырое сообщение ошибки 500** (`donation.controller.ts:41`): единый `next(err)` → error-handler.
7. **Доли расходов в double** (`order-calculation.service.ts:302`): считать в `Decimal` (`utils/decimal.ts`), остаток копеек — первому участнику; тест на сходимость суммы.
8. **Ошибка БД внутри `telegramAuthMiddleware`** и **P2002 отдаёт имена колонок** (`error-handler.ts:179`): в продакшене `meta.target` не отдавать.

## Этап B. Непроверенные находки с высокой ценой (→ ~88 %)

Верифицировать чтением кода (по одной, каждая — отдельная задача с тестом), затем исправить:

1. `bot.ts:168` — нет `bot.catch`: одна необработанная ошибка в middleware останавливает polling. Добавить `bot.catch(err => logger.error(...))` + тест lifecycle.
2. `bot/middleware/auth.ts:83` — `migrate_to_chat_id` не обрабатывается: при апгрейде группы в супергруппу меню, голосования и роли остаются у старого id. Обработать событие: `group.update({ telegramId: newId })` в транзакции.
3. `bot/middleware/auth.ts:65` — служебные аккаунты (1087968824 анонимный админ, 777000) регистрируются участниками → кворум недостижим. Фильтр по списку служебных id.
4. `cache.service.ts:225` — `scanStream` без `on('error')`: сбой Redis в момент инвалидации роняет процесс.
5. `poll-query.service.ts:215/247` — кэш активных голосований не пишется из-за `BigInt` в `JSON.stringify` и нарушает правило «активные не кэшируем». Удалить кэширование активных вовсе.
6. `budget.service.ts:57` — отметка оплаты меняет статус, затем падает на уведомлении кредитору → должнику «что-то пошло не так». Уведомление — вне транзакции, ошибки глотать с логом.
7. `poll-scheduler.service.ts:176`, `debt-reminder.job.ts:300`, `store-run-notification.service.ts:72` — зона времени процесса. Решение владельца по TZ (см. `RESIDUAL_RISKS.md`), затем: `TZ=Europe/Moscow` в `ecosystem.config.js` `env` + проверка при старте, либо сравнение через `Intl.DateTimeFormat(..., { timeZone })`.
8. `index.ts:95` — graceful shutdown не завершается при открытых SSE: закрывать SSE-соединения в `gracefulShutdown` до `server.close()`.
9. Фронтенд: `usePolls.ts:34` (активный опрос по всем группам), `MenuPage.tsx:104`/`ProfilePage.tsx:112` (ключи без `groupId`), `selectors.ts:186` (`{ result, breakdown }` вместо плоского) — добавить `groupId` в `queryKeys.polls.active`/`last-completed`, фильтровать `useActivePoll` по `currentGroupId`, в `pollsService.getResults` разворачивать `.result` с типом `{ result: PollResult; breakdown: ... }`.
10. Фронтенд-экраны: `DishSheet.tsx:117` (поле «Категория» не сохраняется), `DebtManagementCard.tsx:36`/`FeedbackModal.tsx:25` (ошибки молча), `CreatePollSheet.tsx:343` (время не валидируется), `DonationModal.tsx:25` (`window.open` вместо `openLink`).
11. Эксплуатация: `deploy.yml:137` (откат поднимает позапрошлый релиз), `backup-db.sh:70` (пароль в argv → `PGPASSWORD`/`.pgpass`), `delete-group.ts:55` (CASCADE vs RESTRICT), `deploy-vps.sh:149` (prune убирает `prisma` из релиза), `docker-compose.production.yml:47` (не передаёт `JWT_SECRET` и др.).
12. `encryption.ts:129` — `decrypt` возвращает шифротекст при провале auth tag: бросать `DecryptionError`, наверху показывать «реквизиты недоступны», а не мусор.

## Этап C. Гигиена качества (→ ~92 %)

1. **6 красных серверных тестов** без `JWT_SECRET`: в `jest.unit.config.js` задать `setupFiles` с `process.env.JWT_SECRET = 'unit-test-secret-…64+ символов'`, чтобы `test:unit` был зелёным на любой машине.
2. **233 предупреждения `no-explicit-any`** без гейта: `--max-warnings` в `npm run lint` бэкенда на измеренном полу (233), затем снижать по 20 за задачу.
3. **Зависимости:** `react-router-dom` → 7.18.3 (закрывает 2 high фронта); для `mysql2` в дереве `prisma` — задокументированное исключение в `scripts/audit-production.mjs` рядом с `deepmerge-ts` (PostgreSQL, пакет не загружается в рантайме) либо ожидание релиза prisma с `mysql2 ≥ 3.22`.
4. **E2E-мок аутентификации** честный (см. Task 3, Step 5) — иначе smoke не ловит регрессию refresh.
5. **Интеграционный тест** на `findExpiredActivePolls` (сырой SQL) в CI-наборе с PostgreSQL.
6. **Secret scanning и push protection** в настройках GitHub (делается в веб-интерфейсе, PAT прав не имеет).

## Этап D. Решения владельца и инфраструктура (→ 95–98 %)

Без этих пяти пунктов из `RESIDUAL_RISKS.md` выше ~92 % честно не подняться: они про то, что не проверялось вживую.

1. **TZ и домены/webhook/`TRUST_PROXY`** — зафиксировать в `ecosystem.config.js` и `.env.production.example`, проверять при старте в `security-checks.ts`.
2. **Backup/restore прогнать на живом контейнере** той же версии PostgreSQL 16; записать RPO/RTO и ответственного в `BACKUP_RESTORE_GUIDE.md`.
3. **Staging-секреты для Telegram/Stars** и реальный E2E: неверный/верный webhook secret, повтор `update_id`, `pre_checkout_query`, дубль `successful_payment`.
4. **Transactional outbox** для уведомлений (`outbox_events` + воркер с retry/backoff/dead-letter): закрывает потерю уведомления при недоступности Telegram после фиксации транзакции. Это и есть разница между 95 и 98.
5. **Канал оповещений и дежурный** — watchdog и алерты уже есть (коммиты 2026-08-28), нужен адресат и регламент.

Последние 2–3 % — не код: месяц эксплуатации без инцидентов P1 в реальной группе, с наблюдением Sentry и метрик, и повтор аудита по непроверенному списку.

---

## Self-review

- **Покрытие блокеров:** 6 блокеров → Tasks 1–6; две системные находки medium → Tasks 7–8; выпуск и живая проверка → Task 9. Остальные 17 подтверждённых и 33 непроверенных — этапы A–B части 2, каждая с файлом и направлением фикса.
- **Плейсхолдеров нет:** каждый шаг с кодом содержит код; шаги «найти по grep» дают команду и критерий.
- **Согласованность имён:** `findExpiredActivePolls`/`cancelIfStillActive`/`ExpiredPollRow` (Task 2, Steps 1, 3, 4); `restoreActiveTimers`/`scheduleAfter` (Steps 6, 8, 9); `setRefreshToken`/`getRefreshToken` (Task 3, Steps 1, 3, 4); `isPaymentLink`/`paymentLinkButton`/`paymentCardLine` (Task 5, Steps 1, 3, 4, 5); `MaxSelectionsExceededError`/`SingleSelectionOnlyError` (Task 6) — совпадают.
- **Риск Task 2:** гонка восстановленного таймера и cron — оба идут через `completePoll` с `updateMany where status='ACTIVE'`, проигравший получает `PollAlreadyCompletedError`, который `completeByTimer` глотает. Двойного объявления в группу нет: `announceCompletion` вызывается только победителем цепочки внутри `completeByTimer` после успешного `completePoll`.
