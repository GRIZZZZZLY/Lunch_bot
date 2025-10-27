/**
 * Gamification Types
 * Типы для системы геймификации, рейтингов и достижений
 */

export interface UserStats {
  id: number;
  userId: number;
  totalXP: number;
  level: number;
  gastroRating: number;
  responsibleRating: number;
  socialRating: number;
  explorerRating: number;
  
  pollsParticipated: number;
  pollsWon: number;
  timesResponsible: number;
  timesVolunteer: number;
  menuItemsAdded: number;
  paymentsOnTime: number;
  newDishesDiscovered: number;
  
  currentStreak: number;
  longestStreak: number;
  lastVoteDate?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface GroupStats {
  groupId: number;
  totalMembers: number;
  activeMembers: number;
  averageLevel: number;
  groupStreak: number;
  
  // Средние рейтинги группы
  avgGastroRating: number;
  avgResponsibleRating: number;
  avgSocialRating: number;
  avgExplorerRating: number;
  
  // Топ участники по категориям
  topGastro?: TopUser;
  topResponsible?: TopUser;
  topSocial?: TopUser;
  topExplorer?: TopUser;
  
  lastUpdated: string;
}

export interface TopUser {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  level: number;
  xp: number;
  rank: number;
}

export interface QuestReward {
  id: string;
  icon: string;
  title: string;
  description: string;
  xpAmount: number;
  color: 'green' | 'mint' | 'orange' | 'lavender' | 'blue';
  completed?: boolean;
  questKey?: string;
}

export interface DailyQuest {
  id: number;
  questId: number;
  title: string;
  description: string;
  progress: number;
  target: number;
  xpReward: number;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresAt: string;
  category: string;
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
  unlocked?: boolean;
  unlockedAt?: string;
  progress?: number;
}

export interface RatingCategory {
  key: 'GASTRO' | 'RESPONSIBLE' | 'SOCIAL' | 'EXPLORER';
  name: string;
  icon: string;
  color: string;
  percentage: number;
  topUser?: TopUser;
}

export interface UserRanking {
  userId: number;
  rank: number;
  totalRank: number;
  change: number; // Изменение позиции за день
  categories: {
    gastro: { rank: number; xp: number };
    responsible: { rank: number; xp: number };
    social: { rank: number; xp: number };
    explorer: { rank: number; xp: number };
  };
}

export interface LevelProgress {
  currentLevel: number;
  currentXP: number;
  nextLevelXP: number;
  percentage: number;
  xpToNextLevel: number;
}
