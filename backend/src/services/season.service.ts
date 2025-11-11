import { Season } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';

/**
 * SeasonService - Управление сезонной системой геймификации
 * 
 * Функционал:
 * - Создание и ротация сезонов
 * - Получение текущего/прошлых сезонов
 * - Сезонная статистика и лидерборды
 * - Автоматический переход между сезонами
 * 
 * Sprint 6: Basic Season System
 */

export interface SeasonData {
  number: number;
  name: string;
  theme?: string;
  startDate: Date;
  endDate: Date;
  rewards?: {
    top3: { xp: number; badge?: string }[];
    top10: { xp: number; badge?: string };
    participant: { xp: number };
  };
}

export interface SeasonLeaderboard {
  userId: number;
  totalXP: number;
  position: number;
  user: {
    firstName: string;
    lastName?: string | null;
    username?: string | null;
  };
}

export class SeasonService {
  /**
   * Получить текущий активный сезон
   */
  static async getCurrentSeason(): Promise<Season | null> {
    try {
      const season = await prisma.season.findFirst({
        where: { isActive: true },
        orderBy: { number: 'desc' },
      });

      return season;
    } catch (error) {
      logger.error('Error getting current season:', error);
      return null;
    }
  }

  /**
   * Получить все сезоны
   */
  static async getAllSeasons(limit?: number): Promise<Season[]> {
    try {
      return await prisma.season.findMany({
        orderBy: { number: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error getting all seasons:', error);
      return [];
    }
  }

  /**
   * Получить сезон по ID
   */
  static async getSeasonById(id: number): Promise<Season | null> {
    try {
      return await prisma.season.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Error getting season by ID:', error);
      return null;
    }
  }

  /**
   * Создать новый месячный сезон
   */
  static async createMonthlySeason(): Promise<Season> {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      // Деактивируем текущий сезон если есть
      if (currentSeason) {
        await prisma.season.update({
          where: { id: currentSeason.id },
          data: { isActive: false },
        });
        logger.info(`Deactivated season ${currentSeason.number}`);
      }

      // Определяем номер нового сезона
      const lastSeason = await prisma.season.findFirst({
        orderBy: { number: 'desc' },
      });
      const newNumber = (lastSeason?.number || 0) + 1;

      // Определяем даты (1 месяц)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      // Определяем название (месяц + год)
      const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
      ];
      const name = `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;

      // Создаем новый сезон
      const newSeason = await prisma.season.create({
        data: {
          number: newNumber,
          name,
          startDate,
          endDate,
          isActive: true,
          rewards: JSON.stringify({
            top3: [
              { xp: 500, badge: '🥇 Чемпион сезона' },
              { xp: 300, badge: '🥈 Серебряный призёр' },
              { xp: 200, badge: '🥉 Бронзовый призёр' },
            ],
            top10: { xp: 100, badge: '🏆 Топ-10 сезона' },
            participant: { xp: 50 },
          }),
          metadata: JSON.stringify({
            totalParticipants: 0,
            totalXPAwarded: 0,
            topPlayer: null,
          }),
        },
      });

      logger.info(`Created new season: ${newSeason.number} - ${newSeason.name}`);
      return newSeason;
    } catch (error) {
      logger.error('Error creating monthly season:', error);
      throw new Error('Failed to create monthly season');
    }
  }

  /**
   * Ротация сезона (завершить текущий и создать новый)
   */
  static async rotateSeason(): Promise<Season> {
    try {
      const currentSeason = await this.getCurrentSeason();

      if (!currentSeason) {
        logger.info('No active season, creating first season');
        return await this.createMonthlySeason();
      }

      // Проверяем, не рано ли завершать сезон
      const now = new Date();
      if (currentSeason.endDate > now) {
        logger.warn(`Season ${currentSeason.number} has not ended yet`);
        throw new Error('Season has not ended yet');
      }

      // Деактивируем текущий сезон
      await prisma.season.update({
        where: { id: currentSeason.id },
        data: { isActive: false },
      });

      logger.info(`Season ${currentSeason.number} ended`);

      // Вручаем награды за завершенный сезон
      await this.awardSeasonRewards(currentSeason.id);

      // Создаем новый сезон
      return await this.createMonthlySeason();
    } catch (error) {
      logger.error('Error rotating season:', error);
      throw new Error('Failed to rotate season');
    }
  }

  /**
   * Вручить награды за завершенный сезон
   */
  static async awardSeasonRewards(seasonId: number): Promise<void> {
    try {
      const season = await this.getSeasonById(seasonId);
      if (!season) {
        logger.error('Season not found for rewards', { seasonId });
        return;
      }

      const leaderboard = await this.getSeasonLeaderboard(seasonId, 10);
      
      if (leaderboard.length === 0) {
        logger.info('No participants in season, skipping rewards');
        return;
      }

      const rewards = season.rewards ? JSON.parse(season.rewards) : null;
      if (!rewards) {
        logger.warn('No rewards configured for season', { seasonId });
        return;
      }

      // Вручаем награды топ-3
      for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
        const player = leaderboard[i];
        const reward = rewards.top3[i];
        
        if (reward) {
          // Награждаем XP
          const { GamificationService } = await import('./gamification.service.js');
          await GamificationService.awardXP(
            player.userId,
            reward.xp,
            `Награда за ${i + 1} место в сезоне "${season.name}"`,
            'SOCIAL',
            { seasonId, position: i + 1, badge: reward.badge }
          );
          
          logger.info(`Awarded ${reward.xp} XP to user ${player.userId} for position ${i + 1}`);
        }
      }

      // Вручаем награды топ-4 до топ-10
      for (let i = 3; i < Math.min(10, leaderboard.length); i++) {
        const player = leaderboard[i];
        const reward = rewards.top10;
        
        await (await import('./gamification.service.js')).GamificationService.awardXP(
          player.userId,
          reward.xp,
          `Награда за топ-10 в сезоне "${season.name}"`,
          'SOCIAL',
          { seasonId, position: i + 1, badge: reward.badge }
        );
        
        logger.info(`Awarded ${reward.xp} XP to user ${player.userId} for top-10`);
      }

      // Вручаем награды всем участникам (10+)
      for (let i = 10; i < leaderboard.length; i++) {
        const player = leaderboard[i];
        const reward = rewards.participant;
        
        await (await import('./gamification.service.js')).GamificationService.awardXP(
          player.userId,
          reward.xp,
          `Награда за участие в сезоне "${season.name}"`,
          'SOCIAL',
          { seasonId }
        );
      }

      logger.info(`Season ${season.number} rewards distributed to ${leaderboard.length} players`);
    } catch (error) {
      logger.error('Error awarding season rewards:', error);
    }
  }

  /**
   * Получить лидерборд сезона
   */
  static async getSeasonLeaderboard(seasonId: number, limit: number = 10): Promise<SeasonLeaderboard[]> {
    try {
      // Агрегируем XP по пользователям за конкретный сезон
      const xpByUser = await prisma.xPHistory.groupBy({
        by: ['userId'],
        where: {
          seasonId,
        },
        _sum: {
          amount: true,
        },
        orderBy: {
          _sum: {
            amount: 'desc',
          },
        },
        take: limit,
      });

      // Получаем информацию о пользователях
      const userIds = xpByUser.map(x => x.userId);
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      // Формируем результат
      return xpByUser.map((x, index) => {
        const user = userMap.get(x.userId)!;
        return {
          userId: x.userId,
          totalXP: x._sum.amount || 0,
          position: index + 1,
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
        };
      });
    } catch (error) {
      logger.error('Error getting season leaderboard:', error);
      return [];
    }
  }

  /**
   * Получить статистику пользователя за сезон
   */
  static async getUserSeasonStats(userId: number, seasonId?: number): Promise<{
    seasonId: number;
    seasonName: string;
    totalXP: number;
    position: number | null;
    categoriesBreakdown: {
      GASTRO: number;
      RESPONSIBLE: number;
      SOCIAL: number;
      EXPLORER: number;
    };
  } | null> {
    try {
      // Если seasonId не указан, берем текущий
      const season = seasonId 
        ? await this.getSeasonById(seasonId)
        : await this.getCurrentSeason();

      if (!season) {
        return null;
      }

      // Получаем XP истории пользователя за сезон
      const xpHistory = await prisma.xPHistory.findMany({
        where: {
          userId,
          seasonId: season.id,
        },
        select: {
          amount: true,
          category: true,
        },
      });

      const totalXP = xpHistory.reduce((sum, x) => sum + x.amount, 0);

      // Разбиваем по категориям
      const breakdown = {
        GASTRO: 0,
        RESPONSIBLE: 0,
        SOCIAL: 0,
        EXPLORER: 0,
      };

      xpHistory.forEach(x => {
        const category = x.category as keyof typeof breakdown;
        if (category in breakdown) {
          breakdown[category] += x.amount;
        }
      });

      // Определяем позицию пользователя в лидерборде
      const leaderboard = await this.getSeasonLeaderboard(season.id, 100);
      const userPosition = leaderboard.find(l => l.userId === userId);

      return {
        seasonId: season.id,
        seasonName: season.name,
        totalXP,
        position: userPosition?.position || null,
        categoriesBreakdown: breakdown,
      };
    } catch (error) {
      logger.error('Error getting user season stats:', error);
      return null;
    }
  }

  /**
   * Проверить и автоматически ротировать сезоны (вызывается по расписанию)
   */
  static async checkAndRotateSeason(): Promise<void> {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      if (!currentSeason) {
        logger.info('No active season, creating first season');
        await this.createMonthlySeason();
        return;
      }

      const now = new Date();
      
      // Проверяем, не завершился ли сезон
      if (currentSeason.endDate <= now) {
        logger.info(`Season ${currentSeason.number} has ended, rotating...`);
        await this.rotateSeason();
      } else {
        const daysRemaining = Math.ceil((currentSeason.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        logger.info(`Current season ${currentSeason.number} has ${daysRemaining} days remaining`);
      }
    } catch (error) {
      logger.error('Error checking and rotating season:', error);
    }
  }
}
