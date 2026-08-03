import { Request, Response } from 'express';
import { GroupService } from '../../services/group.service';
import { SeasonService } from '../../services/season.service';
import { logger } from '../../utils/logger';
import { getParam } from '../../utils/request-params';

/**
 * Season Controller - API endpoints для сезонной системы
 * Sprint 6: Season System
 */

export class SeasonController {
  /**
   * GET /api/seasons
   * Получить все сезоны
   */
  static async getAllSeasons(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const seasons = await SeasonService.getAllSeasons(limit);

      res.json({
        success: true,
        data: seasons,
      });
    } catch (error) {
      logger.error('Error getting all seasons:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get seasons',
      });
    }
  }

  /**
   * GET /api/seasons/current
   * Получить текущий активный сезон
   */
  static async getCurrentSeason(req: Request, res: Response): Promise<void> {
    try {
      const season = await SeasonService.getCurrentSeason();

      if (!season) {
        res.status(404).json({
          success: false,
          error: 'No active season found',
        });
        return;
      }

      res.json({
        success: true,
        data: season,
      });
    } catch (error) {
      logger.error('Error getting current season:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current season',
      });
    }
  }

  /**
   * GET /api/seasons/:id
   * Получить сезон по ID
   */
  static async getSeasonById(req: Request, res: Response): Promise<void> {
    try {
      const seasonId = parseInt(getParam(req.params, 'id'), 10);

      if (isNaN(seasonId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid season ID',
        });
        return;
      }

      const season = await SeasonService.getSeasonById(seasonId);

      if (!season) {
        res.status(404).json({
          success: false,
          error: 'Season not found',
        });
        return;
      }

      res.json({
        success: true,
        data: season,
      });
    } catch (error) {
      logger.error('Error getting season by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get season',
      });
    }
  }

  /**
   * GET /api/seasons/:id/leaderboard
   * Получить лидерборд сезона
   */
  static async getSeasonLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const seasonId = parseInt(getParam(req.params, 'id'), 10);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const groupId = req.query.groupId
        ? parseInt(req.query.groupId as string, 10)
        : NaN;
      const user = (req as any).user;

      if (isNaN(seasonId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid season ID',
        });
        return;
      }

      if (!Number.isInteger(groupId) || groupId <= 0) {
        res.status(400).json({
          success: false,
          error: 'groupId is required',
        });
        return;
      }

      // Рейтинг сезона по группе виден её участникам.
      if (!(await GroupService.isUserGroupMember(user.id, groupId))) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const leaderboard = await SeasonService.getSeasonLeaderboard(
        seasonId,
        limit,
        groupId
      );

      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      logger.error('Error getting season leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get season leaderboard',
      });
    }
  }

  /**
   * GET /api/seasons/:id/stats/:userId
   * Получить статистику пользователя за сезон
   */
  static async getUserSeasonStats(req: Request, res: Response): Promise<void> {
    try {
      const seasonId = parseInt(getParam(req.params, 'id'), 10);
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const requestingUser = (req as any).user;

      if (isNaN(seasonId) || isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid season ID or user ID',
        });
        return;
      }

      if (requestingUser.id !== userId && !requestingUser.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const stats = await SeasonService.getUserSeasonStats(userId, seasonId);

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Season stats not found',
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting user season stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user season stats',
      });
    }
  }

  /**
   * POST /api/seasons/rotate
   * Ротировать сезон (завершить текущий и создать новый)
   * Admin only
   */
  static async rotateSeason(req: Request, res: Response): Promise<void> {
    try {
      // Проверяем права администратора
      const user = (req as any).user;
      if (!user || !user.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const newSeason = await SeasonService.rotateSeason();

      res.json({
        success: true,
        message: 'Season rotated successfully',
        data: newSeason,
      });
    } catch (error) {
      logger.error('Error rotating season:', error);
      
      if (error instanceof Error && error.message === 'Season has not ended yet') {
        res.status(400).json({
          success: false,
          error: 'Current season has not ended yet',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to rotate season',
      });
    }
  }

  /**
   * POST /api/seasons/create
   * Создать новый месячный сезон
   * Admin only
   */
  static async createMonthlySeason(req: Request, res: Response): Promise<void> {
    try {
      // Проверяем права администратора
      const user = (req as any).user;
      if (!user || !user.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const newSeason = await SeasonService.createMonthlySeason();

      res.json({
        success: true,
        message: 'Season created successfully',
        data: newSeason,
      });
    } catch (error) {
      logger.error('Error creating season:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create season',
      });
    }
  }

  /**
   * GET /api/seasons/current/stats/:userId
   * Получить статистику пользователя за текущий сезон
   */
  static async getCurrentSeasonUserStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(getParam(req.params, 'userId'), 10);
      const requestingUser = (req as any).user;

      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
        });
        return;
      }

      if (requestingUser.id !== userId && !requestingUser.isAdmin) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      const stats = await SeasonService.getUserSeasonStats(userId); // без seasonId = текущий

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'No active season or no stats found',
        });
        return;
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting current season user stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current season stats',
      });
    }
  }
}
