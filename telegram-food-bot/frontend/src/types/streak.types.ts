/**
 * Типы для системы Streaks (серии дней подряд)
 */

export interface UserStreak {
  userId: number;
  currentStreak: number;
  longestStreak: number;
  lastVoteDate: string;
  totalVotes: number;
  achievements: StreakAchievement[];
}

export interface StreakAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  daysRequired: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface StreakMilestone {
  days: number;
  title: string;
  emoji: string;
  color: string;
  message: string;
}

/**
 * Predefined milestones
 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 3,
    title: 'Начало серии',
    emoji: '🔥',
    color: 'orange',
    message: '3 дня подряд! Отличное начало!',
  },
  {
    days: 7,
    title: 'Недельный чемпион',
    emoji: '⚡',
    color: 'yellow',
    message: 'Целая неделя! Ты на правильном пути!',
  },
  {
    days: 14,
    title: 'Двухнедельный марафон',
    emoji: '💪',
    color: 'blue',
    message: '2 недели подряд! Невероятно!',
  },
  {
    days: 30,
    title: 'Месячная легенда',
    emoji: '👑',
    color: 'purple',
    message: 'Месяц без пропусков! Ты легенда!',
  },
  {
    days: 50,
    title: 'Мастер привычек',
    emoji: '🏆',
    color: 'gold',
    message: '50 дней! Это уже привычка!',
  },
  {
    days: 100,
    title: 'Сотня!',
    emoji: '💯',
    color: 'rainbow',
    message: '100 дней подряд — рекорд!',
  },
];

/**
 * Проверить достиг ли пользователь нового milestone
 */
export function checkMilestoneAchieved(
  previousStreak: number,
  currentStreak: number
): StreakMilestone | null {
  const milestone = STREAK_MILESTONES.find(
    m => m.days > previousStreak && m.days <= currentStreak
  );
  return milestone || null;
}
