import React, { useEffect } from 'react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

/**
 * Модальное окно подтверждения
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'info',
  loading = false,
}) => {
  // Блокируем прокрутку при открытии модалки
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantStyles = {
    danger: 'bg-red-500 hover:bg-red-600',
    warning: 'bg-orange-500 hover:bg-orange-600',
    info: 'bg-telegram-button-color hover:bg-telegram-button-color/90',
  };

  const iconByVariant = {
    danger: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-telegram-secondary-bg-color rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-telegram-hint-color/10">
          <div className="flex items-start gap-4">
            <div className="text-3xl">{iconByVariant[variant]}</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-telegram-text-color mb-2">
                {title}
              </h3>
              {description && (
                <p className="text-telegram-hint-color text-sm">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 flex gap-3">
          <Button
            onClick={onClose}
            variant="secondary"
            fullWidth
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            fullWidth
            loading={loading}
            disabled={loading}
            className={variantStyles[variant]}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Хук для использования модального окна подтверждения
 */
export const useConfirmModal = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<Omit<ConfirmModalProps, 'isOpen' | 'onClose' | 'onConfirm'>>({
    title: '',
  });
  const resolveRef = React.useRef<(value: boolean) => void>();

  const confirm = (modalConfig: Omit<ConfirmModalProps, 'isOpen' | 'onClose' | 'onConfirm'>): Promise<boolean> => {
    setConfig(modalConfig);
    setIsOpen(true);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setIsOpen(false);
  };

  const handleClose = () => {
    resolveRef.current?.(false);
    setIsOpen(false);
  };

  const modal = (
    <ConfirmModal
      {...config}
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, modal };
};
