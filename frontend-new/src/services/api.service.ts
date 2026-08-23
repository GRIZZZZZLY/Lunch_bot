/* Транспорт на fetch. Раньше здесь был axios — 16.7% модулей бандла ради
   того, что нативный fetch делает сам. Публичная поверхность не изменилась:
   get/post/put/patch/delete/getPaginated/healthCheck и конфиг из params.
   Сохранены все гарантии прежнего слоя: инъекция groupId, Bearer, ключи
   идемпотентности, схлопывание дублей, одна переавторизация по 401 и та же
   форма ошибки для вызывающих. */
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import { useAppStore } from '@/store/useAppStore';
import { createAuthRetryHandler } from '@/lib/authRetry';
import { newIdempotencyKey } from '@/lib/idempotency';

const TOKEN_KEY = 'auth_token';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TIMEOUT_MS = 10_000;
/** Дольше держать ключ незавершённого действия нет смысла — это уже не «повтор». */
const ACTION_KEY_TTL_MS = 10 * 60 * 1000;

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestConfig {
  params?: QueryParams;
  headers?: Record<string, string>;
}

/** Ошибка в том же виде, в каком её отдавал axios-перехватчик. */
export interface ApiError {
  success: false;
  error: string;
  code: string;
  status?: number;
  [key: string]: unknown;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;
  /**
   * Мутации, которые сейчас в полёте, по ключу «метод + URL + параметры + тело».
   * Двойной тап шлёт тот же запрос второй раз до ответа на первый — отдаём тот
   * же промис вместо второго обращения к серверу.
   */
  private inflight = new Map<string, Promise<unknown>>();
  /** Ключи идемпотентности незавершённых действий: одно нажатие — один ключ. */
  private actionKeys = new Map<string, { key: string; at: number }>();
  private reauthenticate: (() => Promise<boolean>) | null = null;
  private shouldRetryAuth = createAuthRetryHandler(() =>
    this.reauthenticate ? this.reauthenticate() : Promise.resolve(false),
  );

  constructor() {
    this.baseURL =
      import.meta.env.MODE === 'production'
        ? '/api'
        : import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.token = sessionStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  getToken() {
    return this.token ?? sessionStorage.getItem(TOKEN_KEY);
  }

  clearToken() {
    this.token = null;
    sessionStorage.removeItem(TOKEN_KEY);
  }

  /** Регистрируется в auth.service — так разрывается циклический импорт api↔auth. */
  setReauthenticator(fn: () => Promise<boolean>) {
    this.reauthenticate = fn;
  }

  /**
   * Multi-tenant: backend resolves the active group from `groupId` (query/body).
   * Инъекция из стора, чтобы вызывающим не приходилось тащить его повсюду.
   * Явно переданный groupId побеждает — как и раньше при слиянии params.
   */
  private buildUrl(url: string, params?: QueryParams): string {
    const groupId = useAppStore.getState().currentGroupId;
    const merged: QueryParams = groupId ? { groupId, ...(params ?? {}) } : { ...(params ?? {}) };

    /* Параметр, который вызывающий уже вписал в путь, второй раз не дописывается.
       Половина методов `admin.service.ts` и `suggestions.service.ts` встраивает
       `?groupId=` прямо в url, и инъекция из стора давала `?groupId=5&groupId=5`.
       На бэкенде это приходило массивом `['5','5']`; работало только потому, что
       `parseInt` приводит массив к строке `'5,5'` и возвращает 5. Первая же
       схема с `z.coerce.number()` получила бы на этом NaN. */
    const existing = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined) continue;
      if (existing.has(key)) continue;
      search.append(key, String(value));
    }
    const query = search.toString();
    return `${this.baseURL}${url}${query ? `${url.includes('?') ? '&' : '?'}${query}` : ''}`;
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private toApiError(status: number, body: unknown): ApiError {
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    return {
      ...data,
      success: false,
      error: (data.error as string) || `HTTP ${status}`,
      code: (data.code as string) || `HTTP_${status}`,
      status,
    };
  }

  /**
   * Один сетевой рейс. `authRetried` помечает повтор после 401: ключ
   * идемпотентности при этом переиспользуется, поэтому сервер отдаёт
   * закешированный результат первой попытки, а не выполняет действие дважды.
   */
  private async send<T>(
    method: string,
    url: string,
    data: unknown,
    config: RequestConfig | undefined,
    headers: Record<string, string>,
    authRetried: boolean,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(this.buildUrl(url, config?.params), {
        method,
        headers,
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: controller.signal,
      });
    } catch (cause) {
      // Обрыв связи и таймаут неразличимы для вызывающего: оба означают
      // «судьба запроса неизвестна», и оба ведут к повтору с тем же ключом.
      const aborted = cause instanceof DOMException && cause.name === 'AbortError';
      throw {
        success: false,
        error: aborted ? 'Request timeout' : 'Network error',
        code: 'NETWORK_ERROR',
      } satisfies ApiError;
    } finally {
      clearTimeout(timer);
    }

    const body = await this.parseBody(response);

    if (!response.ok) {
      if (response.status === 401) {
        if (await this.shouldRetryAuth({ url, _authRetry: authRetried })) {
          const retryHeaders = { ...headers };
          if (this.token) retryHeaders.Authorization = `Bearer ${this.token}`;
          return this.send<T>(method, url, data, config, retryHeaders, true);
        }
        this.clearToken();
      }
      throw this.toApiError(response.status, body);
    }

    return body as T;
  }

  private headersFor(method: string, config?: RequestConfig, idempotencyKey?: string) {
    const headers: Record<string, string> = { ...(config?.headers ?? {}) };
    if (!SAFE_METHODS.has(method)) {
      headers['Content-Type'] = 'application/json';
      // Бэкенд требует Idempotency-Key на write-endpoint'ах.
      if (!headers[IDEMPOTENCY_HEADER]) {
        headers[IDEMPOTENCY_HEADER] = idempotencyKey ?? newIdempotencyKey();
      }
    }
    const token = this.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  /**
   * Схлопывает повторную отправку той же мутации, пока первая не завершилась.
   * Ключ намеренно включает тело: два подряд «добавить молоко» — это одно
   * действие, а «добавить молоко» и «добавить хлеб» — два разных.
   */
  private dedupe<T>(key: string, run: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
    const existing = this.inflight.get(key) as Promise<ApiResponse<T>> | undefined;
    if (existing) return existing;

    const pending = run().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  /**
   * Ключ идемпотентности живёт до тех пор, пока судьба действия неизвестна.
   * Сеть отвалилась или сервер ответил 5xx — мы не знаем, применилось ли
   * действие, поэтому повтор идёт с тем же ключом и получает от сервера
   * закешированный ответ первой попытки вместо второй закупки или второго
   * голоса. Как только пришёл однозначный вердикт (успех или 4xx), ключ
   * сбрасывается: следующее нажатие — уже новое действие.
   */
  private actionKey(mutationKey: string): string {
    const now = Date.now();
    for (const [k, entry] of this.actionKeys) {
      if (now - entry.at > ACTION_KEY_TTL_MS) this.actionKeys.delete(k);
    }

    const existing = this.actionKeys.get(mutationKey);
    if (existing) return existing.key;

    const key = newIdempotencyKey();
    this.actionKeys.set(mutationKey, { key, at: now });
    return key;
  }

  /** 4xx (кроме 409 «уже выполняется») — сервер вынес вердикт, ключ больше не нужен. */
  private releaseActionKey(mutationKey: string, error?: unknown): void {
    if (error === undefined) {
      this.actionKeys.delete(mutationKey);
      return;
    }
    const status = (error as { status?: number } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500 && status !== 409) {
      this.actionKeys.delete(mutationKey);
    }
  }

  private async mutate<T>(
    method: string,
    url: string,
    data: unknown,
    config: RequestConfig | undefined,
  ): Promise<ApiResponse<T>> {
    const mutationKey = this.mutationKey(method, url, data, config);
    return this.dedupe(mutationKey, async () => {
      const key = this.actionKey(mutationKey);
      const headers = this.headersFor(method, config, key);
      try {
        const r = await this.send<ApiResponse<T>>(method, url, data, config, headers, false);
        this.releaseActionKey(mutationKey);
        return r;
      } catch (error) {
        this.releaseActionKey(mutationKey, error);
        throw error;
      }
    });
  }

  private mutationKey(method: string, url: string, data: unknown, config?: RequestConfig): string {
    const serialize = (value: unknown): string => {
      try {
        return JSON.stringify(value ?? null) ?? 'null';
      } catch {
        // Несериализуемое тело не с чем сравнивать — такой запрос не схлопываем.
        return `unserializable:${this.inflight.size}:${Math.random()}`;
      }
    };
    return `${method} ${url} ${serialize(config?.params)} ${serialize(data)}`;
  }

  async get<T = unknown>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.send<ApiResponse<T>>('GET', url, undefined, config, this.headersFor('GET', config), false);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>('POST', url, data, config);
  }

  async put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>('PUT', url, data, config);
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>('PATCH', url, data, config);
  }

  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>('DELETE', url, undefined, config);
  }

  async getPaginated<T = unknown>(url: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
    return this.send<PaginatedResponse<T>>(
      'GET',
      url,
      undefined,
      { params },
      this.headersFor('GET'),
      false,
    );
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const base =
      import.meta.env.MODE === 'production'
        ? '/health'
        : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(base, { signal: controller.signal });
      if (!response.ok) throw this.toApiError(response.status, await this.parseBody(response));
      return (await response.json()) as { status: string; timestamp: string };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const apiService = new ApiService();
