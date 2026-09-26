import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../primitives';

/* Занятая кнопка раньше получала disabled, и браузер сбрасывал с неё фокус в
   начало страницы: после «Отметить» или «Подтвердить» человек с клавиатурой
   или диктором терял место на экране. */
describe('Button — занятая', () => {
  it('остаётся в фокусе и говорит, что занята', () => {
    render(<Button loading>Подтвердить</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('не срабатывает повторно и не отправляет форму', () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading onClick={onClick}>
          Сохранить
        </Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('выключенная кнопка по-прежнему disabled', () => {
    render(<Button disabled>Отметить</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
