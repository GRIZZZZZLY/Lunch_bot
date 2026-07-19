/* Phase 6b: Бюджет команды — сценарии должника и сборщика. dist (prod). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('../../frontend-new/dist');
const OUT = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-6');
const PORT = 5197;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.map':'application/json' };

function serve() {
  const idx = path.join(DIST, 'index.html');
  const s = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent(new URL(req.url,'http://x').pathname); if(rel==='/')rel='/index.html'; const f=path.join(DIST,rel); try{ const st=await fs.stat(f); if(st.isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); return res.end(await fs.readFile(f));} }catch{} res.writeHead(200,{'Content-Type':MIME['.html']}); res.end(await fs.readFile(idx)); }catch(e){res.writeHead(500);res.end(String(e));} });
  return new Promise(r=>s.listen(PORT,()=>r(s)));
}

const tgInit = (theme) => `(function(){try{localStorage.removeItem('rl-theme');}catch(e){}
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'Игорь',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},disableVerticalSwipes(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

const tx = (o) => ({ id:1, pollId:1, amount:300, status:'PENDING', createdAt:'2026-07-20T11:30:00', ...o });

// сценарии: [slug, theme, debts, credits]
const SHOTS = [
  ['budget-debtor-light','light',
    [tx({id:1,status:'PENDING',amount:320,creditor:{id:3,firstName:'Оля'}}),
     tx({id:2,status:'PAID',amount:180,creditor:{id:4,firstName:'Ян'}})], []],
  ['budget-collector-dark','dark', [],
    [tx({id:5,status:'PAID',amount:320,debtor:{id:2,firstName:'Ян'}}),
     tx({id:6,status:'PENDING',amount:280,debtor:{id:7,firstName:'Míra'}}),
     tx({id:7,status:'CONFIRMED',amount:300,debtor:{id:8,firstName:'Лев'}})]],
  ['budget-both-light','light',
    [tx({id:1,status:'PENDING',amount:250,creditor:{id:3,firstName:'Оля'}})],
    [tx({id:5,status:'PAID',amount:200,debtor:{id:2,firstName:'Ян'}})]],
];

async function mocks(page, debts, credits) {
  await page.route('**://telegram.org/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route(/\/api\//, route => {
    const p = new URL(route.request().url()).pathname;
    const json = o => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(p.endsWith('/auth/validate')) return json({success:true,data:{user:{id:1,firstName:'Игорь',isAdmin:false},accessToken:'t'}});
    if(p.endsWith('/user/groups')) return json({success:true,data:[{id:10,title:'Офис',telegramId:'-10',type:'group',isActive:true,role:'MEMBER'}]});
    if(p.includes('/budget/debts')) return json({success:true,data:debts});
    if(p.includes('/budget/credits')) return json({success:true,data:credits});
    return json({success:true,data:[]});
  });
}

const server = await serve();
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [slug,theme,debts,credits] of SHOTS) {
  const ctx = await browser.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', e=>console.error(`[${slug}]`, e.message));
  await mocks(page, debts, credits);
  await page.goto(`http://localhost:${PORT}/budget`, { waitUntil:'load' });
  try { await page.waitForSelector('text=/Мои долги|Вам должны/', { timeout: 12000 }); }
  catch { console.error(`[${slug}] not rendered:`, (await page.textContent('body'))?.slice(0,140)); await ctx.close(); continue; }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
  console.log('->', `${slug}.png`);
  await ctx.close();
}
await browser.close(); server.close();
console.log('done:', OUT);
