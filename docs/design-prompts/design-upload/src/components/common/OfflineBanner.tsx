/**
 * OfflineBanner - Индикатор offline режима
 * 
 * Shows when user is offline with pending actions count
 * Auto-hides when online
 */

import { FC, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Cloud } from 'lucide-react';
import { offlineQueue } from '@/services/offline.service';
import { Badge } from '@/components/ui/badge';
import { ICON_SIZES } from '@/lib/design-tokens';

export const OfflineBanner: FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Update online status
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      
      // Start syncing
      offlineQueue.processQueue().then(() => {
        setIsSyncing(false);
        updatePendingCount();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending count
    updatePendingCount();

    // Poll pending count every 5 seconds
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const updatePendingCount = async () => {
    const count = await offlineQueue.getPendingCount();
    setPendingCount(count);
  };

  // Показываем только если offline ИЛИ есть pending actions
  const shouldShow = !isOnline || pendingCount > 0 || isSyncing;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed top-0 left-0 right-0 z-50"
        >
          <div
            className={`
              px-4 py-3 text-sm font-medium text-center
              ${
                !isOnline
                  ? 'bg-orange-500 text-white'
                  : isSyncing
                  ? 'bg-blue-500 text-white'
                  : 'bg-green-500 text-white'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className={ICON_SIZES.sm} />
                  <span>Нет сети</span>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-white/20 border-white/30">
                      {pendingCount} действий в очереди
                    </Badge>
                  )}
                </>
              ) : isSyncing ? (
                <>
                  <Cloud className={`${ICON_SIZES.sm} animate-pulse`} />
                  <span>Синхронизация...</span>
                </>
              ) : (
                <>
                  <Wifi className={ICON_SIZES.sm} />
                  <span>Все синхронизировано ✓</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
