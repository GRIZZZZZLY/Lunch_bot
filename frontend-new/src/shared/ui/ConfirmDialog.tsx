/* Диалог подтверждения на базе BottomSheet — наследует focus management,
   Escape, backdrop, Telegram BackButton и восстановление фокуса.
   Не использует window.confirm. Одновременно активен только один. */
import { useEffect, useId, useSyncExternalStore } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button } from './Button';

const confirmDialogIds: string[] = [];
const confirmDialogListeners = new Set<() => void>();

function notifyConfirmDialogListeners(): void {
  confirmDialogListeners.forEach(listener => listener());
}

function registerConfirmDialog(id: string): () => void {
  if (!confirmDialogIds.includes(id)) {
    confirmDialogIds.push(id);
    notifyConfirmDialogListeners();
  }

  return () => {
    const index = confirmDialogIds.indexOf(id);
    if (index >= 0) {
      confirmDialogIds.splice(index, 1);
      notifyConfirmDialogListeners();
    }
  };
}

function subscribeToConfirmDialogs(listener: () => void): () => void {
  confirmDialogListeners.add(listener);
  return () => confirmDialogListeners.delete(listener);
}

function getActiveConfirmDialogId(): string | null {
  return confirmDialogIds[0] ?? null;
}

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
  const id = useId();
  const activeId = useSyncExternalStore(
    subscribeToConfirmDialogs,
    getActiveConfirmDialogId,
    getActiveConfirmDialogId,
  );
  useEffect(() => registerConfirmDialog(id), [id]);

  if (activeId !== null && activeId !== id) return null;

  return (
    <BottomSheet
      role="alertdialog"
      title={title}
      closable={!pending}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" block onClick={onCancel} disabled={pending}>
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
