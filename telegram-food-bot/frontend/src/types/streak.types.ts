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
 * Получить следующий milestone для пользователя
 */
export function getNextMilestone(currentStreak: number): StreakMilestone | null {
  return STREAK_MILESTONES.find(m => m.days > currentStreak) || null;
}

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

/**
 * Получить прогресс до следующего milestone (0-100)
 */
export function getProgressToNextMilestone(currentStreak: number): {
  progress: number;
  nextMilestone: StreakMilestone | null;
  daysRemaining: number;
} {
  const next = getNextMilestone(currentStreak);
  
  if (!next) {
    return { progress: 100, nextMilestone: null, daysRemaining: 0 };
  }

  const previousMilestone = STREAK_MILESTONES
    .filter(m => m.days <= currentStreak)
    .pop();
  
  const start = previousMilestone?.days || 0;
  const end = next.days;
  const current = currentStreak;
  
  const progress = ((current - start) / (end - start)) * 100;
  const daysRemaining = end - current;
  
  return { progress, nextMilestone: next, daysRemaining };
}
