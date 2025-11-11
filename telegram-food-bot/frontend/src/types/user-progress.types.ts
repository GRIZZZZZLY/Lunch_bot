/**
 * User Progress Types
 * Типы для системы прогресса, уровней и достижений
 */

export interface UserProgress {
  userId: number;
  xp: number;
  level: number;
  rank: 'Новичок' | 'Гурман' | 'Эксперт' | 'Мастер' | 'Легенда';
  nextLevelXp: number;
  totalVotes: number;
  totalSpent: number;
  favoriteCategory?: string;
  streak: number; // Дней подряд голосований
  accuracy: number; // % угаданных победителей
}

export interface Achievement {
  id: string;
  icon: string; // emoji
  name: string;
  description: string;
  requirement: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reward: {
    xp: number;
    badge?: string;
    discount?: number;
  };
}

export interface UserAchievement extends Achievement {
  isUnlocked: boolean;
  progress: number; // 0-100
  unlockedAt?: Date;
}

export interface FavoriteDish {
  id: number;
  name: string;
  category: string;
  orderCount: number;
  lastOrdered: Date;
  totalSpent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface LeaderboardUser {
  userId: number;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  rank: UserProgress['rank'];
  totalVotes: number;
  totalSpent: number;
  accuracy: number;
  position: number; // 1-10
}

// XP требования для уровней (экспоненциальный рост)
export const XP_LEVELS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  450,   // Level 4
  700,   // Level 5
  1000,  // Level 6
  1400,  // Level 7
  1900,  // Level 8
  2500,  // Level 9
  3200,  // Level 10
];

// Получить уровень по XP
export function getLevelFromXP(xp: number): number {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i]) {
      return i + 1;
    }
  }
  return 1;
}

// Получить ранг по уровню
export function getRankFromLevel(level: number): UserProgress['rank'] {
  if (level >= 10) return 'Легенда';
  if (level >= 7) return 'Мастер';
  if (level >= 5) return 'Эксперт';
  if (level >= 3) return 'Гурман';
  return 'Новичок';
}

// Получить прогресс к следующему уровню
export function getProgressToNextLevel(xp: number, level: number): {
  current: number;
  required: number;
  percentage: number;
} {
  const currentLevelXP = XP_LEVELS[level - 1] || 0;
  const nextLevelXP = XP_LEVELS[level] || XP_LEVELS[XP_LEVELS.length - 1];
  const current = xp - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  const percentage = Math.min((current / required) * 100, 100);

  return { current, required, percentage };
}

// Список всех 12 достижений
export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'gourmet',
    icon: '🥇',
    name: 'Гурман',
    description: 'Попробуй 20 разных блюд',
    requirement: 'Заказать 20 уникальных блюд',
    rarity: 'epic',
    reward: { xp: 500, badge: 'Гурман' },
  },
  {
    id: 'activist',
    icon: '🔥',
    name: 'Активист',
    description: 'Проголосуй 50 раз',
    requirement: '50 голосований',
    rarity: 'rare',
    reward: { xp: 300 },
  },
  {
    id: 'vip',
    icon: '💎',
    name: 'VIP',
    description: 'Потрать 10 000₽ на еду',
    requirement: 'Общие расходы: 10 000₽',
    rarity: 'legendary',
    reward: { xp: 1000, discount: 10 },
  },
  {
    id: 'adventurer',
    icon: '🎲',
    name: 'Авантюрист',
    description: 'Закажи 10 случайных блюд',
    requirement: '10 случайных выборов',
    rarity: 'common',
    reward: { xp: 200 },
  },
  {
    id: 'sniper',
    icon: '🎯',
    name: 'Снайпер',
    description: 'Угадай победителя в 80% голосований',
    requirement: 'Точность: 80%+',
    rarity: 'epic',
    reward: { xp: 500 },
  },
  {
    id: 'legend',
    icon: '⭐',
    name: 'Легенда',
    description: 'Получи все остальные достижения',
    requirement: 'Разблокировать 11 бейджей',
    rarity: 'legendary',
    reward: { xp: 2000, badge: 'Легенда' },
  },
  {
    id: 'marathon',
    icon: '🏃',
    name: 'Марафонец',
    description: 'Голосуй 7 дней подряд',
    requirement: 'Стрик: 7 дней',
    rarity: 'rare',
    reward: { xp: 400 },
  },
  {
    id: 'healthy',
    icon: '🥗',
    name: 'ЗОЖник',
    description: 'Закажи 15 салатов',
    requirement: '15 салатов',
    rarity: 'common',
    reward: { xp: 250 },
  },
  {
    id: 'pizza_lover',
    icon: '🍕',
    name: 'Пиццайоло',
    description: 'Закажи 20 пицц',
    requirement: '20 пицц',
    rarity: 'common',
    reward: { xp: 250 },
  },
  {
    id: 'explorer',
    icon: '🗺️',
    name: 'Исследователь',
    description: 'Попробуй все категории меню',
    requirement: 'Все категории',
    rarity: 'rare',
    reward: { xp: 400 },
  },
  {
    id: 'early_bird',
    icon: '🌅',
    name: 'Ранняя пташка',
    description: 'Проголосуй первым 10 раз',
    requirement: '10 первых голосов',
    rarity: 'rare',
    reward: { xp: 300 },
  },
  {
    id: 'generous',
    icon: '💰',
    name: 'Щедрый',
    description: 'Оплати за группу 5 раз',
    requirement: '5 раз ответственным',
    rarity: 'epic',
    reward: { xp: 500, discount: 5 },
  },
];

// Mock данные для разработки (TODO: заменить на API)
export const mockUserProgress: UserProgress = {
  userId: 1,
  xp: 850,
  level: 5,
  rank: 'Эксперт',
  nextLevelXp: 1000,
  totalVotes: 42,
  totalSpent: 3450,
  favoriteCategory: 'Пицца',
  streak: 5,
  accuracy: 78,
};

// Mock данные достижений пользователя
export const mockUserAchievements: UserAchievement[] = ALL_ACHIEVEMENTS.map((achievement, index) => ({
  ...achievement,
  isUnlocked: index < 4, // Первые 4 разблокированы
  progress: index < 4 ? 100 : [65, 80, 45, 30, 20, 55, 10, 90][index - 4] || 0,
  unlockedAt: index < 4 ? new Date(Date.now() - (4 - index) * 7 * 24 * 60 * 60 * 1000) : undefined,
}));

export const mockFavoriteDishes: FavoriteDish[] = [
  {
    id: 1,
    name: 'Пицца Маргарита',
    category: 'Пицца',
    orderCount: 7,
    lastOrdered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    totalSpent: 1400,
    trend: 'up',
  },
  {
    id: 2,
    name: 'Том Ям',
    category: 'Азиатское',
    orderCount: 5,
    lastOrdered: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    totalSpent: 1250,
    trend: 'stable',
  },
  {
    id: 3,
    name: 'Цезарь',
    category: 'Салаты',
    orderCount: 4,
    lastOrdered: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    totalSpent: 800,
    trend: 'down',
  },
];

// Mock данные лидерборда (топ-10 участников группы)
export const mockLeaderboard: LeaderboardUser[] = [
  {
    userId: 1,
    telegramId: 123456789,
    firstName: 'Александр',
    lastName: 'Иванов',
    username: 'alex_ivanov',
    xp: 3200,
    level: 10,
    rank: 'Легенда',
    totalVotes: 120,
    totalSpent: 15000,
    accuracy: 92,
    position: 1,
  },
  {
    userId: 2,
    telegramId: 234567890,
    firstName: 'Мария',
    lastName: 'Петрова',
    username: 'maria_p',
    xp: 2650,
    level: 9,
    rank: 'Мастер',
    totalVotes: 98,
    totalSpent: 12500,
    accuracy: 88,
    position: 2,
  },
  {
    userId: 3,
    telegramId: 345678901,
    firstName: 'Дмитрий',
    lastName: 'Смирнов',
    xp: 2100,
    level: 9,
    rank: 'Мастер',
    totalVotes: 85,
    totalSpent: 10200,
    accuracy: 85,
    position: 3,
  },
  {
    userId: 4,
    telegramId: 456789012,
    firstName: 'Елена',
    lastName: 'Козлова',
    username: 'elena_k',
    xp: 1750,
    level: 7,
    rank: 'Мастер',
    totalVotes: 72,
    totalSpent: 8900,
    accuracy: 81,
    position: 4,
  },
  {
    userId: 5,
    telegramId: 567890123,
    firstName: 'Андрей',
    xp: 1420,
    level: 7,
    rank: 'Мастер',
    totalVotes: 65,
    totalSpent: 7500,
    accuracy: 78,
    position: 5,
  },
  {
    userId: 6,
    telegramId: 678901234,
    firstName: 'Ты',
    lastName: '',
    username: 'current_user',
    xp: 850,
    level: 5,
    rank: 'Эксперт',
    totalVotes: 42,
    totalSpent: 3450,
    accuracy: 78,
    position: 6, // Текущий пользователь на 6 месте
  },
  {
    userId: 7,
    telegramId: 789012345,
    firstName: 'Ольга',
    lastName: 'Новикова',
    xp: 780,
    level: 5,
    rank: 'Эксперт',
    totalVotes: 38,
    totalSpent: 3100,
    accuracy: 75,
    position: 7,
  },
  {
    userId: 8,
    telegramId: 890123456,
    firstName: 'Сергей',
    username: 'sergey_m',
    xp: 620,
    level: 4,
    rank: 'Гурман',
    totalVotes: 32,
    totalSpent: 2600,
    accuracy: 72,
    position: 8,
  },
  {
    userId: 9,
    telegramId: 901234567,
    firstName: 'Наталья',
    lastName: 'Федорова',
    xp: 490,
    level: 4,
    rank: 'Гурман',
    totalVotes: 28,
    totalSpent: 2100,
    accuracy: 68,
    position: 9,
  },
  {
    userId: 10,
    telegramId: 12345678,
    firstName: 'Максим',
    username: 'max_dev',
    xp: 380,
    level: 3,
    rank: 'Гурман',
    totalVotes: 22,
    totalSpent: 1750,
    accuracy: 65,
    position: 10,
  },
];
