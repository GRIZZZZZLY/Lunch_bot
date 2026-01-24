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
          message: 'Твой голос учтён. Скоро узнаем победителя! 🎯',
          emoji: '⏰'
        };
      }
      
      return {
        greeting: `Отлично, ${name}!`,
        message: 'Твой голос учтён. Можешь расслабиться ☕',
        emoji: '✅'
      };
    }

    // Пользователь НЕ проголосовал
    if (isPollEnding) {
      return {
        greeting: `${name}, спешите!`,
        message: 'Осталось меньше 5 минут. Не упусти шанс! 🏃',
        emoji: '⚡'
      };
    }

    // Время суток влияет на настроение
    switch (timeOfDay) {
      case 'morning':
        return {
          greeting: `Доброе утро, ${name}!`,
          message: 'Голосование открыто. Что выберешь сегодня? ☕',
          emoji: '🌅'
        };
      
      case 'afternoon':
        return {
          greeting: `Время обеда, ${name}!`,
          message: 'Голосование активно. Сделай свой выбор! 🍽️',
          emoji: '☀️'
        };
      
      case 'evening':
        return {
          greeting: `Добрый вечер, ${name}!`,
          message: 'Еще можно проголосовать. Не упусти момент! 🌆',
          emoji: '🌆'
        };
      
      case 'night':
        return {
          greeting: `${name}, ты не спишь?`,
          message: 'Голосование все еще открыто. Может проголосуешь? 🌙',
          emoji: '🌙'
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
          message: 'Результаты уже известны. Приятного аппетита! 🍽️',
          emoji: '🏆'
        };
      
      case 'evening':
        return {
          greeting: `Как прошел обед, ${name}?`,
          message: 'Надеюсь, было вкусно! До завтра 😊',
          emoji: '⭐'
        };
      
      case 'night':
        return {
          greeting: `Спокойной ночи, ${name}!`,
          message: 'Обед был сегодня. Увидимся завтра! 🌙',
          emoji: '😴'
        };
    }
  }

  // === НЕТ АКТИВНОГО ГОЛОСОВАНИЯ ===
  switch (timeOfDay) {
    case 'morning':
      return {
        greeting: `Доброе утро, ${name}!`,
        message: 'Обед еще не скоро. Пока можно расслабиться ☕',
        emoji: '🌅'
      };
    
    case 'afternoon':
      return {
        greeting: `${name}, где голосование?`,
        message: 'Похоже, админ еще не запустил опрос 🤔',
        emoji: '⏰'
      };
    
    case 'evening':
      return {
        greeting: `Добрый вечер, ${name}!`,
        message: 'Сегодня не было голосования. До завтра! 🌆',
        emoji: '🌆'
      };
    
    case 'night':
      return {
        greeting: `Спокойной ночи, ${name}!`,
        message: 'Отдыхай. Завтра новый день и новый обед 🌙',
        emoji: '😴'
      };
  }
}

/**
 * Сообщения для Empty State (когда нет активного голосования)
 */
export function getEmptyStateMessage(timeOfDay: TimeOfDay, hasCompletedPoll: boolean): {
  title: string;
  description: string;
  emoji: string;
} {
  // Если сегодня уже было голосование
  if (hasCompletedPoll) {
    return {
      title: 'Голосование завершено',
      description: 'Результаты уже известны. Увидимся завтра!',
      emoji: '✅'
    };
  }

  // Нет активного голосования
  switch (timeOfDay) {
    case 'morning':
      return {
        title: 'Обед еще не скоро',
        description: 'Голосование откроется ближе к обеду',
        emoji: '☕'
      };
    
    case 'afternoon':
      return {
        title: 'Где голосование?',
        description: 'Администратор скоро запустит опрос',
        emoji: '⏰'
      };
    
    case 'evening':
      return {
        title: 'Сегодня отдыхаем',
        description: 'Голосования не было. До завтра!',
        emoji: '🌆'
      };
    
    case 'night':
      return {
        title: 'Спокойной ночи!',
        description: 'Завтра будет новый обед',
        emoji: '🌙'
      };
  }
}

/**
 * Сообщение после успешного голосования
 */
export function getSuccessVoteMessage(isFirstVote: boolean): {
  title: string;
  message: string;
} {
  if (isFirstVote) {
    return {
      title: '🎉 Первый голос!',
      message: 'Отлично! Теперь ты часть команды. Так держать!'
    };
  }

  const messages = [
    { title: '✅ Голос учтён!', message: 'Отлично! Теперь можешь расслабиться ☕' },
    { title: '👍 Готово!', message: 'Твой выбор зафиксирован. Ждём результатов!' },
    { title: '🎯 Записали!', message: 'Голос принят. Скоро узнаем победителя!' },
    { title: '⭐ Супер!', message: 'Ты проголосовал! Посмотрим кто еще выберет это блюдо' },
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Сообщение при закрытии голосования
 */
export function getPollClosedMessage(hasVoted: boolean): string {
  if (hasVoted) {
    return '🏁 Голосование завершено! Скоро узнаем победителя';
  }
  
  return '⏰ Время истекло! В следующий раз не пропусти голосование';
}

/**
 * Мотивационное сообщение (когда пользователь долго не заходит)
 */
export function getMotivationalMessage(daysAway: number): string {
  if (daysAway === 1) {
    return 'Рады видеть снова! Вчера тебя не хватало 😊';
  }
  
  if (daysAway <= 3) {
    return `С возвращением! Ты пропустил ${daysAway} обеда. Не теряйся! 👋`;
  }
  
  return `Ого! Тебя не было ${daysAway} дней. Команда скучала! 🤗`;
}
