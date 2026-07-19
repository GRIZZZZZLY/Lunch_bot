import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomSheet, shouldDismissSheet } from '../BottomSheet';
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

describe('shouldDismissSheet — velocity/offset пороги жеста', () => {
  it('быстрый свайп закрывает (velocity > 0.11 px/ms)', () => {
    expect(shouldDismissSheet(120, 100, 600)).toBe(true); // v = 1.2
  });
  it('медленный, но далёкий закрывает (offset > 35% высоты)', () => {
    expect(shouldDismissSheet(250, 5000, 600)).toBe(true); // 41%
  });
  it('медленный и близкий — snap-back', () => {
    expect(shouldDismissSheet(100, 5000, 600)).toBe(false); // 16%, v=0.02
  });
  it('нулевое/отрицательное смещение — никогда', () => {
    expect(shouldDismissSheet(0, 100, 600)).toBe(false);
    expect(shouldDismissSheet(-40, 10, 600)).toBe(false);
  });
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

  it('переносит фокус внутрь и восстанавливает после закрытия (exit 200ms)', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Открыть' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape закрывает шторку после exit-анимации', async () => {
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
  });

  it('блокирует прокрутку body и восстанавливает её', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('закрывается по клику на backdrop', async () => {
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await userEvent.click(backdrop);
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
  });

  it('регистрируется в стеке оверлеев (закрытие через Telegram BackButton)', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    act(() => {
      expect(closeTopOverlay()).toBe(true);
    });
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
  });

  it('closable=false: Escape и BackButton не закрывают и не запускают exit', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="Заблокировано" onClose={onClose} closable={false}>
        <div>контент</div>
      </BottomSheet>,
    );
    await userEvent.keyboard('{Escape}');
    act(() => {
      closeTopOverlay();
    });
    await new Promise((r) => setTimeout(r, 250));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
