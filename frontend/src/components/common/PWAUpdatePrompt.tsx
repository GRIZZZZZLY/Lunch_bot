import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_SIZES } from '@/lib/design-tokens';

/**
 * Компонент для отображения уведомления об обновлении PWA
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const customEvent = event as CustomEvent;
      setUpdateSW(() => customEvent.detail.updateSW);
      setShowPrompt(true);
    }

    window.addEventListener('swUpdateAvailable', handleUpdate);

    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdate);
    };
  }, []);

  async function handleUpdate() {
    if (updateSW) {
      await updateSW(true); // Обновить и перезагрузить страницу
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 z-50 bg-blue-500 text-white rounded-lg shadow-xl p-4"
        >
          <div className="flex items-start gap-3">
            <RefreshCw className={`${ICON_SIZES.md} mt-0.5 flex-shrink-0`} />

            <div className="flex-1">
              <h3 className="font-semibold mb-1">Доступно обновление</h3>
              <p className="text-sm opacity-90">
                Новая версия приложения готова к установке
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Закрыть"
            >
              <X className={ICON_SIZES.sm} />
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleUpdate}
              variant="secondary"
              size="sm"
              className="flex-1 bg-white text-blue-600 hover:bg-gray-100"
            >
              Обновить сейчас
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              Позже
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
