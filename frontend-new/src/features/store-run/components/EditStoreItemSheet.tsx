import { BottomSheet } from '@/components/rl/BottomSheet';
import { StoreItemForm, type StoreItemFormValues } from './StoreItemForm';
import type { StoreItem } from '@/services/store-run.service';

export function EditStoreItemSheet({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: StoreItem;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: StoreItemFormValues) => void;
}) {
  return (
    <BottomSheet title="Изменить позицию" onClose={onClose}>
      {/* key по item.id: смена target пересоздаёт форму с новыми initial */}
      <StoreItemForm
        key={item.id}
        initial={{ name: item.name, quantity: item.quantity, notes: item.notes ?? undefined }}
        busy={busy}
        submitLabel="Сохранить"
        onCancel={onClose}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}
