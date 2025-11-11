/**
 * Gamification Types - Sprint 3.4
 * 
 * Types for user progress, achievements, and challenges system
 */

export interface UserProgress {
  id: number;
  userId: number;
  xp: number;
  level: number;
  rank: string;
  totalVotes: number;
  totalOrders: number;
  totalSpent: number;
  winStreak: number;
  maxWinStreak: number;
  categoriesTried: number;
  randomChoices: number;
  correctPredictions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Achievement {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: string;
  requirement: AchievementRequirement;
  reward: AchievementReward;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'general' | 'voting' | 'budget' | 'food';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementRequirement {
  type: string; // 'votes', 'orders', 'spent', 'categories', 'streak', etc.
  count: number;
}

export interface AchievementReward {
  xp: number;
  badge?: string;
  discount?: number;
}

export interface UserAchievement {
  id: number;
  userId: number;
  achievementId: number;
  unlockedAt: Date;
  achievement?: Achievement;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  target: ChallengeTarget;
  reward: ChallengeReward;
  deadline?: Date;
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeTarget {
  type: string; // 'votes', 'streak', 'categories', 'spent', etc.
  count: number;
}

export interface ChallengeReward {
  xp: number;
  badge?: string;
  discount?: number;
}

export interface UserChallengeProgress {
  id: number;
  userId: number;
  challengeId: number;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  challenge?: Challenge;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  rank: string;
  position: number;
}

export interface UserProgressWithAchievements extends UserProgress {
  achievements: UserAchievement[];
  challengeProgress: UserChallengeProgress[];
}

// XP calculation constants
export const XP_REWARDS = {
  VOTE: 10,
  WIN_PREDICTION: 25,
  COMPLETE_POLL: 15,
  DAILY_LOGIN: 5,
  WEEK_STREAK: 50,
  MONTH_STREAK: 200,
  TRY_NEW_CATEGORY: 20,
  RANDOM_CHOICE: 15,
  ACHIEVEMENT_COMMON: 100,
  ACHIEVEMENT_RARE: 250,
  ACHIEVEMENT_EPIC: 500,
  ACHIEVEMENT_LEGENDARY: 1000,
} as const;

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2100,   // Level 7
  2800,   // Level 8
  3600,   // Level 9
  4500,   // Level 10
  5500,   // Level 11
  6600,   // Level 12
  7800,   // Level 13
  9100,   // Level 14
  10500,  // Level 15
  12000,  // Level 16
  13600,  // Level 17
  15300,  // Level 18
  17100,  // Level 19
  19000,  // Level 20
] as const;

// Ranks based on level
export const RANKS = {
  1: 'Новичок',
  5: 'Гурман',
  10: 'Эксперт',
  15: 'Мастер',
  20: 'Легенда',
} as const;

// Helper function to calculate level from XP
export function getLevelFromXP(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

// Helper function to get rank from level
export function getRankFromLevel(level: number): string {
  if (level >= 20) return RANKS[20];
  if (level >= 15) return RANKS[15];
  if (level >= 10) return RANKS[10];
  if (level >= 5) return RANKS[5];
  return RANKS[1];
}

// Helper function to calculate XP needed for next level
export function getXPForNextLevel(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    return 0; // Max level
  }
  return LEVEL_THRESHOLDS[currentLevel] - currentXP;
}

// Helper function to calculate progress percentage to next level
export function getProgressToNextLevel(currentXP: number): number {
  const currentLevel = getLevelFromXP(currentXP);
  if (currentLevel >= LEVEL_THRESHOLDS.length) {
    return 100; // Max level
  }
  
  const currentLevelXP = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextLevelXP = LEVEL_THRESHOLDS[currentLevel];
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return Math.min((xpInCurrentLevel / xpNeededForLevel) * 100, 100);
}
