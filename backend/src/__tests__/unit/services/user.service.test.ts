import { prismaMock } from '../../mocks/prisma';
import { UserService } from '../../../services/user.service';
import { User } from '@prisma/client';

// Mock prisma client
jest.mock('../../../database/client', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Import mocked prisma
import { prisma } from '../../../database/client';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const userData = {
        telegramId: '12345678',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      };

      const expectedUser: User = {
        id: 1,
        telegramId: BigInt(userData.telegramId),
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
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
      };

      (prisma.user.create as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.createUser(userData);

      // Assert
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: BigInt(userData.telegramId),
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isAdmin: false,
          isActive: true,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const userData = {
        telegramId: '12345678',
        username: 'testuser',
        firstName: 'Test',
      };

      (prisma.user.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.createUser(userData)).rejects.toThrow('Failed to create user');
    });
  });

  describe('upsertUser', () => {
    it('should update existing user', async () => {
      // Arrange
      const userData = {
        telegramId: '12345678',
        username: 'updateduser',
        firstName: 'Updated',
        lastName: 'User',
      };

      const expectedUser: User = {
        id: 1,
        telegramId: BigInt(userData.telegramId),
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        isAdmin: false,
        isActive: true,
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.user.upsert as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.upsertUser(userData);

      // Assert
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { telegramId: BigInt(userData.telegramId) },
        update: {
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          updatedAt: expect.any(Date),
        },
        create: {
          telegramId: BigInt(userData.telegramId),
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isAdmin: false,
          isActive: true,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should create new user when not exists', async () => {
      // Arrange
      const userData = {
        telegramId: '87654321',
        username: 'newuser',
        firstName: 'New',
      };

      const expectedUser: User = {
        id: 2,
        telegramId: BigInt(userData.telegramId),
        username: userData.username,
        firstName: userData.firstName,
        lastName: null,
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
      };

      (prisma.user.upsert as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.upsertUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(result.telegramId).toBe(BigInt(userData.telegramId));
    });
  });

  describe('getUserByTelegramId', () => {
    it('should return user when exists', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      const expectedUser: User = {
        id: 1,
        telegramId,
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
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.getUserByTelegramId(telegramId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const telegramId = BigInt(99999999);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await UserService.getUserByTelegramId(telegramId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user when exists', async () => {
      // Arrange
      const userId = 1;
      const expectedUser: User = {
        id: userId,
        telegramId: BigInt(12345678),
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
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.getUserById(userId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await UserService.getUserById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        username: 'updatedusername',
        firstName: 'UpdatedName',
      };

      const expectedUser: User = {
        id: userId,
        telegramId: BigInt(12345678),
        username: updateData.username,
        firstName: updateData.firstName,
        lastName: 'User',
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        isAdmin: false,
        isActive: true,
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.updateUser(userId, updateData);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999;
      const updateData = { username: 'test' };

      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      (prisma.user.update as jest.Mock).mockRejectedValue(prismaError);

      // Act & Assert
      await expect(UserService.updateUser(userId, updateData)).rejects.toThrow();
    });
  });

  describe('getAdmins', () => {
    it('should return all admin users', async () => {
      // Arrange
      const expectedAdmins: User[] = [
        {
          id: 1,
          telegramId: BigInt(12345678),
          username: 'admin1',
          firstName: 'Admin',
          lastName: 'One',
          photoUrl: null,
          avatarUrl: null,
          avatarUpdatedAt: null,
          isAdmin: true,
          isActive: true,
          paymentCard: null,
          paymentPhone: null,
          paymentDetails: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          telegramId: BigInt(87654321),
          username: 'admin2',
          firstName: 'Admin',
          lastName: 'Two',
          photoUrl: null,
          avatarUrl: null,
          avatarUpdatedAt: null,
          isAdmin: true,
          isActive: true,
          paymentCard: null,
          paymentPhone: null,
          paymentDetails: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(expectedAdmins);

      // Act
      const result = await UserService.getAdmins();

      // Assert
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { 
          isAdmin: true,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(expectedAdmins);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no admins', async () => {
      // Arrange
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await UserService.getAdmins();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('isAdmin', () => {
    it('should return true when user is admin', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ isAdmin: true });

      // Act
      const result = await UserService.isAdmin(telegramId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user is not admin', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ isAdmin: false });

      // Act
      const result = await UserService.isAdmin(telegramId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      // Arrange
      const telegramId = BigInt(99999999);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await UserService.isAdmin(telegramId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('setAdminStatus', () => {
    it('should set admin status successfully', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      const isAdmin = true;
      const expectedUser: User = {
        id: 1,
        telegramId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        isAdmin: true,
        isActive: true,
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.setAdminStatus(telegramId, isAdmin);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { telegramId: BigInt(telegramId) },
        data: {
          isAdmin,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedUser);
      expect(result.isAdmin).toBe(true);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const telegramId = BigInt(99999999);
      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      (prisma.user.update as jest.Mock).mockRejectedValue(prismaError);

      // Act & Assert
      await expect(UserService.setAdminStatus(telegramId, true)).rejects.toThrow('Failed to set admin status');
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.setAdminStatus(telegramId, false)).rejects.toThrow('Failed to set admin status');
    });
  });

  describe('setActiveStatus', () => {
    it('should set active status successfully', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      const isActive = false;
      const expectedUser: User = {
        id: 1,
        telegramId,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        isAdmin: false,
        isActive: false,
        paymentCard: null,
        paymentPhone: null,
        paymentDetails: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.setActiveStatus(telegramId, isActive);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { telegramId: BigInt(telegramId) },
        data: {
          isActive,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedUser);
      expect(result.isActive).toBe(false);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const telegramId = BigInt(99999999);
      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      (prisma.user.update as jest.Mock).mockRejectedValue(prismaError);

      // Act & Assert
      await expect(UserService.setActiveStatus(telegramId, true)).rejects.toThrow('Failed to set active status');
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const telegramId = BigInt(12345678);
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.setActiveStatus(telegramId, false)).rejects.toThrow('Failed to set active status');
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics successfully', async () => {
      // Arrange
      (prisma.user.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85)  // active
        .mockResolvedValueOnce(5);  // admins

      // Act
      const result = await UserService.getUserStats();

      // Assert
      expect(prisma.user.count).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        total: 100,
        active: 85,
        admins: 5,
      });
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      (prisma.user.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.getUserStats()).rejects.toThrow('Failed to get user stats');
    });
  });

  describe('updatePaymentInfo', () => {
    it('should update payment info successfully', async () => {
      // Arrange
      const userId = 1;
      const paymentData = {
        paymentCard: '1234-5678-9012-3456',
        paymentPhone: '+1234567890',
        paymentDetails: 'Payment details',
      };

      const expectedUser: User = {
        id: userId,
        telegramId: BigInt(12345678),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        photoUrl: null,
        avatarUrl: null,
        avatarUpdatedAt: null,
        isAdmin: false,
        isActive: true,
        paymentCard: paymentData.paymentCard,
        paymentPhone: paymentData.paymentPhone,
        paymentDetails: paymentData.paymentDetails,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(expectedUser);

      // Act
      const result = await UserService.updatePaymentInfo(userId, paymentData);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          paymentCard: paymentData.paymentCard,
          paymentPhone: paymentData.paymentPhone,
          paymentDetails: paymentData.paymentDetails,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedUser);
      expect(result.paymentCard).toBe(paymentData.paymentCard);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999;
      const paymentData = { paymentCard: '1234-5678' };
      const prismaError = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });

      (prisma.user.update as jest.Mock).mockRejectedValue(prismaError);

      // Act & Assert
      await expect(UserService.updatePaymentInfo(userId, paymentData)).rejects.toThrow('Failed to update payment info');
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const userId = 1;
      const paymentData = { paymentCard: '1234-5678' };
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.updatePaymentInfo(userId, paymentData)).rejects.toThrow('Failed to update payment info');
    });
  });

  describe('getPaymentInfo', () => {
    it('should return payment info when user exists', async () => {
      // Arrange
      const userId = 1;
      const expectedPaymentInfo = {
        paymentCard: '1234-5678-9012-3456',
        paymentPhone: '+1234567890',
        paymentDetails: 'Payment details',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(expectedPaymentInfo);

      // Act
      const result = await UserService.getPaymentInfo(userId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          paymentCard: true,
          paymentPhone: true,
          paymentDetails: true,
        },
      });
      expect(result).toEqual(expectedPaymentInfo);
    });

    it('should return null when user not found', async () => {
      // Arrange
      const userId = 999;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await UserService.getPaymentInfo(userId);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const userId = 1;
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(UserService.getPaymentInfo(userId)).rejects.toThrow('Failed to get payment info');
    });
  });
});
