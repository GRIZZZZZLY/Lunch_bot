import { UserService } from '../../../services/user.service';
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

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        telegramId: '12345',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const expectedUser = {
        id: 1,
        telegramId: '12345',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.upsert.mockResolvedValue(expectedUser);

      const result = await UserService.upsertUser(userData);

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { telegramId: userData.telegramId },
        update: {
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          updatedAt: expect.any(Date),
        },
        create: {
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isAdmin: false,
          isActive: true,
        },
      });

      expect(result).toEqual(expectedUser);
      expect(logger.info).toHaveBeenCalledWith(
        `User upserted: ${expectedUser.telegramId} (${expectedUser.firstName})`
      );
    });

    it('should handle database error', async () => {
      const userData = {
        telegramId: '12345',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const dbError = new Error('Database connection failed');
      mockPrisma.user.upsert.mockRejectedValue(dbError);

      await expect(UserService.upsertUser(userData)).rejects.toThrow(
        'Failed to create or update user'
      );

      expect(logger.error).toHaveBeenCalledWith('Error upserting user:', dbError);
    });
  });

  describe('getUserByTelegramId', () => {
    it('should return user when found', async () => {
      const telegramId = '12345';
      const expectedUser = {
        id: 1,
        telegramId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(expectedUser);

      const result = await UserService.getUserByTelegramId(telegramId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      const telegramId = '99999';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await UserService.getUserByTelegramId(telegramId);

      expect(result).toBeNull();
    });

    it('should handle database error', async () => {
      const telegramId = '12345';
      const dbError = new Error('Database connection failed');
      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      await expect(UserService.getUserByTelegramId(telegramId)).rejects.toThrow(
        'Failed to get user'
      );

      expect(logger.error).toHaveBeenCalledWith('Error getting user by telegram ID:', dbError);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', async () => {
      const telegramId = '12345';
      const adminUser = { isAdmin: true };

      mockPrisma.user.findUnique.mockResolvedValue(adminUser as any);

      const result = await UserService.isAdmin(telegramId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId },
        select: { isAdmin: true },
      });
      expect(result).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const telegramId = '12345';
      const regularUser = { isAdmin: false };

      mockPrisma.user.findUnique.mockResolvedValue(regularUser as any);

      const result = await UserService.isAdmin(telegramId);

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      const telegramId = '99999';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await UserService.isAdmin(telegramId);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const telegramId = '12345';
      const dbError = new Error('Database connection failed');
      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      const result = await UserService.isAdmin(telegramId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Error checking admin status:', dbError);
    });
  });

  describe('setAdminStatus', () => {
    it('should set admin status successfully', async () => {
      const telegramId = '12345';
      const isAdmin = true;
      const updatedUser = {
        id: 1,
        telegramId,
        isAdmin: true,
        firstName: 'Test',
        updatedAt: new Date(),
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await UserService.setAdminStatus(telegramId, isAdmin);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { telegramId },
        data: {
          isAdmin,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedUser);
      expect(logger.info).toHaveBeenCalledWith(
        `Admin status changed: ${telegramId} -> ${isAdmin}`
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90)  // active
        .mockResolvedValueOnce(5);  // admins

      const result = await UserService.getUserStats();

      expect(result).toEqual({
        total: 100,
        active: 90,
        admins: 5,
      });

      expect(mockPrisma.user.count).toHaveBeenCalledTimes(3);
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.user.count.mockRejectedValue(dbError);

      await expect(UserService.getUserStats()).rejects.toThrow('Failed to get user stats');
      expect(logger.error).toHaveBeenCalledWith('Error getting user stats:', dbError);
    });
  });
});
