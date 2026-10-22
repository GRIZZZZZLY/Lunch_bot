/**
 * Чтение голосований через НАСТОЯЩИЙ API: кто что видит.
 *
 * Голосования, голоса и итоги — данные команды. Правило одно: видит участник
 * группы САМОГО ресурса, а выборки «мои голосования» сужены до групп человека.
 * Модульные тесты контроллера проверяли это через подставной
 * `isUserGroupMember` и аргументы вызова сервиса, то есть фильтр ни разу не
 * выполнялся на настоящих строках.
 *
 * Все тесты здесь только читают, поэтому мир строится один раз на файл.
 * Redis не обязателен: чтения кэшируются, но и без кэша обязаны отвечать так же.
 */
import http from 'http';
import type { AddressInfo } from 'net';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember, tokenFor } from '../helpers/api';
import {
  type Client,
  completedPoll,
  dish,
  person,
  pollIn,
  signIn,
  team,
} from '../helpers/polls';

let app: ReturnType<typeof createTestApp>;

const TG = {
  anna: 701001,
  vera: 701002,
  oleg: 701003,
  lena: 701004,
  nina: 701005,
  boris: 701006,
  dina: 701007,
  egor: 701008,
} as const;

const MINUTE = 60_000;
const minutesAgo = (n: number) => new Date(Date.now() - n * MINUTE);

interface World {
  ids: Record<keyof typeof TG, number>;
  groupA: number;
  groupB: number;
  groupD: number;
  groupE: number;
  groupF: number;
  groupG: number;
  /** Завершённые голосования A, B и C: C — самое свежее, но Анне не видно. */
  doneA: number;
  doneB: number;
  doneC: number;
  /** Активные голосования A, B и C. */
  activeA: number;
  activeB: number;
  activeC: number;
  activeAStartedAt: Date;
  dishA1: number;
  dishE1: number;
  todayInD: number;
  oldInE: number;
  selectionPoll: number;
  emptySelectionPoll: number;
  brokenSelectionPoll: number;
  /** Егор выбрал e1 и ещё «пропускаю» — голос без блюда. */
  skipPoll: number;
}

/**
 * Анна — участница A и B (в A она CREATOR) и носит прежний глобальный флаг
 * `is_admin`: он не должен расширять ей выборку. Олег — админ чужой группы C
 * и тоже с флагом. Лена вышла из A. У Нины групп нет вовсе. Дина и Егор живут
 * в отдельных группах D, E, F, чтобы их голосования не попадали в выборки
 * Анны.
 */
async function buildWorld(): Promise<World> {
  const anna = await person(TG.anna, 'Анна', { isAdmin: true });
  const vera = await person(TG.vera, 'Вера');
  const oleg = await person(TG.oleg, 'Олег', { isAdmin: true });
  const lena = await person(TG.lena, 'Лена');
  const nina = await person(TG.nina, 'Нина');
  const boris = await person(TG.boris, 'Борис');
  const dina = await person(TG.dina, 'Дина');
  const egor = await person(TG.egor, 'Егор');

  const [a, b, c, d, e, f, g] = await Promise.all(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((title, i) => team(-1007001 - i, `Команда ${title}`))
  );

  await addMember(a.id, anna.id, 'CREATOR');
  await addMember(a.id, vera.id, 'MEMBER');
  await addMember(a.id, lena.id, 'MEMBER', { isActive: false, leftAt: new Date() });
  await addMember(b.id, anna.id, 'MEMBER');
  await addMember(b.id, boris.id, 'CREATOR');
  await addMember(c.id, oleg.id, 'CREATOR');
  for (const own of [d, e, f, g]) await addMember(own.id, dina.id, 'CREATOR');
  await addMember(e.id, egor.id, 'MEMBER');

  const a1 = await dish(a.id, anna.id, 'Борщ');
  const a2 = await dish(a.id, anna.id, 'Плов');
  const b1 = await dish(b.id, boris.id, 'Пицца');
  const c1 = await dish(c.id, oleg.id, 'Суши');
  const d1 = await dish(d.id, dina.id, 'Лагман');
  const e1 = await dish(e.id, dina.id, 'Харчо');
  const e2 = await dish(e.id, dina.id, 'Манты');

  const doneA = await completedPoll(a.id, anna.id, [[anna.id, a1.id], [vera.id, a2.id]], minutesAgo(3));
  const doneB = await completedPoll(b.id, boris.id, [[anna.id, b1.id]], minutesAgo(2));
  const doneC = await completedPoll(c.id, oleg.id, [[oleg.id, c1.id]], minutesAgo(1));

  const activeAStartedAt = minutesAgo(5);
  const activeA = await pollIn(a.id, anna.id, {
    startedAt: activeAStartedAt,
    expected: [anna.id, vera.id],
  });
  const activeB = await pollIn(b.id, boris.id);
  const activeC = await pollIn(c.id, oleg.id);

  /* Вчерашнее и сегодняшнее в D; в E — только давнее. 36 часов назад — это
     «не сегодня» в любом часовом поясе сервера. */
  await completedPoll(d.id, dina.id, [[dina.id, d1.id]], minutesAgo(36 * 60));
  const todayInD = await completedPoll(d.id, dina.id, [[dina.id, d1.id]], minutesAgo(5));
  const oldInE = await completedPoll(e.id, dina.id, [[dina.id, e1.id]], minutesAgo(36 * 60));

  /* Голоса вне сохранённого состава остались от старых данных: экран
     голосования не должен их показывать. Отменённые, чтобы не мешать
     «завершённому сегодня». */
  const selectionPoll = await pollIn(e.id, dina.id, {
    status: 'CANCELLED',
    endedAt: new Date(),
    selectedMenuItemIds: JSON.stringify([e1.id]),
  });
  const emptySelectionPoll = await pollIn(e.id, dina.id, {
    status: 'CANCELLED',
    endedAt: new Date(),
    selectedMenuItemIds: '[]',
  });
  const brokenSelectionPoll = await pollIn(e.id, dina.id, {
    status: 'CANCELLED',
    endedAt: new Date(),
    selectedMenuItemIds: '{not json',
  });
  for (const pollId of [selectionPoll.id, emptySelectionPoll.id, brokenSelectionPoll.id]) {
    await prisma.vote.createMany({
      data: [
        { pollId, userId: dina.id, menuItemId: e1.id },
        { pollId, userId: egor.id, menuItemId: e2.id },
      ],
    });
  }
  const skipPoll = await pollIn(e.id, dina.id, { status: 'CANCELLED', endedAt: new Date() });
  await prisma.vote.createMany({
    data: [
      { pollId: skipPoll.id, userId: egor.id, menuItemId: e1.id },
      { pollId: skipPoll.id, userId: egor.id, menuItemId: null, voteType: 'SKIP' },
    ],
  });

  /* Строки ACTIVE, у которых срок вышел, а планировщик их не закрыл: в F —
     по таймеру, в G — по проставленному endedAt. На экране их быть не должно. */
  await pollIn(f.id, dina.id, { startedAt: minutesAgo(120), duration: 30 });
  await pollIn(g.id, dina.id, { startedAt: minutesAgo(5), endedAt: minutesAgo(1) });

  return {
    ids: { anna: anna.id, vera: vera.id, oleg: oleg.id, lena: lena.id, nina: nina.id, boris: boris.id, dina: dina.id, egor: egor.id },
    groupA: a.id,
    groupB: b.id,
    groupD: d.id,
    groupE: e.id,
    groupF: f.id,
    groupG: g.id,
    doneA: doneA.id,
    doneB: doneB.id,
    doneC: doneC.id,
    activeA: activeA.id,
    activeB: activeB.id,
    activeC: activeC.id,
    activeAStartedAt,
    dishA1: a1.id,
    dishE1: e1.id,
    todayInD: todayInD.id,
    oldInE: oldInE.id,
    selectionPoll: selectionPoll.id,
    emptySelectionPoll: emptySelectionPoll.id,
    brokenSelectionPoll: brokenSelectionPoll.id,
    skipPoll: skipPoll.id,
  };
}

let w: World;
const as = {} as Record<keyof typeof TG, Client>;

beforeAll(async () => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
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

const ids = (rows: Array<{ id: number }>) => rows.map(row => row.id).sort((x, y) => x - y);
const sorted = (...values: number[]) => [...values].sort((x, y) => x - y);

describe('чтение голосований — только участникам группы ресурса', () => {
  /* Каждое чтение группы A. Олег — админ ДРУГОЙ группы с прежним глобальным
     флагом (раньше флаг открывал всё), Лена вышла из A. */
  const READS: Array<[string, (world: World) => string]> = [
    ['GET /:id', x => `/api/polls/${x.doneA}`],
    ['GET /:id/results', x => `/api/polls/${x.doneA}/results`],
    ['GET /:id/votes', x => `/api/polls/${x.doneA}/votes`],
    ['GET /:id/my-votes', x => `/api/polls/${x.doneA}/my-votes`],
    ['GET /active/:groupId', x => `/api/polls/active/${x.groupA}`],
    ['GET /today-completed/:groupId', x => `/api/polls/today-completed/${x.groupA}`],
    ['GET /popular-items', x => `/api/polls/popular-items?groupId=${x.groupA}`],
    ['GET /history', x => `/api/polls/history?groupId=${x.groupA}`],
    ['GET /', x => `/api/polls?groupId=${x.groupA}`],
    ['GET /last-completed', x => `/api/polls/last-completed?groupId=${x.groupA}`],
    ['GET /stats', x => `/api/polls/stats?groupId=${x.groupA}`],
    ['GET /active', x => `/api/polls/active?groupId=${x.groupA}`],
  ];

  it.each(READS)('%s: участнику 200, постороннему и вышедшему 403', async (_name, url) => {
    expect((await as.anna.get(url(w))).status).toBe(200);

    for (const stranger of [as.oleg, as.lena]) {
      const response = await stranger.get(url(w));
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    }
  });
});

describe('область выборки: только мои группы', () => {
  /* [BUG] Флаг users.is_admin когда-то снимал фильтр целиком, и «мои
     голосования» отдавали голосования всех команд сервиса. */
  it('без groupId видны голосования групп человека, и флаг is_admin выборку не расширяет', async () => {
    const active = await as.anna.get('/api/polls/active').expect(200);
    expect(ids(active.body.data)).toEqual(sorted(w.activeA, w.activeB));

    const history = await as.anna.get('/api/polls/history').expect(200);
    expect(ids(history.body.data.polls)).toEqual(sorted(w.doneA, w.doneB));
    expect(history.body.data.total).toBe(2);

    /* Самое свежее завершённое — в чужой группе C; его здесь быть не должно. */
    const last = await as.anna.get('/api/polls/last-completed').expect(200);
    expect(last.body.data.id).toBe(w.doneB);

    const stats = await as.anna.get('/api/polls/stats').expect(200);
    expect(stats.body.data).toMatchObject({ totalPolls: 4, activePolls: 2, completedPolls: 2 });
  });

  /* [BUG] Главная брала первый элемент списка активных и показывала
     голосование не той команды, которая выбрана. */
  it('?groupId сужает выборку до одной группы', async () => {
    const active = await as.anna.get(`/api/polls/active?groupId=${w.groupA}`).expect(200);
    expect(ids(active.body.data)).toEqual([w.activeA]);

    const history = await as.anna.get(`/api/polls/history?groupId=${w.groupA}`).expect(200);
    expect(ids(history.body.data.polls)).toEqual([w.doneA]);

    const last = await as.anna.get(`/api/polls/last-completed?groupId=${w.groupA}`).expect(200);
    expect(last.body.data.id).toBe(w.doneA);

    const stats = await as.anna.get(`/api/polls/stats?groupId=${w.groupA}`).expect(200);
    expect(stats.body.data).toMatchObject({ totalPolls: 2, completedPolls: 1 });
  });

  /* Пустой список групп и «фильтра нет» — разные вещи: первое значит
     «ничего», второе значило «всё». */
  it('человек без групп получает пустые выборки, а не все голосования', async () => {
    const active = await as.nina.get('/api/polls/active').expect(200);
    expect(active.body.data).toEqual([]);

    const history = await as.nina.get('/api/polls/history').expect(200);
    expect(history.body.data).toMatchObject({ polls: [], total: 0 });

    const last = await as.nina.get('/api/polls/last-completed').expect(200);
    expect(last.body.data).toBeNull();

    const stats = await as.nina.get('/api/polls/stats').expect(200);
    expect(stats.body.data).toMatchObject({ totalPolls: 0, completedPolls: 0 });
  });
});

describe('что показывают экраны', () => {
  /* Приоритет проставленного endedAt проверяет polls-lifecycle.redis: с ним
     ответ из кэша падает, и это видно только на настоящем Redis. */
  it('у активного голосования есть время окончания: начало плюс длительность', async () => {
    const response = await as.anna.get(`/api/polls/active?groupId=${w.groupA}`).expect(200);

    expect(response.body.data[0].endTime).toBe(
      new Date(w.activeAStartedAt.getTime() + 30 * MINUTE).toISOString()
    );
  });

  it.each([
    ['состав из одного блюда — только голоса за него', (x: World) => x.selectionPoll, 1],
    ['пустой состав — фильтра нет', (x: World) => x.emptySelectionPoll, 2],
    ['битый состав — голоса не прячутся и ответ не падает', (x: World) => x.brokenSelectionPoll, 2],
  ])('голосование показывает голоса своего состава: %s', async (_name, poll, count) => {
    const response = await as.dina.get(`/api/polls/${poll(w)}`).expect(200);

    const items = response.body.data.votes.map((v: { menuItemId: number }) => v.menuItemId);
    expect(items).toHaveLength(count);
    expect(items).toContain(w.dishE1);
  });

  /* [BUG] Голос сохранялся, а Mini App о нём не узнавала: строка талона
     оставалась невыбранной. */
  it('my-votes отдаёт только свои блюда; кто не голосовал — пустой список', async () => {
    const mine = await as.anna.get(`/api/polls/${w.doneA}/my-votes`).expect(200);
    expect(mine.body.data.menuItemIds).toEqual([w.dishA1]);

    const none = await as.anna.get(`/api/polls/${w.activeA}/my-votes`).expect(200);
    expect(none.body.data.menuItemIds).toEqual([]);
  });

  it('my-votes: голос «пропускаю» без блюда в список не попадает', async () => {
    const response = await as.egor.get(`/api/polls/${w.skipPoll}/my-votes`).expect(200);

    expect(response.body.data.menuItemIds).toEqual([w.dishE1]);
  });

  it('завершённое сегодня, а если сегодня ничего — последнее завершённое', async () => {
    const today = await as.dina.get(`/api/polls/today-completed/${w.groupD}`).expect(200);
    expect(today.body.data.id).toBe(w.todayInD);

    const fallback = await as.dina.get(`/api/polls/today-completed/${w.groupE}`).expect(200);
    expect(fallback.body.data.id).toBe(w.oldInE);
  });

  /* `data: null` рядом с кодом читает фронт. Строка ACTIVE с истёкшим сроком
     — мусор от пропущенного тика, а не идущее голосование. */
  it.each([
    ['активного нет', (x: World) => x.groupD],
    ['у строки ACTIVE вышел срок по таймеру', (x: World) => x.groupF],
    ['у строки ACTIVE проставлен endedAt в прошлом', (x: World) => x.groupG],
  ])('активное голосование группы: %s — 404 NO_ACTIVE_POLL', async (_name, group) => {
    const response = await as.dina.get(`/api/polls/active/${group(w)}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NO_ACTIVE_POLL');
    expect(response.body.data).toBeNull();
  });

  it('у идущего голосования итогов ещё нет — 404 RESULTS_NOT_FOUND', async () => {
    const response = await as.anna.get(`/api/polls/${w.activeA}/results`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('RESULTS_NOT_FOUND');
  });
});

describe('статистика участия', () => {
  it('своя статистика считается по токену, ?userId чужого игнорируется', async () => {
    const response = await as.anna.get(`/api/polls/user-stats/my?userId=${w.ids.vera}`).expect(200);

    // У Анны два голоса (A и B), у Веры один.
    expect(response.body.data.totalVotes).toBe(2);
  });

  /* Право на чужую статистику даёт роль в группе, и оба условия обязательны:
     вызывающий администрирует группу И человек в ней состоит. Прежний guard
     проверял только первое — админ любой группы читал статистику любого
     пользователя, прислав свой groupId. */
  it.each([
    ['админ A о человеке из A', 200, 'anna', 'vera', 'groupA'],
    ['админ A о человеке не из A', 403, 'anna', 'boris', 'groupA'],
    ['рядовой участник B о человеке из B', 403, 'anna', 'boris', 'groupB'],
    ['рядовой участник A об админе A', 403, 'vera', 'anna', 'groupA'],
  ] as const)('%s — %i', async (_name, status, actor, target, group) => {
    const response = await as[actor].get(
      `/api/polls/user-stats/${w.ids[target]}?groupId=${w[group]}`
    );

    expect(response.status).toBe(status);
    if (status === 200) expect(response.body.data.totalVotes).toBe(1);
  });
});

describe('GET /api/polls/:pollId/stream — кто может подключиться', () => {
  /** Открыть поток, дождаться заголовков и сразу оборвать. */
  async function openStream(url: string, token: string) {
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      return await new Promise<{ status?: number; type?: string }>((resolve, reject) => {
        const req = http.get(
          { port, path: url, headers: { Authorization: `Bearer ${token}` } },
          res => {
            resolve({ status: res.statusCode, type: res.headers['content-type'] });
            req.destroy();
          }
        );
        req.on('error', reject);
      });
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }

  it('участник группы получает поток событий', async () => {
    const opened = await openStream(`/api/polls/${w.activeA}/stream`, await tokenFor(app, TG.anna));

    expect(opened.status).toBe(200);
    expect(opened.type).toMatch(/^text\/event-stream/);
  });

  /* [BUG] Прежний глобальный флаг is_admin пускал в поток любой группы. */
  it.each([
    ['админ чужой группы с флагом is_admin', 'oleg'],
    ['вышедший из группы', 'lena'],
  ] as const)('%s — 403', async (_name, who) => {
    const response = await as[who].get(`/api/polls/${w.activeA}/stream`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('неизвестное голосование — 404', async () => {
    const response = await as.anna.get(`/api/polls/${w.activeC + 100000}/stream`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('POLL_NOT_FOUND');
  });
});
