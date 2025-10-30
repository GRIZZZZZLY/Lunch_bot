module.exports = {
  apps: [{
    name: 'rocket-lunch-bot',
    script: './backend/dist/index.js',
    cwd: '/home/igor/Lunch_bot/telegram-food-bot',

    // Process management
    instances: 1,
    exec_mode: 'fork',
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
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
