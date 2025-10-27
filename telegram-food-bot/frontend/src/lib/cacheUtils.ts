/**
 * Cache utilities для предотвращения мерцания и стейл данных
 */

import { queryClient } from './queryClient';

/**
 * Очистить весь localStorage cache
 */
export const clearAllCache = () => {
  console.log('[CacheUtils] Clearing all cache...');
  
  // Очистить React Query cache
  queryClient.clear();
  
  // Очистить localStorage
  const keysToRemove = [
    'TELEGRAM_FOOD_BOT_CACHE',
    'app-store', // Zustand persist
  ];
  
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`[CacheUtils] Removed ${key}`);
    } catch (e) {
      console.error(`[CacheUtils] Failed to remove ${key}:`, e);
    }
  });
};

/**
 * Очистить только stale (устаревший) cache
 */
export const clearStaleCache = () => {
  console.log('[CacheUtils] Clearing stale cache...');
  
  // Очистить polls cache
  queryClient.removeQueries({ 
    queryKey: ['polls'],
    exact: false 
  });
  
  console.log('[CacheUtils] Stale cache cleared');
};

/**
 * Проверить версию cache и очистить если устарел
 */
export const checkCacheVersion = () => {
  const CACHE_VERSION = '2.0.0'; // Увеличиваем при breaking changes
  const currentVersion = localStorage.getItem('CACHE_VERSION');
  
  if (currentVersion !== CACHE_VERSION) {
    console.log(`[CacheUtils] Cache version mismatch (${currentVersion} vs ${CACHE_VERSION}), clearing...`);
    clearAllCache();
    localStorage.setItem('CACHE_VERSION', CACHE_VERSION);
  }
};

/**
 * Инициализация cache utilities при старте приложения
 */
export const initCache = () => {
  console.log('[CacheUtils] Initializing cache...');
  
  // Проверяем версию cache
  checkCacheVersion();
  
  // Очищаем stale данные
  clearStaleCache();
  
  console.log('[CacheUtils] Cache initialized');
};
