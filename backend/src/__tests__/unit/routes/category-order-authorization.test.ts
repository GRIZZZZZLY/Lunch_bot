/**
 * Проводка авторизации на маршрутах категорийных заказов.
 *
 * Зачем такой тест вообще нужен. Задача 04 сняла проверки доступа из
 * контроллеров и перенесла их в middleware. После этого handler, вызванный
 * напрямую, никакой авторизации не делает — и это правильно. Но тогда вся
 * гарантия сводится к одной фразе: «на маршруте стоит нужный guard». Ничем,
 * кроме чтения файла маршрутов, она больше не держалась: новый эндпоинт без
 * guard'а компилируется, проходит все тесты сервисов и открывает чужие данные.
 *
 * Какой guard на каком маршруте, проверяют эндпоинт-тесты
 * integration/api/category-orders.redis.test.ts. Здесь остаётся порядок слоёв.
 */
import type { Router } from 'express';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

interface RouteEntry {
  method: string;
  path: string;
  /** Имена функций в цепочке, в порядке исполнения. */
  chain: string[];
}

function listRoutes(router: Router): RouteEntry[] {
  const stack = (router as unknown as { stack: unknown[] }).stack;
  const out: RouteEntry[] = [];

  for (const layer of stack as Array<{
    route?: {
      path: string;
      methods: Record<string, boolean>;
      stack: Array<{ handle?: { name?: string } }>;
    };
  }>) {
    if (!layer.route) continue;
    const chain = layer.route.stack.map(s => s.handle?.name || '<anonymous>');
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (!enabled) continue;
      out.push({ method: method.toUpperCase(), path: layer.route.path, chain });
    }
  }
  return out;
}

let routes: RouteEntry[];

beforeAll(async () => {
  const mod = await import('../../../api/routes/category-order.routes');
  routes = listRoutes(mod.default);
});

describe('маршруты категорийных заказов', () => {
  it('все маршруты аутентифицированы', () => {
    const unauthenticated = routes
      .filter(r => !r.chain.includes('telegramAuthMiddleware'))
      .map(r => `${r.method} ${r.path}`);

    expect(unauthenticated).toEqual([]);
  });

  /* Все guard'ы читают req.user, поэтому обязаны стоять ПОСЛЕ аутентификации.
     Перестановка «для красоты» превратила бы проверку в чтение undefined. */
  it('guard авторизации идёт после аутентификации', () => {
    for (const r of routes) {
      const authAt = r.chain.indexOf('telegramAuthMiddleware');
      const guardAt = r.chain.findIndex(n => n.startsWith('require'));
      if (guardAt < 0) continue;
      expect(guardAt).toBeGreaterThan(authAt);
    }
  });

  /* Идемпотентность — ПОСЛЕ авторизации: иначе отказ успел бы записаться как
     результат идемпотентной операции и повторный запрос вернул бы его же. */
  it('идемпотентность применяется после авторизации', () => {
    const idempotent = routes.filter(r =>
      r.chain.some(n => n.toLowerCase().includes('idempotency'))
    );
    expect(idempotent.length).toBeGreaterThan(0);

    for (const r of idempotent) {
      const idemAt = r.chain.findIndex(n =>
        n.toLowerCase().includes('idempotency')
      );
      const guardAt = r.chain.findIndex(n => n.startsWith('require'));
      if (guardAt < 0) continue;
      expect(idemAt).toBeGreaterThan(guardAt);
    }
  });
});
