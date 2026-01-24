// КРИТИЧНО: React должен импортироваться ПЕРВЫМ
import React from 'react';
import ReactDOM from 'react-dom/client';

// Остальные импорты после React
import './styles/index.css';
import './utils/debugLogger'; // Инициализация debug logger
import App from './App';
import { initSentry } from './lib/sentry';
import { handleStartupUpdate } from './utils/versionCheck';

// Инициализация Sentry (P1.2 - Error Tracking)
initSentry();

// Обработка обновлений при запуске
handleStartupUpdate();

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
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
