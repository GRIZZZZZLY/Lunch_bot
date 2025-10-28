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
exports.GroupService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
class GroupService {
    static async upsertGroup(data) {
        try {
            const group = await client_2.prisma.group.upsert({
                where: { telegramId: BigInt(data.telegramId) },
                update: {
                    title: data.title,
                    type: data.type,
                    isActive: true,
                    updatedAt: new Date(),
                },
                create: {
                    telegramId: BigInt(data.telegramId),
                    title: data.title,
                    type: data.type,
                    isActive: true,
                },
            });
            logger_1.logger.info(`Group upserted: ${group.telegramId} (${group.title})`);
            return group;
        }
        catch (error) {
            logger_1.logger.error('Error upserting group:', error);
            throw new Error('Failed to create or update group');
        }
    }
    static async getGroupByTelegramId(telegramId) {
        try {
            return await client_2.prisma.group.findUnique({
                where: { telegramId: BigInt(telegramId) },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting group by telegram ID:', error);
            throw new Error('Failed to get group');
        }
    }
    static async getGroupById(id) {
        try {
            return await client_2.prisma.group.findUnique({
                where: { id },
                include: {
                    polls: {
                        where: { status: 'ACTIVE' },
                    },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting group by ID:', error);
            throw new Error('Failed to get group');
        }
    }
    static async updateGroup(id, data) {
        try {
            const group = await client_2.prisma.group.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Group updated: ${group.telegramId} (${group.title})`);
            return group;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Group not found');
                }
            }
            logger_1.logger.error('Error updating group:', error);
            throw new Error('Failed to update group');
        }
    }
    static async getActiveGroupPoll(groupId) {
        try {
            return await client_2.prisma.poll.findFirst({
                where: {
                    groupId,
                    status: 'ACTIVE',
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting active group poll:', error);
            throw new Error('Failed to get active poll');
        }
    }
    static async getAllGroups(limit = 50, offset = 0) {
        try {
            const [groups, total] = await Promise.all([
                client_2.prisma.group.findMany({
                    where: { isActive: true },
                    take: limit,
                    skip: offset,
                    orderBy: { createdAt: 'desc' },
                }),
                client_2.prisma.group.count({ where: { isActive: true } }),
            ]);
            return { groups, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting all groups:', error);
            throw new Error('Failed to get groups');
        }
    }
    static async getGroupStats(groupId) {
        try {
            const [totalPolls, activePolls, totalVotes] = await Promise.all([
                client_2.prisma.poll.count({ where: { groupId } }),
                client_2.prisma.poll.count({ where: { groupId, status: 'ACTIVE' } }),
                client_2.prisma.vote.count({
                    where: {
                        poll: { groupId },
                    },
                }),
            ]);
            return {
                totalPolls,
                activePolls,
                totalVotes,
                averageVotesPerPoll: totalPolls > 0 ? Math.round(totalVotes / totalPolls) : 0,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting group stats:', error);
            throw new Error('Failed to get group statistics');
        }
    }
    static async deactivateGroup(groupId) {
        try {
            const group = await client_2.prisma.group.update({
                where: { id: groupId },
                data: {
                    isActive: false,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Group deactivated: ${group.telegramId}`);
            return group;
        }
        catch (error) {
            logger_1.logger.error('Error deactivating group:', error);
            throw new Error('Failed to deactivate group');
        }
    }
    static async getRealMemberCount(groupTelegramId, bot) {
        try {
            let botInstance = bot;
            if (!botInstance) {
                try {
                    const botModule = await Promise.resolve().then(() => __importStar(require('../bot/bot')));
                    botInstance = botModule.getBotInstance?.();
                }
                catch (error) {
                    logger_1.logger.debug('Cannot import bot instance for getRealMemberCount');
                }
            }
            if (!botInstance) {
                logger_1.logger.debug('Bot instance not available for getRealMemberCount');
                return null;
            }
            const chatId = typeof groupTelegramId === 'bigint'
                ? Number(groupTelegramId)
                : parseInt(groupTelegramId.toString());
            const totalCount = await botInstance.api.getChatMemberCount(chatId);
            const realCount = Math.max(totalCount - 1, 1);
            logger_1.logger.info(`✅ Real member count for group ${groupTelegramId}: ${realCount} (total: ${totalCount})`);
            return realCount;
        }
        catch (error) {
            if (error.error_code === 403 || error.error_code === 400) {
                logger_1.logger.warn(`⚠️ Bot not in group ${groupTelegramId} or no access`);
            }
            else {
                logger_1.logger.error('Error getting real member count:', error);
            }
            return null;
        }
    }
    static async getActiveParticipants(groupId) {
        try {
            const recentPolls = await client_2.prisma.poll.findMany({
                where: {
                    groupId,
                    status: { in: ['COMPLETED', 'CANCELLED'] }
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    votes: {
                        include: {
                            user: true
                        }
                    }
                }
            });
            if (recentPolls.length === 0) {
                return 1;
            }
            const uniqueVoters = new Set();
            recentPolls.forEach(poll => {
                poll.votes.forEach(vote => {
                    uniqueVoters.add(vote.userId);
                });
            });
            const count = uniqueVoters.size;
            logger_1.logger.info(`Active participants in group ${groupId}: ${count} (excluding bots)`);
            return Math.max(count, 1);
        }
        catch (error) {
            logger_1.logger.error('Error getting active participants:', error);
            return 1;
        }
    }
    static async getGroupSettings(groupId) {
        try {
            const group = await client_2.prisma.group.findUnique({
                where: { id: groupId },
                select: { settings: true }
            });
            if (!group || !group.settings) {
                return {
                    autoCompleteEnabled: true,
                    notificationsEnabled: true,
                    progressNotifications: false,
                };
            }
            return JSON.parse(group.settings);
        }
        catch (error) {
            logger_1.logger.error('Error getting group settings:', error);
            return {
                autoCompleteEnabled: true,
                notificationsEnabled: true,
            };
        }
    }
    static async updateGroupSettings(groupId, settings) {
        try {
            const currentSettings = await this.getGroupSettings(groupId);
            const updatedSettings = {
                ...currentSettings,
                ...settings,
            };
            const group = await client_2.prisma.group.update({
                where: { id: groupId },
                data: {
                    settings: JSON.stringify(updatedSettings),
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Group settings updated: ${groupId}`, updatedSettings);
            return group;
        }
        catch (error) {
            logger_1.logger.error('Error updating group settings:', error);
            throw new Error('Failed to update group settings');
        }
    }
}
exports.GroupService = GroupService;
