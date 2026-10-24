/**
 * Граница аутентификации через НАСТОЯЩЕЕ приложение: express, PostgreSQL,
 * настоящая подпись Telegram (HMAC от BOT_TOKEN) и настоящие JWT.
 *
 * Модульные тесты middleware проверяли решения по одному, на моках
 * сервисов. Здесь проверяется то, что видит клиент: какой маршрут пускает
 * без токена, какой токен принимается, что остаётся в базе после отказа.
 *
 * Режим обхода подписи (`SKIP_TELEGRAM_VALIDATION`) в этом файле ВЫКЛЮЧЕН:
 * вход идёт тем же путём, что в production, а initData подписывается здесь
 * же тем же алгоритмом, которым его подписывает Telegram.
 */
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { prisma } from '../../../database/client';
import { setBotInstance } from '../../../bot/bot-instance';
import { createTestApp } from '../helpers/testApp';
import { cleanDatabase } from '../helpers/fixtures';
import {
  applyEnv,
  EnvPatch,
  FALLBACK_BOT_TOKEN,
  initDataFields,
  signInitData,
  withEnv,
} from '../helpers/auth';

// ------------------------------------------------------------ таблица маршрутов

type RouteInfo = { path: string; methods: Record<string, boolean> };
type Layer = {
  route?: RouteInfo;
  handle: unknown;
  matchers: Array<(path: string) => unknown>;
};
type RouterLike = ((...args: unknown[]) => unknown) & { stack: Layer[] };

function isRouter(handle: unknown): handle is RouterLike {
  return typeof handle === 'function' && Array.isArray((handle as { stack?: unknown }).stack);
}

interface Endpoint {
  method: string;
  path: string;
}

/**
 * Маршруты одного роутера, которые никогда не получат запрос: раньше в том
 * же роутере стоит маршрут с параметром, совпадающий с их буквальным путём
 * (`GET /:id` перед `GET /active` забирает `/active` себе как id).
 */
function shadowedRoutes(prefix: string, layers: Layer[]): string[] {
  const routes = layers.filter(layer => layer.route);
  const found: string[] = [];
  routes.forEach((later, index) => {
    const literal = later.route!.path;
    if (/[:*]/.test(literal)) return;
    for (const earlier of routes.slice(0, index)) {
      const sameMethod = Object.keys(later.route!.methods).some(
        method => earlier.route!.methods[method]
      );
      if (sameMethod && earlier.route!.path !== literal && earlier.matchers.some(match => match(literal))) {
        found.push(`${prefix}${literal} затенён ${prefix}${earlier.route!.path}`);
      }
    }
  });
  return found;
}

/**
 * Приложение и его настоящая таблица маршрутов.
 *
 * Express 5 не хранит путь монтирования в слое роутера, поэтому на время
 * сборки приложения запоминаем пути из вызовов `app.use(path, ...)`, а сами
 * маршруты берём из стека каждого подключённого роутера. Так новый роутер или
 * новый маршрут попадает в проверку сам, без правки списка.
 */
function buildAppWithRouteTable() {
  const routerPrefix = new Map<unknown, string>();
  const bareMounts = new Set<string>();
  const proto = express.application as unknown as { use: (...args: unknown[]) => unknown };
  const originalUse = proto.use;
  proto.use = function recordMount(this: unknown, ...args: unknown[]) {
    if (typeof args[0] === 'string') {
      for (const handle of args.slice(1)) {
        if (isRouter(handle)) routerPrefix.set(handle, args[0]);
        else bareMounts.add(args[0]);
      }
    }
    return originalUse.apply(this, args);
  };

  let built: express.Application;
  try {
    built = createTestApp();
  } finally {
    proto.use = originalUse;
  }

  const endpoints: Endpoint[] = [];
  const routersWithoutRoutes: string[] = [];
  const shadowed: string[] = [];
  const add = (prefix: string, route: RouteInfo) => {
    const path = prefix && route.path === '/' ? prefix : prefix + route.path;
    for (const method of Object.keys(route.methods)) {
      if (method !== '_all') endpoints.push({ method, path });
    }
  };

  for (const layer of (built as unknown as { router: { stack: Layer[] } }).router.stack) {
    if (layer.route) {
      add('', layer.route);
      continue;
    }
    if (!isRouter(layer.handle)) continue;

    const prefix = routerPrefix.get(layer.handle);
    if (prefix === undefined) {
      throw new Error('Роутер подключён без пути — обходчик не знает его префикс');
    }
    let found = 0;
    for (const inner of layer.handle.stack) {
      if (inner.route) {
        add(prefix, inner.route);
        found += 1;
      } else if (isRouter(inner.handle)) {
        throw new Error(`Вложенный роутер под ${prefix} — научите обходчик спускаться глубже`);
      }
    }
    if (found === 0) routersWithoutRoutes.push(prefix);
    shadowed.push(...shadowedRoutes(prefix, layer.handle.stack));
  }

  return { app: built, endpoints, bareMounts: [...bareMounts], routersWithoutRoutes, shadowed };
}

/**
 * Маршруты, которые отвечают без JWT намеренно. Каждая строка — решение, а
 * не исключение «чтобы тест прошёл»: новый публичный маршрут добавляется сюда
 * с причиной.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  'post /api/auth/validate': 'это и есть вход: личность устанавливает подпись Telegram',
  'get /api/avatar/:fileId': '<img> не шлёт заголовков; доступ по подписи в ссылке (проверено ниже)',
  'get /health': 'проба балансировщика',
  'get /health/ready': 'проба готовности',
  'get /health/live': 'проба живости',
  'get /manifest.webmanifest': 'статический манифест PWA',
};

const PUBLIC_PREFIXES: Record<string, string> = {
  '/api/test/': 'отладочные маршруты; в production не подключаются (проверено ниже)',
};

/**
 * Пути, на которые смонтированы обработчики-функции, а не роутеры. Обходчик
 * не видит, отвечают ли они сами, поэтому каждый такой путь назван явно.
 */
const BARE_MIDDLEWARE_MOUNTS: Record<string, string> = {
  '/api': 'CORS и общий лимитер — пропускают запрос дальше',
  '/api/auth': 'лимитер входа — пропускает запрос дальше',
  '/api/stats': 'заглушка NOT_IMPLEMENTED, данных не отдаёт',
};

function isPublic({ method, path }: Endpoint): boolean {
  return (
    `${method} ${path}` in PUBLIC_ROUTES ||
    Object.keys(PUBLIC_PREFIXES).some(prefix => path.startsWith(prefix))
  );
}

// -------------------------------------------------------------------- набор

let routeTable: ReturnType<typeof buildAppWithRouteTable>;
let app: express.Application;
let savedEnv: EnvPatch;

const ANNA_TG = 700000401;
const BORIS_TG = 700000402;

async function login(
  telegramId: number,
  extra: Record<string, string> = {}
): Promise<{ accessToken: string; refreshToken: string; userId: number }> {
  const response = await request(app)
    .post('/api/auth/validate')
    .send({ initData: signInitData(initDataFields(telegramId, 'Анна', extra)) })
    .expect(200);
  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    userId: response.body.user.id,
  };
}

function me(token: string) {
  return request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  savedEnv = applyEnv({
    SKIP_TELEGRAM_VALIDATION: 'false',
    BOT_TOKEN: process.env.BOT_TOKEN || FALLBACK_BOT_TOKEN,
  });
  routeTable = buildAppWithRouteTable();
  app = routeTable.app;
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  applyEnv(savedEnv);
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('таблица маршрутов: без токена пускают только явно публичные', () => {
  /* Заменяет подсчёт «у маршрута ≥ 2 обработчиков»: слоем мог оказаться
     валидатор, и маршрут без аутентификации проходил проверку. Здесь каждый
     маршрут каждого роутера получает настоящий запрос без токена. Код
     MISSING_TOKEN отличает ответ middleware аутентификации от 401 контроллера,
     который проверяет `req.user` сам: такой маршрут уже пропустил валидацию,
     guard'ы и идемпотентность для анонима. */
  it('каждый маршрут, кроме списка публичных, отвечает 401 MISSING_TOKEN', async () => {
    expect(routeTable.routersWithoutRoutes).toEqual([]);
    expect(
      routeTable.bareMounts.filter(path => !(path in BARE_MIDDLEWARE_MOUNTS))
    ).toEqual([]);

    const protectedEndpoints = routeTable.endpoints.filter(endpoint => !isPublic(endpoint));
    expect(protectedEndpoints.length).toBeGreaterThan(0);
    const open: string[] = [];
    for (const { method, path } of protectedEndpoints) {
      const url = path.replace(/:(\w+)/g, '1');
      const response = await (request(app) as unknown as Record<string, (url: string) => request.Test>)[
        method
      ](url);
      if (response.status !== 401 || response.body?.code !== 'MISSING_TOKEN') {
        open.push(`${method.toUpperCase()} ${path} -> ${response.status} ${response.body?.code ?? ''}`);
      }
    }

    expect(open).toEqual([]);
  });

  /* Express берёт первое совпадение: окажись `/:id` выше `/active`, запрос за
     активными голосованиями ушёл бы в getPollById со строкой "active". Второе
     объявление того же метода и пути тоже никогда не вызывается. */
  it('ни один маршрут не затенён и не объявлен дважды', () => {
    const seen = new Map<string, number>();
    for (const { method, path } of routeTable.endpoints) {
      const key = `${method.toUpperCase()} ${path}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }

    expect(routeTable.shadowed).toEqual([]);
    expect([...seen].filter(([, count]) => count > 1).map(([key]) => key)).toEqual([]);
  });

  it('аватар без подписи в ссылке — 401', async () => {
    const response = await request(app).get('/api/avatar/AgACAgIAAxkBAAI');
    expect(response.status).toBe(401);
  });

  it('проба /health отвечает без токена', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});

describe('production: отладочные маршруты не подключаются', () => {
  /* /api/test/* без аутентификации отдаёт ошибки Sentry, держит запрос
     сколько попросят и раздувает память процесса. В production их не должно
     существовать вовсе. Контрольный запрос к тестовому приложению доказывает,
     что 404 — следствие режима, а не опечатки в пути. */
  it('с NODE_ENV=production каждый /api/test/* отвечает 404', async () => {
    const testRoutes = routeTable.endpoints.filter(({ path }) => path.startsWith('/api/test/'));
    expect(testRoutes.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/test/sentry-message')).status).toBe(200);

    const productionApp = await withEnv({ NODE_ENV: 'production' }, () => createTestApp());

    for (const { method, path } of testRoutes) {
      const response = await (
        request(productionApp) as unknown as Record<string, (url: string) => request.Test>
      )[method](path);
      expect(`${path} ${response.status}`).toBe(`${path} 404`);
    }
  });

  /* Mini App открывается в Telegram Web внутри iframe: X-Frame-Options или
     frame-ancestors без web.telegram.org — и вместо приложения пустая рамка.
     За nginx адрес клиента приходит в X-Forwarded-For; без доверия прокси все
     запросы выглядят пришедшими с адреса nginx и делят один лимит запросов. */
  it('разрешает встраивание в Telegram Web и доверяет прокси', async () => {
    const productionApp = await withEnv({ NODE_ENV: 'production', TRUST_PROXY: undefined }, () =>
      createTestApp()
    );

    const response = await request(productionApp).get('/health');

    expect(response.headers['x-frame-options']).toBeUndefined();
    expect(response.headers['content-security-policy']).toMatch(
      /frame-ancestors[^;]*https:\/\/web\.telegram\.org/
    );
    expect(productionApp.get('trust proxy')).toBeTruthy();
  });
});

describe('служебные маршруты /api/metrics', () => {
  /* Метрики описывают весь инстанс, поэтому право на них даёт не роль в
     группе, а секрет оператора. Токен обычного пользователя здесь есть всегда:
     проверяется, что одного его мало. */
  const SECRET = crypto.randomBytes(24).toString('hex');

  it.each<[string, EnvPatch, string | undefined, number]>([
    ['флаг выключен — 404, маршрута как будто нет', { ENABLE_OPERATIONS_API: undefined }, SECRET, 404],
    ['без заголовка секрета — 403', { ENABLE_OPERATIONS_API: 'true' }, undefined, 403],
    ['чужой секрет той же длины — 403', { ENABLE_OPERATIONS_API: 'true' }, 'f'.repeat(SECRET.length), 403],
    ['секрет другой длины — 403, а не 500', { ENABLE_OPERATIONS_API: 'true' }, `${SECRET}0`, 403],
    [
      'короткий секрет на сервере не принимается даже при совпадении — 403',
      { ENABLE_OPERATIONS_API: 'true', OPERATIONS_API_SECRET: 'short-secret' },
      'short-secret',
      403,
    ],
    [
      'секрет на сервере не задан — 403',
      { ENABLE_OPERATIONS_API: 'true', OPERATIONS_API_SECRET: undefined },
      SECRET,
      403,
    ],
    ['верный секрет — 200', { ENABLE_OPERATIONS_API: 'true' }, SECRET, 200],
  ])('%s', async (_name, env, header, expected) => {
    const { accessToken } = await login(ANNA_TG);

    const response = await withEnv({ OPERATIONS_API_SECRET: SECRET, ...env }, () => {
      const call = request(app).get('/api/metrics').set('Authorization', `Bearer ${accessToken}`);
      return header ? call.set('X-Operations-Secret', header) : call;
    });

    expect(response.status).toBe(expected);
  });
});

describe('токены на настоящем API', () => {
  it('refresh-токен в роли access не пускает: 401 INVALID_TOKEN_TYPE', async () => {
    const { refreshToken, accessToken } = await login(ANNA_TG);

    const response = await me(refreshToken);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_TOKEN_TYPE');
    expect((await me(accessToken)).status).toBe(200);
  });

  it('деактивированного пользователя не пускает ни живой access, ни refresh', async () => {
    const { accessToken, refreshToken, userId } = await login(ANNA_TG);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

    const viaAccess = await me(accessToken);
    const viaRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(viaAccess.status).toBe(401);
    expect(viaAccess.body.code).toBe('USER_NOT_ACTIVE');
    expect(viaRefresh.status).toBe(401);
    expect(viaRefresh.body.accessToken).toBeUndefined();
  });

  /* Истёкший токен собирается из НАСТОЯЩЕГО: те же iss, aud, jti и userId,
     отличается только срок. Иначе 401 мог бы прийти из-за неверного издателя,
     и тест проходил бы по чужой причине. Контроль — те же claims со сроком в
     будущем проходят. */
  it('истёкший access-токен — 401 TOKEN_EXPIRED, те же claims с живым сроком проходят', async () => {
    const { accessToken } = await login(ANNA_TG);
    const claims = jwt.decode(accessToken) as jwt.JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    const resign = (exp: number) =>
      jwt.sign({ ...claims, iat: now - 7200, exp }, (process.env.JWT_SECRET as string).trim());

    const expired = await me(resign(now - 60));
    const alive = await me(resign(now + 600));

    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('TOKEN_EXPIRED');
    expect(alive.status).toBe(200);
  });

  it('подмена userId в подписанном токене не даёт войти чужим пользователем', async () => {
    const anna = await login(ANNA_TG);
    const boris = await login(BORIS_TG);
    const [header, payload, signature] = anna.accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const forgedPayload = Buffer.from(JSON.stringify({ ...claims, userId: boris.userId })).toString(
      'base64url'
    );

    const forged = await me(`${header}.${forgedPayload}.${signature}`);

    expect(forged.status).toBe(401);
    expect(forged.body.data).toBeUndefined();
    expect((await me(anna.accessToken)).body.data.id).toBe(anna.userId);
  });
});

describe('POST /api/auth/validate', () => {
  async function usersCount(): Promise<number> {
    return prisma.user.count();
  }

  const unsigned = () =>
    new URLSearchParams(initDataFields(ANNA_TG)).toString();

  it.each<[string, () => unknown]>([
    ['без initData', () => undefined],
    ['initData не строка', () => 12345],
    ['initData из одних пробелов', () => '   '],
    ['initData длиннее 5000 символов', () => 'a'.repeat(5001)],
    ['initData без hash и signature', unsigned],
  ])('%s — 400, пользователь не создаётся', async (_name, initData) => {
    const response = await request(app).post('/api/auth/validate').send({ initData: initData() });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(await usersCount()).toBe(0);
  });

  it.each<[string, () => string]>([
    ['подпись чужим токеном бота', () => signInitData(initDataFields(ANNA_TG), '123:other-bot')],
    [
      'user подменён после подписи',
      () => {
        const params = new URLSearchParams(signInitData(initDataFields(ANNA_TG)));
        params.set('user', JSON.stringify({ id: BORIS_TG, first_name: 'Борис' }));
        return params.toString();
      },
    ],
    [
      'подпись верна, но initData перехвачен час назад',
      () =>
        signInitData({
          ...initDataFields(ANNA_TG),
          auth_date: String(Math.floor(Date.now() / 1000) - 3600),
        }),
    ],
    [
      'только signature без hash',
      () => new URLSearchParams({ ...initDataFields(ANNA_TG), signature: 'c2lnbmF0dXJl' }).toString(),
    ],
  ])('%s — 401 INVALID_INIT_DATA, пользователь не создаётся', async (_name, initData) => {
    const response = await request(app).post('/api/auth/validate').send({ initData: initData() });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_INIT_DATA');
    expect(response.body.accessToken).toBeUndefined();
    expect(await usersCount()).toBe(0);
  });

  /* Клиенты Telegram 8.0+ присылают рядом с hash ещё и signature (Ed25519).
     Это поле входит в строку проверки hash, и его наличие не должно ломать
     вход. */
  it('подписанный initData создаёт пользователя и выдаёт рабочий токен; повторный вход — тот же человек', async () => {
    const first = await request(app)
      .post('/api/auth/validate')
      .send({ initData: signInitData(initDataFields(ANNA_TG, 'Анна', { signature: 'c2lnbmF0dXJl' })) });

    expect(first.status).toBe(200);
    const stored = await prisma.user.findUnique({ where: { telegramId: BigInt(ANNA_TG) } });
    expect(stored).not.toBeNull();
    expect(first.body.user.id).toBe(stored!.id);
    expect(first.body.user.telegramId).toBe(String(ANNA_TG));

    const profile = await me(first.body.accessToken);
    expect(profile.status).toBe(200);
    expect(profile.body.data.id).toBe(stored!.id);
    expect(profile.body.data.telegramId).toBe(String(ANNA_TG));

    const second = await request(app)
      .post('/api/auth/validate')
      .send({ initData: signInitData(initDataFields(ANNA_TG, 'Анна Петровна')) });

    expect(second.body.user.id).toBe(stored!.id);
    expect(await usersCount()).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: stored!.id } }))!.firstName).toBe(
      'Анна Петровна'
    );
  });

  /* Защита в глубину: если в production по ошибке оставить
     SKIP_TELEGRAM_VALIDATION=true, вход обязан сломаться, а не пускать любого
     по неподписанному initData. */
  it('в production обход подписи не работает: вход отказан, пользователь не создаётся', async () => {
    const { accessToken } = await login(BORIS_TG);

    const [entry, protectedCall] = await withEnv(
      { NODE_ENV: 'production', SKIP_TELEGRAM_VALIDATION: 'true' },
      async () => [
        await request(app).post('/api/auth/validate').send({ initData: unsigned() }),
        await me(accessToken),
      ]
    );

    expect(entry.status).toBe(500);
    expect(entry.body.code).toBe('SECURITY_VIOLATION');
    expect(entry.body.accessToken).toBeUndefined();
    expect(await prisma.user.findUnique({ where: { telegramId: BigInt(ANNA_TG) } })).toBeNull();
    expect(protectedCall.status).toBe(500);
    expect(protectedCall.body.data).toBeUndefined();
  });

  it('чужой Origin не может войти: 403 до разбора тела, пользователь не создаётся', async () => {
    const initData = signInitData(initDataFields(ANNA_TG));

    const foreign = await request(app)
      .post('/api/auth/validate')
      .set('Origin', 'https://evil.example')
      .send({ initData });

    expect(foreign.status).toBe(403);
    expect(await usersCount()).toBe(0);
    expect((await request(app).post('/api/auth/validate').send({ initData })).status).toBe(200);
  });
});

describe('вход по ссылке из группы (start_param)', () => {
  /* Членство по ссылке выдаётся, только если Telegram подтверждает, что
     человек действительно состоит в чате группы: иначе любой, узнав номер
     голосования, вписал бы себя в чужую команду. Telegram — внешняя граница,
     подменяется он один. */
  function telegramSays(status: string): void {
    setBotInstance({
      api: {
        getChatMember: async () => ({ status }),
        sendMessage: async () => ({ message_id: 1 }),
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);
  }

  const GROUP_TG = -100000000401;

  async function groupWithPoll(): Promise<{ groupId: number; pollId: number; runId: number }> {
    const owner = await prisma.user.create({
      data: { telegramId: BigInt(ANNA_TG), firstName: 'Анна' },
    });
    const group = await prisma.group.create({
      data: { telegramId: BigInt(GROUP_TG), title: 'Команда ссылки' },
    });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: owner.id, role: 'CREATOR' },
    });
    const poll = await prisma.poll.create({
      data: { groupId: group.id, createdBy: owner.id, status: 'ACTIVE' },
    });
    const run = await prisma.storeRun.create({
      data: {
        groupId: group.id,
        initiatorId: owner.id,
        storeName: 'Лента',
        collectUntil: new Date(Date.now() + 3_600_000),
      },
    });
    return { groupId: group.id, pollId: poll.id, runId: run.id };
  }

  async function membershipOf(telegramId: number, groupId: number) {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
    return prisma.groupMember.findFirst({ where: { groupId, userId: user!.id, isActive: true } });
  }

  it.each<[string, (world: { pollId: number; runId: number }) => string]>([
    ['vote_<id голосования>', ({ pollId }) => `vote_${pollId}`],
    ['storerun_<id забега>', ({ runId }) => `storerun_${runId}`],
    ['menu_<telegramId чата>', () => `menu_${GROUP_TG}`],
    ['add_<telegramId чата>', () => `add_${GROUP_TG}`],
    ['poll_<telegramId чата>', () => `poll_${GROUP_TG}`],
  ])('%s: участник чата в Telegram попадает в группу', async (_name, startParam) => {
    const world = await groupWithPoll();
    telegramSays('member');

    await login(BORIS_TG, { start_param: startParam(world) });

    expect(await membershipOf(BORIS_TG, world.groupId)).not.toBeNull();
  });

  it('Telegram не подтверждает членство — участником не делает, вход проходит', async () => {
    const { groupId, pollId } = await groupWithPoll();
    telegramSays('left');

    await login(BORIS_TG, { start_param: `vote_${pollId}` });

    expect(await membershipOf(BORIS_TG, groupId)).toBeNull();
  });

  it('сбой проверки в Telegram — участником тоже не делает', async () => {
    const { groupId, pollId } = await groupWithPoll();
    setBotInstance({
      api: {
        getChatMember: async () => {
          throw Object.assign(new Error('Bad Request: chat not found'), { error_code: 400 });
        },
        sendMessage: async () => ({ message_id: 1 }),
      },
    } as unknown as Parameters<typeof setBotInstance>[0]);

    await login(BORIS_TG, { start_param: `vote_${pollId}` });

    expect(await membershipOf(BORIS_TG, groupId)).toBeNull();
  });

  it.each(['vote_999999', 'vote_abc', 'storerun_abc', 'menu_abc', 'menu_', 'unknown_1'])(
    'start_param %s не меняет членство и не ломает вход',
    async startParam => {
      const { groupId } = await groupWithPoll();
      telegramSays('member');

      await login(BORIS_TG, { start_param: startParam });

      expect(await membershipOf(BORIS_TG, groupId)).toBeNull();
    }
  );
});

describe('GET /api/auth/status', () => {
  /* Старый модульный тест обещал без токена `200 { authenticated: false }`,
     но на маршруте стоит telegramAuthMiddleware, и настоящий ответ — 401.
     Закреплён настоящий контракт: фронтенд опирается на 401 для повторного
     входа. */
  it('без токена — 401 MISSING_TOKEN, с токеном — authenticated и id пользователя', async () => {
    const { accessToken, userId } = await login(ANNA_TG);

    const anonymous = await request(app).get('/api/auth/status');
    const notBearer = await request(app)
      .get('/api/auth/status')
      .set('Authorization', `Basic ${accessToken}`);
    const authenticated = await request(app)
      .get('/api/auth/status')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(anonymous.status).toBe(401);
    expect(anonymous.body.code).toBe('MISSING_TOKEN');
    expect(notBearer.status).toBe(401);
    expect(notBearer.body.code).toBe('MISSING_TOKEN');
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.authenticated).toBe(true);
    expect(authenticated.body.user.id).toBe(userId);
  });
});

describe('лимитер входа (отдельный экземпляр приложения с ENABLE_RATE_LIMIT=true)', () => {
  /* Лимитеры решают, включены ли они, при загрузке модуля, а весь набор
     работает с выключенными. Поэтому приложение с лимитером собирается в
     изолированном реестре модулей. Хранилище лимитера — память процесса, и
     счёт детерминирован. Точный лимит не закрепляется: важно, что серия
     попыток упирается в 429 и окно держится. */
  let limitedApp: express.Application;
  let isolatedCache: { close: () => Promise<void> } | undefined;

  beforeAll(async () => {
    await withEnv({ ENABLE_RATE_LIMIT: 'true' }, () => {
      jest.isolateModules(() => {
        limitedApp = require('../../../api/server').createApiServer();
        isolatedCache = require('../../../services/cache.service').cacheService;
      });
    });
  });

  afterAll(async () => {
    await isolatedCache?.close();
  });

  it('серия попыток входа упирается в 429 AUTH_RATE_LIMIT, и окно держится', async () => {
    const attempt = () => request(limitedApp).post('/api/auth/validate').send({});

    expect((await attempt()).status).toBe(400);

    let limited: request.Response | undefined;
    for (let i = 0; i < 200 && !limited; i += 1) {
      const response = await attempt();
      if (response.status === 429) limited = response;
    }

    expect(limited?.body.code).toBe('AUTH_RATE_LIMIT');
    expect((await attempt()).status).toBe(429);
  });
});
