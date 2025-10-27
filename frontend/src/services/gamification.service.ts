/**
 * Gamification Service (Mock для разработки UI)
 * TODO: Заменить на реальные API эндпоинты когда backend будет готов
 */

import { 
  UserStats, 
  GroupStats, 
  QuestReward, 
  DailyQuest,
  Achievement,
  UserRanking,
  LevelProgress,
  TopUser
} from '../types/gamification.types';

class GamificationService {
  
  /**
   * Получить статистику пользователя
   */
  async getUserStats(userId: number): Promise<UserStats> {
    // Mock данные
    return {
      id: 1,
      userId,
      totalXP: 2450,
      level: 12,
      gastroRating: 1200,
      responsibleRating: 800,
      socialRating: 1500,
      explorerRating: 900,
      
      pollsParticipated: 45,
      pollsWon: 18,
      timesResponsible: 8,
      timesVolunteer: 3,
      menuItemsAdded: 2,
      paymentsOnTime: 15,
      newDishesDiscovered: 12,
      
      currentStreak: 3,
      longestStreak: 7,
      lastVoteDate: new Date().toISOString(),
      
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Получить статистику группы
   */
  async getGroupStats(groupId: number): Promise<GroupStats> {
    // Mock данные
    return {
      groupId,
      totalMembers: 12,
      activeMembers: 10,
      averageLevel: 8,
      groupStreak: 5,
      
      avgGastroRating: 80,
      avgResponsibleRating: 60,
      avgSocialRating: 90,
      avgExplorerRating: 40,
      
      topGastro: {
        userId: 101,
        firstName: 'Иван',
        lastName: 'Смирнов',
        username: 'ivan_s',
        level: 15,
        xp: 4200,
        rank: 1
      },
      topResponsible: {
        userId: 102,
        firstName: 'Мария',
        lastName: 'Кузнецова',
        level: 14,
        xp: 3800,
        rank: 1
      },
      topSocial: {
        userId: 103,
        firstName: 'Алексей',
        lastName: 'Петров',
        level: 13,
        xp: 3400,
        rank: 1
      },
      topExplorer: {
        userId: 104,
        firstName: 'Елена',
        lastName: 'Волкова',
        level: 11,
        xp: 2800,
        rank: 1
      },
      
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Получить возможные награды сегодня
   */
  async getTodayRewards(userId: number): Promise<QuestReward[]> {
    // Mock данные
    return [
      {
        id: '1',
        icon: '✅',
        title: 'Первое голосование дня',
        description: 'Проголосуй в текущем голосовании',
        xpAmount: 20,
        color: 'green',
        completed: false,
        questKey: 'DAILY_VOTE'
      },
      {
        id: '2',
        icon: '✨',
        title: 'Голос за новое блюдо',
        description: 'Ещё не пробовал: 8 блюд',
        xpAmount: 30,
        color: 'mint',
        completed: false,
        questKey: 'NEW_DISH'
      },
      {
        id: '3',
        icon: '🔥',
        title: 'Продлить серию',
        description: 'Текущая: 3 дня',
        xpAmount: 15,
        color: 'orange',
        completed: false,
        questKey: 'STREAK'
      }
    ];
  }
  
  /**
   * Получить ежедневные квесты
   */
  async getDailyQuests(userId: number): Promise<DailyQuest[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    return [
      {
        id: 1,
        questId: 10,
        title: 'Проголосуй сегодня',
        description: 'Участвуй в любом голосовании',
        progress: 0,
        target: 1,
        xpReward: 20,
        status: 'ACTIVE',
        expiresAt: tomorrow.toISOString(),
        category: 'SOCIAL'
      },
      {
        id: 2,
        questId: 11,
        title: 'Попробуй новое',
        description: 'Проголосуй за блюдо, которое не пробовал',
        progress: 1,
        target: 1,
        xpReward: 30,
        status: 'COMPLETED',
        expiresAt: tomorrow.toISOString(),
        category: 'EXPLORER'
      }
    ];
  }
  
  /**
   * Получить рейтинг пользователя
   */
  async getUserRanking(userId: number, groupId: number): Promise<UserRanking> {
    return {
      userId,
      rank: 5,
      totalRank: 12,
      change: 2, // Поднялся на 2 места
      categories: {
        gastro: { rank: 3, xp: 1200 },
        responsible: { rank: 7, xp: 800 },
        social: { rank: 2, xp: 1500 },
        explorer: { rank: 4, xp: 900 }
      }
    };
  }
  
  /**
   * Рассчитать прогресс уровня
   */
  calculateLevelProgress(totalXP: number): LevelProgress {
    const currentLevel = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    const nextLevelXP = Math.pow(currentLevel, 2) * 100;
    const currentLevelXP = Math.pow(currentLevel - 1, 2) * 100;
    const xpInCurrentLevel = totalXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    const percentage = Math.floor((xpInCurrentLevel / xpNeededForLevel) * 100);
    
    return {
      currentLevel,
      currentXP: totalXP,
      nextLevelXP,
      percentage,
      xpToNextLevel: nextLevelXP - totalXP
    };
  }
  
  /**
   * Получить достижения пользователя
   */
  async getUserAchievements(userId: number): Promise<{ unlocked: Achievement[]; total: number }> {
    // Mock данные
    const unlockedAchievements: Achievement[] = [
      {
        id: 1,
        key: 'FIRST_VOTE',
        title: 'Первый укус',
        description: 'Проголосовал впервые',
        icon: '🍽️',
        category: 'GASTRO',
        rarity: 'COMMON',
        xpReward: 10,
        unlocked: true,
        unlockedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    return {
      unlocked: unlockedAchievements,
      total: 45
    };
  }
}

export const gamificationService = new GamificationService();
