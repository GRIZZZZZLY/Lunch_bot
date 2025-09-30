import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { PollResult, CreatePollResultData } from '../types/database.types';
import { VoteService } from './vote.service';

export interface RouletteResult {
  responsibleUserId: number;
  responsibleUserName: string;
  winnerMenuItemId?: number;
  winnerMenuItemName?: string;
  totalVotes: number;
  animationData: {
    participants: string[];
    steps: { step: number; message: string; delay: number }[];
  };
}

export class RouletteService {
  /**
   * Запустить рулетку для выбора ответственного
   */
  async runRoulette(pollId: number): Promise<RouletteResult> {
    try {
      // Получаем всех голосовавших
      const voters = await VoteService.getVoters(pollId);
      
      if (voters.length === 0) {
        throw new Error('Никто не голосовал, рулетка невозможна');
      }

      // Получаем самое популярное блюдо
      const mostPopular = await VoteService.getMostPopularMenuItem(pollId);

      // Выбираем случайного ответственного из голосовавших
      const randomIndex = Math.floor(Math.random() * voters.length);
      const responsible = voters[randomIndex];

      // Создаем анимацию рулетки
      const animationData = this.generateRouletteAnimation(voters.map(v => v.userName));

      const result: RouletteResult = {
        responsibleUserId: responsible.userId,
        responsibleUserName: responsible.userName,
        winnerMenuItemId: mostPopular?.menuItemId,
        winnerMenuItemName: mostPopular ? 
          voters.find(v => v.userId === responsible.userId)?.menuItemName :
          undefined,
        totalVotes: voters.length,
        animationData,
      };

      logger.info('Рулетка завершена', {
        pollId,
        responsibleUserId: result.responsibleUserId,
        winnerMenuItemId: result.winnerMenuItemId,
        totalVotes: result.totalVotes,
      });

      return result;
    } catch (error) {
      logger.error('Ошибка запуска рулетки:', error);
      throw error;
    }
  }

  /**
   * Сохранить результат рулетки в базу данных
   */
  async saveResult(pollId: number, result: RouletteResult): Promise<PollResult> {
    try {
      const pollResult = await prisma.pollResult.create({
        data: {
          pollId,
          responsibleUserId: result.responsibleUserId,
          winnerMenuItemId: result.winnerMenuItemId,
          totalVotes: result.totalVotes,
          rouletteData: result.animationData,
        },
        include: {
          poll: true,
          responsibleUser: true,
          winnerMenuItem: true,
        },
      });

      logger.info('Результат рулетки сохранен', {
        id: pollResult.id,
        pollId: pollResult.pollId,
      });

      return pollResult;
    } catch (error) {
      logger.error('Ошибка сохранения результата рулетки:', error);
      throw error;
    }
  }

  /**
   * Получить результат рулетки по голосованию
   */
  async getResult(pollId: number): Promise<PollResult | null> {
    try {
      return await prisma.pollResult.findUnique({
        where: { pollId },
        include: {
          poll: true,
          responsibleUser: true,
          winnerMenuItem: true,
        },
      });
    } catch (error) {
      logger.error('Ошибка получения результата рулетки:', error);
      throw error;
    }
  }

  /**
   * Сгенерировать анимацию рулетки
   */
  private generateRouletteAnimation(participants: string[]): {
    participants: string[];
    steps: { step: number; message: string; delay: number }[];
  } {
    if (participants.length === 0) {
      return { participants: [], steps: [] };
    }

    const steps: { step: number; message: string; delay: number }[] = [];
    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    
    // Начальное сообщение
    steps.push({
      step: 0,
      message: '🎲 Запускаем рулетку...',
      delay: 1000,
    });

    steps.push({
      step: 1,
      message: `👥 Участвуют: ${participants.length} человек`,
      delay: 1500,
    });

    // Показываем несколько случайных имен для создания напряжения
    const animationSteps = Math.min(8, participants.length * 2);
    for (let i = 0; i < animationSteps; i++) {
      const randomParticipant = shuffledParticipants[i % shuffledParticipants.length];
      const speed = 500 + (i * 200); // Замедляемся
      
      steps.push({
        step: i + 2,
        message: `🎯 ${randomParticipant}...`,
        delay: speed,
      });
    }

    // Финальное объявление
    const winner = shuffledParticipants[shuffledParticipants.length - 1];
    steps.push({
      step: steps.length + 1,
      message: '🥁 И победитель...',
      delay: 2000,
    });

    steps.push({
      step: steps.length + 1,
      message: `🎉 ${winner}!`,
      delay: 1000,
    });

    return {
      participants: shuffledParticipants,
      steps,
    };
  }

  /**
   * Получить текстовое представление анимации рулетки
   */
  async getAnimationMessages(animationData: any): Promise<string[]> {
    if (!animationData || !animationData.steps) {
      return ['🎲 Рулетка завершена'];
    }

    return animationData.steps.map((step: any) => step.message);
  }

  /**
   * Проверить, можно ли запустить рулетку для голосования
   */
  async canRunRoulette(pollId: number): Promise<{ canRun: boolean; reason?: string }> {
    try {
      // Проверяем, есть ли уже результат
      const existingResult = await this.getResult(pollId);
      if (existingResult) {
        return { canRun: false, reason: 'Рулетка уже была проведена для этого голосования' };
      }

      // Проверяем, есть ли голоса
      const voters = await VoteService.getVoters(pollId);
      if (voters.length === 0) {
        return { canRun: false, reason: 'Никто не голосовал' };
      }

      return { canRun: true };
    } catch (error) {
      logger.error('Ошибка проверки возможности запуска рулетки:', error);
      return { canRun: false, reason: 'Ошибка проверки' };
    }
  }

  /**
   * Получить статистику рулеток
   */
  async getStats(groupId?: number) {
    try {
      const where = groupId ? { poll: { groupId } } : {};

      const [totalRoulettes, roulettesToday] = await Promise.all([
        prisma.pollResult.count({ where }),
        prisma.pollResult.count({
          where: {
            ...where,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Последние 24 часа
            },
          },
        }),
      ]);

      // Получаем топ ответственных
      const topResponsible = await prisma.pollResult.groupBy({
        by: ['responsibleUserId'],
        where,
        _count: {
          responsibleUserId: true,
        },
        orderBy: {
          _count: {
            responsibleUserId: 'desc',
          },
        },
        take: 5,
      });

      return {
        totalRoulettes,
        roulettesToday,
        topResponsible: topResponsible.map(item => ({
          userId: item.responsibleUserId,
          count: item._count.responsibleUserId,
        })),
      };
    } catch (error) {
      logger.error('Ошибка получения статистики рулеток:', error);
      throw error;
    }
  }
}

export const rouletteService = new RouletteService();
