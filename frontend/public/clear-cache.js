/**
 * Скрипт для принудительной очистки Service Worker кэша
 * Использование: вставьте в консоль браузера или добавьте как скрипт на страницу
 */

(async function clearAllCaches() {
  console.log('🧹 Начинаем очистку всех кэшей...');

  try {
    // 1. Очистить все Service Worker кэши
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`📦 Найдено ${cacheNames.length} кэшей:`, cacheNames);

      await Promise.all(
        cacheNames.map(async cacheName => {
          await caches.delete(cacheName);
        console.log(`✅ Удалён кэш: ${cacheName}`);
        })
      );
    }

    // 2. Unregister всех Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`🔧 Найдено ${registrations.length} Service Workers`);

      await Promise.all(
        registrations.map(async registration => {
          await registration.unregister();
        console.log(`✅ Удалён Service Worker: ${registration.scope}`);
        })
      );
    }

    // 3. Очистить localStorage
    console.log('🗑️ Очистка localStorage...');
    localStorage.clear();

    // 4. Очистить sessionStorage
    console.log('🗑️ Очистка sessionStorage...');
    sessionStorage.clear();

    console.log('');
    console.log('✨ ВСЕ КЭШИ ОЧИЩЕНЫ!');
    console.log('🔄 Перезагрузка через 2 секунды...');

    setTimeout(() => {
      window.location.reload(true);
    }, 2000);

  } catch (error) {
    console.error('❌ Ошибка при очистке кэшей:', error);
  }
})();
