// КРИТИЧНО: React должен импортироваться ПЕРВЫМ
import React from 'react';
import ReactDOM from 'react-dom/client';

// Остальные импорты после React
import './styles/index.css';
import './utils/debugLogger'; // Инициализация debug logger
import App from './App';
import { initSentry } from './lib/sentry';
import { initWebVitals } from './lib/web-vitals';
import { handleStartupUpdate } from './utils/versionCheck';

// Авто-восстановление устаревших lazy-чанков после нового деплоя.
// Браузер/Telegram держит старый app shell; чанк с прежним хешем уже удалён
// с сервера → dynamic import (React.lazy) даёт 404. Vite шлёт 'vite:preloadError'.
// Перезагружаем страницу, чтобы подтянуть свежий shell (анти-цикл: не чаще раза в 10 сек).
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    const KEY = 'vite-preload-reload-at';
    const last = Number(sessionStorage.getItem(KEY) || '0');
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  });
}

const resetAppState = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (!params.has('reset')) return;

  params.delete('reset');

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('TELEGRAM_FOOD_BOT_CACHE');
    localStorage.removeItem('app-store');
  } finally {
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.location.replace(nextUrl);
  }
};

void resetAppState().then(() => {
  // Инициализация Sentry (P1.2 - Error Tracking)
  initSentry();

  // Phase 0 (G0-4): Core Web Vitals → Sentry. Должно идти ПОСЛЕ initSentry,
  // иначе getActiveSpan() вернёт undefined и метрики не прицепятся к транзакции.
  initWebVitals();

  // Обработка обновлений при запуске
  handleStartupUpdate();
});

// Регистрация Service Worker для PWA
// ?v= bust CF cache — each deploy should update this value
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    // Unregister stale SWs registered at old URLs before registering new one
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));

    navigator.serviceWorker
      .register('/sw.js?v=20260530')
      .then(registration => {
        console.log('✅ PWA Service Worker registered:', registration.scope);
      })
      .catch(error => {
        console.error('❌ PWA Service Worker registration failed:', error);
      });
  });
}

// Инициализация Telegram WebApp
if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
  const webapp = window.Telegram.WebApp as any;
  
  // Включаем показ главной кнопки
  webapp.ready?.();
  webapp.expand?.();
  
  // Устанавливаем цветовую схему
  if (webapp.colorScheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
  
  // Отключаем предупреждение о закрытии
  webapp.enableClosingConfirmation?.();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
