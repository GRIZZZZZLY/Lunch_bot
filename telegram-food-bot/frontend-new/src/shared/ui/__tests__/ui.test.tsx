import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { Status } from '../Status';
import { InlineNotice } from '../InlineNotice';
import { EmptyState } from '../EmptyState';
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

  it('loading: aria-busy, disabled, клики не проходят, текст остаётся в DOM (ширина не меняется)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Сохранить
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Сохранить');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
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

describe('Status / InlineNotice', () => {
  it('Status всегда содержит текст (цвет — не единственный канал)', () => {
    render(<Status tone="warning">В магазине</Status>);
    expect(screen.getByText('В магазине')).toBeInTheDocument();
  });

  it('InlineNotice: info/warning → status, critical → alert', () => {
    const { rerender } = render(<InlineNotice tone="info">текст</InlineNotice>);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<InlineNotice tone="critical">текст</InlineNotice>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('EmptyState / ErrorState', () => {
  it('EmptyState: заголовок, описание, действие', async () => {
    const onAdd = vi.fn();
    render(
      <EmptyState
        title="Пока пусто"
        description="Добавьте первым"
        action={<Button onClick={onAdd}>Добавить</Button>}
      />,
    );
    expect(screen.getByText('Пока пусто')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('ErrorState: пресет network + retry; тексты перекрываемы', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ErrorState kind="forbidden" title="Вы не состоите в этой группе" />);
    expect(screen.getByText('Вы не состоите в этой группе')).toBeInTheDocument();
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
