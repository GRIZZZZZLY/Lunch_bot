/**
 * Streak Service - работа с серией дней подряд
 * Временная реализация на localStorage до добавления API
 */

import { UserStreak, checkMilestoneAchieved } from '@/types/streak.types';

const STORAGE_KEY = 'user_streak';

/**
 * Получить streak данные пользователя
 */
export function getUserStreak(userId: number): UserStreak {
  const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
  
  if (stored) {
    return JSON.parse(stored);
  }

  // Default streak
  return {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastVoteDate: '',
    totalVotes: 0,
    achievements: [],
  };
}

/**
 * Обновить streak после голосования
 */
export function updateStreakAfterVote(userId: number): {
  streak: UserStreak;
  milestoneAchieved: boolean;
  newMilestone?: any;
} {
  const streak = getUserStreak(userId);
  const today = new Date().toISOString().slice(0, 10);
  const lastVoteDate = streak.lastVoteDate;

  // Проверяем дату последнего голосования
  if (lastVoteDate === today) {
    // Уже голосовал сегодня - ничего не меняем
    return { streak, milestoneAchieved: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const previousStreak = streak.currentStreak;

  if (lastVoteDate === yesterdayStr) {
    // Голосовал вчера - продолжаем серию
    streak.currentStreak += 1;
  } else if (lastVoteDate === '') {
    // Первый голос
    streak.currentStreak = 1;
  } else {
    // Пропустил день - серия сбрасывается
    streak.currentStreak = 1;
  }

  streak.lastVoteDate = today;
  streak.totalVotes += 1;

  // Обновляем рекорд
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  // Сохраняем
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(streak));

  // Проверяем достижение milestone
  const milestone = checkMilestoneAchieved(previousStreak, streak.currentStreak);

  return {
    streak,
    milestoneAchieved: !!milestone,
    newMilestone: milestone,
  };
}
