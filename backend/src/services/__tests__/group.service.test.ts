import { GroupService } from '../group.service';
import { prisma } from '../../database/client';
import { Group, Prisma } from '@prisma/client';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    group: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    poll: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    vote: {
      count: jest.fn(),
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

// Helper function to create mock group
const createMockGroup = (overrides?: Partial<Group>): Group => ({
  id: 1,
  telegramId: BigInt(123456789),
  title: 'Test Group',
  type: 'group',
  isActive: true,
  settings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('GroupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertGroup', () => {
    it('should create new group', async () => {
      const mockData = {
        telegramId: '123456789',
        title: 'New Group',
        type: 'group' as const,
      };

      const mockGroup = createMockGroup({
        telegramId: BigInt(mockData.telegramId),
        title: mockData.title,
        type: mockData.type,
      });

      (prisma.group.upsert as jest.Mock).mockResolvedValue(mockGroup);

      const result = await GroupService.upsertGroup(mockData);

      expect(prisma.group.upsert).toHaveBeenCalledWith({
        where: { telegramId: BigInt(mockData.telegramId) },
        update: {
          title: mockData.title,
          type: mockData.type,
          isActive: true,
          updatedAt: expect.any(Date),
        },
        create: {
          telegramId: BigInt(mockData.telegramId),
          title: mockData.title,
          type: mockData.type,
          isActive: true,
        },
      });

      expect(result).toEqual(mockGroup);
    });

    it('should update existing group', async () => {
      const mockData = {
        telegramId: '123456789',
        title: 'Updated Group',
        type: 'supergroup' as const,
      };

      const mockGroup = createMockGroup({
        telegramId: BigInt(mockData.telegramId),
        title: mockData.title,
        type: mockData.type,
      });

      (prisma.group.upsert as jest.Mock).mockResolvedValue(mockGroup);

      const result = await GroupService.upsertGroup(mockData);

      expect(result.title).toBe('Updated Group');
      expect(result.type).toBe('supergroup');
    });

    it('should throw error if database fails', async () => {
      const mockData = {
        telegramId: '123456789',
        title: 'New Group',
        type: 'group' as const,
      };

      (prisma.group.upsert as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(GroupService.upsertGroup(mockData)).rejects.toThrow('Failed to create or update group');
    });
  });

  describe('getGroupByTelegramId', () => {
    it('should return group if exists', async () => {
      const mockGroup = createMockGroup();

      (prisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      const result = await GroupService.getGroupByTelegramId('123456789');

      expect(prisma.group.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt('123456789') },
      });

      expect(result).toEqual(mockGroup);
    });

    it('should return null if group does not exist', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await GroupService.getGroupByTelegramId('999999999');

      expect(result).toBeNull();
    });

    it('should throw error if database fails', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(GroupService.getGroupByTelegramId('123456789')).rejects.toThrow('Failed to get group');
    });
  });

  describe('getGroupById', () => {
    it('should return group with active polls', async () => {
      const mockGroup: any = {
        ...createMockGroup(),
        polls: [
          { id: 1, status: 'ACTIVE' },
          { id: 2, status: 'ACTIVE' },
        ],
      };

      (prisma.group.findUnique as jest.Mock).mockResolvedValue(mockGroup);

      const result = await GroupService.getGroupById(1);

      expect(prisma.group.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          polls: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      expect(result).toEqual(mockGroup);
    });

    it('should return null if group does not exist', async () => {
      (prisma.group.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await GroupService.getGroupById(999);

      expect(result).toBeNull();
    });

    it('should throw error if database fails', async () => {
      (prisma.group.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(GroupService.getGroupById(1)).rejects.toThrow('Failed to get group');
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully', async () => {
      const mockData = {
        title: 'Updated Title',
        isActive: false,
      };

      const mockUpdatedGroup = createMockGroup(mockData);

      (prisma.group.update as jest.Mock).mockResolvedValue(mockUpdatedGroup);

      const result = await GroupService.updateGroup(1, mockData);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          ...mockData,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.title).toBe('Updated Title');
      expect(result.isActive).toBe(false);
    });

    it('should throw error if group not found', async () => {
      const error = Object.assign(
        new Error('Record not found'),
        {
          code: 'P2025',
          clientVersion: '5.6.0',
        }
      );
      Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

      (prisma.group.update as jest.Mock).mockRejectedValue(error);

      await expect(GroupService.updateGroup(999, { title: 'New Title' })).rejects.toThrow('Group not found');
    });

    it('should throw generic error for other failures', async () => {
      (prisma.group.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(GroupService.updateGroup(1, { title: 'New Title' })).rejects.toThrow('Failed to update group');
    });
  });

  describe('getActiveGroupPoll', () => {
    it('should return active poll for group', async () => {
      const mockActivePoll: any = {
        id: 1,
        groupId: 1,
        status: 'ACTIVE',
        startedAt: new Date(),
      };

      (prisma.poll.findFirst as jest.Mock).mockResolvedValue(mockActivePoll);

      const result = await GroupService.getActiveGroupPoll(1);

      expect(prisma.poll.findFirst).toHaveBeenCalledWith({
        where: {
          groupId: 1,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockActivePoll);
    });

    it('should return null if no active poll', async () => {
      (prisma.poll.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await GroupService.getActiveGroupPoll(1);

      expect(result).toBeNull();
    });
  });

  describe('getAllGroups', () => {
    it('should return all groups', async () => {
      const mockGroups = [
        createMockGroup({ id: 1 }),
        createMockGroup({ id: 2, title: 'Group 2' }),
      ];

      (prisma.group.findMany as jest.Mock).mockResolvedValue(mockGroups);
      (prisma.group.count as jest.Mock).mockResolvedValue(2);

      const result = await GroupService.getAllGroups();

      expect(prisma.group.findMany).toHaveBeenCalled();
      expect(prisma.group.count).toHaveBeenCalled();
      expect(result.groups).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getGroupStats', () => {
    it('should return group statistics', async () => {
      const mockTotalPolls = 10;
      const mockActivePolls = 2;
      const mockTotalVotes = 50;

      (prisma.poll.count as jest.Mock)
        .mockResolvedValueOnce(mockTotalPolls) // totalPolls
        .mockResolvedValueOnce(mockActivePolls); // activePolls

      (prisma.vote.count as jest.Mock).mockResolvedValue(mockTotalVotes);

      const stats = await GroupService.getGroupStats(1);

      expect(stats).toHaveProperty('totalPolls', mockTotalPolls);
      expect(stats).toHaveProperty('activePolls', mockActivePolls);
      expect(stats).toHaveProperty('totalVotes', mockTotalVotes);
      expect(stats).toHaveProperty('averageVotesPerPoll', 5); // 50/10
    });
  });

  describe('deactivateGroup', () => {
    it('should deactivate group', async () => {
      const mockDeactivatedGroup = createMockGroup({ isActive: false });

      (prisma.group.update as jest.Mock).mockResolvedValue(mockDeactivatedGroup);

      const result = await GroupService.deactivateGroup(1);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe('ensureMemberRole', () => {
    it('creates member with desired role (new member, no downgrade needed)', async () => {
      const addSpy = jest
        .spyOn(GroupService, 'addMemberToGroup')
        .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });
      const setSpy = jest.spyOn(GroupService, 'setMemberRole').mockResolvedValue({} as any);

      const result = await GroupService.ensureMemberRole(10, 5, 'CREATOR');

      expect(addSpy).toHaveBeenCalledWith(10, 5, 'CREATOR');
      expect(setSpy).not.toHaveBeenCalled();
      expect(result.role).toBe('CREATOR');

      addSpy.mockRestore();
      setSpy.mockRestore();
    });

    it('upgrades existing MEMBER to CREATOR', async () => {
      const addSpy = jest
        .spyOn(GroupService, 'addMemberToGroup')
        .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'MEMBER', isActive: true });
      const setSpy = jest
        .spyOn(GroupService, 'setMemberRole')
        .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });

      const result = await GroupService.ensureMemberRole(10, 5, 'CREATOR');

      expect(setSpy).toHaveBeenCalledWith(10, 5, 'CREATOR');
      expect(result.role).toBe('CREATOR');

      addSpy.mockRestore();
      setSpy.mockRestore();
    });

    it('does NOT downgrade existing CREATOR to ADMIN', async () => {
      const addSpy = jest
        .spyOn(GroupService, 'addMemberToGroup')
        .mockResolvedValue({ id: 1, groupId: 10, userId: 5, role: 'CREATOR', isActive: true });
      const setSpy = jest.spyOn(GroupService, 'setMemberRole').mockResolvedValue({} as any);

      const result = await GroupService.ensureMemberRole(10, 5, 'ADMIN');

      expect(setSpy).not.toHaveBeenCalled();
      expect(result.role).toBe('CREATOR');

      addSpy.mockRestore();
      setSpy.mockRestore();
    });
  });

});
