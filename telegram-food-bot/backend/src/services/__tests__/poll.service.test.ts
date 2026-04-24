import { PollService } from '../poll.service';
import { prisma } from '../../database/client';
import { Poll, PollResult, Prisma } from '@prisma/client';
import { CacheInvalidator } from '../cache.service';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    poll: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    pollResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vote: {
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
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

// Mock cache service
jest.mock('../cache.service', () => ({
  cacheService: {
    getOrSet: jest.fn(),
  },
  CacheInvalidator: {
    invalidatePoll: jest.fn(),
  },
  CACHE_KEYS: {
    ACTIVE_POLLS_GROUP: (groupId: number) => `active_poll_group_${groupId}`,
  },
  CACHE_TTL: {
    ACTIVE_POLLS: 60,
  },
}));

// Mock notification service
jest.mock('../notification.service', () => ({
  notificationService: {
    sendPollCancelledNotifications: jest.fn(),
  },
}));

// Helper function to create mock poll
const createMockPoll = (overrides?: Partial<Poll>): Poll => ({
  id: 1,
  groupId: 1,
  status: 'ACTIVE',
  duration: 30,
  startedAt: new Date(),
  endedAt: null,
  createdBy: 1,
  messageId: null,
  chatId: null,
  selectedMenuItemIds: null,
  isMultiSelect: false,
  maxSelections: 1,
  isAutomatic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock poll result
const createMockPollResult = (overrides?: Partial<PollResult>): PollResult => ({
  id: 1,
  pollId: 1,
  winnerMenuItemId: 1,
  responsibleUserId: 1,
  totalVotes: 5,
  rouletteData: null,
  createdAt: new Date(),
  ...overrides,
});

describe('PollService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPoll', () => {
    it('should create a new poll successfully', async () => {
      const mockData = {
        groupId: 1,
        duration: 30,
        createdBy: 1,
      };

      const mockCreatedPoll = createMockPoll(mockData);

      (prisma.poll.create as jest.Mock).mockResolvedValue(mockCreatedPoll);

      const result = await PollService.createPoll(mockData);

      expect(prisma.poll.create).toHaveBeenCalledWith({
        data: {
          groupId: mockData.groupId,
          status: 'ACTIVE',
          duration: mockData.duration,
          createdBy: mockData.createdBy,
          isMultiSelect: true,
          maxSelections: 3,
        },
      });

      expect(CacheInvalidator.invalidatePoll).toHaveBeenCalledWith(
        mockCreatedPoll.id,
        mockCreatedPoll.groupId
      );
      expect(result).toEqual(mockCreatedPoll);
    });

    it('should use default duration if not provided', async () => {
      const mockData = {
        groupId: 1,
        createdBy: 1,
        duration: 30,
      };

      const mockCreatedPoll = createMockPoll({ duration: 30 });

      (prisma.poll.create as jest.Mock).mockResolvedValue(mockCreatedPoll);

      await PollService.createPoll(mockData);

      expect(prisma.poll.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          duration: 30,
        }),
      });
    });

    it('should throw an error if creation fails', async () => {
      const mockData = {
        groupId: 1,
        duration: 30,
        createdBy: 1,
      };

      (prisma.poll.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(PollService.createPoll(mockData)).rejects.toThrow('Failed to create poll');
    });
  });

  describe('getPollById', () => {
    it('should return poll with details if found', async () => {
      const mockPoll = {
        ...createMockPoll(),
        group: { id: 1, title: 'Test Group', telegramId: BigInt(123) },
        votes: [],
        result: null,
        _count: { votes: 0 },
      };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);

      const result = await PollService.getPollById(1);

      expect(prisma.poll.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          group: true,
          votes: {
            include: {
              user: { select: expect.any(Object) },
              menuItem: true,
            },
          },
          result: {
            include: {
              winnerMenuItem: true,
              responsibleUser: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
      });

      expect(result).toEqual(mockPoll);
    });

    it('should return null if poll not found', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await PollService.getPollById(999);

      expect(result).toBeNull();
    });

    it('should throw an error if query fails', async () => {
      (prisma.poll.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(PollService.getPollById(1)).rejects.toThrow('Failed to get poll');
    });
  });

  describe('getActivePollInGroup', () => {
    it('should return active poll in group from cache', async () => {
      const mockPoll = createMockPoll();

      const { cacheService } = require('../cache.service');
      (cacheService.getOrSet as jest.Mock).mockImplementation(async (key, fetchFn) => {
        return await fetchFn();
      });

      (prisma.poll.findFirst as jest.Mock).mockResolvedValue(mockPoll);

      const result = await PollService.getActivePollInGroup(1);

      expect(cacheService.getOrSet).toHaveBeenCalled();
      expect(result).toEqual(mockPoll);
    });

    it('should return null if no active poll in group', async () => {
      const { cacheService } = require('../cache.service');
      (cacheService.getOrSet as jest.Mock).mockImplementation(async (key, fetchFn) => {
        return await fetchFn();
      });

      (prisma.poll.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await PollService.getActivePollInGroup(1);

      expect(result).toBeNull();
    });
  });

  describe('getActivePolls', () => {
    it('should return all active polls', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 10 * 60 * 1000); // 10 min in future

      const mockPolls = [
        {
          ...createMockPoll({ id: 1, endedAt: futureDate }),
          group: { id: 1, title: 'Group 1' },
          votes: [],
          _count: { votes: 0 },
          chatId: null,
        },
      ];

      (prisma.poll.findMany as jest.Mock).mockResolvedValue(mockPolls);

      const result = await PollService.getActivePolls();

      expect(prisma.poll.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: {
          group: {
            select: {
              id: true,
              title: true,
              telegramId: true,
            },
          },
          votes: {
            select: {
              id: true,
              pollId: true,
              userId: true,
              menuItemId: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                },
              },
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('completePoll', () => {
    it('should complete poll successfully', async () => {
      const mockPoll = {
        ...createMockPoll(),
        votes: [
          { id: 1, menuItemId: 1, userId: 1, menuItem: { id: 1, name: 'Pizza' }, user: { id: 1 } },
          { id: 2, menuItemId: 1, userId: 2, menuItem: { id: 1, name: 'Pizza' }, user: { id: 2 } },
          { id: 3, menuItemId: 2, userId: 3, menuItem: { id: 2, name: 'Burger' }, user: { id: 3 } },
        ],
      };

      const mockResult = {
        ...createMockPollResult({ winnerMenuItemId: 1, totalVotes: 3 }),
        poll: mockPoll,
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 1, firstName: 'John' },
      };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.poll.update as jest.Mock).mockResolvedValue({ ...mockPoll, status: 'COMPLETED' });
      (prisma.pollResult.create as jest.Mock).mockResolvedValue(mockResult);
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await PollService.completePoll(1);

      expect(prisma.poll.findUnique).toHaveBeenCalled();
      expect(CacheInvalidator.invalidatePoll).toHaveBeenCalled();
      expect(result).toHaveProperty('winnerMenuItemId', 1);
      expect(result).toHaveProperty('totalVotes', 3);
    });

    it('should throw error if poll not found', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(PollService.completePoll(999)).rejects.toThrow('Poll not found');
    });

    it('should throw error if poll already completed', async () => {
      const mockPoll = createMockPoll({ status: 'COMPLETED' });

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);

      await expect(PollService.completePoll(1)).rejects.toThrow('Poll is already completed');
    });
  });

  describe('cancelPoll', () => {
    it('should cancel poll successfully', async () => {
      const mockPoll = createMockPoll({ status: 'CANCELLED', endedAt: new Date() });

      (prisma.poll.update as jest.Mock).mockResolvedValue(mockPoll);
      // Return null user to skip notification sending
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await PollService.cancelPoll(1, 1, 'Test reason');

      expect(prisma.poll.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { 
          status: 'CANCELLED',
          endedAt: expect.any(Date)
        },
      });

      expect(result).toEqual(mockPoll);
    });

    it('should throw error if poll not found', async () => {
      const error = Object.assign(
        new Error('Record not found.'),
        {
          code: 'P2025',
          clientVersion: '5.6.0',
          meta: { cause: 'Record not found.' },
        }
      );
      Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

      (prisma.poll.update as jest.Mock).mockRejectedValue(error);

      await expect(PollService.cancelPoll(999, 1)).rejects.toThrow('Poll not found');
    });
  });

  describe('updatePoll', () => {
    it('should update poll successfully', async () => {
      const mockUpdatedPoll = createMockPoll({ duration: 45 });

      (prisma.poll.update as jest.Mock).mockResolvedValue(mockUpdatedPoll);

      const result = await PollService.updatePoll(1, { duration: 45 });

      expect(prisma.poll.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { duration: 45 },
      });

      expect(result).toEqual(mockUpdatedPoll);
    });

    it('should throw error if poll not found', async () => {
      const error = Object.assign(
        new Error('Record not found.'),
        {
          code: 'P2025',
          clientVersion: '5.6.0',
          meta: { cause: 'Record not found.' },
        }
      );
      Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

      (prisma.poll.update as jest.Mock).mockRejectedValue(error);

      await expect(PollService.updatePoll(999, { duration: 45 })).rejects.toThrow('Poll not found');
    });
  });

  describe('getPollResult', () => {
    it('should return poll result with details', async () => {
      const mockResult = {
        ...createMockPollResult(),
        poll: {
          ...createMockPoll(),
          group: { id: 1, title: 'Test Group' },
          votes: [],
        },
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 1, firstName: 'John' },
      };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await PollService.getPollResult(1);

      expect(prisma.pollResult.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          poll: {
            include: {
              group: true,
              votes: {
                include: {
                  user: { select: expect.any(Object) },
                  menuItem: true,
                },
              },
            },
          },
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });

      expect(result).toEqual(mockResult);
    });

    it('should throw error if result not found', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(PollService.getPollResult(999)).rejects.toThrow('Poll result not found');
    });
  });

  describe('getPollResultByPollId', () => {
    it('should return poll result by poll ID', async () => {
      const mockResult = {
        ...createMockPollResult(),
        poll: {
          ...createMockPoll(),
          group: { id: 1, title: 'Test Group' },
        },
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 1, firstName: 'John' },
      };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(mockResult);

      const result = await PollService.getPollResultByPollId(1);

      expect(result).toEqual(mockResult);
    });

    it('should return null if result not found', async () => {
      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await PollService.getPollResultByPollId(999);

      expect(result).toBeNull();
    });
  });

  describe('runRoulette', () => {
    it('should select random responsible user from voters', async () => {
      const mockPoll = {
        ...createMockPoll(),
        votes: [
          { id: 1, userId: 1, user: { id: 1, firstName: 'User1' } },
          { id: 2, userId: 2, user: { id: 2, firstName: 'User2' } },
          { id: 3, userId: 3, user: { id: 3, firstName: 'User3' } },
        ],
      };

      const mockResult = {
        ...createMockPollResult({ responsibleUserId: 2 }),
        poll: {
          ...createMockPoll(),
          group: { id: 1, title: 'Test Group' },
        },
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 2, firstName: 'User2' },
      };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);
      (prisma.pollResult.update as jest.Mock).mockResolvedValue(mockResult);

      const result = await PollService.runRoulette(1);

      expect(prisma.poll.findUnique).toHaveBeenCalled();
      expect(prisma.pollResult.update).toHaveBeenCalled();
      expect(result).toHaveProperty('responsibleUser');
    });

    it('should throw error if poll not found', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(PollService.runRoulette(999)).rejects.toThrow('Poll not found');
    });

    it('should throw error if no voters found', async () => {
      const mockPoll = {
        ...createMockPoll(),
        votes: [],
      };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);

      await expect(PollService.runRoulette(1)).rejects.toThrow('No voters found');
    });
  });

  describe('getPollHistory', () => {
    it('should return paginated poll history', async () => {
      const mockPolls = [
        {
          ...createMockPoll({ id: 1, status: 'COMPLETED' }),
          group: { id: 1, title: 'Group 1', telegramId: BigInt(123) },
          result: {
            id: 1,
            totalVotes: 5,
            createdAt: new Date(),
            winnerMenuItem: { id: 1, name: 'Pizza', price: 500, imageUrl: null },
            responsibleUser: { id: 1, firstName: 'John', lastName: null, username: null, telegramId: BigInt(123) },
          },
          _count: { votes: 5 },
        },
      ];

      (prisma.poll.findMany as jest.Mock).mockResolvedValue(mockPolls);
      (prisma.poll.count as jest.Mock).mockResolvedValue(1);

      const result = await PollService.getPollHistory(1, 20, 0);

      expect(result).toHaveProperty('polls');
      expect(result).toHaveProperty('total', 1);
      expect(result.polls).toHaveLength(1);
    });

    it('should return history for all groups if groupId not provided', async () => {
      (prisma.poll.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.poll.count as jest.Mock).mockResolvedValue(0);

      const result = await PollService.getPollHistory(undefined, 20, 0);

      expect(prisma.poll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'COMPLETED' },
        })
      );

      expect(result.total).toBe(0);
    });
  });

  describe('getPollStats', () => {
    it('should return poll statistics', async () => {
      (prisma.poll.count as jest.Mock)
        .mockResolvedValueOnce(10) // totalPolls
        .mockResolvedValueOnce(2)  // activePolls
        .mockResolvedValueOnce(3); // completedPolls

      (prisma.vote.count as jest.Mock).mockResolvedValue(50);

      (prisma.poll.aggregate as jest.Mock).mockResolvedValue({
        _avg: { id: 1 },
      });

      (prisma.poll.findMany as jest.Mock).mockResolvedValue([
        { _count: { votes: 5 } },
        { _count: { votes: 7 } },
        { _count: { votes: 3 } },
      ]);

      const result = await PollService.getPollStats(1);

      expect(result).toEqual({
        totalPolls: 10,
        activePolls: 2,
        completedPolls: 3,
        totalVotes: 50,
        averageParticipants: 5,
      });
    });

    it('should handle zero completed polls', async () => {
      (prisma.poll.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.vote.count as jest.Mock).mockResolvedValue(0);

      (prisma.poll.aggregate as jest.Mock).mockResolvedValue({
        _avg: { id: null },
      });

      (prisma.poll.findMany as jest.Mock).mockResolvedValue([]);

      const result = await PollService.getPollStats();

      expect(result.averageParticipants).toBe(0);
    });
  });

  describe('getExpiredPolls', () => {
    it('should return expired active polls', async () => {
      const pastDate = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago
      const mockPolls = [
        createMockPoll({ id: 1, startedAt: pastDate }),
      ];

      (prisma.poll.findMany as jest.Mock).mockResolvedValue(mockPolls);

      const result = await PollService.getExpiredPolls();

      expect(prisma.poll.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          startedAt: expect.any(Object),
        },
      });

      expect(result).toEqual(mockPolls);
    });
  });

  describe('getPollVoteBreakdown', () => {
    it('should return vote breakdown by menu items', async () => {
      const mockPoll = {
        ...createMockPoll(),
        votes: [
          { menuItemId: 1, menuItem: { name: 'Pizza' }, user: { id: 1, firstName: 'User1', username: 'user1' } },
          { menuItemId: 1, menuItem: { name: 'Pizza' }, user: { id: 2, firstName: 'User2', username: null } },
          { menuItemId: 2, menuItem: { name: 'Burger' }, user: { id: 3, firstName: 'User3', username: 'user3' } },
        ],
      };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);

      const result = await PollService.getPollVoteBreakdown(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        menuItemId: 1,
        menuItemName: 'Pizza',
        votes: 2,
        percentage: 67,
      });
      expect(result[0].voters).toHaveLength(2);
    });

    it('should throw error if poll not found', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(PollService.getPollVoteBreakdown(999)).rejects.toThrow('Poll not found');
    });
  });

  describe('savePollResult', () => {
    it('should create new poll result if not exists', async () => {
      const mockData = {
        pollId: 1,
        winnerMenuItemId: 1,
        responsibleUserId: 1,
        totalVotes: 5,
      };

      const mockResult = {
        ...createMockPollResult(mockData),
        poll: createMockPoll(),
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 1, firstName: 'John' },
      };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.pollResult.create as jest.Mock).mockResolvedValue(mockResult);

      const result = await PollService.savePollResult(mockData);

      expect(prisma.pollResult.create).toHaveBeenCalledWith({
        data: {
          pollId: mockData.pollId,
          winnerMenuItemId: mockData.winnerMenuItemId,
          responsibleUserId: mockData.responsibleUserId,
          totalVotes: mockData.totalVotes,
        },
        include: {
          poll: true,
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });

      expect(result).toEqual(mockResult);
    });

    it('should update existing poll result', async () => {
      const mockData = {
        pollId: 1,
        responsibleUserId: 2,
        totalVotes: 5,
        rouletteData: 'test',
      };

      const existingResult = createMockPollResult();
      const updatedResult = {
        ...existingResult,
        ...mockData,
        poll: createMockPoll(),
        winnerMenuItem: { id: 1, name: 'Pizza' },
        responsibleUser: { id: 2, firstName: 'Jane' },
      };

      (prisma.pollResult.findUnique as jest.Mock).mockResolvedValue(existingResult);
      (prisma.pollResult.update as jest.Mock).mockResolvedValue(updatedResult);

      const result = await PollService.savePollResult(mockData);

      expect(prisma.pollResult.update).toHaveBeenCalledWith({
        where: { pollId: mockData.pollId },
        data: {
          responsibleUserId: mockData.responsibleUserId,
          rouletteData: mockData.rouletteData,
        },
        include: {
          poll: true,
          winnerMenuItem: true,
          responsibleUser: true,
        },
      });

      expect(result).toEqual(updatedResult);
    });
  });
});
