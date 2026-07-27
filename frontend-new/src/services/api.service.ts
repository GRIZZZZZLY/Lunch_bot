import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import { useAppStore } from '@/store/useAppStore';
import { createAuthRetryHandler } from '@/lib/authRetry';
import { newIdempotencyKey } from '@/lib/idempotency';

const TOKEN_KEY = 'auth_token';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const SAFE_METHODS = new Set(['get', 'head', 'options']);
/** Дольше держать ключ незавершённого действия нет смысла — это уже не «повтор». */
const ACTION_KEY_TTL_MS = 10 * 60 * 1000;

class ApiService {
  private client: AxiosInstance;
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
    const baseURL =
      import.meta.env.MODE === 'production'
        ? '/api'
        : import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.token = sessionStorage.getItem(TOKEN_KEY);

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      // Multi-tenant: backend resolves the active group from `groupId` (query/body).
      // Inject it from the app store so callers don't have to thread it everywhere.
      const groupId = useAppStore.getState().currentGroupId;
      if (groupId) {
        config.params = { groupId, ...(config.params ?? {}) };
      }
      // Бэкенд требует Idempotency-Key на write-endpoint'ах. Ключ ставим один
      // раз на запрос: ретрай того же config (например после ре-авторизации)
      // переиспользует его и получает закешированный ответ вместо дубля.
      const method = (config.method ?? 'get').toLowerCase();
      if (!SAFE_METHODS.has(method) && !config.headers.has(IDEMPOTENCY_HEADER)) {
        config.headers.set(IDEMPOTENCY_HEADER, newIdempotencyKey());
      }
      return config;
    });

    this.client.interceptors.response.use(
      (r) => r,
      async (error) => {
        if (error.response) {
          const { status, data } = error.response;
          if (status === 401) {
            const cfg = error.config as (AxiosRequestConfig & { _authRetry?: boolean }) | undefined;
            if (cfg && (await this.shouldRetryAuth(cfg))) {
              cfg._authRetry = true;
              return this.client.request(cfg);
            }
            this.clearToken();
          }
          return Promise.reject({
            success: false,
            error: data?.error || `HTTP ${status}`,
            code: data?.code || `HTTP_${status}`,
            status,
            ...data,
          });
        }
        if (error.request) {
          return Promise.reject({
            success: false,
            error: 'Network error',
            code: 'NETWORK_ERROR',
          });
        }
        return Promise.reject({
          success: false,
          error: error.message || 'Unknown error',
          code: 'REQUEST_ERROR',
        });
      },
    );
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
    mutationKey: string,
    config: AxiosRequestConfig | undefined,
    send: (config: AxiosRequestConfig) => Promise<AxiosResponse<ApiResponse<T>>>,
  ): Promise<ApiResponse<T>> {
    return this.dedupe(mutationKey, async () => {
      const key = this.actionKey(mutationKey);
      const withKey: AxiosRequestConfig = {
        ...config,
        headers: { ...(config?.headers as Record<string, string> | undefined), [IDEMPOTENCY_HEADER]: key },
      };
      try {
        const r = await send(withKey);
        this.releaseActionKey(mutationKey);
        return r.data;
      } catch (error) {
        this.releaseActionKey(mutationKey, error);
        throw error;
      }
    });
  }

  private mutationKey(
    method: string,
    url: string,
    data: unknown,
    config?: AxiosRequestConfig,
  ): string {
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

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.get<ApiResponse<T>>(url, config);
    return r.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>(this.mutationKey('POST', url, data, config), config, (cfg) =>
      this.client.post<ApiResponse<T>>(url, data, cfg),
    );
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>(this.mutationKey('PUT', url, data, config), config, (cfg) =>
      this.client.put<ApiResponse<T>>(url, data, cfg),
    );
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>(this.mutationKey('PATCH', url, data, config), config, (cfg) =>
      this.client.patch<ApiResponse<T>>(url, data, cfg),
    );
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.mutate<T>(this.mutationKey('DELETE', url, undefined, config), config, (cfg) =>
      this.client.delete<ApiResponse<T>>(url, cfg),
    );
  }

  async getPaginated<T = unknown>(
    url: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<PaginatedResponse<T>> {
    const r: AxiosResponse<PaginatedResponse<T>> = await this.client.get(url, { params });
    return r.data;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const base =
      import.meta.env.MODE === 'production'
        ? '/health'
        : `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')}/health`;
    const r = await axios.get(base, { timeout: 5000 });
    return r.data;
  }
}

export const apiService = new ApiService();
