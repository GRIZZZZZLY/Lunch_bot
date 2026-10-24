import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { _resetBackButtonForTests } from '@/lib/backButton';

const h = vi.hoisted(() => ({
  state: {
    debts: [] as unknown[],
    credits: [] as unknown[],
    debtsLoading: false,
    creditsLoading: false,
    debtsError: false,
    creditsError: false,
    debtsRefetch: vi.fn(),
    creditsRefetch: vi.fn(),
    markPaid: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    markAllPaid: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    cancelMark: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    confirmPayment: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    sendReminder: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    remindAll: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
    undoConfirmation: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  },
}));

/* При отказе запроса data именно undefined — как в TanStack, если ни одна
   попытка не удалась. Компонент опирается на это, отличая «нет данных вовсе»
   от «упал фоновой рефетч поверх уже показанных сумм». */
vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => ({
    data: h.state.debtsError ? undefined : h.state.debts,
    isLoading: h.state.debtsLoading,
    isError: h.state.debtsError,
    refetch: h.state.debtsRefetch,
  }),
  useCredits: () => ({
    data: h.state.creditsError ? undefined : h.state.credits,
    isLoading: h.state.creditsLoading,
    isError: h.state.creditsError,
    refetch: h.state.creditsRefetch,
  }),
  useMarkPaid: () => h.state.markPaid,
  useMarkAllPaid: () => h.state.markAllPaid,
  useCancelMark: () => h.state.cancelMark,
  useConfirmPayment: () => h.state.confirmPayment,
  useSendReminder: () => h.state.sendReminder,
  useRemindAll: () => h.state.remindAll,
  useUndoConfirmation: () => h.state.undoConfirmation,
}));

/* Поток мокаем: в юнит-тестах он полез бы в сеть, а проверяем мы экран. */
vi.mock('@/hooks/useMoneyStream', () => ({ useMoneyStream: () => 'idle' }));

/* Свои реквизиты: по умолчанию заполнены, чтобы остальные сценарии экрана не
   видели предупреждения. */
const pay = vi.hoisted(() => ({
  query: { isSuccess: true, data: undefined as unknown },
  update: { mutateAsync: vi.fn(), isPending: false },
}));
vi.mock('@/hooks/useUser', () => ({
  usePaymentInfo: () => pay.query,
  useUpdatePaymentInfo: () => pay.update,
}));

import { BudgetPage } from '../BudgetPage';

const tx = (over: Record<string, unknown>) => ({
  id: 1,
  amount: 300,
  status: 'PENDING',
  createdAt: '2026-07-20T11:30:00',
  ...over,
});

beforeEach(() => {
  _resetBackButtonForTests();
  delete window.Telegram;
  h.state.debts = [];
  h.state.credits = [];
  h.state.debtsLoading = false;
  h.state.creditsLoading = false;
  h.state.debtsError = false;
  h.state.creditsError = false;
  h.state.debtsRefetch = vi.fn();
  h.state.creditsRefetch = vi.fn();
  for (const m of [h.state.markPaid, h.state.markAllPaid, h.state.cancelMark, h.state.confirmPayment, h.state.sendReminder, h.state.remindAll, h.state.undoConfirmation]) {
    Object.assign(m, { mutate: vi.fn(), isPending: false, variables: undefined });
  }
  pay.query = { isSuccess: true, data: { paymentPhone: '+79990001122' } };
  pay.update = { mutateAsync: vi.fn(), isPending: false };
  window.sessionStorage.clear();
});

describe('BudgetPage — состояния', () => {
  /* Раньше error никто не читал, данные подставлялись пустым массивом, и сбой
     связи выглядел как «долгов нет» — на денежном экране это ложь. */
  it('отказ чтения → ошибка со повтором, а не «нет расчётов»', () => {
    h.state.debtsError = true;
    render(<BudgetPage />);
    expect(screen.queryByText('Нет активных расчётов')).not.toBeInTheDocument();
    expect(screen.getByText('Не удалось загрузить расчёты')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.state.debtsRefetch).toHaveBeenCalled();
  });
});

describe('BudgetPage — должник', () => {
  /* javascript:-ссылка из чужого профиля исполнилась бы по тапу плательщика.
     Проверка схемы стоит и на вводе, и здесь — данные могли попасть в базу
     мимо формы. */
  it('ссылку с опасной схемой не показывает вовсе', () => {
    h.state.debts = [
      tx({
        id: 7,
        status: 'PENDING',
        toUser: { id: 3, firstName: 'Оля', paymentCard: 'javascript:alert(1)' },
      }),
    ];
    render(<BudgetPage />);
    expect(screen.queryByRole('button', { name: /^Перевести/ })).not.toBeInTheDocument();
  });
});

/* Telegram может перезагрузить окно, пока человек в банке. Метка «перевод
   начат» пропадала, ведущей снова становилась «Перевести» — и можно было
   заплатить дважды. Метка живёт до закрытия приложения. */
describe('BudgetPage — метка перевода переживает перезагрузку', () => {
  it('начатый перевод помнится после повторного открытия экрана', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: { id: 3, firstName: 'Оля', paymentCard: 'https://www.tinkoff.ru/rm/abc' } }),
    ];
    const first = render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Перевести 420 ₽/ }));
    first.unmount();

    render(<BudgetPage />);
    expect(screen.getByText(/Перевели\?/)).toBeInTheDocument();
  });
});

/* После отказа отметки вела сплошная «Перевести» — звала заплатить второй раз,
   а какой долг не отмечен, знал только исчезающий тост. */
describe('BudgetPage — неудачная отметка', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentCard: 'https://www.tinkoff.ru/rm/abc', paymentPhone: '+79990001122' };

  it('частичный отказ «Отметить все»: подписан только неотмеченный долг', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: igor, menuItem: { id: 1, name: 'Паста' } }),
      tx({ id: 8, amount: 180, toUser: igor, storeRun: { id: 9, storeName: 'Пятёрочка' }, pollId: null }),
    ];
    h.state.markAllPaid.mutate = vi.fn(
      (items: { id: number; label: string }[], opts?: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.({ failed: [items[1]], total: 2, lastError: null }),
    );
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Отметить все: Игорь/ }));
    expect(screen.getAllByText(/Не отмечено/)).toHaveLength(1);
  });
});
