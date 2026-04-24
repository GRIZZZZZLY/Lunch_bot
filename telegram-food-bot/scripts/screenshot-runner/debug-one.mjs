import { chromium } from 'playwright';
import { BASE_USER, buildMocks } from './mocks.mjs';

const BASE_URL = 'http://localhost:5174';

const initScript = `
(function(){
  try { localStorage.setItem('food_bot_onboarding_completed', 'true'); localStorage.setItem('food_bot_onboarding_completed_version', 'v1'); } catch(e) {}
  const WebApp = {
    initData: 'mock_init_data',
    initDataUnsafe: { user: { id: 123456789, first_name: 'Иван', last_name: 'Иванов', username: 'testuser', language_code: 'ru' }, auth_date: Math.floor(Date.now()/1000), hash: 'mock', start_param: null },
    colorScheme: 'light',
    themeParams: { bg_color: '#fbf7f1', text_color: '#2b2118' },
    isExpanded: true, viewportHeight: 932, viewportStableHeight: 932,
    headerColor: '#fbf7f1', backgroundColor: '#fbf7f1',
    ready: () => {}, expand: () => {}, close: () => {}, setHeaderColor: () => {}, setBackgroundColor: () => {},
    onEvent: () => {}, offEvent: () => {},
    MainButton: { text:'', color:'', textColor:'', isVisible:false, isActive:false, isProgressVisible:false, setText:()=>{}, onClick:()=>{}, offClick:()=>{}, show:()=>{}, hide:()=>{}, enable:()=>{}, disable:()=>{}, showProgress:()=>{}, hideProgress:()=>{} },
    BackButton: { isVisible:false, onClick:()=>{}, offClick:()=>{}, show:()=>{}, hide:()=>{} },
    HapticFeedback: { impactOccurred:()=>{}, notificationOccurred:()=>{}, selectionChanged:()=>{} },
  };
  try { window.Telegram = { WebApp }; } catch(e) {}
})();
`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, colorScheme: 'light', locale: 'ru-RU' });
await ctx.addInitScript(initScript);
const page = await ctx.newPage();

const mocks = buildMocks('default');
const regexRoutes = mocks.__regex || [];
await page.route(/\/api\//, (route) => {
  const p = new URL(route.request().url()).pathname;
  const json = (obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });
  if (mocks[p]) return json(mocks[p]());
  for (const [rx, fn] of regexRoutes) if (rx.test(p)) return json(fn());
  const prefixes = Object.keys(mocks).filter((k) => typeof k === 'string' && k.startsWith('/api')).sort((a, b) => b.length - a.length);
  for (const pp of prefixes) if (p === pp || p.startsWith(pp + '/')) return json(mocks[pp]());
  return json({ success: true, data: null });
});

page.on('console', msg => console.log(`[console ${msg.type()}]`, msg.text().slice(0, 200)));
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
page.on('requestfailed', req => console.log('[REQUEST FAILED]', req.url(), req.failure()?.errorText));

await page.goto(`${BASE_URL}/menu`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const title = await page.title();
const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 500));
console.log('--- title:', title);
console.log('--- body html (first 500):', bodyHTML);

await browser.close();
