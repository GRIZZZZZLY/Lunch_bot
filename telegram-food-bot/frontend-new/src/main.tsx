import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import App from './App';
import { getWebApp, initTelegramWebApp } from './lib/telegram';
import { queryClient } from './lib/queryClient';
import { bootstrapAuth } from './lib/bootstrap';
import { captureError, installGlobalHandlers } from './lib/monitoring';
import { initSentry } from './lib/sentry';

initSentry();
installGlobalHandlers();

const root = document.documentElement;

function applyTheme() {
  const tg = getWebApp();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = tg?.colorScheme === 'dark' || (!tg && prefersDark);
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

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
