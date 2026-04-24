import { apiService, ApiResponse } from './api.service';

export interface MenuSuggestion {
  id: number;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  suggestedBy: number;
  reviewedBy?: number;
  reviewedAt?: string;
  rejectionReason?: string;
  createdMenuItemId?: number;
  createdAt: string;
  updatedAt: string;
  suggester?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
  };
  reviewer?: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
  };
}

export interface CreateSuggestionData {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
}

export interface SuggestionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
}

/**
 * Сервис для работы с предложениями блюд
 */
class SuggestionService {
  /**
   * Создать новое предложение
   */
  async createSuggestion(data: CreateSuggestionData): Promise<ApiResponse<MenuSuggestion>> {
    return await apiService.post<MenuSuggestion>('/suggestions', data);
  }

  /**
   * Получить все предложения
   * Обычные пользователи видят только свои предложения
   * Админы видят все предложения
   */
  async getSuggestions(params?: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<MenuSuggestion[]>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `/suggestions${queryParams.toString() ? `?${  queryParams.toString()}` : ''}`;
    return await apiService.get<MenuSuggestion[]>(url);
  }

  /**
   * Получить предложение по ID
   */
  async getSuggestionById(id: number): Promise<ApiResponse<MenuSuggestion>> {
    return await apiService.get<MenuSuggestion>(`/suggestions/${id}`);
  }

  /**
   * Одобрить предложение (только админ)
   */
  async approveSuggestion(id: number): Promise<ApiResponse<{ suggestion: MenuSuggestion; menuItem: any }>> {
    return await apiService.post<{ suggestion: MenuSuggestion; menuItem: any }>(
      `/suggestions/${id}/approve`,
      {}
    );
  }

  /**
   * Отклонить предложение (только админ)
   */
  async rejectSuggestion(id: number, reason?: string): Promise<ApiResponse<MenuSuggestion>> {
    return await apiService.post<MenuSuggestion>(`/suggestions/${id}/reject`, { reason });
  }

  /**
   * Получить статистику предложений (только админ)
   */
  async getStats(): Promise<ApiResponse<SuggestionStats>> {
    return await apiService.get<SuggestionStats>('/suggestions/stats');
  }

  /**
   * Получить количество ожидающих предложений (только админ)
   */
  async getPendingCount(): Promise<ApiResponse<{ count: number }>> {
    return await apiService.get<{ count: number }>('/suggestions/pending-count');
  }

  /**
   * Удалить предложение (только админ, только отклонённые)
   */
  async deleteSuggestion(id: number): Promise<ApiResponse<void>> {
    return await apiService.delete<void>(`/suggestions/${id}`);
  }
}

export const suggestionService = new SuggestionService();
export default suggestionService;
