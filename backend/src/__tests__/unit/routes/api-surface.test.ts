/**
 * Поверхность HTTP API целиком.
 *
 * Файлы маршрутов — декларации, и ошибка в них не ловится ни типами, ни
 * тестами сервисов: опечатка в пути или потерянный `telegramAuthMiddleware`
 * выглядят как рабочий код и падают только у пользователя. Здесь зафиксированы
 * метод и путь каждого эндпоинта: удалённый маршрут, переехавший путь и новый
 * эндпоинт, забытый в документации, роняют тест.
 *
 * Число обработчиков не проверяем поимённо (оно меняется от любой правки
 * middleware), но проверяем то, что важно: маршрутам голосований обязателен
 * middleware помимо контроллера, а router.use-цепочка не должна исчезнуть.
 */
import type { Router } from 'express';

import { resetPrismaMock } from '../../helpers/prisma-mock';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

interface Endpoint {
  method: string;
  path: string;
  handlers: number;
}

/** Раскладывает router.stack в плоский список эндпоинтов. */
function listEndpoints(router: Router): Endpoint[] {
  const stack = (router as unknown as { stack: unknown[] }).stack;
  const endpoints: Endpoint[] = [];

  for (const layer of stack as Array<{
    route?: {
      path: string;
      methods: Record<string, boolean>;
      stack: unknown[];
    };
  }>) {
    if (!layer.route) continue;
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (!enabled) continue;
      endpoints.push({
        method: method.toUpperCase(),
        path: layer.route.path,
        handlers: layer.route.stack.length,
      });
    }
  }

  return endpoints;
}

/** Количество router.use-слоёв без собственного маршрута (общие middleware). */
function countSharedMiddleware(router: Router): number {
  const stack = (router as unknown as { stack: Array<{ route?: unknown }> })
    .stack;
  return stack.filter(layer => !layer.route).length;
}

function loadRouter(name: string): Router {
   
  return require(`../../../api/routes/${name}`).default as Router;
}

function surface(name: string): string[] {
  return listEndpoints(loadRouter(name)).map(e => `${e.method} ${e.path}`);
}

beforeEach(() => {
  resetPrismaMock();
});

describe('маршруты голосований', () => {
  it('объявляют ожидаемый набор эндпоинтов', () => {
    expect(surface('poll.routes')).toEqual([
      'GET /',
      'GET /active',
      'GET /history',
      'GET /stats',
      'GET /user-stats/my',
      'GET /user-stats/:userId',
      'GET /popular-items',
      'GET /last-completed',
      'GET /today-completed/:groupId',
      'POST /repeat/:id',
      'GET /:id',
      'GET /:id/results',
      'GET /:id/votes',
      'GET /:id/my-votes',
      'POST /',
      'POST /create-from-webapp',
      'GET /active/:groupId',
      'PATCH /:id/complete',
      'PATCH /:id/complete-multi',
      'PATCH /:id/cancel',
      'POST /:id/vote',
      'POST /:id/vote-multiple',
      'DELETE /:id/vote',
      'POST /:id/roulette',
    ]);
  });

  it('специфичные пути объявлены раньше параметрического /:id', () => {
    const paths = surface('poll.routes').map(e => e.split(' ')[1]);

    // Express берёт первое совпадение: если /:id окажется выше /active,
    // запрос за активными голосованиями уйдёт в getPollById со строкой "active".
    for (const specific of [
      '/active',
      '/history',
      '/stats',
      '/last-completed',
      '/popular-items',
      '/user-stats/my',
    ]) {
      expect(paths.indexOf(specific)).toBeLessThan(paths.indexOf('/:id'));
    }
  });

  it('каждый эндпоинт защищён минимум одним middleware помимо контроллера', () => {
    for (const endpoint of listEndpoints(loadRouter('poll.routes'))) {
      expect(endpoint.handlers).toBeGreaterThanOrEqual(2);
    }
  });

  it('мутации идут через idempotency-middleware (3+ обработчика)', () => {
    const mutations = listEndpoints(loadRouter('poll.routes')).filter(e =>
      ['POST', 'PATCH', 'DELETE'].includes(e.method)
    );

    expect(mutations).not.toHaveLength(0);
    for (const endpoint of mutations) {
      expect(endpoint.handlers).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('поверхность остальных групп маршрутов', () => {
  const expected: Record<string, string[]> = {
    'auth.routes': [
      'POST /validate',
      'GET /me',
      'GET /status',
      'POST /refresh',
    ],
    'menu.routes': [
      'GET /',
      'GET /active',
      'GET /popular',
      'GET /stats',
      'GET /search',
      'GET /:id',
      'POST /',
      'PUT /:id',
      'PATCH /:id/toggle',
      'DELETE /:id',
      'PATCH /bulk-status',
    ],
    'vote.routes': [
      'POST /multiple',
      'GET /:pollId/user',
      'DELETE /:pollId/item/:menuItemId',
    ],
    'budget.routes': [
      'GET /debts',
      'GET /credits',
      'GET /stats',
      'GET /poll-totals/:pollId',
      'GET /order-costs/:pollId',
      'GET /poll-breakdown/:pollId',
      'POST /mark-paid',
      'POST /confirm-payment',
      'POST /undo-confirmation',
      'POST /cancel-mark',
      'POST /mark-all-paid',
      'POST /send-reminder',
      'POST /send-reminders-all',
      'POST /order-costs/:pollId',
    ],
    'user.routes': [
      'GET /me',
      'GET /payment-info',
      'PUT /payment-info',
      'GET /groups',
      'GET /:userId/avatar',
      'POST /avatars/batch',
    ],
    'health.routes': ['GET /', 'GET /ready', 'GET /live'],
    'metrics.routes': ['GET /', 'GET /detailed', 'GET /sse'],
    'sse.routes': ['GET /polls/:pollId/stream', 'GET /sse/me/stream'],
    'avatar.routes': ['GET /:fileId'],
    'donation.routes': ['POST /stars'],
    'feedback.routes': ['POST /'],
    'insights.routes': [
      'GET /budget',
      'GET /budget/:userId',
      'GET /categories',
    ],
    'notification.routes': [
      'POST /remind-admin',
      'GET /cooldown/:groupId',
    ],
    'gamification.routes': [
      'GET /user/stats',
      'GET /user/achievements',
      'GET /user/quests',
      'GET /user/xp-history',
      'GET /leaderboard',
      'POST /admin/award-xp',
      'POST /admin/recalculate-ratings',
    ],
    'menu-suggestion.routes': [
      'POST /',
      'GET /',
      'GET /stats',
      'GET /pending-count',
      'GET /:id',
      'POST /:id/approve',
      'POST /:id/reject',
      'DELETE /:id',
    ],
    'recurring-poll.routes': [
      'GET /:groupId',
      'POST /',
      'PATCH /:id',
      'DELETE /:id',
      'PATCH /:id/toggle',
      'GET /:groupId/history',
    ],
    'season.routes': [
      'GET /',
      'GET /current',
      'GET /current/stats/:userId',
      'GET /:id',
      'GET /:id/leaderboard',
      'GET /:id/stats/:userId',
      'POST /rotate',
      'POST /create',
    ],
    'store-run.routes': [
      'GET /active',
      'GET /:id',
      'POST /',
      'POST /:id/items',
      'PATCH /:id/items/:itemId',
      'DELETE /:id/items/:itemId',
      'POST /:id/items/:itemId/price',
      'POST /:id/start-shopping',
      'POST /:id/settle',
      'POST /:id/cancel',
    ],
    'category-order.routes': [
      'GET /polls/:pollId/category-orders',
      'GET /polls/:pollId/category-orders/my',
      'GET /category-orders/:id',
      'POST /category-orders/:id/order-items',
      'DELETE /order-items/:id',
      'GET /category-orders/:id/progress',
      'GET /category-orders/:id/participants',
      'POST /category-orders/:id/finalize',
      'POST /category-orders/:id/volunteer',
      'PUT /category-orders/:id/costs',
      'GET /order-items/:id/edit-history',
      'GET /category-orders/:id/order-items',
    ],
    'admin.routes': [
      'GET /users',
      'GET /users/:userId/stats',
      'PUT /users/:userId/admin',
      'PUT /users/:userId/active',
      'PUT /users/:userId/participates-in-polls',
      'GET /polls/:pollId/participants',
      'PUT /polls/:pollId/participants/:userId',
      'GET /debtors',
      'GET /debt-stats',
      'POST /debts/:debtId/forgive',
      'POST /debts/remind-all',
      'POST /debts/:debtId/remind',
      'DELETE /cleanup/old-polls',
      'DELETE /cleanup/old-transactions',
      'GET /cleanup/stats',
      'GET /cleanup/preview',
      'GET /reminder-settings/:groupId',
      'PUT /reminder-settings/:groupId',
      'GET /notification-settings/:groupId',
      'PUT /notification-settings/:groupId',
    ],
    'test.routes': [
      'GET /sentry-error',
      'GET /sentry-message',
      'GET /slow-request',
      'GET /memory-leak',
      'GET /database-error',
    ],
  };

  it.each(Object.keys(expected))('%s объявляет ровно ожидаемые пути', name => {
    expect(surface(name)).toEqual(expected[name]);
  });

  it.each([
    ['budget.routes', 1],
    ['admin.routes', 1],
    ['gamification.routes', 1],
    ['insights.routes', 1],
    ['store-run.routes', 1],
    ['recurring-poll.routes', 1],
    ['menu-suggestion.routes', 1],
  ])(
    '%s применяет общий middleware через router.use (иначе часть эндпоинтов открыта)',
    (name, minimum) => {
      expect(countSharedMiddleware(loadRouter(name))).toBeGreaterThanOrEqual(
        minimum
      );
    }
  );

  it('ни один маршрут не объявлен дважды в одной группе', () => {
    for (const name of Object.keys(expected)) {
      const paths = surface(name);
      expect(new Set(paths).size).toBe(paths.length);
    }
  });
});
