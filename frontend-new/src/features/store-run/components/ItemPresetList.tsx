/**
 * «Мои товары»: то, что человек уже заказывал, с мультивыбором.
 *
 * Список копится сам, поэтому в нём неизбежно оказывается разовое. Отсюда две
 * кнопки в строке: закрепить нужное наверх и убрать лишнее. Управление живёт
 * здесь же, а не в отдельном разделе профиля, — чистят список ровно в тот
 * момент, когда он мешает выбирать.
 */
import { Checkbox, IconButton } from '@/components/rl/primitives';
import type { ItemPreset } from '@/services/item-preset.service';

export function ItemPresetList({
  presets,
  selectedIds,
  alreadyAdded,
  busy,
  onToggle,
  onTogglePin,
  onRemove,
}: {
  presets: ItemPreset[];
  selectedIds: number[];
  /** Нормализованные имена позиций, уже добавленных этим человеком в закупку. */
  alreadyAdded: Set<string>;
  busy: boolean;
  onToggle: (id: number) => void;
  onTogglePin: (preset: ItemPreset) => void;
  onRemove: (id: number) => void;
}) {
  if (presets.length === 0) {
    return (
      <p style={{ margin: '18px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-14)' }}>
        Здесь появятся товары, которые вы заказываете. Добавьте первую позицию вручную.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {presets.map((preset) => {
        const added = alreadyAdded.has(normalize(preset.name));
        const checked = selectedIds.includes(preset.id);

        return (
          <li
            key={preset.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              /* 44 px — минимальная область касания: в строке три независимые
                 цели, и они не должны налезать друг на друга. */
              minHeight: 44,
              padding: '4px 0',
              opacity: added ? 0.55 : 1,
            }}
          >
            {added ? (
              <span
                aria-hidden
                style={{ width: 24, textAlign: 'center', color: 'var(--text-secondary)' }}
              >
                ✓
              </span>
            ) : (
              <Checkbox
                on={checked}
                disabled={busy}
                aria-label={`Выбрать ${preset.name}`}
                onChange={() => onToggle(preset.id)}
              />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--text-15)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preset.name}
              </div>
              <div style={{ fontSize: 'var(--text-13)', color: 'var(--text-secondary)' }}>
                {added ? 'уже в списке' : detail(preset)}
              </div>
            </div>

            <IconButton
              name="star"
              size="sm"
              variant={preset.pinned ? 'primary' : 'ghost'}
              aria-label={preset.pinned ? `Открепить ${preset.name}` : `Закрепить ${preset.name}`}
              aria-pressed={preset.pinned}
              onClick={() => onTogglePin(preset)}
            />
            <IconButton
              name="trash"
              size="sm"
              variant="ghost"
              aria-label={`Удалить ${preset.name} из моих товаров`}
              onClick={() => onRemove(preset.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** Второй строкой — то, что подставится в позицию: количество и заметка. */
function detail(preset: ItemPreset): string {
  const parts = [`${preset.quantity} шт`];
  if (preset.notes) parts.push(preset.notes);
  return parts.join(' · ');
}

/**
 * Та же нормализация, что на сервере (`backend/src/utils/normalize-name.ts`):
 * иначе «Молоко» в закупке и «молоко» в пресете считались бы разными, и
 * пометка «уже в списке» не появлялась бы там, где должна.
 */
export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}
