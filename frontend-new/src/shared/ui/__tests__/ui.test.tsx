import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/rl/primitives';
import { TextField } from '../TextField';
import { InlineNotice } from '../InlineNotice';
import { ErrorState } from '../ErrorState';
import { ConfirmDialog } from '../ConfirmDialog';
import { _resetBackButtonForTests } from '@/lib/backButton';

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
});

describe('Button', () => {
  it('клик работает, type=button по умолчанию', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ок</Button>);
    const btn = screen.getByRole('button', { name: 'Ок' });
    expect(btn).toHaveAttribute('type', 'button');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TextField', () => {
  it('label связан с input', () => {
    render(<TextField label="Цена за всё (×2 шт), ₽" inputMode="decimal" />);
    const input = screen.getByLabelText('Цена за всё (×2 шт), ₽');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('error: role=alert, aria-invalid и aria-describedby', () => {
    render(<TextField label="Название" error="Слишком длинно" />);
    const input = screen.getByLabelText('Название');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Слишком длинно');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('hint подключён через aria-describedby, ноль не запрещён', () => {
    render(<TextField label="Цена" hint="0 — допустимо" defaultValue="0" />);
    const input = screen.getByLabelText('Цена');
    expect(input).toHaveValue('0');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)).toHaveTextContent(
      '0 — допустимо',
    );
  });
});

describe('InlineNotice', () => {
  it('InlineNotice: info/warning → status, critical → alert', () => {
    const { rerender } = render(<InlineNotice tone="info">текст</InlineNotice>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<InlineNotice tone="critical">текст</InlineNotice>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('ErrorState: «Повторить» зовёт onRetry; у forbidden повторять нечего', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ErrorState kind="forbidden" title="Вы не состоите в этой группе" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirm и cancel вызывают обработчики', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Удалить позицию?"
        confirmLabel="Удалить"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('pending: отмена заблокирована, Escape не закрывает, confirm крутится', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Рассчитать?"
        confirmLabel="Рассчитать"
        pending
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toHaveAttribute('aria-busy', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('одновременно активен только один confirm dialog', () => {
    render(
      <>
        <ConfirmDialog title="Первый" onConfirm={() => undefined} onCancel={() => undefined} />
        <ConfirmDialog title="Второй" onConfirm={() => undefined} onCancel={() => undefined} />
      </>,
    );
    const dialogs = screen.getAllByRole('alertdialog');
    expect(dialogs).toHaveLength(1);
    expect(screen.getByText('Первый')).toBeInTheDocument();
    expect(screen.queryByText('Второй')).not.toBeInTheDocument();
  });
});
