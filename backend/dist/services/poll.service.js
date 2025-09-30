"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollService = void 0;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
class PollService {
    static async createPoll(data) {
        try {
            const poll = await client_2.prisma.poll.create({
                data: {
                    groupId: data.groupId,
                    status: 'ACTIVE',
                    duration: data.duration || 30,
                    createdBy: data.createdBy,
                },
            });
            logger_1.logger.info(`Poll created: ${poll.id} in group ${poll.groupId}`);
            return poll;
        }
        catch (error) {
            logger_1.logger.error('Error creating poll:', error);
            throw new Error('Failed to create poll');
        }
    }
    static async getPollById(id) {
        try {
            return await client_2.prisma.poll.findUnique({
                where: { id },
                include: {
                    group: true,
                    votes: {
                        include: {
                            user: true,
                            menuItem: true,
                        },
                    },
                    result: {
                        include: {
                            winnerMenuItem: true,
                            responsibleUser: true,
                        },
                    },
                    _count: {
                        select: {
                            votes: true,
                        },
                    },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll by ID:', error);
            throw new Error('Failed to get poll');
        }
    }
    static async getActivePollInGroup(groupId) {
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
            logger_1.logger.error('Error getting active poll in group:', error);
            throw new Error('Failed to get active poll');
        }
    }
    static async getActivePolls() {
        try {
            return await client_2.prisma.poll.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    group: true,
                    _count: {
                        select: {
                            votes: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting active polls:', error);
            throw new Error('Failed to get active polls');
        }
    }
    static async completePoll(pollId) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    votes: {
                        include: {
                            menuItem: true,
                            user: true,
                        },
                    },
                },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            if (poll.status !== 'ACTIVE') {
                throw new Error('Poll is already completed');
            }
            const voteCount = new Map();
            poll.votes.forEach(vote => {
                const current = voteCount.get(vote.menuItemId) || { count: 0, menuItem: vote.menuItem };
                voteCount.set(vote.menuItemId, { count: current.count + 1, menuItem: vote.menuItem });
            });
            let winnerMenuItemId = null;
            let maxVotes = 0;
            for (const [itemId, data] of voteCount.entries()) {
                if (data.count > maxVotes) {
                    maxVotes = data.count;
                    winnerMenuItemId = itemId;
                }
            }
            const result = await client_2.prisma.$transaction(async (tx) => {
                await tx.poll.update({
                    where: { id: pollId },
                    data: {
                        status: 'COMPLETED',
                        endedAt: new Date()
                    },
                });
                const pollResult = await tx.pollResult.create({
                    data: {
                        pollId,
                        winnerMenuItemId,
                        totalVotes: poll.votes.length,
                    },
                });
                return pollResult;
            });
            logger_1.logger.info(`Poll completed: ${pollId}, winner: ${winnerMenuItemId}, total votes: ${poll.votes.length}`);
            return await this.getPollResult(result.id);
        }
        catch (error) {
            if (error instanceof Error) {
                logger_1.logger.error('Error completing poll:', error);
                throw error;
            }
            logger_1.logger.error('Unknown error completing poll:', error);
            throw new Error('Failed to complete poll');
        }
    }
    static async cancelPoll(pollId) {
        try {
            const poll = await client_2.prisma.poll.update({
                where: { id: pollId },
                data: { status: 'COMPLETED' },
            });
            logger_1.logger.info(`Poll cancelled: ${pollId}`);
            return poll;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Poll not found');
                }
            }
            logger_1.logger.error('Error cancelling poll:', error);
            throw new Error('Failed to cancel poll');
        }
    }
    static async getPollResult(resultId) {
        try {
            const result = await client_2.prisma.pollResult.findUnique({
                where: { id: resultId },
                include: {
                    poll: {
                        include: {
                            group: true,
                            votes: {
                                include: {
                                    user: true,
                                    menuItem: true,
                                },
                            },
                        },
                    },
                    winnerMenuItem: true,
                    responsibleUser: true,
                },
            });
            if (!result) {
                throw new Error('Poll result not found');
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error getting poll result:', error);
            throw new Error('Failed to get poll result');
        }
    }
    static async getPollResultByPollId(pollId) {
        try {
            return await client_2.prisma.pollResult.findUnique({
                where: { pollId },
                include: {
                    poll: {
                        include: {
                            group: true,
                        },
                    },
                    winnerMenuItem: true,
                    responsibleUser: true,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll result by poll ID:', error);
            throw new Error('Failed to get poll result');
        }
    }
    static async runRoulette(pollId) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    votes: {
                        include: {
                            user: true,
                        },
                    },
                },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            const voters = Array.from(new Map(poll.votes.map(vote => [vote.userId, vote.user])).values());
            if (voters.length === 0) {
                throw new Error('No voters found');
            }
            const randomIndex = Math.floor(Math.random() * voters.length);
            const responsibleUser = voters[randomIndex];
            const result = await client_2.prisma.pollResult.update({
                where: { pollId },
                data: {
                    responsibleUserId: responsibleUser.id,
                },
                include: {
                    poll: {
                        include: {
                            group: true,
                        },
                    },
                    winnerMenuItem: true,
                    responsibleUser: true,
                },
            });
            logger_1.logger.info(`Roulette completed for poll ${pollId}: selected user ${responsibleUser.id} (${responsibleUser.firstName})`);
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                logger_1.logger.error('Error running roulette:', error);
                throw error;
            }
            logger_1.logger.error('Unknown error running roulette:', error);
            throw new Error('Failed to run roulette');
        }
    }
    static async getPollHistory(groupId, limit = 20, offset = 0) {
        try {
            const where = {
                status: 'COMPLETED',
                ...(groupId && { groupId }),
            };
            const [polls, total] = await Promise.all([
                client_2.prisma.poll.findMany({
                    where,
                    include: {
                        group: true,
                        result: {
                            include: {
                                winnerMenuItem: true,
                                responsibleUser: true,
                            },
                        },
                        _count: {
                            select: {
                                votes: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    skip: offset,
                }),
                client_2.prisma.poll.count({ where }),
            ]);
            return { polls, total };
        }
        catch (error) {
            logger_1.logger.error('Error getting poll history:', error);
            throw new Error('Failed to get poll history');
        }
    }
    static async getPollStats(groupId) {
        try {
            const where = groupId ? { groupId } : {};
            const [totalPolls, activePolls, completedPolls, totalVotes] = await Promise.all([
                client_2.prisma.poll.count({ where }),
                client_2.prisma.poll.count({ where: { ...where, status: 'ACTIVE' } }),
                client_2.prisma.poll.count({ where: { ...where, status: 'COMPLETED' } }),
                client_2.prisma.vote.count({
                    where: groupId ? {
                        poll: { groupId }
                    } : undefined
                }),
            ]);
            const avgParticipants = await client_2.prisma.poll.aggregate({
                where: { ...where, status: 'COMPLETED' },
                _avg: {
                    id: true,
                },
            });
            const pollsWithVoteCounts = await client_2.prisma.poll.findMany({
                where: { ...where, status: 'COMPLETED' },
                include: {
                    _count: {
                        select: {
                            votes: true,
                        },
                    },
                },
            });
            const averageParticipants = completedPolls > 0
                ? Math.round(pollsWithVoteCounts.reduce((sum, poll) => sum + poll._count.votes, 0) / completedPolls * 100) / 100
                : 0;
            return {
                totalPolls,
                activePolls,
                completedPolls,
                totalVotes,
                averageParticipants,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting poll stats:', error);
            throw new Error('Failed to get poll stats');
        }
    }
    static async getExpiredPolls() {
        try {
            return await client_2.prisma.poll.findMany({
                where: {
                    status: 'ACTIVE',
                    startedAt: { lte: new Date(Date.now() - 30 * 60 * 1000) },
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting expired polls:', error);
            throw new Error('Failed to get expired polls');
        }
    }
    static async getPollVoteBreakdown(pollId) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    votes: {
                        include: {
                            user: true,
                            menuItem: true,
                        },
                    },
                },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            const totalVotes = poll.votes.length;
            const breakdown = new Map();
            poll.votes.forEach(vote => {
                const key = vote.menuItemId;
                const existing = breakdown.get(key) || {
                    menuItemId: vote.menuItemId,
                    menuItemName: vote.menuItem.name,
                    votes: 0,
                    voters: [],
                };
                existing.votes += 1;
                existing.voters.push({
                    id: vote.user.id,
                    firstName: vote.user.firstName,
                    username: vote.user.username,
                });
                breakdown.set(key, existing);
            });
            return Array.from(breakdown.values()).map(item => ({
                ...item,
                percentage: totalVotes > 0 ? Math.round((item.votes / totalVotes) * 100) : 0,
            })).sort((a, b) => b.votes - a.votes);
        }
        catch (error) {
            logger_1.logger.error('Error getting poll vote breakdown:', error);
            throw new Error('Failed to get poll vote breakdown');
        }
    }
}
exports.PollService = PollService;
//# sourceMappingURL=poll.service.js.map