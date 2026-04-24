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

export interface ApiError {
  success: false;
  error: string;
  code: string;
  status?: number;
  [key: string]: unknown;
}
