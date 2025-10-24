import { RouletteService, RouletteResult } from '../roulette.service';
import { prisma } from '../../database/client';
import { VoteService } from '../vote.service';
import { PollResult } from '@prisma/client';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    pollResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

// Mock VoteService
jest.mock('../vote.service', () => ({
  VoteService: {
    getVoters: jest.fn(),
    getMostPopularMenuItem: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RouletteService', () => {
  let rouletteService: RouletteService;

  beforeEach(() => {
    rouletteService = new RouletteService();
    jest.clearAllMocks();
    // Mock Math.random for deterministic tests
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runRoulette', () => {
    it('should run roulette successfully with voters', async () => {
      const mockVoters = [
        { userId: 1, userName: 'Alice', menuItemId: 1, menuItemName: 'Пицца' },
        { userId: 2, userName: 'Bob', menuItemId: 2, menuItemName: 'Бургер' },
        { userId: 3, userName: 'Charlie', menuItemId: 1, menuItemName: 'Пицца' },
      ];

      const mockMostPopular = { menuItemId: 1, votes: 2 };

      (VoteService.getVoters as jest.Mock).mockResolvedValue(mockVoters);
      (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue(mockMostPopular);

      const result = await rouletteService.runRoulette(1);

      expect(result).toHaveProperty('responsibleUserId');
      expect(result).toHaveProperty('responsibleUserName');
      expect(result.totalVotes).toBe(3);
      expect(result.winnerMenuItemId).toBe(1);
      expect(result.animationData).toHaveProperty('participants');
      expect(result.animationData).toHaveProperty('steps');
      expect(VoteService.getVoters).toHaveBeenCalledWith(1);
    });

    it('should throw error if no voters', async () => {
      (VoteService.getVoters as jest.Mock).mockResolvedValue([]);

      await expect(rouletteService.runRoulette(1)).rejects.toThrow('Никто не голосовал, рулетка невозможна');
    });

    it('should handle single voter', async () => {
      const mockVoters = [
        { userId: 1, userName: 'Alice', menuItemId: 1, menuItemName: 'Пицца' },
      ];

      const mockMostPopular = { menuItemId: 1, votes: 1 };

      (VoteService.getVoters as jest.Mock).mockResolvedValue(mockVoters);
      (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue(mockMostPopular);

      const result = await rouletteService.runRoulette(1);

      expect(result.responsibleUserId).toBe(1);
      expect(result.responsibleUserName).toBe('Alice');
      expect(result.totalVotes).toBe(1);
    });

    it('should handle case when no most popular item', async () => {
      const mockVoters = [
        { userId: 1, userName: 'Alice', menuItemId: null, menuItemName: null },
      ];

      (VoteService.getVoters as jest.Mock).mockResolvedValue(mockVoters);
      (VoteService.getMostPopularMenuItem as jest.Mock).mockResolvedValue(null);

      const result = await rouletteService.runRoulette(1);

      expect(result.winnerMenuItemId).toBeUndefined();
      expect(result.winnerMenuItemName).toBeUndefined();
    });
  });

  describe('saveResult', () => {
    it('should save roulette result successfully', async () => {
      const mockResult: RouletteResult = {
        responsibleUserId: 1,
        responsibleUserName: 'Alice',
        winnerMenuItemId: 1,
        winnerMenuItemName: 'Пицца',
        totalVotes: 3,
        animationData: {
          participants: ['Alice', 'Bob', 'Charlie'],
          steps: [],
        },
      };

      const mockSavedResult: any = {
        id: 1,
        pollId: 1,
        responsibleUserId: 1,
        winnerMenuItemId: 1,
        totalVotes: 3,
        rouletteData: JSON.stringify(mockResult.animationData),
        createdAt: new Date(),
        poll: { id: 1 },
        responsibleUser: { id: 1, firstName: 'Alice' },
        winnerMenuItem: { id: 1, name: 'Пицца' },
      };

      (prisma.pollResult.create as jest.Mock).mockResolvedValue(mockSavedResult);

      const result = await rouletteService.saveResult(1, mockResult);

      expect(prisma.pollResult.create).toHaveBeenCalledWith({
        data: {
          pollId: 1,
          responsibleUserId: 1,
          winnerMenuItemId: 1,
          totalVotes: 3,
          rouletteData: JSON.stringify(mockResult.animationData),
        },
        include: {
          poll: true,
          responsibleUser: true,
          winnerMenuItem: true,
        },
      });

      expect(result).toEqual(mockSavedResult);
    });

    it('should throw error if save fails', async () => {
      const mockResult: RouletteResult = {
        responsibleUserId: 1,
        responsibleUserName: 'Alice',
        totalVotes: 1,
        animationData: { participants: [], steps: [] },
      };

      (prisma.pollResult.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(rouletteService.saveResult(1, mockResult)).rejects.toThrow('Database error');
    });
  });

  describe('getResult', () => {
    it('should return poll result if exists', async () => {
      const mockPollResult: any = {
        id: 1,
        pollId: 1,
        responsibleUserId: 1,
        winnerMenuItemId: 1,
        totalVotes: 3,
        poll: { id: 1 },
        responsibleUser: { id: 1 },
        winnerMenuItem: { id: 1 },
      };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(mockPollResult);

      const result = await rouletteService.getResult(1);

      expect(prisma.pollResult.findUnique).toHaveBeenCalledWith({
        where: { pollId: 1 },
        include: {
          poll: true,
          responsibleUser: true,
          winnerMenuItem: true,
        },
      });

      expect(result).toEqual(mockPollResult);
    });

    it('should return null if result does not exist', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await rouletteService.getResult(1);

      expect(result).toBeNull();
    });

    it('should throw error if database fails', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(rouletteService.getResult(1)).rejects.toThrow('Database error');
    });
  });

  describe('generateRouletteAnimation', () => {
    it('should generate animation with participants', () => {
      const participants = ['Alice', 'Bob', 'Charlie'];

      // Access private method via instance
      const animation = (rouletteService as any).generateRouletteAnimation(participants);

      expect(animation).toHaveProperty('participants');
      expect(animation).toHaveProperty('steps');
      expect(animation.participants).toHaveLength(3);
      expect(animation.steps.length).toBeGreaterThan(0);
      expect(animation.steps[0].message).toContain('Запускаем рулетку');
    });

    it('should return empty animation for no participants', () => {
      const animation = (rouletteService as any).generateRouletteAnimation([]);

      expect(animation.participants).toEqual([]);
      expect(animation.steps).toEqual([]);
    });

    it('should create proper animation steps', () => {
      const participants = ['Alice', 'Bob'];

      const animation = (rouletteService as any).generateRouletteAnimation(participants);

      // Check initial messages
      expect(animation.steps[0].message).toContain('Запускаем рулетку');
      expect(animation.steps[1].message).toContain('2 человек');

      // Check final messages
      const lastSteps = animation.steps.slice(-2);
      expect(lastSteps[0].message).toContain('И победитель');
      expect(lastSteps[1].message).toContain('🎉');
    });
  });

  describe('getAnimationMessages', () => {
    it('should return animation messages', async () => {
      const animationData = {
        steps: [
          { step: 0, message: 'Step 1', delay: 1000 },
          { step: 1, message: 'Step 2', delay: 1500 },
        ],
      };

      const messages = await rouletteService.getAnimationMessages(animationData);

      expect(messages).toEqual(['Step 1', 'Step 2']);
    });

    it('should return default message for null animation data', async () => {
      const messages = await rouletteService.getAnimationMessages(null);

      expect(messages).toEqual(['🎲 Рулетка завершена']);
    });

    it('should return default message for empty steps', async () => {
      const messages = await rouletteService.getAnimationMessages({ steps: null });

      expect(messages).toEqual(['🎲 Рулетка завершена']);
    });
  });

  describe('canRunRoulette', () => {
    it('should return true if roulette can run', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);
      (VoteService.getVoters as jest.Mock).mockResolvedValue([
        { userId: 1, userName: 'Alice' },
      ]);

      const result = await rouletteService.canRunRoulette(1);

      expect(result.canRun).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false if result already exists', async () => {
      const mockExistingResult: any = { id: 1, pollId: 1 };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(mockExistingResult);

      const result = await rouletteService.canRunRoulette(1);

      expect(result.canRun).toBe(false);
      expect(result.reason).toContain('уже была проведена');
    });

    it('should return false if no voters', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);
      (VoteService.getVoters as jest.Mock).mockResolvedValue([]);

      const result = await rouletteService.canRunRoulette(1);

      expect(result.canRun).toBe(false);
      expect(result.reason).toContain('Никто не голосовал');
    });

    it('should handle errors gracefully', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await rouletteService.canRunRoulette(1);

      expect(result.canRun).toBe(false);
      expect(result.reason).toContain('Ошибка проверки');
    });
  });

  describe('getStats', () => {
    it('should return roulette statistics', async () => {
      const mockGroupBy = [
        { responsibleUserId: 1, _count: { responsibleUserId: 5 } },
        { responsibleUserId: 2, _count: { responsibleUserId: 3 } },
      ];

      (prisma.pollResult.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2); // today

      (prisma.pollResult.groupBy as jest.Mock).mockResolvedValue(mockGroupBy);

      const stats = await rouletteService.getStats();

      expect(stats.totalRoulettes).toBe(10);
      expect(stats.roulettesToday).toBe(2);
      expect(stats.topResponsible).toHaveLength(2);
      expect(stats.topResponsible[0]).toEqual({ userId: 1, count: 5 });
    });

    it('should filter statistics by groupId', async () => {
      const mockGroupBy = [
        { responsibleUserId: 1, _count: { responsibleUserId: 3 } },
      ];

      (prisma.pollResult.count as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1);

      (prisma.pollResult.groupBy as jest.Mock).mockResolvedValue(mockGroupBy);

      const stats = await rouletteService.getStats(123);

      expect(stats.totalRoulettes).toBe(5);
      expect(stats.roulettesToday).toBe(1);
      
      // Verify groupBy was called with groupId filter
      expect(prisma.pollResult.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { poll: { groupId: 123 } },
        })
      );
    });

    it('should throw error if database fails', async () => {
      (prisma.pollResult.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(rouletteService.getStats()).rejects.toThrow('Database error');
    });
  });
});
