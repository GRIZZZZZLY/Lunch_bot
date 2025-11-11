/**
 * Gamification Service - Sprint 6
 *
 * Frontend service for gamification features:
 * - User stats (XP, level, rank, ratings)
 * - Achievements
 * - Quests (daily/weekly)
 * - Leaderboards
 * - XP history
 */

import { apiService } from './api.service';
import { ApiResponse } from './api.service';

// ==================== TYPES ====================

export interface UserStats {
  id: number;
  userId: number;
  totalXP: number;
  level: number;
  rank: string;
  gastroRating: number;
  responsibleRating: number;
  socialRating: number;
  explorerRating: number;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: Date | null;
  pollsParticipated: number;
  pollsWon: number;
  totalVotes: number;
  correctPredictions: number;
  timesResponsible: number;
  timesVolunteer: number;
  ordersReceived: number;
  paymentsOnTime: number;
  totalSpent: number;
  totalOrders: number;
  newDishesDiscovered: number;
  categoriesTried: number;
  menuItemsAdded: number;
  referralsCount: number;
  xpProgress: number;
  xpRequired: number;
  progressPercent: number;
  user?: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export interface Achievement {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string;
  category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  xpReward: number;
  requirement: string;
  isHidden: boolean;
  isActive: boolean;
  unlocked?: boolean;
  unlockedAt?: Date;
}

export interface Quest {
  id: number;
  key: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY' | 'RANDOM' | 'EVENT';
  category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';
  icon: string;
  xpReward: number;
  requirement: string;
  duration: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  progress: number;
  target: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  startedAt: Date;
  expiresAt: Date;
  progressPercent: number;
}

export interface QuestStats {
  totalCompleted: number;
  dailyCompleted: number;
  weeklyCompleted: number;
  activeQuests: number;
}

export interface QuestsResponse {
  quests: Quest[];
  stats: QuestStats;
}

export interface XPHistoryEntry {
  id: number;
  userId: number;
  amount: number;
  reason: string;
  category: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';
  metadata: string | null;
  createdAt: Date;
}

export interface LeaderboardEntry {
  position: number;
  id: number;
  userId: number;
  totalXP: number;
  level: number;
  rank: string;
  gastroRating: number;
  responsibleRating: number;
  socialRating: number;
  explorerRating: number;
  user: {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
  };
}

export type LeaderboardCategory = 'TOTAL' | 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';

// ==================== SERVICE ====================

class GamificationService {
  /**
   * Get current user's stats (XP, level, rank, ratings, progress)
   */
  async getUserStats(): Promise<UserStats> {
    const response = await apiService.get<UserStats>('/gamification/user/stats');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user stats');
    }
    return response.data;
  }

  /**
   * Get all achievements with user's unlock status
   */
  async getUserAchievements(): Promise<Achievement[]> {
    const response = await apiService.get<Achievement[]>(
      '/gamification/user/achievements'
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get achievements');
    }
    return response.data;
  }

  /**
   * Get user's active quests
   */
  async getUserQuests(): Promise<QuestsResponse> {
    const response = await apiService.get<QuestsResponse>(
      '/gamification/user/quests'
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get quests');
    }
    return response.data;
  }

  /**
   * Get user's XP history
   */
  async getXPHistory(limit: number = 50): Promise<XPHistoryEntry[]> {
    const response = await apiService.get<XPHistoryEntry[]>(
      `/gamification/user/xp-history?limit=${limit}`
    );
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get XP history');
    }
    return response.data;
  }

  /**
   * Get leaderboard for a specific category
   * @param seasonId - Season ID (undefined = all-time, number = specific season)
   */
  async getLeaderboard(
    category: LeaderboardCategory = 'TOTAL',
    limit: number = 10,
    groupId?: number,
    seasonId?: number
  ): Promise<LeaderboardEntry[]> {
    let url = `/gamification/leaderboard?category=${category}&limit=${limit}`;
    if (groupId) {
      url += `&groupId=${groupId}`;
    }
    if (seasonId !== undefined) {
      url += `&seasonId=${seasonId}`;
    }

    const response = await apiService.get<LeaderboardEntry[]>(url);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get leaderboard');
    }
    return response.data;
  }

  /**
   * Calculate XP for a specific level
   */
  calculateXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Calculate level from total XP
   */
  calculateLevel(totalXP: number): number {
    if (totalXP <= 0) return 1;
    const level = Math.floor(Math.pow(totalXP / 100, 2 / 3));
    return Math.max(1, level);
  }

  /**
   * Get rank title from level
   */
  getRankTitle(level: number): string {
    if (level >= 25) return 'Гранд-мастер';
    if (level >= 20) return 'Легенда';
    if (level >= 15) return 'Мастер';
    if (level >= 10) return 'Эксперт';
    if (level >= 5) return 'Гурман';
    return 'Новичок';
  }

  /**
   * Get rank color based on level
   */
  getRankColor(level: number): string {
    if (level >= 25) return 'text-purple-400'; // Grand Master
    if (level >= 20) return 'text-yellow-400'; // Legend
    if (level >= 15) return 'text-blue-400'; // Master
    if (level >= 10) return 'text-green-400'; // Expert
    if (level >= 5) return 'text-cyan-400'; // Gourmet
    return 'text-gray-400'; // Novice
  }

  /**
   * Get achievement rarity color
   */
  getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'LEGENDARY':
        return 'text-yellow-400 border-yellow-400';
      case 'EPIC':
        return 'text-purple-400 border-purple-400';
      case 'RARE':
        return 'text-blue-400 border-blue-400';
      case 'COMMON':
      default:
        return 'text-gray-400 border-gray-400';
    }
  }

  /**
   * Get category color
   */
  getCategoryColor(category: string): string {
    switch (category) {
      case 'GASTRO':
        return 'text-orange-400';
      case 'RESPONSIBLE':
        return 'text-green-400';
      case 'SOCIAL':
        return 'text-blue-400';
      case 'EXPLORER':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    switch (category) {
      case 'GASTRO':
        return '🍽️';
      case 'RESPONSIBLE':
        return '⭐';
      case 'SOCIAL':
        return '👥';
      case 'EXPLORER':
        return '🔍';
      default:
        return '❓';
    }
  }

  /**
   * Format XP number with K suffix
   */
  formatXP(xp: number): string {
    if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  }

  /**
   * Get quest type label in Russian
   */
  getQuestTypeLabel(type: string): string {
    switch (type) {
      case 'DAILY':
        return 'Ежедневный';
      case 'WEEKLY':
        return 'Недельный';
      case 'RANDOM':
        return 'Случайный';
      case 'EVENT':
        return 'Событие';
      default:
        return type;
    }
  }

  /**
   * Get time remaining for quest
   */
  getTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Истекло';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} дн.`;
    } else if (hours > 0) {
      return `${hours} ч.`;
    } else {
      return `${minutes} мин.`;
    }
  }
}

// Export singleton instance
export const gamificationService = new GamificationService();
