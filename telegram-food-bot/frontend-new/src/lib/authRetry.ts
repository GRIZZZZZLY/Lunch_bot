/* Контролируемый повтор запроса после 401.
   Гарантии против бесконечного цикла:
   - запрос, уже повторённый один раз (_authRetry), второй раз не переавторизуется;
   - запросы к /auth/* переавторизацию не запускают;
   - переавторизация single-flight: параллельные 401 ждут одну общую попытку. */

export interface RetriableRequest {
  url?: string;
  _authRetry?: boolean;
}

export function isAuthEndpoint(url: string | undefined): boolean {
  return !!url && /(^|\/)auth(\/|$)/.test(url);
}

/**
 * Возвращает функцию: «можно ли повторить этот 401-запрос?».
 * `reauth` обязан сам обработать свой провал (сброс токена, статус в сторе)
 * и вернуть false — здесь только координация.
 */
export function createAuthRetryHandler(reauth: () => Promise<boolean>) {
  let inflight: Promise<boolean> | null = null;

  return async function shouldRetry(config: RetriableRequest): Promise<boolean> {
    if (config._authRetry || isAuthEndpoint(config.url)) return false;
    if (!inflight) {
      inflight = reauth()
        .catch(() => false)
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };
}
