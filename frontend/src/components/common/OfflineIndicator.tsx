import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICON_SIZES } from '@/lib/design-tokens';

/**
 * Индикатор offline режима
 * Показывается в верхней части экрана когда нет подключения к интернету
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-2 shadow-lg"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className={ICON_SIZES.sm} />
            <span>Нет подключения к интернету</span>
          </div>
          <div className="text-center text-xs mt-1 opacity-90">
            Показаны данные из кэша. Обновление при восстановлении связи.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
