"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnect = exports.testConnection = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const globalForPrisma = globalThis;
const createPrismaClient = () => {
    const prisma = new client_1.PrismaClient({
        log: [
            {
                emit: 'event',
                level: 'query',
            },
            {
                emit: 'event',
                level: 'error',
            },
            {
                emit: 'event',
                level: 'info',
            },
            {
                emit: 'event',
                level: 'warn',
            },
        ],
        errorFormat: 'pretty',
    });
    if (process.env.NODE_ENV === 'development') {
        prisma.$on('query', (e) => {
            logger_1.logger.debug('Prisma Query:', {
                query: e.query,
                params: e.params,
                duration: `${e.duration}ms`,
                target: e.target,
            });
        });
    }
    prisma.$on('error', (e) => {
        logger_1.logger.error('Prisma Error:', {
            message: e.message,
            target: e.target,
            timestamp: e.timestamp,
        });
    });
    prisma.$on('info', (e) => {
        logger_1.logger.info('Prisma Info:', {
            message: e.message,
            target: e.target,
            timestamp: e.timestamp,
        });
    });
    prisma.$on('warn', (e) => {
        logger_1.logger.warn('Prisma Warning:', {
            message: e.message,
            target: e.target,
            timestamp: e.timestamp,
        });
    });
    return prisma;
};
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
const testConnection = async () => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        logger_1.logger.info('✅ Подключение к базе данных успешно установлено');
        return true;
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка подключения к базе данных:', error);
        return false;
    }
};
exports.testConnection = testConnection;
const disconnect = async () => {
    try {
        await exports.prisma.$disconnect();
        logger_1.logger.info('🔌 Соединение с базой данных закрыто');
    }
    catch (error) {
        logger_1.logger.error('❌ Ошибка при закрытии соединения с БД:', error);
    }
};
exports.disconnect = disconnect;
process.on('SIGINT', async () => {
    await (0, exports.disconnect)();
});
process.on('SIGTERM', async () => {
    await (0, exports.disconnect)();
});
exports.default = exports.prisma;
