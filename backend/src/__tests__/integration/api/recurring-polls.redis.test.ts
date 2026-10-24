/**
 * Расписание автоголосований через НАСТОЯЩИЙ API.
 *
 * Читать расписание может любой участник группы (команде полезно знать, когда
 * стартует автоголосование), менять — только её админ. Права определяет группа
 * САМОГО расписания: `groupId` из тела или чужой id в пути не должны давать
 * админу одной группы власть над расписанием другой. Каждый отказ проверяется
 * и ответом, и тем, что строка расписания не изменилась.
 *
 * ОКРУЖЕНИЕ. Нужен настоящий Redis: изменяющие маршруты объявлены
 * `required: true` в middleware идемпотентности и без хранилища отвечают 503.
 */
import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { addMember } from '../helpers/api';
import { type Client, dish, person, pollIn, signIn, team } from '../helpers/polls';

let app: ReturnType<typeof createTestApp>;

const TG = { ann: 704001, mike: 704002, bob: 704003, mira: 704004, oleg: 704005 } as const;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

interface World {
  bobId: number;
  groupA: number;
  groupB: number;
  /** Группа C (админ — Боб) без расписания. */
  groupC: number;
  /** Расписание группы B. У группы A расписания нет. */
  scheduleB: number;
  dishA1: number;
  dishA2: number;
  deletedDishA: number;
  dishB1: number;
}

/**
 * Энн — админ A, Майк — рядовой участник A. Боб — админ B, Мира — рядовая
 * участница B. Олег ни в одной группе не состоит, но носит прежний глобальный
 * флаг is_admin.
 */
async function buildWorld(): Promise<World> {
  const ann = await person(TG.ann, 'Энн');
  const mike = await person(TG.mike, 'Майк');
  const bob = await person(TG.bob, 'Боб');
  const mira = await person(TG.mira, 'Мира');
  await person(TG.oleg, 'Олег', { isAdmin: true });

  const a = await team(-1007301, 'Команда A');
  const b = await team(-1007302, 'Команда B');
  await addMember(a.id, ann.id, 'CREATOR');
  await addMember(a.id, mike.id, 'MEMBER');
  await addMember(b.id, bob.id, 'ADMIN');
  const c = await team(-1007303, 'Команда C');
  await addMember(c.id, bob.id, 'CREATOR');
  await addMember(b.id, mira.id, 'MEMBER');

  const a1 = await dish(a.id, ann.id, 'Борщ');
  const a2 = await dish(a.id, ann.id, 'Плов');
  const deletedA = await dish(a.id, ann.id, 'Окрошка', { isActive: false, deletedAt: new Date() });
  const b1 = await dish(b.id, bob.id, 'Пицца');

  const scheduleB = await prisma.recurringPoll.create({
    data: {
      groupId: b.id,
      daysOfWeek: JSON.stringify([1, 3, 5]),
      timeOfDay: '12:00',
      duration: 30,
      createdBy: bob.id,
      nextRunAt: new Date(Date.now() + 24 * 3_600_000),
    },
  });

  return {
    bobId: bob.id,
    groupA: a.id,
    groupB: b.id,
    groupC: c.id,
    scheduleB: scheduleB.id,
    dishA1: a1.id,
    dishA2: a2.id,
    deletedDishA: deletedA.id,
    dishB1: b1.id,
  };
}

const scheduleRow = (id: number) => prisma.recurringPoll.findUnique({ where: { id } });
const scheduleOfGroup = (groupId: number) => prisma.recurringPoll.findUnique({ where: { groupId } });

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

/** Расписание группы A, созданное её админом через API. */
async function createScheduleForA(extra: Record<string, unknown> = {}) {
  const response = await as.ann
    .post('/api/recurring', {
      groupId: w.groupA,
      daysOfWeek: EVERY_DAY,
      timeOfDay: '12:00',
      duration: 30,
      ...extra,
    })
    .expect(201);
  return response.body.data as { id: number };
}

describe('GET /api/recurring/:groupId — читают участники группы', () => {
  it.each([
    ['админ группы', 200, 'bob'],
    ['рядовой участник', 200, 'mira'],
    ['админ другой группы', 403, 'ann'],
    ['не участник с флагом is_admin', 403, 'oleg'],
  ] as const)('%s — %i', async (_name, status, who) => {
    const response = await as[who].get(`/api/recurring/${w.groupB}`);

    expect(response.status).toBe(status);
    if (status === 200) expect(response.body.data.id).toBe(w.scheduleB);
    else expect(response.body.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/recurring', () => {
  it('админ создаёт расписание: следующий запуск посчитан, выбранные блюда сохранены', async () => {
    await createScheduleForA({ selectedMenuItemIds: [w.dishA1, w.dishA2] });

    const saved = await scheduleOfGroup(w.groupA);
    expect(saved).not.toBeNull();
    expect(saved!.nextRunAt).not.toBeNull();
    expect(JSON.parse(saved!.selectedMenuItemIds!)).toEqual([w.dishA1, w.dishA2]);
  });

  it('рядовой участник не создаёт — 403, расписания нет', async () => {
    const response = await as.mike.post('/api/recurring', {
      groupId: w.groupA,
      daysOfWeek: EVERY_DAY,
      timeOfDay: '12:00',
      duration: 30,
    });

    expect(response.status).toBe(403);
    expect(await scheduleOfGroup(w.groupA)).toBeNull();
  });

  it('второе расписание группы не создаётся — 409', async () => {
    const first = await createScheduleForA();

    const response = await as.ann.post('/api/recurring', {
      groupId: w.groupA,
      daysOfWeek: [1],
      timeOfDay: '09:00',
      duration: 30,
    });

    expect(response.status).toBe(409);
    expect(await prisma.recurringPoll.count({ where: { groupId: w.groupA } })).toBe(1);
    expect((await scheduleOfGroup(w.groupA))!.id).toBe(first.id);
  });
});

describe('блюда расписания — только живые блюда своей группы', () => {
  const BAD_DISHES = [
    ['блюдо чужой группы', (x: World) => x.dishB1],
    ['удалённое блюдо', (x: World) => x.deletedDishA],
  ] as const;

  it.each(BAD_DISHES)('POST: %s — отказ, расписание не создаётся', async (_name, bad) => {
    const response = await as.ann.post('/api/recurring', {
      groupId: w.groupA,
      daysOfWeek: EVERY_DAY,
      timeOfDay: '12:00',
      duration: 30,
      selectedMenuItemIds: [w.dishA1, bad(w)],
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await scheduleOfGroup(w.groupA)).toBeNull();
  });

  it.each(BAD_DISHES)('PATCH: %s — отказ, расписание не меняется', async (_name, bad) => {
    const created = await createScheduleForA({ selectedMenuItemIds: [w.dishA1] });
    const before = await scheduleRow(created.id);

    const response = await as.ann.patch(`/api/recurring/${created.id}`, {
      groupId: w.groupA,
      selectedMenuItemIds: [bad(w)],
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await scheduleRow(created.id)).toEqual(before);
  });

  it.each(BAD_DISHES)('POST: %s — это ошибка запроса, 400, а не 500', async (_name, bad) => {
    // Регрессия: отказ «Selected menu items must be active and belong to the group» уходил клиенту 500-м.
    const response = await as.ann.post('/api/recurring', {
      groupId: w.groupA,
      daysOfWeek: EVERY_DAY,
      timeOfDay: '12:00',
      duration: 30,
      selectedMenuItemIds: [w.dishA1, bad(w)],
    });

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/recurring/:id', () => {
  /* Следующий запуск мог поставить планировщик (например, перенести после
     сегодняшнего запуска). Пересчёт «на всякий случай» при смене одной
     длительности мог бы вернуть уже отработавший сегодня слот. Поэтому
     сохранённое значение — заведомо не то, что дал бы пересчёт. */
  it('смена длительности не сдвигает следующий запуск, смена времени — сдвигает', async () => {
    const created = await createScheduleForA();
    const planned = new Date(Date.now() + 3 * 24 * 3_600_000 + 1234);
    await prisma.recurringPoll.update({ where: { id: created.id }, data: { nextRunAt: planned } });

    await as.ann.patch(`/api/recurring/${created.id}`, { groupId: w.groupA, duration: 45 }).expect(200);
    const afterDuration = (await scheduleRow(created.id))!;
    expect(afterDuration.duration).toBe(45);
    expect(afterDuration.nextRunAt).toEqual(planned);

    await as.ann.patch(`/api/recurring/${created.id}`, { groupId: w.groupA, timeOfDay: '13:00' }).expect(200);
    const afterTime = (await scheduleRow(created.id))!;
    expect(afterTime.nextRunAt).not.toEqual(planned);
  });
});

describe('менять чужое расписание нельзя: права даёт группа самого расписания', () => {
  /* У A своё расписание есть: иначе подставленный groupId=A отсекался бы
     просто «у группы нет расписания», и сверка id расписания не проверялась. */
  beforeEach(async () => {
    await createScheduleForA();
  });

  type Call = (c: Client, x: World) => ReturnType<Client['patch']>;
  const CASES: Array<[string, number, keyof typeof TG, Call]> = [
    ['админ A правит расписание B, подставив groupId своей группы', 404, 'ann', (c, x) => c.patch(`/api/recurring/${x.scheduleB}`, { groupId: x.groupA, duration: 99 })],
    ['админ A правит расписание B с честным groupId', 403, 'ann', (c, x) => c.patch(`/api/recurring/${x.scheduleB}`, { groupId: x.groupB, duration: 99 })],
    ['админ A удаляет расписание B', 403, 'ann', (c, x) => c.delete(`/api/recurring/${x.scheduleB}`)],
    ['админ A выключает расписание B', 403, 'ann', (c, x) => c.patch(`/api/recurring/${x.scheduleB}/toggle`, { isEnabled: false })],
    ['рядовой участник B правит своё расписание', 403, 'mira', (c, x) => c.patch(`/api/recurring/${x.scheduleB}`, { groupId: x.groupB, duration: 99 })],
    ['рядовой участник B удаляет своё расписание', 403, 'mira', (c, x) => c.delete(`/api/recurring/${x.scheduleB}`)],
    ['рядовой участник B выключает своё расписание', 403, 'mira', (c, x) => c.patch(`/api/recurring/${x.scheduleB}/toggle`, { isEnabled: false })],
    ['админ B правит расписание B, указав свою группу C без расписания', 404, 'bob', (c, x) => c.patch(`/api/recurring/${x.scheduleB}`, { groupId: x.groupC, duration: 99 })],
  ];

  it.each(CASES)('%s — %i, расписание не меняется', async (_name, status, who, call) => {
    const before = await scheduleRow(w.scheduleB);

    const response = await call(as[who], w);

    expect(response.status).toBe(status);
    expect(await scheduleRow(w.scheduleB)).toEqual(before);
  });

  it.each([
    ['удалить', (c: Client, id: number) => c.delete(`/api/recurring/${id}`)],
    ['выключить', (c: Client, id: number) => c.patch(`/api/recurring/${id}/toggle`, { isEnabled: false })],
  ])('%s несуществующее расписание — 404', async (_name, call) => {
    const response = await call(as.bob, w.scheduleB + 100000);

    expect(response.status).toBe(404);
  });
});

describe('админ своей группы', () => {
  it('выключает и удаляет расписание', async () => {
    await as.bob.patch(`/api/recurring/${w.scheduleB}/toggle`, { isEnabled: false }).expect(200);
    expect((await scheduleRow(w.scheduleB))!.isEnabled).toBe(false);

    await as.bob.delete(`/api/recurring/${w.scheduleB}`).expect(200);
    expect(await scheduleRow(w.scheduleB)).toBeNull();
  });
});

describe('GET /api/recurring/:groupId/history — только админу', () => {
  it('админ видит автоматические запуски, рядовой участник получает 403', async () => {
    const automatic = await pollIn(w.groupB, w.bobId, { status: 'COMPLETED', endedAt: new Date() });
    await prisma.poll.update({ where: { id: automatic.id }, data: { isAutomatic: true } });
    // Голосование, созданное руками, в историю автозапусков не попадает.
    await pollIn(w.groupB, w.bobId, { status: 'COMPLETED', endedAt: new Date() });

    const history = await as.bob.get(`/api/recurring/${w.groupB}/history`).expect(200);
    expect(history.body.data.map((run: { pollId: number }) => run.pollId)).toEqual([automatic.id]);

    const refused = await as.mira.get(`/api/recurring/${w.groupB}/history`);
    expect(refused.status).toBe(403);
  });
});
