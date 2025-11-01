"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("../../services/user.service");
const avatar_service_1 = require("../../services/avatar.service");
const logger_1 = require("../../utils/logger");
class UserController {
    static async getCurrentUser(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                });
                return;
            }
            res.json({
                success: true,
                data: {
                    id: user.id,
                    telegramId: user.telegramId.toString(),
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    photoUrl: user.photoUrl,
                    isAdmin: user.isAdmin,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting current user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user info',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async getPaymentInfo(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                });
                return;
            }
            const paymentInfo = await user_service_1.UserService.getPaymentInfo(user.id);
            res.json({
                success: true,
                data: paymentInfo,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting payment info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get payment info',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async updatePaymentInfo(req, res) {
        try {
            const user = req.user;
            const { paymentCard, paymentPhone, paymentDetails } = req.body;
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                });
                return;
            }
            if (paymentCard && typeof paymentCard !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Invalid payment card format',
                    code: 'INVALID_PAYMENT_CARD',
                });
                return;
            }
            if (paymentPhone && typeof paymentPhone !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Invalid payment phone format',
                    code: 'INVALID_PAYMENT_PHONE',
                });
                return;
            }
            const updatedUser = await user_service_1.UserService.updatePaymentInfo(user.id, {
                paymentCard,
                paymentPhone,
                paymentDetails,
            });
            logger_1.logger.info(`Payment info updated for user ${user.id}`);
            res.json({
                success: true,
                data: {
                    paymentCard: updatedUser.paymentCard,
                    paymentPhone: updatedUser.paymentPhone,
                    paymentDetails: updatedUser.paymentDetails,
                },
                message: 'Payment info updated successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error updating payment info:', error);
            if (error instanceof Error && error.message === 'User not found') {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                });
                return;
            }
            res.status(500).json({
                success: false,
                error: 'Failed to update payment info',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async getUserGroups(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated',
                    code: 'NOT_AUTHENTICATED',
                });
                return;
            }
            const { prisma } = await Promise.resolve().then(() => __importStar(require('../../database/client.js')));
            const groups = await prisma.group.findMany({
                where: {
                    isActive: true,
                },
                orderBy: { createdAt: 'desc' },
            });
            logger_1.logger.info(`User ${user.id} requested groups list, found ${groups.length} groups`);
            res.json({
                success: true,
                data: groups.map(group => ({
                    id: typeof group.id === 'bigint' ? Number(group.id) : group.id,
                    title: group.title,
                    telegramId: typeof group.telegramId === 'bigint' ? group.telegramId.toString() : group.telegramId,
                    type: group.type,
                    isActive: group.isActive,
                })),
                total: groups.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user groups:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user groups',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async getUserAvatar(req, res) {
        try {
            const { userId } = req.params;
            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required',
                    code: 'INVALID_PARAMS',
                });
                return;
            }
            const user = await user_service_1.UserService.getUserById(parseInt(userId, 10));
            if (!user) {
                res.status(404).json({
                    success: false,
                    error: 'User not found',
                    code: 'USER_NOT_FOUND',
                });
                return;
            }
            const avatarUrl = await avatar_service_1.AvatarService.getUserAvatar(user.telegramId);
            res.json({
                success: true,
                data: {
                    userId: user.id,
                    telegramId: user.telegramId.toString(),
                    avatarUrl,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user avatar:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user avatar',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async getUserAvatarsBatch(req, res) {
        try {
            const { userIds } = req.body;
            if (!Array.isArray(userIds) || userIds.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'User IDs array is required',
                    code: 'INVALID_PARAMS',
                });
                return;
            }
            if (userIds.length > 100) {
                res.status(400).json({
                    success: false,
                    error: 'Maximum 100 user IDs per request',
                    code: 'TOO_MANY_IDS',
                });
                return;
            }
            const users = await Promise.all(userIds.map((id) => user_service_1.UserService.getUserById(parseInt(id, 10))));
            const validUsers = users.filter((u) => u !== null);
            const telegramIds = validUsers.map((u) => u.telegramId);
            const avatarsMap = await avatar_service_1.AvatarService.getUserAvatarsBatch(telegramIds);
            const result = validUsers.map((user) => ({
                userId: user.id,
                telegramId: user.telegramId.toString(),
                avatarUrl: avatarsMap.get(user.telegramId.toString()) || null,
            }));
            res.json({
                success: true,
                data: result,
                total: result.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user avatars batch:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user avatars',
                code: 'INTERNAL_ERROR',
            });
        }
    }
}
exports.UserController = UserController;
exports.userController = UserController;
//# sourceMappingURL=user.controller.js.map