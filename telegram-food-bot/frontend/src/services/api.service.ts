import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiResponse<T = any> {
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

  constructor() {
    // В production используем относительный путь (т.к. frontend раздается с того же сервера)
    // В development используем полный URL для кросс-доменных запросов
    const baseURL = import.meta.env.MODE === 'production' 
      ? '/api'  // Относительный путь для production
      : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
    
    console.log('[ApiService] Initializing with baseURL:', baseURL, 'mode:', import.meta.env.MODE);
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Загружаем токен из localStorage при инициализации
    this.token = localStorage.getItem('auth_token');

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor для добавления токена
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
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
          return Promise.reject({
            success: false,
            error: data?.error || `HTTP Error ${status}`,
            code: data?.code || `HTTP_${status}`,
            status,
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
    localStorage.setItem('auth_token', token);
  }

  /**
   * Получить токен авторизации
   */
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  /**
   * Очистить токен авторизации
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * GET запрос
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    console.log(`🌐 [API] GET ${url}`, { hasToken: !!this.token });
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config);
      console.log(`✅ [API] GET ${url} success`, { status: response.status });
      return response.data;
    } catch (error: any) {
      console.error(`❌ [API] GET ${url} failed`, {
        success: error.success,
        error: error.error,
        code: error.code,
        status: error.status
      });
      throw error;
    }
  }

  /**
   * POST запрос
   */
  async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    console.log(`🌐 [API] POST ${url}`, {
      data: data,
      hasToken: !!this.token
    });
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config);
      console.log(`✅ [API] POST ${url} success`, {
        status: response.status,
        success: response.data.success
      });
      return response.data;
    } catch (error: any) {
      console.error(`❌ [API] POST ${url} failed`, {
        success: error.success,
        error: error.error,
        code: error.code,
        status: error.status
      });
      throw error;
    }
  }

  /**
   * PUT запрос
   */
  async put<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * PATCH запрос
   */
  async patch<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * DELETE запрос
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET запрос с пагинацией
   */
  async getPaginated<T = any>(
    url: string, 
    params?: {
      limit?: number;
      offset?: number;
      page?: number;
      [key: string]: any;
    }
  ): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.get<PaginatedResponse<T>>(url, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Загрузка файла
   */
  async uploadFile<T = any>(
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<ApiResponse<T>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.client.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      throw error;
    }
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
    try {
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
    } catch (error) {
      throw error;
    }
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
      
      console.log('[ApiService] healthCheck URL:', healthUrl);
      
      const response = await axios.get(healthUrl, { timeout: 5000 });
      return response.data;
    } catch (error) {
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
