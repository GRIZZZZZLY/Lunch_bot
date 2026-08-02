import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/tokens.css';
import './styles/index.css';
import './styles/redesign-v2.css';
import './styles/motion.css';
import App from './App';
import { initTelegramWebApp } from './lib/telegram';
import { applyThemeNow, initThemeSync } from './lib/theme';
import { initViewportSync } from './lib/viewport';
import { queryClient } from './lib/queryClient';
import { bootstrapAuth } from './lib/bootstrap';
import { captureError, installGlobalHandlers } from './lib/monitoring';
import { initSentry } from './lib/sentry';

initSentry();
installGlobalHandlers();

initTelegramWebApp();
applyThemeNow();
initThemeSync();
initViewportSync();

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
