/**
 * Сборка Express-приложения. Здесь настраивается всё, что защищает и отдаёт
 * приложение: CSP, trust proxy, кэш статики, порядок middleware. Ошибка тут
 * видна не как падение, а как «перестал работать Telegram» или «клиенты держат
 * старую сборку неделю».
 *
 * Проверяется через реальные запросы (supertest) к настоящему приложению —
 * замоканы только маршруты, чтобы тест не зависел от базы.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';



/** Все группы маршрутов заменяются пустым роутером: проверяется каркас. */
const ROUTE_MODULES = [
  'auth.routes',
  'menu.routes',
  'menu-suggestion.routes',
  'poll.routes',
  'user.routes',
  'budget.routes',
  'metrics.routes',
  'health.routes',
  'test.routes',
  'feedback.routes',
  'gamification.routes',
  'season.routes',
  'insights.routes',
  'recurring-poll.routes',
  'admin.routes',
  'category-order.routes',
  'sse.routes',
  'donation.routes',
  'vote.routes',
  'notification.routes',
  'store-run.routes',
  'group-store.routes',
  'item-preset.routes',
  'avatar.routes',
];

for (const name of ROUTE_MODULES) {
  jest.mock(`../../../api/routes/${name}`, () => ({
    __esModule: true,
    default: require('express').Router(),
  }));
}

/* Здесь только те middleware, которые навешивает САМ server.ts. Всё, что
   навешивают роутеры, сюда не относится: каждый роутер подменён выше пустым
   Router, и его настоящий модуль не загружается вовсе. Новый роутер нужно
   вписывать в ROUTE_MODULES, а не дополнять этот мок — иначе он потянет за
   собой telegram-auth и jwt.service, а тот в проверках с NODE_ENV=production
   требует секрет от 64 символов и роняет набор. */
jest.mock('../../../api/middleware/rate-limiter', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../api/middleware/metrics', () => ({
  metricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

type ServerModule = typeof import('../../../api/server');

/** Каталог сборки фронтенда с настоящим index.html — его отдаёт SPA-fallback. */
let frontendDir: string;
let existsSpy: jest.SpyInstance;

/* Сервер читает конфигурацию при импорте, поэтому под разные наборы переменных
   окружения нужен свой экземпляр модуля. Но каждый isolateModules заново тянет
   весь граф приложения (helmet, роуты, Prisma), а под `--coverage` он ещё и
   инструментируется — 26 загрузок в этом файле давали минуты и падение по
   таймауту на загруженной машине. Кэшируем по тем переменным, которые сервер и
   api.config действительно читают: наборов остаётся единицы вместо 26. */
const SERVER_ENV_KEYS = [
  'NODE_ENV',
  'FRONTEND_DIR',
  'CSP_REPORT_URI',
  'TRUST_PROXY',
  'API_BODY_LIMIT',
  'ENABLE_RATE_LIMIT',
  'API_PORT',
  'API_REQUEST_TIMEOUT_MS',
  'API_HEADERS_TIMEOUT_MS',
  'API_KEEP_ALIVE_TIMEOUT_MS',
] as const;

const serverModuleCache = new Map<string, ServerModule>();

/**
 * Загрузка в обход кэша. Нужна там, где проверяется побочный эффект самой
 * загрузки: у изолированного модуля свой экземпляр мока логгера, и переиспользо-
 * ванный модуль пишет в тот, который тест уже не видит.
 */
function loadServerFresh(): ServerModule {
  let mod: ServerModule = null as unknown as ServerModule;
  jest.isolateModules(() => {
    mod = require('../../../api/server');
  });
  return mod;
}

function loadServer(): ServerModule {
  const key = SERVER_ENV_KEYS.map(name => `${name}=${process.env[name]}`).join(
    '\n'
  );
  const cached = serverModuleCache.get(key);
  if (cached) return cached;

  const mod = loadServerFresh();
  serverModuleCache.set(key, mod);
  return mod;
}

/* api.config отвергает порт 0, поэтому берём конкретный высокий порт. */
const TEST_PORT = 34567;

let envBackup: NodeJS.ProcessEnv;

beforeAll(() => {
  /* process.cwd() в тестах — каталог backend, поэтому сервер ищет
     <backend>/../<FRONTEND_DIR>/dist. Делаем настоящий каталог dist с
     настоящими файлами: тогда и express.static, и sendFile работают без
     подмены файловой системы. */
  /* Каталог создаём внутри backend/, а не в системном temp: на Windows temp
     часто на другом диске, path.relative между дисками возвращает абсолютный
     путь, и path.join(projectRoot, ...) собирает мусор. Имя БЕЗ ведущей
     точки: send отказывает любому пути с dotfile-сегментом и отвечает
     «Not Found» — и sendFile, и express.static. */
  frontendDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-frontend-'));
  fs.mkdirSync(path.join(frontendDir, 'dist'));
  fs.writeFileSync(
    path.join(frontendDir, 'dist', 'index.html'),
    '<!doctype html>ok'
  );
  fs.writeFileSync(
    path.join(frontendDir, 'dist', 'manifest.webmanifest'),
    '{"name":"Rocket Lunch"}'
  );
});

afterAll(() => {
  fs.rmSync(frontendDir, { recursive: true, force: true });
});

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };
  process.env.NODE_ENV = 'test';
  /* Сервер собирает путь как path.join(projectRoot, FRONTEND_DIR, 'dist'),
     поэтому передаём путь ОТНОСИТЕЛЬНО корня проекта, иначе join склеит
     абсолютный путь с корнем и sendFile не найдёт файлы. */
  process.env.FRONTEND_DIR = path.relative(
    path.resolve(process.cwd(), '..'),
    frontendDir
  );

  /* По умолчанию файловая система настоящая; подменяем её только в тесте про
     отсутствующий каталог сборки. */
  existsSpy = jest.spyOn(fs, 'existsSync');
});

afterEach(() => {
  existsSpy.mockRestore();
  process.env = envBackup;
});

describe('createApiServer', () => {
  it('поднимается и отвечает на /api/stats заглушкой', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/stats');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: false,
      code: 'NOT_IMPLEMENTED',
    });
  });

  it('без каталога сборки фронтенда отказывается стартовать', () => {
    existsSpy.mockReturnValue(false);
    const { createApiServer } = loadServer();

    expect(() => createApiServer()).toThrow(
      'Frontend distribution directory not found'
    );
  });

  it('выставляет CSP с nonce и разрешает Telegram', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/stats');

    const csp = response.headers['content-security-policy'];
    expect(csp).toContain('https://telegram.org');
    expect(csp).toMatch(/nonce-/);
  });

  it('nonce разный на каждый запрос', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const first = await request(app).get('/api/stats');
    const second = await request(app).get('/api/stats');

    expect(first.headers['content-security-policy']).not.toBe(
      second.headers['content-security-policy']
    );
  });

  it('в продакшене локальных адресов в CSP нет', async () => {
    process.env.NODE_ENV = 'production';
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/stats');

    const csp = response.headers['content-security-policy'];
    expect(csp).not.toContain('localhost');
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('CSP_REPORT_URI добавляется в политику', async () => {
    process.env.CSP_REPORT_URI = 'https://sentry.example/csp';
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/stats');

    expect(response.headers['content-security-policy']).toContain(
      'https://sentry.example/csp'
    );
  });

  it('разрешает встраивание в Telegram Web и не отдаёт X-Frame-Options', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/stats');

    expect(response.headers['content-security-policy']).toContain(
      "frame-ancestors 'self' https://web.telegram.org"
    );
    expect(response.headers['x-frame-options']).toBeUndefined();
  });

  it('BigInt в JSON превращается в строку, а не роняет сериализацию', () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    /* Маршрут, добавленный после сборки, недостижим — он оказался бы за
       SPA-fallback. Поэтому проверяем сам настроенный replacer. */
    const replacer = app.get('json replacer') as (
      key: string,
      value: unknown
    ) => unknown;

    expect(replacer('id', BigInt('9007199254740993'))).toBe('9007199254740993');
    expect(replacer('name', 'Игорь')).toBe('Игорь');
  });

  it.each([
    ['true', true],
    ['false', false],
    ['2', 2],
  ])('TRUST_PROXY=%s превращается в настройку %p', async (value, expected) => {
    process.env.TRUST_PROXY = value;
    const { createApiServer } = loadServer();
    const app = createApiServer();

    expect(app.get('trust proxy')).toBe(expected);
  });

  it('мусор в TRUST_PROXY трактуется как один прокси', () => {
    process.env.TRUST_PROXY = 'что-то';
    const { createApiServer } = loadServer();
    const app = createApiServer();

    expect(app.get('trust proxy')).toBe(1);
  });

  it('в продакшене по умолчанию доверяет одному прокси', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_PROXY;
    const { createApiServer } = loadServer();
    const app = createApiServer();

    expect(app.get('trust proxy')).toBe(1);
  });

  it('вне продакшена по умолчанию не доверяет прокси', () => {
    delete process.env.TRUST_PROXY;
    const { createApiServer } = loadServer();
    const app = createApiServer();

    expect(app.get('trust proxy')).toBe(false);
  });

  it('тело запроса ограничено по размеру', async () => {
    process.env.API_BODY_LIMIT = '1kb';
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app)
      .post('/api/stats')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ big: 'x'.repeat(5000) }));

    expect(response.status).toBe(413);
  });

  it('отдаёт манифест с правильным типом', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/manifest.webmanifest');

    expect(response.headers['content-type']).toContain(
      'application/manifest+json'
    );
  });

  /* Класс политики, а не точная строка: секунды max-age можно менять.
     no-store — точки входа, которые обязаны обновиться сразу; immutable —
     только файлы с хешем в имени; без хеша — не immutable. */
  it.each<[string, 'no-store' | 'immutable' | 'revalidate' | 'cached']>([
    ['/', 'no-store'],
    ['/index.html', 'no-store'],
    ['/sw.js', 'no-store'],
    ['/workbox-abc.js', 'no-store'],
    ['/assets/app-a1b2c3d4.js', 'immutable'],
    // настоящий хеш Vite — base64url, не шестнадцатеричный
    ['/assets/BudgetPage-Bovztort.js', 'immutable'],
    ['/assets/icon-Ab3_E-9z.png', 'immutable'],
    ['/assets/app.js', 'revalidate'],
    // картинка без хеша (public/) перепроверяется: замена логотипа видна сразу
    ['/logo-rl.png', 'revalidate'],
    ['/theme-boot.js', 'revalidate'],
    ['/fonts/onest-cyrillic.woff2', 'cached'],
    ['/assets/data.json', 'cached'],
  ])('кэширование %s — %s', async (url, policy) => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const cacheControl: string = (await request(app).get(url)).headers['cache-control'];

    if (policy === 'no-store') {
      expect(cacheControl).toContain('no-store');
      return;
    }
    expect(cacheControl).not.toContain('no-store');
    if (policy === 'immutable') {
      expect(cacheControl).toContain('immutable');
      return;
    }
    expect(cacheControl).not.toContain('immutable');
    if (policy === 'revalidate') expect(cacheControl).toContain('must-revalidate');
  });

  it('SPA-fallback отдаёт index.html на неизвестный путь', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/profile');

    expect(response.status).toBe(200);
    expect(response.text).toContain('<!doctype html>');
  });

  it('неизвестный путь под /api/ в SPA не превращается', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).get('/api/nothing-here');

    expect(response.text).not.toContain('<!doctype html>');
  });

  it('POST на неизвестный путь в SPA не превращается', async () => {
    const { createApiServer } = loadServer();
    const app = createApiServer();

    const response = await request(app).post('/profile');

    expect(response.text).not.toContain('<!doctype html>');
  });

});

describe('startApiServer / stopApiServer', () => {
  it('поднимает сокет, применяет таймауты и корректно закрывается', async () => {
    process.env.API_PORT = String(TEST_PORT);
    process.env.API_REQUEST_TIMEOUT_MS = '11000';
    process.env.API_HEADERS_TIMEOUT_MS = '12000';
    process.env.API_KEEP_ALIVE_TIMEOUT_MS = '3000';
    const { createApiServer, startApiServer, stopApiServer } = loadServer();

    const app = createApiServer();
    const server = await startApiServer(app);

    expect(server.listening).toBe(true);
    expect(server.requestTimeout).toBe(11_000);
    expect(server.headersTimeout).toBe(12_000);
    expect(server.keepAliveTimeout).toBe(3_000);

    await stopApiServer(server);

    expect(server.listening).toBe(false);
  });

  it('404-обработчик регистрируется при старте, а не при сборке', async () => {
    process.env.API_PORT = String(TEST_PORT);
    const { createApiServer, startApiServer, stopApiServer } = loadServer();

    const app = createApiServer();
    const server = await startApiServer(app);

    const response = await request(app).get('/api/nothing-here');
    expect(response.status).toBe(404);

    await stopApiServer(server);
  });

  it('занятый порт превращается в отказ промиса, а не в необработанное падение', async () => {
    process.env.API_PORT = String(TEST_PORT);
    const { createApiServer, startApiServer, stopApiServer } = loadServer();

    const first = await startApiServer(createApiServer());
    const second = loadServer();

    await expect(
      second.startApiServer(express() as unknown as express.Application)
    ).rejects.toThrow();

    await stopApiServer(first);
  });
});
