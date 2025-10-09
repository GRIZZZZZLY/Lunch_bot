/**
 * Простой reverse proxy сервер для xtunnel
 * Проксирует запросы с порта 8080:
 * - / -> localhost:5173 (Vite dev server - frontend)
 * - /api -> localhost:3001 (Express API - backend)
 */

const http = require('http');
const httpProxy = require('http-proxy');

const PORT = 8080;
const FRONTEND_PORT = 5173;
const BACKEND_PORT = 3001;

// Создаем proxy сервер
const proxy = httpProxy.createProxyServer({});

// Обработка ошибок прокси
proxy.on('error', (err, req, res) => {
  console.error('❌ Proxy error:', err.message);
  if (!res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Proxy error',
      message: err.message,
      hint: 'Убедитесь что frontend (5173) и backend (3001) запущены'
    }));
  }
});

// Создаем HTTP сервер
const server = http.createServer((req, res) => {
  const url = req.url || '';
  
  // Логирование запросов
  console.log(`${req.method} ${url}`);
  
  // API запросы идут на backend
  if (url.startsWith('/api')) {
    // Удаляем префикс /api перед проксированием
    req.url = url.replace(/^\/api/, '');
    proxy.web(req, res, {
      target: `http://localhost:${BACKEND_PORT}`,
      changeOrigin: true
    });
  }
  // Webhook и health напрямую (без префикса /api)
  else if (url.startsWith('/webhook') || url.startsWith('/health')) {
    proxy.web(req, res, {
      target: `http://localhost:${BACKEND_PORT}`,
      changeOrigin: true
    });
  }
  // Все остальное идет на frontend
  else {
    proxy.web(req, res, {
      target: `http://localhost:${FRONTEND_PORT}`,
      changeOrigin: true,
      ws: true // WebSocket support для Vite HMR
    });
  }
});

// WebSocket support для Vite HMR
server.on('upgrade', (req, socket, head) => {
  console.log('🔌 WebSocket upgrade request');
  proxy.ws(req, socket, head, {
    target: `http://localhost:${FRONTEND_PORT}`,
    ws: true
  });
});

server.listen(PORT, () => {
  console.log('🚀 Proxy server запущен');
  console.log(`   Порт: ${PORT}`);
  console.log(`   Frontend: http://localhost:${FRONTEND_PORT}`);
  console.log(`   Backend API: http://localhost:${BACKEND_PORT}`);
  console.log(`   xtunnel должен проксировать на localhost:${PORT}`);
  console.log('\n📋 Маршруты:');
  console.log(`   / → Frontend (Vite dev server)`);
  console.log(`   /api → Backend API`);
  console.log(`   /webhook → Backend webhook`);
  console.log(`   /health → Backend health check`);
  console.log('\n✅ Готов к работе!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Остановка proxy server...');
  server.close(() => {
    console.log('✅ Proxy server остановлен');
    process.exit(0);
  });
});
