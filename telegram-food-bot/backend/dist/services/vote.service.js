"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
const vote_types_1 = require("../types/vote.types");
class VoteService {
    static async createVote(data) {
        try {
            const vote = await client_2.prisma.vote.create({
                data: {
                    pollId: data.pollId,
                    userId: data.userId,
                    menuItemId: data.menuItemId,
                    voteType: vote_types_1.VoteType.MENU_ITEM,
                },
            });
            logger_1.logger.info(`Vote created: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`);
            return vote;
        }
        catch (error) {
            logger_1.logger.error('Error creating vote:', error);
            throw new Error('Failed to create vote');
        }
    }
    static async createVoteWithType(data) {
        try {
            const vote = await client_2.prisma.vote.create({
                data: {
                    pollId: data.pollId,
                    userId: data.userId,
                    voteType: data.voteType,
                    menuItemId: data.menuItemId,
                    customOption: data.customOption,
                },
            });
            logger_1.logger.info(`Vote created with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`);
            return vote;
        }
        catch (error) {
            logger_1.logger.error('Error creating vote with type:', error);
            throw new Error('Failed to create vote with type');
        }
    }
    static async updateVote(voteId, menuItemId) {
        try {
            const vote = await client_2.prisma.vote.update({
                where: { id: voteId },
                data: {
                    menuItemId,
                    updatedAt: new Date(),
                },
            });
            logger_1.logger.info(`Vote updated: vote ${voteId} changed to item ${menuItemId}`);
            return vote;
        }
        catch (error) {
            logger_1.logger.error('Error updating vote:', error);
            throw new Error('Failed to update vote');
        }
    }
    static async getVoteBreakdown(pollId) {
        try {
            const voteGroups = await client_2.prisma.vote.groupBy({
                by: ['menuItemId'],
                where: {
                    pollId,
                    menuItemId: { not: null },
                },
                _count: {
                    menuItemId: true,
                },
            });
            const totalVotes = voteGroups.reduce((sum, g) => sum + g._count.menuItemId, 0);
            if (voteGroups.length === 0) {
                return [];
            }
            const menuItemIds = voteGroups.map(g => g.menuItemId);
            const [menuItems, voters] = await Promise.all([
                client_2.prisma.menuItem.findMany({
                    where: { id: { in: menuItemIds } },
                    select: { id: true, name: true },
                }),
                client_2.prisma.vote.findMany({
                    where: {
                        pollId,
                        menuItemId: { in: menuItemIds },
                    },
                    select: {
                        menuItemId: true,
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                username: true,
                            },
                        },
                    },
                }),
            ]);
            const votersByMenuItem = new Map();
            voters.forEach(vote => {
                if (!vote.menuItemId)
                    return;
                const list = votersByMenuItem.get(vote.menuItemId) || [];
                list.push({
                    id: vote.user.id,
                    firstName: vote.user.firstName,
                    username: vote.user.username || undefined,
                });
                votersByMenuItem.set(vote.menuItemId, list);
            });
            return voteGroups
                .map(group => {
                const menuItem = menuItems.find(mi => mi.id === group.menuItemId);
                const voters = votersByMenuItem.get(group.menuItemId) || [];
                return {
                    menuItemId: group.menuItemId,
                    menuItemName: menuItem?.name || 'Unknown',
                    votes: group._count.menuItemId,
                    percentage: totalVotes > 0 ? Math.round((group._count.menuItemId / totalVotes) * 100) : 0,
                    voters,
                };
            })
                .sort((a, b) => b.votes - a.votes);
        }
        catch (error) {
            logger_1.logger.error('Error getting vote breakdown:', error);
            throw new Error('Failed to get vote breakdown');
        }
    }
    static async upsertVote(data) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: data.pollId },
                select: { id: true, status: true, endedAt: true },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            if (poll.status !== 'ACTIVE') {
                throw new Error('Poll is not active');
            }
            if (poll.endedAt && poll.endedAt < new Date()) {
                throw new Error('Poll has expired');
            }
            const vote = await client_2.prisma.vote.upsert({
                where: {
                    pollId_userId: {
                        pollId: data.pollId,
                        userId: data.userId,
                    },
                },
                update: {
                    menuItemId: data.menuItemId,
                    voteType: vote_types_1.VoteType.MENU_ITEM,
                    updatedAt: new Date(),
                },
                create: {
                    pollId: data.pollId,
                    userId: data.userId,
                    menuItemId: data.menuItemId,
                    voteType: vote_types_1.VoteType.MENU_ITEM,
                },
            });
            logger_1.logger.info(`Vote upserted: user ${data.userId} voted for item ${data.menuItemId} in poll ${data.pollId}`);
            return vote;
        }
        catch (error) {
            if (error instanceof Error) {
                logger_1.logger.error('Error upserting vote:', error);
                throw error;
            }
            logger_1.logger.error('Unknown error upserting vote:', error);
            throw new Error('Failed to upsert vote');
        }
    }
    static async upsertVoteWithType(data) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: data.pollId },
                select: { id: true, status: true, endedAt: true },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            if (poll.status !== 'ACTIVE') {
                throw new Error('Poll is not active');
            }
            if (poll.endedAt && poll.endedAt < new Date()) {
                throw new Error('Poll has expired');
            }
            const vote = await client_2.prisma.vote.upsert({
                where: {
                    pollId_userId: {
                        pollId: data.pollId,
                        userId: data.userId,
                    },
                },
                update: {
                    voteType: data.voteType,
                    menuItemId: data.menuItemId,
                    customOption: data.customOption,
                    updatedAt: new Date(),
                },
                create: {
                    pollId: data.pollId,
                    userId: data.userId,
                    voteType: data.voteType,
                    menuItemId: data.menuItemId,
                    customOption: data.customOption,
                },
            });
            logger_1.logger.info(`Vote upserted with type: user ${data.userId} voted ${data.voteType} in poll ${data.pollId}`);
            return vote;
        }
        catch (error) {
            if (error instanceof Error) {
                logger_1.logger.error('Error upserting vote with type:', error);
                throw error;
            }
            logger_1.logger.error('Unknown error upserting vote with type:', error);
            throw new Error('Failed to upsert vote with type');
        }
    }
    static async getVoteTypeStats(pollId) {
        try {
            const votes = await client_2.prisma.vote.findMany({
                where: { pollId },
                select: { voteType: true },
            });
            const stats = {
                menuItemVotes: 0,
                bringOwnVotes: 0,
                skipVotes: 0,
                total: votes.length,
            };
            votes.forEach(vote => {
                switch (vote.voteType) {
                    case vote_types_1.VoteType.MENU_ITEM:
                        stats.menuItemVotes++;
                        break;
                    case vote_types_1.VoteType.BRING_OWN:
                        stats.bringOwnVotes++;
                        break;
                    case vote_types_1.VoteType.SKIP:
                        stats.skipVotes++;
                        break;
                }
            });
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting vote type stats:', error);
            throw new Error('Failed to get vote type stats');
        }
    }
    static async getUserVoteInPoll(pollId, userId) {
        try {
            return await client_2.prisma.vote.findUnique({
                where: {
                    pollId_userId: {
                        pollId,
                        userId,
                    },
                },
                include: {
                    menuItem: true,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user vote in poll:', error);
            throw new Error('Failed to get user vote');
        }
    }
    static async removeVote(pollId, userId) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: pollId },
                select: { id: true, status: true },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            if (poll.status !== 'ACTIVE') {
                throw new Error('Poll is not active');
            }
            await client_2.prisma.vote.delete({
                where: {
                    pollId_userId: {
                        pollId,
                        userId,
                    },
                },
            });
            logger_1.logger.info(`Vote removed: user ${userId} from poll ${pollId}`);
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Vote not found');
                }
            }
            logger_1.logger.error('Error removing vote:', error);
            throw new Error('Failed to remove vote');
        }
    }
    static async getPollVotes(pollId) {
        try {
            return await client_2.prisma.vote.findMany({
                where: { pollId },
                include: {
                    user: true,
                    menuItem: true,
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll votes:', error);
            throw new Error('Failed to get poll votes');
        }
    }
    static async getVoteCountByMenuItem(pollId) {
        try {
            const votes = await client_2.prisma.vote.findMany({
                where: { pollId },
                include: {
                    menuItem: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            const voteCount = new Map();
            votes.forEach(vote => {
                if (!vote.menuItemId || !vote.menuItem)
                    return;
                const existing = voteCount.get(vote.menuItemId) || {
                    name: vote.menuItem.name,
                    count: 0
                };
                voteCount.set(vote.menuItemId, {
                    name: existing.name,
                    count: existing.count + 1
                });
            });
            return Array.from(voteCount.entries())
                .map(([menuItemId, data]) => ({
                menuItemId,
                menuItemName: data.name,
                votes: data.count,
            }))
                .sort((a, b) => b.votes - a.votes);
        }
        catch (error) {
            logger_1.logger.error('Error getting vote count by menu item:', error);
            throw new Error('Failed to get vote count by menu item');
        }
    }
    static async getPollVoters(pollId) {
        try {
            const votes = await client_2.prisma.vote.findMany({
                where: { pollId },
                include: {
                    user: true,
                    menuItem: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return votes
                .filter(vote => vote.menuItem)
                .map(vote => ({
                id: vote.user.id,
                telegramId: vote.user.telegramId,
                firstName: vote.user.firstName,
                lastName: vote.user.lastName || undefined,
                username: vote.user.username || undefined,
                votedFor: vote.menuItem.name,
                votedAt: vote.createdAt,
            }));
        }
        catch (error) {
            logger_1.logger.error('Error getting poll voters:', error);
            throw new Error('Failed to get poll voters');
        }
    }
    static async hasUserVoted(pollId, userId) {
        try {
            const vote = await client_2.prisma.vote.findUnique({
                where: {
                    pollId_userId: {
                        pollId,
                        userId,
                    },
                },
            });
            return vote !== null;
        }
        catch (error) {
            logger_1.logger.error('Error checking if user voted:', error);
            return false;
        }
    }
    static async getUserVoteStats(userId) {
        try {
            const [totalVotes, votes] = await Promise.all([
                client_2.prisma.vote.count({ where: { userId } }),
                client_2.prisma.vote.findMany({
                    where: { userId },
                    include: {
                        menuItem: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            ]);
            const pollsParticipated = new Set(votes.map(v => v.pollId)).size;
            const menuItemCount = new Map();
            votes.forEach(vote => {
                if (!vote.menuItem)
                    return;
                const name = vote.menuItem.name;
                menuItemCount.set(name, (menuItemCount.get(name) || 0) + 1);
            });
            const favoriteMenuItems = Array.from(menuItemCount.entries())
                .map(([name, votes]) => ({ name, votes }))
                .sort((a, b) => b.votes - a.votes)
                .slice(0, 5);
            const lastVoteDate = votes.length > 0 ? votes[0].createdAt : undefined;
            return {
                totalVotes,
                pollsParticipated,
                favoriteMenuItems,
                lastVoteDate,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting user vote stats:', error);
            throw new Error('Failed to get user vote stats');
        }
    }
    static async getUserVotes(userId, limit = 20, offset = 0) {
        try {
            const [votes, total] = await Promise.all([
                client_2.prisma.vote.findMany({
                    where: { userId },
                    include: {
                        user: true,
                        menuItem: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
                client_2.prisma.vote.count({ where: { userId } }),
            ]);
            return { votes, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting user votes:', error);
            throw new Error('Failed to get user votes');
        }
    }
    static async removeExpiredVotes(pollIds) {
        try {
            if (pollIds.length === 0) {
                return 0;
            }
            const result = await client_2.prisma.vote.deleteMany({
                where: {
                    pollId: {
                        in: pollIds,
                    },
                    poll: {
                        status: 'COMPLETED',
                        createdAt: {
                            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
            });
            logger_1.logger.info(`Removed ${result.count} expired votes from ${pollIds.length} polls`);
            return result.count;
        }
        catch (error) {
            logger_1.logger.error('Error removing expired votes:', error);
            throw new Error('Failed to remove expired votes');
        }
    }
    static async getTopMenuItemsByVotes(days = 30, limit = 10, groupId) {
        try {
            const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const votes = await client_2.prisma.vote.findMany({
                where: {
                    createdAt: {
                        gte: dateFrom,
                    },
                    ...(groupId && {
                        poll: {
                            groupId,
                        },
                    }),
                },
                include: {
                    menuItem: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            const stats = new Map();
            votes.forEach(vote => {
                if (!vote.menuItemId || !vote.menuItem)
                    return;
                const existing = stats.get(vote.menuItemId) || {
                    name: vote.menuItem.name,
                    votes: 0,
                    voters: new Set(),
                };
                existing.votes++;
                existing.voters.add(vote.userId);
                stats.set(vote.menuItemId, existing);
            });
            return Array.from(stats.entries())
                .map(([menuItemId, data]) => ({
                menuItemId,
                menuItemName: data.name,
                totalVotes: data.votes,
                uniqueVoters: data.voters.size,
            }))
                .sort((a, b) => b.totalVotes - a.totalVotes)
                .slice(0, limit);
        }
        catch (error) {
            logger_1.logger.error('Error getting top menu items by votes:', error);
            throw new Error('Failed to get top menu items by votes');
        }
    }
    static async getVoters(pollId) {
        try {
            const votes = await client_2.prisma.vote.findMany({
                where: { pollId },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            username: true,
                        },
                    },
                    menuItem: {
                        select: {
                            name: true,
                        },
                    },
                },
            });
            return votes
                .filter(vote => vote.menuItem)
                .map(vote => ({
                userId: vote.user.id,
                userName: vote.user.firstName + (vote.user.lastName ? ` ${vote.user.lastName}` : ''),
                menuItemName: vote.menuItem.name,
            }));
        }
        catch (error) {
            logger_1.logger.error('Error getting voters:', error);
            throw new Error('Failed to get voters');
        }
    }
    static async getMostPopularMenuItem(pollId) {
        try {
            const votes = await client_2.prisma.vote.findMany({
                where: { pollId },
                include: {
                    menuItem: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            if (votes.length === 0) {
                return null;
            }
            const voteCount = new Map();
            votes.forEach(vote => {
                if (!vote.menuItemId || !vote.menuItem)
                    return;
                const existing = voteCount.get(vote.menuItemId) || { name: vote.menuItem.name, count: 0 };
                existing.count++;
                voteCount.set(vote.menuItemId, existing);
            });
            let maxVotes = 0;
            let mostPopular = null;
            voteCount.forEach((data, menuItemId) => {
                if (data.count > maxVotes) {
                    maxVotes = data.count;
                    mostPopular = {
                        menuItemId,
                        menuItemName: data.name,
                        votes: data.count,
                    };
                }
            });
            return mostPopular;
        }
        catch (error) {
            logger_1.logger.error('Error getting most popular menu item:', error);
            throw new Error('Failed to get most popular menu item');
        }
    }
}
exports.VoteService = VoteService;
//# sourceMappingURL=vote.service.js.map