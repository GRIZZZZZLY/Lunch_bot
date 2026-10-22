/**
 * Голос через НАСТОЯЩИЙ API: право голоса, пределы выбора, снятие голоса,
 * автозакрытие по кворуму и XP.
 *
 * Mini App голосует через `POST /api/polls/:id/vote` и снимает голос через
 * `DELETE /api/polls/:id/vote` (frontend-new/src/hooks/usePolls.ts), поэтому
 * правила проверяются на них. Пределы выбора живут только в
 * `/api/polls/:id/vote-multiple`. Второй API (`/api/votes/*`) никто в
 * frontend-new и в боте не вызывает; для него здесь одна тонкая проверка, что
 * правило членства у него то же.
 *
 * Модульные тесты проверяли эти правила через подставную Prisma и мёртвый
 * `VoteService.createVote`, у которого нет ни одного вызова в приложении.
 *
 * ОКРУЖЕНИЕ. Нужен настоящий Redis: маршруты голоса объявлены `required: true`
 * в middleware идемпотентности и без хранилища отвечают 503.
 */
import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember } from '../helpers/api';
import {
  type Client,
  type PollSetup,
  completedPoll,
  dish,
  person,
  pollIn,
  signIn,
  team,
} from '../helpers/polls';

let app: ReturnType<typeof createTestApp>;

const TG = {
  ann: 703001,
  mike: 703002,
  kate: 703003,
  rita: 703004,
  lena: 703005,
  oleg: 703006,
} as const;

interface World {
  ids: Record<keyof typeof TG, number>;
  groupA: number;
  /** Блюда A из состава голосования. */
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  /** Блюдо A, которого нет в составе голосования. */
  outside: number;
  /** Выключенное блюдо A — в составе есть. */
  disabled: number;
  /** Блюдо чужой группы B — в составе есть, чтобы отказ шёл по группе. */
  foreign: number;
}

/**
 * Энн и Майк — участники A, Катя отказалась от обедов, Рита вступила уже после
 * начала голосования, Лена была в снимке, но вышла из группы. Олег — админ
 * чужой группы B с прежним глобальным флагом is_admin.
 */
async function buildWorld(): Promise<World> {
  const ann = await person(TG.ann, 'Энн');
  const mike = await person(TG.mike, 'Майк');
  const kate = await person(TG.kate, 'Катя');
  const rita = await person(TG.rita, 'Рита');
  const lena = await person(TG.lena, 'Лена');
  const oleg = await person(TG.oleg, 'Олег', { isAdmin: true });

  const a = await team(-1007201, 'Команда A');
  const b = await team(-1007202, 'Команда B');
  await addMember(a.id, ann.id, 'CREATOR');
  await addMember(a.id, mike.id, 'MEMBER');
  await addMember(a.id, kate.id, 'MEMBER', { participatesInPolls: false });
  await addMember(a.id, rita.id, 'MEMBER');
  await addMember(a.id, lena.id, 'MEMBER', { isActive: false, leftAt: new Date() });
  await addMember(b.id, oleg.id, 'CREATOR');

  const names = ['Борщ', 'Плов', 'Лагман', 'Харчо'];
  const [d1, d2, d3, d4] = await Promise.all(names.map(name => dish(a.id, ann.id, name)));
  const outside = await dish(a.id, ann.id, 'Окрошка');
  const disabled = await dish(a.id, ann.id, 'Солянка', { isActive: false });
  const foreign = await dish(b.id, oleg.id, 'Пицца');

  return {
    ids: { ann: ann.id, mike: mike.id, kate: kate.id, rita: rita.id, lena: lena.id, oleg: oleg.id },
    groupA: a.id,
    d1: d1.id,
    d2: d2.id,
    d3: d3.id,
    d4: d4.id,
    outside: outside.id,
    disabled: disabled.id,
    foreign: foreign.id,
  };
}

/**
 * Голосование в A. По умолчанию ждут Энн, Майка и Лену (Лена не сможет
 * проголосовать, поэтому кворум не соберётся сам), Катя — EXCLUDED, Риты в
 * снимке нет.
 */
function pollInA(setup: PollSetup = {}) {
  return pollIn(w.groupA, w.ids.ann, {
    expected: [w.ids.ann, w.ids.mike, w.ids.lena],
    excluded: [w.ids.kate],
    selectedMenuItemIds: JSON.stringify([w.d1, w.d2, w.d3, w.d4, w.disabled, w.foreign]),
    ...setup,
  });
}

async function votesOf(pollId: number, userId?: number): Promise<number[]> {
  const rows = await prisma.vote.findMany({ where: { pollId, userId } });
  return rows.map(row => row.menuItemId!).sort((x, y) => x - y);
}

const sorted = (...values: number[]) => [...values].sort((x, y) => x - y);

/** Блюда, за которые начислен XP за голос в этом голосовании. */
async function votedXp(pollId: number, userId: number): Promise<number[]> {
  const rows = await prisma.xPHistory.findMany({ where: { userId } });
  return rows
    .map(row => JSON.parse(row.metadata ?? '{}') as { pollId?: number; menuItemId?: number })
    .filter(meta => meta.pollId === pollId && meta.menuItemId !== undefined)
    .map(meta => meta.menuItemId!)
    .sort((x, y) => x - y);
}

async function statusOf(pollId: number): Promise<string> {
  return (await prisma.poll.findUniqueOrThrow({ where: { id: pollId } })).status;
}

/**
 * Остановить часы на заданном моменте. Подменяется только `Date`: таймеры
 * идут как обычно, иначе встали бы тайм-ауты библиотек.
 */
async function atMoment<T>(moment: Date, work: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({
    now: moment,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
  try {
    return await work();
  } finally {
    jest.useRealTimers();
  }
}

let w: World;
const as = {} as Record<keyof typeof TG, Client>;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  w = await buildWorld();
  for (const name of Object.keys(TG) as Array<keyof typeof TG>) {
    as[name] = await signIn(app, TG[name]);
  }
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('право голоса: POST /api/polls/:id/vote', () => {
  type Row = [
    string,
    keyof typeof TG,
    PollSetup,
    (x: World) => number,
    number,
    string,
  ];
  const minuteAgo = new Date(Date.now() - 60_000);

  const REFUSALS: Row[] = [
    /* Закрытые строки без endedAt (старые данные): отказать должен статус, а
       не прошедший срок — иначе правило о статусе ничем не проверяется. */
    ['голосование завершено', 'ann', { status: 'COMPLETED' }, x => x.d1, 400, 'POLL_ERROR'],
    ['голосование отменено', 'ann', { status: 'CANCELLED' }, x => x.d1, 400, 'POLL_ERROR'],
    ['срок голосования (endedAt) прошёл', 'ann', { endedAt: minuteAgo }, x => x.d1, 400, 'POLL_ERROR'],
    ['не участник группы, хоть и с флагом is_admin', 'oleg', {}, x => x.d1, 403, 'FORBIDDEN'],
    ['вышел из группы, хотя был в снимке', 'lena', {}, x => x.d1, 403, 'FORBIDDEN'],
    ['отказался от обедов (EXCLUDED)', 'kate', {}, x => x.d1, 400, 'POLL_ERROR'],
    ['вступил после начала, в снимке его нет', 'rita', {}, x => x.d1, 400, 'POLL_ERROR'],
    ['блюдо не из состава голосования', 'ann', {}, x => x.outside, 400, 'POLL_ERROR'],
    ['блюдо чужой группы', 'ann', {}, x => x.foreign, 400, 'POLL_ERROR'],
    ['выключенное блюдо', 'ann', {}, x => x.disabled, 400, 'POLL_ERROR'],
    ['битый состав блюд не открывает голос за что угодно', 'ann', { selectedMenuItemIds: '{not json' }, x => x.d1, 400, 'POLL_ERROR'],
    ['состав блюд оказался не массивом', 'ann', { selectedMenuItemIds: '{"id":1}' }, x => x.d1, 400, 'POLL_ERROR'],
  ];

  it.each(REFUSALS)('%s — отказ, голоса в базе нет', async (_name, actor, setup, item, status, code) => {
    const poll = await pollInA(setup);

    const response = await as[actor].post(`/api/polls/${poll.id}/vote`, { menuItemId: item(w) });

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    expect(await votesOf(poll.id)).toEqual([]);
  });

  it('участник из снимка голосует; новый голос заменяет прежний', async () => {
    const poll = await pollInA();

    const first = await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);
    expect(first.body.data.menuItemId).toBe(w.d1);
    expect(await votesOf(poll.id)).toEqual([w.d1]);

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d2 }).expect(200);
    expect(await votesOf(poll.id)).toEqual([w.d2]);
  });

  it('ровно в момент окончания голос ещё принимается', async () => {
    const deadline = new Date(Date.now() + 60_000);
    const poll = await pollInA({ endedAt: deadline });

    const response = await atMoment(deadline, () =>
      as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 })
    );

    expect(response.status).toBe(200);
    expect(await votesOf(poll.id)).toEqual([w.d1]);
  });

  it.failing('после срока по таймеру (начало плюс длительность) голос не принимается', async () => {
    // BUG: право голоса смотрит только на endedAt, а у идущего голосования он пуст; срок startedAt + duration не проверяется, и голос принимается, пока планировщик не закрыл строку.
    const poll = await pollInA({ startedAt: new Date(Date.now() - 60 * 60_000), duration: 30 });

    const response = await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 });

    expect(response.status).toBe(400);
    expect(await votesOf(poll.id)).toEqual([]);
  });
});

describe('пределы выбора: POST /api/polls/:id/vote-multiple', () => {
  type Step = [(x: World) => number[], number, string?];
  type Row = [string, PollSetup, Step[], (x: World) => number[]];

  const LIMITS: Row[] = [
    ['дубликаты в запросе схлопываются', {}, [[x => [x.d1, x.d1, x.d2], 200]], x => [x.d1, x.d2]],
    /* [BUG] Лимит считался по запросу: повторный vote-multiple с другими
       блюдами добирал голоса сверх maxSelections. */
    [
      'уже поданные голоса входят в предел',
      { maxSelections: 2 },
      [[x => [x.d1, x.d2], 200], [x => [x.d3], 400, 'MAX_SELECTIONS_EXCEEDED']],
      x => [x.d1, x.d2],
    ],
    [
      'повтор уже поданных блюд предел не съедает',
      { maxSelections: 3 },
      [[x => [x.d1, x.d2], 200], [x => [x.d1, x.d2, x.d3], 200]],
      x => [x.d1, x.d2, x.d3],
    ],
    [
      'одиночный выбор: два блюда сразу — отказ',
      { isMultiSelect: false, maxSelections: 1 },
      [[x => [x.d1, x.d2], 400, 'SINGLE_SELECTION_ONLY']],
      () => [],
    ],
    /* [BUG] Одиночный режим обходился по одному блюду за запрос. */
    [
      'одиночный выбор: второе блюдо отдельным запросом — отказ',
      { isMultiSelect: false, maxSelections: 1 },
      [[x => [x.d1], 200], [x => [x.d2], 400, 'SINGLE_SELECTION_ONLY']],
      x => [x.d1],
    ],
    [
      'maxSelections больше трёх всё равно ограничен тремя',
      { maxSelections: 5 },
      [[x => [x.d1, x.d2, x.d3, x.d4], 400, 'MAX_SELECTIONS_EXCEEDED']],
      () => [],
    ],
  ];

  it.each(LIMITS)('%s', async (_name, setup, steps, finalVotes) => {
    const poll = await pollInA(setup);

    for (const [items, status, code] of steps) {
      const response = await as.ann.post(`/api/polls/${poll.id}/vote-multiple`, { menuItemIds: items(w) });
      expect(response.status).toBe(status);
      if (code) expect(response.body.code).toBe(code);
    }

    expect(await votesOf(poll.id)).toEqual(sorted(...finalVotes(w)));
  });
});

describe('XP за голос', () => {
  it('начисляется один раз на блюдо: повторная подача его не удваивает', async () => {
    const poll = await pollInA();
    const vote = (items: number[]) =>
      as.ann.post(`/api/polls/${poll.id}/vote-multiple`, { menuItemIds: items }).expect(200);

    await vote([w.d1]);
    await vote([w.d1]);
    await vote([w.d1, w.d2]);

    expect(await votedXp(poll.id, w.ids.ann)).toEqual(sorted(w.d1, w.d2));
  });

  it.failing('голос через POST /vote — тот, что шлёт Mini App, — тоже даёт XP', async () => {
    // BUG: upsertVote не начисляет XP вовсе, а XP за голос дают только vote-multiple и /api/votes/multiple, которые фронт не вызывает.
    const poll = await pollInA();

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);

    expect(await votedXp(poll.id, w.ids.ann)).toEqual([w.d1]);
  });
});

describe('снятие голоса: DELETE /api/polls/:id/vote', () => {
  it('снимаются только свои голоса', async () => {
    const poll = await pollInA();
    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);
    await as.mike.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d2 }).expect(200);

    await as.ann.delete(`/api/polls/${poll.id}/vote`).expect(200);

    expect(await votesOf(poll.id, w.ids.ann)).toEqual([]);
    expect(await votesOf(poll.id, w.ids.mike)).toEqual([w.d2]);
  });

  /* [BUG] Собственный catch сервиса подменял причину на общую ошибку, и
     «голосование уже закрыто» доезжало до клиента как 500. */
  it('из завершённого голосования голос не снять — 400 POLL_ERROR, голоса на месте', async () => {
    const poll = await completedPoll(w.groupA, w.ids.ann, [[w.ids.ann, w.d1], [w.ids.mike, w.d2]]);

    const response = await as.ann.delete(`/api/polls/${poll.id}/vote`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('POLL_ERROR');
    expect(await votesOf(poll.id)).toEqual(sorted(w.d1, w.d2));
  });

  /* Голос и его снятие закрыты тем же членством, что и одиночный голос. */
  it.each([
    ['vote-multiple', (c: Client, pollId: number, x: World) => c.post(`/api/polls/${pollId}/vote-multiple`, { menuItemIds: [x.d2] })],
    ['DELETE vote', (c: Client, pollId: number) => c.delete(`/api/polls/${pollId}/vote`)],
  ])('%s: посторонний получает 403, голоса не меняются', async (_name, call) => {
    const poll = await pollInA();
    await prisma.vote.create({ data: { pollId: poll.id, userId: w.ids.oleg, menuItemId: w.d1 } });

    const response = await call(as.oleg, poll.id, w);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await votesOf(poll.id)).toEqual([w.d1]);
  });

  it('неизвестное голосование — 404', async () => {
    const response = await as.ann.delete('/api/polls/999999/vote');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('POLL_NOT_FOUND');
  });
});

describe('автозакрытие по кворуму', () => {
  /* Каждый голосует за своё блюдо: тогда у категории заказа один участник, и
     ответственный назначается сразу, без трёхминутного таймера добровольцев. */
  it('частичный голос оставляет голосование открытым, голос последнего ожидаемого закрывает его', async () => {
    const poll = await pollInA({ expected: [w.ids.ann, w.ids.mike] });

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);
    expect(await statusOf(poll.id)).toBe('ACTIVE');
    expect(await prisma.pollResult.count({ where: { pollId: poll.id } })).toBe(0);

    await as.mike.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d2 }).expect(200);
    expect(await statusOf(poll.id)).toBe('COMPLETED');

    const results = await prisma.pollResult.findMany({ where: { pollId: poll.id } });
    expect(results).toHaveLength(1);
    const winners = JSON.parse(results[0].rouletteData!).winners.map((x: { menuItemId: number }) => x.menuItemId);
    expect(winners.sort()).toEqual(sorted(w.d1, w.d2));
  });

  /* [BUG] Голосование закрывалось после ОДНОГО голоса: ожидаемое число
     бралось из истории и Telegram API (=1), а не из снимка участников. */
  it('голос одного из четырёх ожидаемых голосование не закрывает', async () => {
    const extra = await Promise.all([person(703011, 'Ира'), person(703012, 'Юра')]);
    for (const user of extra) await addMember(w.groupA, user.id, 'MEMBER');
    const poll = await pollInA({ expected: [w.ids.ann, w.ids.mike, ...extra.map(u => u.id)] });

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);

    expect(await statusOf(poll.id)).toBe('ACTIVE');
  });

  it('голос того, кого не ждали, не подменяет голос ожидаемого', async () => {
    const poll = await pollInA({ expected: [w.ids.ann, w.ids.mike] });
    // Голос Риты остался от старых данных: её в снимке нет.
    await prisma.vote.create({ data: { pollId: poll.id, userId: w.ids.rita, menuItemId: w.d2 } });

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);

    expect(await statusOf(poll.id)).toBe('ACTIVE');
  });

  it('выключенное в группе автозавершение голосование не закрывает', async () => {
    await prisma.group.update({
      where: { id: w.groupA },
      data: { settings: JSON.stringify({ autoCompleteEnabled: false, notificationsEnabled: true }) },
    });
    const poll = await pollInA({ expected: [w.ids.ann, w.ids.mike] });

    await as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200);
    await as.mike.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d2 }).expect(200);

    expect(await statusOf(poll.id)).toBe('ACTIVE');
  });

  it('два последних голоса одновременно дают один итог', async () => {
    const poll = await pollInA({ expected: [w.ids.ann, w.ids.mike] });

    await Promise.all([
      as.ann.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d1 }).expect(200),
      as.mike.post(`/api/polls/${poll.id}/vote`, { menuItemId: w.d2 }).expect(200),
    ]);

    expect(await statusOf(poll.id)).toBe('COMPLETED');
    expect(await prisma.pollResult.count({ where: { pollId: poll.id } })).toBe(1);
  });
});

describe('второй API голосования /api/votes/* — то же правило членства', () => {
  it('участник голосует и через него', async () => {
    const poll = await pollInA();

    await as.ann.post('/api/votes/multiple', { pollId: poll.id, menuItemIds: [w.d1] }).expect(200);

    expect(await votesOf(poll.id)).toEqual([w.d1]);
  });

  /* [BUG] Прежний глобальный флаг is_admin открывал чтение чужих голосов. */
  it.each([
    ['POST /multiple', (c: Client, pollId: number, x: World) => c.post('/api/votes/multiple', { pollId, menuItemIds: [x.d2] })],
    ['GET /:pollId/user', (c: Client, pollId: number) => c.get(`/api/votes/${pollId}/user`)],
    ['DELETE /:pollId/item/:menuItemId', (c: Client, pollId: number, x: World) => c.delete(`/api/votes/${pollId}/item/${x.d1}`)],
  ])('%s: посторонний с флагом is_admin получает 403, голоса не меняются', async (_name, call) => {
    const poll = await pollInA();
    await prisma.vote.create({ data: { pollId: poll.id, userId: w.ids.ann, menuItemId: w.d1 } });

    const response = await call(as.oleg, poll.id, w);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await votesOf(poll.id)).toEqual([w.d1]);
  });
});
