"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollController = exports.PollController = void 0;
const poll_service_1 = require("../../services/poll.service");
const vote_service_1 = require("../../services/vote.service");
const logger_1 = require("../../utils/logger");
class PollController {
    static async getActivePolls(req, res) {
        try {
            const polls = await poll_service_1.PollService.getActivePolls();
            res.json({
                success: true,
                data: polls,
                count: polls.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting active polls:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get active polls',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPollHistory(req, res) {
        try {
            const groupId = req.query.groupId ? parseInt(req.query.groupId) : undefined;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            if (groupId && isNaN(groupId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid groupId parameter',
                    code: 'INVALID_GROUP_ID'
                });
                return;
            }
            const result = await poll_service_1.PollService.getPollHistory(groupId, limit, offset);
            res.json({
                success: true,
                data: result.polls,
                pagination: {
                    total: result.total,
                    limit,
                    offset,
                    hasNext: offset + limit < result.total,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get poll history',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPollStats(req, res) {
        try {
            const groupId = req.query.groupId ? parseInt(req.query.groupId) : undefined;
            if (groupId && isNaN(groupId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid groupId parameter',
                    code: 'INVALID_GROUP_ID'
                });
                return;
            }
            const stats = await poll_service_1.PollService.getPollStats(groupId);
            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get poll stats',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPollById(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const poll = await poll_service_1.PollService.getPollById(id);
            if (!poll) {
                res.status(404).json({
                    success: false,
                    error: 'Poll not found',
                    code: 'POLL_NOT_FOUND'
                });
                return;
            }
            res.json({
                success: true,
                data: poll,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll by ID:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get poll',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPollResults(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const result = await poll_service_1.PollService.getPollResultByPollId(id);
            if (!result) {
                res.status(404).json({
                    success: false,
                    error: 'Poll results not found',
                    code: 'RESULTS_NOT_FOUND'
                });
                return;
            }
            const breakdown = await poll_service_1.PollService.getPollVoteBreakdown(id);
            res.json({
                success: true,
                data: {
                    result,
                    breakdown,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll results:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get poll results',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getPollVotes(req, res) {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const votes = await vote_service_1.VoteService.getPollVotes(id);
            const voteCount = await vote_service_1.VoteService.getVoteCountByMenuItem(id);
            res.json({
                success: true,
                data: {
                    votes,
                    summary: voteCount,
                    totalVotes: votes.length,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting poll votes:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get poll votes',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async createPoll(req, res) {
        try {
            const data = req.body;
            const user = req.user;
            const poll = await poll_service_1.PollService.createPoll(data);
            logger_1.logger.info('Poll created via API', {
                pollId: poll.id,
                groupId: poll.groupId,
                createdBy: user.id,
            });
            res.status(201).json({
                success: true,
                data: poll,
                message: 'Poll created successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating poll:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create poll',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async completePoll(req, res) {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const result = await poll_service_1.PollService.completePoll(id);
            logger_1.logger.info('Poll completed via API', {
                pollId: id,
                completedBy: user.id,
                winnerItemId: result.winnerMenuItemId,
                totalVotes: result.totalVotes,
            });
            res.json({
                success: true,
                data: result,
                message: 'Poll completed successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Poll not found') {
                    res.status(404).json({
                        success: false,
                        error: 'Poll not found',
                        code: 'POLL_NOT_FOUND'
                    });
                    return;
                }
                if (error.message === 'Poll is already completed') {
                    res.status(400).json({
                        success: false,
                        error: 'Poll is already completed',
                        code: 'POLL_ALREADY_COMPLETED'
                    });
                    return;
                }
            }
            logger_1.logger.error('Error completing poll:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to complete poll',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async cancelPoll(req, res) {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const poll = await poll_service_1.PollService.cancelPoll(id);
            logger_1.logger.info('Poll cancelled via API', {
                pollId: id,
                cancelledBy: user.id,
            });
            res.json({
                success: true,
                data: poll,
                message: 'Poll cancelled successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Poll not found') {
                res.status(404).json({
                    success: false,
                    error: 'Poll not found',
                    code: 'POLL_NOT_FOUND'
                });
                return;
            }
            logger_1.logger.error('Error cancelling poll:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel poll',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async vote(req, res) {
        try {
            const pollId = parseInt(req.params.id);
            const { menuItemId } = req.body;
            const user = req.user;
            if (isNaN(pollId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            if (!menuItemId || isNaN(parseInt(menuItemId))) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid menu item ID',
                    code: 'INVALID_MENU_ITEM_ID'
                });
                return;
            }
            const voteData = {
                pollId,
                userId: user.id,
                menuItemId: parseInt(menuItemId),
            };
            const vote = await vote_service_1.VoteService.upsertVote(voteData);
            logger_1.logger.info('Vote cast via API', {
                pollId,
                userId: user.id,
                menuItemId: vote.menuItemId,
                isUpdate: vote.updatedAt > vote.createdAt,
            });
            res.json({
                success: true,
                data: vote,
                message: 'Vote cast successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error) {
                if (['Poll not found', 'Poll is not active', 'Poll has expired'].includes(error.message)) {
                    res.status(400).json({
                        success: false,
                        error: error.message,
                        code: 'POLL_ERROR'
                    });
                    return;
                }
            }
            logger_1.logger.error('Error casting vote:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cast vote',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async removeVote(req, res) {
        try {
            const pollId = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(pollId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            await vote_service_1.VoteService.removeVote(pollId, user.id);
            logger_1.logger.info('Vote removed via API', {
                pollId,
                userId: user.id,
            });
            res.json({
                success: true,
                message: 'Vote removed successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Vote not found') {
                    res.status(404).json({
                        success: false,
                        error: 'Vote not found',
                        code: 'VOTE_NOT_FOUND'
                    });
                    return;
                }
                if (['Poll not found', 'Poll is not active'].includes(error.message)) {
                    res.status(400).json({
                        success: false,
                        error: error.message,
                        code: 'POLL_ERROR'
                    });
                    return;
                }
            }
            logger_1.logger.error('Error removing vote:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to remove vote',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async runRoulette(req, res) {
        try {
            const id = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(id)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID'
                });
                return;
            }
            const result = await poll_service_1.PollService.runRoulette(id);
            logger_1.logger.info('Roulette run via API', {
                pollId: id,
                runBy: user.id,
                selectedUserId: result.responsibleUserId,
            });
            res.json({
                success: true,
                data: result,
                message: 'Roulette completed successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Poll not found') {
                    res.status(404).json({
                        success: false,
                        error: 'Poll not found',
                        code: 'POLL_NOT_FOUND'
                    });
                    return;
                }
                if (error.message === 'No voters found') {
                    res.status(400).json({
                        success: false,
                        error: 'No voters found for roulette',
                        code: 'NO_VOTERS'
                    });
                    return;
                }
            }
            logger_1.logger.error('Error running roulette:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to run roulette',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}
exports.PollController = PollController;
exports.pollController = PollController;
//# sourceMappingURL=poll.controller.js.map