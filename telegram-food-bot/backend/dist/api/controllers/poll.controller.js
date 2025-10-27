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
exports.pollController = exports.PollController = void 0;
const poll_service_1 = require("../../services/poll.service");
const vote_service_1 = require("../../services/vote.service");
const menu_service_1 = require("../../services/menu.service");
const group_service_1 = require("../../services/group.service");
const logger_1 = require("../../utils/logger");
const poll_service_extensions_1 = require("../../services/poll.service.extensions");
function serializeBigInt(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeBigInt);
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = serializeBigInt(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
class PollController {
    static async getActivePolls(req, res) {
        try {
            const polls = await poll_service_1.PollService.getActivePolls();
            res.json({
                success: true,
                data: serializeBigInt(polls),
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
                data: {
                    polls: serializeBigInt(result.polls),
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
    static async getLastCompleted(req, res) {
        try {
            const user = req.user;
            const groupId = req.query.groupId ? parseInt(req.query.groupId) : undefined;
            const poll = await poll_service_1.PollService.getLastCompletedPoll(groupId);
            res.json({
                success: true,
                data: poll ? serializeBigInt(poll) : null,
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting last completed poll:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get last completed poll',
                code: 'INTERNAL_ERROR',
            });
        }
    }
    static async repeatPoll(req, res) {
        try {
            const user = req.user;
            const pollId = parseInt(req.params.id);
            logger_1.logger.info(`🔄 Repeating poll ${pollId} by user ${user.id}`);
            if (!pollId || isNaN(pollId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_POLL_ID',
                });
                return;
            }
            const sourcePoll = await poll_service_1.PollService.getPollById(pollId);
            if (!sourcePoll) {
                res.status(404).json({
                    success: false,
                    error: 'Poll not found',
                    code: 'POLL_NOT_FOUND',
                });
                return;
            }
            logger_1.logger.info(`✅ Source poll found: ${pollId}`, {
                groupId: sourcePoll.groupId,
                selectedMenuItemIds: sourcePoll.selectedMenuItemIds,
            });
            let selectedMenuItemIds = [];
            if (sourcePoll.selectedMenuItemIds) {
                try {
                    selectedMenuItemIds = JSON.parse(sourcePoll.selectedMenuItemIds);
                }
                catch (error) {
                    logger_1.logger.error('Error parsing selectedMenuItemIds:', error);
                }
            }
            let menuItems = [];
            if (selectedMenuItemIds.length > 0) {
                logger_1.logger.info(`📋 Loading ${selectedMenuItemIds.length} selected menu items`);
                menuItems = await menu_service_1.MenuService.getMenuItemsByIds(selectedMenuItemIds);
            }
            else {
                logger_1.logger.info('📋 Loading all active menu items');
                menuItems = await menu_service_1.MenuService.getActiveMenuItems();
            }
            if (menuItems.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No menu items available',
                    code: 'NO_MENU_ITEMS',
                });
                return;
            }
            logger_1.logger.info(`✅ Loaded ${menuItems.length} menu items`);
            const result = await (0, poll_service_extensions_1.createPollFromWebApp)({
                groupId: sourcePoll.groupId,
                duration: sourcePoll.duration,
                createdBy: user.id,
                menuItems,
                selectedMenuItemIds: selectedMenuItemIds.length > 0 ? selectedMenuItemIds : undefined,
            });
            logger_1.logger.info(`✅ Poll ${pollId} repeated as poll ${result.pollId} by user ${user.id}`);
            const newPoll = await poll_service_1.PollService.getPollById(result.pollId);
            res.json({
                success: true,
                data: serializeBigInt(newPoll),
                message: 'Poll repeated and sent to Telegram group',
            });
        }
        catch (error) {
            logger_1.logger.error('❌ Error repeating poll:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to repeat poll',
                code: 'INTERNAL_ERROR',
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
                data: serializeBigInt(stats),
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
    static async getUserStats(req, res) {
        try {
            const user = req.user;
            const stats = await poll_service_1.PollService.getUserParticipationStats(user.id);
            res.json({
                success: true,
                data: serializeBigInt(stats),
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user stats',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getUserStatsByUserId(req, res) {
        try {
            const userId = parseInt(req.params.userId);
            if (isNaN(userId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid user ID',
                    code: 'INVALID_USER_ID'
                });
                return;
            }
            const stats = await poll_service_1.PollService.getUserParticipationStats(userId);
            res.json({
                success: true,
                data: serializeBigInt(stats),
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting user stats by ID:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user stats',
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
            let filteredPoll = poll;
            if (poll.selectedMenuItemIds) {
                try {
                    const selectedIds = JSON.parse(poll.selectedMenuItemIds);
                    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
                        filteredPoll = {
                            ...poll,
                            votes: poll.votes.filter(vote => vote.menuItemId && selectedIds.includes(vote.menuItemId)),
                        };
                        logger_1.logger.info(`Filtered poll ${id} votes`, {
                            totalVotes: poll.votes.length,
                            filteredVotes: filteredPoll.votes.length,
                            selectedMenuItemIds: selectedIds
                        });
                    }
                }
                catch (parseError) {
                    logger_1.logger.warn('Failed to parse selectedMenuItemIds', { pollId: id, error: parseError });
                }
            }
            res.json({
                success: true,
                data: serializeBigInt(filteredPoll),
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
                data: serializeBigInt({
                    result,
                    breakdown,
                }),
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
                data: serializeBigInt({
                    votes,
                    summary: voteCount,
                    totalVotes: votes.length,
                }),
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
                data: serializeBigInt(poll),
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
    static async createPollFromWebApp(req, res) {
        try {
            logger_1.logger.info('🚀 START createPollFromWebApp');
            const { groupId, duration, selectedMenuItems, title } = req.body;
            const user = req.user;
            logger_1.logger.info('Creating poll from WebApp', {
                groupId,
                duration,
                selectedMenuItems,
                title,
                userId: user?.id,
                body: req.body
            });
            logger_1.logger.info('📊 After initial logging, before validation');
            if (!groupId || isNaN(parseInt(groupId))) {
                logger_1.logger.warn('Invalid groupId', { groupId, type: typeof groupId });
                res.status(400).json({
                    success: false,
                    error: 'Invalid or missing groupId',
                    code: 'INVALID_GROUP_ID'
                });
                return;
            }
            const parsedGroupId = parseInt(groupId);
            const parsedDuration = duration ? parseInt(duration) : 30;
            if (parsedDuration < 1 || parsedDuration > 1440) {
                res.status(400).json({
                    success: false,
                    error: 'Duration must be between 1 and 1440 minutes',
                    code: 'INVALID_DURATION'
                });
                return;
            }
            const group = await group_service_1.GroupService.getGroupById(parsedGroupId);
            if (!group) {
                res.status(404).json({
                    success: false,
                    error: 'Group not found',
                    code: 'GROUP_NOT_FOUND'
                });
                return;
            }
            const existingPoll = await poll_service_1.PollService.getActivePollInGroup(parsedGroupId);
            logger_1.logger.info('✅ Checked existing poll', { exists: !!existingPoll });
            if (existingPoll) {
                logger_1.logger.warn('❌ Group already has active poll');
                res.status(400).json({
                    success: false,
                    error: 'Group already has an active poll',
                    code: 'POLL_ALREADY_ACTIVE'
                });
                return;
            }
            logger_1.logger.info('🍽️ About to load menu items...');
            let menuItems;
            try {
                menuItems = await menu_service_1.MenuService.getActiveMenuItems();
                logger_1.logger.info('✅ Initial menu items loaded', { count: menuItems.length });
            }
            catch (menuError) {
                logger_1.logger.error('❌ FAILED to load menu items', { error: menuError, message: menuError instanceof Error ? menuError.message : 'Unknown error' });
                throw menuError;
            }
            if (selectedMenuItems && Array.isArray(selectedMenuItems) && selectedMenuItems.length > 0) {
                const selectedIds = selectedMenuItems.map((id) => parseInt(id)).filter((id) => !isNaN(id));
                logger_1.logger.info('🔍 Filtering menu items', {
                    selectedIds,
                    selectedMenuItems,
                    selectedIdsCount: selectedIds.length
                });
                menuItems = menuItems.filter(item => selectedIds.includes(item.id));
                logger_1.logger.info('✅ Filtered menu items', {
                    count: menuItems.length,
                    items: menuItems.map(i => ({ id: i.id, name: i.name }))
                });
            }
            if (menuItems.length < 2) {
                logger_1.logger.warn('❌ Not enough menu items', {
                    count: menuItems.length,
                    selectedMenuItems,
                    availableMenuItems: menuItems.length
                });
                res.status(400).json({
                    success: false,
                    error: 'At least 2 active menu items required',
                    code: 'NOT_ENOUGH_ITEMS'
                });
                return;
            }
            const result = await (0, poll_service_extensions_1.createPollFromWebApp)({
                groupId: parsedGroupId,
                duration: parsedDuration,
                createdBy: user.id,
                title: title || undefined,
                menuItems,
                selectedMenuItemIds: menuItems.map(item => item.id)
            });
            logger_1.logger.info('Poll created from WebApp and sent to group', {
                pollId: result.pollId,
                groupId: parsedGroupId,
                createdBy: user.id,
                messageId: result.messageId,
                duration: parsedDuration
            });
            res.status(201).json({
                success: true,
                data: serializeBigInt({
                    pollId: result.pollId,
                    messageId: result.messageId,
                    groupTitle: group.title,
                    duration: parsedDuration,
                    menuItemsCount: menuItems.length
                }),
                message: 'Poll created and sent to group successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error creating poll from WebApp:', error);
            if (error instanceof Error) {
                if (error.message.includes('Bot not initialized')) {
                    res.status(503).json({
                        success: false,
                        error: 'Bot service is not available',
                        code: 'BOT_NOT_AVAILABLE'
                    });
                    return;
                }
            }
            res.status(500).json({
                success: false,
                error: 'Failed to create poll from WebApp',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async getActivePollInGroup(req, res) {
        try {
            const groupId = parseInt(req.params.groupId);
            if (isNaN(groupId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid group ID',
                    code: 'INVALID_GROUP_ID'
                });
                return;
            }
            const poll = await poll_service_1.PollService.getActivePollInGroup(groupId);
            if (!poll) {
                res.status(404).json({
                    success: false,
                    error: 'No active poll in this group',
                    code: 'NO_ACTIVE_POLL',
                    data: null
                });
                return;
            }
            res.json({
                success: true,
                data: serializeBigInt(poll),
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting active poll in group:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get active poll',
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
                data: serializeBigInt(result),
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
            const { reason } = req.body || {};
            const poll = await poll_service_1.PollService.cancelPoll(id, user.id, reason || 'Отменено через API');
            logger_1.logger.info('Poll cancelled via API', {
                pollId: id,
                cancelledBy: user.id,
                reason: reason || 'Отменено через API'
            });
            res.json({
                success: true,
                data: serializeBigInt(poll),
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
            logger_1.logger.info('🔍 DEBUG: Vote request from user:', {
                userId: user.id,
                telegramId: user.telegramId,
                firstName: user.firstName,
                username: user.username,
                pollId,
                menuItemId,
            });
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
            try {
                const shouldAutoComplete = await poll_service_1.PollService.checkAutoComplete(pollId);
                if (shouldAutoComplete) {
                    logger_1.logger.info(`Triggering auto-complete for poll ${pollId} (from API)`);
                    await poll_service_1.PollService.completePollMultiWinner(pollId, user.id, {
                        minVotes: 1,
                        tieBreakMethod: 'earliest'
                    });
                    logger_1.logger.info(`Poll ${pollId} auto-completed successfully via API`);
                }
            }
            catch (autoCompleteError) {
                logger_1.logger.error('Auto-complete check/execution failed:', autoCompleteError);
            }
            res.json({
                success: true,
                data: serializeBigInt(vote),
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
                data: serializeBigInt(result),
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
    static async getPopularItems(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            if (isNaN(limit) || limit <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid limit parameter',
                    code: 'INVALID_LIMIT'
                });
                return;
            }
            const popularItems = await menu_service_1.MenuService.getPopularMenuItems(limit);
            res.json({
                success: true,
                data: serializeBigInt(popularItems),
                count: popularItems.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting popular items:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get popular items',
                code: 'INTERNAL_ERROR'
            });
        }
    }
    static async completePollMultiWinner(req, res) {
        try {
            const { FEATURES } = await Promise.resolve().then(() => __importStar(require('../../config/features')));
            if (!FEATURES.MULTI_WINNER_VOTING) {
                res.status(503).json({
                    success: false,
                    error: 'Multi-Winner Voting is currently disabled',
                    code: 'FEATURE_DISABLED',
                });
                return;
            }
            const pollId = parseInt(req.params.id);
            const user = req.user;
            if (isNaN(pollId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid poll ID',
                    code: 'INVALID_ID',
                });
                return;
            }
            if (!user.isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                    code: 'FORBIDDEN',
                });
                return;
            }
            const { minVotes = 1, maxWinners = null, tieBreakMethod = 'earliest' } = req.body;
            if (typeof minVotes !== 'number' || minVotes < 0 || minVotes > 100) {
                res.status(400).json({
                    success: false,
                    error: 'minVotes must be a number between 0 and 100',
                    code: 'INVALID_PARAMS',
                });
                return;
            }
            if (maxWinners !== null) {
                if (typeof maxWinners !== 'number' || maxWinners < 1 || maxWinners > 50) {
                    res.status(400).json({
                        success: false,
                        error: 'maxWinners must be null or a number between 1 and 50',
                        code: 'INVALID_PARAMS',
                    });
                    return;
                }
            }
            if (!['earliest', 'alphabetical'].includes(tieBreakMethod)) {
                res.status(400).json({
                    success: false,
                    error: 'tieBreakMethod must be "earliest" or "alphabetical"',
                    code: 'INVALID_PARAMS',
                });
                return;
            }
            const result = await poll_service_1.PollService.completePollMultiWinner(pollId, user.id, { minVotes, maxWinners, tieBreakMethod });
            const resultData = JSON.parse(result.rouletteData || '{}');
            logger_1.logger.info('Poll completed with multi-winner via API', {
                pollId,
                completedBy: user.id,
                winnersCount: resultData.winners?.length || 0,
                params: { minVotes, maxWinners, tieBreakMethod },
            });
            res.json({
                success: true,
                data: serializeBigInt({
                    pollResult: result,
                    resultData,
                }),
                message: 'Poll completed with multi-winner mode successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger_1.logger.error('Error completing poll multi-winner:', error);
            if (error.message === 'Poll not found') {
                res.status(404).json({
                    success: false,
                    error: 'Poll not found',
                    code: 'NOT_FOUND',
                });
            }
            else if (error.message.includes('already completed')) {
                res.status(400).json({
                    success: false,
                    error: 'Poll is already completed',
                    code: 'ALREADY_COMPLETED',
                });
            }
            else if (error.message.includes('not active')) {
                res.status(400).json({
                    success: false,
                    error: 'Poll is not active',
                    code: 'NOT_ACTIVE',
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                });
            }
        }
    }
}
exports.PollController = PollController;
exports.pollController = PollController;
//# sourceMappingURL=poll.controller.js.map