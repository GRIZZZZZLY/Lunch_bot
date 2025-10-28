"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
class UserService {
    static async createUser(data) {
        try {
            const user = await client_2.prisma.user.create({
                data: {
                    telegramId: BigInt(data.telegramId),
                    username: data.username,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    isAdmin: false,
                    isActive: true,
                },
            });
            logger_1.logger.info(`User created: ${user.telegramId} (${user.firstName})`);
            return user;
        }
        catch (error) {
            logger_1.logger.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }
    static async upsertUser(data) {
        try {
            const user = await client_2.prisma.user.upsert({
                where: { telegramId: BigInt(data.telegramId) },
                update: {
                    username: data.username,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    photoUrl: data.photoUrl,
                    updatedAt: new Date(),
                },
                create: {
                    telegramId: BigInt(data.telegramId),
                    username: data.username,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    photoUrl: data.photoUrl,
                    isAdmin: false,
                    isActive: true,
                },
            });
            logger_1.logger.info(`User upserted: ${user.telegramId} (${user.firstName})${data.photoUrl ? ' with photo' : ''}`);
            return user;
        }
        catch (error) {
            logger_1.logger.error('Error upserting user:', error);
            throw new Error('Failed to create or update user');
        }
    }
    static async getUserByTelegramId(telegramId) {
        try {
            return await client_2.prisma.user.findUnique({
                where: { telegramId: BigInt(telegramId) },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user by telegram ID:', error);
            throw new Error('Failed to get user');
        }
    }
    static async getUserById(id) {
        try {
            return await client_2.prisma.user.findUnique({
                where: { id },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user by ID:', error);
            throw new Error('Failed to get user');
        }
    }
    static async updateUser(id, data) {
        try {
            const user = await client_2.prisma.user.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`User updated: ${user.telegramId} (${user.firstName})`);
            return user;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('User not found');
                }
            }
            logger_1.logger.error('Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }
    static async setAdminStatus(telegramId, isAdmin) {
        try {
            const user = await client_2.prisma.user.update({
                where: { telegramId: BigInt(telegramId) },
                data: {
                    isAdmin,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Admin status changed: ${user.telegramId} -> ${isAdmin}`);
            return user;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('User not found');
                }
            }
            logger_1.logger.error('Error setting admin status:', error);
            throw new Error('Failed to set admin status');
        }
    }
    static async isAdmin(telegramId) {
        try {
            const user = await client_2.prisma.user.findUnique({
                where: { telegramId: BigInt(telegramId) },
                select: { isAdmin: true },
            });
            return user?.isAdmin ?? false;
        }
        catch (error) {
            logger_1.logger.error('Error checking admin status:', error);
            return false;
        }
    }
    static async setActiveStatus(telegramId, isActive) {
        try {
            const user = await client_2.prisma.user.update({
                where: { telegramId: BigInt(telegramId) },
                data: {
                    isActive,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`User active status changed: ${user.telegramId} -> ${isActive}`);
            return user;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('User not found');
                }
            }
            logger_1.logger.error('Error setting active status:', error);
            throw new Error('Failed to set active status');
        }
    }
    static async getAdmins() {
        try {
            return await client_2.prisma.user.findMany({
                where: {
                    isAdmin: true,
                    isActive: true,
                },
                orderBy: { createdAt: 'asc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting admins:', error);
            throw new Error('Failed to get admins');
        }
    }
    static async getUserStats() {
        try {
            const [total, active, admins] = await Promise.all([
                client_2.prisma.user.count(),
                client_2.prisma.user.count({ where: { isActive: true } }),
                client_2.prisma.user.count({ where: { isAdmin: true, isActive: true } }),
            ]);
            return { total, active, admins };
        }
        catch (error) {
            logger_1.logger.error('Error getting user stats:', error);
            throw new Error('Failed to get user stats');
        }
    }
    async createOrUpdate(data) {
        return UserService.upsertUser(data);
    }
    async getByTelegramId(telegramId) {
        return UserService.getUserByTelegramId(telegramId);
    }
    async isAdmin(telegramId) {
        return UserService.isAdmin(telegramId);
    }
    static async updatePaymentInfo(userId, data) {
        try {
            const user = await client_2.prisma.user.update({
                where: { id: userId },
                data: {
                    paymentCard: data.paymentCard,
                    paymentPhone: data.paymentPhone,
                    paymentDetails: data.paymentDetails,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Payment info updated for user: ${user.id}`);
            return user;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('User not found');
                }
            }
            logger_1.logger.error('Error updating payment info:', error);
            throw new Error('Failed to update payment info');
        }
    }
    static async getPaymentInfo(userId) {
        try {
            const user = await client_2.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    paymentCard: true,
                    paymentPhone: true,
                    paymentDetails: true,
                },
            });
            return user;
        }
        catch (error) {
            logger_1.logger.error('Error getting payment info:', error);
            throw new Error('Failed to get payment info');
        }
    }
}
exports.UserService = UserService;
