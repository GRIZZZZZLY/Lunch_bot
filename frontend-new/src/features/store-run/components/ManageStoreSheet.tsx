/**
 * Правка магазина из справочника: переименовать или скрыть.
 *
 * Скрытие, а не удаление, и текст об этом говорит прямо: прошлые закупки этот
 * магазин помнят, и обещать «удалено» было бы неправдой.
 */
import { useState, type ChangeEvent } from 'react';

import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Field } from '@/components/rl/primitives';
import type { GroupStore } from '@/services/group-store.service';

const NAME_MAX = 100;

export function ManageStoreSheet({
  store,
  busy,
  onClose,
  onRename,
  onArchive,
}: {
  store: GroupStore;
  busy: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(store.name);

  const trimmed = name.trim();
  const changed = trimmed !== store.name;
  const canRename = trimmed.length > 0 && trimmed.length <= NAME_MAX && changed && !busy;

  return (
    <BottomSheet title={store.name} onClose={onClose}>
      <label
        htmlFor="store-rename"
        style={{
          display: 'block',
          fontSize: 'var(--text-13)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
        Название магазина
      </label>
      <Field
        id="store-rename"
        value={name}
        maxLength={NAME_MAX}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
      />
      <p style={{ margin: '10px 0 16px', fontSize: 'var(--text-13)', color: 'var(--text-secondary)' }}>
        Новое название увидят идущие закупки. Завершённые останутся с прежним.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button block loading={busy} disabled={!canRename} onClick={() => onRename(trimmed)}>
          Переименовать
        </Button>
        <Button variant="secondary" block disabled={busy} onClick={onArchive}>
          Убрать из подсказок
        </Button>
      </div>
    </BottomSheet>
  );
}
