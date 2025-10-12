import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './utils/debugLogger'; // Инициализация debug logger
import { initSentry } from './lib/sentry';

// Инициализация Sentry (P1.2 - Error Tracking)
initSentry();

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
