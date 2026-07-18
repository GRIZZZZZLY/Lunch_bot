import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoreItem, StoreItemStatus, StoreRunWithRelations } from '@/services/store-run.service';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  setPrice: { mutate: vi.fn(), isPending: false },
  settle: { mutate: vi.fn(), isPending: false },
}));

vi.mock('@/hooks/useStoreRun', () => ({
  useSetItemPrice: () => h.setPrice,
  useSettleStoreRun: () => h.settle,
}));

import { ShoppingView } from '../ShoppingView';

let seq = 0;
function mkItem(userId: number, name: string, status: StoreItemStatus, over: Partial<StoreItem> = {}): StoreItem {
  seq += 1;
  return {
    id: over.id ?? seq,
    storeRunId: 5,
    userId,
    name,
    quantity: over.quantity ?? 1,
    notes: over.notes ?? null,
    price: over.price ?? null,
    status,
    createdAt: '',
    updatedAt: '',
    user: { id: userId, firstName: userId === 1 ? 'Игорь' : userId === 2 ? 'Аня' : 'Пётр' },
    ...over,
  };
}

function mkRun(items: StoreItem[]): StoreRunWithRelations {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка', status: 'SHOPPING',
    collectUntil: '2000-01-01T00:00:00Z', shoppingAt: '2026-07-18T12:00:00Z',
    settledAt: null, cancelledAt: null, createdAt: '2026-07-18T11:00:00Z', updatedAt: '',
    initiator: { id: 1, firstName: 'Игорь' }, items,
  };
}

function renderView(run: StoreRunWithRelations, currentUserId: number) {
  return render(<ShoppingView run={run} currentUserId={currentUserId} />);
}

beforeEach(() => {
  seq = 0;
  _resetBackButtonForTests();
  delete window.Telegram;
  h.setPrice.mutate.mockReset();
  h.setPrice.isPending = false;
  h.settle.mutate.mockReset();
  h.settle.isPending = false;
});

afterEach(() => vi.restoreAllMocks());

describe('ShoppingView — права', () => {
  it('инициатор видит контролы', () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    expect(screen.getByRole('button', { name: 'Куплено' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Не нашли' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
  });

  it('участник не видит контролов, видит прогресс и личную сумму', () => {
    const items = [
      mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: '90' }),
      mkItem(3, 'Кефир', 'NOT_FOUND', { id: 12 }),
      mkItem(2, 'Молоко', 'REQUESTED', { id: 10 }),
    ];
    renderView(mkRun(items), 3);
    expect(screen.queryByRole('button', { name: 'Куплено' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Рассчитать' })).not.toBeInTheDocument();
    expect(screen.getByText(/Обработано 2 из 3/)).toBeInTheDocument();
    expect(screen.getByText(/Ваша текущая сумма/)).toBeInTheDocument();
    expect(screen.getAllByText(/90/).length).toBeGreaterThan(0);
  });

  it('участник без своих позиций — нейтральный текст, без искусственного 0', () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 3);
    expect(screen.getByText('У вас нет позиций в этой закупке.')).toBeInTheDocument();
    expect(screen.queryByText(/Ваша текущая сумма/)).not.toBeInTheDocument();
  });
});

describe('ShoppingView — REQUESTED', () => {
  it('«Куплено» открывает поле, mutation до сохранения не вызывается', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    expect(screen.getByLabelText('Цена за всё, ₽')).toBeInTheDocument();
    expect(h.setPrice.mutate).not.toHaveBeenCalled();
  });

  it('пустая/невалидная цена не отправляется', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Введите цену (0 и больше)')).toBeInTheDocument();
  });

  it("'12,50' отправляет 12.5", async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '12,50');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 12.5, status: 'BOUGHT' } });
  });

  it('0 отправляется как 0', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 0, status: 'BOUGHT' } });
  });

  it('quantity>1 показывает «Цена за всё (×N), ₽»', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10, quantity: 3 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    expect(screen.getByLabelText('Цена за всё (×3), ₽')).toBeInTheDocument();
  });

  it('error сохраняет введённый raw', async () => {
    h.setPrice.mutate.mockImplementation((_a, opts) => opts?.onError?.(new Error('нет сети')));
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Куплено' }));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '55');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByLabelText('Цена за всё, ₽')).toHaveValue('55');
    expect(screen.getByText('нет сети')).toBeInTheDocument();
  });

  it('«Не нашли» отправляет NOT_FOUND/null', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Не нашли' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'NOT_FOUND' } });
  });
});

describe('ShoppingView — BOUGHT / NOT_FOUND', () => {
  it('BOUGHT показывает цену, редактирование prefilled и сохраняется', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: 120 })]), 1);
    expect(screen.getByText(/120/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Изменить цену' }));
    const input = screen.getByLabelText('Цена за всё, ₽');
    expect(input).toHaveValue('120');
    await userEvent.clear(input);
    await userEvent.type(input, '130');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 130, status: 'BOUGHT' } });
  });

  it('BOUGHT → «Не нашли»', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: 120 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Не нашли' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'NOT_FOUND' } });
  });

  it('NOT_FOUND → «Всё-таки куплено» открывает поле и сохраняет BOUGHT', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'NOT_FOUND', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Всё-таки куплено' }));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '75');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 75, status: 'BOUGHT' } });
  });
});

describe('ShoppingView — прогресс и секции', () => {
  it('распределяет по трём секциям и считает X/Y', () => {
    renderView(
      mkRun([
        mkItem(2, 'Молоко', 'REQUESTED', { id: 10 }),
        mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 }),
        mkItem(3, 'Кефир', 'NOT_FOUND', { id: 12 }),
      ]),
      1,
    );
    expect(screen.getByText(/Обработано 2 из 3/)).toBeInTheDocument();
    // section-head «Осталось» уникален; «Куплено»/«Не нашли» дублируются со Status в строках
    expect(screen.getByText('Осталось')).toBeInTheDocument();
    expect(screen.getAllByText('Куплено').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Не нашли').length).toBeGreaterThan(0);
  });

  it('пустой список — InlineNotice, без NaN, settle доступен', () => {
    renderView(mkRun([]), 1);
    expect(screen.getByText('В закупке нет позиций.')).toBeInTheDocument();
    expect(screen.getByText(/Обработано 0 из 0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();
  });
});

describe('ShoppingView — settle', () => {
  it('BOUGHT без цены блокирует settle и показывает количество', () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: null })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
    expect(screen.getByText(/не указана цена/)).toBeInTheDocument();
  });

  it('активная item-мутация блокирует settle', () => {
    h.setPrice.isPending = true;
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });

  it('REQUESTED → ConfirmDialog с точным числом; confirm вызывает settle', async () => {
    renderView(
      mkRun([
        mkItem(2, 'Молоко', 'REQUESTED', { id: 10 }),
        mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 }),
      ]),
      1,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Рассчитать' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/1 позиция не обработана/)).toBeInTheDocument();
    expect(h.settle.mutate).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Рассчитать без них' }));
    expect(h.settle.mutate).toHaveBeenCalledTimes(1);
  });

  it('без REQUESTED settle вызывается напрямую', async () => {
    renderView(mkRun([mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Рассчитать' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.settle.mutate).toHaveBeenCalledTimes(1);
  });

  it('settle pending блокирует кнопку', () => {
    h.settle.isPending = true;
    renderView(mkRun([mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });
});
