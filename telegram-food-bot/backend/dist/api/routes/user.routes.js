"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("../controllers/user.controller");
const telegram_auth_1 = require("../middleware/telegram-auth");
const router = express_1.default.Router();
router.get('/me', telegram_auth_1.telegramAuthMiddleware, user_controller_1.userController.getCurrentUser);
router.get('/payment-info', telegram_auth_1.telegramAuthMiddleware, user_controller_1.userController.getPaymentInfo);
router.put('/payment-info', telegram_auth_1.telegramAuthMiddleware, user_controller_1.userController.updatePaymentInfo);
router.get('/groups', telegram_auth_1.telegramAuthMiddleware, user_controller_1.userController.getUserGroups);
exports.default = router;
