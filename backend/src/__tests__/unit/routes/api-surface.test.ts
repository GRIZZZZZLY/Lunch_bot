/**
 * Изменяющие маршруты голосований идут через idempotency-middleware.
 *
 * Без него повторное нажатие или сетевой ретрай клиента создаёт второй опрос
 * или второй голос. Слой ищется по имени, как в param-validation.test.ts:
 * число обработчиков ничего не доказывает, слоем может оказаться валидатор.
 *
 * Что маршруты защищены аутентификацией, не затенены и не объявлены дважды,
 * проверяет integration/api/auth-surface.routes.test.ts.
 */
import type { Router } from 'express';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle?: { name?: string } }>;
  };
}

it('каждая мутация poll.routes проходит через idempotency-middleware', () => {
  const router = require('../../../api/routes/poll.routes').default as Router;
  const stack = (router as unknown as { stack: RouteLayer[] }).stack;

  const mutations: string[] = [];
  const withoutKey: string[] = [];
  for (const { route } of stack) {
    if (!route) continue;
    for (const method of Object.keys(route.methods)) {
      if (!['post', 'put', 'patch', 'delete'].includes(method)) continue;
      const key = `${method.toUpperCase()} ${route.path}`;
      mutations.push(key);
      const names = route.stack.map(layer => layer.handle?.name ?? '');
      if (!names.some(name => name.toLowerCase().includes('idempotency'))) {
        withoutKey.push(key);
      }
    }
  }

  expect(mutations).not.toHaveLength(0);
  expect(withoutKey).toEqual([]);
});
