/* Создание закупки (вызывается с Home). Пресеты сбора — COLLECT_PRESETS
   [5,15,30], в диапазоне backend 3..30 (фикс B1). Остальное поведение как было. */
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Chip, Field } from '@/components/rl/primitives';
import { COLLECT_PRESETS } from '../lib/selectors';

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 'var(--text-13)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</label>
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
  const [mins, setMins] = useState<number>(COLLECT_PRESETS[COLLECT_PRESETS.length - 1]);

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
      <FormField label="Откуда заказываем" htmlFor="store-run-name">
        <Field id="store-run-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Пятёрочка у офиса" />
      </FormField>
      <FormField label="Сбор заказов">
        <div style={{ display: 'flex', gap: 8 }}>
          {COLLECT_PRESETS.map((m) => (
            <Chip key={m} on={mins === m} onClick={() => setMins(m)}>
              {m} мин
            </Chip>
          ))}
        </div>
      </FormField>
    </BottomSheet>
  );
}
