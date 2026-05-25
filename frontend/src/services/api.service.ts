import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosProgressEvent } from 'axios';

/**
 * Стабильный generator уникальных Idempotency-Key. Использует crypto.randomUUID,
 * если есть; иначе делает fallback на timestamp+random. Формат совместим с
 * валидатором backend middleware/idempotency.ts (8..200, [A-Za-z0-9_\-:.]).
 */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // fallback: достаточно случайно, чтобы коллизии в окне 24h были крайне редки.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
  };
  count?: number;
}

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;
  private readonly tokenKey = 'auth_token';

  constructor() {
    // В production используем относительный путь (т.к. frontend раздается с того же сервера)
    // В development используем полный URL для кросс-доменных запросов
    const baseURL = import.meta.env.MODE === 'production' 
      ? '/api'  // Относительный путь для production
      : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
    
    if (import.meta.env.DEV) {
      console.log('[ApiService] Initializing with baseURL:', baseURL, 'mode:', import.meta.env.MODE);
    }
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Используем sessionStorage для снижения риска долгоживущего XSS-перехвата
    this.token = sessionStorage.getItem(this.tokenKey);
    if (!this.token) {
      const legacyToken = localStorage.getItem(this.tokenKey);
      if (legacyToken) {
        this.token = legacyToken;
        sessionStorage.setItem(this.tokenKey, legacyToken);
        localStorage.removeItem(this.tokenKey);
      }
    }

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor для добавления токена + автогенерации Idempotency-Key.
    // P0/G0-8: каждый POST/PATCH/DELETE без явного Idempotency-Key получает
    // свеже-сгенерированный uuid. Бэкенд (middleware/idempotency.ts) дедуплицирует
    // повторные запросы — это убирает дубли при double-tap, network-retry, race.
    //
    // ВАЖНО: для ретраев одной и той же операции клиент должен ПЕРЕИСПОЛЬЗОВАТЬ
    // тот же Idempotency-Key (передавать в config.headers явно). React Query
    // делает это автоматически, если ключ зафиксирован в mutationFn closure.
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        const method = (config.method ?? 'get').toUpperCase();
        if (['POST', 'PATCH', 'DELETE'].includes(method)) {
          const existing = config.headers['Idempotency-Key'] ?? config.headers['idempotency-key'];
          if (!existing) {
            config.headers['Idempotency-Key'] = generateIdempotencyKey();
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor для обработки ошибок
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        // Обработка ошибок сети и HTTP
        if (error.response) {
          // Сервер ответил с кодом ошибки
          const { status, data } = error.response;
          
          if (status === 401) {
            // Токен невалиден, очищаем его
            this.clearToken();
          }
          
          // Возвращаем стандартизированную ошибку
          // ВАЖНО: Передаем ВСЕ поля из data (например, minutesLeft, cooldownEndsAt)
          return Promise.reject({
            success: false,
            error: data?.error || `HTTP Error ${status}`,
            code: data?.code || `HTTP_${status}`,
            status,
            ...data, // Добавляем все остальные поля из ответа сервера
          });
        } else if (error.request) {
          // Запрос был отправлен, но ответ не получен
          return Promise.reject({
            success: false,
            error: 'Network error - no response received',
            code: 'NETWORK_ERROR',
          });
        } else {
          // Произошла ошибка при настройке запроса
          return Promise.reject({
            success: false,
            error: error.message || 'Unknown error',
            code: 'REQUEST_ERROR',
          });
        }
      }
    );
  }

  /**
   * Установить токен авторизации
   */
  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem(this.tokenKey, token);
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Получить токен авторизации
   */
  getToken(): string | null {
    if (!this.token) {
      this.token = sessionStorage.getItem(this.tokenKey);
    }
    return this.token;
  }

  /**
   * Очистить токен авторизации
   */
  clearToken() {
    this.token = null;
    sessionStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * GET запрос
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    if (import.meta.env.DEV) {
      console.log(`🌐 [API] GET ${url}`, { hasToken: !!this.token });
    }
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config);
      if (import.meta.env.DEV) {
        console.log(`✅ [API] GET ${url} success`, { status: response.status });
      }
      return response.data;
    } catch (error: unknown) {
      const errorDetails = error as { success?: boolean; error?: string; code?: string; status?: number };
      if (import.meta.env.DEV) {
        console.error(`❌ [API] GET ${url} failed`, {
          success: errorDetails.success,
          error: errorDetails.error,
          code: errorDetails.code,
          status: errorDetails.status,
        });
      }
      throw error;
    }
  }

  /**
   * POST запрос
   */
  async post<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    if (import.meta.env.DEV) {
      console.log(`🌐 [API] POST ${url}`, {
        data,
        hasToken: !!this.token
      });
    }
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config);
      if (import.meta.env.DEV) {
        console.log(`✅ [API] POST ${url} success`, {
          status: response.status,
          success: response.data.success
        });
      }
      return response.data;
    } catch (error: unknown) {
      const errorDetails = error as { success?: boolean; error?: string; code?: string; status?: number };
      if (import.meta.env.DEV) {
        console.error(`❌ [API] POST ${url} failed`, {
          success: errorDetails.success,
          error: errorDetails.error,
          code: errorDetails.code,
          status: errorDetails.status,
        });
      }
      throw error;
    }
  }

  /**
   * PUT запрос
   */
  async put<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * PATCH запрос
   */
  async patch<T = unknown>(
    url: string, 
    data?: unknown, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * DELETE запрос
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * GET запрос с пагинацией
   */
  async getPaginated<T = unknown>(
    url: string, 
    params?: {
      limit?: number;
      offset?: number;
      page?: number;
      [key: string]: string | number | boolean | undefined;
    }
  ): Promise<PaginatedResponse<T>> {
    const response = await this.client.get<PaginatedResponse<T>>(url, { params });
    return response.data;
  }

  /**
   * Загрузка файла
   */
  async uploadFile<T = unknown>(
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Обработка ответа
   */
  private handleResponse<T>(response: AxiosResponse<ApiResponse<T>>): ApiResponse<T> {
    return response.data;
  }

  /**
   * Скачивание файла
   */
  async downloadFile(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = downloadUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Проверка состояния сервера
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version?: string }> {
    try {
      // В production используем относительный путь, в dev - полный URL
      const healthUrl = import.meta.env.MODE === 'production'
        ? '/health'
        : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}/health`;
      
      if (import.meta.env.DEV) {
        console.log('[ApiService] healthCheck URL:', healthUrl);
      }
      
      const response = await axios.get(healthUrl, { timeout: 5000 });
      return response.data;
    } catch {
      throw {
        success: false,
        error: 'Server is not available',
        code: 'SERVER_UNAVAILABLE',
      };
    }
  }
}

// Экспортируем singleton экземпляр
export const apiService = new ApiService();
