import { VoteService } from '../vote.service';
import { prisma } from '../../database/client';
import { Vote, Prisma } from '@prisma/client';
import { VoteType } from '../../types/vote.types';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    $transaction: jest.fn(),
    vote: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    poll: {
      findUnique: jest.fn(),
    },
    menuItem: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
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

// Helper function to create mock vote
const createMockVote = (overrides?: Partial<Vote>): Vote => ({
  id: 1,
  pollId: 1,
  userId: 1,
  menuItemId: 1,
  voteType: VoteType.MENU_ITEM,
  customOption: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('VoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) =>
      callback({
        vote: prisma.vote,
        poll: prisma.poll,
      })
    );
  });

  describe('createVote', () => {
    it('should create a new vote successfully', async () => {
      const mockData = {
        pollId: 1,
        userId: 1,
        menuItemId: 2,
      };

      const mockCreatedVote = createMockVote(mockData);

      // Мокаем findFirst (проверка существующего голоса) - возвращаем null
      (prisma.vote.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.vote.create as jest.Mock).mockResolvedValue(mockCreatedVote);

      const result = await VoteService.createVote(mockData);

      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: {
          pollId: 1,
          userId: 1,
          menuItemId: 2,
          voteType: VoteType.MENU_ITEM,
        },
      });

      expect(result).toEqual(mockCreatedVote);
    });

    it('should throw an error if creation fails', async () => {
      const mockData = {
        pollId: 1,
        userId: 1,
        menuItemId: 2,
      };

      // Мокаем findFirst (проверка существующего голоса) - возвращаем null
      (prisma.vote.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.vote.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(VoteService.createVote(mockData)).rejects.toThrow('Failed to create vote');
    });
  });

  describe('createVoteWithType', () => {
    it('should create vote with MENU_ITEM type', async () => {
      const mockData = {
        pollId: 1,
        userId: 1,
        voteType: VoteType.MENU_ITEM,
        menuItemId: 2,
      };

      const mockCreatedVote = createMockVote(mockData);

      (prisma.vote.create as jest.Mock).mockResolvedValue(mockCreatedVote);

      const result = await VoteService.createVoteWithType(mockData);

      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: mockData,
      });

      expect(result).toEqual(mockCreatedVote);
    });

    it('should create vote with BRING_OWN type', async () => {
      const mockData = {
        pollId: 1,
        userId: 1,
        voteType: VoteType.BRING_OWN,
        customOption: 'Домашняя еда',
      };

      const mockCreatedVote = createMockVote({
        ...mockData,
        menuItemId: null,
      });

      (prisma.vote.create as jest.Mock).mockResolvedValue(mockCreatedVote);

      const result = await VoteService.createVoteWithType(mockData);

      expect(result.voteType).toBe(VoteType.BRING_OWN);
      expect(result.customOption).toBe('Домашняя еда');
    });

    it('should create vote with SKIP type', async () => {
      const mockData = {
        pollId: 1,
        userId: 1,
        voteType: VoteType.SKIP,
      };

      const mockCreatedVote = createMockVote({
        ...mockData,
        menuItemId: null,
      });

      (prisma.vote.create as jest.Mock).mockResolvedValue(mockCreatedVote);

      const result = await VoteService.createVoteWithType(mockData);

      expect(result.voteType).toBe(VoteType.SKIP);
    });
  });

  describe('createMultipleVotes', () => {
    it('should create only new votes and return all selected votes', async () => {
      const awardVoteXpSpy = jest
        .spyOn(VoteService as any, 'awardVoteXp')
        .mockResolvedValue(undefined);

      const existingVote = createMockVote({ pollId: 1, userId: 10, menuItemId: 2 });
      const allVotes = [
        createMockVote({ id: 101, pollId: 1, userId: 10, menuItemId: 2 }),
        createMockVote({ id: 102, pollId: 1, userId: 10, menuItemId: 3 }),
      ];

      (prisma.vote.findMany as jest.Mock)
        .mockResolvedValueOnce([existingVote])
        .mockResolvedValueOnce(allVotes);
      (prisma.vote.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await VoteService.createMultipleVotes(1, 10, [2, 3, 3]);

      expect(prisma.vote.createMany).toHaveBeenCalledWith({
        data: [
          {
            pollId: 1,
            userId: 10,
            menuItemId: 3,
            voteType: VoteType.MENU_ITEM,
          },
        ],
      });
      expect(awardVoteXpSpy).toHaveBeenCalledWith(10, 1, 3);
      expect(result).toEqual(allVotes);

      awardVoteXpSpy.mockRestore();
    });

    it('should return existing votes when all selected items already voted', async () => {
      const existingVotes = [
        createMockVote({ id: 201, pollId: 1, userId: 20, menuItemId: 5 }),
        createMockVote({ id: 202, pollId: 1, userId: 20, menuItemId: 6 }),
      ];

      (prisma.vote.findMany as jest.Mock).mockResolvedValue(existingVotes);

      const result = await VoteService.createMultipleVotes(1, 20, [5, 6]);

      expect(prisma.vote.createMany).not.toHaveBeenCalled();
      expect(result).toEqual(existingVotes);
    });
  });

  describe('updateVote', () => {
    it('should update vote successfully', async () => {
      const mockUpdatedVote = createMockVote({ menuItemId: 3 });

      (prisma.vote.update as jest.Mock).mockResolvedValue(mockUpdatedVote);

      const result = await VoteService.updateVote(1, 3);

      expect(prisma.vote.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          menuItemId: 3,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.menuItemId).toBe(3);
    });

    it('should throw error if vote not found', async () => {
      (prisma.vote.update as jest.Mock).mockRejectedValue(new Error('Vote not found'));

      await expect(VoteService.updateVote(999, 3)).rejects.toThrow('Failed to update vote');
    });
  });

  describe('upsertVote', () => {
    it('should replace previous user votes in transaction', async () => {
      const poll = { id: 1, status: 'ACTIVE', endedAt: null };
      const createdVote = createMockVote({ pollId: 1, userId: 7, menuItemId: 9 });

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(poll);
      (prisma.vote.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.vote.create as jest.Mock).mockResolvedValue(createdVote);

      const result = await VoteService.upsertVote({ pollId: 1, userId: 7, menuItemId: 9 });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.vote.deleteMany).toHaveBeenCalledWith({
        where: { pollId: 1, userId: 7 },
      });
      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: {
          pollId: 1,
          userId: 7,
          menuItemId: 9,
          voteType: VoteType.MENU_ITEM,
        },
      });
      expect(result).toEqual(createdVote);
    });

    it('should throw if poll is not active', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue({ id: 1, status: 'COMPLETED', endedAt: null });

      await expect(VoteService.upsertVote({ pollId: 1, userId: 7, menuItemId: 9 })).rejects.toThrow('Poll is not active');
    });
  });

  describe('upsertVoteWithType', () => {
    it('should upsert vote with custom voteType in transaction', async () => {
      const poll = { id: 1, status: 'ACTIVE', endedAt: null };
      const createdVote = createMockVote({
        pollId: 1,
        userId: 8,
        voteType: VoteType.BRING_OWN,
        menuItemId: null,
        customOption: 'Домашнее',
      });

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(poll);
      (prisma.vote.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.vote.create as jest.Mock).mockResolvedValue(createdVote);

      const result = await VoteService.upsertVoteWithType({
        pollId: 1,
        userId: 8,
        voteType: VoteType.BRING_OWN,
        customOption: 'Домашнее',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.vote.create).toHaveBeenCalledWith({
        data: {
          pollId: 1,
          userId: 8,
          voteType: VoteType.BRING_OWN,
          menuItemId: undefined,
          customOption: 'Домашнее',
        },
      });
      expect(result).toEqual(createdVote);
    });
  });

  describe('getVoteBreakdown', () => {
    it('should return vote breakdown with menu items', async () => {
      const mockVoteGroups = [
        { menuItemId: 1, _count: { menuItemId: 3 } },
        { menuItemId: 2, _count: { menuItemId: 2 } },
      ];

      const mockMenuItems = [
        { id: 1, name: 'Пицца' },
        { id: 2, name: 'Бургер' },
      ];

      const mockVotes = [
        { menuItemId: 1, user: { id: 1, firstName: 'Alice', username: 'alice' } },
        { menuItemId: 1, user: { id: 2, firstName: 'Bob', username: null } },
        { menuItemId: 1, user: { id: 3, firstName: 'Charlie', username: 'charlie' } },
        { menuItemId: 2, user: { id: 4, firstName: 'Dave', username: 'dave' } },
        { menuItemId: 2, user: { id: 5, firstName: 'Eve', username: null } },
      ];

      (prisma.vote.groupBy as jest.Mock).mockResolvedValue(mockVoteGroups);
      (prisma.menuItem.findMany as jest.Mock).mockResolvedValue(mockMenuItems);
      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const result = await VoteService.getVoteBreakdown(1);

      expect(result).toHaveLength(2);
      expect(result[0].menuItemName).toBe('Пицца');
      expect(result[0].votes).toBe(3);
      expect(result[0].percentage).toBe(60);
      expect(result[0].voters).toHaveLength(3);
    });

    it('should return empty array if no votes', async () => {
      (prisma.vote.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await VoteService.getVoteBreakdown(1);

      expect(result).toEqual([]);
    });
  });

  describe('getUserVoteInPoll', () => {
    it('should return user vote if exists', async () => {
      const mockVote = createMockVote();

      // getUserVoteInPoll calls getUserVotes which uses findMany
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([mockVote]);

      const result = await VoteService.getUserVoteInPoll(1, 1);

      expect(prisma.vote.findMany).toHaveBeenCalledWith({
        where: {
          pollId: 1,
          userId: 1,
          menuItemId: { not: null },
        },
        include: {
          menuItem: true,
        },
      });

      expect(result).toEqual(mockVote);
    });

    it('should return null if user has not voted', async () => {
      // getUserVoteInPoll calls getUserVotes which uses findMany
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);

      const result = await VoteService.getUserVoteInPoll(1, 1);

      expect(result).toBeNull();
    });
  });

  describe('getPollVotes', () => {
    it('should return all votes for a poll', async () => {
      const mockVotes = [
        createMockVote({ userId: 1 }),
        createMockVote({ userId: 2 }),
        createMockVote({ userId: 3 }),
      ];

      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const result = await VoteService.getPollVotes(1);

      expect(prisma.vote.findMany).toHaveBeenCalledWith({
        where: { pollId: 1 },
        include: {
          user: { select: expect.any(Object) },
          menuItem: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(3);
    });
  });

  describe('hasUserVoted', () => {
    it('should return true if user has voted', async () => {
      const mockVote = createMockVote();

      // hasUserVoted calls getUserVotes which uses findMany
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([mockVote]);

      const result = await VoteService.hasUserVoted(1, 1);

      expect(result).toBe(true);
    });

    it('should return false if user has not voted', async () => {
      // hasUserVoted calls getUserVotes which uses findMany
      (prisma.vote.findMany as jest.Mock).mockResolvedValue([]);

      const result = await VoteService.hasUserVoted(1, 1);

      expect(result).toBe(false);
    });
  });

  describe('getVoteTypeStats', () => {
    it('should return vote type statistics', async () => {
      const mockVotes = [
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.MENU_ITEM },
        { voteType: VoteType.BRING_OWN },
        { voteType: VoteType.BRING_OWN },
        { voteType: VoteType.SKIP },
      ];

      (prisma.vote.findMany as jest.Mock).mockResolvedValue(mockVotes);

      const result = await VoteService.getVoteTypeStats(1);

      expect(result.total).toBe(11);
      expect(result.menuItemVotes).toBe(8);
      expect(result.bringOwnVotes).toBe(2);
      expect(result.skipVotes).toBe(1);
    });
  });

  describe('removeVote', () => {
    it('should remove vote successfully', async () => {
      const mockPoll = { id: 1, status: 'ACTIVE' };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);
      // removeVote uses deleteMany, not delete
      (prisma.vote.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await VoteService.removeVote(1, 1);

      expect(prisma.poll.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, status: true },
      });

      expect(prisma.vote.deleteMany).toHaveBeenCalledWith({
        where: {
          pollId: 1,
          userId: 1,
        },
      });
    });

    it('should throw error if poll not found', async () => {
      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(null);

      // Note: catch block replaces all errors with "Failed to remove vote"
      await expect(VoteService.removeVote(1, 1)).rejects.toThrow('Failed to remove vote');
    });

    it('should throw error if poll is not active', async () => {
      const mockPoll = { id: 1, status: 'COMPLETED' };

      (prisma.poll.findUnique as jest.Mock).mockResolvedValue(mockPoll);

      // Note: catch block replaces all errors with "Failed to remove vote"
      await expect(VoteService.removeVote(1, 1)).rejects.toThrow('Failed to remove vote');
    });
  });
});
