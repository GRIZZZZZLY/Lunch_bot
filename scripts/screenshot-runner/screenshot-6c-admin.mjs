/* Phase 6b: /admin — оценка текущего вида карточек. dist (prod). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('../../frontend-new/dist');
const OUT = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-6');
const PORT = 5198;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.map':'application/json' };

function serve() {
  const idx = path.join(DIST, 'index.html');
  const s = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent(new URL(req.url,'http://x').pathname); if(rel==='/')rel='/index.html'; const f=path.join(DIST,rel); try{ const st=await fs.stat(f); if(st.isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); return res.end(await fs.readFile(f));} }catch{} res.writeHead(200,{'Content-Type':MIME['.html']}); res.end(await fs.readFile(idx)); }catch(e){res.writeHead(500);res.end(String(e));} });
  return new Promise(r=>s.listen(PORT,()=>r(s)));
}

const tgInit = (theme) => `(function(){try{localStorage.removeItem('rl-theme');}catch(e){}
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'Игорь',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},disableVerticalSwipes(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

const USERS = [
  { id:1, firstName:'Игорь', username:'grizzly', isAdmin:true, isActive:true, participatesInPolls:true },
  { id:2, firstName:'Оля', username:'olya', isAdmin:false, isActive:true, participatesInPolls:true },
  { id:3, firstName:'Ян', isAdmin:false, isActive:true, participatesInPolls:false },
];
const DEBTORS = [
  { userId:2, userName:'Оля', debtCount:2, totalDebt:520,
    debts:[{id:11,amount:320,toUser:{firstName:'Игорь'}},{id:12,amount:200,toUser:{firstName:'Лев'}}] },
  { userId:3, userName:'Ян', debtCount:1, totalDebt:180,
    debts:[{id:13,amount:180,toUser:{firstName:'Игорь'}}] },
];
const POLLS_ACTIVE = [{ id:41, status:'ACTIVE', createdAt:'2026-07-20T11:00:00', closedAt:'2026-07-20T13:00:00', groupId:10, _count:{votes:3}, menuItems:[] }];

async function mocks(page) {
  await page.route('**://telegram.org/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route(/\/api\//, route => {
    const p = new URL(route.request().url()).pathname;
    const json = o => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(p.endsWith('/auth/validate')) return json({success:true,data:{user:{id:1,firstName:'Игорь',isAdmin:true},accessToken:'t'}});
    if(p.endsWith('/user/groups')) return json({success:true,data:[{id:10,title:'Офис',telegramId:'-10',type:'group',isActive:true,role:'ADMIN'}]});
    if(p.endsWith('/polls/active')) return json({success:true,data:POLLS_ACTIVE});
    if(p.endsWith('/polls')) return json({success:true,data:{polls:[],total:0,limit:60,offset:0,hasNext:false}});
    if(p.includes('/menu')) return json({success:true,data:[{id:1,name:'Плов',category:'Горячее',price:300,isActive:true},{id:2,name:'Суп',category:'Супы',price:200,isActive:true}]});
    if(p.endsWith('/admin/users')) return json({success:true,data:USERS});
    if(p.endsWith('/admin/debtors')) return json({success:true,data:DEBTORS});
    if(p.endsWith('/admin/debt-stats')) return json({success:true,data:{totalDebtors:2,totalDebtAmount:700,avgDebtPerUser:350,oldestDebtAge:2}});
    return json({success:true,data:[]});
  });
}

const server = await serve();
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const SHOTS = [
  ['admin-dashboard-light','light','Обзор'],
  ['admin-dashboard-dark','dark','Обзор'],
  ['admin-users-dark','dark','Люди'],
  ['admin-debts-light','light','Долги'],
];
for (const [slug,theme,tabLabel] of SHOTS) {
  const ctx = await browser.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', e=>console.error(`[${slug}]`, e.message));
  await mocks(page);
  await page.goto(`http://localhost:${PORT}/admin`, { waitUntil:'load' });
  try { await page.waitForSelector('text=Админ-панель', { timeout: 12000 }); } catch { console.error(`[${slug}] no admin`, (await page.textContent('body'))?.slice(0,120)); await ctx.close(); continue; }
  if (tabLabel !== 'Обзор') { try { await page.click(`text=${tabLabel}`); await page.waitForTimeout(700); } catch {} }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${slug}.png`), fullPage: true });
  console.log('->', `${slug}.png`);
  await ctx.close();
}
await browser.close(); server.close();
console.log('done:', OUT);
