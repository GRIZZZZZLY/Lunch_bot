"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
class VoteService {
    static async upsertVote(data) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: data.pollId },
                where: { status: 'ACTIVE' }, select: { id: true, status: true, endedAt: true },
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
                    updatedAt: new Date(),
                },
                create: {
                    pollId: data.pollId,
                    userId: data.userId,
                    menuItemId: data.menuItemId,
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
                where: { status: 'ACTIVE' }, select: { id: true, status: true },
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
            return votes.map(vote => ({
                id: vote.user.id,
                telegramId: vote.user.telegramId,
                firstName: vote.user.firstName,
                lastName: vote.user.lastName,
                username: vote.user.username,
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
                        poll: {
                            include: {
                                group: {
                                    select: {
                                        title: true,
                                    },
                                },
                            },
                        },
                        menuItem: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
                client_2.prisma.vote.count({ where: { userId } }),
            ]);
            return { votes: votes, total };
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
}
exports.VoteService = VoteService;
//# sourceMappingURL=vote.service.js.map