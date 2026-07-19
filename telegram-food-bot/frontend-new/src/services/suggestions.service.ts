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

// groupId обязателен на бэке для create/approve/reject/delete/stats/pending и
// опционален для list (фильтр по группе). Предложения per-group — как меню.
function withGroup(query: URLSearchParams, groupId?: string) {
  if (groupId) query.set('groupId', groupId);
  const s = query.toString();
  return s ? `?${s}` : '';
}

class SuggestionsService {
  list(params?: { status?: SuggestionStatus; limit?: number; offset?: number; groupId?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.offset !== undefined) q.set('offset', String(params.offset));
    return apiService.get<MenuSuggestion[]>(`/suggestions${withGroup(q, params?.groupId)}`);
  }

  getById(id: number) {
    return apiService.get<MenuSuggestion>(`/suggestions/${id}`);
  }

  create(data: CreateSuggestionInput, groupId?: string) {
    return apiService.post<MenuSuggestion>('/suggestions', { ...data, groupId });
  }

  approve(id: number, groupId?: string) {
    return apiService.post<MenuSuggestion>(`/suggestions/${id}/approve`, { groupId });
  }

  reject(id: number, reason?: string, groupId?: string) {
    return apiService.post<MenuSuggestion>(`/suggestions/${id}/reject`, { reason, groupId });
  }

  remove(id: number, groupId?: string) {
    return apiService.delete<void>(`/suggestions/${id}${withGroup(new URLSearchParams(), groupId)}`);
  }

  getStats(groupId?: string) {
    return apiService.get<SuggestionStats>(`/suggestions/stats${withGroup(new URLSearchParams(), groupId)}`);
  }

  getPendingCount(groupId?: string) {
    return apiService.get<{ count: number }>(
      `/suggestions/pending-count${withGroup(new URLSearchParams(), groupId)}`,
    );
  }
}

export const suggestionsService = new SuggestionsService();
