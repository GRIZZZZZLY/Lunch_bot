"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const poll_controller_1 = require("../controllers/poll.controller");
const telegram_auth_1 = require("../middleware/telegram-auth");
const router = express_1.default.Router();
router.get('/active', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getActivePolls);
router.get('/history', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getPollHistory);
router.get('/stats', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getPollStats);
router.get('/:id', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getPollById);
router.get('/:id/results', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getPollResults);
router.get('/:id/votes', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.getPollVotes);
router.post('/', telegram_auth_1.telegramAuthMiddleware, telegram_auth_1.adminMiddleware, poll_controller_1.pollController.createPoll);
router.patch('/:id/complete', telegram_auth_1.telegramAuthMiddleware, telegram_auth_1.adminMiddleware, poll_controller_1.pollController.completePoll);
router.patch('/:id/cancel', telegram_auth_1.telegramAuthMiddleware, telegram_auth_1.adminMiddleware, poll_controller_1.pollController.cancelPoll);
router.post('/:id/vote', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.vote);
router.delete('/:id/vote', telegram_auth_1.telegramAuthMiddleware, poll_controller_1.pollController.removeVote);
router.post('/:id/roulette', telegram_auth_1.telegramAuthMiddleware, telegram_auth_1.adminMiddleware, poll_controller_1.pollController.runRoulette);
exports.default = router;
//# sourceMappingURL=poll.routes.js.map