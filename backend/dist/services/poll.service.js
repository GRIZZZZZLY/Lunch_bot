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
exports.PollService = void 0;
exports.initializePollServiceBot = initializePollServiceBot;
const client_1 = require("@prisma/client");
const client_2 = require("../database/client");
const logger_1 = require("../utils/logger");
const group_service_1 = require("./group.service");
const cache_service_1 = require("./cache.service");
let botInstance = null;
function initializePollServiceBot(bot) {
    botInstance = bot;
    logger_1.logger.info('PollService bot instance initialized');
}
const memberCountCache = new Map();
const MEMBER_COUNT_CACHE_TTL = 2 * 60 * 60 * 1000;
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
            cache_service_1.CacheInvalidator.invalidatePoll(poll.id, poll.groupId);
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
            return await cache_service_1.cacheService.getOrSet(cache_service_1.CACHE_KEYS.ACTIVE_POLLS_GROUP(groupId), async () => {
                return await client_2.prisma.poll.findFirst({
                    where: {
                        groupId,
                        status: 'ACTIVE',
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
            }, cache_service_1.CACHE_TTL.ACTIVE_POLLS);
        }
        catch (error) {
            logger_1.logger.error('Error getting active poll in group:', error);
            throw new Error('Failed to get active poll');
        }
    }
    static async getActivePolls() {
        try {
            logger_1.logger.info('🔍 Fetching active polls...');
            const polls = await client_2.prisma.poll.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    group: true,
                    votes: {
                        include: {
                            user: true,
                            menuItem: true,
                        },
                    },
                    _count: {
                        select: {
                            votes: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            logger_1.logger.info(`📊 Found ${polls.length} polls with ACTIVE status`);
            const now = new Date();
            const activePolls = [];
            const expiredPollIds = [];
            for (const poll of polls) {
                const endsAt = poll.endedAt || new Date(poll.startedAt.getTime() + poll.duration * 60 * 1000);
                const isActive = endsAt > now;
                logger_1.logger.info(`Poll ${poll.id}: ends=${endsAt.toISOString()}, now=${now.toISOString()}, active=${isActive}`);
                if (isActive) {
                    activePolls.push(poll);
                }
                else {
                    expiredPollIds.push(poll.id);
                    logger_1.logger.info(`⏰ Poll ${poll.id} expired, auto-closing...`);
                }
            }
            if (expiredPollIds.length > 0) {
                client_2.prisma.poll.updateMany({
                    where: { id: { in: expiredPollIds } },
                    data: {
                        status: 'COMPLETED',
                        endedAt: now
                    }
                }).then(() => {
                    logger_1.logger.info(`✅ Auto-closed ${expiredPollIds.length} expired polls: ${expiredPollIds.join(', ')}`);
                }).catch((err) => {
                    logger_1.logger.error(`❌ Failed to auto-close expired polls:`, err);
                });
            }
            logger_1.logger.info(`✅ Returning ${activePolls.length} active polls`);
            const serializedPolls = activePolls.map(poll => ({
                ...poll,
                chatId: poll.chatId ? poll.chatId.toString() : null,
            }));
            return serializedPolls;
        }
        catch (error) {
            logger_1.logger.error('❌ Error getting active polls:', {
                message: error.message,
                stack: error.stack,
            });
            throw error;
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
                if (!vote.menuItemId || !vote.menuItem)
                    return;
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
                        responsibleUserId: poll.createdBy,
                    },
                });
                return pollResult;
            });
            cache_service_1.CacheInvalidator.invalidatePoll(pollId, poll.groupId);
            logger_1.logger.info(`Poll completed: ${pollId}, winner: ${winnerMenuItemId}, total votes: ${poll.votes.length}`);
            try {
                const { notificationService } = await Promise.resolve().then(() => __importStar(require('./notification.service.js')));
                await notificationService.sendPollCompletionNotifications(pollId);
                logger_1.logger.info(`Completion notifications sent for poll ${pollId}`);
            }
            catch (notifError) {
                logger_1.logger.error('Error sending completion notifications:', notifError);
            }
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
    static async cancelPoll(pollId, cancelledBy, reason) {
        try {
            const poll = await client_2.prisma.poll.update({
                where: { id: pollId },
                data: {
                    status: 'CANCELLED',
                    endedAt: new Date()
                },
            });
            const user = await client_2.prisma.user.findUnique({
                where: { id: cancelledBy }
            });
            if (user) {
                const { notificationService } = await Promise.resolve().then(() => __importStar(require('./notification.service.js')));
                await notificationService.sendPollCancelledNotifications(pollId, user, reason);
            }
            logger_1.logger.info(`Poll cancelled: ${pollId} by user ${cancelledBy}`, { reason });
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
    static async updatePoll(pollId, data) {
        try {
            const poll = await client_2.prisma.poll.update({
                where: { id: pollId },
                data,
            });
            logger_1.logger.info(`Poll updated: ${pollId}`);
            return poll;
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new Error('Poll not found');
                }
            }
            logger_1.logger.error('Error updating poll:', error);
            throw new Error('Failed to update poll');
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
            if (error instanceof Error && error.message === 'Poll result not found') {
                throw error;
            }
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
                    select: {
                        id: true,
                        groupId: true,
                        status: true,
                        duration: true,
                        startedAt: true,
                        endedAt: true,
                        createdBy: true,
                        messageId: true,
                        chatId: true,
                        createdAt: true,
                        updatedAt: true,
                        group: {
                            select: {
                                id: true,
                                title: true,
                                telegramId: true,
                            },
                        },
                        result: {
                            select: {
                                id: true,
                                totalVotes: true,
                                createdAt: true,
                                winnerMenuItem: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        imageUrl: true,
                                    },
                                },
                                responsibleUser: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        username: true,
                                        telegramId: true,
                                    },
                                },
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
    static async getLastCompletedPoll(groupId) {
        try {
            const where = {
                status: 'COMPLETED',
                ...(groupId && { groupId }),
            };
            const poll = await client_2.prisma.poll.findFirst({
                where,
                orderBy: { endedAt: 'desc' },
                include: {
                    group: true,
                },
            });
            return poll;
        }
        catch (error) {
            logger_1.logger.error('Error getting last completed poll:', error);
            throw error;
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
    static async getUserParticipationStats(userId) {
        try {
            const totalVotes = await client_2.prisma.vote.count({
                where: { userId }
            });
            const totalPolls = await client_2.prisma.poll.count({
                where: { status: 'COMPLETED' }
            });
            const participationRate = totalPolls > 0
                ? Math.round((totalVotes / totalPolls) * 100)
                : 0;
            const votesByItem = await client_2.prisma.vote.groupBy({
                by: ['menuItemId'],
                where: { userId, menuItemId: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            });
            const menuItemIds = votesByItem
                .map(v => v.menuItemId)
                .filter((id) => id !== null);
            const menuItems = await client_2.prisma.menuItem.findMany({
                where: { id: { in: menuItemIds } }
            });
            const favoriteItems = votesByItem.map(vote => {
                const item = menuItems.find(m => m.id === vote.menuItemId);
                return {
                    itemId: vote.menuItemId,
                    itemName: item?.name || 'Unknown',
                    voteCount: vote._count.id,
                    percentage: totalVotes > 0
                        ? Math.round((vote._count.id / totalVotes) * 100)
                        : 0
                };
            });
            const recentVotes = await client_2.prisma.vote.findMany({
                where: { userId },
                include: {
                    poll: { select: { id: true } },
                    menuItem: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            const recentActivity = recentVotes.map(vote => ({
                pollId: vote.pollId,
                pollTitle: 'Голосование на обед',
                votedAt: vote.createdAt.toISOString(),
                itemName: vote.menuItem?.name || 'Unknown'
            }));
            return {
                totalVotes,
                totalPolls,
                participationRate,
                favoriteItems,
                recentActivity
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting user participation stats:', error);
            throw new Error('Failed to get user participation stats');
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
                if (!vote.menuItemId || !vote.menuItem)
                    return;
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
            if (error instanceof Error && error.message === 'Poll not found') {
                throw error;
            }
            logger_1.logger.error('Error getting poll vote breakdown:', error);
            throw new Error('Failed to get poll vote breakdown');
        }
    }
    static async savePollResult(data) {
        try {
            const existing = await client_2.prisma.pollResult.findUnique({
                where: { pollId: data.pollId },
            });
            if (existing) {
                const result = await client_2.prisma.pollResult.update({
                    where: { pollId: data.pollId },
                    data: {
                        responsibleUserId: data.responsibleUserId,
                        rouletteData: data.rouletteData,
                    },
                    include: {
                        poll: true,
                        winnerMenuItem: true,
                        responsibleUser: true,
                    },
                });
                logger_1.logger.info(`Poll result updated for poll ${data.pollId}`);
                return result;
            }
            else {
                const result = await client_2.prisma.pollResult.create({
                    data: {
                        pollId: data.pollId,
                        winnerMenuItemId: data.winnerMenuItemId,
                        responsibleUserId: data.responsibleUserId,
                        totalVotes: data.totalVotes,
                    },
                    include: {
                        poll: true,
                        winnerMenuItem: true,
                        responsibleUser: true,
                    },
                });
                logger_1.logger.info(`Poll result created for poll ${data.pollId}`);
                return result;
            }
        }
        catch (error) {
            logger_1.logger.error('Error saving poll result:', error);
            throw new Error('Failed to save poll result');
        }
    }
    static async completePollMultiWinner(pollId, completedBy, options) {
        const { minVotes = 1, maxWinners = null, tieBreakMethod = 'earliest' } = options || {};
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
                    group: true,
                },
            });
            if (!poll) {
                throw new Error('Poll not found');
            }
            if (poll.status === 'COMPLETED') {
                const existingResult = await client_2.prisma.pollResult.findUnique({
                    where: { pollId },
                    include: {
                        winnerMenuItem: true,
                        responsibleUser: true,
                    },
                });
                if (existingResult) {
                    logger_1.logger.info(`Poll ${pollId} already completed, returning existing result`);
                    return existingResult;
                }
            }
            if (poll.status !== 'ACTIVE') {
                throw new Error('Poll is not active');
            }
            const menuItemVotes = new Map();
            const bringOwnVotes = [];
            const skippedVotes = [];
            poll.votes.forEach(vote => {
                if (vote.voteType === 'MENU_ITEM' && vote.menuItemId && vote.menuItem) {
                    if (!menuItemVotes.has(vote.menuItemId)) {
                        menuItemVotes.set(vote.menuItemId, []);
                    }
                    menuItemVotes.get(vote.menuItemId).push(vote);
                }
                else if (vote.voteType === 'BRING_OWN') {
                    bringOwnVotes.push(vote);
                }
                else if (vote.voteType === 'SKIP') {
                    skippedVotes.push(vote);
                }
            });
            let winners = Array.from(menuItemVotes.entries())
                .filter(([_, votes]) => votes.length >= minVotes)
                .map(([itemId, votes]) => {
                const menuItem = votes[0].menuItem;
                return {
                    menuItemId: itemId,
                    menuItemName: menuItem.name,
                    menuItemSnapshot: {
                        price: menuItem.price ?? undefined,
                        category: menuItem.category ?? undefined,
                        imageUrl: menuItem.imageUrl ?? undefined,
                    },
                    voterIds: votes.map(v => v.userId),
                    voters: votes.map(v => ({
                        userId: v.user.id,
                        firstName: v.user.firstName,
                        lastName: v.user.lastName ?? undefined,
                        username: v.user.username ?? undefined,
                    })),
                    voteCount: votes.length,
                    votedAt: votes.map(v => v.createdAt.toISOString()),
                };
            })
                .sort((a, b) => b.voteCount - a.voteCount);
            if (maxWinners && maxWinners > 0) {
                winners = winners.slice(0, maxWinners);
            }
            let primaryWinnerId = null;
            let tieBreak = undefined;
            if (winners.length > 0) {
                const maxVotes = winners[0].voteCount;
                const topWinners = winners.filter(w => w.voteCount === maxVotes);
                if (topWinners.length === 1) {
                    primaryWinnerId = topWinners[0].menuItemId;
                }
                else {
                    if (tieBreakMethod === 'earliest') {
                        const earliest = topWinners.reduce((prev, curr) => {
                            const prevTime = new Date(prev.votedAt[0]).getTime();
                            const currTime = new Date(curr.votedAt[0]).getTime();
                            return currTime < prevTime ? curr : prev;
                        });
                        primaryWinnerId = earliest.menuItemId;
                    }
                    else if (tieBreakMethod === 'alphabetical') {
                        const sorted = [...topWinners].sort((a, b) => a.menuItemName.localeCompare(b.menuItemName, 'ru'));
                        primaryWinnerId = sorted[0].menuItemId;
                    }
                    tieBreak = {
                        method: tieBreakMethod,
                        appliedTo: topWinners.map(w => w.menuItemId),
                        reason: `${topWinners.length} блюд с ${maxVotes} голосами`,
                    };
                    logger_1.logger.info(`Tie-break applied for poll ${pollId}`, {
                        method: tieBreakMethod,
                        topWinners: topWinners.map(w => ({ id: w.menuItemId, name: w.menuItemName })),
                        selected: primaryWinnerId,
                    });
                }
            }
            const bringOwnGroup = {
                voterIds: bringOwnVotes.map(v => v.userId),
                voters: bringOwnVotes.map(v => ({
                    userId: v.user.id,
                    firstName: v.user.firstName,
                    lastName: v.user.lastName ?? undefined,
                    username: v.user.username ?? undefined,
                })),
                count: bringOwnVotes.length,
            };
            const skippedGroup = {
                voterIds: skippedVotes.map(v => v.userId),
                voters: skippedVotes.map(v => ({
                    userId: v.user.id,
                    firstName: v.user.firstName,
                    lastName: v.user.lastName ?? undefined,
                    username: v.user.username ?? undefined,
                })),
                count: skippedVotes.length,
            };
            const resultData = {
                version: 1,
                mode: 'multi-winner',
                winners,
                bringOwn: bringOwnGroup,
                skipped: skippedGroup,
                meta: {
                    primaryWinnerId,
                    tieBreak,
                    completedAt: new Date().toISOString(),
                    completedBy,
                    params: { minVotes, maxWinners },
                },
            };
            const result = await client_2.prisma.$transaction(async (tx) => {
                await tx.poll.update({
                    where: { id: pollId },
                    data: {
                        status: 'COMPLETED',
                        endedAt: new Date(),
                    },
                });
                return await tx.pollResult.create({
                    data: {
                        pollId,
                        winnerMenuItemId: primaryWinnerId,
                        totalVotes: poll.votes.length,
                        responsibleUserId: completedBy,
                        rouletteData: JSON.stringify(resultData),
                    },
                    include: {
                        winnerMenuItem: true,
                        responsibleUser: true,
                    },
                });
            });
            cache_service_1.CacheInvalidator.invalidatePoll(pollId, poll.groupId);
            logger_1.logger.info(`Poll ${pollId} completed with multi-winner mode`, {
                winnersCount: winners.length,
                bringOwnCount: bringOwnVotes.length,
                skippedCount: skippedVotes.length,
                primaryWinnerId,
                totalVotes: poll.votes.length,
            });
            try {
                const { notificationService } = await Promise.resolve().then(() => __importStar(require('./notification.service.js')));
                await notificationService.sendPollCompletionNotifications(pollId);
                logger_1.logger.info(`Completion notifications sent for poll ${pollId} (multi-winner)`);
            }
            catch (notifError) {
                logger_1.logger.error('Error sending completion notifications:', notifError);
            }
            try {
                const { ResponsibleService } = await Promise.resolve().then(() => __importStar(require('./responsible.service.js')));
                await ResponsibleService.startResponsibleSelection(pollId);
                logger_1.logger.info(`Responsible selection started for poll ${pollId}`);
            }
            catch (responsibleError) {
                logger_1.logger.error('Error starting responsible selection:', responsibleError);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error completing poll with multi-winner:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to complete poll with multi-winner mode');
        }
    }
    static async getExpectedParticipants(groupId, groupTelegramId, settings) {
        const now = Date.now();
        const cached = memberCountCache.get(groupId);
        if (cached && (now - cached.timestamp) < MEMBER_COUNT_CACHE_TTL) {
            logger_1.logger.debug(`Using cached member count for group ${groupId}: ${cached.count} (${cached.source})`);
            return { count: cached.count, source: `cached_${cached.source}` };
        }
        const realCount = await group_service_1.GroupService.getRealMemberCount(groupTelegramId.toString(), botInstance);
        if (realCount !== null) {
            memberCountCache.set(groupId, {
                count: realCount,
                timestamp: now,
                source: 'telegram_api'
            });
            logger_1.logger.info(`📊 Updated member count for group ${groupId}: ${realCount} (from Telegram API)`);
            group_service_1.GroupService.updateGroupSettings(groupId, {
                ...settings,
                expectedParticipants: realCount
            }).catch(err => logger_1.logger.error('Error saving expectedParticipants:', err));
            return { count: realCount, source: 'telegram_api' };
        }
        let fallbackCount;
        let fallbackSource;
        if (settings.expectedParticipants) {
            fallbackCount = settings.expectedParticipants;
            fallbackSource = 'settings';
        }
        else {
            fallbackCount = await group_service_1.GroupService.getActiveParticipants(groupId);
            fallbackSource = 'history';
        }
        memberCountCache.set(groupId, {
            count: fallbackCount,
            timestamp: now,
            source: 'history'
        });
        logger_1.logger.warn(`⚠️ Using fallback member count for group ${groupId}: ${fallbackCount} (${fallbackSource})`);
        return { count: fallbackCount, source: fallbackSource };
    }
    static async checkAutoComplete(pollId) {
        try {
            const poll = await client_2.prisma.poll.findUnique({
                where: { id: pollId },
                include: {
                    votes: {
                        select: { userId: true },
                        distinct: ['userId']
                    },
                    group: true
                }
            });
            if (!poll || poll.status !== 'ACTIVE') {
                return false;
            }
            const settings = await group_service_1.GroupService.getGroupSettings(poll.groupId);
            if (!settings.autoCompleteEnabled) {
                logger_1.logger.info(`Auto-complete disabled for group ${poll.groupId}`);
                return false;
            }
            const { count: expectedParticipants, source } = await this.getExpectedParticipants(poll.groupId, poll.group.telegramId, settings);
            const currentVotes = poll.votes.length;
            const voterIds = poll.votes.map(v => v.userId);
            logger_1.logger.info(`🔍 DEBUG: Poll ${pollId} voters:`, { voterIds });
            const timeElapsed = Date.now() - poll.startedAt.getTime();
            const totalTime = poll.duration * 60 * 1000;
            const timeProgress = timeElapsed / totalTime;
            const voteProgress = currentVotes / expectedParticipants;
            logger_1.logger.info(`Auto-complete check for poll ${pollId}:`, {
                currentVotes,
                expectedParticipants,
                voteProgress: `${Math.round(voteProgress * 100)}%`,
                timeProgress: `${Math.round(timeProgress * 100)}%`,
                source,
                voterIds
            });
            if (voteProgress >= 1.0) {
                logger_1.logger.info(`✅ Auto-completing poll ${pollId}: 100% participation (${currentVotes}/${expectedParticipants})`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Error checking auto-complete:', error);
            return false;
        }
    }
}
exports.PollService = PollService;
