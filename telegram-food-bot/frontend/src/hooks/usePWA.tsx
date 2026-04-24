import { useState, useEffect } from 'react';
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
