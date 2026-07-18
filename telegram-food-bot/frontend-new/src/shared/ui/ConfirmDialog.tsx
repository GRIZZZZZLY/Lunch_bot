/* Диалог подтверждения на базе BottomSheet — наследует focus management,
   Escape, backdrop, Telegram BackButton и восстановление фокуса.
   Не использует window.confirm. Одновременно активен только один. */
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button } from './Button';

// Счётчик активных диалогов. Владение назначается в useEffect (не в
// инициализаторе useState — иначе StrictMode ломает guard двойным вызовом).
let activeConfirmDialogs = 0;

export interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Красная подтверждающая кнопка для необратимых действий. */
  destructive?: boolean;
  /** Мутация в полёте: confirm показывает спиннер, закрытие заблокировано. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Только один активный confirm: второй смонтированный экземпляр прячется.
  const [isDuplicate, setIsDuplicate] = useState(false);
  useEffect(() => {
    if (activeConfirmDialogs > 0) {
      setIsDuplicate(true);
      return;
    }
    activeConfirmDialogs += 1;
    return () => {
      activeConfirmDialogs -= 1;
    };
  }, []);

  if (isDuplicate) return null;

  const close = () => {
    if (!pending) onCancel();
  };

  return (
    <BottomSheet
      role="alertdialog"
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" block onClick={close} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'destructive' : 'primary'} block loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && (
        <p style={{ margin: 0, fontSize: 'var(--text-15)', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
    </BottomSheet>
  );
}
