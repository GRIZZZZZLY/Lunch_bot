import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { StoreItem, StoreItemStatus, StoreRunWithRelations } from '@/services/store-run.service';
import { SettledView } from '../SettledView';
import { CancelledView } from '../CancelledView';

let seq = 0;
function mkItem(userId: number, name: string, status: StoreItemStatus, over: Partial<StoreItem> = {}): StoreItem {
  seq += 1;
  return {
    id: over.id ?? seq, storeRunId: 5, userId, name,
    quantity: over.quantity ?? 1, notes: over.notes ?? null, price: over.price ?? null, status,
    createdAt: '', updatedAt: '',
    user: { id: userId, firstName: userId === 1 ? 'Игорь' : userId === 2 ? 'Аня' : 'Пётр' },
    ...over,
  };
}

function mkRun(status: 'SETTLED' | 'CANCELLED', items: StoreItem[], over: Partial<StoreRunWithRelations> = {}): StoreRunWithRelations {
  return {
    id: 5, groupId: 1, initiatorId: 1, storeName: 'Пятёрочка', status,
    collectUntil: '2026-07-18T10:00:00Z',
    shoppingAt: over.shoppingAt !== undefined ? over.shoppingAt : '2026-07-18T10:05:00Z',
    settledAt: status === 'SETTLED' ? '2026-07-18T11:00:00Z' : null,
    cancelledAt: status === 'CANCELLED' ? '2026-07-18T11:00:00Z' : null,
    createdAt: '2026-07-18T09:30:00Z', updatedAt: '',
    initiator: { id: 1, firstName: 'Игорь' }, items,
    ...over,
  };
}

/* Фикстура денег: Аня(2) BOUGHT 180 ×2 (не умножается) + NOT_FOUND;
   Пётр(3) BOUGHT 260; Игорь(1, инициатор) BOUGHT 320; Пётр REQUESTED. */
function moneyItems(): StoreItem[] {
  seq = 0;
  return [
    mkItem(2, 'Молоко', 'BOUGHT', { price: '180', quantity: 2 }),
    mkItem(2, 'Кефир', 'NOT_FOUND'),
    mkItem(3, 'Хлеб', 'BOUGHT', { price: 260 }),
    mkItem(1, 'Сыр', 'BOUGHT', { price: '320' }),
    mkItem(3, 'Яблоки', 'REQUESTED'),
  ];
}

function renderView(el: React.ReactElement, withHome = false) {
  return render(
    <MemoryRouter initialEntries={['/store-run/5']}>
      <Routes>
        <Route path="/store-run/:id" element={el} />
        {withHome && <Route path="/" element={<div>root-контент</div>} />}
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  seq = 0;
  delete window.Telegram;
});

describe('SettledView — участник', () => {
  it('долг > 0: «Ваша часть» главным числом + «Итого закупки»; quantity не умножает', () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={2} />);
    // Аня: 180 (×2 НЕ умножается в 360)
    expect(screen.getByText(/Ваша часть/)).toBeInTheDocument();
    expect(screen.getAllByText(/180\s?₽/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/360/)).not.toBeInTheDocument();
    expect(screen.getByText(/Итого закупки/)).toBeInTheDocument();
    expect(screen.getAllByText(/760\s?₽/).length).toBeGreaterThan(0); // 180+260+320
  });

  it('долг 0: нейтральный текст, не главный «0 ₽»', () => {
    seq = 0;
    const items = [mkItem(2, 'Молоко', 'NOT_FOUND'), mkItem(1, 'Сыр', 'BOUGHT', { price: 320 })];
    renderView(<SettledView run={mkRun('SETTLED', items)} currentUserId={2} />);
    expect(screen.getByText('С вас ничего не требуется')).toBeInTheDocument();
    expect(screen.queryByText(/Ваша часть/)).not.toBeInTheDocument();
  });

  it('mutation-контролов нет', () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={2} />);
    for (const name of ['Куплено', 'Не нашли', 'Рассчитать', 'Изменить цену', 'Закрыть сбор', 'Отменить закупку']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('SettledView — инициатор', () => {
  it('«Вам должны» / «Ваши покупки» / «Итого»; свои позиции не долг', () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={1} />);
    expect(screen.getByText(/Вам должны/)).toBeInTheDocument();
    expect(screen.getAllByText(/440\s?₽/).length).toBeGreaterThan(0); // 180+260
    expect(screen.getByText(/Ваши покупки/)).toBeInTheDocument();
    expect(screen.getByText(/свои покупки/)).toBeInTheDocument(); // подпись в breakdown
    expect(screen.queryByText(/Ваша часть/)).not.toBeInTheDocument();
  });
});

describe('SettledView — breakdown и notice', () => {
  it('NOT_FOUND и REQUESTED видны, но не в subtotal; REQUESTED помечен «Не вошло в расчёт»', () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={3} />);
    expect(screen.getAllByText('Не нашли').length).toBeGreaterThan(0);
    expect(screen.getByText('Не обработано')).toBeInTheDocument();
    expect(screen.getByText('Не вошло в расчёт')).toBeInTheDocument();
  });

  it('price=0 не исчезает из breakdown', () => {
    seq = 0;
    const items = [mkItem(2, 'Пакет', 'BOUGHT', { price: 0 })];
    renderView(<SettledView run={mkRun('SETTLED', items)} currentUserId={2} />);
    expect(screen.getAllByText(/0\s?₽/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Куплено').length).toBeGreaterThan(0);
  });

  it('receivable > 0 → «Расчёты созданы…» без утверждения о доставке', () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={1} />);
    expect(screen.getByText('Расчёты созданы. Участники увидят суммы в Telegram.')).toBeInTheDocument();
    expect(screen.queryByText(/разослан/)).not.toBeInTheDocument();
  });

  it('receivable == 0 → «Дополнительные расчёты не требуются.»', () => {
    seq = 0;
    const items = [mkItem(1, 'Сыр', 'BOUGHT', { price: 320 }), mkItem(2, 'Кефир', 'NOT_FOUND')];
    renderView(<SettledView run={mkRun('SETTLED', items)} currentUserId={1} />);
    expect(screen.getByText('Дополнительные расчёты не требуются.')).toBeInTheDocument();
  });
});

describe('CancelledView', () => {
  it('manual-копия при shoppingAt == null', () => {
    renderView(<CancelledView run={mkRun('CANCELLED', moneyItems(), { shoppingAt: null })} currentUserId={2} />);
    expect(screen.getByText('Закупка отменена инициатором.')).toBeInTheDocument();
  });

  it('auto-копия при shoppingAt != null; без точного таймаута в минутах', () => {
    renderView(<CancelledView run={mkRun('CANCELLED', moneyItems())} currentUserId={2} />);
    expect(screen.getByText('Закупка отменена автоматически: расчёт не был завершён вовремя.')).toBeInTheDocument();
    expect(screen.queryByText(/минут/)).not.toBeInTheDocument();
  });

  it('история read-only: статусы и цены видны, контролов нет', () => {
    renderView(<CancelledView run={mkRun('CANCELLED', moneyItems())} currentUserId={3} />);
    expect(screen.getByText('Ваши позиции')).toBeInTheDocument(); // группа текущего
    expect(screen.getAllByText('Куплено').length).toBeGreaterThan(0);
    expect(screen.getByText('Запрошено')).toBeInTheDocument();
    for (const name of ['Куплено', 'Не нашли', 'Рассчитать', 'Добавить позицию']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('пустая закупка → EmptyState', () => {
    renderView(<CancelledView run={mkRun('CANCELLED', [])} currentUserId={2} />);
    expect(screen.getByText('В закупке не было позиций')).toBeInTheDocument();
  });
});

describe('терминальные — навигация', () => {
  it('«На главную» ведёт на / (не sticky-зона)', async () => {
    renderView(<SettledView run={mkRun('SETTLED', moneyItems())} currentUserId={2} />, true);
    const btn = screen.getByRole('button', { name: 'На главную' });
    expect(btn.closest('div')?.className).not.toContain('cta');
    await userEvent.click(btn);
    expect(screen.getByText('root-контент')).toBeInTheDocument();
  });

  it('CANCELLED: «На главную» тоже работает', async () => {
    renderView(<CancelledView run={mkRun('CANCELLED', [])} currentUserId={2} />, true);
    await userEvent.click(screen.getByRole('button', { name: 'На главную' }));
    expect(screen.getByText('root-контент')).toBeInTheDocument();
  });
});

describe('терминальные — устойчивость к неполным данным', () => {
  it('items без user не роняют рендер', () => {
    seq = 0;
    const item = { ...mkItem(2, 'Молоко', 'BOUGHT', { price: '10' }), user: undefined };
    renderView(<SettledView run={mkRun('SETTLED', [item])} currentUserId={3} />);
    expect(screen.getByText('Участник')).toBeInTheDocument();
  });
});
