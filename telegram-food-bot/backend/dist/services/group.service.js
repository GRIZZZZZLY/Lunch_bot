"use strict";
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
}
exports.GroupService = GroupService;
//# sourceMappingURL=group.service.js.map