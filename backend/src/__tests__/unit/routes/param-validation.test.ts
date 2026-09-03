/**
 * Гарантия, на которой держится вся задача 02.
 *
 * Контроллеры больше не разбирают `:id` руками: они читают контракт. Разбор
 * внутри контракта отвечает 400 в любом случае, но отсекать вход НАДО раньше —
 * до middleware авторизации, которые сами читают `req.params` и с `NaN` идут в
 * базу за несуществующим ресурсом. Единственное, что это обеспечивает, — строчка
 * `<contract>.middleware` в цепочке маршрута. Забыть её ничего не мешает: код
 * компилируется, тесты сервисов проходят.
 *
 * Поэтому здесь два уровня проверки:
 *
 * 1. СТРУКТУРА — у каждого маршрута с `:параметром` контракт есть, и он стоит
 *    раньше и авторизации, и обработчика; у каждой мутации есть контракт тела,
 *    кроме перечисленных исключений с причиной.
 * 2. ПОВЕДЕНИЕ — на мусор в параметре, в теле и в query цепочка отвечает 400 и
 *    обработчик не вызывается. Мусор не выдуман руками, а сгенерирован ПО ПОЛЯМ
 *    самой схемы: тест доходит до неё через `middleware.contract`.
 *
 * Второй пункт появился не сразу, и это стоит записать. Сначала здесь
 * проверялись только `params`, а тело и query — только именами слоёв в цепочке.
 * Ревью нашло на этом два дефекта, которые тест обязан был поймать сам:
 * повторяющийся `?groupId=5&groupId=5` (фронт присылает его на восьми
 * админских эндпоинтах) давал 400, а схема с обязательными полями выключала все
 * четыре тумблера уведомлений. Оба закреплены отдельными проверками ниже.
 *
 * Роутеры, не входящие в задачу, перечислены в `NOT_WIRED_YET` — чтобы остаток
 * долга был виден здесь, а не только в `tech_debt/`.
 */
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import request from 'supertest';
import type { z } from 'zod';

import type { ContractMiddleware } from '../../../api/middleware/validate';
import { mockRequest, mockResponse } from '../../helpers/http';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

interface RouteEntry {
  method: string;
  path: string;
  chain: string[];
  /** Слои цепочки как функции — нужны, чтобы прогнать реальный запрос. */
  handles: Array<(req: Request, res: Response, next: NextFunction) => unknown>;
}

function listRoutes(router: Router): RouteEntry[] {
  const stack = (router as unknown as { stack: unknown[] }).stack;
  const out: RouteEntry[] = [];

  for (const layer of stack as Array<{
    route?: {
      path: string;
      methods: Record<string, boolean>;
      stack: Array<{ handle?: (...args: never[]) => unknown }>;
    };
  }>) {
    if (!layer.route) continue;
    const handles = layer.route.stack.map(
      s => s.handle as (req: Request, res: Response, next: NextFunction) => unknown
    );
    const chain = layer.route.stack.map(s => s.handle?.name || '<anonymous>');
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (!enabled) continue;
      out.push({ method: method.toUpperCase(), path: layer.route.path, chain, handles });
    }
  }
  return out;
}

/** Роутеры, охваченные задачей 02. */
const WIRED = [
  'poll',
  'category-order',
  'budget',
  'store-run',
  'recurring-poll',
  'menu-suggestion',
  'season',
  'admin',
  'group-store',
  'item-preset',
] as const;

/**
 * Остаток долга, названный вслух. Это не «забыли» — это следующая порция:
 * задача 02 закрывает восемь роутеров из двадцати двух, и эти четырнадцать
 * остаются с ручным разбором в контроллерах.
 */
const NOT_WIRED_YET = [
  'auth', 'avatar', 'donation', 'feedback', 'gamification', 'health',
  'insights', 'menu', 'metrics', 'notification', 'sse', 'test', 'user', 'vote',
];

/**
 * Мутации без схемы тела — с причиной на каждую: действие определяется путём,
 * а не телом.
 *
 * Ключ включает ИМЯ РОУТЕРА, и это не для красоты: пути в разных роутерах
 * совпадают. `DELETE /:id` — это и удаление расписания (тела нет), и удаление
 * предложения блюда (тело с `groupId` есть). Без имени роутера исключение,
 * выписанное одному, молча накрывало бы второго.
 */
const MUTATIONS_WITHOUT_BODY: Record<string, string> = {
  'poll: POST /repeat/:id': 'повтор берёт параметры из исходного голосования',
  'poll: PATCH /:id/complete': 'завершение не параметризуется',
  'poll: DELETE /:id/vote': 'отмена голоса определяется путём и пользователем',
  'poll: POST /:id/roulette': 'рулетка не параметризуется',
  'category-order: DELETE /order-items/:id': 'удаление определяется путём',
  'category-order: POST /category-orders/:id/finalize': 'финализация не параметризуется',
  'category-order: POST /category-orders/:id/volunteer': 'отклик не параметризуется',
  'store-run: DELETE /:id/items/:itemId': 'удаление определяется путём',
  'group-store: DELETE /:groupId/stores/:id': 'скрытие магазина определяется путём',
  'item-preset: DELETE /:id': 'удаление своего пресета определяется путём',
  'store-run: POST /:id/start-shopping': 'переход состояния не параметризуется',
  'store-run: POST /:id/settle': 'переход состояния не параметризуется',
  'store-run: POST /:id/cancel': 'переход состояния не параметризуется',
  'recurring-poll: DELETE /:id': 'удаление расписания определяется путём',
  'season: POST /rotate': 'ротация сезона не параметризуется (operations-api)',
  'season: POST /create': 'создание сезона не параметризуется (operations-api)',
  'admin: DELETE /cleanup/old-polls': 'срок приходит в query, а не в теле',
  'admin: DELETE /cleanup/old-transactions': 'срок приходит в query, а не в теле',
};

const routers: Record<string, RouteEntry[]> = {};

beforeAll(async () => {
  for (const name of WIRED) {
    const mod = await import(`../../../api/routes/${name}.routes`);
    routers[name] = listRoutes(mod.default);
  }
});

describe('валидация входа подключена на маршрутах', () => {
  it('у каждого маршрута с :параметром есть контракт params', () => {
    const missing: string[] = [];

    for (const [name, routes] of Object.entries(routers)) {
      for (const route of routes) {
        if (!route.path.includes(':')) continue;
        if (route.chain.includes('validateParams')) continue;
        missing.push(`${name}: ${route.method} ${route.path}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('контракт params стоит до авторизации и до обработчика', () => {
    for (const routes of Object.values(routers)) {
      for (const route of routes) {
        const at = route.chain.indexOf('validateParams');
        if (at < 0) continue;

        const guardAt = route.chain.findIndex(name => name.startsWith('require'));
        if (guardAt >= 0) expect(at).toBeLessThan(guardAt);

        // Обработчик всегда последний в цепочке.
        expect(at).toBeLessThan(route.chain.length - 1);
      }
    }
  });

  it('у каждой мутации есть контракт тела, кроме объяснённых исключений', () => {
    const missing: string[] = [];

    for (const [name, routes] of Object.entries(routers)) {
      for (const route of routes) {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method)) continue;
        if (route.chain.includes('validateBody')) continue;
        const key = `${name}: ${route.method} ${route.path}`;
        if (MUTATIONS_WITHOUT_BODY[key]) continue;
        missing.push(key);
      }
    }

    expect(missing).toEqual([]);
  });

  /* Список исключений обязан оставаться живым: маршрут, получивший схему тела,
     должен уйти из него, иначе список превратится в кладбище и перестанет
     что-либо утверждать. */
  it('в списке исключений нет маршрутов, у которых схема тела уже есть', () => {
    const stale: string[] = [];

    const known = new Set(Object.keys(MUTATIONS_WITHOUT_BODY));

    for (const [name, routes] of Object.entries(routers)) {
      for (const route of routes) {
        const key = `${name}: ${route.method} ${route.path}`;
        known.delete(key);
        if (MUTATIONS_WITHOUT_BODY[key] && route.chain.includes('validateBody')) {
          stale.push(`${key} — схема тела уже есть`);
        }
      }
    }

    // Исключение, выписанное несуществующему маршруту, — тоже мусор в списке.
    for (const key of known) stale.push(`${key} — такого маршрута нет`);

    expect(stale).toEqual([]);
  });

  it('контракт тела идёт после идемпотентности', () => {
    for (const routes of Object.values(routers)) {
      for (const route of routes) {
        const bodyAt = route.chain.indexOf('validateBody');
        const idemAt = route.chain.findIndex(name =>
          name.toLowerCase().includes('idempotency')
        );
        if (bodyAt >= 0 && idemAt >= 0) expect(bodyAt).toBeGreaterThan(idemAt);
      }
    }
  });
});

/**
 * Поведение. Собирается приложение из настоящих слоёв маршрута — но только до
 * обработчика: он заменён шпионом. Так проверяется именно то, что нужно —
 * мусорный параметр не доходит до контроллера, — и при этом не требуется
 * поднимать сервисы и базу.
 */
describe('мусор в :параметре — 400, обработчик не вызван', () => {
  function casesFor(routes: RouteEntry[]): RouteEntry[] {
    return routes.filter(r => r.chain.includes('validateParams'));
  }

  type Register = (
    path: string,
    ...handlers: Array<(req: Request, res: Response, next: NextFunction) => unknown>
  ) => unknown;

  it.each(WIRED)('%s', async name => {
    const routes = casesFor(routers[name] ?? []);
    expect(routes.length).toBeGreaterThan(0);

    /* ОДНО приложение на роутер, а не на маршрут. При построении приложения на
       каждый маршрут полный прогон падал с «Jest worker ran out of memory»:
       восемь роутеров тянут за собой все контроллеры и сервисы, и шестьдесят
       копий приложения этого не выдерживали. */
    const app = express();
    app.use(express.json());
    const reached: string[] = [];

    for (const route of routes) {
      const validationAt = route.chain.indexOf('validateParams');
      /* В приложение ставится РОВНО слой контракта с маршрута и заглушка вместо
         обработчика. Слои, стоявшие раньше (аутентификация, лимитеры), сюда не
         берутся намеренно: лимитер держит соединение с Redis, и тест на
         валидацию превратился бы в тест инфраструктуры — при первом прогоне он
         просто повис. Порядок слоёв закрепляют структурные проверки выше. */
      const contract = route.handles[validationAt];
      const key = `${route.method} ${route.path}`;
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';

      (app as unknown as Record<string, Register>)[method](
        route.path,
        contract,
        (_req: Request, res: Response) => {
          reached.push(key);
          res.status(200).json({ reached: true });
        }
      );
    }

    for (const route of routes) {
      /* Значение мусора латиницей: кириллица в URL требует процентного
         кодирования, и первый прогон падал на «Request path contains
         unescaped characters» — то есть проверял бы кодирование, а не схему. */
      const url = route.path.replace(/:(\w+)/g, 'abc');
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const res = await request(app)[method](url).send({});

      expect({ route: `${route.method} ${route.path}`, status: res.status }).toEqual({
        route: `${route.method} ${route.path}`,
        status: 400,
      });
      expect(res.body).toMatchObject({ success: false });
    }

    expect(reached).toEqual([]);
  });
});

/**
 * Мусор по полям СХЕМЫ, а не по фантазии автора теста.
 *
 * Схема достаётся из `middleware.contract` — иначе тест видел бы только имена
 * слоёв и не заметил бы, что схема требует поля, которых фронт не присылает.
 */
type UnknownSchema = {
  _def?: {
    typeName?: string;
    schema?: UnknownSchema;
    innerType?: UnknownSchema;
  };
  shape?: z.ZodRawShape;
};

/** Снимает `preprocess`/`refine`/`optional` до объекта. */
function unwrapObject(schema: unknown): z.ZodRawShape | null {
  let current = schema as UnknownSchema | undefined;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current._def?.typeName === 'ZodObject' && current.shape) return current.shape;
    current = current._def?.schema ?? current._def?.innerType;
  }
  return null;
}

interface ProbeTarget {
  source: 'body' | 'query';
  fields: string[];
  layer: (req: Request, res: Response, next: NextFunction) => unknown;
}

function probeTargets(routes: RouteEntry[]): ProbeTarget[] {
  const seen = new Set<unknown>();
  const out: ProbeTarget[] = [];

  for (const route of routes) {
    for (const layer of route.handles) {
      const contract = (layer as ContractMiddleware).contract;
      if (!contract || contract.source === 'params') continue;
      if (seen.has(layer)) continue;
      seen.add(layer);

      const shape = unwrapObject(contract.schema);
      expect(shape).not.toBeNull();
      out.push({
        source: contract.source,
        fields: Object.keys(shape ?? {}),
        layer,
      });
    }
  }
  return out;
}

describe('мусор в теле и query — 400 с указанием поля', () => {
  /**
   * Слой вызывается НАПРЯМУЮ, без express и без supertest.
   *
   * Не из экономии строк: первая версия строила приложение и поднимала сервер на
   * каждую проверку, и полный прогон падал с «Jest worker ran out of memory» —
   * причём на случайном чужом наборе, так что красный CI не указывал бы на
   * виновника. Express здесь и не нужен: тело и query он всего лишь кладёт в
   * `req`, а разбор пути проверяется отдельно, сверху, настоящим запросом.
   */
  function callLayer(
    target: ProbeTarget,
    init: { body?: unknown; query?: Record<string, unknown> }
  ): { statusCode: number; body: Record<string, unknown>; passed: boolean } {
    const req = mockRequest({
      body: init.body,
      query: init.query as Record<string, string> | undefined,
    });
    const res = mockResponse();
    let passed = false;

    target.layer(req, res, (() => {
      passed = true;
    }) as NextFunction);

    return {
      statusCode: res.statusCode,
      body: (res.body ?? {}) as Record<string, unknown>,
      passed,
    };
  }

  it.each(WIRED)('%s', name => {
    const targets = probeTargets(routers[name] ?? []);
    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      for (const field of target.fields) {
        /* Объект неверен для ЛЮБОГО поля этих схем — число, строка, boolean,
           enum, массив, дата, — а строка `bogus` неверна для любого поля query.
           Значит один и тот же мусор годится на все поля, и тест не приходится
           писать по проверке на поле. */
        const outcome =
          target.source === 'body'
            ? callLayer(target, { body: { [field]: { unexpected: true } } })
            : callLayer(target, { query: { [field]: 'bogus' } });

        expect({ field, status: outcome.statusCode, passed: outcome.passed }).toEqual({
          field,
          status: 400,
          passed: false,
        });
        expect(outcome.body).toMatchObject({
          success: false,
          errors: expect.arrayContaining([expect.objectContaining({ field })]),
        });
      }
    }
  });

  /**
   * Регрессия на первый блокер ревью.
   *
   * `frontend-new/src/services/api.service.ts` подмешивает `groupId` из стора, а
   * `admin.service.ts` и `suggestions.service.ts` уже встроили его в путь —
   * получалось `?groupId=5&groupId=5`. Восемь работавших админских эндпоинтов
   * начали бы отвечать 400: `qs` отдаёт массив, а `z.coerce.number()` даёт на нём
   * NaN. Дубликат в `buildUrl` убран, но схема обязана держать удар — старые
   * клиенты и закэшированные бандлы никуда не исчезают.
   */
  it('повторяющийся одинаковый groupId в query не отвергается', () => {
    const targets = Object.values(routers)
      .flatMap(routes => probeTargets(routes))
      .filter(target => target.source === 'query' && target.fields.includes('groupId'));

    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      const outcome = callLayer(target, { query: { groupId: ['5', '5'] } });
      expect({ status: outcome.statusCode, passed: outcome.passed }).toEqual({
        status: 200,
        passed: true,
      });
    }
  });

  /* А вот РАЗНЫЕ значения сводить нельзя: выбрать одно молча — та же подмена
     фильтра, против которой задача и заведена. */
  it('повторяющийся РАЗНЫЙ groupId в query отвергается', () => {
    const target = Object.values(routers)
      .flatMap(routes => probeTargets(routes))
      .find(t => t.source === 'query' && t.fields.includes('groupId'));

    expect(target).toBeDefined();

    const outcome = callLayer(target!, { query: { groupId: ['5', '7'] } });
    expect({ status: outcome.statusCode, passed: outcome.passed }).toEqual({
      status: 400,
      passed: false,
    });
  });
});

describe('остаток долга зафиксирован, а не забыт', () => {
  it('список необёрнутых роутеров совпадает с тем, что есть в каталоге', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join(__dirname, '../../../api/routes');
    const all = fs
      .readdirSync(dir)
      .filter(file => file.endsWith('.routes.ts'))
      .map(file => file.replace('.routes.ts', ''))
      .sort();

    expect(all).toEqual([...WIRED, ...NOT_WIRED_YET].sort());
  });
});
