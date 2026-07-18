import { apiService, ApiResponse } from './api.service';

export type LeaderboardCategory =
  | 'TOTAL'
  | 'GASTRO'
  | 'RESPONSIBLE'
  | 'SOCIAL'
  | 'EXPLORER';

export interface LeaderboardUser {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

export interface LeaderboardEntry {
  position: number;
  userId?: number;
  totalXP: number;
  level: number;
  rank: string;
  gastroRating?: number;
  responsibleRating?: number;
  socialRating?: number;
  explorerRating?: number;
  user: LeaderboardUser;
}

export interface GetLeaderboardParams {
  category?: LeaderboardCategory;
  groupId?: number;
  limit?: number;
}

export const gamificationService = {
  async getLeaderboard({
    category = 'TOTAL',
    groupId,
    limit = 10,
  }: GetLeaderboardParams = {}): Promise<ApiResponse<LeaderboardEntry[]>> {
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('limit', String(limit));

    if (typeof groupId === 'number') {
      params.set('groupId', String(groupId));
    }

    return apiService.get<LeaderboardEntry[]>(
      `/gamification/leaderboard?${params.toString()}`
    );
  },
};
