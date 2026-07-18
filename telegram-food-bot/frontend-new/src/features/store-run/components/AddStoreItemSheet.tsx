import { BottomSheet } from '@/components/rl/BottomSheet';
import { StoreItemForm, type StoreItemFormValues } from './StoreItemForm';

export function AddStoreItemSheet({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: StoreItemFormValues) => void;
}) {
  return (
    <BottomSheet title="Добавить позицию" onClose={onClose}>
      <StoreItemForm busy={busy} submitLabel="Добавить" onCancel={onClose} onSubmit={onSubmit} />
    </BottomSheet>
  );
}
