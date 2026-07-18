import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
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
        <m.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 border-b border-butter-500/20 bg-butter-500 text-gray-950 px-4 py-2 shadow-lg"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <WifiOff className={ICON_SIZES.sm} />
            <span>Нет подключения к интернету</span>
          </div>
          <div className="mt-1 text-center text-xs opacity-80">
            Показаны сохранённые данные. Обновим, когда вернётся сеть.
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
