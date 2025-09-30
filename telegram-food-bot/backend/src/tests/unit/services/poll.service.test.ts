import { PollService } from '../../../services/poll.service';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Мокаем Prisma клиент с jest-mock-extended
jest.mock('../../../database/client', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Мокаем логгер
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '../../../database/client';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('PollService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPoll', () => {
    it('should create a poll successfully', async () => {
      const pollData = {
        groupId: 1,
        title: 'Test Poll',
        description: 'Test Description',
      };

      const expectedPoll = {
        id: 1,
        groupId: 1,
        title: 'Test Poll',
        description: 'Test Description',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.poll.create.mockResolvedValue(expectedPoll as any);

      const result = await PollService.createPoll(pollData);

      expect(mockPrisma.poll.create).toHaveBeenCalledWith({
        data: {
          groupId: pollData.groupId,
          title: pollData.title,
          description: pollData.description,
          endTime: undefined,
          messageId: undefined,
          isActive: true,
        },
      });

      expect(result).toEqual(expectedPoll);
      expect(logger.info).toHaveBeenCalledWith(
        `Poll created: ${expectedPoll.id} in group ${expectedPoll.groupId}`
      );
    });

    it('should use default title when not provided', async () => {
      const pollData = {
        groupId: 1,
      };

      const expectedPoll = {
        id: 1,
        groupId: 1,
        title: 'Выбор еды',
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.poll.create.mockResolvedValue(expectedPoll as any);

      const result = await PollService.createPoll(pollData);

      expect(mockPrisma.poll.create).toHaveBeenCalledWith({
        data: {
          groupId: pollData.groupId,
          title: 'Выбор еды',
          description: undefined,
          endTime: undefined,
          messageId: undefined,
          isActive: true,
        },
      });

      expect(result.title).toBe('Выбор еды');
    });

    it('should handle database error', async () => {
      const pollData = { groupId: 1 };
      const dbError = new Error('Database connection failed');

      mockPrisma.poll.create.mockRejectedValue(dbError);

      await expect(PollService.createPoll(pollData)).rejects.toThrow('Failed to create poll');
      expect(logger.error).toHaveBeenCalledWith('Error creating poll:', dbError);
    });
  });

  describe('getPollById', () => {
    it('should return poll with details when found', async () => {
      const pollId = 1;
      const expectedPoll = {
        id: 1,
        title: 'Test Poll',
        isActive: true,
        group: { id: 1, title: 'Test Group' },
        votes: [],
        results: [],
        _count: { votes: 0 },
      };

      mockPrisma.poll.findUnique.mockResolvedValue(expectedPoll as any);

      const result = await PollService.getPollById(pollId);

      expect(mockPrisma.poll.findUnique).toHaveBeenCalledWith({
        where: { id: pollId },
        include: {
          group: true,
          votes: {
            include: {
              user: true,
              menuItem: true,
            },
          },
          results: {
            include: {
              winnerItem: true,
              responsible: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });

      expect(result).toEqual(expectedPoll);
    });

    it('should return null when poll not found', async () => {
      const pollId = 999;
      mockPrisma.poll.findUnique.mockResolvedValue(null);

      const result = await PollService.getPollById(pollId);
      expect(result).toBeNull();
    });
  });

  describe('getActivePollInGroup', () => {
    it('should return active poll in group', async () => {
      const groupId = 1;
      const activePoll = {
        id: 1,
        groupId: 1,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.poll.findFirst.mockResolvedValue(activePoll as any);

      const result = await PollService.getActivePollInGroup(groupId);

      expect(mockPrisma.poll.findFirst).toHaveBeenCalledWith({
        where: {
          groupId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toEqual(activePoll);
    });

    it('should return null when no active poll in group', async () => {
      const groupId = 1;
      mockPrisma.poll.findFirst.mockResolvedValue(null);

      const result = await PollService.getActivePollInGroup(groupId);
      expect(result).toBeNull();
    });
  });

  describe('completePoll', () => {
    it('should complete poll successfully', async () => {
      const pollId = 1;
      const mockPoll = {
        id: 1,
        isActive: true,
        votes: [
          { menuItemId: 1, menuItem: { name: 'Pizza' }, user: { id: 1 } },
          { menuItemId: 1, menuItem: { name: 'Pizza' }, user: { id: 2 } },
          { menuItemId: 2, menuItem: { name: 'Burger' }, user: { id: 3 } },
        ],
      };

      const mockResult = {
        id: 1,
        pollId,
        winnerItemId: 1,
        totalVotes: 3,
        isRouletteRun: false,
      };

      mockPrisma.poll.findUnique.mockResolvedValue(mockPoll as any);
      mockPrisma.$transaction.mockImplementation((callback: any) => 
        callback({
          poll: {
            update: jest.fn().mockResolvedValue({}),
          },
          pollResult: {
            create: jest.fn().mockResolvedValue(mockResult),
          },
        })
      );

      // Мокаем getPollResult
      jest.spyOn(PollService, 'getPollResult').mockResolvedValue(mockResult as any);

      const result = await PollService.completePoll(pollId);

      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        `Poll completed: ${pollId}, winner: 1, total votes: 3`
      );
    });

    it('should throw error when poll not found', async () => {
      const pollId = 999;
      mockPrisma.poll.findUnique.mockResolvedValue(null);

      await expect(PollService.completePoll(pollId)).rejects.toThrow('Poll not found');
    });

    it('should throw error when poll is already completed', async () => {
      const pollId = 1;
      const inactivePoll = {
        id: 1,
        isActive: false,
        votes: [],
      };

      mockPrisma.poll.findUnique.mockResolvedValue(inactivePoll as any);

      await expect(PollService.completePoll(pollId)).rejects.toThrow('Poll is already completed');
    });
  });

  describe('runRoulette', () => {
    it('should run roulette successfully', async () => {
      const pollId = 1;
      const mockPoll = {
        id: 1,
        votes: [
          { userId: 1, user: { id: 1, firstName: 'User1' } },
          { userId: 2, user: { id: 2, firstName: 'User2' } },
        ],
      };

      const mockResult = {
        id: 1,
        pollId,
        responsibleId: 1,
        isRouletteRun: true,
        poll: { group: {} },
        responsible: { id: 1, firstName: 'User1' },
        winnerItem: null,
      };

      mockPrisma.poll.findUnique.mockResolvedValue(mockPoll as any);
      mockPrisma.pollResult.update.mockResolvedValue(mockResult as any);

      const result = await PollService.runRoulette(pollId);

      expect(mockPrisma.pollResult.update).toHaveBeenCalledWith({
        where: { pollId },
        data: {
          responsibleId: expect.any(Number),
          isRouletteRun: true,
        },
        include: {
          poll: {
            include: {
              group: true,
            },
          },
          winnerItem: true,
          responsible: true,
        },
      });

      expect(result).toEqual(mockResult);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Roulette completed for poll ${pollId}`)
      );
    });

    it('should throw error when no voters found', async () => {
      const pollId = 1;
      const mockPoll = {
        id: 1,
        votes: [],
      };

      mockPrisma.poll.findUnique.mockResolvedValue(mockPoll as any);

      await expect(PollService.runRoulette(pollId)).rejects.toThrow('No voters found');
    });
  });

  describe('getPollStats', () => {
    it('should return poll statistics', async () => {
      const mockPolls = [
        { _count: { votes: 5 } },
        { _count: { votes: 3 } },
        { _count: { votes: 7 } },
      ];

      mockPrisma.poll.count
        .mockResolvedValueOnce(10)  // totalPolls
        .mockResolvedValueOnce(2)   // activePolls
        .mockResolvedValueOnce(8);  // completedPolls

      mockPrisma.vote.count.mockResolvedValue(25); // totalVotes

      mockPrisma.poll.findMany.mockResolvedValue(mockPolls as any);

      const result = await PollService.getPollStats();

      expect(result).toEqual({
        totalPolls: 10,
        activePolls: 2,
        completedPolls: 8,
        totalVotes: 25,
        averageParticipants: 1.88, // (5+3+7)/8 = 1.875 rounded to 1.88
      });
    });

    it('should handle zero completed polls', async () => {
      mockPrisma.poll.count
        .mockResolvedValueOnce(2)   // totalPolls
        .mockResolvedValueOnce(2)   // activePolls
        .mockResolvedValueOnce(0);  // completedPolls

      mockPrisma.vote.count.mockResolvedValue(0);
      mockPrisma.poll.findMany.mockResolvedValue([]);

      const result = await PollService.getPollStats();

      expect(result.averageParticipants).toBe(0);
    });
  });

  describe('getPollVoteBreakdown', () => {
    it('should return vote breakdown', async () => {
      const pollId = 1;
      const mockPoll = {
        id: 1,
        votes: [
          {
            menuItemId: 1,
            menuItem: { name: 'Pizza' },
            user: { id: 1, firstName: 'User1', username: 'user1' },
          },
          {
            menuItemId: 1,
            menuItem: { name: 'Pizza' },
            user: { id: 2, firstName: 'User2', username: 'user2' },
          },
          {
            menuItemId: 2,
            menuItem: { name: 'Burger' },
            user: { id: 3, firstName: 'User3', username: null },
          },
        ],
      };

      mockPrisma.poll.findUnique.mockResolvedValue(mockPoll as any);

      const result = await PollService.getPollVoteBreakdown(pollId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        menuItemId: 1,
        menuItemName: 'Pizza',
        votes: 2,
        percentage: 67, // 2/3 * 100 rounded
        voters: [
          { id: 1, firstName: 'User1', username: 'user1' },
          { id: 2, firstName: 'User2', username: 'user2' },
        ],
      });
      expect(result[1]).toEqual({
        menuItemId: 2,
        menuItemName: 'Burger',
        votes: 1,
        percentage: 33, // 1/3 * 100 rounded
        voters: [
          { id: 3, firstName: 'User3', username: null },
        ],
      });
    });

    it('should return empty array when poll has no votes', async () => {
      const pollId = 1;
      const mockPoll = { id: 1, votes: [] };

      mockPrisma.poll.findUnique.mockResolvedValue(mockPoll as any);

      const result = await PollService.getPollVoteBreakdown(pollId);

      expect(result).toEqual([]);
    });

    it('should throw error when poll not found', async () => {
      const pollId = 999;
      mockPrisma.poll.findUnique.mockResolvedValue(null);

      await expect(PollService.getPollVoteBreakdown(pollId)).rejects.toThrow('Poll not found');
    });
  });
});
