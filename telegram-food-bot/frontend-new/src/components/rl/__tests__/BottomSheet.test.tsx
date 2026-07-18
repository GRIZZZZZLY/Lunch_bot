import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet } from '../BottomSheet';
import { _resetBackButtonForTests, closeTopOverlay } from '@/lib/backButton';

function Harness({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Открыть</button>
      {open && (
        <BottomSheet
          title="Тестовая шторка"
          onClose={() => {
            setOpen(false);
            onClosed?.();
          }}
        >
          <button>Внутри</button>
        </BottomSheet>
      )}
    </div>
  );
}

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  document.body.style.overflow = '';
});

describe('BottomSheet — доступность', () => {
  it('связывает заголовок через aria-labelledby', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    const dialog = screen.getByRole('dialog');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)).toHaveTextContent('Тестовая шторка');
  });

  it('переносит фокус внутрь и восстанавливает после закрытия', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Открыть' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape закрывает шторку', async () => {
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    await userEvent.keyboard('{Escape}');
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('блокирует прокрутку body и восстанавливает её', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('закрывается по клику на backdrop', async () => {
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('регистрируется в стеке оверлеев (закрытие через Telegram BackButton)', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    act(() => {
      expect(closeTopOverlay()).toBe(true);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
