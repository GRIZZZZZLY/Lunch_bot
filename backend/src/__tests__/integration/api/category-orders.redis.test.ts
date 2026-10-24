/**
 * Заказ по категориям после голосования — через НАСТОЯЩИЙ API: express,
 * PostgreSQL, Prisma, Redis.
 *
 * Категория — это блюдо, за которое голосовали несколько человек. Один из них
 * становится ответственным («Я оформлю»), вписывает позиции и расходы и
 * закрывает расчёт, после чего у остальных появляются долги ему. Здесь
 * проверяется то, что раньше держалось на моках Prisma и сервисов:
 *
 * 1. Права: кто видит категорию и кто её меняет, — по ответу И по тому, что
 *    строки в базе после отказа не изменились.
 * 2. Деньги: позиции и расходы сохраняются точно, до копейки; закрытие
 *    расчёта создаёт долги с конкретными суммами, ответственный себе не
 *    должен, повтор и гонка не дают второго комплекта.
 * 3. Журнал правок позиции и то, что чужая группа его не видит.
 * 4. Гонка двух добровольцев: ответственный ровно один.
 *
 * ОКРУЖЕНИЕ. Изменяющие маршруты категорий объявлены `required: true` в
 * middleware идемпотентности, без Redis они отвечают 503 — поэтому файл
 * `*.redis.test.ts` и собирается только при `REDIS_ENABLED=true`.
 *
 *   REDIS_ENABLED=true REDIS_URL=redis://127.0.0.1:6379/0 \
 *   ENABLE_RATE_LIMIT=false npm test -- <этот файл>
 */
import request from 'supertest';

import { prisma } from '../../../database/client';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import { idemKey, tokenFor } from '../helpers/api';
import { setBotInstance } from '../../../bot/bot-instance';
import { CategoryOrderService } from '../../../services/category-order.service';

let app: ReturnType<typeof createTestApp>;

/* Анна — создатель группы (значит, её администратор) и голосовала за пиццу и
   суши. Борис и Вера — пицца. Глеб — суши и салат (салат только он, поэтому
   сразу ответственный). Дина — посторонняя. Егор — администратор ДРУГОЙ
   группы. Рут — глобальный админ сервиса без членства в группе: флаг
   `isAdmin` не должен открывать чужие данные. */
const TELEGRAM = {
  anna: 700000401,
  boris: 700000402,
  vera: 700000403,
  gleb: 700000404,
  dina: 700000405,
  egor: 700000406,
  root: 700000407,
} as const;
type Who = keyof typeof TELEGRAM;

interface World {
  user: Record<Who, number>;
  teamA: number;
  teamB: number;
  pollId: number;
  pizza: number;
  sushi: number;
  salad: number;
}

let world: World;

async function buildWorld(): Promise<World> {
  /* Последовательно, а не Promise.all: порядок id задаёт, кому достаются
     лишние копейки при делении (должники по возрастанию id). */
  const user = {} as Record<Who, number>;
  for (const who of Object.keys(TELEGRAM) as Who[]) {
    const row = await prisma.user.create({
      data: {
        telegramId: BigInt(TELEGRAM[who]),
        firstName: who,
        username: `${who}_login`,
        isAdmin: who === 'root',
      },
    });
    user[who] = row.id;
  }

  const teamA = await prisma.group.create({
    data: { telegramId: BigInt(-100000000401), title: 'Команда А' },
  });
  const teamB = await prisma.group.create({
    data: { telegramId: BigInt(-100000000402), title: 'Команда Б' },
  });
  await prisma.groupMember.createMany({
    data: [
      { groupId: teamA.id, userId: user.anna, role: 'CREATOR' },
      { groupId: teamA.id, userId: user.boris, role: 'MEMBER' },
      { groupId: teamA.id, userId: user.vera, role: 'MEMBER' },
      { groupId: teamA.id, userId: user.gleb, role: 'MEMBER' },
      { groupId: teamB.id, userId: user.egor, role: 'CREATOR' },
    ],
  });

  const menu = async (name: string, price: number) =>
    prisma.menuItem.create({
      data: { name, price, groupId: teamA.id, createdBy: user.anna },
    });
  const pizzaItem = await menu('Пицца', 500);
  const sushiItem = await menu('Суши', 700);
  const saladItem = await menu('Салат', 300);

  const poll = await prisma.poll.create({
    data: { groupId: teamA.id, status: 'COMPLETED', createdBy: user.anna },
  });
  const votes: Array<[Who, number]> = [
    ['anna', pizzaItem.id],
    ['boris', pizzaItem.id],
    ['vera', pizzaItem.id],
    ['anna', sushiItem.id],
    ['gleb', sushiItem.id],
    ['gleb', saladItem.id],
  ];
  await prisma.vote.createMany({
    data: votes.map(([who, menuItemId]) => ({
      pollId: poll.id,
      userId: user[who],
      menuItemId,
    })),
  });

  /* Категории создаёт тот же сервис, что и при завершении голосования: так
     состояние «до отклика» совпадает с боевым, а не с нашим представлением
     о нём. */
  const created = await CategoryOrderService.createCategoryOrders(poll.id);
  const idOf = (category: string) =>
    created.find(order => order.category === category)!.id;

  return {
    user,
    teamA: teamA.id,
    teamB: teamB.id,
    pollId: poll.id,
    pizza: idOf('Пицца'),
    sushi: idOf('Суши'),
    salad: idOf('Салат'),
  };
}

/** Telegram подменён на границе: запоминаем, кому что ушло. */
interface BotCall {
  method: 'send' | 'edit';
  chatId: string;
  messageId: number;
}
let botCalls: BotCall[];

function recordingBot(): void {
  botCalls = [];
  let lastMessageId = 9000;
  setBotInstance({
    api: {
      sendMessage: async (chatId: string | number) => {
        lastMessageId += 1;
        botCalls.push({ method: 'send', chatId: String(chatId), messageId: lastMessageId });
        return { message_id: lastMessageId };
      },
      editMessageText: async (chatId: string | number, messageId: number) => {
        botCalls.push({ method: 'edit', chatId: String(chatId), messageId });
        return true;
      },
    },
  } as unknown as Parameters<typeof setBotInstance>[0]);
}

const tokens = new Map<Who, string>();

async function authOf(who: Who): Promise<string> {
  if (!tokens.has(who)) {
    tokens.set(who, await tokenFor(app, TELEGRAM[who]));
  }
  return `Bearer ${tokens.get(who)}`;
}

type Method = 'get' | 'post' | 'put' | 'delete';

/** Запрос от имени человека; изменяющим — свой ключ идемпотентности. */
async function call(who: Who, method: Method, path: string, body?: object) {
  let req = request(app)[method](`/api${path}`).set('Authorization', await authOf(who));
  if (method !== 'get') {
    req = req.set('Idempotency-Key', idemKey(method));
  }
  return body === undefined ? req : req.send(body);
}

async function volunteer(who: Who, categoryOrderId: number) {
  return call(who, 'post', `/category-orders/${categoryOrderId}/volunteer`);
}

/** Позиция в пицце, вписанная ответственным Борисом. */
async function enterPizzaItem(
  forWho: Who,
  price: number | string,
  itemName = 'Пепперони',
  notes?: string
) {
  return call('boris', 'post', `/category-orders/${world.pizza}/order-items`, {
    userId: world.user[forWho],
    itemName,
    price,
    ...(notes === undefined ? {} : { notes }),
  });
}

async function pizzaRow() {
  return prisma.categoryOrder.findUniqueOrThrow({ where: { id: world.pizza } });
}

async function pizzaDebts() {
  return prisma.transaction.findMany({
    where: { categoryOrderId: world.pizza },
    orderBy: { fromUserId: 'asc' },
  });
}

/** Всё, что может изменить запрос к пицце: сама строка, позиции, долги. */
async function pizzaState() {
  const [order, items, debts] = await Promise.all([
    pizzaRow(),
    prisma.orderItem.findMany({ where: { categoryOrderId: world.pizza }, orderBy: { id: 'asc' } }),
    pizzaDebts(),
  ]);
  return { order, items, debts };
}

/** Decimal из базы как строка: '0.37', а не 0.37000000000000005. */
const money = (value: unknown) => (value === null ? null : String(value));

beforeAll(() => {
  process.env.SKIP_TELEGRAM_VALIDATION = 'true';
  app = createTestApp();
});

beforeEach(async () => {
  await cleanDatabase();
  tokens.clear();
  recordingBot();
  world = await buildWorld();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('категории из голосов', () => {
  /* От этого состояния зависит всё остальное: у категории на одного
     ответственный есть сразу, у категории на нескольких его нет до отклика. */
  it('у категории на одного ответственный сразу, на нескольких — ждём добровольца', async () => {
    const salad = await prisma.categoryOrder.findUniqueOrThrow({ where: { id: world.salad } });
    expect(salad).toMatchObject({
      responsibleUserId: world.user.gleb,
      selectionStatus: 'SELECTED_AUTO',
      participantCount: 1,
    });

    expect(await pizzaRow()).toMatchObject({
      responsibleUserId: null,
      selectionStatus: 'VOLUNTEER_OPEN',
      participantCount: 3,
    });
  });
});

/**
 * Матрица прав на маршрутах категорий. Пиццу уже взял Борис.
 *
 * Для отказов проверяется не только 403, но и то, что ни категория, ни
 * позиции, ни долги не изменились: отказ после записи — тоже утечка.
 */
describe('кто видит и меняет категорию', () => {
  beforeEach(async () => {
    expect((await volunteer('boris', world.pizza)).status).toBe(200);
  });

  const item = () => ({ userId: world.user.anna, itemName: 'Пепперони', price: 450 });

  it.each<[string, Who, Method, () => string, (() => object) | undefined, number]>([
    ['ответственный читает категорию', 'boris', 'get', () => `/category-orders/${world.pizza}`, undefined, 200],
    ['участник читает категорию', 'anna', 'get', () => `/category-orders/${world.pizza}`, undefined, 200],
    ['член группы не из категории не читает её', 'gleb', 'get', () => `/category-orders/${world.pizza}`, undefined, 403],
    ['посторонний не читает категорию', 'dina', 'get', () => `/category-orders/${world.pizza}`, undefined, 403],
    ['глобальный админ без членства не читает категорию', 'root', 'get', () => `/category-orders/${world.pizza}`, undefined, 403],
    ['член группы видит категории опроса', 'gleb', 'get', () => `/polls/${world.pollId}/category-orders`, undefined, 200],
    ['посторонний не видит категории опроса', 'dina', 'get', () => `/polls/${world.pollId}/category-orders`, undefined, 403],
    ['посторонний не видит прогресс', 'dina', 'get', () => `/category-orders/${world.pizza}/progress`, undefined, 403],
    ['участник не видит список участников', 'anna', 'get', () => `/category-orders/${world.pizza}/participants`, undefined, 403],
    ['участник не видит позиции', 'anna', 'get', () => `/category-orders/${world.pizza}/order-items`, undefined, 403],
    ['ответственный видит позиции', 'boris', 'get', () => `/category-orders/${world.pizza}/order-items`, undefined, 200],
    ['участник не вписывает позиции', 'anna', 'post', () => `/category-orders/${world.pizza}/order-items`, item, 403],
    ['участник не задаёт расходы', 'anna', 'put', () => `/category-orders/${world.pizza}/costs`, () => ({ deliveryCost: 120 }), 403],
    ['ответственный задаёт расходы', 'boris', 'put', () => `/category-orders/${world.pizza}/costs`, () => ({ deliveryCost: 120 }), 200],
    ['участник не закрывает расчёт', 'anna', 'post', () => `/category-orders/${world.pizza}/finalize`, undefined, 403],
    ['посторонний не откликается', 'dina', 'post', () => `/category-orders/${world.pizza}/volunteer`, undefined, 403],
  ])('%s', async (_label, who, method, path, body, expected) => {
    const before = await pizzaState();

    const response = await call(who, method, path(), body?.());

    expect(response.status).toBe(expected);
    if (expected === 403) {
      expect(response.body.code).toBe('FORBIDDEN');
      expect(await pizzaState()).toEqual(before);
    }
  });
});

describe('отклик «Я оформлю»', () => {
  it('участник категории становится её ответственным', async () => {
    const response = await volunteer('anna', world.pizza);

    expect(response.status).toBe(200);
    expect(response.body.data.responsibleUserId).toBe(world.user.anna);
    expect(await pizzaRow()).toMatchObject({
      responsibleUserId: world.user.anna,
      selectionStatus: 'SELECTED_VOLUNTEER',
    });
  });

  /* Бот не поднят (процесс с PROCESS_ROLE=api или бот снят). Раньше проверка
     «бота нет» была недостижима, и код падал ниже на обращении к API бота. */
  it('без бота отклик всё равно назначает ответственного', async () => {
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);

    const response = await volunteer('anna', world.pizza);

    expect(response.status).toBe(200);
    expect((await pizzaRow()).responsibleUserId).toBe(world.user.anna);
  });

  /* Два человека нажали одновременно. Проверка «категория свободна» в обоих
     запросах видит её свободной — назначение обязано быть условной записью,
     иначе второй молча перезапишет первого, и долги уйдут не тому, кто
     оформил заказ. Второму раньше отвечали успехом. */
  it('одновременные отклики: ответственный один, остальные получают 409', async () => {
    const people: Who[] = ['anna', 'boris', 'vera'];
    /* Входим заранее: иначе запросы стартуют вразнобой, по мере входа, и
       гонки не получается. */
    for (const who of people) await authOf(who);

    const responses = await Promise.all(people.map(who => volunteer(who, world.pizza)));

    expect(responses.map(r => r.status).sort()).toEqual([200, 409, 409]);
    for (const loser of responses.filter(r => r.status === 409)) {
      expect(loser.body.code).toBe('VOLUNTEER_NOT_AVAILABLE');
    }
    const winner = people[responses.findIndex(r => r.status === 200)];
    expect((await pizzaRow()).responsibleUserId).toBe(world.user[winner]);
  });

  it('член группы, не голосовавший за категорию, её не берёт', async () => {
    const response = await volunteer('gleb', world.pizza);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('VOLUNTEER_NOT_AVAILABLE');
    expect(await pizzaRow()).toMatchObject({
      responsibleUserId: null,
      selectionStatus: 'VOLUNTEER_OPEN',
    });
  });

  /* Один человек = одна категория: иначе одному достаются два заказа и два
     набора долгов, а вторая категория ждёт его вечно. */
  it('ответственный за одну категорию не берёт вторую', async () => {
    expect((await volunteer('anna', world.sushi)).status).toBe(200);

    const response = await volunteer('anna', world.pizza);

    expect(response.status).toBe(409);
    expect((await pizzaRow()).responsibleUserId).toBeNull();
  });
});

describe('прогресс, участники, мои категории', () => {
  /* Прогресс открыт участникам, а раньше без выбранного ответственного
     отвечал 404 «категории нет» — ровно тогда, когда участник ждёт отклика. */
  it('прогресс виден участнику и до выбора ответственного', async () => {
    const before = await call('anna', 'get', `/category-orders/${world.pizza}/progress`);
    expect(before.status).toBe(200);
    expect(before.body.data).toMatchObject({ total: 3, filled: 0, isComplete: false });

    await volunteer('boris', world.pizza);
    await enterPizzaItem('anna', 450);

    const after = await call('anna', 'get', `/category-orders/${world.pizza}/progress`);
    expect(after.body.data).toMatchObject({ total: 3, filled: 1, isComplete: false });
  });

  it('список участников отдаёт голосовавших, без telegramId', async () => {
    await volunteer('boris', world.pizza);

    const response = await call('boris', 'get', `/category-orders/${world.pizza}/participants`);

    expect(response.status).toBe(200);
    const ids = response.body.data.map((person: { id: number }) => person.id).sort();
    expect(ids).toEqual([world.user.anna, world.user.boris, world.user.vera].sort());
    for (const person of response.body.data) {
      expect(person).not.toHaveProperty('telegramId');
      expect(person).not.toHaveProperty('isAdmin');
    }
  });

  it('«мои категории» — только те, за которые человек голосовал', async () => {
    const categoriesOf = async (who: Who) => {
      const response = await call(who, 'get', `/polls/${world.pollId}/category-orders/my`);
      expect(response.status).toBe(200);
      return response.body.data.map((order: { category: string }) => order.category).sort();
    };

    expect(await categoriesOf('boris')).toEqual(['Пицца']);
    expect(await categoriesOf('anna')).toEqual(['Пицца', 'Суши']);
  });
});

describe('позиции заказа', () => {
  beforeEach(async () => {
    expect((await volunteer('boris', world.pizza)).status).toBe(200);
  });

  it('ответственный вписывает позицию участнику: цена в базе, итог пересчитан', async () => {
    const response = await enterPizzaItem('anna', 450.5, '  Пепперони  ', '  без лука ');

    expect(response.status).toBe(200);
    const [row] = await prisma.orderItem.findMany({ where: { categoryOrderId: world.pizza } });
    expect(row).toMatchObject({
      userId: world.user.anna,
      itemName: 'Пепперони',
      notes: 'без лука',
      /* Вписавший берётся из токена, а не из тела: иначе журнал врал бы,
         кто ввёл цену. */
      enteredBy: world.user.boris,
    });
    expect(money(row.price)).toBe('450.5');
    expect(money((await pizzaRow()).totalItemsAmount)).toBe('450.5');
  });

  it('пустая заметка не сохраняется пустой строкой', async () => {
    await enterPizzaItem('vera', 300, 'Маргарита', '   ');

    const [row] = await prisma.orderItem.findMany({ where: { categoryOrderId: world.pizza } });
    expect(row.notes).toBeNull();
  });

  /* Долг вешается на того, за кого вписана позиция. Вписать её тому, кто за
     категорию не голосовал, — значит выставить счёт постороннему. */
  it.each<[string, Who]>([
    ['члену группы, не голосовавшему за категорию', 'gleb'],
    ['постороннему', 'dina'],
  ])('позицию нельзя вписать %s', async (_label, forWho) => {
    const response = await enterPizzaItem(forWho, 450);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await prisma.orderItem.count()).toBe(0);
  });

  /* Пустой список участников закрывает категорию для всех, включая
     ответственного: без голосов не на кого вешать долг. */
  it('в категорию без голосов позицию не вписать никому', async () => {
    const empty = await prisma.categoryOrder.create({
      data: {
        pollId: world.pollId,
        category: 'Компот',
        responsibleUserId: world.user.anna,
        selectionStatus: 'SELECTED_AUTO',
        participantCount: 0,
      },
    });

    const response = await call('anna', 'post', `/category-orders/${empty.id}/order-items`, {
      userId: world.user.anna,
      itemName: 'Компот',
      price: 100,
    });

    expect(response.status).toBe(403);
    expect(await prisma.orderItem.count()).toBe(0);
  });

  it.each<[string, () => object]>([
    ['нулевая цена', () => ({ userId: world.user.anna, itemName: 'X', price: 0 })],
    ['отрицательная цена', () => ({ userId: world.user.anna, itemName: 'X', price: -5 })],
    ['нечисловая цена', () => ({ userId: world.user.anna, itemName: 'X', price: 'abc' })],
    ['цена сверх предела', () => ({ userId: world.user.anna, itemName: 'X', price: 1_000_001 })],
    ['название из пробелов', () => ({ userId: world.user.anna, itemName: '   ', price: 100 })],
    ['без userId', () => ({ itemName: 'X', price: 100 })],
    ['нечисловой userId', () => ({ userId: 'anna', itemName: 'X', price: 100 })],
  ])('%s — 400, позиция не создаётся', async (_label, body) => {
    const response = await call('boris', 'post', `/category-orders/${world.pizza}/order-items`, body());

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(await prisma.orderItem.count()).toBe(0);
  });

  /* Одна позиция на человека: повторный ввод правит её, а каждое изменение
     попадает в журнал — по нему администратор разбирает спор «я заказывал
     не это». */
  it('повторный ввод правит ту же позицию, журнал правок видит админ группы', async () => {
    await enterPizzaItem('anna', 450, 'Пепперони');
    await enterPizzaItem('anna', 500, 'Маргарита', 'острая');

    const items = await prisma.orderItem.findMany({ where: { categoryOrderId: world.pizza } });
    expect(items).toHaveLength(1);
    expect(money(items[0].price)).toBe('500');
    expect(money((await pizzaRow()).totalItemsAmount)).toBe('500');

    const history = await call('anna', 'get', `/order-items/${items[0].id}/edit-history`);

    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(3);
    expect(history.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldChanged: 'price', oldValue: '450', newValue: '500', editedBy: world.user.boris }),
        expect.objectContaining({ fieldChanged: 'itemName', oldValue: 'Пепперони', newValue: 'Маргарита' }),
        expect.objectContaining({ fieldChanged: 'notes', oldValue: null, newValue: 'острая' }),
      ])
    );
  });

  it('повторное сохранение без изменений журнал не пополняет', async () => {
    await enterPizzaItem('anna', 450, 'Пепперони');
    await enterPizzaItem('anna', 450, 'Пепперони');

    expect(await prisma.orderItemEditLog.count()).toBe(0);
  });

  it('ответственный удаляет позицию, итог пересчитывается', async () => {
    await enterPizzaItem('anna', 450);
    await enterPizzaItem('vera', 300);
    const anna = await prisma.orderItem.findFirstOrThrow({ where: { userId: world.user.anna } });

    const response = await call('boris', 'delete', `/order-items/${anna.id}`);

    expect(response.status).toBe(200);
    expect(await prisma.orderItem.findUnique({ where: { id: anna.id } })).toBeNull();
    expect(money((await pizzaRow()).totalItemsAmount)).toBe('300');
  });

  /* Удаляет только ответственный за заказ — даже хозяин позиции нет: иначе
     должник стёр бы свою позицию прямо перед расчётом. */
  it('хозяин позиции, не ответственный, удалить её не может', async () => {
    await enterPizzaItem('anna', 450);
    const anna = await prisma.orderItem.findFirstOrThrow({ where: { userId: world.user.anna } });

    const response = await call('anna', 'delete', `/order-items/${anna.id}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(await prisma.orderItem.findUnique({ where: { id: anna.id } })).not.toBeNull();
  });

  it('удаление несуществующей позиции — 404', async () => {
    const response = await call('boris', 'delete', '/order-items/999999');

    expect(response.status).toBe(404);
  });
});

/**
 * История правок — данные группы, и право на неё даёт роль администратора в
 * группе САМОЙ ПОЗИЦИИ. Раньше группа бралась из `?groupId` запроса:
 * администратор любой группы, прислав свой `groupId` и чужой id позиции,
 * получал историю правок чужой группы.
 */
describe('история правок: доступ', () => {
  let itemId: number;

  beforeEach(async () => {
    await volunteer('boris', world.pizza);
    await enterPizzaItem('anna', 450);
    await enterPizzaItem('anna', 500);
    itemId = (await prisma.orderItem.findFirstOrThrow({ where: { userId: world.user.anna } })).id;
  });

  it.each<[string, Who, () => string]>([
    ['администратор другой группы со своим groupId', 'egor', () => `/order-items/${itemId}/edit-history?groupId=${world.teamB}`],
    ['рядовой участник группы', 'vera', () => `/order-items/${itemId}/edit-history`],
    ['глобальный админ без членства', 'root', () => `/order-items/${itemId}/edit-history`],
    /* 403, а не 404: иначе перебором узнаются существующие id чужих позиций. */
    ['админ группы о несуществующей позиции', 'anna', () => '/order-items/999999/edit-history'],
  ])('%s получает 403', async (_label, who, path) => {
    const response = await call(who, 'get', path());

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(response.body.data).toBeUndefined();
  });
});

describe('расходы на заказ', () => {
  beforeEach(async () => {
    expect((await volunteer('boris', world.pizza)).status).toBe(200);
  });

  async function setCosts(body: object) {
    return call('boris', 'put', `/category-orders/${world.pizza}/costs`, body);
  }

  it('ответственный задаёт доставку, сервис и чаевые; итог включает позиции', async () => {
    await enterPizzaItem('anna', 450);

    /* Строковое число — так присылает форма. */
    const response = await setCosts({ deliveryCost: '150', serviceFee: 30, tip: 20 });

    expect(response.status).toBe(200);
    const row = await pizzaRow();
    expect([row.deliveryCost, row.serviceFee, row.tip].map(money)).toEqual(['150', '30', '20']);
    expect(money(row.totalAdditionalCosts)).toBe('200');
    expect(money(row.totalAmount)).toBe('650');
  });

  /* 0.1 + 0.2 в числах с плавающей точкой — 0.30000000000000004. Колонки
     Decimal, и сложение обязано быть в Decimal: иначе в базе оседает хвост, а
     на экране «333,70» превращается в «333,7000000001». */
  it('копейки расходов складываются без потери точности', async () => {
    await enterPizzaItem('anna', 333.33);

    await setCosts({ deliveryCost: 0.1, serviceFee: 0.2, tip: 0.07 });

    const row = await pizzaRow();
    expect(money(row.totalAdditionalCosts)).toBe('0.37');
    expect(money(row.totalAmount)).toBe('333.7');
  });

  /* Сумма в базе — ровно та, что ввёл человек, и пересчёт итога после новой
     позиции (он читает расходы обратно из базы) хвоста не получает. */
  // Регрессия: суммы писались JS-числом, чаевые 0.07 сохранялись как 0.07000000000000001.
  it('сохранённые расходы — ровно введённые, пересчёт после новой позиции без хвоста', async () => {
    await enterPizzaItem('anna', 333.33);
    await setCosts({ deliveryCost: 0.1, serviceFee: 0.2, tip: 0.07 });

    await enterPizzaItem('vera', 0.3);

    const row = await pizzaRow();
    expect([row.deliveryCost, row.serviceFee, row.tip].map(money)).toEqual(['0.1', '0.2', '0.07']);
    expect(money(row.totalItemsAmount)).toBe('333.63');
    expect(money(row.totalAmount)).toBe('334');
  });

  // Регрессия: null и '' превращались в 0 и стирали сохранённую сумму.
  it('null и пустая строка означают «не менять»', async () => {
    await setCosts({ deliveryCost: 150, serviceFee: 30, tip: 20 });

    const response = await setCosts({ deliveryCost: null, serviceFee: '', tip: 25 });

    expect(response.status).toBe(200);
    const row = await pizzaRow();
    expect([row.deliveryCost, row.serviceFee, row.tip].map(money)).toEqual(['150', '30', '25']);
  });

  it.each<[string, object]>([
    ['отрицательная доставка', { deliveryCost: -1 }],
    ['отрицательный сервис', { serviceFee: -0.01 }],
    ['нечисловые чаевые', { tip: 'abc' }],
    ['доставка сверх предела', { deliveryCost: 1_000_001 }],
  ])('%s — 400, расходы не меняются', async (_label, body) => {
    await setCosts({ deliveryCost: 150, serviceFee: 30, tip: 20 });
    const before = await pizzaRow();

    const response = await setCosts(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(await pizzaRow()).toEqual(before);
  });

  /* После закрытия расчёта долги уже созданы по старым суммам. Правка
     расходов разошлась бы с ними, а раньше отвечала «ошибкой сервера». */
  it('после закрытия расчёта расходы не меняются — 409', async () => {
    await enterPizzaItem('anna', 500);
    await enterPizzaItem('boris', 450);
    await enterPizzaItem('vera', 300);
    await setCosts({ deliveryCost: 100 });
    expect((await call('boris', 'post', `/category-orders/${world.pizza}/finalize`)).status).toBe(200);
    const before = await pizzaRow();

    const response = await setCosts({ deliveryCost: 999 });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CALCULATION_COMPLETED');
    expect(await pizzaRow()).toEqual(before);
  });
});

/**
 * Закрытие расчёта: долги появляются в базе.
 *
 * Пицца на троих, ответственный Борис. Позиции: Анна 500, Борис 450,
 * Вера 300,50. Доставка 100 и чаевые 50 делятся на ВСЕХ троих в целых
 * копейках: 100 → 33,34 + 33,33 + 33,33; 50 → 16,67 + 16,67 + 16,66. Лишние
 * копейки достаются должникам по возрастанию id, последняя доля — Борису, и
 * её в долгах нет: он уже заплатил весь счёт и сам себе не должен.
 */
describe('закрытие расчёта', () => {
  beforeEach(async () => {
    expect((await volunteer('boris', world.pizza)).status).toBe(200);
  });

  async function fillPizza(skip?: Who) {
    const prices: Array<[Who, number]> = [
      ['anna', 500],
      ['boris', 450],
      ['vera', 300.5],
    ];
    for (const [who, price] of prices) {
      if (who !== skip) {
        expect((await enterPizzaItem(who, price)).status).toBe(200);
      }
    }
    await call('boris', 'put', `/category-orders/${world.pizza}/costs`, {
      deliveryCost: 100,
      serviceFee: 0,
      tip: 50,
    });
  }

  const finalize = () => call('boris', 'post', `/category-orders/${world.pizza}/finalize`);

  it('долги в копейках: позиция плюс доля расходов, ответственный себе не должен', async () => {
    await fillPizza();

    const response = await finalize();

    expect(response.status).toBe(200);
    expect(response.body.data.transactionsCreated).toBe(2);

    const debts = await pizzaDebts();
    expect(
      debts.map(debt => ({
        from: debt.fromUserId,
        to: debt.toUserId,
        amount: money(debt.amount),
        item: money(debt.itemPrice),
        delivery: money(debt.deliveryShare),
        service: money(debt.serviceShare),
        tip: money(debt.tipShare),
        status: debt.status,
        pollId: debt.pollId,
      }))
    ).toEqual([
      {
        from: world.user.anna,
        to: world.user.boris,
        amount: '550.01',
        item: '500',
        delivery: '33.34',
        service: '0',
        tip: '16.67',
        status: 'PENDING',
        pollId: world.pollId,
      },
      {
        from: world.user.vera,
        to: world.user.boris,
        amount: '350.5',
        item: '300.5',
        delivery: '33.33',
        service: '0',
        tip: '16.67',
        status: 'PENDING',
        pollId: world.pollId,
      },
    ]);
    expect((await pizzaRow()).calculationStatus).toBe('COMPLETED');
  });

  /* У каждого должника уже висит «⏳ Ожидаем расчёт» от отклика
     ответственного. Расчёт обязан переписать его, а не прислать второе, и
     запомнить id сообщения на долге — по нему потом правится статус оплаты. */
  it('должнику правится сообщение «ожидаем расчёт», его id остаётся на долге', async () => {
    await fillPizza();
    const waiting = JSON.parse((await pizzaRow()).participantMessages!) as Record<
      string,
      { messageId: number; chatId: string }
    >;
    const sentBefore = botCalls.filter(c => c.method === 'send').length;

    await finalize();

    const annaDebt = (await pizzaDebts()).find(d => d.fromUserId === world.user.anna)!;
    expect(annaDebt.debtMessageId).toBe(waiting[String(world.user.anna)].messageId);
    expect(annaDebt.debtChatId).toBe(String(TELEGRAM.anna));
    expect(botCalls.filter(c => c.method === 'send')).toHaveLength(sentBefore);
    expect(botCalls.filter(c => c.method === 'edit' && c.chatId === String(TELEGRAM.anna))).toHaveLength(1);
  });

  /* Раньше любой отказ расчёта приходил как 500 «ошибка сервера», и
     ответственный нажимал снова. */
  it('не у всех вписана позиция — 409, долгов нет, расчёт открыт', async () => {
    await fillPizza('vera');

    const response = await finalize();

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('CALCULATION_NOT_READY');
    expect(await pizzaDebts()).toHaveLength(0);
    expect((await pizzaRow()).calculationStatus).toBe('PENDING');
  });

  /* Рассылка о долгах — best-effort: без бота расчёт обязан закрыться, а
     записанные долги остаться. Раньше отсутствие бота роняло код ниже проверки. */
  it('без бота расчёт закрывается и долги записаны', async () => {
    await fillPizza();
    setBotInstance(null as unknown as Parameters<typeof setBotInstance>[0]);

    const response = await finalize();

    expect(response.status).toBe(200);
    expect((await pizzaDebts()).map(d => d.fromUserId)).toEqual([world.user.anna, world.user.vera]);
  });

  it('повторное закрытие не создаёт второй комплект и не шлёт уведомления снова', async () => {
    await fillPizza();
    expect((await finalize()).status).toBe(200);
    const debtsAfterFirst = await pizzaDebts();
    const callsAfterFirst = botCalls.length;

    const second = await finalize();

    expect(second.status).toBe(200);
    expect(await pizzaDebts()).toEqual(debtsAfterFirst);
    expect(botCalls).toHaveLength(callsAfterFirst);
  });

  /* Двойной тап «Закрыть расчёт». Ключи идемпотентности разные — это два
     нажатия, и защищать обязан переход статуса в базе. */
  it('два одновременных закрытия дают один комплект долгов', async () => {
    await fillPizza();

    const responses = await Promise.all([finalize(), finalize()]);

    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const debts = await pizzaDebts();
    expect(debts.map(d => d.fromUserId)).toEqual([world.user.anna, world.user.vera]);
    /* И сообщение о долге должник получил одно, а не по одному на нажатие. */
    expect(botCalls.filter(c => c.method === 'edit' && c.chatId === String(TELEGRAM.anna))).toHaveLength(1);
  });
});
