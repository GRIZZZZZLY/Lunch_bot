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
  const today = new Date().toISOString().split('T')[0];
  const lastVoteDate = streak.lastVoteDate;

  // Проверяем дату последнего голосования
  if (lastVoteDate === today) {
    // Уже голосовал сегодня - ничего не меняем
    return { streak, milestoneAchieved: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

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

/**
 * Проверить сломана ли серия (для предупреждений)
 */
export function checkStreakAtRisk(userId: number): {
  atRisk: boolean;
  broken: boolean;
  daysLost: number;
} {
  const streak = getUserStreak(userId);
  
  if (streak.currentStreak === 0) {
    return { atRisk: false, broken: false, daysLost: 0 };
  }

  const today = new Date().toISOString().split('T')[0];
  const lastVoteDate = streak.lastVoteDate;

  if (lastVoteDate === today) {
    // Уже голосовал сегодня - всё ок
    return { atRisk: false, broken: false, daysLost: 0 };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (lastVoteDate === yesterdayStr) {
    // Голосовал вчера, но не сегодня - серия под угрозой
    return { atRisk: true, broken: false, daysLost: 0 };
  }

  // Серия сломана
  const lastDate = new Date(lastVoteDate);
  const todayDate = new Date(today);
  const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  return { atRisk: false, broken: true, daysLost: daysDiff };
}

/**
 * Получить мотивационное сообщение на основе streak
 */
export function getStreakMotivation(streak: UserStreak): string {
  const { currentStreak } = streak;

  if (currentStreak === 0) {
    return '🔥 Начни свою серию сегодня! Проголосуй и начни путь к достижениям!';
  }

  if (currentStreak === 1) {
    return '💪 Отличное начало! Продолжай завтра и серия начнёт расти!';
  }

  if (currentStreak === 2) {
    return '🎯 Ещё один день и будет 3 подряд! Не останавливайся!';
  }

  if (currentStreak < 7) {
    return `🔥 ${currentStreak} дней подряд! Продолжай в том же духе!`;
  }

  if (currentStreak < 14) {
    return `⚡ ${currentStreak} дней подряд! Ты на правильном пути!`;
  }

  if (currentStreak < 30) {
    return `💪 ${currentStreak} дней подряд! Невероятная серия!`;
  }

  if (currentStreak < 50) {
    return `👑 ${currentStreak} дней подряд!`;
  }

  if (currentStreak < 100) {
    return `🏆 ${currentStreak} дней подряд! Мастер привычек!`;
  }

  return `💯 ${currentStreak} дней подряд!`;
}

/**
 * Экспорт/импорт данных (для синхронизации с backend в будущем)
 */
export function exportStreakData(userId: number): string {
  const streak = getUserStreak(userId);
  return JSON.stringify(streak);
}

export function importStreakData(userId: number, data: string): void {
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, data);
}
