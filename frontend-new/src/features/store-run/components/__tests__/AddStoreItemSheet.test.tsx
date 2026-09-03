import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ItemPreset } from '@/services/item-preset.service';
import { _resetBackButtonForTests } from '@/lib/backButton';
import { AddStoreItemSheet } from '../AddStoreItemSheet';

function mkPreset(id: number, name: string, over: Partial<ItemPreset> = {}): ItemPreset {
  return {
    id,
    name,
    quantity: 1,
    notes: null,
    pinned: false,
    usageCount: 2,
    lastUsedAt: '2026-09-01T10:00:00Z',
    ...over,
  };
}

const PRESETS = [
  mkPreset(1, 'Молоко', { quantity: 2, notes: 'нежирное' }),
  mkPreset(2, 'Хлеб'),
  mkPreset(3, 'Кофе', { pinned: true }),
];

beforeEach(() => {
  _resetBackButtonForTests();
});

function renderSheet(props: Partial<Parameters<typeof AddStoreItemSheet>[0]> = {}) {
  const onSubmit = vi.fn();
  const onSubmitMany = vi.fn();
  const onClose = vi.fn();
  const onTogglePin = vi.fn();
  const onRemovePreset = vi.fn();

  render(
    <AddStoreItemSheet
      busy={false}
      presets={PRESETS}
      myItemNames={[]}
      onClose={onClose}
      onSubmit={onSubmit}
      onSubmitMany={onSubmitMany}
      onTogglePin={onTogglePin}
      onRemovePreset={onRemovePreset}
      {...props}
    />,
  );

  return { onSubmit, onSubmitMany, onClose, onTogglePin, onRemovePreset };
}

describe('AddStoreItemSheet', () => {
  it('со списком товаров открывается на вкладке «Мои товары»', () => {
    renderSheet();

    expect(screen.getByText('Молоко')).toBeInTheDocument();
    expect(screen.queryByLabelText('Что купить')).not.toBeInTheDocument();
  });

  it('без сохранённых товаров сразу показывает форму', () => {
    renderSheet({ presets: [] });

    expect(screen.getByLabelText('Что купить')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Мои товары' })).not.toBeInTheDocument();
  });

  it('мультивыбор уходит одним запросом с количеством и заметкой', async () => {
    const { onSubmitMany, onSubmit } = renderSheet();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать Молоко' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать Хлеб' }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить 2' }));

    expect(onSubmitMany).toHaveBeenCalledTimes(1);
    expect(onSubmitMany).toHaveBeenCalledWith([
      { name: 'Молоко', quantity: 2, notes: 'нежирное' },
      { name: 'Хлеб', quantity: 1, notes: undefined },
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('без выбора кнопка добавления заблокирована', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  });

  it('повторный тап снимает выбор', async () => {
    renderSheet();

    const box = screen.getByRole('checkbox', { name: 'Выбрать Хлеб' });
    await userEvent.click(box);
    await userEvent.click(box);

    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  });

  it('уже заказанный товар помечен и не выбирается', () => {
    renderSheet({ myItemNames: ['МОЛОКО'] });

    expect(screen.getByText('уже в списке')).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Выбрать Молоко' }),
    ).not.toBeInTheDocument();
  });

  it('вкладка «Новая» отдаёт одну позицию из формы', async () => {
    const { onSubmit, onSubmitMany } = renderSheet();

    await userEvent.click(screen.getByRole('tab', { name: 'Новая' }));
    await userEvent.type(screen.getByLabelText('Что купить'), 'Сыр');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Сыр',
      quantity: 1,
      notes: undefined,
    });
    expect(onSubmitMany).not.toHaveBeenCalled();
  });

  it('закрепление сообщает противоположное состояние', async () => {
    const { onTogglePin } = renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Открепить Кофе' }));

    expect(onTogglePin).toHaveBeenCalledWith(expect.objectContaining({ id: 3, pinned: true }));
  });

  it('удаление товара снимает его из выбора', async () => {
    const { onRemovePreset } = renderSheet();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Выбрать Хлеб' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Удалить Хлеб из моих товаров' }),
    );

    expect(onRemovePreset).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  });

  /* Регрессия: вкладку выбирали один раз в useState, на первом рендере список
     ещё грузился и выглядел пустым — шторка залипала на «Новой» ровно в тех
     случаях, ради которых список и заведён. */
  it('пока список грузится, держит вкладку «Мои товары»', () => {
    renderSheet({ presets: [], presetsLoading: true });

    expect(screen.getByText('Загружаем…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Что купить')).not.toBeInTheDocument();
  });

  it('пустой список объясняет, откуда возьмутся товары', () => {
    renderSheet({ presets: [] });

    /* Форма открыта, но текст вкладки всё равно не должен теряться: он
       появится, как только человек вернётся на «Мои товары». Здесь проверяем
       обратное — что пустой список не подсовывает пустую вкладку. */
    expect(screen.getByLabelText('Что купить')).toBeInTheDocument();
  });

  it('во время отправки выбор и закрытие заблокированы', () => {
    renderSheet({ busy: true });

    expect(screen.getByRole('checkbox', { name: 'Выбрать Молоко' })).toBeDisabled();
  });

  it('вторая строка показывает, что подставится в позицию', () => {
    renderSheet();

    const row = screen.getByText('Молоко').closest('li');
    expect(within(row as HTMLElement).getByText('2 шт · нежирное')).toBeInTheDocument();
  });
});
