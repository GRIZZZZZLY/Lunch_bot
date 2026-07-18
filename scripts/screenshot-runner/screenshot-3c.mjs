/* Phase 3C: COLLECTING в разных ролях/состояниях. Мокаем GET /store-runs/5 и
   /auth/validate (id зрителя определяет participant/initiator). dist (prod). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-3c');
const PORT = 5197;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.map': 'application/json' };

function startServer() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const server = http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const full = path.join(DIST_DIR, rel);
      if (full.startsWith(DIST_DIR)) {
        try { const st = await fs.stat(full); if (st.isFile()) { res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' }); return res.end(await fs.readFile(full)); } } catch {}
      }
      res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(await fs.readFile(indexPath));
    } catch (err) { res.writeHead(500); res.end(String(err)); }
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

const tgInit = (theme) => `(function(){try{localStorage.removeItem('rl-theme');}catch(e){}
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'X',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

const user = (id, firstName) => ({ id, telegramId: String(1000 + id), firstName, username: firstName.toLowerCase(), isAdmin: false, createdAt: '2026-01-01T00:00:00Z' });

function runPayload({ items, minutesLeft = 14 }) {
  const now = Date.now();
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка у офиса', status: 'COLLECTING',
    collectUntil: new Date(now + minutesLeft * 60000).toISOString(),
    shoppingAt: null, settledAt: null, cancelledAt: null,
    createdAt: new Date(now - 6 * 60000).toISOString(), updatedAt: new Date(now).toISOString(),
    initiator: user(1, 'Игорь'),
    items,
  };
}

const ITEMS = [
  { id: 10, storeRunId: 5, userId: 2, name: 'Молоко 3.2%', quantity: 2, notes: 'синюю пачку', price: null, status: 'REQUESTED', createdAt: '', updatedAt: '', user: user(2, 'Аня') },
  { id: 11, storeRunId: 5, userId: 3, name: 'Хлеб бородинский', quantity: 1, notes: null, price: null, status: 'REQUESTED', createdAt: '', updatedAt: '', user: user(3, 'Пётр') },
  { id: 12, storeRunId: 5, userId: 3, name: 'Кофе в зёрнах Lavazza Qualità Rossa', quantity: 1, notes: 'тёмная обжарка, если есть', price: null, status: 'REQUESTED', createdAt: '', updatedAt: '', user: user(3, 'Пётр') },
];

async function applyMocks(page, viewerId, run) {
  await page.route('**://telegram.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p.endsWith('/auth/validate')) return json({ success: true, data: { user: user(viewerId, viewerId === 1 ? 'Игорь' : 'Пётр'), accessToken: 't' } });
    if (p.endsWith('/user/groups')) return json({ success: true, data: [{ id: 1, title: 'Офис', telegramId: '-100', type: 'group', isActive: true, role: viewerId === 1 ? 'ADMIN' : 'MEMBER' }] });
    if (p.endsWith('/store-runs/5')) return json({ success: true, data: run });
    if (p.endsWith('/store-runs/active')) return json({ success: true, data: [] });
    return json({ success: true, data: [] });
  });
}

const server = await startServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

const SHOTS = [
  ['participant-light', 'light', 3, runPayload({ items: ITEMS }), 430],
  ['participant-dark', 'dark', 3, runPayload({ items: ITEMS }), 430],
  ['initiator-dark', 'dark', 1, runPayload({ items: ITEMS }), 430],
  ['empty-dark', 'dark', 1, runPayload({ items: [] }), 430],
  ['expired-light', 'light', 3, runPayload({ items: ITEMS, minutesLeft: -1 }), 430],
  ['participant-320', 'light', 3, runPayload({ items: ITEMS }), 320],
];

for (const [slug, theme, viewerId, run, width] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${slug}] pageerror`, e.message));
  await applyMocks(page, viewerId, run);
  await page.goto(`http://localhost:${PORT}/store-run/5`, { waitUntil: 'load' });
  try {
    await page.waitForSelector('text=Пятёрочка у офиса', { timeout: 12000 });
  } catch {
    console.error(`[${slug}] not rendered; body:`, (await page.textContent('body'))?.slice(0, 150));
    await ctx.close(); continue;
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: false });
  console.log('->', `${slug}.png`);
  await ctx.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
