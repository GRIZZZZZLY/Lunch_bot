import { apiService } from './api.service';

/**
 * Season Service - Frontend сервис для работы с сезонами
 * Sprint 6: Season System
 */

export interface Season {
  id: number;
  number: number;
  name: string;
  theme?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  rewards?: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonLeaderboardEntry {
  userId: number;
  totalXP: number;
  position: number;
  user: {
    firstName: string;
    lastName?: string | null;
    username?: string | null;
  };
}

export interface SeasonUserStats {
  seasonId: number;
  seasonName: string;
  totalXP: number;
  position: number | null;
  categoriesBreakdown: {
    GASTRO: number;
    RESPONSIBLE: number;
    SOCIAL: number;
    EXPLORER: number;
  };
}

class SeasonService {
  /**
   * Получить все сезоны
   */
  async getSeasons(limit?: number): Promise<Season[]> {
    try {
      let url = '/seasons';
      if (limit) {
        url += `?limit=${limit}`;
      }
      const response = await apiService.get<Season[]>(url);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get seasons');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to get seasons:', error);
      throw error;
    }
  }

  /**
   * Получить текущий активный сезон
   */
  async getCurrentSeason(): Promise<Season | null> {
    try {
      const response = await apiService.get<Season>('/seasons/current');
      if (!response.success) {
        return null;
      }
      return response.data || null;
    } catch (error: any) {
      console.error('Failed to get current season:', error);
      return null;
    }
  }

  /**
   * Получить сезон по ID
   */
  async getSeasonById(seasonId: number): Promise<Season> {
    try {
      const response = await apiService.get<Season>(`/seasons/${seasonId}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get season');
      }
      return response.data;
    } catch (error) {
      console.error(`Failed to get season ${seasonId}:`, error);
      throw error;
    }
  }

  /**
   * Получить лидерборд сезона
   */
  async getSeasonLeaderboard(seasonId: number, limit: number = 10): Promise<SeasonLeaderboardEntry[]> {
    try {
      const response = await apiService.get<SeasonLeaderboardEntry[]>(
        `/seasons/${seasonId}/leaderboard?limit=${limit}`
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get leaderboard');
      }
      return response.data;
    } catch (error) {
      console.error(`Failed to get season ${seasonId} leaderboard:`, error);
      throw error;
    }
  }

  /**
   * Получить статистику пользователя за сезон
   */
  async getUserSeasonStats(userId: number, seasonId?: number): Promise<SeasonUserStats | null> {
    try {
      const url = seasonId
        ? `/seasons/${seasonId}/stats/${userId}`
        : `/seasons/current/stats/${userId}`;

      const response = await apiService.get<SeasonUserStats>(url);
      if (!response.success) {
        return null;
      }
      return response.data || null;
    } catch (error: any) {
      console.error('Failed to get user season stats:', error);
      return null;
    }
  }

  /**
   * Ротировать сезон (admin only)
   */
  async rotateSeason(): Promise<Season> {
    try {
      const response = await apiService.post<Season>('/seasons/rotate');
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to rotate season');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to rotate season:', error);
      throw error;
    }
  }

  /**
   * Создать новый месячный сезон (admin only)
   */
  async createMonthlySeason(): Promise<Season> {
    try {
      const response = await apiService.post<Season>('/seasons/create');
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create season');
      }
      return response.data;
    } catch (error) {
      console.error('Failed to create season:', error);
      throw error;
    }
  }

  /**
   * Получить дни до конца сезона
   */
  getDaysRemaining(season: Season): number {
    const endDate = new Date(season.endDate);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Проверить, активен ли сезон
   */
  isSeasonActive(season: Season): boolean {
    const now = new Date();
    const startDate = new Date(season.startDate);
    const endDate = new Date(season.endDate);
    return now >= startDate && now <= endDate && season.isActive;
  }

  /**
   * Получить процент прогресса сезона (0-100)
   */
  getSeasonProgress(season: Season): number {
    const now = new Date();
    const startDate = new Date(season.startDate);
    const endDate = new Date(season.endDate);

    if (now < startDate) return 0;
    if (now > endDate) return 100;

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();

    return Math.round((elapsed / totalDuration) * 100);
  }
}

export const seasonService = new SeasonService();
