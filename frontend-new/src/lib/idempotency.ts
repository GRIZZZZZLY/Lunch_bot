/**
 * Idempotency-Key для небезопасных запросов.
 *
 * Бэкенд требует заголовок на write-endpoint'ах (`createIdempotencyMiddleware`
 * с `required: true`): опросы, голоса, закупки, фидбек, сезоны, геймификация.
 * Без заголовка запрос отбивается с 400 `IDEMPOTENCY_KEY_REQUIRED` ещё до
 * контроллера.
 */
export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Фолбэк для окружений без Web Crypto (старые WebView, часть jsdom-сборок).
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
