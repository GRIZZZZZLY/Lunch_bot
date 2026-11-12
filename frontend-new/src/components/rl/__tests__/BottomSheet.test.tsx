import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet } from '../BottomSheet';
import { _resetBackButtonForTests } from '@/lib/backButton';

/* Жест закрытия: pointercancel — это «браузер забрал жест себе», а не
   отпускание пальца. Раньше cancel шёл в обработчик отпускания, и в Chromium
   любой свайп вниз после ~20 px закрывал лист. */
describe('BottomSheet: жест', () => {
  beforeEach(() => {
    _resetBackButtonForTests();
    vi.useFakeTimers();
    // jsdom не реализует захват указателя.
    HTMLElement.prototype.setPointerCapture = () => undefined;
  });
  afterEach(() => vi.useRealTimers());

  const panel = () => screen.getByRole('dialog').querySelector('.sheet-panel') as HTMLElement;

  it('pointercancel возвращает лист на место, а не закрывает', () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="Лист" onClose={onClose}>
        содержимое
      </BottomSheet>,
    );

    fireEvent.pointerDown(panel(), { pointerId: 1, pointerType: 'touch', clientY: 100 });
    fireEvent.pointerMove(panel(), { pointerId: 1, pointerType: 'touch', clientY: 160 });
    expect(panel().style.transform).toBe('translateY(60px)');

    fireEvent.pointerCancel(panel(), { pointerId: 1, pointerType: 'touch', clientY: 160 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(panel().style.transform).toBe('translateY(0)');
    expect(panel()).not.toHaveClass('is-closing');
  });

  it('лист без прокрутки отдаёт жесту вертикаль: touch-action pan-x', () => {
    render(
      <BottomSheet title="Лист" onClose={vi.fn()}>
        содержимое
      </BottomSheet>,
    );
    expect(panel().style.touchAction).toBe('pan-x');
  });
});
