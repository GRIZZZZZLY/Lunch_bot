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

function buildCacheKey(
  scope: string,
  operation: string,
  userScope: string,
  clientKey: string
): string {
  return `idem:${scope}:${operation}:${userScope}:${clientKey}`;
}

export function createIdempotencyMiddleware(options: IdempotencyOptions) {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const scope = options.scope;

  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
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
        message:
          'Idempotency-Key должен быть 8..200 символов из [A-Za-z0-9_-:.]',
      });
      return;
    }

    // Скоупим ключ по идентификатору пользователя (или IP для гостевых endpoint'ов),
    // чтобы один Idempotency-Key от разных пользователей не схлопывался.
    const user = req.user;
    const userScope =
      user?.id != null
        ? `u${user.id}`
        : `ip${(req.ip ?? 'unknown').replace(/[^0-9a-z.:]/gi, '_')}`;

    // Один и тот же клиентский ключ в разных маршрутах не должен возвращать
    // ответ другой операции. Query-параметры намеренно не включаем: они могут
    // содержать чувствительные данные и не меняют смысл повторной отправки.
    const operation = `${req.method}:${req.baseUrl}${req.path}`.replace(
      /[^A-Za-z0-9_:/.-]/g,
      '_'
    );
    const cacheKey = buildCacheKey(scope, operation, userScope, rawKey);

    // 1) Проверяем существующий маркер.
    let marker: Marker | undefined;
    try {
      marker = await cacheService.get<Marker>(cacheKey);
    } catch {
      logger.warn('idempotency: cache read failed', { scope });
      if (options.required) {
        res.setHeader('Retry-After', '5');
        res.status(503).json({
          success: false,
          error: 'Idempotency storage unavailable',
          code: 'IDEMPOTENCY_UNAVAILABLE',
          message: 'Сервис временно недоступен. Повторите запрос позже.',
        });
        return;
      }
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
    const acquisition = await cacheService.setIfAbsent(
      cacheKey,
      inflight,
      INFLIGHT_TTL_SECONDS
    );
    if (acquisition === 'unavailable') {
      logger.warn('idempotency: cache unavailable', { scope });
      if (options.required) {
        res.setHeader('Retry-After', '5');
        res.status(503).json({
          success: false,
          error: 'Idempotency storage unavailable',
          code: 'IDEMPOTENCY_UNAVAILABLE',
          message: 'Сервис временно недоступен. Повторите запрос позже.',
        });
        return;
      }
      return next();
    }

    if (acquisition === 'exists') {
      const existing = await cacheService.get<Marker>(cacheKey);
      if (existing?.state === 'done') {
        metricsService.incrementIdempotencyReplay(scope, 'replay');
        res.setHeader(REPLAYED_HEADER, 'true');
        if (existing.response.contentType) {
          res.setHeader('Content-Type', existing.response.contentType);
        }
        res.status(existing.response.status).json(existing.response.body);
        return;
      }

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

    // 3) Перехватываем res.json чтобы закешировать успешный ответ.
    const originalJson = res.json.bind(res) as (body: unknown) => Response;
    res.json = function patchedJson(body: unknown): Response {
      /* Кешируется только УСПЕХ. Идемпотентность защищает от повторного
         побочного эффекта, а отказ его не оставил: запрос отбит проверкой до
         записи. Раньше сюда попадали и 4xx, и повтор с тем же ключом сутки
         отдавал вчерашнюю ошибку вместо новой попытки — например, «в этой
         группе уже идёт голосование» после того, как голосование закрылось. */
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const done: Marker = {
          state: 'done',
          at: Date.now(),
          response: {
            status: res.statusCode,
            body,
            contentType:
              (res.getHeader('Content-Type') as string | undefined) ??
              'application/json',
          },
        };
        // fire-and-forget — не блокируем ответ клиенту.
        cacheService.set(cacheKey, done, ttlSeconds).catch(() => {
          logger.warn('idempotency: response cache write failed', { scope });
        });
      } else {
        // Отказ (4xx/5xx) — снимаем in-flight, чтобы клиент мог ретраить.
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
