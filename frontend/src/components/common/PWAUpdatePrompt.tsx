import { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_SIZES } from '@/lib/design-tokens';

/**
 * Компонент для отображения уведомления об обновлении PWA
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    function handleUpdate(event: Event) {
      const customEvent = event as CustomEvent;
      updateSWRef.current = customEvent.detail.updateSW;
      setShowPrompt(true);
    }

    window.addEventListener('swUpdateAvailable', handleUpdate);

    return () => {
      window.removeEventListener('swUpdateAvailable', handleUpdate);
    };
  }, []);

  async function handleUpdate() {
    if (updateSWRef.current) {
      await updateSWRef.current(true); // Обновить и перезагрузить страницу
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
  }

  return (
    <AnimatePresence>
      {showPrompt && (
        <m.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-lavender-500/20 bg-card/96 p-4 text-foreground shadow-xl"
        >
          <div className="flex items-start gap-3">
            <RefreshCw className={`${ICON_SIZES.md} mt-0.5 flex-shrink-0`} />

            <div className="flex-1">
              <h3 className="mb-1 font-semibold">Доступно обновление</h3>
              <p className="text-sm text-muted-foreground">
                Новая версия приложения готова к установке
              </p>
            </div>

            <button type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 rounded p-1 transition-colors hover:bg-muted"
              aria-label="Закрыть"
            >
              <X className={ICON_SIZES.sm} />
            </button>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleUpdate}
              size="sm"
              variant="lavender"
              className="flex-1"
            >
              Обновить сейчас
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="hover:bg-muted"
            >
              Позже
            </Button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
