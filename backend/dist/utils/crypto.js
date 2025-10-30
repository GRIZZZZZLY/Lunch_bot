"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAuthHeader = extractAuthHeader;
exports.generateRandomToken = generateRandomToken;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.createWebhookSignature = createWebhookSignature;
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("./logger");
function extractAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('tma ')) {
        return null;
    }
    return authHeader.substring(4);
}
function generateRandomToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
const BCRYPT_ROUNDS = 12;
async function hashPassword(password) {
    try {
        return await bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
    }
    catch (error) {
        logger_1.logger.error('Password hashing error:', error);
        throw new Error('Failed to hash password');
    }
}
async function verifyPassword(password, hash) {
    try {
        return await bcrypt_1.default.compare(password, hash);
    }
    catch (error) {
        logger_1.logger.error('Password verification error:', error);
        return false;
    }
}
function createWebhookSignature(body, secretToken) {
    return crypto_1.default
        .createHmac('sha256', secretToken)
        .update(body)
        .digest('hex');
}
function verifyWebhookSignature(body, signature, secretToken) {
    try {
        if (!signature || signature.length !== 64 || !/^[0-9a-fA-F]+$/.test(signature)) {
            logger_1.logger.warn('Invalid webhook signature format', {
                signatureLength: signature?.length,
                expectedLength: 64,
                isHex: /^[0-9a-fA-F]+$/.test(signature || ''),
            });
            return false;
        }
        const expectedSignature = createWebhookSignature(body, secretToken);
        return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
    catch (error) {
        logger_1.logger.error('Error verifying webhook signature:', error);
        return false;
    }
}
//# sourceMappingURL=crypto.js.map