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

/* Имя кнопки строки включает позицию: в списке из десяти покупок десять
   одинаковых «Куплено» скринридеру ничего не сообщают. */
const rowBtn = (action: string, name: string) => ({ name: `${action}: ${name}` });

describe('ShoppingView — права', () => {
  it('инициатор видит контролы', () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    expect(screen.getByRole('button', rowBtn('Куплено', 'Молоко'))).toBeInTheDocument();
    expect(screen.getByRole('button', rowBtn('Не нашли', 'Молоко'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
  });
});

describe('ShoppingView — REQUESTED', () => {
  it('«Не нашли» отправляет NOT_FOUND/null', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Не нашли', 'Молоко')));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'NOT_FOUND' } });
  });
});

describe('ShoppingView — цена отдельным шагом', () => {
  const unpriced = () => mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: null })]);

  it.each(['', '100001', '-1'])('цена %j не отправляется', async (raw) => {
    renderView(unpriced(), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Указать цену', 'Молоко')));
    if (raw) await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), raw);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate).not.toHaveBeenCalled();
  });

  it("'12,50' отправляет 12.5", async () => {
    renderView(unpriced(), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Указать цену', 'Молоко')));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '12,50');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 12.5, status: 'BOUGHT' } });
  });

  it('отказ сервера остаётся у поля и сохраняет введённый raw', async () => {
    h.setPrice.mutate.mockImplementation((_a, opts) => opts?.onError?.(new Error('нет сети')));
    renderView(unpriced(), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Указать цену', 'Молоко')));
    await userEvent.type(screen.getByLabelText('Цена за всё, ₽'), '55');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(screen.getByLabelText('Цена за всё, ₽')).toHaveValue('55');
    expect(screen.getByText('нет сети')).toBeInTheDocument();
  });

  it('без цены «Не нашли» не спрашивает подтверждения — стирать нечего', async () => {
    renderView(unpriced(), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Не нашли', 'Молоко')));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'NOT_FOUND' } });
  });
});

describe('ShoppingView — BOUGHT / NOT_FOUND', () => {
  it('BOUGHT показывает цену, редактирование prefilled и сохраняется', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: 120 })]), 1);
    expect(screen.getByText(/120/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', rowBtn('Изменить цену', 'Молоко')));
    const input = screen.getByLabelText('Цена за всё, ₽');
    expect(input).toHaveValue('120');
    await userEvent.clear(input);
    await userEvent.type(input, '130');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: 130, status: 'BOUGHT' } });
  });

  it('BOUGHT → «Не нашли» стирает цену только после подтверждения', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: 120 })]), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Не нашли', 'Молоко')));
    expect(h.setPrice.mutate).not.toHaveBeenCalled();

    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));
    expect(h.setPrice.mutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', rowBtn('Не нашли', 'Молоко')));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Не нашли' }),
    );
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'NOT_FOUND' } });
  });

  it('NOT_FOUND → «Всё-таки куплено» возвращает в BOUGHT одним касанием', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'NOT_FOUND', { id: 10 })]), 1);
    await userEvent.click(screen.getByRole('button', rowBtn('Всё-таки куплено', 'Молоко')));
    expect(h.setPrice.mutate.mock.calls[0][0]).toEqual({ itemId: 10, payload: { price: null, status: 'BOUGHT' } });
  });
});

describe('ShoppingView — прогресс и секции', () => {
  it('пустой список — без NaN, settle доступен', () => {
    const { container } = renderView(mkRun([]), 1);
    expect(container.textContent).not.toMatch(/NaN/);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();
  });
});

describe('ShoppingView — settle', () => {
  /* Непроставленная цена не гасит кнопку, а перенаправляет её: заблокированная
     primary была тупиком, из которого не видно, чем она занята. */
  it('BOUGHT без цены: settle не вызывается, открывается редактор этой позиции', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'BOUGHT', { id: 10, price: null })]), 1);
    const settleBtn = screen.getByRole('button', { name: 'Рассчитать' });
    expect(settleBtn).toBeEnabled();

    await userEvent.click(settleBtn);

    expect(h.settle.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Цена за всё/)).toBeInTheDocument();
  });

  /* Отметка в полёте блокирует расчёт: settle по недосчитанному списку создал
     бы транзакции мимо позиции, которая как раз меняет статус. */
  it('активная item-мутация блокирует settle', async () => {
    renderView(mkRun([mkItem(2, 'Молоко', 'REQUESTED', { id: 10 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();
    // mutate замокан и не вызывает onSettled — отметка остаётся «в полёте»
    await userEvent.click(screen.getByRole('button', rowBtn('Куплено', 'Молоко')));
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });

  it('без REQUESTED settle вызывается напрямую', async () => {
    renderView(mkRun([mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 })]), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Рассчитать' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.settle.mutate).toHaveBeenCalledTimes(1);
  });

  /* Открытый редактор цены — незакрытый ввод. Расчёт по нему прошёл бы мимо
     набранного числа, а сама кнопка стёрла бы его без следа. */
  it('открытый редактор цены блокирует settle, отмена разблокирует', async () => {
    renderView(mkRun([mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', rowBtn('Изменить цену', 'Хлеб')));
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeEnabled();
  });

  it('settle pending блокирует кнопку', () => {
    h.settle.isPending = true;
    renderView(mkRun([mkItem(3, 'Хлеб', 'BOUGHT', { id: 11, price: 90 })]), 1);
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeDisabled();
  });
});
