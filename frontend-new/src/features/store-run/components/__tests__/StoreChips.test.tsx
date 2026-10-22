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
  it('выбранный чип помечен для чтения с экрана', () => {
    render(
      <StoreChips stores={STORES} selectedId={2} onSelect={vi.fn()} onManage={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Магнит' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Лента' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  /* Выбранный магазин может оказаться за пределами видимых восьми — тогда
     карандаш показывать не на чем. */
  it('невидимый выбранный магазин карандаша не даёт', () => {
    const many = Array.from({ length: 12 }, (_, i) => mkStore(i + 1, `Магазин ${i + 1}`));
    render(
      <StoreChips stores={many} selectedId={12} onSelect={vi.fn()} onManage={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /Изменить магазин/ })).not.toBeInTheDocument();
  });

  /* Долгое нажатие проверяется через fireEvent, а не userEvent: последний со
     своими таймерами поверх фейковых виснет до таймаута теста. Здесь нужен не
     реалистичный ввод, а ровно пара pointer-событий вокруг перевода часов. */
  it('долгое нажатие открывает правку, а не выбирает магазин', () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const onManage = vi.fn();

    render(
      <StoreChips stores={STORES} selectedId={null} onSelect={onSelect} onManage={onManage} />,
    );

    const chip = screen.getByRole('button', { name: 'Пятёрочка' });
    fireEvent.pointerDown(chip);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);

    expect(onManage).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onSelect).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('короткое нажатие правку не открывает', () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const onManage = vi.fn();

    render(
      <StoreChips stores={STORES} selectedId={null} onSelect={onSelect} onManage={onManage} />,
    );

    const chip = screen.getByRole('button', { name: 'Пятёрочка' });
    fireEvent.pointerDown(chip);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onManage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

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
