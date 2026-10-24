import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { GroupStore } from '@/services/group-store.service';
import { StoreChips } from '../StoreChips';

function mkStore(id: number, name: string): GroupStore {
  return {
    id,
    groupId: 1,
    name,
    lastUsedAt: '2026-09-01T10:00:00Z',
    usageCount: 3,
    archivedAt: null,
  };
}

const STORES = [mkStore(1, 'Пятёрочка'), mkStore(2, 'Магнит'), mkStore(3, 'Лента')];

describe('StoreChips', () => {
  /* Регрессия: таймер долгого нажатия переживал размонтирование и открывал
     шторку правки поверх уже закрытого экрана. */
  it('размонтирование снимает таймер долгого нажатия', () => {
    vi.useFakeTimers();
    const onManage = vi.fn();

    const { unmount } = render(
      <StoreChips stores={STORES} selectedId={null} onSelect={vi.fn()} onManage={onManage} />,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Пятёрочка' }));
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onManage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
