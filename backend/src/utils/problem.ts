/**
 * Phase 2 (P1-6) — RFC 7807 Problem Details for HTTP APIs.
 *
 * https://datatracker.ietf.org/doc/html/rfc7807
 *
 * Зачем: до этого каждый контроллер инлайнил `res.status(400).json({ success, error, code, ... })`
 * руками — 5+ форматов в разных местах, фронт парсил по-разному, telemetry
 * не агрегировалась. Единый contract: { type, title, status, detail, instance, code, traceId, ...extensions }.
 *
 * Frontend должен мапить `code` → user-facing сообщение; `detail` — для разработчика;
 * `instance` — путь запроса; `type` — URI описания семантики (можно вести docs страничку).
 *
 * Backward compatibility: оставляем legacy-поля `success: false` и `error`,
 * чтобы фронт не сломался во время раскатки.
 */

import type { Response } from 'express';

import type { ApiErrorCode } from '../api/error-codes';

export interface Problem {
  /** URI describing the problem type (links to docs). */
  type: string;
  /** Short human-readable summary. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail?: string;
  /** URI identifying the specific occurrence (request path). */
  instance?: string;
  /**
   * Machine-readable code. Тип, а не `string`, намеренно: фронт выбирает по
   * нему текст для пользователя (`frontend-new/src/lib/apiError.ts`), то есть
   * код — часть контракта. Опечатка в литерале теперь не компилируется, а не
   * тихо доезжает до клиента и теряет текст.
   */
  code: ApiErrorCode;
  /** Correlation id from request-context middleware. */
  traceId?: string;
  /** Extension members (errors[], field, retryAfter, ...). */
  [key: string]: unknown;

  // Legacy compatibility — НЕ удалять без миграции фронта:
  success?: false;
  error?: string;
}

const DEFAULT_TYPE_BASE = 'https://rocketlunch.dpdns.org/docs/errors/';

export function makeProblem(input: {
  status: number;
  code: ApiErrorCode;
  title: string;
  detail?: string;
  instance?: string;
  traceId?: string;
  extensions?: Record<string, unknown>;
}): Problem {
  const { status, code, title, detail, instance, traceId, extensions } = input;
  return {
    type: `${DEFAULT_TYPE_BASE}${code.toLowerCase()}`,
    title,
    status,
    detail,
    instance,
    code,
    traceId,
    // Legacy mirrors so existing axios-clients продолжают работать:
    success: false,
    error: detail ?? title,
    ...(extensions ?? {}),
  };
}

/**
 * Отправить Problem-ответ. Устанавливает Content-Type на application/problem+json,
 * но также добавляет JSON-совместимое тело — браузерам и инструментам всё равно.
 */
export function sendProblem(res: Response, problem: Problem): void {
  res.status(problem.status);
  res.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
  res.json(problem);
}

/**
 * Shortcut helpers — для контроллеров, которые сейчас инлайнят 400/401/403/404.
 */
export const problems = {
  badRequest: (detail: string, code = 'BAD_REQUEST', extensions?: Record<string, unknown>) =>
    ({ status: 400, code, title: 'Bad request', detail, extensions }) as const,

  unauthorized: (detail = 'Unauthorized', code = 'UNAUTHORIZED') =>
    ({ status: 401, code, title: 'Unauthorized', detail }) as const,

  forbidden: (detail = 'Access denied', code = 'FORBIDDEN') =>
    ({ status: 403, code, title: 'Forbidden', detail }) as const,

  notFound: (resource: string, code = 'NOT_FOUND') =>
    ({ status: 404, code, title: 'Not found', detail: `${resource} not found` }) as const,

  conflict: (detail: string, code = 'CONFLICT') =>
    ({ status: 409, code, title: 'Conflict', detail }) as const,

  validation: (detail: string, extensions?: Record<string, unknown>) =>
    ({ status: 422, code: 'VALIDATION_ERROR', title: 'Validation failed', detail, extensions }) as const,

  rateLimited: (detail = 'Too many requests', extensions?: Record<string, unknown>) =>
    ({ status: 429, code: 'RATE_LIMIT_EXCEEDED', title: 'Too many requests', detail, extensions }) as const,

  internal: (detail = 'Internal server error', code = 'INTERNAL_ERROR') =>
    ({ status: 500, code, title: 'Internal server error', detail }) as const,
} as const;

/**
 * Удобный oneliner для контроллеров: respondProblem(res, req, problems.notFound('Poll'))
 */
export function respondProblem(
  res: Response,
  req: { path?: string; url?: string; requestId?: string },
  partial: {
    status: number;
    code: ApiErrorCode;
    title: string;
    detail?: string;
    extensions?: Record<string, unknown>;
  },
): void {
  sendProblem(
    res,
    makeProblem({
      ...partial,
      instance: req.url ?? req.path,
      traceId: req.requestId,
    }),
  );
}
