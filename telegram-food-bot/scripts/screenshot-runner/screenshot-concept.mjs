import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 1.5 });
const file = path.resolve('../../frontend-new/docs/design-directions/concept-lunch-ticket.html');
await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({
  path: path.resolve('../../frontend-new/docs/design-directions/shots/concept-lunch-ticket.png'),
  fullPage: false,
});
console.log('-> concept-lunch-ticket.png');
await browser.close();
