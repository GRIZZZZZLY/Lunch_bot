/* Дизайн-направления: 3 темы × (home light/dark, collecting, shopping).
   Сервер отдаёт корень frontend-new (страницы ссылаются на ds-bundle). */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve('../../frontend-new');
const OUT_DIR = path.resolve('../../frontend-new/docs/design-directions/shots');
const PORT = 5194;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.map': 'application/json', '.ts': 'application/javascript' };

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const full = path.join(ROOT, rel);
      if (full.startsWith(ROOT)) {
        try {
          const st = await fs.stat(full);
          if (st.isFile()) {
            res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
            return res.end(await fs.readFile(full));
          }
        } catch {}
      }
      res.writeHead(404); res.end('nf');
    } catch (err) { res.writeHead(500); res.end(String(err)); }
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

const DIRECTIONS = [
  ['a-graphite-honey-2', 'graphite-honey-2.html'],
  ['b-telegram-native', 'telegram-native.html'],
  ['c-editorial-food', 'editorial-food.html'],
];
const FRAMES = [
  ['home-light', 'home', 'light'],
  ['home-dark', 'home', 'dark'],
  ['collecting-light', 'collecting', 'light'],
  ['shopping-light', 'shopping', 'light'],
];

const server = await startServer();
await fs.mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 438, height: 940 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message.slice(0, 160)));

for (const [slug, file] of DIRECTIONS) {
  for (const [frame, screen, theme] of FRAMES) {
    await page.goto(`http://localhost:${PORT}/docs/design-directions/${file}?screen=${screen}&theme=${theme}`, { waitUntil: 'load' });
    try {
      await page.waitForSelector('.scr-phone', { timeout: 8000 });
    } catch {
      console.error(`[${slug}/${frame}] not rendered; body:`, (await page.textContent('body'))?.slice(0, 120));
      continue;
    }
    await page.waitForTimeout(400);
    const el = await page.$('.scr-phone');
    await el.screenshot({ path: path.join(OUT_DIR, `${slug}__${frame}.png`) });
    console.log('->', `${slug}__${frame}.png`);
  }
}

await browser.close();
server.close();
console.log('done:', OUT_DIR);
