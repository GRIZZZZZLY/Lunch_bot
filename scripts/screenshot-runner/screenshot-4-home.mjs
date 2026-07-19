/* Phase 4: Главная (система C) — талон с живым таймером, «Сейчас», пустой талон. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-4');
const PORT = 5198;

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
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'Игорь',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},disableVerticalSwipes(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

const user = { id: 1, telegramId: '1001', firstName: 'Игорь', username: 'igor', isAdmin: false, createdAt: '2026-01-01T00:00:00Z' };
const MENU = [
  { id: 1, name: 'Том-ям с креветками', category: 'Азиатская', price: 420, isActive: true },
  { id: 2, name: 'Пицца «Маргарита»', category: 'Пицца', price: 380, isActive: true },
  { id: 3, name: 'Шаурма классическая', category: 'Азиатская', price: 290, isActive: true },
];
const votes = (id, n) => Array.from({ length: n }, (_, i) => ({ id: id * 100 + i, menuItemId: id, userId: 100 + i }));
const POLL = {
  id: 10, status: 'ACTIVE', duration: 30,
  createdAt: new Date(Date.now() - (30 * 60_000 - 12 * 60_000 - 41_000)).toISOString(), // осталось 12:41
  selectedMenuItemIds: JSON.stringify([1, 2, 3]),
  votes: [...votes(1, 6), ...votes(2, 4), ...votes(3, 3)],
  _count: { votes: 13, participants: 15 },
};
const RUN = { id: 5, groupId: 1, initiatorId: 2, storeName: 'Пятёрочка у офиса', status: 'SHOPPING', collectUntil: new Date().toISOString(), shoppingAt: new Date().toISOString(), settledAt: null, cancelledAt: null, createdAt: '', updatedAt: '', initiator: { id: 2, firstName: 'Игорь' }, items: [{}, {}] };

async function applyMocks(page, { withPoll }) {
  await page.route('**://telegram.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/* stub */' }));
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p.endsWith('/auth/validate')) return json({ success: true, data: { user, accessToken: 't' } });
    if (p.endsWith('/user/groups')) return json({ success: true, data: [{ id: 1, title: 'Офис', telegramId: '-100', type: 'group', isActive: true, role: 'ADMIN' }] });
    if (p.endsWith('/polls/active')) return json({ success: true, data: withPoll ? [POLL] : [] });
    if (/\/polls\/\d+\/my-votes/.test(p)) return json({ success: true, data: { menuItemIds: [1] } });
    if (p.includes('/polls/last-completed')) return json({ success: true, data: null });
    if (p.endsWith('/menu') || p.endsWith('/menu/active')) return json({ success: true, data: MENU });
    if (p.endsWith('/budget/debts')) return json({ success: true, data: [{ id: 7, amount: 260, status: 'PENDING', creditor: { firstName: 'Аня' } }] });
    if (p.endsWith('/budget/credits')) return json({ success: true, data: [] });
    if (p.endsWith('/store-runs/active')) return json({ success: true, data: [RUN] });
    if (p.includes('/events') || p.includes('/sse')) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' });
    return json({ success: true, data: [] });
  });
}

const server = await startServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

const SHOTS = [
  ['home-light', 'light', { withPoll: true }, 430],
  ['home-dark', 'dark', { withPoll: true }, 430],
  ['home-empty-light', 'light', { withPoll: false }, 430],
  ['home-320', 'light', { withPoll: true }, 320],
];

for (const [slug, theme, opts, width] of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${slug}] pageerror`, e.message));
  await applyMocks(page, opts);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  try {
    await page.waitForSelector('text=Обеденный талон', { timeout: 12000 });
  } catch {
    console.error(`[${slug}] not rendered; body:`, (await page.textContent('body'))?.slice(0, 160));
    await ctx.close(); continue;
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, `${slug}.png`), fullPage: false });
  console.log('->', `${slug}.png`);
  await ctx.close();
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
