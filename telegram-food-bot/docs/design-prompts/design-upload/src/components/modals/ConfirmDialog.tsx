import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { ICON_SIZES } from '@/lib/design-tokens';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: React.ReactNode;
  
  // NEW: Support for 2-button dialog with onCancel (close via X button)
  onCancel?: () => void;           // Callback for "Cancel" destructive action
}

/**
 * ConfirmDialog - Модальное окно подтверждения действия
 *
 * Особенности:
 * - Варианты: danger (красный), warning (желтый), info (синий)
 * - Анимация появления/исчезновения
 * - Backdrop с blur эффектом
 * - Кастомные иконка и тексты кнопок
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'danger',
  icon,
  onCancel,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantColors = {
    danger: {
      icon: 'text-red-500',
      iconBg: 'bg-red-100 dark:bg-red-900/20',
      button: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
      icon: 'text-amber-500',
      iconBg: 'bg-amber-100 dark:bg-amber-900/20',
      button: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    info: {
      icon: 'text-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      button: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  };

  const colors = variantColors[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border overflow-hidden relative"
            >
              {/* Close button - positioned relative to dialog */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-10"
                aria-label="Закрыть"
              >
                <X className={`${ICON_SIZES.sm} text-muted-foreground`} />
              </button>

              {/* Content */}
              <div className="p-6 pt-8 space-y-4">
                {/* Icon */}
                <div className="flex justify-center">
                  <div className={cn('p-4 rounded-full', colors.iconBg)}>
                    {icon || <AlertTriangle className={cn(ICON_SIZES.xl, colors.icon)} />}
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-center text-foreground">
                  {title}
                </h2>

                {/* Description */}
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {description}
                </p>

                {/* Actions */}
                <div className="flex justify-center gap-3 pt-2">
                  {/* Standard 2-button mode (no onCancel) */}
                  {!onCancel && (
                    <>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={onClose}
                        className="min-w-[120px]"
                      >
                        {cancelLabel}
                      </Button>
                      <Button
                        size="default"
                        onClick={handleConfirm}
                        className={cn('min-w-[120px]', colors.button)}
                      >
                        {confirmLabel}
                      </Button>
                    </>
                  )}
                  
                  {/* Special 2-button mode with onCancel (close via X button instead of third button) */}
                  {onCancel && (
                    <>
                      {/* Left: Destructive "Cancel" button */}
                      <Button
                        variant="destructive"
                        size="default"
                        onClick={() => {
                          onCancel();
                          onClose();
                        }}
                        className="min-w-[140px]"
                      >
                        {cancelLabel}
                      </Button>
                      
                      {/* Right: Success "Confirm" button */}
                      <Button
                        variant="success"
                        size="default"
                        onClick={handleConfirm}
                        className="min-w-[120px]"
                      >
                        {confirmLabel}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
