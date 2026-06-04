import { useState, type ChangeEvent, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button, Chip, Field } from './primitives';

const PRESETS = [15, 30, 60];

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 'var(--t-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

export function CreateStoreRunSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { storeName: string; collectMinutes: number }) => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [mins, setMins] = useState(30);

  if (!open) return null;
  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <BottomSheet
      title="Новая закупка"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="cart" style={{ flex: 1 }} loading={busy} disabled={!canSubmit} onClick={() => onSubmit({ storeName: name.trim(), collectMinutes: mins })}>
            Открыть сбор
          </Button>
        </>
      }
    >
      <FormField label="Откуда заказываем">
        <Field value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Пятёрочка у офиса" />
      </FormField>
      <FormField label="Сбор заказов">
        <div style={{ display: 'flex', gap: 8 }}>
          {PRESETS.map((m) => (
            <Chip key={m} on={mins === m} onClick={() => setMins(m)}>
              {m} мин
            </Chip>
          ))}
        </div>
      </FormField>
    </BottomSheet>
  );
}
