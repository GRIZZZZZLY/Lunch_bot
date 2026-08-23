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
 * Здесь эта фраза становится проверяемой. Ожидаемое соответствие взято из
 * матрицы `tech_debt/04-auth-matrix.md`.
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

/** `метод путь` → guard, который ОБЯЗАН быть в цепочке. */
const EXPECTED_GUARD: Record<string, string> = {
  'GET /polls/:pollId/category-orders': 'requirePollAccess',
  'GET /polls/:pollId/category-orders/my': 'requirePollAccess',
  'GET /category-orders/:id': 'requireCategoryOrderParticipant',
  'GET /category-orders/:id/progress': 'requireCategoryOrderParticipant',
  'GET /category-orders/:id/participants': 'requireCategoryOrderResponsible',
  'GET /category-orders/:id/order-items': 'requireCategoryOrderResponsible',
  'POST /category-orders/:id/order-items': 'requireCategoryOrderResponsible',
  'POST /category-orders/:id/finalize': 'requireCategoryOrderResponsible',
  'POST /category-orders/:id/volunteer': 'requireCategoryOrderPollAccess',
  'PUT /category-orders/:id/costs': 'requireCategoryOrderResponsible',
  'GET /order-items/:id/edit-history': 'requireOrderItemGroupAdmin',
};

/**
 * Единственный маршрут без guard'а на цепочке — и это разобрано в матрице:
 * здесь `:id` относится к ПОЗИЦИИ, а не к категорийному заказу, поэтому
 * middleware по `:id` проверял бы не ту сущность. Проверка осталась в
 * `deleteOrderItem`, где сначала выясняется, какому заказу позиция принадлежит.
 */
const KNOWN_WITHOUT_GUARD = ['DELETE /order-items/:id'];

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

  it('у каждого маршрута стоит ожидаемый guard авторизации', () => {
    const actual: Record<string, string | null> = {};
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      const guard = r.chain.find(name => name.startsWith('require'));
      actual[key] = guard ?? null;
    }

    const expected: Record<string, string | null> = { ...EXPECTED_GUARD };
    for (const key of KNOWN_WITHOUT_GUARD) expected[key] = null;

    expect(actual).toEqual(expected);
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

  /**
   * Полные цепочки, целиком. Это дублирует проверки выше — и намеренно:
   * порядок здесь виден глазами, а не выводится из четырёх отдельных
   * утверждений. `<anonymous>` — это `writeLimiter` из express-rate-limit,
   * у него нет имени функции; он стоит ДО авторизации осознанно, потому что
   * guard'ы ходят в базу и без лимита их можно дёргать чужими id без конца.
   */
  it('цепочки middleware закреплены целиком', () => {
    const actual = Object.fromEntries(
      routes.map(r => [`${r.method} ${r.path}`, r.chain.join(' | ')])
    );

    expect(actual).toEqual({
      'GET /polls/:pollId/category-orders':
        'telegramAuthMiddleware | requirePollAccess | getCategoryOrdersForPoll',
      'GET /polls/:pollId/category-orders/my':
        'telegramAuthMiddleware | requirePollAccess | getMyCategoryOrdersForPoll',
      'GET /category-orders/:id':
        'telegramAuthMiddleware | requireCategoryOrderParticipant | getCategoryOrder',
      'GET /category-orders/:id/progress':
        'telegramAuthMiddleware | requireCategoryOrderParticipant | getProgress',
      'GET /category-orders/:id/participants':
        'telegramAuthMiddleware | requireCategoryOrderResponsible | getParticipants',
      'GET /category-orders/:id/order-items':
        'telegramAuthMiddleware | requireCategoryOrderResponsible | getOrderItems',
      'GET /order-items/:id/edit-history':
        'telegramAuthMiddleware | requireOrderItemGroupAdmin | getEditHistory',
      'POST /category-orders/:id/order-items':
        'telegramAuthMiddleware | <anonymous> | requireCategoryOrderResponsible | idempotencyMiddleware | saveOrderItem',
      'POST /category-orders/:id/finalize':
        'telegramAuthMiddleware | <anonymous> | requireCategoryOrderResponsible | idempotencyMiddleware | finalizeCalculation',
      'POST /category-orders/:id/volunteer':
        'telegramAuthMiddleware | <anonymous> | requireCategoryOrderPollAccess | idempotencyMiddleware | volunteerForCategory',
      'PUT /category-orders/:id/costs':
        'telegramAuthMiddleware | <anonymous> | requireCategoryOrderResponsible | idempotencyMiddleware | updateCosts',
      'DELETE /order-items/:id':
        'telegramAuthMiddleware | <anonymous> | idempotencyMiddleware | deleteOrderItem',
    });
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
