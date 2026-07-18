/* Phase 2B (frontend-new): 4 кадра — root (Home) и detail (PollHistory)
   в светлой и тёмной темах. Использует dist frontend-new и моки mocks.mjs.
   Запуск: node screenshot-2b.mjs (из scripts/screenshot-runner, нужен собранный dist). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { BASE_USER, buildMocks } from './mocks.mjs';

const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-2b');
const VIEWPORT = { width: 430, height: 932 };
const PORT = 5199;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function startStaticServer() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const full = path.join(DIST_DIR, rel);
      if (full.startsWith(DIST_DIR)) {
        try {
          const st = await fs.stat(full);
          if (st.isFile()) {
            const ext = path.extname(full).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            return res.end(await fs.readFile(full));
          }
        } catch {}
      }
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(await fs.readFile(indexPath));
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const tgInit = (theme) => `
(function(){
  try { localStorage.removeItem('rl-theme'); } catch (e) {}
  const WebApp = {
    initData: 'mock_init_data',
    initDataUnsafe: { user: { id: 123456789, first_name: ${JSON.stringify(BASE_USER.firstName)}, username: ${JSON.stringify(BASE_USER.username)}, language_code: 'ru' }, auth_date: Math.floor(Date.now()/1000), hash: 'mock', start_param: null },
    colorScheme: ${JSON.stringify(theme)},
    themeParams: {},
    isExpanded: true,
    viewportHeight: 932,
    viewportStableHeight: 932,
    headerColor: '#000000',
    backgroundColor: '#000000',
    ready(){}, expand(){}, close(){},
    setHeaderColor(){}, setBackgroundColor(){},
    onEvent(){}, offEvent(){},
    MainButton: { text:'', color:'', textColor:'', isVisible:false, isActive:false, isProgressVisible:false, setText(){}, onClick(){}, offClick(){}, show(){}, hide(){}, enable(){}, disable(){}, showProgress(){}, hideProgress(){} },
    BackButton: { isVisible:false, onClick(){}, offClick(){}, show(){}, hide(){} },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
  };
  Object.defineProperty(window, 'Telegram', { value: { WebApp }, writable: true, configurable: true });
})();`;

async function applyMocks(page) {
  const mocks = buildMocks();
  const overrides = {
    '/api/store-runs/active': () => ({ success: true, data: [] }),
    '/api/budget/debts': () => ({ success: true, data: [] }),
    '/api/budget/credits': () => ({ success: true, data: [] }),
    '/api/recurring-polls': () => ({ success: true, data: [] }),
  };
  const all = { ...mocks, ...overrides };
  const regexRoutes = all.__regex || [];

  // CDN telegram-web-app.js глушим — иначе он перезапишет мок window.Telegram
  await page.route('**://telegram.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }),
  );

  await page.route(/\/api\//, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = (obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
    if (all[pathname]) return json(all[pathname]());
    for (const [rx, fn] of regexRoutes) if (rx.test(pathname)) return json(fn());
    const prefixes = Object.keys(all).filter((k) => k.startsWith('/api')).sort((a, b) => b.length - a.length);
    for (const p of prefixes) if (pathname === p || pathname.startsWith(p + '/')) return json(all[p]());
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return json({ success: true, data: {} });
    return json({ success: true, data: null });
  });
}

const SHOTS = [
  ['home', '/'],
  ['poll-history', '/poll/history'],
];

const server = await startStaticServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await context.addInitScript(tgInit(theme));
  const page = await context.newPage();
  await applyMocks(page);
  for (const [slug, route] of SHOTS) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const file = path.join(OUT_DIR, `${slug}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log('->', path.basename(file));
  }
  await context.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
