/* Phase 3D: baseline-скриншоты SHOPPING для Penpot handoff. Длинные реальные
   данные, все ключевые состояния. Использует prod dist. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-3d');
const PORT = 5196;

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

const user = (id, firstName) => ({ id, telegramId: String(1000 + id), firstName, username: 'u' + id, isAdmin: false, createdAt: '2026-01-01T00:00:00Z' });

const STORE = 'Супермаркет Перекрёсток у станции метро';
const LONG_ITEM = 'Кофе Lavazza Qualità Oro молотый, упаковка 250 г';
const LONG_NOTE = 'Нужна именно синяя упаковка, не брать обезжиренное';
const LONG_NAME = 'Александра Константиновна';

let iid = 0;
const item = (userId, name, status, price = null, extra = {}) => ({
  id: ++iid, storeRunId: 5, userId, name,
  quantity: extra.quantity ?? 1, notes: extra.notes ?? null, price, status,
  createdAt: '', updatedAt: '',
  user: user(userId, userId === 1 ? 'Игорь' : userId === 2 ? 'Аня' : LONG_NAME),
});

function shoppingRun(items) {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: STORE, status: 'SHOPPING',
    collectUntil: '2026-07-18T10:00:00Z', shoppingAt: new Date().toISOString(),
    settledAt: null, cancelledAt: null, createdAt: '2026-07-18T09:30:00Z', updatedAt: '',
    initiator: user(1, 'Игорь'), items,
  };
}

const allRequested = () => { iid = 0; return shoppingRun([
  item(3, LONG_ITEM, 'REQUESTED', null, { quantity: 2, notes: LONG_NOTE }),
  item(2, 'Молоко 3.2%', 'REQUESTED'),
  item(3, 'Хлеб бородинский', 'REQUESTED'),
]); };

const mixed = () => { iid = 0; return shoppingRun([
  item(3, LONG_ITEM, 'REQUESTED', null, { quantity: 2, notes: LONG_NOTE }),
  item(2, 'Молоко 3.2%', 'BOUGHT', '112.5'),
  item(3, 'Хлеб бородинский', 'NOT_FOUND'),
  item(1, 'Сыр Ламбер 45%', 'BOUGHT', '320'),
]); };

const noPrice = () => { iid = 0; return shoppingRun([
  item(2, 'Молоко 3.2%', 'BOUGHT', null),
  item(3, 'Хлеб бородинский', 'BOUGHT', '90'),
]); };

async function applyMocks(page, viewerId, run, { fail = false } = {}) {
  await page.route('**://telegram.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (p.endsWith('/auth/validate')) return json({ success: true, data: { user: user(viewerId, viewerId === 1 ? 'Игорь' : LONG_NAME), accessToken: 't' } });
    if (p.endsWith('/user/groups')) return json({ success: true, data: [{ id: 1, title: 'Офис', telegramId: '-100', type: 'group', isActive: true, role: 'MEMBER' }] });
    if (p.endsWith('/store-runs/5')) {
      if (fail) return json({ success: false, error: 'Internal error' }, 500);
      return json({ success: true, data: run });
    }
    return json({ success: true, data: [] });
  });
}

const server = await startServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

// [slug, theme, viewerId, run, width, action, waitText]
const SHOTS = [
  ['init-requested-light', 'light', 1, allRequested(), 430, null],
  ['init-mixed-dark', 'dark', 1, mixed(), 430, null],
  ['init-price-open-dark', 'dark', 1, allRequested(), 430, 'openPrice'],
  ['init-settle-confirm-light', 'light', 1, mixed(), 430, 'settle'],
  ['init-noprice-critical-dark', 'dark', 1, noPrice(), 430, null],
  ['participant-light', 'light', 3, mixed(), 430, null],
  ['participant-320', 'light', 3, mixed(), 320, null],
  ['empty-dark', 'dark', 1, shoppingRun([]), 430, null],
  ['error-network-light', 'light', 1, null, 430, null, { fail: true }],
];

for (const [slug, theme, viewerId, run, width, action, opts] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${slug}] pageerror`, e.message));
  await applyMocks(page, viewerId, run, opts);
  await page.goto(`http://localhost:${PORT}/store-run/5`, { waitUntil: 'load' });
  try {
    if (opts?.fail) await page.waitForSelector('text=Не удалось загрузить', { timeout: 12000 });
    else await page.waitForSelector(`text=${STORE.slice(0, 20)}`, { timeout: 12000 });
  } catch {
    console.error(`[${slug}] not rendered; body:`, (await page.textContent('body'))?.slice(0, 160));
    await ctx.close(); continue;
  }
  if (action === 'openPrice') {
    await page.getByRole('button', { name: 'Куплено' }).first().click();
    await page.waitForSelector('text=Цена за всё', { timeout: 5000 });
  }
  if (action === 'settle') {
    await page.getByRole('button', { name: 'Рассчитать' }).click();
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: false });
  console.log('->', `${slug}.png`);
  await ctx.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
