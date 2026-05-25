/**
 * Phase 3 (P2-1): подготовка к split monolith (api / bot-worker).
 *
 * Сейчас 1 app 'rocket-lunch-bot' = PROCESS_ROLE=full (monolith).
 * Когда G0-9 (Redis prod) + bot↔api decoupling готовы — раскомментировать
 * блок ниже, заменить apps:[fullApp] на apps:[apiApp, botApp]. Каждый app
 * запускает свой PROCESS_ROLE; bot-worker без HTTP-сервера, api без polling.
 *
 *   const apiApp = { ...common, name: 'rocket-lunch-api', env: { ...env, PROCESS_ROLE: 'api' } };
 *   const botApp = { ...common, name: 'rocket-lunch-bot', env: { ...env, PROCESS_ROLE: 'bot' } };
 *   module.exports = { apps: [apiApp, botApp] };
 *
 * Прежде включить:
 *   1. Redis обязательным (G0-9).
 *   2. Idempotency state shared через Redis (уже есть).
 *   3. Любой in-memory state (poll кеш scheduler) вынести в Redis.
 *
 * Phase 1 (P0-3): подготовка к cluster mode.
 *
 * Сейчас: instances: 1, exec_mode: 'fork' — безопасно, все in-memory структуры
 * (express-rate-limit MemoryStore, node-cache, throttler-bottleneck, Grammy polling)
 * живут в одном процессе.
 *
 * Переход на cluster ('max' / 2): сначала закрыть G0-9 (Redis обязательным
 * в проде) И P1-2 (Redis-backed rate-limit + cache). Иначе:
 *  - rate-limit будет считать N×независимо → лимиты эффективно ×N
 *  - кеш не разделится между процессами → cache miss на каждый запрос
 *  - Grammy polling нельзя запускать в N процессах одновременно — нужно
 *    разделить bot-worker и api в разные PM2 апы (P2-1)
 *
 * Когда переключим: instances: 2, exec_mode: 'cluster', listen на тот же port.
 * Graceful: SIGINT → drain HTTP + close Prisma + close Redis.
 */
module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './backend/dist/index.js',
    cwd: '/home/igor/Lunch_bot/telegram-food-bot',

    // Process management
    instances: 1,             // TODO P1-3: 'max' после Redis-backed shared state
    exec_mode: 'fork',        // TODO P1-3: 'cluster' одновременно с instances
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',

    // Environment file
    env_file: './backend/.env',

    // Environment
    env: {
      NODE_ENV: 'production',
    },

    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Crash recovery
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,

    // Monitoring
    instance_var: 'INSTANCE_ID',

    // Graceful shutdown
    //  - SIGINT → backend index.ts должен слушать и drain'ить HTTP, потом
    //    prisma.$disconnect() + redis.quit() + bot.stop().
    //  - kill_timeout — окно на graceful drain до SIGKILL.
    //  - wait_ready — index.ts шлёт process.send('ready') когда полностью встал.
    kill_timeout: 10000,
    wait_ready: true,
    listen_timeout: 10000,
    shutdown_with_message: true,
  }]
};
