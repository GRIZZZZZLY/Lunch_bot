import { apiService } from './api.service';
import type { Poll, PollResult, Vote } from '@/types/models';

export interface CreatePollInput {
  groupId: string;
  duration?: number;
  menuItemIds?: number[];
}

export interface CreatePollFromWebappInput {
  groupId: string | number;
  duration: number;
  selectedMenuItems: number[];
  title?: string;
  isMultiSelect?: boolean;
  maxSelections?: number;
}

export interface CreatePollFromWebappResult {
  pollId: number;
  messageId?: number;
  [k: string]: unknown;
}

class PollsService {
  getActive() {
    return apiService.get<Poll[]>('/polls/active');
  }

  getActiveForGroup(groupId: string) {
    return apiService.get<Poll | null>(`/polls/active/${groupId}`);
  }

  getById(id: number) {
    return apiService.get<Poll>(`/polls/${id}`);
  }

  getResults(pollId: number) {
    return apiService.get<PollResult>(`/polls/${pollId}/results`);
  }

  async getHistory(params?: { limit?: number; offset?: number; groupId?: string }) {
    const res = await apiService.get<{ polls: Poll[]; total: number; limit: number; offset: number; hasNext: boolean }>(
      '/polls',
      { params },
    );
    return {
      success: res.success,
      data: res.data?.polls ?? [],
      pagination: res.data
        ? { total: res.data.total, limit: res.data.limit, offset: res.data.offset, hasNext: res.data.hasNext }
        : undefined,
    };
  }

  getLastCompleted(groupId?: string) {
    const q = groupId ? `?groupId=${encodeURIComponent(groupId)}` : '';
    return apiService.get<Poll | null>(`/polls/last-completed${q}`);
  }

  create(data: CreatePollInput) {
    return apiService.post<Poll>('/polls', data);
  }

  createFromWebapp(data: CreatePollFromWebappInput) {
    return apiService.post<CreatePollFromWebappResult>('/polls/create-from-webapp', data);
  }

  vote(pollId: number, menuItemId: number) {
    return apiService.post<Vote>(`/polls/${pollId}/vote`, { menuItemId });
  }

  voteMultiple(pollId: number, menuItemIds: number[]) {
    return apiService.post<Vote[]>(`/polls/${pollId}/vote-multiple`, { menuItemIds });
  }

  getMyVotes(pollId: number) {
    return apiService.get<{ menuItemIds: number[] }>(`/polls/${pollId}/my-votes`);
  }

  withdrawVote(pollId: number) {
    return apiService.delete<void>(`/polls/${pollId}/vote`);
  }

  complete(pollId: number) {
    return apiService.patch<PollResult>(`/polls/${pollId}/complete`, {});
  }

  cancel(pollId: number, reason?: string) {
    return apiService.patch<Poll>(`/polls/${pollId}/cancel`, { reason });
  }
}

export const pollsService = new PollsService();
