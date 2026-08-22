import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { BASE_USER, buildMocks } from './mocks.mjs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const DIST_DIR = path.resolve('../../frontend-new/dist');
const OUT_DIR = path.resolve('../../docs/design-prompts/screenshots');
const VIEWPORT = { width: 430, height: 932 };
const STATIC_PORT = 5174;

// --- Minimal SPA-aware static server ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

async function serveFile(res, fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = await fs.readFile(fullPath);
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function startStaticServer() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const full = path.join(DIST_DIR, rel);
      if (full.startsWith(DIST_DIR)) {
        try {
          const st = await fs.stat(full);
          if (st.isFile()) return await serveFile(res, full);
        } catch {}
      }
      // SPA fallback
      return await serveFile(res, indexPath);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(STATIC_PORT, () => resolve(server)));
}

// --- Telegram WebApp mock ---
const makeTgInitScript = (theme = 'light') => {
  const isDark = theme === 'dark';
  const themeLight = {
    bg_color: '#fbf7f1', text_color: '#2b2118', hint_color: '#9c8b79',
    link_color: '#d86a2c', button_color: '#d86a2c', button_text_color: '#ffffff',
    secondary_bg_color: '#f6efe5',
  };
  const themeDark = {
    bg_color: '#1f1712', text_color: '#f4ece3', hint_color: '#8a7867',
    link_color: '#ff9d66', button_color: '#ff9d66', button_text_color: '#1a0f08',
    secondary_bg_color: '#2a1f1a',
  };
  const themeParams = isDark ? themeDark : themeLight;
  const bg = themeParams.bg_color;

  return `
(function(){
  const user = ${JSON.stringify(BASE_USER)};
  const WebApp = {
    initData: 'mock_init_data',
    initDataUnsafe: {
      user: {
        id: user.telegramId ? Number(user.telegramId) : 123456789,
        first_name: user.firstName,
        last_name: user.lastName || '',
        username: user.username,
        language_code: 'ru',
      },
      auth_date: Math.floor(Date.now()/1000),
      hash: 'mock',
      start_param: null,
    },
    colorScheme: ${JSON.stringify(theme)},
    themeParams: ${JSON.stringify(themeParams)},
    isExpanded: true,
    viewportHeight: 932,
    viewportStableHeight: 932,
    headerColor: ${JSON.stringify(bg)},
    backgroundColor: ${JSON.stringify(bg)},
    ready: () => {},
    expand: () => {},
    close: () => {},
    setHeaderColor: () => {},
    setBackgroundColor: () => {},
    onEvent: () => {},
    offEvent: () => {},
    MainButton: {
      text: '', color: '', textColor: '', isVisible: false, isActive: false, isProgressVisible: false,
      setText: () => {}, onClick: () => {}, offClick: () => {}, show: () => {}, hide: () => {},
      enable: () => {}, disable: () => {}, showProgress: () => {}, hideProgress: () => {},
    },
    BackButton: { isVisible: false, onClick: () => {}, offClick: () => {}, show: () => {}, hide: () => {} },
    HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
  };
  try {
    if (!window.Telegram) {
      Object.defineProperty(window, 'Telegram', { value: { WebApp }, writable: true, configurable: true });
    } else {
      try { window.Telegram.WebApp = WebApp; } catch (e) {}
    }
  } catch (e) {
    window.Telegram = { WebApp };
  }

  // Pre-apply theme class so first render is already in correct theme
  const applyTheme = () => {
    const root = document.documentElement;
    if (${JSON.stringify(isDark)}) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };
  if (document.documentElement) applyTheme();
  document.addEventListener('DOMContentLoaded', applyTheme);
  // Also force after app mounts in case it toggles back
  setTimeout(applyTheme, 100);
  setTimeout(applyTheme, 500);
  setTimeout(applyTheme, 1500);

  // Mark onboarding as seen so WelcomeModal doesn't cover screenshots
  try {
    localStorage.setItem('food_bot_onboarding_completed', 'true');
    localStorage.setItem('food_bot_onboarding_completed_version', 'v1');
    localStorage.setItem('theme', ${JSON.stringify(theme)});
  } catch (e) {}

  // Disable Service Worker so API mocks are not bypassed by PWA cache
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      }).catch(() => {});
      Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    }
  } catch (e) {}

  // Clear caches API (used by Workbox)
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
  } catch (e) {}
})();
`;
};

async function applyApiMocks(page, scenario) {
  const mocks = buildMocks(scenario);
  const regexRoutes = mocks.__regex || [];

  await page.route(/\/api\//, (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();
    const json = (obj) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });

    // 1. Exact match
    if (mocks[pathname]) return json(mocks[pathname]());

    // 2. Regex routes
    for (const [rx, fn] of regexRoutes) {
      if (rx.test(pathname)) return json(fn());
    }

    // 3. Path prefix match
    const prefixes = Object.keys(mocks)
      .filter((k) => typeof k === 'string' && k.startsWith('/api'))
      .sort((a, b) => b.length - a.length);
    for (const p of prefixes) {
      if (pathname === p || pathname.startsWith(p + '/')) {
        return json(mocks[p]());
      }
    }

    // 4. Generic mutation success
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return json({ success: true, data: {} });
    }

    // 5. GET fallback
    return json({ success: true, data: null });
  });
}

async function screenshot(page, filename, theme = 'light', delayMs = 800) {
  await page.waitForTimeout(delayMs);
  const fullPath = path.join(OUT_DIR, `${filename}_${theme}.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log('  ->', path.basename(fullPath));
}

// Scenarios: [slug, route, scenarioKey, preScreenshotAction?]
const SCENARIOS = [
  // Home
  ['home_empty', '/', 'default'],
  ['home_active', '/', 'home-active'],
  ['home_voted', '/', 'home-voted'],
  ['home_ending', '/', 'home-ending'],
  ['home_urgent-debt', '/', 'home-urgent-debt'],

  // Menu
  ['menu_with-items', '/menu', 'default'],
  ['menu_empty', '/menu', 'menu-empty'],
  ['menu_add-sheet', '/menu', 'default', async (p) => {
    await p.locator('button:has-text("Добавить блюдо")').first().click({ timeout: 2000 }).catch(() => {});
  }],
  ['menu_search', '/menu', 'default', async (p) => {
    await p.locator('input[placeholder*="Поиск" i]').first().fill('пельм').catch(() => {});
  }],
  ['menu_search-empty', '/menu', 'default', async (p) => {
    await p.locator('input[placeholder*="Поиск" i]').first().fill('qxqzz').catch(() => {});
  }],

  // Stats (tabs in old frontend: Мой / Группа / Глобально / Инсайты)
  ['stats_personal', '/stats', 'default'],
  ['stats_group', '/stats', 'default', async (p) => {
    await p.locator('span, button').filter({ hasText: /^Группа$/ }).first().click({ timeout: 2000 }).catch(() => {});
  }],
  ['stats_global', '/stats', 'default', async (p) => {
    await p.locator('span, button').filter({ hasText: /^Глобально$/ }).first().click({ timeout: 2000 }).catch(() => {});
  }],
  ['stats_insights', '/stats', 'default', async (p) => {
    await p.locator('span, button').filter({ hasText: /^Инсайты$/ }).first().click({ timeout: 2000 }).catch(() => {});
  }],
  ['stats_empty', '/stats', 'stats-empty'],

  // Profile
  ['profile_admin', '/profile', 'default'],
  ['profile_regular', '/profile', 'profile-regular'],
  ['profile_streak', '/profile', 'profile-streak'],
  ['profile_feedback-modal', '/profile', 'default', async (p) => {
    await p.locator('button, div[role="button"]').filter({ hasText: /отзыв|написать/i }).first().click({ timeout: 2000 }).catch(() => {});
  }],
  ['profile_donation-modal', '/profile', 'default', async (p) => {
    await p.locator('button, div[role="button"]').filter({ hasText: /поддерж/i }).first().click({ timeout: 2000 }).catch(() => {});
  }],

  // User Stats
  ['user-stats', '/user/stats', 'default'],

  // Poll History
  ['history_with-polls', '/poll/history', 'default'],
  ['history_empty', '/poll/history', 'history-empty'],

  // Poll Results
  ['results_completed', '/poll/103/results', 'default'],

  // Admin
  ['admin_dashboard', '/admin/dashboard', 'default'],
  ['admin_suggestions', '/admin/suggestions', 'default'],
  ['admin_create-poll-sheet', '/admin/dashboard', 'default', async (p) => {
    await p.getByText(/создать\s+голосование|создать\s+опрос/i).first().click({ timeout: 2000 }).catch(() => {});
  }],

  // Suggestions (user)
  ['my-suggestions', '/my-suggestions', 'default'],

  // Budget (hosted on HomePage via /vote alias)
  ['budget_overview', '/vote', 'default'],
  ['budget_urgent-debt', '/vote', 'home-urgent-debt'],
  ['budget_waiting-confirm', '/vote', 'budget-waiting-confirm'],
  ['budget_success', '/vote', 'budget-success'],
  ['budget_responsible', '/vote', 'budget-responsible'],

  // Loading — no wait, snap immediately
  ['home_loading', '/', 'default', async (p) => {
    // nothing — caller snaps quickly
  }, { shortWait: true }],
];

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const useLocalServer = BASE_URL.includes('localhost');
  let server = null;
  if (useLocalServer) {
    console.log(`Starting built-in SPA server on port ${STATIC_PORT} (${DIST_DIR})`);
    server = await startStaticServer();
  }

  const browser = await chromium.launch({ headless: true });

  for (const theme of ['light', 'dark']) {
    console.log(`\n=== THEME: ${theme} ===`);
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      colorScheme: theme,
      locale: 'ru-RU',
      serviceWorkers: 'block',
      bypassCSP: true,
    });
    await context.addInitScript(makeTgInitScript(theme));

    for (const entry of SCENARIOS) {
      const [slug, route, scenario, action, opts] = entry;
      const shortWait = !!opts?.shortWait;
      const page = await context.newPage();
      try {
        await applyApiMocks(page, scenario);
        console.log(`[${slug}] route=${route} scenario=${scenario}`);
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        if (!shortWait) await page.waitForTimeout(1500);
        if (action) {
          try { await action(page); } catch (e) { console.warn('  action failed:', e.message); }
          if (!shortWait) await page.waitForTimeout(800);
        }
        await screenshot(page, slug, theme, shortWait ? 50 : 500);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
      } finally {
        await page.close();
      }
    }
    await context.close();
  }

  await browser.close();
  if (server) server.close();
  console.log(`\nSaved to: ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
