import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: number;
  telegramId?: string;
}

/**
 * Per-request context propagated through async calls via AsyncLocalStorage.
 * Set in api/middleware/request-id.ts; read by the winston format in
 * utils/logger.ts so every log line emitted during a request automatically
 * carries requestId/userId — no need to thread context through every service.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Read the current request context, or undefined if called outside a request
 * (e.g. from a cron job or boot path).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Mutate the current request context. No-op if called outside a request.
 * Useful after auth resolves to attach userId/telegramId for the rest of the call.
 */
export function setRequestContextField<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K],
): void {
  const store = requestContext.getStore();
  if (store) {
    store[key] = value;
  }
}
