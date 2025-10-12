import React, { useState, useEffect } from 'react';
// import { useRegisterSW } from 'virtual:pwa-register/react'; // PWA временно отключен

/**
 * Хук для работы с PWA и Service Worker (STUB - PWA отключен)
 */
export const usePWA = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isUpdateAvailable] = useState(false); // Всегда false без PWA

  // Отслеживание online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateApp = async () => {
    // No-op без PWA
  };

  const skipUpdate = () => {
    // No-op без PWA
  };

  return {
    isOnline,
    isUpdateAvailable,
    updateApp,
    skipUpdate,
  };
};

/**
 * Компонент Offline Indicator
 */
export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium animate-slide-down">
      <span>⚠️ Отсутствует подключение к интернету</span>
      <span className="block text-xs opacity-90">Работаем в offline режиме</span>
    </div>
  );
};

/**
 * Компонент Update Prompt
 */
export const UpdatePrompt: React.FC = () => {
  const { isUpdateAvailable, updateApp, skipUpdate } = usePWA();

  if (!isUpdateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-telegram-button-color text-white rounded-2xl shadow-2xl p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">🔄</div>
        <div className="flex-1">
          <h4 className="font-semibold mb-1">Доступно обновление</h4>
          <p className="text-sm opacity-90">
            Новая версия приложения готова к установке
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={skipUpdate}
          className="flex-1 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
        >
          Позже
        </button>
        <button
          onClick={updateApp}
          className="flex-1 px-4 py-2 bg-white text-telegram-button-color rounded-lg hover:bg-white/90 transition-colors font-semibold"
        >
          Обновить
        </button>
      </div>
    </div>
  );
};
