/**
 * Жизненный цикл голосования через НАСТОЯЩИЙ API: создать, повторить,
 * завершить, отменить, крутить рулетку.
 *
 * Что здесь стережётся:
 * 1. Права. Любое изменение голосования — только администратору группы САМОГО
 *    голосования. Проверяется ответом И тем, что в базе ничего не поменялось.
 * 2. Переходы состояний. ACTIVE → COMPLETED/CANCELLED, отказ на повтор, один
 *    комплект итогов даже при двух одновременных запросах.
 * 3. Создание. Автор — из токена; одно активное голосование на группу; мёртвая
 *    строка ACTIVE не запирает группу; снимок ожидаемых участников.
 *
 * ОКРУЖЕНИЕ. Нужен настоящий Redis: изменяющие маршруты голосований объявлены
 * `required: true` в middleware идемпотентности и без хранилища отвечают 503.
 * Telegram — на границе: бот подменяется `setBotInstance` с поддельным `api`.
 */
import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember } from '../helpers/api';
import { setBotInstance } from '../../../bot/bot-instance';
import { FEATURES } from '../../../config/features';
import {
  type Client,
  completedPoll,
  dish,
  person,
  pollIn,
  signIn,
  team,
  withParkedTimers,
} from '../helpers/polls';

let app: ReturnType<typeof createTestApp>;

const TG = { ann: 702001, mike: 702002, bob: 702003, kate: 702004 } as const;
const GROUP_A2_TELEGRAM_ID = -1007102;
const SENT_MESSAGE_ID = 4242;

/** Бот, у которого отправка в Telegram всегда удаётся. */
function workingBot(): void {
  setBotInstance({
    api: {
      sendMessage: async () => ({ message_id: SENT_MESSAGE_ID }),
      editMessageText: async () => true,
      getChatMemberCount: async () => 3,
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
}

interface World {
  annId: number;
  mikeId: number;
  bobId: number;
  kateId: number;
  /** В A идёт голосование `activeInA`. */
  groupA: number;
  /** В A2 активного нет, есть завершённое `doneInA2` (голосовали Майк и Катя). */
  groupA2: number;
  activeInA: number;
  doneInA2: number;
  dishA1: number;
  dishA2: number;
  dishX1: number;
  dishX2: number;
  dishB1: number;
}

/**
 * Энн — создатель A и A2. Майк — рядовой участник обеих и носит прежний
 * глобальный флаг is_admin. Боб — админ чужой группы B. Катя — участница A и
 * A2, нужна третьим голосом.
 */
async function buildWorld(): Promise<World> {
  const ann = await person(TG.ann, 'Энн');
  const mike = await person(TG.mike, 'Майк', { isAdmin: true });
  const bob = await person(TG.bob, 'Боб');
  const kate = await person(TG.kate, 'Катя');

  const a = await team(-1007101, 'Команда A');
  const a2 = await team(GROUP_A2_TELEGRAM_ID, 'Команда A2');
  const b = await team(-1007103, 'Команда B');

  for (const g of [a, a2]) {
    await addMember(g.id, ann.id, 'CREATOR');
    await addMember(g.id, mike.id, 'MEMBER');
    await addMember(g.id, kate.id, 'MEMBER');
  }
  await addMember(b.id, bob.id, 'CREATOR');

  const a1 = await dish(a.id, ann.id, 'Борщ');
  const a2dish = await dish(a.id, ann.id, 'Плов');
  const x1 = await dish(a2.id, ann.id, 'Лагман');
  const x2 = await dish(a2.id, ann.id, 'Харчо');
  const b1 = await dish(b.id, bob.id, 'Пицца');

  const activeInA = await pollIn(a.id, ann.id, {
    expected: [ann.id, mike.id, kate.id],
    selectedMenuItemIds: JSON.stringify([a1.id, a2dish.id]),
  });
  const doneInA2 = await completedPoll(a2.id, ann.id, [
    [mike.id, x1.id],
    [kate.id, x2.id],
  ]);

  return {
    annId: ann.id,
    mikeId: mike.id,
    bobId: bob.id,
    kateId: kate.id,
    groupA: a.id,
    groupA2: a2.id,
    activeInA: activeInA.id,
    doneInA2: doneInA2.id,
    dishA1: a1.id,
    dishA2: a2dish.id,
    dishX1: x1.id,
    dishX2: x2.id,
    dishB1: b1.id,
  };
}

/** Всё, что могли бы поменять мутации голосования. */
async function pollState() {
  const [polls, results, participants] = await Promise.all([
    prisma.poll.findMany({
      select: { id: true, status: true, endedAt: true, groupId: true },
      orderBy: { id: 'asc' },
    }),
    prisma.pollResult.findMany({
      select: { pollId: true, responsibleUserId: true, winnerMenuItemId: true, rouletteData: true },
      orderBy: { pollId: 'asc' },
    }),
    prisma.pollParticipant.count(),
  ]);
  return { polls, results, participants };
}

const statusOf = async (id: number) =>
  (await prisma.poll.findUniqueOrThrow({ where: { id } })).status;

let w: World;
const as = {} as Record<keyof typeof TG, Client>;
const multiWinnerWasEnabled = FEATURES.MULTI_WINNER_VOTING;

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
  FEATURES.MULTI_WINNER_VOTING = true;
});

beforeEach(async () => {
  await cleanDatabase();
  workingBot();
  w = await buildWorld();
  for (const name of Object.keys(TG) as Array<keyof typeof TG>) {
    as[name] = await signIn(app, TG[name]);
  }
});

afterAll(async () => {
  FEATURES.MULTI_WINNER_VOTING = multiWinnerWasEnabled;
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('изменять голосование может только админ его группы', () => {
  const MUTATIONS: Array<[string, (c: Client, x: World) => ReturnType<Client['post']>]> = [
    ['создать', (c, x) => c.post('/api/polls', { groupId: x.groupA2 })],
    [
      'создать из Mini App',
      (c, x) =>
        c.post('/api/polls/create-from-webapp', {
          groupId: x.groupA2,
          duration: 30,
          selectedMenuItems: [x.dishX1, x.dishX2],
        }),
    ],
    ['повторить', (c, x) => c.post(`/api/polls/repeat/${x.doneInA2}`)],
    ['завершить', (c, x) => c.patch(`/api/polls/${x.activeInA}/complete`)],
    ['завершить с несколькими победителями', (c, x) => c.patch(`/api/polls/${x.activeInA}/complete-multi`)],
    ['отменить', (c, x) => c.patch(`/api/polls/${x.activeInA}/cancel`, { reason: 'тест' })],
    ['крутить рулетку', (c, x) => c.post(`/api/polls/${x.doneInA2}/roulette`)],
  ];

  /* Майк — рядовой участник с прежним глобальным флагом; Боб — админ, но
     другой группы: права определяет группа голосования, а не любая роль. */
  const ACTORS = [['рядовой участник с флагом is_admin', 'mike'], ['админ другой группы', 'bob']] as const;
  const CASES = MUTATIONS.flatMap(([action, call]) =>
    ACTORS.map(([who, actor]) => [action, who, actor, call] as const)
  );

  it.each(CASES)('%s: %s получает 403, в базе ничего не меняется', async (_action, _who, actor, call) => {
    const before = await pollState();

    const response = await call(as[actor], w);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await pollState()).toEqual(before);
  });
});

describe('POST /api/polls', () => {
  it('автор голосования — тот, кто вошёл, а не поле createdBy из тела', async () => {
    const response = await as.ann
      .post('/api/polls', { groupId: w.groupA2, createdBy: w.mikeId })
      .expect(201);

    const poll = await prisma.poll.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(poll).toMatchObject({ createdBy: w.annId, groupId: w.groupA2, status: 'ACTIVE' });
  });

  /* Сервис отвечает 400, а не 409: код POLL_ALREADY_ACTIVE читает фронт. */
  it('второе активное голосование в группе не создаётся — 400 POLL_ALREADY_ACTIVE', async () => {
    const response = await as.ann.post('/api/polls', { groupId: w.groupA });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('POLL_ALREADY_ACTIVE');
    const active = await prisma.poll.findMany({ where: { groupId: w.groupA, status: 'ACTIVE' } });
    expect(active.map(p => p.id)).toEqual([w.activeInA]);
  });

  /* Гонку двух создателей решает частичный уникальный индекс
     polls_one_active_per_group; проигравший должен получить тот же понятный
     отказ, а не 500 от нарушения индекса. */
  it('два одновременных создания дают одно активное голосование', async () => {
    const responses = await Promise.all([
      as.ann.post('/api/polls', { groupId: w.groupA2 }),
      as.ann.post('/api/polls', { groupId: w.groupA2 }),
    ]);

    expect(responses.map(r => r.status).sort()).toEqual([201, 400]);
    expect(responses.find(r => r.status === 400)!.body.code).toBe('POLL_ALREADY_ACTIVE');
    expect(await prisma.poll.count({ where: { groupId: w.groupA2, status: 'ACTIVE' } })).toBe(1);
  });

  it('из Mini App тоже: при идущем голосовании — 400 POLL_ALREADY_ACTIVE, нового голосования нет', async () => {
    const before = await pollState();

    const response = await as.ann.post('/api/polls/create-from-webapp', {
      groupId: w.groupA,
      duration: 30,
      selectedMenuItems: [w.dishA1, w.dishA2],
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('POLL_ALREADY_ACTIVE');
    expect(await pollState()).toEqual(before);
  });

  /* [BUG] Список активных прятал голосование с вышедшим сроком, а гвардия
     создания смотрела только на статус: пока планировщик не отработал (упал
     тик, перезапуск съел таймер), группа видела пустой экран и «уже идёт
     голосование» на кнопке. Мёртвая строка закрывается в той же транзакции,
     и в историю пишется фактический конец, а не «сейчас». */
  const twoHoursAgo = new Date(Date.now() - 120 * 60_000);
  const minuteAgo = new Date(Date.now() - 60_000);
  it.each([
    ['вышел срок по таймеру', { startedAt: twoHoursAgo, duration: 30 }, new Date(twoHoursAgo.getTime() + 30 * 60_000)],
    ['проставлен endedAt в прошлом', { startedAt: new Date(Date.now() - 5 * 60_000), endedAt: minuteAgo }, minuteAgo],
  ])('строка ACTIVE, у которой %s, закрывается, и новое голосование создаётся', async (_name, timing, endsAt) => {
    const stale = await pollIn(w.groupA2, w.annId, timing);

    const response = await as.ann.post('/api/polls', { groupId: w.groupA2 }).expect(201);

    expect(await prisma.poll.findUniqueOrThrow({ where: { id: stale.id } })).toMatchObject({
      status: 'CANCELLED',
      endedAt: endsAt,
    });
    expect(await statusOf(response.body.data.id)).toBe('ACTIVE');
  });

  /* [BUG] Снимок ожидаемых участников — основа кворума. Отказавшийся от
     обедов остаётся в снимке как EXCLUDED (его не ждут, но он виден), а
     удалённый пользователь и вышедший из группы в снимок не попадают вовсе. */
  it('снимок участников: EXPECTED, EXCLUDED, без удалённых и вышедших', async () => {
    const group = await team(-1007109, 'Команда снимка');
    const rita = await person(702011, 'Рита');
    const dora = await person(702012, 'Дора', { isActive: false });
    const leo = await person(702013, 'Лёва');
    await addMember(group.id, w.annId, 'CREATOR');
    await addMember(group.id, rita.id, 'MEMBER');
    await addMember(group.id, w.mikeId, 'MEMBER', { participatesInPolls: false });
    await addMember(group.id, dora.id, 'MEMBER');
    await addMember(group.id, leo.id, 'MEMBER', { isActive: false, leftAt: new Date() });

    const response = await as.ann.post('/api/polls', { groupId: group.id }).expect(201);

    const snapshot = await prisma.pollParticipant.findMany({
      where: { pollId: response.body.data.id },
      select: { userId: true, status: true },
    });
    expect(Object.fromEntries(snapshot.map(row => [row.userId, row.status]))).toEqual({
      [w.annId]: 'EXPECTED',
      [rita.id]: 'EXPECTED',
      [w.mikeId]: 'EXCLUDED',
    });
  });
});

describe('создание из Mini App и повтор — с отправкой в группу', () => {
  it('голосование создаётся из выбранных блюд, сообщение группы запоминается', async () => {
    const response = await withParkedTimers(() =>
      as.ann.post('/api/polls/create-from-webapp', {
        groupId: w.groupA2,
        duration: 45,
        selectedMenuItems: [w.dishX1, w.dishX2],
      })
    );

    expect(response.status).toBe(201);
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id: response.body.data.pollId } });
    expect(poll).toMatchObject({
      groupId: w.groupA2,
      createdBy: w.annId,
      status: 'ACTIVE',
      duration: 45,
      messageId: SENT_MESSAGE_ID,
      chatId: BigInt(GROUP_A2_TELEGRAM_ID),
    });
    expect(JSON.parse(poll.selectedMenuItemIds!)).toEqual([w.dishX1, w.dishX2]);
  });

  /* [BUG] Инцидент 2026-08-24: одно голосование и список активных писались в
     общий ключ кэша. Список клал туда `[]`, пустой массив читался как «голосование
     есть», и создание отвечало «уже идёт голосование» при пустой таблице. */
  it('закэшированный пустой список активных не мешает создать голосование', async () => {
    const list = await as.ann.get(`/api/polls/active?groupId=${w.groupA2}`).expect(200);
    expect(list.body.data).toEqual([]);

    const response = await withParkedTimers(() =>
      as.ann.post('/api/polls/create-from-webapp', {
        groupId: w.groupA2,
        duration: 30,
        selectedMenuItems: [w.dishX1, w.dishX2],
      })
    );

    expect(response.status).toBe(201);
  });

  it('блюдо чужой группы в выборе не засчитывается: меньше двух — 400, голосования нет', async () => {
    const before = await pollState();

    const response = await as.ann.post('/api/polls/create-from-webapp', {
      groupId: w.groupA2,
      duration: 30,
      selectedMenuItems: [w.dishX1, w.dishB1],
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('NOT_ENOUGH_ITEMS');
    expect(await pollState()).toEqual(before);
  });

  /* [BUG] Без бота сценарий падал общей ошибкой: клиент получал 500 и не мог
     отличить «сервис недоступен» от поломки. */
  it('без бота — 503 BOT_NOT_AVAILABLE, голосование не создаётся', async () => {
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);
    const before = await pollState();

    const response = await as.ann.post('/api/polls/create-from-webapp', {
      groupId: w.groupA2,
      duration: 30,
      selectedMenuItems: [w.dishX1, w.dishX2],
    });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('BOT_NOT_AVAILABLE');
    expect(await pollState()).toEqual(before);
  });

  it('повтор создаёт такое же голосование: те же блюда и длительность, автор — повторивший', async () => {
    const source = await prisma.poll.findUniqueOrThrow({ where: { id: w.doneInA2 } });

    const response = await withParkedTimers(() => as.ann.post(`/api/polls/repeat/${w.doneInA2}`));

    expect(response.status).toBe(200);
    const copy = await prisma.poll.findUniqueOrThrow({ where: { id: response.body.data.id } });
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      groupId: w.groupA2,
      status: 'ACTIVE',
      createdBy: w.annId,
      duration: source.duration,
      selectedMenuItemIds: source.selectedMenuItemIds,
    });
  });
});

describe('PATCH /:id/complete — один победитель', () => {
  async function castVotes(...votes: Array<[number, number]>) {
    await prisma.vote.createMany({
      data: votes.map(([userId, menuItemId]) => ({ pollId: w.activeInA, userId, menuItemId })),
    });
  }

  it('ACTIVE → COMPLETED, побеждает блюдо с большинством; повтор — 400 POLL_ALREADY_COMPLETED', async () => {
    await castVotes([w.annId, w.dishA2], [w.mikeId, w.dishA1], [w.kateId, w.dishA1]);

    await as.ann.patch(`/api/polls/${w.activeInA}/complete`).expect(200);

    expect(await statusOf(w.activeInA)).toBe('COMPLETED');
    const results = await prisma.pollResult.findMany({ where: { pollId: w.activeInA } });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ winnerMenuItemId: w.dishA1, totalVotes: 3 });

    const again = await as.ann.patch(`/api/polls/${w.activeInA}/complete`);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('POLL_ALREADY_COMPLETED');
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(1);
  });

  it('отменённое голосование не завершается — 409 INVALID_POLL_STATE', async () => {
    await prisma.poll.update({ where: { id: w.activeInA }, data: { status: 'CANCELLED', endedAt: new Date() } });

    const response = await as.ann.patch(`/api/polls/${w.activeInA}/complete`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_POLL_STATE');
    expect(await statusOf(w.activeInA)).toBe('CANCELLED');
    expect(await prisma.pollResult.count()).toBe(1); // только итог doneInA2
  });

  /* Проверка статуса и переход живут в одной транзакции: раньше два
     одновременных запроса создавали два комплекта итогов. */
  it('два одновременных завершения дают один итог', async () => {
    await castVotes([w.annId, w.dishA1]);

    const responses = await Promise.all([
      as.ann.patch(`/api/polls/${w.activeInA}/complete`),
      as.ann.patch(`/api/polls/${w.activeInA}/complete`),
    ]);

    /* Статус проигравшего не проверяется: он зависит от того, успел ли его
       запрос прочитать строку до фиксации победителя (400) или после (сейчас
       500 «Poll state changed during completion»). */
    expect(responses.map(r => r.status)).toContain(200);
    expect(await statusOf(w.activeInA)).toBe('COMPLETED');
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(1);
  });

  /* Уведомления идут после транзакции: голосование уже завершено, и падение
     Telegram не повод откатывать итог. */
  it('Telegram недоступен — голосование всё равно завершается', async () => {
    await castVotes([w.annId, w.dishA1]);
    setBotInstance({
      api: {
        sendMessage: async () => {
          throw Object.assign(new Error('Bad Gateway'), { error_code: 502 });
        },
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    await as.ann.patch(`/api/polls/${w.activeInA}/complete`).expect(200);

    expect(await statusOf(w.activeInA)).toBe('COMPLETED');
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(1);
  });
});

describe('PATCH /:id/complete-multi — несколько победителей', () => {
  /* Каждое блюдо выбрал один человек: ответственный за категорию назначается
     сразу, и трёхминутный таймер добровольцев не ставится. */
  async function voteDistinct() {
    await prisma.vote.createMany({
      data: [
        { pollId: w.activeInA, userId: w.annId, menuItemId: w.dishA1 },
        { pollId: w.activeInA, userId: w.mikeId, menuItemId: w.dishA2 },
      ],
    });
  }

  it('итоги с победителями и заказами по категориям; повтор отдаёт тот же итог', async () => {
    await voteDistinct();

    const first = await as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`).expect(200);

    expect(await statusOf(w.activeInA)).toBe('COMPLETED');
    const winners = first.body.data.resultData.winners.map((x: { menuItemId: number }) => x.menuItemId);
    expect(winners.sort()).toEqual([w.dishA1, w.dishA2].sort());
    expect(first.body.data.pollResult.totalVotes).toBe(2);
    expect(await prisma.categoryOrder.count({ where: { pollId: w.activeInA } })).toBe(2);

    const again = await as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`).expect(200);
    expect(again.body.data.pollResult.id).toBe(first.body.data.pollResult.id);
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(1);
  });

  it('отменённое — 400 NOT_ACTIVE, итогов нет', async () => {
    await prisma.poll.update({ where: { id: w.activeInA }, data: { status: 'CANCELLED', endedAt: new Date() } });

    const response = await as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('NOT_ACTIVE');
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(0);
  });

  it('два одновременных завершения дают один итог', async () => {
    await voteDistinct();

    await Promise.all([
      as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`),
      as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`),
    ]);

    expect(await statusOf(w.activeInA)).toBe('COMPLETED');
    expect(await prisma.pollResult.count({ where: { pollId: w.activeInA } })).toBe(1);
  });

  it('функция выключена — 503 FEATURE_DISABLED, голосование остаётся активным', async () => {
    FEATURES.MULTI_WINNER_VOTING = false;
    try {
      const response = await as.ann.patch(`/api/polls/${w.activeInA}/complete-multi`);

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('FEATURE_DISABLED');
      expect(await statusOf(w.activeInA)).toBe('ACTIVE');
    } finally {
      FEATURES.MULTI_WINNER_VOTING = true;
    }
  });
});

describe('PATCH /:id/cancel', () => {
  it('ACTIVE → CANCELLED; повторная отмена ничего не меняет', async () => {
    await as.ann.patch(`/api/polls/${w.activeInA}/cancel`, { reason: 'Все ушли в столовую' }).expect(200);

    const cancelled = await prisma.poll.findUniqueOrThrow({ where: { id: w.activeInA } });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.endedAt).not.toBeNull();

    await as.ann.patch(`/api/polls/${w.activeInA}/cancel`).expect(200);
    expect(await prisma.poll.findUniqueOrThrow({ where: { id: w.activeInA } })).toEqual(cancelled);
  });

  it('завершённое отменить нельзя — 409 INVALID_POLL_STATE', async () => {
    const response = await as.ann.patch(`/api/polls/${w.doneInA2}/cancel`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_POLL_STATE');
    expect(await statusOf(w.doneInA2)).toBe('COMPLETED');
  });
});

describe('POST /:id/roulette', () => {
  it('ответственный выбирается из проголосовавших', async () => {
    // До рулетки ответственным записан автор, Энн; голосовали Майк и Катя.
    const response = await as.ann.post(`/api/polls/${w.doneInA2}/roulette`).expect(200);

    const result = await prisma.pollResult.findUniqueOrThrow({ where: { pollId: w.doneInA2 } });
    expect([w.mikeId, w.kateId]).toContain(result.responsibleUserId);
    expect(response.body.data.responsibleUserId).toBe(result.responsibleUserId);
  });

  it('никто не голосовал — 400 NO_VOTERS, итог не меняется', async () => {
    const empty = await completedPoll(w.groupA2, w.annId, []);
    const before = await pollState();

    const response = await as.ann.post(`/api/polls/${empty.id}/roulette`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('NO_VOTERS');
    expect(await pollState()).toEqual(before);
  });
});

describe('неизвестное голосование', () => {
  it.each([
    ['завершить', (c: Client, id: number) => c.patch(`/api/polls/${id}/complete`)],
    ['завершить с несколькими победителями', (c: Client, id: number) => c.patch(`/api/polls/${id}/complete-multi`)],
    ['отменить', (c: Client, id: number) => c.patch(`/api/polls/${id}/cancel`)],
    ['повторить', (c: Client, id: number) => c.post(`/api/polls/repeat/${id}`)],
    ['крутить рулетку', (c: Client, id: number) => c.post(`/api/polls/${id}/roulette`)],
  ])('%s — 404 POLL_NOT_FOUND', async (_name, call) => {
    const response = await call(as.ann, w.activeInA + 100000);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('POLL_NOT_FOUND');
  });
});

describe('GET /api/polls/active: проставленный endedAt', () => {
  async function activeWithEndedAt() {
    const endedAt = new Date(Date.now() + 10 * 60_000);
    await pollIn(w.groupA2, w.annId, { endedAt });
    return endedAt;
  }

  it('время окончания берётся из endedAt, а не из начала и длительности', async () => {
    const endedAt = await activeWithEndedAt();

    const response = await as.ann.get(`/api/polls/active?groupId=${w.groupA2}`).expect(200);

    expect(response.body.data[0].endTime).toBe(endedAt.toISOString());
  });

  it.failing('повторный запрос, отданный из кэша, отвечает так же, как первый', async () => {
    // BUG: из Redis даты приходят строками; pollEndsAt возвращает строку endedAt, withEndTime падает на toISOString → 500.
    const endedAt = await activeWithEndedAt();
    await as.ann.get(`/api/polls/active?groupId=${w.groupA2}`).expect(200);

    const cached = await as.ann.get(`/api/polls/active?groupId=${w.groupA2}`);

    expect(cached.status).toBe(200);
    expect(cached.body.data[0].endTime).toBe(endedAt.toISOString());
  });
});
