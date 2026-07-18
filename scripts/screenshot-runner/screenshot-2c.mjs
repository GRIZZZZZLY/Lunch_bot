/* Phase 2C: витрина примитивов /dev/ui (нужен build --mode development в dist-dev).
   Кадры: light/dark @430, light @320 (минимальная ширина), confirm-dialog открыт.
   Запуск: node screenshot-2c.mjs (из scripts/screenshot-runner). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { buildMocks } from './mocks.mjs';

const DIST_DIR = path.resolve('../../frontend-new/dist-dev');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-2c');
const PORT = 5198;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function startStaticServer() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const server = http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const full = path.join(DIST_DIR, rel);
      if (full.startsWith(DIST_DIR)) {
        try {
          const st = await fs.stat(full);
          if (st.isFile()) {
            res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
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
    initDataUnsafe: { user: { id: 1, first_name: 'Иван', username: 'ivan', language_code: 'ru' }, auth_date: 0, hash: 'mock', start_param: null },
    colorScheme: ${JSON.stringify(theme)},
    themeParams: {}, isExpanded: true, viewportHeight: 932, viewportStableHeight: 932,
    headerColor: '#000', backgroundColor: '#000',
    ready(){}, expand(){}, close(){}, setHeaderColor(){}, setBackgroundColor(){}, onEvent(){}, offEvent(){},
    MainButton: { setText(){}, onClick(){}, offClick(){}, show(){}, hide(){}, enable(){}, disable(){}, showProgress(){}, hideProgress(){} },
    BackButton: { isVisible:false, onClick(){}, offClick(){}, show(){}, hide(){} },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
  };
  Object.defineProperty(window, 'Telegram', { value: { WebApp }, writable: true, configurable: true });
})();`;

async function applyMocks(page) {
  const mocks = buildMocks();
  await page.route('**://telegram.org/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }),
  );
  await page.route(/\/api\//, (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
    if (mocks[pathname]) return json(mocks[pathname]());
    return json({ success: true, data: [] });
  });
}

const server = await startStaticServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

const SHOTS = [
  ['ui-light-430', 'light', 430, false],
  ['ui-dark-430', 'dark', 430, false],
  ['ui-light-320', 'light', 320, false],
  ['ui-confirm-dark-430', 'dark', 430, true],
];

for (const [slug, theme, width, openConfirm] of SHOTS) {
  const context = await browser.newContext({ viewport: { width, height: 932 }, deviceScaleFactor: 2 });
  await context.addInitScript(tgInit(theme));
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console]', msg.text().slice(0, 200));
  });
  await applyMocks(page);
  await page.goto(`http://localhost:${PORT}/dev/ui`, { waitUntil: 'load' });
  try {
    await page.waitForSelector('h2:has-text("Button")', { timeout: 12000 });
  } catch {
    await page.screenshot({ path: path.join(OUT_DIR, `${slug}-DEBUG.png`), fullPage: true });
    console.error(`[${slug}] showcase не отрендерился — см. ${slug}-DEBUG.png; body:`,
      (await page.textContent('body'))?.slice(0, 200));
    await context.close();
    continue;
  }
  await page.waitForTimeout(900);
  if (!openConfirm) {
    // fixed BottomNavigation при fullPage-скрине ложится поверх середины страницы
    await page.addStyleTag({ content: 'nav.bottomnav { display: none !important; }' });
  }
  if (openConfirm) {
    await page.getByRole('button', { name: 'Удалить позицию' }).click();
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: !openConfirm });
  console.log('->', `${slug}.png`);
  await context.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
