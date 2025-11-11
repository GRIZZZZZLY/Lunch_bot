/**
 * Gamification Seed Data - Sprint 6
 *
 * Seeds achievements and quests into the database
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

// Achievement definitions
const achievements = [
  // ==================== GASTRO CATEGORY ====================
  {
    key: 'FIRST_VOTE',
    title: 'Первый голос',
    description: 'Проголосуйте в первом опросе',
    icon: '🗳️',
    category: 'GASTRO',
    rarity: 'COMMON',
    xpReward: 50,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsParticipated',
      value: 1,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'TASTE_EXPLORER',
    title: 'Исследователь вкусов',
    description: 'Попробуйте блюда из 5 разных категорий',
    icon: '🍽️',
    category: 'GASTRO',
    rarity: 'COMMON',
    xpReward: 100,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'categoriesTried',
      value: 5,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'POLL_WINNER',
    title: 'Победитель голосования',
    description: 'Выиграйте свой первый опрос',
    icon: '🏆',
    category: 'GASTRO',
    rarity: 'COMMON',
    xpReward: 75,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsWon',
      value: 1,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'TASTE_EXPERT',
    title: 'Эксперт по вкусу',
    description: 'Выиграйте 10 опросов',
    icon: '🎯',
    category: 'GASTRO',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsWon',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'VOTE_MASTER',
    title: 'Мастер голосования',
    description: 'Примите участие в 50 опросах',
    icon: '🎖️',
    category: 'GASTRO',
    rarity: 'EPIC',
    xpReward: 300,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsParticipated',
      value: 50,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'GASTRO_LEGEND',
    title: 'Легенда гастрономии',
    description: 'Выиграйте 50 опросов',
    icon: '👑',
    category: 'GASTRO',
    rarity: 'LEGENDARY',
    xpReward: 500,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'pollsWon',
      value: 50,
    }),
    isHidden: false,
    isActive: true,
  },

  // ==================== RESPONSIBLE CATEGORY ====================
  {
    key: 'FIRST_RESPONSIBLE',
    title: 'Первый ответственный',
    description: 'Станьте ответственным впервые',
    icon: '🎲',
    category: 'RESPONSIBLE',
    rarity: 'COMMON',
    xpReward: 75,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'timesResponsible',
      value: 1,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'VOLUNTEER_HERO',
    title: 'Добровольный герой',
    description: 'Станьте добровольцем 5 раз',
    icon: '🦸',
    category: 'RESPONSIBLE',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'timesVolunteer',
      value: 5,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'RELIABLE_ONE',
    title: 'Надежный',
    description: 'Будьте ответственным 10 раз',
    icon: '⭐',
    category: 'RESPONSIBLE',
    rarity: 'EPIC',
    xpReward: 300,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'timesResponsible',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'ORDER_CHAMPION',
    title: 'Чемпион заказов',
    description: 'Получите 50 заказов',
    icon: '📦',
    category: 'RESPONSIBLE',
    rarity: 'EPIC',
    xpReward: 350,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'ordersReceived',
      value: 50,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'RESPONSIBLE_LEGEND',
    title: 'Легенда ответственности',
    description: 'Будьте ответственным 50 раз',
    icon: '💎',
    category: 'RESPONSIBLE',
    rarity: 'LEGENDARY',
    xpReward: 500,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'timesResponsible',
      value: 50,
    }),
    isHidden: false,
    isActive: true,
  },

  // ==================== SOCIAL CATEGORY ====================
  {
    key: 'STREAK_STARTER',
    title: 'Начало серии',
    description: 'Достигните серии из 3 дней',
    icon: '🔥',
    category: 'SOCIAL',
    rarity: 'COMMON',
    xpReward: 50,
    requirement: JSON.stringify({
      type: 'streak',
      value: 3,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'WEEK_WARRIOR',
    title: 'Недельный воин',
    description: 'Достигните серии из 7 дней',
    icon: '📅',
    category: 'SOCIAL',
    rarity: 'RARE',
    xpReward: 150,
    requirement: JSON.stringify({
      type: 'streak',
      value: 7,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'PAYMENT_HERO',
    title: 'Герой платежей',
    description: 'Оплатите вовремя 10 раз',
    icon: '💳',
    category: 'SOCIAL',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'paymentsOnTime',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'CONSISTENCY_MASTER',
    title: 'Мастер постоянства',
    description: 'Достигните серии из 30 дней',
    icon: '🌟',
    category: 'SOCIAL',
    rarity: 'EPIC',
    xpReward: 400,
    requirement: JSON.stringify({
      type: 'streak',
      value: 30,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'SOCIAL_BUTTERFLY',
    title: 'Социальная бабочка',
    description: 'Пригласите 5 друзей',
    icon: '🦋',
    category: 'SOCIAL',
    rarity: 'EPIC',
    xpReward: 300,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'referralsCount',
      value: 5,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'ETERNAL_FLAME',
    title: 'Вечное пламя',
    description: 'Достигните серии из 100 дней',
    icon: '🔥',
    category: 'SOCIAL',
    rarity: 'LEGENDARY',
    xpReward: 1000,
    requirement: JSON.stringify({
      type: 'streak',
      value: 100,
    }),
    isHidden: false,
    isActive: true,
  },

  // ==================== EXPLORER CATEGORY ====================
  {
    key: 'FIRST_DISCOVERY',
    title: 'Первое открытие',
    description: 'Откройте новое блюдо',
    icon: '🔍',
    category: 'EXPLORER',
    rarity: 'COMMON',
    xpReward: 50,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'newDishesDiscovered',
      value: 1,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'DISH_HUNTER',
    title: 'Охотник за блюдами',
    description: 'Откройте 10 новых блюд',
    icon: '🎯',
    category: 'EXPLORER',
    rarity: 'RARE',
    xpReward: 150,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'newDishesDiscovered',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'CATEGORY_MASTER',
    title: 'Мастер категорий',
    description: 'Попробуйте блюда из 10 категорий',
    icon: '🗂️',
    category: 'EXPLORER',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'categoriesTried',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'MENU_CONTRIBUTOR',
    title: 'Контрибьютор меню',
    description: 'Добавьте 5 блюд в меню',
    icon: '📝',
    category: 'EXPLORER',
    rarity: 'EPIC',
    xpReward: 250,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'menuItemsAdded',
      value: 5,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'EXPLORER_LEGEND',
    title: 'Легенда исследователей',
    description: 'Откройте 50 новых блюд',
    icon: '🏅',
    category: 'EXPLORER',
    rarity: 'LEGENDARY',
    xpReward: 500,
    requirement: JSON.stringify({
      type: 'stat_gte',
      stat: 'newDishesDiscovered',
      value: 50,
    }),
    isHidden: false,
    isActive: true,
  },

  // ==================== LEVEL-BASED ACHIEVEMENTS ====================
  {
    key: 'LEVEL_5',
    title: 'Гурман',
    description: 'Достигните 5 уровня',
    icon: '⭐',
    category: 'GASTRO',
    rarity: 'COMMON',
    xpReward: 100,
    requirement: JSON.stringify({
      type: 'level',
      value: 5,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'LEVEL_10',
    title: 'Эксперт',
    description: 'Достигните 10 уровня',
    icon: '🌟',
    category: 'GASTRO',
    rarity: 'RARE',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'level',
      value: 10,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'LEVEL_15',
    title: 'Мастер',
    description: 'Достигните 15 уровня',
    icon: '💎',
    category: 'GASTRO',
    rarity: 'EPIC',
    xpReward: 300,
    requirement: JSON.stringify({
      type: 'level',
      value: 15,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'LEVEL_20',
    title: 'Легенда',
    description: 'Достигните 20 уровня',
    icon: '👑',
    category: 'GASTRO',
    rarity: 'LEGENDARY',
    xpReward: 500,
    requirement: JSON.stringify({
      type: 'level',
      value: 20,
    }),
    isHidden: false,
    isActive: true,
  },
  {
    key: 'LEVEL_25',
    title: 'Гранд-мастер',
    description: 'Достигните 25 уровня',
    icon: '🔱',
    category: 'GASTRO',
    rarity: 'LEGENDARY',
    xpReward: 1000,
    requirement: JSON.stringify({
      type: 'level',
      value: 25,
    }),
    isHidden: false,
    isActive: true,
  },
];

// Quest definitions
const quests = [
  // ==================== DAILY QUESTS ====================
  {
    key: 'DAILY_VOTE',
    title: 'Ежедневное голосование',
    description: 'Проголосуйте в опросе',
    type: 'DAILY',
    category: 'GASTRO',
    icon: '🗳️',
    xpReward: 20,
    requirement: JSON.stringify({
      type: 'vote_count',
      target: 1,
    }),
    duration: 1,
    rarity: 'COMMON',
  },
  {
    key: 'DAILY_WIN',
    title: 'Победа дня',
    description: 'Выиграйте опрос',
    type: 'DAILY',
    category: 'GASTRO',
    icon: '🏆',
    xpReward: 50,
    requirement: JSON.stringify({
      type: 'win_count',
      target: 1,
    }),
    duration: 1,
    rarity: 'RARE',
  },
  {
    key: 'DAILY_VOLUNTEER',
    title: 'Добровольный помощник',
    description: 'Станьте добровольцем',
    type: 'DAILY',
    category: 'RESPONSIBLE',
    icon: '🦸',
    xpReward: 100,
    requirement: JSON.stringify({
      type: 'responsible',
      target: 1,
      metadata: { volunteer: true },
    }),
    duration: 1,
    rarity: 'EPIC',
  },

  // ==================== WEEKLY QUESTS ====================
  {
    key: 'WEEK_VOTES',
    title: 'Недельный активист',
    description: 'Проголосуйте в 5 опросах за неделю',
    type: 'WEEKLY',
    category: 'GASTRO',
    icon: '📅',
    xpReward: 100,
    requirement: JSON.stringify({
      type: 'vote_count',
      target: 5,
    }),
    duration: 7,
    rarity: 'COMMON',
  },
  {
    key: 'WEEK_WINS',
    title: 'Недельный победитель',
    description: 'Выиграйте 3 опроса за неделю',
    type: 'WEEKLY',
    category: 'GASTRO',
    icon: '🏅',
    xpReward: 200,
    requirement: JSON.stringify({
      type: 'win_count',
      target: 3,
    }),
    duration: 7,
    rarity: 'RARE',
  },
  {
    key: 'WEEK_STREAK',
    title: 'Недельная серия',
    description: 'Голосуйте 7 дней подряд',
    type: 'WEEKLY',
    category: 'SOCIAL',
    icon: '🔥',
    xpReward: 150,
    requirement: JSON.stringify({
      type: 'streak',
      target: 7,
    }),
    duration: 7,
    rarity: 'RARE',
  },
  {
    key: 'WEEK_RESPONSIBLE',
    title: 'Недельный ответственный',
    description: 'Будьте ответственным 2 раза за неделю',
    type: 'WEEKLY',
    category: 'RESPONSIBLE',
    icon: '⭐',
    xpReward: 150,
    requirement: JSON.stringify({
      type: 'responsible',
      target: 2,
    }),
    duration: 7,
    rarity: 'EPIC',
  },
  {
    key: 'WEEK_PAYMENTS',
    title: 'Недельная пунктуальность',
    description: 'Оплатите все заказы вовремя за неделю',
    type: 'WEEKLY',
    category: 'SOCIAL',
    icon: '💳',
    xpReward: 120,
    requirement: JSON.stringify({
      type: 'payment',
      target: 3,
      metadata: { onTime: true },
    }),
    duration: 7,
    rarity: 'RARE',
  },
  {
    key: 'WEEK_EXPLORER',
    title: 'Недельный исследователь',
    description: 'Попробуйте блюда из 3 новых категорий',
    type: 'WEEKLY',
    category: 'EXPLORER',
    icon: '🔍',
    xpReward: 180,
    requirement: JSON.stringify({
      type: 'custom',
      target: 3,
      metadata: { type: 'new_categories' },
    }),
    duration: 7,
    rarity: 'EPIC',
  },
];

/**
 * Seed gamification data
 */
export async function seedGamification() {
  try {
    logger.info('Starting gamification seed...');

    // Seed achievements
    logger.info(`Seeding ${achievements.length} achievements...`);
    for (const achievement of achievements) {
      await prisma.achievement.upsert({
        where: { key: achievement.key },
        update: achievement,
        create: achievement,
      });
    }
    logger.info('✅ Achievements seeded successfully');

    // Seed quests
    logger.info(`Seeding ${quests.length} quests...`);
    for (const quest of quests) {
      await prisma.quest.upsert({
        where: { key: quest.key },
        update: quest,
        create: quest,
      });
    }
    logger.info('✅ Quests seeded successfully');

    logger.info('🎉 Gamification seed completed!');
    logger.info(`Total: ${achievements.length} achievements, ${quests.length} quests`);
  } catch (error) {
    logger.error('Error seeding gamification data:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedGamification()
    .then(() => {
      logger.info('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
