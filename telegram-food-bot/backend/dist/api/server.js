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
const rate_limiter_1 = require("./middleware/rate-limiter");
const api_config_1 = require("../config/api.config");
const logger_1 = require("../utils/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const menu_suggestion_routes_1 = __importDefault(require("./routes/menu-suggestion.routes"));
const poll_routes_1 = __importDefault(require("./routes/poll.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const budget_routes_1 = __importDefault(require("./routes/budget.routes"));
const metrics_routes_1 = __importDefault(require("./routes/metrics.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const test_routes_1 = __importDefault(require("./routes/test.routes"));
const feedback_routes_1 = __importDefault(require("./routes/feedback.routes"));
const gamification_routes_1 = __importDefault(require("./routes/gamification.routes"));
const season_routes_1 = __importDefault(require("./routes/season.routes"));
const insights_routes_1 = __importDefault(require("./routes/insights.routes"));
const recurring_poll_routes_1 = __importDefault(require("./routes/recurring-poll.routes"));
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
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use(error_handler_1.requestLogger);
    app.use(metrics_1.metricsMiddleware);
    app.use('/health', health_routes_1.default);
    app.use('/api', cors_1.corsMiddleware);
    app.use('/api', rate_limiter_1.generalLimiter);
    app.use('/api/auth', rate_limiter_1.authLimiter);
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/menu', menu_routes_1.default);
    app.use('/api/suggestions', menu_suggestion_routes_1.default);
    app.use('/api/polls', poll_routes_1.default);
    app.use('/api/votes', require('./routes/vote.routes').default);
    app.use('/api/user', user_routes_1.default);
    app.use('/api/budget', budget_routes_1.default);
    app.use('/api/metrics', metrics_routes_1.default);
    app.use('/api/feedback', feedback_routes_1.default);
    app.use('/api/notifications', require('./routes/notification.routes').default);
    app.use('/api/gamification', gamification_routes_1.default);
    app.use('/api/seasons', season_routes_1.default);
    app.use('/api/insights', insights_routes_1.default);
    app.use('/api/avatar', require('./routes/avatar.routes').default);
    app.use('/api/recurring', recurring_poll_routes_1.default);
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
    const cwd = process.cwd();
    const isInBackendDir = cwd.endsWith('backend') || cwd.endsWith('backend\\');
    const projectRoot = isInBackendDir ? path_1.default.join(cwd, '..') : cwd;
    const frontendDistPath = path_1.default.join(projectRoot, 'frontend', 'dist');
    const frontendDistExists = require('fs').existsSync(frontendDistPath);
    logger_1.logger.info(`CWD: ${cwd}`);
    logger_1.logger.info(`Project root: ${projectRoot}`);
    logger_1.logger.info(`Frontend static path: ${frontendDistPath}`);
    logger_1.logger.info(`Frontend dist exists: ${frontendDistExists}`);
    if (!frontendDistExists) {
        logger_1.logger.error('❌ ОШИБКА: frontend/dist не найдена!');
        logger_1.logger.error('Запустите сборку frontend: cd frontend && npm run build');
        throw new Error(`Frontend dist directory not found: ${frontendDistPath}`);
    }
    app.use((req, res, next) => {
        const path = req.path;
        if (path.endsWith('.html') || path === '/' || !path.includes('.')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        else if (/\.(js|css)$/.test(path) && /-[a-f0-9]{8}\.(js|css)$/.test(path)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (/\.(js|css)$/.test(path)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
        else if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(path)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
        else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
        res.setHeader('X-App-Version', '2.0.1');
        next();
    });
    app.use(express_1.default.static(frontendDistPath, {
        maxAge: 0,
        etag: true,
        lastModified: true,
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