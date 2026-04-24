/**
 * XP Constants - Gamification System
 * 
 * Константы для начисления XP за различные действия
 * Организованы по категориям для удобства настройки
 */

export const XP_AMOUNTS = {
  // Социальная активность
  SOCIAL: {
    VOTE: 10,           // Голосование в опросе
    CREATE_POLL: 15,    // Создание опроса
    DAILY_STREAK_7: 50, // Серия 7 дней
    DAILY_STREAK_30: 100, // Серия 30 дней
    REFERRAL: 100,      // Привлечение нового пользователя
  },

  // Гастрономическая активность
  GASTRO: {
    WIN_VOTE: 20,       // Победа в голосовании
    TRY_NEW_DISH: 15,   // Попробовать новое блюдо
    CATEGORY_DISCOVERY: 25, // Открыть новую категорию
    MENU_SUGGESTION: 30, // Предложить блюдо в меню
  },

  // Ответственность
  RESPONSIBLE: {
    SELECTED_ROULETTE: 25,   // Выбран рулеткой
    VOLUNTEER: 35,           // Стал волонтёром
    PAYMENT_ON_TIME: 20,     // Оплата вовремя
    ORGANIZE_DELIVERY: 40,   // Организовал доставку
  },

  // Исследование
  EXPLORER: {
    NEW_CATEGORY: 20,    // Попробовать новую категорию
    RANDOM_CHOICE: 10,   // Случайный выбор
    REVIEW_DISH: 15,     // Оставить отзыв на блюдо
    COMPLETE_MENU: 50,   // Попробовать все блюда из меню
  },
} as const;

// Маппинг действий на XP константы
export const XP_REWARDS = {
  VOTE: { amount: XP_AMOUNTS.SOCIAL.VOTE, category: 'SOCIAL' as const, reason: 'Проголосовал в опросе' },
  CREATE_POLL: { amount: XP_AMOUNTS.SOCIAL.CREATE_POLL, category: 'SOCIAL' as const, reason: 'Создал опрос' },
  WIN_VOTE: { amount: XP_AMOUNTS.GASTRO.WIN_VOTE, category: 'GASTRO' as const, reason: 'Предложение победило' },
  SELECTED_RESPONSIBLE: { amount: XP_AMOUNTS.RESPONSIBLE.SELECTED_ROULETTE, category: 'RESPONSIBLE' as const, reason: 'Выбран ответственным' },
  VOLUNTEER_RESPONSIBLE: { amount: XP_AMOUNTS.RESPONSIBLE.VOLUNTEER, category: 'RESPONSIBLE' as const, reason: 'Стал волонтёром' },
  ROULETTE_RESPONSIBLE: { amount: XP_AMOUNTS.RESPONSIBLE.SELECTED_ROULETTE, category: 'RESPONSIBLE' as const, reason: 'Выбран рулеткой' },
  TRY_NEW_DISH: { amount: XP_AMOUNTS.GASTRO.TRY_NEW_DISH, category: 'GASTRO' as const, reason: 'Попробовал новое блюдо' },
  NEW_CATEGORY: { amount: XP_AMOUNTS.EXPLORER.NEW_CATEGORY, category: 'EXPLORER' as const, reason: 'Открыл новую категорию' },
} as const;

// Бонусные множители для особых событий
export const XP_MULTIPLIERS = {
  FIRST_VOTE_OF_DAY: 1.5,     // Первый голос за день
  WEEKEND_ACTIVITY: 1.2,      // Активность в выходные
  HOLIDAY_BONUS: 2.0,         // Праздничный бонус
  UNANIMOUS_VOTE: 1.3,        // Единогласное голосование
  CLOSE_POLL_DEADLINE: 1.4,   // Голосование в последний момент
} as const;

// Типы для TypeScript
export type XPActionKey = keyof typeof XP_REWARDS;
export type XPCategory = 'SOCIAL' | 'GASTRO' | 'RESPONSIBLE' | 'EXPLORER';

/**
 * Получить награду за действие
 */
export function getXPReward(action: XPActionKey) {
  return XP_REWARDS[action];
}

/**
 * Рассчитать XP с множителем
 */
export function calculateXPWithMultiplier(baseAmount: number, multiplier: keyof typeof XP_MULTIPLIERS): number {
  return Math.floor(baseAmount * XP_MULTIPLIERS[multiplier]);
}

/**
 * Проверить доступен ли множитель
 */
export function isMultiplierAvailable(multiplier: keyof typeof XP_MULTIPLIERS, context?: any): boolean {
  switch (multiplier) {
    case 'FIRST_VOTE_OF_DAY':
      return context?.isFirstVoteOfDay || false;
    case 'WEEKEND_ACTIVITY':
      return [0, 6].includes(new Date().getDay()); // Сб, Вс
    case 'HOLIDAY_BONUS':
      return context?.isHoliday || false;
    case 'UNANIMOUS_VOTE':
      return context?.isUnanimous || false;
    case 'CLOSE_POLL_DEADLINE':
      return context?.isCloseToDeadline || false;
    default:
      return false;
  }
}
