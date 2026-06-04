import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import './styles/redesign-v2.css';
import App from './App';
import { getWebApp, initTelegramWebApp } from './lib/telegram';
import { queryClient } from './lib/queryClient';
import { bootstrapAuth } from './lib/bootstrap';
import { captureError, installGlobalHandlers } from './lib/monitoring';
import { initSentry } from './lib/sentry';

initSentry();
installGlobalHandlers();

const root = document.documentElement;

function applyScheme() {
  // Redesign v2 colour scheme (a=graphite/cyan, b=steel/amber, c=carbon/lime).
  let scheme = 'a';
  try {
    scheme = localStorage.getItem('rl-scheme') || 'a';
  } catch {
    /* no-op */
  }
  root.setAttribute('data-scheme', scheme);
}

function applyTheme() {
  // Manual override (set via the in-app switcher) wins over Telegram/system.
  let override: string | null = null;
  try {
    override = localStorage.getItem('rl-theme');
  } catch {
    /* no-op */
  }
  const tg = getWebApp();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark =
    override === 'dark' ||
    (override !== 'light' && (tg?.colorScheme === 'dark' || (!tg && prefersDark)));
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

applyScheme();
applyTheme();

const tg = initTelegramWebApp();
tg?.onEvent('themeChanged', applyTheme);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

bootstrapAuth().catch((err) => {
  captureError(err, { source: 'main:bootstrapAuth' });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
