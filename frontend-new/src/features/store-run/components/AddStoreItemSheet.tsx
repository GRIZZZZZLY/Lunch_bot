/**
 * Добавление позиции: из личного списка или вручную.
 *
 * Вкладка «Мои товары» открывается первой, когда список не пуст: повторный
 * заказ — частый случай, а ручной ввод одного и того же каждый раз и был тем,
 * ради чего список заведён. Пустой список сразу открывает форму, чтобы вкладка
 * не встречала человека пустотой.
 *
 * Выбранные пресеты уходят ОДНИМ запросом: у сервера уже есть bulk-приём, и
 * пять последовательных запросов дали бы пять перерисовок экрана закупки.
 */
import { useMemo, useState } from 'react';

import { BottomSheet } from '@/components/rl/BottomSheet';
import { Button, Segmented } from '@/components/rl/primitives';
import type { ItemPreset } from '@/services/item-preset.service';
import { ItemPresetList, normalize } from './ItemPresetList';
import { StoreItemForm, type StoreItemFormValues } from './StoreItemForm';

type Tab = 'presets' | 'manual';

export function AddStoreItemSheet({
  busy,
  presets = [],
  presetsLoading = false,
  myItemNames = [],
  onClose,
  onSubmit,
  onSubmitMany,
  onTogglePin,
  onRemovePreset,
}: {
  busy: boolean;
  presets?: ItemPreset[];
  presetsLoading?: boolean;
  /** Имена позиций, уже добавленных этим человеком в текущую закупку. */
  myItemNames?: string[];
  onClose: () => void;
  onSubmit: (values: StoreItemFormValues) => void;
  onSubmitMany?: (values: StoreItemFormValues[]) => void;
  onTogglePin?: (preset: ItemPreset) => void;
  onRemovePreset?: (id: number) => void;
}) {
  const hasPresets = presets.length > 0;
  /* `null` — «человек ещё не выбирал вкладку». Начальное значение нельзя
     зафиксировать в useState: на первом рендере список обычно ещё грузится, и
     вкладка залипла бы на «Новой» ровно в тех случаях, ради которых список и
     заведён. Пока грузится — держим «Мои товары»; пустым он оказался
     по-настоящему только после загрузки. */
  const [tab, setTab] = useState<Tab | null>(null);
  const effectiveTab: Tab = tab ?? (presetsLoading || hasPresets ? 'presets' : 'manual');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const alreadyAdded = useMemo(
    () => new Set(myItemNames.map(normalize)),
    [myItemNames],
  );

  const toggle = (id: number) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const addSelected = () => {
    const chosen = presets
      .filter((preset) => selectedIds.includes(preset.id))
      .map((preset) => ({
        name: preset.name,
        quantity: preset.quantity,
        notes: preset.notes ?? undefined,
      }));
    if (chosen.length === 0) return;
    onSubmitMany?.(chosen);
  };

  const presetsTab = effectiveTab === 'presets';

  return (
    <BottomSheet
      title="Добавить позицию"
      onClose={onClose}
      closable={!busy}
      footer={
        presetsTab ? (
          <>
            <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={onClose}>
              Отмена
            </Button>
            <Button
              style={{ flex: 1 }}
              loading={busy}
              disabled={selectedIds.length === 0 || busy}
              onClick={addSelected}
            >
              {selectedIds.length > 0 ? `Добавить ${selectedIds.length}` : 'Добавить'}
            </Button>
          </>
        ) : undefined
      }
    >
      {hasPresets && (
        <div style={{ marginBottom: 14 }}>
          <Segmented<Tab>
            options={[
              { value: 'presets', label: 'Мои товары' },
              { value: 'manual', label: 'Новая' },
            ]}
            value={effectiveTab}
            onChange={setTab}
          />
        </div>
      )}

      {presetsTab ? (
        presetsLoading ? (
          <p style={{ margin: '18px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Загружаем…
          </p>
        ) : (
          <ItemPresetList
            presets={presets}
            selectedIds={selectedIds}
            alreadyAdded={alreadyAdded}
            busy={busy}
            onToggle={toggle}
            onTogglePin={(preset) => onTogglePin?.(preset)}
            onRemove={(id) => {
              setSelectedIds((ids) => ids.filter((x) => x !== id));
              onRemovePreset?.(id);
            }}
          />
        )
      ) : (
        <StoreItemForm busy={busy} submitLabel="Добавить" onCancel={onClose} onSubmit={onSubmit} />
      )}
    </BottomSheet>
  );
}
