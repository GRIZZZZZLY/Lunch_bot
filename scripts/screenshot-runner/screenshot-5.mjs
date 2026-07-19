/* Phase 5: Меню (админ/участник) и Предложения. dist (prod). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const DIST = path.resolve('../../frontend-new/dist');
const OUT = path.resolve('../../frontend-new/docs/frontend-redesign/screenshots/phase-5');
const PORT = 5195;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.map':'application/json' };

function serve() {
  const idx = path.join(DIST, 'index.html');
  const s = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent(new URL(req.url,'http://x').pathname); if(rel==='/')rel='/index.html'; const f=path.join(DIST,rel); try{ const st=await fs.stat(f); if(st.isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); return res.end(await fs.readFile(f));} }catch{} res.writeHead(200,{'Content-Type':MIME['.html']}); res.end(await fs.readFile(idx)); }catch(e){res.writeHead(500);res.end(String(e));} });
  return new Promise(r=>s.listen(PORT,()=>r(s)));
}

const tgInit = (theme) => `(function(){try{localStorage.removeItem('rl-theme');}catch(e){}
  const WebApp={initData:'x',initDataUnsafe:{user:{id:1,first_name:'Игорь',language_code:'ru'},auth_date:0,hash:'m',start_param:null},colorScheme:${JSON.stringify(theme)},themeParams:{},isExpanded:true,viewportHeight:932,viewportStableHeight:932,headerColor:'#000',backgroundColor:'#000',ready(){},expand(){},close(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},disableVerticalSwipes(){},MainButton:{setText(){},onClick(){},offClick(){},show(){},hide(){},enable(){},disable(){},showProgress(){},hideProgress(){}},BackButton:{isVisible:false,onClick(){},offClick(){},show(){},hide(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}}};
  Object.defineProperty(window,'Telegram',{value:{WebApp},writable:true,configurable:true});})();`;

const MENU = [
  { id:1, name:'Том-ям с креветками', description:'кокосовое молоко, кинза', category:'Супы', price:420, isActive:true },
  { id:2, name:'Пицца «Маргарита»', description:'моцарелла, томаты', category:'Пицца', price:380, isActive:true },
  { id:3, name:'Тирамису', description:'маскарпоне', category:'Десерты', price:260, isActive:true },
  { id:4, name:'Ролл «Филадельфия»', description:'лосось, сливочный сыр', category:'Роллы', price:350, isActive:false },
];
const SUGS = [
  { id:1, name:'Поке с лососем', description:'рис, авокадо, эдамаме', price:450, status:'PENDING', suggestedBy:1, createdAt:'' },
  { id:2, name:'Рамен тонкоцу', price:390, status:'APPROVED', suggestedBy:1, createdAt:'' },
  { id:3, name:'Бургер трюфельный', status:'REJECTED', rejectionReason:'слишком дорого для обеда', suggestedBy:2, createdAt:'' },
];

async function mocks(page, viewerAdmin) {
  await page.route('**://telegram.org/**', r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route(/\/api\//, route => {
    const p = new URL(route.request().url()).pathname;
    const json = o => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(p.endsWith('/auth/validate')) return json({success:true,data:{user:{id:1,firstName:'Игорь',isAdmin:viewerAdmin},accessToken:'t'}});
    if(p.endsWith('/user/groups')) return json({success:true,data:[
      {id:10,title:'Офис',telegramId:'-10',type:'group',isActive:true,role:viewerAdmin?'ADMIN':'MEMBER'},
      {id:20,title:'Розница',telegramId:'-20',type:'group',isActive:true,role:'MEMBER'}]});
    if(p.includes('/menu')) return json({success:true,data:MENU});
    if(p.includes('/suggestions')) return json({success:true,data:SUGS});
    return json({success:true,data:[]});
  });
}

const server = await serve();
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const SHOTS = [
  ['menu-admin-light','light',true,'/menu',430],
  ['menu-admin-dark','dark',true,'/menu',430],
  ['menu-viewer-light','light',false,'/menu',430],
  ['menu-320','light',true,'/menu',320],
  ['suggestions-admin-dark','dark',true,'/suggestions',430],
  ['suggestions-viewer-light','light',false,'/suggestions/mine',430],
];
for (const [slug,theme,admin,route,width] of SHOTS) {
  const ctx = await browser.newContext({ viewport:{width,height:932}, deviceScaleFactor:2 });
  await ctx.addInitScript(tgInit(theme));
  const page = await ctx.newPage();
  page.on('pageerror', e=>console.error(`[${slug}]`, e.message));
  await mocks(page, admin);
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil:'load' });
  try { await page.waitForSelector(route.includes('menu') ? 'text=Том-ям с креветками' : 'text=Поке с лососем', { timeout: 12000 }); }
  catch { console.error(`[${slug}] not rendered:`, (await page.textContent('body'))?.slice(0,120)); await ctx.close(); continue; }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${slug}.png`) });
  console.log('->', `${slug}.png`);
  await ctx.close();
}
await browser.close(); server.close();
console.log('done:', OUT);
