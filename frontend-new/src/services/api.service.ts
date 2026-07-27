import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, PaginatedResponse } from '@/types/api';
import { useAppStore } from '@/store/useAppStore';
import { createAuthRetryHandler } from '@/lib/authRetry';
import { newIdempotencyKey } from '@/lib/idempotency';

const TOKEN_KEY = 'auth_token';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const SAFE_METHODS = new Set(['get', 'head', 'options']);

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  /**
   * Мутации, которые сейчас в полёте, по ключу «метод + URL + параметры + тело».
   * Двойной тап шлёт тот же запрос второй раз до ответа на первый — отдаём тот
   * же промис вместо второго обращения к серверу.
   */
  private inflight = new Map<string, Promise<unknown>>();
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
    return this.dedupe(this.mutationKey('POST', url, data, config), async () => {
      const r = await this.client.post<ApiResponse<T>>(url, data, config);
      return r.data;
    });
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.dedupe(this.mutationKey('PUT', url, data, config), async () => {
      const r = await this.client.put<ApiResponse<T>>(url, data, config);
      return r.data;
    });
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.dedupe(this.mutationKey('PATCH', url, data, config), async () => {
      const r = await this.client.patch<ApiResponse<T>>(url, data, config);
      return r.data;
    });
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.dedupe(this.mutationKey('DELETE', url, undefined, config), async () => {
      const r = await this.client.delete<ApiResponse<T>>(url, config);
      return r.data;
    });
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
