import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RouletteRevealOverlay } from '../RouletteRevealOverlay';
import { _resetBackButtonForTests, closeTopOverlay } from '@/lib/backButton';

/* Рулетка — оверлей по правилам листа: «Назад» и Escape закрывают сначала её,
   фон под inert, рендер в портале у body. Раньше «Назад» уводил со страницы. */
describe('RouletteRevealOverlay', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    _resetBackButtonForTests();
    vi.useFakeTimers();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });
  afterEach(() => {
    vi.useRealTimers();
    root.remove();
  });

  const open = (onClose = vi.fn()) => {
    render(<RouletteRevealOverlay open names={['Аня', 'Игорь']} winnerName="Аня" onClose={onClose} />, {
      container: root,
    });
    return onClose;
  };

  it('живёт вне #root, а #root на это время под inert', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(root.contains(dialog)).toBe(false);
    expect(root).toHaveAttribute('inert');
  });

  it('«Назад» закрывает рулетку, а не страницу — после ухода', () => {
    const onClose = open();
    let handled = false;
    act(() => {
      handled = closeTopOverlay();
    });
    expect(handled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape закрывает так же', () => {
    const onClose = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
