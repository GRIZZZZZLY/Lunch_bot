import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

const TOKEN_KEY = 'auth_token';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

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
      return config;
    });

    this.client.interceptors.response.use(
      (r) => r,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          if (status === 401) this.clearToken();
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

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.get<ApiResponse<T>>(url, config);
    return r.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.post<ApiResponse<T>>(url, data, config);
    return r.data;
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.put<ApiResponse<T>>(url, data, config);
    return r.data;
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.patch<ApiResponse<T>>(url, data, config);
    return r.data;
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const r = await this.client.delete<ApiResponse<T>>(url, config);
    return r.data;
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
