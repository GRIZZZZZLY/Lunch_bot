/**
 * Утилиты для проверки версии приложения и управления обновлениями
 */

const APP_VERSION = '2.0.18';
const VERSION_CHECK_INTERVAL = 60000; // Проверка каждую минуту
const VERSION_STORAGE_KEY = 'app_version';

/**
 * Получить текущую версию приложения
 */
export function getAppVersion(): string {
  return APP_VERSION;
}

/**
 * Проверить, изменилась ли версия приложения
 */
export function hasVersionChanged(): boolean {
  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  
  if (!storedVersion) {
    // Первый запуск - сохраняем версию
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    return false;
  }
  
  return storedVersion !== APP_VERSION;
}

/**
 * Обновить сохраненную версию
 */
export function updateStoredVersion(): void {
  localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
}

/**
 * Очистить весь кеш приложения
 */
export async function clearAppCache(): Promise<void> {
  try {
    // Очищаем localStorage (кроме важных данных)
    const keysToKeep = ['telegram_user_data', 'auth_token'];
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (!keysToKeep.includes(key) && !key.startsWith('vote_history_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Очищаем Service Worker кеши
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }

    // Снимаем регистрации Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
  } catch {
    // Cleanup is best-effort and must not interrupt application startup.
  }
}

/**
 * Проверить наличие обновлений через HTTP заголовок
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const response = await fetch('/', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    const serverVersion = response.headers.get('X-App-Version');
    
    if (serverVersion && serverVersion !== APP_VERSION) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Обработать обновление при запуске приложения
 */
export async function handleStartupUpdate(): Promise<void> {
  if (hasVersionChanged()) {
    await clearAppCache();
    updateStoredVersion();
  }
}
