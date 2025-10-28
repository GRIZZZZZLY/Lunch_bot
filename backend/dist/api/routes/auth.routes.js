"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const telegram_auth_1 = require("../middleware/telegram-auth");
const router = express_1.default.Router();
router.post('/validate', auth_controller_1.authController.validateInitData);
router.get('/me', telegram_auth_1.telegramAuthMiddleware, auth_controller_1.authController.getCurrentUser);
router.get('/status', telegram_auth_1.telegramAuthMiddleware, auth_controller_1.authController.getAuthStatus);
router.post('/refresh', telegram_auth_1.telegramAuthMiddleware, auth_controller_1.authController.refreshAuth);
exports.default = router;
