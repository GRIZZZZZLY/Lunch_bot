import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '../../frontend-new/node_modules/playwright/index.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..', '..');
const outputDir = path.join(
  root,
  'frontend-new',
  'test-results',
  'readme-preview',
);
const readmePath = path.join(root, 'README.md');

const markdown = await readFile(readmePath, 'utf8');
const response = await fetch('https://api.github.com/markdown', {
  method: 'POST',
  headers: {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'rocket-lunch-readme-preview',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({ text: markdown, mode: 'gfm' }),
});

if (!response.ok) {
  throw new Error(`GitHub Markdown API returned ${response.status}`);
}

const rendered = await response.text();
const base = pathToFileURL(`${root}${path.sep}`).href;
const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${base}">
  <title>Rocket Lunch README preview</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f6f8fa;
      color: #1f2328;
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .markdown-body {
      width: min(1012px, 100%);
      min-height: 100vh;
      margin: 0 auto;
      padding: 42px 46px 72px;
      background: #fff;
    }
    h1, h2, h3 {
      line-height: 1.25;
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    h2 { padding-bottom: .3em; border-bottom: 1px solid #d0d7de; }
    h3 { font-size: 1.25em; }
    p, ul { margin-top: 0; margin-bottom: 16px; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; height: auto; }
    code {
      padding: .2em .4em;
      border-radius: 6px;
      background: rgba(175,184,193,.2);
      font: 85% ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    pre {
      overflow: auto;
      padding: 16px;
      border-radius: 6px;
      background: #f6f8fa;
    }
    pre code { padding: 0; background: transparent; font-size: 85%; }
    li + li { margin-top: .25em; }
    .mermaid {
      overflow: auto;
      padding: 18px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      color: #57606a;
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    @media (max-width: 600px) {
      .markdown-body { padding: 20px 16px 48px; }
    }
  </style>
</head>
<body>
  <main class="markdown-body">${rendered}</main>
</body>
</html>`;

await mkdir(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, 'preview.html');
await writeFile(htmlPath, html, 'utf8');

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 1,
  });
  await desktop.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await desktop.screenshot({
    path: path.join(outputDir, 'preview-desktop-top.png'),
  });
  await desktop.screenshot({
    path: path.join(outputDir, 'preview-desktop-full.png'),
    fullPage: true,
  });

  const mobile = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
  });
  await mobile.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await mobile.screenshot({
    path: path.join(outputDir, 'preview-mobile-top.png'),
  });
} finally {
  await browser.close();
}

console.log(outputDir);
