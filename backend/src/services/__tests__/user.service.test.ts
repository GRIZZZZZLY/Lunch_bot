import { UserService } from '../user.service';
import { prisma } from '../../database/client';
import { User, Prisma } from '@prisma/client';

// Mock prisma client
jest.mock('../../database/client', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock logger to avoid console noise
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper function to create mock user
const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  telegramId: BigInt(123456789),
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  photoUrl: null,
  avatarUrl: null,
  avatarUpdatedAt: null,
  isAdmin: false,
  isActive: true,
  paymentCard: null,
  paymentPhone: null,
  paymentDetails: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const mockUserData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockCreatedUser = createMockUser();

      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await UserService.createUser(mockUserData);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: BigInt(mockUserData.telegramId),
          username: mockUserData.username,
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          isAdmin: false,
          isActive: true,
        },
      });

      expect(result).toEqual(mockCreatedUser);
      expect(result.telegramId).toBe(BigInt(123456789));
    });

    it('should throw an error if user creation fails', async () => {
      const mockUserData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      (prisma.user.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(UserService.createUser(mockUserData)).rejects.toThrow('Failed to create user');
    });
  });

  describe('upsertUser', () => {
    it('should create a new user if not exists', async () => {
      const mockUserData = {
        telegramId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = createMockUser();

      (prisma.user.upsert as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.upsertUser(mockUserData);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { telegramId: BigInt(mockUserData.telegramId) },
        update: {
          username: mockUserData.username,
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          updatedAt: expect.any(Date),
        },
        create: {
          telegramId: BigInt(mockUserData.telegramId),
          username: mockUserData.username,
          firstName: mockUserData.firstName,
          lastName: mockUserData.lastName,
          isAdmin: false,
          isActive: true,
        },
      });

      expect(result).toEqual(mockUser);
    });

    it('should update existing user', async () => {
      const mockUserData = {
        telegramId: '123456789',
        username: 'updateduser',
        firstName: 'Updated',
        lastName: 'User',
      };

      const mockUpdatedUser = createMockUser({
        username: 'updateduser',
        firstName: 'Updated',
      });

      (prisma.user.upsert as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const result = await UserService.upsertUser(mockUserData);

      expect(result.username).toBe('updateduser');
      expect(result.firstName).toBe('Updated');
    });
  });

  describe('getUserByTelegramId', () => {
    it('should return user if found', async () => {
      const mockUser = createMockUser();

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserByTelegramId(BigInt(123456789));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt(123456789) },
      });

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.getUserByTelegramId(BigInt(999999999));

      expect(result).toBeNull();
    });

    it('should throw an error if database query fails', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(UserService.getUserByTelegramId(BigInt(123456789))).rejects.toThrow('Failed to get user');
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = createMockUser();

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserById(1);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUpdatedUser = createMockUser({
        username: 'updateduser',
        firstName: 'Updated',
      });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const result = await UserService.updateUser(1, {
        username: 'updateduser',
        firstName: 'Updated',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          username: 'updateduser',
          firstName: 'Updated',
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw error if user not found', async () => {
      // Mock Prisma error with P2025 code (Record not found)
      const error = Object.assign(
        new Error('Record to update not found.'),
        {
          code: 'P2025',
          clientVersion: '5.6.0',
          meta: { cause: 'Record to update not found.' },
        }
      );
      Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

      (prisma.user.update as jest.Mock).mockRejectedValue(error);

      await expect(
        UserService.updateUser(999, { username: 'test' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('setAdminStatus', () => {
    it('should set admin status to true', async () => {
      const mockUser = createMockUser({ isAdmin: true });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.setAdminStatus(BigInt(123456789), true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { telegramId: BigInt(123456789) },
        data: {
          isAdmin: true,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.isAdmin).toBe(true);
    });

    it('should set admin status to false', async () => {
      const mockUser = createMockUser({ isAdmin: false });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.setAdminStatus(BigInt(123456789), false);

      expect(result.isAdmin).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true if user is admin', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isAdmin: true,
      });

      const result = await UserService.isAdmin(BigInt(123456789));

      expect(result).toBe(true);
    });

    it('should return false if user is not admin', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        isAdmin: false,
      });

      const result = await UserService.isAdmin(BigInt(123456789));

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.isAdmin(BigInt(999999999));

      expect(result).toBe(false);
    });
  });

  describe('getAdmins', () => {
    it('should return all active admins', async () => {
      const mockAdmins = [
        createMockUser({
          id: 1,
          telegramId: BigInt(111111111),
          username: 'admin1',
          firstName: 'Admin',
          lastName: 'One',
          isAdmin: true,
        }),
        createMockUser({
          id: 2,
          telegramId: BigInt(222222222),
          username: 'admin2',
          firstName: 'Admin',
          lastName: 'Two',
          isAdmin: true,
        }),
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockAdmins);

      const result = await UserService.getAdmins();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isAdmin: true,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].isAdmin).toBe(true);
    });
  });

  describe('getUserStats', () => {
    it('should return correct user statistics', async () => {
      (prisma.user.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // active
        .mockResolvedValueOnce(5); // admins

      const result = await UserService.getUserStats();

      expect(result).toEqual({
        total: 100,
        active: 85,
        admins: 5,
      });
    });
  });

  describe('updatePaymentInfo', () => {
    it('should update payment information successfully', async () => {
      const mockUser = createMockUser({
        paymentCard: '1234567890123456',
        paymentPhone: '+1234567890',
        paymentDetails: 'Some details',
      });

      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.updatePaymentInfo(1, {
        paymentCard: '1234567890123456',
        paymentPhone: '+1234567890',
        paymentDetails: 'Some details',
      });

      expect(result.paymentCard).toBe('1234567890123456');
      expect(result.paymentPhone).toBe('+1234567890');
    });
  });

  describe('getPaymentInfo', () => {
    it('should return payment information', async () => {
      const mockPaymentInfo = {
        paymentCard: '1234567890123456',
        paymentPhone: '+1234567890',
        paymentDetails: 'Some details',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPaymentInfo);

      const result = await UserService.getPaymentInfo(1);

      expect(result).toEqual(mockPaymentInfo);
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.getPaymentInfo(999);

      expect(result).toBeNull();
    });
  });
});
