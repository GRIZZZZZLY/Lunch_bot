"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiServer = createApiServer;
exports.startApiServer = startApiServer;
exports.stopApiServer = stopApiServer;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const cors_1 = require("./middleware/cors");
const error_handler_1 = require("./middleware/error-handler");
const api_config_1 = require("../config/api.config");
const logger_1 = require("../utils/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const poll_routes_1 = __importDefault(require("./routes/poll.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const budget_routes_1 = __importDefault(require("./routes/budget.routes"));
const metrics_routes_1 = __importDefault(require("./routes/metrics.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const test_routes_1 = __importDefault(require("./routes/test.routes"));
const metrics_1 = require("./middleware/metrics");
function createApiServer() {
    const app = (0, express_1.default)();
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'", 'https://telegram.org'],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://telegram.org'],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", 'data:', 'https:'],
                imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
                connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
                frameSrc: ["'self'", 'https://telegram.org'],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    app.use((req, res, next) => {
        res.setHeader('ngrok-skip-browser-warning', 'true');
        next();
    });
    app.use(cors_1.corsMiddleware);
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use(error_handler_1.requestLogger);
    app.use(metrics_1.metricsMiddleware);
    app.use('/health', health_routes_1.default);
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/menu', menu_routes_1.default);
    app.use('/api/polls', poll_routes_1.default);
    app.use('/api/user', user_routes_1.default);
    app.use('/api/budget', budget_routes_1.default);
    app.use('/api/metrics', metrics_routes_1.default);
    if (process.env.NODE_ENV !== 'production') {
        app.use('/api/test', test_routes_1.default);
        logger_1.logger.info('Test endpoints enabled (dev/staging mode)');
    }
    app.use('/api/stats', (req, res) => {
        res.json({
            success: false,
            error: 'Endpoints для статистики в разработке',
            code: 'NOT_IMPLEMENTED',
            timestamp: new Date().toISOString(),
        });
    });
    app.use('/uploads', express_1.default.static(api_config_1.apiConfig.uploadPath));
    const projectRoot = path_1.default.join(__dirname, '../../..');
    const frontendDistPath = path_1.default.join(projectRoot, 'frontend/dist');
    logger_1.logger.info(`Frontend static path: ${frontendDistPath}`);
    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });
    app.use(express_1.default.static(frontendDistPath, {
        maxAge: 0,
        etag: false,
    }));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path_1.default.join(frontendDistPath, 'index.html'), (err) => {
            if (err) {
                next(err);
            }
        });
    });
    app.use(error_handler_1.notFoundHandler);
    app.use(error_handler_1.errorHandler);
    logger_1.logger.info('API сервер настроен', {
        corsOrigin: api_config_1.apiConfig.corsOrigin,
        uploadPath: api_config_1.apiConfig.uploadPath,
        maxFileSize: `${api_config_1.apiConfig.maxFileSizeMB}MB`,
    });
    return app;
}
function startApiServer(app) {
    const port = api_config_1.apiConfig.port;
    const host = api_config_1.apiConfig.host;
    app.listen(port, host, () => {
        logger_1.logger.info(`🚀 API сервер запущен на http://${host}:${port}`);
        logger_1.logger.info('📋 Monitoring endpoints:');
        logger_1.logger.info('  GET  /health - проверка состояния');
        logger_1.logger.info('  GET  /health/ready - readiness check');
        logger_1.logger.info('  GET  /health/live - liveness check');
        logger_1.logger.info('  GET  /api/metrics - метрики приложения');
        logger_1.logger.info('  GET  /api/metrics/detailed - детальная статистика');
        logger_1.logger.info('  GET  /dashboard.html - monitoring dashboard');
        logger_1.logger.info('');
        logger_1.logger.info('📋 Main API endpoints:');
        logger_1.logger.info('  POST /api/auth/validate - валидация пользователя');
        logger_1.logger.info('  GET  /api/menu - список блюд');
        logger_1.logger.info('  GET  /api/polls/active - активные голосования');
        logger_1.logger.info('  GET  /api/budget/debts - долги пользователя');
        logger_1.logger.info('');
        if (process.env.NODE_ENV !== 'production') {
            logger_1.logger.info('🧪 Test endpoints (dev/staging):');
            logger_1.logger.info('  GET  /api/test/sentry-error - тест Sentry error');
            logger_1.logger.info('  GET  /api/test/sentry-message - тест Sentry message');
            logger_1.logger.info('');
        }
    });
}
function stopApiServer(server) {
    return new Promise((resolve) => {
        server.close(() => {
            logger_1.logger.info('🛑 API сервер остановлен');
            resolve();
        });
    });
}
//# sourceMappingURL=server.js.map