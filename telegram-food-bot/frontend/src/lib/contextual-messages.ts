/**
 * Контекстные сообщения для создания эмоциональной связи с пользователем
 * 
 * Адаптируются под:
 * - Время суток
 * - Статус голосования
 * - Действия пользователя
 */

import { TimeOfDay } from '../hooks/useTimeBasedGradient';

export interface ContextualMessageOptions {
  timeOfDay: TimeOfDay;
  hasActivePoll: boolean;
  hasVoted: boolean;
  isPollEnding: boolean; // < 5 минут до закрытия
  hasCompletedPoll: boolean;
  userName?: string;
}

/**
 * Генерирует контекстное приветствие
 */
export function getContextualGreeting(options: ContextualMessageOptions): {
  greeting: string;
  message: string;
  emoji: string;
} {
  const { timeOfDay, hasActivePoll, hasVoted, isPollEnding, hasCompletedPoll, userName } = options;
  const name = userName || 'Гость';

  // === АКТИВНОЕ ГОЛОСОВАНИЕ ===
  if (hasActivePoll) {
    // Пользователь уже проголосовал
    if (hasVoted) {
      if (isPollEnding) {
        return {
          greeting: `${name}, последние минуты!`,
          message: 'Твой голос учтён. Скоро узнаем победителя.',
          emoji: ''
        };
      }
      
      return {
        greeting: `Отлично, ${name}!`,
        message: 'Твой голос учтён. Можешь расслабиться.',
        emoji: ''
      };
    }

    // Пользователь НЕ проголосовал
    if (isPollEnding) {
      return {
        greeting: `${name}, спешите!`,
        message: 'Осталось меньше 5 минут. Не упусти шанс.',
        emoji: ''
      };
    }

    // Время суток влияет на настроение
    switch (timeOfDay) {
      case 'morning':
        return {
          greeting: `Доброе утро, ${name}!`,
          message: 'Голосование открыто. Что выберешь сегодня?',
          emoji: ''
        };
      
      case 'afternoon':
        return {
          greeting: `Время обеда, ${name}!`,
          message: 'Голосование активно. Сделай свой выбор.',
          emoji: ''
        };
      
      case 'evening':
        return {
          greeting: `Добрый вечер, ${name}!`,
          message: 'Еще можно проголосовать. Не упусти момент.',
          emoji: ''
        };
      
      case 'night':
        return {
          greeting: `${name}, ты не спишь?`,
          message: 'Голосование все еще открыто. Может проголосуешь?',
          emoji: ''
        };
    }
  }

  // === ЗАВЕРШЕННОЕ ГОЛОСОВАНИЕ (сегодня было) ===
  if (hasCompletedPoll) {
    switch (timeOfDay) {
      case 'morning':
      case 'afternoon':
        return {
          greeting: `${name}, обед выбран!`,
          message: 'Результаты уже известны. Приятного аппетита.',
          emoji: ''
        };
      
      case 'evening':
        return {
          greeting: `Как прошел обед, ${name}?`,
          message: 'Надеюсь, было вкусно. До завтра.',
          emoji: ''
        };
      
      case 'night':
        return {
          greeting: `Спокойной ночи, ${name}!`,
          message: 'Обед был сегодня. Увидимся завтра.',
          emoji: ''
        };
    }
  }

  // === НЕТ АКТИВНОГО ГОЛОСОВАНИЯ ===
  switch (timeOfDay) {
    case 'morning':
      return {
        greeting: `Доброе утро, ${name}!`,
        message: 'Обед еще не скоро. Пока можно расслабиться.',
        emoji: ''
      };
    
    case 'afternoon':
      return {
        greeting: `Добрый день, ${name}!`,
        message: 'Сейчас нет активного голосования',
        emoji: ''
      };
    
    case 'evening':
      return {
        greeting: `Добрый вечер, ${name}!`,
        message: 'На сегодня голосование завершено',
        emoji: ''
      };
    
    case 'night':
      return {
        greeting: `Спокойной ночи, ${name}!`,
        message: 'Завтра будет новое голосование',
        emoji: ''
      };
  }
}
