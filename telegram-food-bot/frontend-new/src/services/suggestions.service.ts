import { apiService } from './api.service';
import type { MenuSuggestion, SuggestionStatus } from '@/types/models';

export interface CreateSuggestionInput {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
}

export interface SuggestionStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

class SuggestionsService {
  list(params?: { status?: SuggestionStatus; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset !== undefined) q.set('offset', String(params.offset));
    return apiService.get<MenuSuggestion[]>(
      `/suggestions${q.toString() ? `?${q}` : ''}`,
    );
  }

  getById(id: number) {
    return apiService.get<MenuSuggestion>(`/suggestions/${id}`);
  }

  create(data: CreateSuggestionInput) {
    return apiService.post<MenuSuggestion>('/suggestions', data);
  }

  approve(id: number) {
    return apiService.post<MenuSuggestion>(`/suggestions/${id}/approve`);
  }

  reject(id: number, reason?: string) {
    return apiService.post<MenuSuggestion>(`/suggestions/${id}/reject`, { reason });
  }

  remove(id: number) {
    return apiService.delete<void>(`/suggestions/${id}`);
  }

  getStats() {
    return apiService.get<SuggestionStats>('/suggestions/stats');
  }

  getPendingCount() {
    return apiService.get<{ count: number }>('/suggestions/pending-count');
  }
}

export const suggestionsService = new SuggestionsService();
