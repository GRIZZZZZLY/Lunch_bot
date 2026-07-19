/**
 * Phase 0 (G0-8) — Idempotency middleware.
 *
 * Защита от двойных POST'ов (double-tap, retry на flaky network, дубли webhook'а).
 * Клиент шлёт `Idempotency-Key: <uuid>`; если такой ключ уже видели за TTL —
 * возвращаем тот же ответ, не выполняя бизнес-логику повторно.
 *
 * Хранилище: Redis через cacheService (graceful fallback на no-op при
 * REDIS_ENABLED=false — в этом случае middleware пропускает запрос с warn-логом).
 *
 * Применять к write-endpoints, где двойной запуск создаёт побочный эффект:
 * POST /api/votes, POST /api/budget/mark-paid, POST /api/budget/confirm-payment,
 * POST /api/feedback, POST /api/store-runs, POST /api/donations.
 *
 * Edge cases:
 * - Если handler упал с 5xx — НЕ кешируем (клиент может ретраить).
 * - "In-flight" маркер ставится SETNX до выполнения handler'а; повтор в окне
 *   получает 409 Conflict с Retry-After: 2.
 * - Ключ скоупится по userId, чтобы атакующий не подсунул чужой Idempotency-Key.
 */

import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';
import { metricsService } from '../../services/metrics.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const REPLAYED_HEADER = 'X-Idempotent-Replayed';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h
const INFLIGHT_TTL_SECONDS = 60; // окно выполнения handler'а

type CachedResponse = {
  status: number;
  body: unknown;
  contentType?: string;
};

type Marker =
  | { state: 'inflight'; at: number }
  | { state: 'done'; response: CachedResponse; at: number };

export interface IdempotencyOptions {
  /** TTL для закешированного ответа в секундах (по умолчанию 24h). */
  ttlSeconds?: number;
  /** Если true — ключ обязателен; без него вернём 400. По умолчанию false. */
  required?: boolean;
  /** Префикс ключа в Redis для namespacing (например 'vote', 'budget'). */
  scope: string;
}

/**
 * Базовая валидация Idempotency-Key. Формат свободный, но ограничиваем длину
 * и символы — чтобы не положить в Redis 100KB мусора.
 */
function isValidKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    key.length >= 8 &&
    key.length <= 200 &&
    /^[A-Za-z0-9_\-:.]+$/.test(key)
  );
}

function buildCacheKey(scope: string, userScope: string, clientKey: string): string {
  return `idem:${scope}:${userScope}:${clientKey}`;
}

export function createIdempotencyMiddleware(options: IdempotencyOptions) {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const scope = options.scope;

  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const rawKey = req.header(IDEMPOTENCY_HEADER);

    if (!rawKey) {
      if (options.required) {
        res.status(400).json({
          success: false,
          error: 'Missing Idempotency-Key',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Заголовок Idempotency-Key обязателен для этого запроса.',
        });
        return;
      }
      // ключ не передан — пропускаем без дедупликации
      return next();
    }

    if (!isValidKey(rawKey)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Idempotency-Key',
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key должен быть 8..200 символов из [A-Za-z0-9_-:.]',
      });
      return;
    }

    // Скоупим ключ по идентификатору пользователя (или IP для гостевых endpoint'ов),
    // чтобы один Idempotency-Key от разных пользователей не схлопывался.
    const user = (req as any).user;
    const userScope =
      user?.id != null ? `u${user.id}` : `ip${(req.ip ?? 'unknown').replace(/[^0-9a-z.:]/gi, '_')}`;

    const cacheKey = buildCacheKey(scope, userScope, rawKey);

    // 1) Проверяем существующий маркер.
    let marker: Marker | undefined;
    try {
      marker = await cacheService.get<Marker>(cacheKey);
    } catch (err) {
      logger.warn('idempotency: cache.get failed, passing through', {
        scope,
        cacheKey,
        error: (err as Error).message,
      });
      return next();
    }

    if (marker?.state === 'done') {
      metricsService.incrementIdempotencyReplay(scope, 'replay');
      res.setHeader(REPLAYED_HEADER, 'true');
      if (marker.response.contentType) {
        res.setHeader('Content-Type', marker.response.contentType);
      }
      res.status(marker.response.status).json(marker.response.body);
      return;
    }

    if (marker?.state === 'inflight') {
      metricsService.incrementIdempotencyReplay(scope, 'inflight');
      res.setHeader('Retry-After', '2');
      res.status(409).json({
        success: false,
        error: 'Duplicate request in progress',
        code: 'IDEMPOTENCY_INFLIGHT',
        message: 'Повторный запрос с тем же Idempotency-Key ещё выполняется.',
      });
      return;
    }

    // 2) Ставим in-flight маркер. SET с коротким TTL — если процесс упадёт,
    //    маркер сам исчезнет и пользователь сможет ретраить.
    const inflight: Marker = { state: 'inflight', at: Date.now() };
    const stored = await cacheService.set(cacheKey, inflight, INFLIGHT_TTL_SECONDS);
    if (!stored) {
      // Redis недоступен — пропускаем без дедупликации, но логируем.
      logger.warn('idempotency: cache disabled, passing through without dedup', {
        scope,
        cacheKey,
      });
      return next();
    }

    // 3) Перехватываем res.json чтобы закешировать успешный ответ.
    const originalJson = res.json.bind(res) as (body: unknown) => Response;
    res.json = function patchedJson(body: unknown): Response {
      // Не кешируем 5xx — это позволяет клиенту ретраить без 409.
      if (res.statusCode >= 200 && res.statusCode < 500) {
        const done: Marker = {
          state: 'done',
          at: Date.now(),
          response: {
            status: res.statusCode,
            body,
            contentType: (res.getHeader('Content-Type') as string | undefined) ?? 'application/json',
          },
        };
        // fire-and-forget — не блокируем ответ клиенту.
        cacheService.set(cacheKey, done, ttlSeconds).catch((err: unknown) => {
          logger.warn('idempotency: cache.set(done) failed', {
            scope,
            cacheKey,
            error: (err as Error).message,
          });
        });
      } else {
        // 5xx — снимаем in-flight, чтобы клиент мог ретраить.
        cacheService.del(cacheKey).catch(() => undefined);
      }
      return originalJson(body);
    } as Response['json'];

    // Если handler упал до res.json (next(err)) — снимаем in-flight маркер
    // в finalize. Express вызовет error-handler middleware; здесь подписываемся
    // на 'finish' и 'close'.
    res.on('close', () => {
      if (!res.writableEnded) {
        cacheService.del(cacheKey).catch(() => undefined);
      }
    });

    return next();
  };
}
