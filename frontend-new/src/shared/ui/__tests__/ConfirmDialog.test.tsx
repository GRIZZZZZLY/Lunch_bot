import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from '../ConfirmDialog';
import { BottomSheet } from '@/components/rl/BottomSheet';
import { _resetBackButtonForTests } from '@/lib/backButton';

/* «Отмена» уводит лист тем же путём, что крестик и скрим: сначала уход вниз,
   потом onClose. Раньше кнопка звала onClose сразу, и лист пропадал одним
   кадром, хотя крестик рядом закрывал его анимацией. */
describe('отмена в листе', () => {
  beforeEach(() => {
    _resetBackButtonForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('сначала уводит лист, потом зовёт onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Удалить?" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog').querySelector('.sheet-panel')).toHaveClass('is-closing');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('не закрывает лист, пока закрытие заблокировано', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="Лист" onClose={onClose} closable={false} footer={(dismiss) => <button onClick={dismiss}>Отмена</button>}>
        содержимое
      </BottomSheet>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').querySelector('.sheet-panel')).not.toHaveClass('is-closing');
  });
});
