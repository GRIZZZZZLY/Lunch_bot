"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMenuItemData = validateMenuItemData;
exports.validatePollData = validatePollData;
exports.validateVoteData = validateVoteData;
exports.validateIdParam = validateIdParam;
exports.validatePaginationParams = validatePaginationParams;
exports.validateWithSchema = validateWithSchema;
exports.sanitizeStrings = sanitizeStrings;
const zod_1 = require("zod");
const logger_1 = require("../../utils/logger");
const createMenuItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100, 'Name too long'),
    description: zod_1.z.string().max(500, 'Description too long').optional().or(zod_1.z.literal('')),
    price: zod_1.z.number().min(0, 'Price cannot be negative').optional(),
    category: zod_1.z.string().max(50, 'Category name too long').optional().or(zod_1.z.literal('')),
    imageUrl: zod_1.z.string().url('Invalid image URL').optional().or(zod_1.z.literal('')),
    isActive: zod_1.z.boolean().optional(),
});
const updateMenuItemSchema = createMenuItemSchema.partial();
const createPollSchema = zod_1.z.object({
    groupId: zod_1.z.number().int().positive('Group ID must be positive'),
    title: zod_1.z.string().max(200, 'Title too long').optional(),
    description: zod_1.z.string().max(500, 'Description too long').optional(),
    endTime: zod_1.z.string().datetime('Invalid end time format').optional(),
});
const voteSchema = zod_1.z.object({
    menuItemId: zod_1.z.number().int().positive('Menu item ID must be positive'),
});
function validateMenuItemData(req, res, next) {
    try {
        const schema = req.method === 'POST' ? createMenuItemSchema : updateMenuItemSchema;
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors,
            });
            return;
        }
        req.body = result.data;
        next();
    }
    catch (error) {
        logger_1.logger.error('Validation middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
function validatePollData(req, res, next) {
    try {
        const result = createPollSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors,
            });
            return;
        }
        req.body = result.data;
        next();
    }
    catch (error) {
        logger_1.logger.error('Poll validation middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
function validateVoteData(req, res, next) {
    try {
        const result = voteSchema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors,
            });
            return;
        }
        req.body = result.data;
        next();
    }
    catch (error) {
        logger_1.logger.error('Vote validation middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
function validateIdParam(paramName = 'id') {
    return function (req, res, next) {
        try {
            const id = parseInt(req.params[paramName]);
            if (isNaN(id) || id <= 0) {
                res.status(400).json({
                    success: false,
                    error: `Invalid ${paramName} parameter`,
                    code: 'INVALID_ID'
                });
                return;
            }
            req.validatedId = id;
            next();
        }
        catch (error) {
            logger_1.logger.error('ID validation middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    };
}
function validatePaginationParams(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (page < 1) {
            res.status(400).json({
                success: false,
                error: 'Page must be greater than 0',
                code: 'INVALID_PAGE'
            });
            return;
        }
        if (limit < 1 || limit > 100) {
            res.status(400).json({
                success: false,
                error: 'Limit must be between 1 and 100',
                code: 'INVALID_LIMIT'
            });
            return;
        }
        req.pagination = {
            page,
            limit,
            offset: (page - 1) * limit,
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('Pagination validation middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
}
function validateWithSchema(schema) {
    return function (req, res, next) {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors = result.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                }));
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    errors,
                });
                return;
            }
            req.body = result.data;
            next();
        }
        catch (error) {
            logger_1.logger.error('Custom validation middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    };
}
function sanitizeStrings(req, res, next) {
    try {
        function sanitizeObject(obj) {
            if (typeof obj === 'string') {
                return obj.trim();
            }
            if (Array.isArray(obj)) {
                return obj.map(sanitizeObject);
            }
            if (obj && typeof obj === 'object') {
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    sanitized[key] = sanitizeObject(value);
                }
                return sanitized;
            }
            return obj;
        }
        req.body = sanitizeObject(req.body);
        next();
    }
    catch (error) {
        logger_1.logger.error('String sanitization middleware error:', error);
        next();
    }
}
