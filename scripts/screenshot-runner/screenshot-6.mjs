/* Phase 6a: Профиль, Статистика, Итоги, История. dist (prod). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('../../frontend-new/dist');
const OUT = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-6');
const PORT = 5196;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.map':'application/json' };

function serve() {
  const idx = path.join(DIST, 'index.html');
  const s = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent(new URL(req.url,'http://x').pathname); if(rel==='/')rel='/index.html'; const f=path.join(DIST,rel); try{ const st=await fs.stat(f); if(st.isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); return res.end(await fs.readFile(f));} }catch{} res.writeHead(200,{'Content-Type':MIME['.html']}); res.end(await fs.readFile(idx)); }catch(e){res.writeHead(500);res.end(String(e));} });
  return new Promise(r=>s.listen(PORT,()=>r(s)));
}

const tgInit = (theme) => `(function(){try{localStorage.removeItem('rl-theme');}catch(e){}
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'Игорь',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},disableVerticalSwipes(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

// История: июль-2026, разные недели и статусы. Победители/голоса для статистики.
const vote = (id, uid, name, mid, dish) => ({ id, userId: uid, menuItemId: mid, user: { id: uid, firstName: name }, menuItem: { id: mid, name: dish } });
const HIST = [
  { id: 41, status: 'COMPLETED', createdAt: '2026-07-17T11:00:00', _count: { votes: 4 },
    votes: [vote(1,1,'Игорь',1,'Том-ям'), vote(2,2,'Оля',1,'Том-ям'), vote(3,3,'Ян',2,'Пицца'), vote(4,4,'Míra',1,'Том-ям')] },
  { id: 40, status: 'COMPLETED', createdAt: '2026-07-16T11:00:00', _count: { votes: 3 },
    votes: [vote(5,1,'Игорь',2,'Пицца'), vote(6,2,'Оля',2,'Пицца'), vote(7,3,'Ян',2,'Пицца')] },
  { id: 39, status: 'CANCELLED', createdAt: '2026-07-10T11:00:00', _count: { votes: 0 }, votes: [] },
  { id: 38, status: 'COMPLETED', createdAt: '2026-07-08T11:00:00', _count: { votes: 3 },
    votes: [vote(8,1,'Игорь',1,'Том-ям'), vote(9,2,'Оля',3,'Тирамису'), vote(10,4,'Míra',1,'Том-ям')] },
  { id: 37, status: 'COMPLETED', createdAt: '2026-07-02T11:00:00', _count: { votes: 2 },
    votes: [vote(11,2,'Оля',2,'Пицца'), vote(12,3,'Ян',2,'Пицца')] },
];
const POLL7 = {
  id: 41, status: 'COMPLETED', createdAt: '2026-07-17T11:00:00', groupId: 10,
  menuItems: [
    { menuItemId: 1, menuItem: { id: 1, name: 'Том-ям с креветками', category: 'Супы' }, _count: { votes: 3 } },
    { menuItemId: 2, menuItem: { id: 2, name: 'Пицца «Маргарита»', category: 'Пицца' }, _count: { votes: 1 } },
  ],
  votes: HIST[0].votes,
};
const RESULTS7 = { winnerId: 1, winnerName: 'Том-ям с креветками', totalVotes: 4, responsible: { name: 'Оля' } };

async function mocks(page) {
  await page.route('**://telegram.org/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route(/\/api\//, route => {
    const p = new URL(route.request().url()).pathname;
    const json = o => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(p.endsWith('/auth/validate')) return json({success:true,data:{user:{id:1,firstName:'Игорь',username:'grizzly',isAdmin:true},accessToken:'t'}});
    if(p.endsWith('/user/groups')) return json({success:true,data:[{id:10,title:'Офис',telegramId:'-10',type:'group',isActive:true,role:'ADMIN'}]});
    if(p.endsWith('/user/payment-info')) return json({success:true,data:{sbpPhone:'+79261234567',bankName:'Т-Банк'}});
    if(p.endsWith('/polls/41/results')) return json({success:true,data:RESULTS7});
    if(p.endsWith('/polls/41')) return json({success:true,data:POLL7});
    if(p.endsWith('/polls')) return json({success:true,data:{polls:HIST,total:HIST.length,limit:60,offset:0,hasNext:false}});
    if(p.includes('/events')) return route.fulfill({status:200,contentType:'text/event-stream',body:''});
    return json({success:true,data:[]});
  });
}

const server = await serve();
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const SHOTS = [
  ['profile-light','light','/profile','Реквизиты для переводов',430],
  ['profile-dark','dark','/profile','Реквизиты для переводов',430],
  ['stats-light','light','/stats','Ваше участие',430],
  ['stats-dark','dark','/stats','Ваше участие',430],
  ['results-dark','dark','/poll/41/results','Команда выбрала',430],
  ['history-light','light','/poll/history','Завершено',430],
  ['profile-320','light','/profile','Реквизиты для переводов',320],
];
for (const [slug,theme,route,waitText,width] of SHOTS) {
  const ctx = await browser.newContext({ viewport:{width,height:932}, deviceScaleFactor:2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', e=>console.error(`[${slug}]`, e.message));
  await mocks(page);
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil:'load' });
  try { await page.waitForSelector(`text=${waitText}`, { timeout: 12000 }); }
  catch { console.error(`[${slug}] not rendered:`, (await page.textContent('body'))?.slice(0,140)); await ctx.close(); continue; }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
  console.log('->', `${slug}.png`);
  await ctx.close();
}
await browser.close(); server.close();
console.log('done:', OUT);
