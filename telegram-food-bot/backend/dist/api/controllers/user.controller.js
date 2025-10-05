"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("../../services/user.service");
const group_service_1 = require("../../services/group.service");
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
            const { groups, total } = await group_service_1.GroupService.getAllGroups();
            res.json({
                success: true,
                data: groups.map(group => ({
                    id: typeof group.id === 'bigint' ? Number(group.id) : group.id,
                    title: group.title,
                    telegramId: typeof group.telegramId === 'bigint' ? group.telegramId.toString() : group.telegramId,
                    type: group.type,
                    isActive: group.isActive,
                })),
                total,
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
}
exports.UserController = UserController;
exports.userController = UserController;
//# sourceMappingURL=user.controller.js.map