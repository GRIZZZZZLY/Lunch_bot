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
// ⚠️ ВРЕМЕННО ОТКЛЮЧЕНО для отладки cooldown feature
// TODO: Включить после завершения тестирования
console.log('🔧 PWA temporarily disabled for debugging');

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
