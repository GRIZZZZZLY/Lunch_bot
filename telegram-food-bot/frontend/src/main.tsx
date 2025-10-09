import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

// Глобальный обработчик ошибок JavaScript
window.addEventListener('error', (event) => {
  console.error('❌ [Global Error Handler] Uncaught error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Global Error Handler] Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
});

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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
