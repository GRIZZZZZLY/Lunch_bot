/* Phase 3E: baseline-скриншоты SETTLED/CANCELLED. Prod dist, длинные данные. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-3e');
const PORT = 5195;

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

function run(status, items, { shoppingAt = '2026-07-18T10:05:00Z' } = {}) {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: STORE, status,
    collectUntil: '2026-07-18T10:00:00Z', shoppingAt,
    settledAt: status === 'SETTLED' ? '2026-07-18T11:00:00Z' : null,
    cancelledAt: status === 'CANCELLED' ? '2026-07-18T11:00:00Z' : null,
    createdAt: '2026-07-18T09:30:00Z', updatedAt: '',
    initiator: user(1, 'Игорь'), items,
  };
}

const settledMixed = () => { iid = 0; return run('SETTLED', [
  item(3, LONG_ITEM, 'BOUGHT', '612.5', { quantity: 2, notes: LONG_NOTE }),
  item(2, 'Молоко 3.2%', 'BOUGHT', '112.5'),
  item(2, 'Кефир 1%', 'NOT_FOUND'),
  item(3, 'Хлеб бородинский', 'REQUESTED'),
  item(1, 'Сыр Ламбер 45%', 'BOUGHT', '320'),
]); };

const settledNoDebtViewer = settledMixed; // зритель id=2? у Ани есть BOUGHT — возьмём зрителя без BOUGHT
const settledZeroForViewer = () => { iid = 0; return run('SETTLED', [
  item(2, 'Кефир 1%', 'NOT_FOUND'),
  item(1, 'Сыр Ламбер 45%', 'BOUGHT', '320'),
]); };

const cancelledItems = () => { iid = 0; return run('CANCELLED', [
  item(3, LONG_ITEM, 'REQUESTED', null, { quantity: 2, notes: LONG_NOTE }),
  item(2, 'Молоко 3.2%', 'REQUESTED'),
], { shoppingAt: null }); };

const cancelledAuto = () => { iid = 0; return run('CANCELLED', [
  item(3, LONG_ITEM, 'BOUGHT', '612.5', { quantity: 2 }),
  item(2, 'Молоко 3.2%', 'REQUESTED'),
]); };

async function applyMocks(page, viewerId, payload) {
  await page.route('**://telegram.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    if (p.endsWith('/auth/validate')) return json({ success: true, data: { user: user(viewerId, viewerId === 1 ? 'Игорь' : viewerId === 2 ? 'Аня' : LONG_NAME), accessToken: 't' } });
    if (p.endsWith('/user/groups')) return json({ success: true, data: [{ id: 1, title: 'Офис', telegramId: '-100', type: 'group', isActive: true, role: 'MEMBER' }] });
    if (p.endsWith('/store-runs/5')) return json({ success: true, data: payload });
    return json({ success: true, data: [] });
  });
}

const server = await startServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

const SHOTS = [
  ['settled-participant-debt-light', 'light', 3, settledMixed(), 430],
  ['settled-participant-debt-dark', 'dark', 3, settledMixed(), 430],
  ['settled-participant-nodebt-light', 'light', 2, settledZeroForViewer(), 430],
  ['settled-initiator-dark', 'dark', 1, settledMixed(), 430],
  ['settled-320', 'light', 3, settledMixed(), 320],
  ['cancelled-manual-light', 'light', 3, cancelledItems(), 430],
  ['cancelled-auto-dark', 'dark', 3, cancelledAuto(), 430],
  ['cancelled-empty-dark', 'dark', 2, run('CANCELLED', [], { shoppingAt: null }), 430],
  ['cancelled-320', 'light', 3, cancelledAuto(), 320],
];

for (const [slug, theme, viewerId, payload, width] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${slug}] pageerror`, e.message));
  await applyMocks(page, viewerId, payload);
  await page.goto(`http://localhost:${PORT}/store-run/5`, { waitUntil: 'load' });
  try {
    await page.waitForSelector(`text=${STORE.slice(0, 20)}`, { timeout: 12000 });
  } catch {
    console.error(`[${slug}] not rendered; body:`, (await page.textContent('body'))?.slice(0, 160));
    await ctx.close(); continue;
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: true });
  console.log('->', `${slug}.png`);
  await ctx.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
