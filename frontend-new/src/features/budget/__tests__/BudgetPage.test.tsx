import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/* Состав долга раньше открывался только по ссылке-дате на страницу закупки или
   результатов: из Главной в «Расчёты», оттуда дальше. Теперь строка
   раскрывается на месте. */
describe('BudgetPage — подробности строки', () => {
  const storeDebt = () =>
    tx({
      pollId: null,
      amount: 180,
      storeRun: { id: 9, storeName: 'Пятёрочка' },
      storeItem: { id: 40, name: 'Хлеб', quantity: 1 },
      toUser: { id: 2, firstName: 'Аня', paymentPhone: '+79990001122' },
    });

  it('дата и «за что» — текст, а не ссылка на другую страницу', () => {
    h.state.debts = [storeDebt()];
    render(<BudgetPage />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Пятёрочка')).toBeInTheDocument();
  });

  it('«Подробнее» раскрывает состав долга на месте и сворачивает его обратно', () => {
    h.state.debts = [storeDebt()];
    render(<BudgetPage />);

    const toggle = screen.getByRole('button', { name: /^Подробнее/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Закупка «Пятёрочка»')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Закупка «Пятёрочка»')).toBeInTheDocument();
    expect(screen.getByText('Хлеб')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Свернуть/ }));
    expect(screen.queryByText('Закупка «Пятёрочка»')).not.toBeInTheDocument();
  });

  it('у каждой строки своё раскрытие', () => {
    h.state.credits = [
      tx({ id: 11, fromUser: { id: 3, firstName: 'Оля' }, menuItem: { id: 1, name: 'Борщ' }, itemPrice: 250, deliveryShare: 50 }),
      tx({ id: 12, fromUser: { id: 4, firstName: 'Мария' }, menuItem: { id: 2, name: 'Плов' }, itemPrice: 250, deliveryShare: 50 }),
    ];
    render(<BudgetPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /^Подробнее/ })[0]);
    expect(screen.getAllByRole('button', { name: /^Подробнее/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Свернуть/ })).toHaveLength(1);
  });

  /* Шесть кнопок подряд назывались просто «Подробнее»: диктору было не
     понять, какую строку раскрывает каждая. */
  it('кнопка раскрытия называет свою строку', () => {
    h.state.debts = [storeDebt()];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: 'Подробнее: Аня, 180 ₽' })).toBeInTheDocument();
  });

  /* У одного блюда без долей панель повторяла строку: «Обед / Борщ 390 ₽». */
  it('где раскрывать нечего, кнопки «Подробнее» нет', () => {
    h.state.credits = [tx({ id: 11, fromUser: { id: 3, firstName: 'Оля' }, menuItem: { id: 1, name: 'Борщ' } })];
    render(<BudgetPage />);

    expect(screen.queryByRole('button', { name: /^Подробнее/ })).not.toBeInTheDocument();
  });
});

/* Самая заметная кнопка строки говорила «деньги ушли» («Отметить»), а перевод
   стоял ниже бледной пилюлей — ровно та ошибка, против которой написана
   заметка над списком. Теперь ведёт перевод. */
describe('BudgetPage — сначала перевести', () => {
  const withLink = () =>
    tx({
      id: 7,
      amount: 420,
      toUser: { id: 3, firstName: 'Оля', paymentCard: 'https://www.tinkoff.ru/rm/abc', paymentPhone: '+79990001122' },
    });

  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  it('ведущая кнопка — «Перевести», «Отметить» контурная', () => {
    h.state.debts = [withLink()];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: /^Перевести 420 ₽/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--outline');
  });

  it('после перевода строка спрашивает «Перевели?», и ведущей становится отметка', () => {
    h.state.debts = [withLink()];
    render(<BudgetPage />);

    fireEvent.click(screen.getByRole('button', { name: /^Перевести 420 ₽/ }));

    expect(screen.getByText(/Перевели\? Отметьте оплату/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Перевести 420 ₽/ })).toHaveClass('btn--outline');
  });

  it('скопированный телефон СБП — тоже начало перевода', () => {
    h.state.debts = [tx({ id: 7, toUser: { id: 3, firstName: 'Оля', paymentPhone: '+79990001122' } })];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--outline');
    fireEvent.click(screen.getByRole('button', { name: /Скопировать СБП/ }));
    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--primary');
  });

  it('без реквизитов переводить некуда — ведущая сама отметка', () => {
    h.state.debts = [tx({ id: 7, toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--primary');
  });
});

/* Колонка одинаковых сплошных «Напомнить» прятала «Подтвердить» — единственное
   действие, где нужно решение сборщика. Напоминание — контурная кнопка: явно
   активная, но не сплошная. */
describe('BudgetPage — напоминания', () => {
  it('«Напомнить» контурная, «Подтвердить» сплошная', () => {
    h.state.credits = [
      tx({ id: 11, fromUser: { id: 3, firstName: 'Оля' } }),
      tx({ id: 12, status: 'PAID', fromUser: { id: 4, firstName: 'Ян' } }),
    ];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: /^Напомнить: Оля/ })).toHaveClass('btn--outline');
    expect(screen.getByRole('button', { name: /^Подтвердить: Ян/ })).toHaveClass('btn--primary');
  });

  it('после напоминания кнопка гаснет до конца паузы и говорит «Напомнили»', () => {
    h.state.credits = [
      tx({
        id: 11,
        fromUser: { id: 3, firstName: 'Оля' },
        reminderCount: 1,
        lastReminderAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ];
    render(<BudgetPage />);

    /* aria-disabled, а не disabled: погашенная кнопка остаётся в обходе с
       клавиатуры, и диктор может прочитать, почему она не работает. */
    const button = screen.getByRole('button', { name: /^Напомнили: Оля/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(h.state.sendReminder.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Напомнить: Оля/ })).not.toBeInTheDocument();
  });

  it('«Напомнить всем» считает только тех, кому можно напомнить сейчас', () => {
    h.state.credits = [
      tx({ id: 9, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, fromUser: { id: 4, firstName: 'Оля' } }),
      tx({
        id: 11,
        fromUser: { id: 5, firstName: 'Мария' },
        reminderCount: 1,
        lastReminderAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ];
    render(<BudgetPage />);

    expect(screen.getByRole('button', { name: /Напомнить всем · 2/ })).toHaveClass('btn--outline');
  });
});

/* Закрытие долга — конец всего цикла от обеда до денег. Раньше это был самый
   плоский момент экрана; теперь он печатается тем же Штампом, что голос. */
describe('BudgetPage — Штамп на закрытии долга', () => {
  it('подтверждённая оплата печатается штампом, а открытие экрана — нет', async () => {
    const stampModule = await import('@/shared/lib/stamp');
    const spy = vi.spyOn(stampModule, 'stamp');
    h.state.confirmPayment.mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    h.state.credits = [tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } })];
    const { rerender } = render(<BudgetPage />);
    expect(spy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Подтвердить' }));
    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', confirmedAt: new Date().toISOString(), fromUser: { id: 2, firstName: 'Ян' } }),
    ];
    rerender(<BudgetPage />);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('уже закрытые долги при открытии экрана не штампуются', async () => {
    const stampModule = await import('@/shared/lib/stamp');
    const spy = vi.spyOn(stampModule, 'stamp');
    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', confirmedAt: new Date().toISOString(), fromUser: { id: 2, firstName: 'Ян' } }),
    ];
    render(<BudgetPage />);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

/* Блок «куда переводить» раньше просто пропадал: должник видел долг и не
   понимал, куда платить, а получатель — почему ему не платят. */
describe('BudgetPage — нет реквизитов', () => {
  it('у долга без реквизитов получателя сказано спросить лично', () => {
    h.state.debts = [tx({ toUser: { id: 2, firstName: 'Аня' } })];
    render(<BudgetPage />);

    expect(screen.getByText('Реквизитов нет — спросите лично')).toBeInTheDocument();
  });

  it('получателю без реквизитов показано предупреждение с кнопкой', async () => {
    pay.query = { isSuccess: true, data: undefined };
    h.state.credits = [tx({ fromUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);

    expect(screen.getByText(/должники не знают, куда переводить/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Указать реквизиты' }));
    expect(await screen.findByRole('dialog', { name: 'Реквизиты СБП' })).toBeInTheDocument();
  });

  it('с реквизитами предупреждения нет', () => {
    h.state.credits = [tx({ fromUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);

    expect(screen.queryByText(/должники не знают/)).not.toBeInTheDocument();
  });

  it('когда все отметили оплату, предупреждать поздно и незачем', () => {
    pay.query = { isSuccess: true, data: undefined };
    h.state.credits = [tx({ status: 'PAID', fromUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);

    expect(screen.queryByText(/должники не знают/)).not.toBeInTheDocument();
  });
});

describe('BudgetPage — состояния', () => {
  it('пусто → EmptyState', () => {
    render(<BudgetPage />);
    expect(screen.getByText('Нет активных расчётов')).toBeInTheDocument();
  });

  it('загрузка → скелетон, без EmptyState', () => {
    h.state.debtsLoading = true;
    render(<BudgetPage />);
    expect(screen.queryByText('Нет активных расчётов')).not.toBeInTheDocument();
  });

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
  it('PENDING → «Отметить» зовёт markPaid(id)', () => {
    h.state.debts = [tx({ id: 7, status: 'PENDING', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Оля')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Отметить оплату: Оля/ }));
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(7, expect.any(Object));
  });

  it('PAID → «Отменить отметку» зовёт cancelMark(id), статус «Ждёт»', () => {
    h.state.debts = [tx({ id: 7, status: 'PAID', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ждёт')).toBeInTheDocument();
    // статус говорит только чип — текстового дубля в строке быть не должно
    expect(screen.queryByText(/^уже /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Отменить отметку: Оля/ }));
    expect(h.state.cancelMark.mutate).toHaveBeenCalledWith(7, expect.any(Object));
  });

  /* Ссылка СБП — главное действие строки: по ней открывается банк, а телефон
     надо скопировать и вставить руками. Телефон при этом остаётся видимым. */
  it('ссылка СБП даёт кнопку перевода и не прячет телефон', () => {
    h.state.debts = [
      tx({
        id: 7,
        status: 'PENDING',
        toUser: {
          id: 3,
          firstName: 'Оля',
          paymentPhone: '+7 900 111-22-33',
          paymentCard: 'https://www.tinkoff.ru/rm/abc',
        },
      }),
    ];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Перевести/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Скопировать СБП/ })).toBeInTheDocument();
  });

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

  it('сумма долга — отдельный узел, а не хвост подписи с именем', () => {
    h.state.debts = [tx({ id: 7, amount: 420, status: 'PENDING', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    const person = screen.getByText('Оля');
    expect(person.textContent).toBe('Оля');
    // сумма живёт соседним узлом строки, а не суффиксом подписи
    expect(person.closest('div')?.querySelector('.tnum')?.textContent).toBe('420 ₽');
  });

  /* Регрессия на цепочку `??` по variables: markPaid уже завершилась, но её
     variables сохранились, из-за чего занятость залипала на id 7 и кнопка
     строки 8 теряла спиннер вместе с блокировкой — второе касание уходило
     на сервер. */
  it('занятость принадлежит своей строке и своему действию', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, status: 'PENDING', toUser: { id: 3, firstName: 'Оля' } }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: { id: 4, firstName: 'Пётр' } }),
    ];
    // завершившаяся ранее мутация оставила после себя variables
    Object.assign(h.state.markPaid, { isPending: false, variables: 7 });
    Object.assign(h.state.cancelMark, { isPending: true, variables: 8 });
    render(<BudgetPage />);

    const cancel = screen.getByRole('button', { name: /^Отменить отметку: Пётр/ });
    // занятая, но в фокусе: aria-disabled, а не disabled
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    expect(cancel).toHaveAttribute('aria-busy', 'true');
    // а чужая строка занятой не выглядит
    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toBeEnabled();
  });

  it('CONFIRMED → «Долг закрыт» с получателем и суммой', () => {
    h.state.debts = [
      tx({ id: 7, status: 'CONFIRMED', amount: 420, confirmedAt: new Date().toISOString(), toUser: { id: 3, firstName: 'Игорь' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByText('Долг закрыт')).toBeInTheDocument();
    expect(screen.getByText(/Игорь · 420 ₽/)).toBeInTheDocument();
  });

  it('два закрытых долга → «Долги закрыты»', () => {
    const at = new Date().toISOString();
    h.state.debts = [
      tx({ id: 7, status: 'CONFIRMED', amount: 420, confirmedAt: at, toUser: { id: 3, firstName: 'Игорь' } }),
      tx({ id: 8, status: 'CONFIRMED', amount: 180, confirmedAt: at, toUser: { id: 3, firstName: 'Игорь' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByText('Долги закрыты')).toBeInTheDocument();
  });
});

describe('BudgetPage — сборщик', () => {
  /* Подтверждение необратимо (CONFIRMED не отменяется ни в UI, ни в API),
     поэтому между касанием и мутацией стоит диалог. */
  it('PAID кредит → «Подтвердить» спрашивает, и только потом зовёт confirmPayment(id)', () => {
    h.state.credits = [tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ян')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    expect(h.state.confirmPayment.mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Передумать можно в течение суток');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить' }));
    expect(h.state.confirmPayment.mutate).toHaveBeenCalledWith(9, expect.any(Object));
  });

  it('отмена диалога не подтверждает оплату', () => {
    h.state.credits = [tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));
    expect(h.state.confirmPayment.mutate).not.toHaveBeenCalled();
  });

  it('PENDING кредит → «Напомнить» зовёт sendReminder(id)', () => {
    h.state.credits = [tx({ id: 9, status: 'PENDING', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Напомнить: Ян/ }));
    expect(h.state.sendReminder.mutate).toHaveBeenCalledWith(9);
  });

  /* Сборщику с восемью должниками восемь одинаковых касаний. Кнопка появляется
     от двух: на одном она ничего не экономит. Массового ПОДТВЕРЖДЕНИЯ нет
     сознательно — необратимое денежное действие не пакетируется. */
  it('от двух должников появляется «Напомнить всем», подтверждение массовым не бывает', () => {
    h.state.credits = [
      tx({ id: 9, status: 'PENDING', fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, status: 'PENDING', fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);

    fireEvent.click(screen.getByRole('button', { name: /Напомнить всем/ }));
    expect(h.state.remindAll.mutate).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Напомнить всем' }),
    );
    expect(h.state.remindAll.mutate).toHaveBeenCalledWith([9, 10]);

    expect(screen.queryByRole('button', { name: /Подтвердить всем/ })).not.toBeInTheDocument();
  });

  it('один должник — массовой кнопки нет', () => {
    h.state.credits = [tx({ id: 9, status: 'PENDING', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    expect(screen.queryByRole('button', { name: /Напомнить всем/ })).not.toBeInTheDocument();
  });

  it('все рассчитались → секция «Все рассчитались»', () => {
    h.state.credits = [tx({ id: 9, status: 'CONFIRMED' })];
    render(<BudgetPage />);
    expect(screen.getByText('Все рассчитались')).toBeInTheDocument();
  });
});

/* Раньше подтверждённое уходило из активных, и ошибочное подтверждение нельзя
   было исправить вообще. Окно — сутки; проверяет сервер, экран лишь показывает. */
describe('BudgetPage — отмена подтверждения', () => {
  const freshlyConfirmed = () =>
    tx({ id: 9, status: 'CONFIRMED', confirmedAt: new Date().toISOString(), fromUser: { id: 2, firstName: 'Ян' } });

  it('свежее подтверждение можно отменить — через диалог', () => {
    h.state.credits = [freshlyConfirmed()];
    render(<BudgetPage />);
    expect(screen.getByText('Подтверждено сегодня')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Отменить подтверждение: Ян/ }));
    expect(h.state.undoConfirmation.mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('участник получит уведомление');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить подтверждение' }));
    expect(h.state.undoConfirmation.mutate).toHaveBeenCalledWith(9);
  });

  it('подтверждение старше суток отменить нельзя — блока нет', () => {
    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', confirmedAt: '2026-01-01T00:00:00.000Z', fromUser: { id: 2, firstName: 'Ян' } }),
    ];
    render(<BudgetPage />);
    expect(screen.queryByText('Подтверждено сегодня')).not.toBeInTheDocument();
  });
});

/* Итог секции складывал «ещё перевести» и «уже отмечено, ждёт получателя»:
   после отметки «Мои долги» по-прежнему показывали 600 ₽. */
describe('BudgetPage — честные итоги', () => {
  it('«к переводу» — только непереведённое, отмеченное — отдельной строкой', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: { id: 3, firstName: 'Оля' } }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: { id: 3, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByText('к переводу')).toBeInTheDocument();
    expect(screen.getByText(/180 ₽ ждёт подтверждения/)).toBeInTheDocument();
    expect(screen.queryByText('600 ₽')).not.toBeInTheDocument();
  });

  it('всё отмечено → переводить нечего, заметки «переведите сами» нет', () => {
    h.state.debts = [tx({ id: 8, amount: 180, status: 'PAID', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.queryByText(/нажмите «Отметить»/)).not.toBeInTheDocument();
    expect(screen.queryByText('к переводу')).not.toBeInTheDocument();
    expect(screen.getByText(/180 ₽ ждёт подтверждения/)).toBeInTheDocument();
  });

  it('диалог подтверждения говорит, за что долг', () => {
    h.state.credits = [
      tx({ id: 9, status: 'PAID', amount: 390, fromUser: { id: 2, firstName: 'Ян' }, menuItem: { id: 1, name: 'Борщ' } }),
    ];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    expect(within(screen.getByRole('alertdialog')).getByText(/Ян, 390 ₽ — Борщ/)).toBeInTheDocument();
  });
});

/* На длинном списке стояли две-три сплошные кнопки подряд — «правило одного
   штампа» из DESIGN.md. Сплошная — у верхней строки, где нужно действие. */
describe('BudgetPage — одна сплошная кнопка', () => {
  it('у сборщика сплошная «Подтвердить» только у первой отмеченной оплаты', () => {
    h.state.credits = [
      tx({ id: 9, status: 'PAID', amount: 500, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, status: 'PAID', amount: 300, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Подтвердить: Ян/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Подтвердить: Оля/ })).toHaveClass('btn--outline');
  });

  it('у должника ведёт верхний долг, а после начатого перевода — его строка', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const link = { paymentCard: 'https://www.tinkoff.ru/rm/abc' };
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: { id: 3, firstName: 'Оля', ...link } }),
      tx({ id: 8, amount: 300, toUser: { id: 4, firstName: 'Ян', ...link } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Перевести 420 ₽/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Перевести 300 ₽/ })).toHaveClass('btn--outline');

    fireEvent.click(screen.getByRole('button', { name: /^Перевести 300 ₽/ }));
    expect(screen.getByRole('button', { name: /^Отметить оплату: Ян/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Перевести 420 ₽/ })).toHaveClass('btn--outline');
  });

  /* Редкое действие занимало колонку кнопок шириной 167 px и выдавливало
     название долга. Теперь это строчная кнопка, как «Подробнее». */
  it('«Отменить отметку» — строчная кнопка, а не кнопка колонки', () => {
    h.state.debts = [tx({ id: 8, status: 'PAID', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Отменить отметку: Оля/ })).not.toHaveClass('btn');
  });

  it('строки — элементы списка', () => {
    h.state.credits = [
      tx({ id: 9, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
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
    expect(screen.getByText(/Перевели\? Отметьте оплату/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Отметить оплату: Оля/ })).toHaveClass('btn--primary');
  });
});

describe('BudgetPage — «Напомнить всем»', () => {
  it('пока идёт массовое напоминание, кнопки строк заблокированы', () => {
    h.state.credits = [
      tx({ id: 9, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    Object.assign(h.state.remindAll, { isPending: true });
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Напомнить: Ян/ })).toBeDisabled();
  });
});

/* Итог цикла стоял под списком отмены — последним, куда глаз доходит реже
   всего. Теперь он первым после активных долгов. */
describe('BudgetPage — концовка', () => {
  it('«Все рассчитались» выше «Подтверждено сегодня» и называет людей', () => {
    const at = new Date().toISOString();
    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', amount: 500, confirmedAt: at, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, status: 'CONFIRMED', amount: 300, confirmedAt: at, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    const done = screen.getByText('Все рассчитались');
    const undo = screen.getByText('Подтверждено сегодня');
    expect(done.compareDocumentPosition(undo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Ян и Оля · 800 ₽/)).toBeInTheDocument();
  });
});

/* Три долга одному человеку были тремя строками: три похода в банк, три
   одинаковых номера, три «Отметить». Теперь это одна карточка получателя. */
describe('BudgetPage — долги одному получателю', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentCard: 'https://www.tinkoff.ru/rm/abc', paymentPhone: '+79990001122' };
  const three = () => [
    tx({ id: 7, amount: 420, toUser: igor, menuItem: { id: 1, name: 'Паста' } }),
    tx({ id: 8, amount: 180, toUser: igor, storeRun: { id: 9, storeName: 'Пятёрочка' }, pollId: null }),
    tx({ id: 9, amount: 95.5, toUser: igor, menuItem: { id: 2, name: 'Морс' } }),
  ];

  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  it('одна карточка: один перевод на всю сумму и один номер', () => {
    h.state.debts = three();
    render(<BudgetPage />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Перевести/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Перевести 695,50 ₽: Игорь/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Скопировать СБП/ })).toHaveLength(1);
  });

  it('«Отметить все» отмечает каждый непереведённый долг получателя', () => {
    h.state.debts = [...three(), tx({ id: 10, amount: 60, status: 'PAID', toUser: igor })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Отметить все: Игорь, 695,50 ₽/ }));
    const sent = h.state.markAllPaid.mutate.mock.calls[0][0] as { id: number; label: string }[];
    expect(sent.map((x) => x.id)).toEqual([7, 8, 9]);
    // подпись долга — для сообщения, если его отметить не удастся
    expect(sent[1].label).toBe('Пятёрочка, 180 ₽');
  });

  it('каждый долг в карточке можно отметить и отдельно', () => {
    h.state.debts = three();
    render(<BudgetPage />);
    /* В имени — и за что: два долга на одну сумму звучали одинаково. */
    fireEvent.click(screen.getByRole('button', { name: /^Отметить оплату: Игорь, Пятёрочка, 180 ₽/ }));
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(8, expect.any(Object));
  });

  it('остался один непереведённый — кнопка карточки просто «Отметить»', () => {
    h.state.debts = [three()[0], tx({ id: 8, amount: 180, status: 'PAID', toUser: igor })];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Отметить оплату: Игорь, 420 ₽/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Отметить все/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Отменить отметку: Игорь, 180 ₽/ })).toBeInTheDocument();
    // счёт говорит то же, что сумма рядом
    expect(screen.getByText('1 из 2 к переводу')).toBeInTheDocument();
  });

  /* Сумма стоит над кнопкой крупно — в самой кнопке она лишь повторялась. */
  it('на кнопке перевода нет суммы, её говорит имя кнопки', () => {
    h.state.debts = three();
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Перевести/ })).toHaveTextContent(/^Перевести$/);
  });

  it('«Перевести» и «Отметить» стоят рядом, в порядке чтения', () => {
    h.state.debts = [three()[0]];
    render(<BudgetPage />);
    const transfer = screen.getByRole('button', { name: /^Перевести/ });
    const mark = screen.getByRole('button', { name: /^Отметить оплату: Игорь/ });
    expect(transfer.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(transfer.parentElement).toBe(mark.parentElement);
  });
});

describe('BudgetPage — подписи', () => {
  it('заметка называет кнопку и не спорит с «Перевести»', () => {
    h.state.debts = [tx({ id: 7, toUser: { id: 3, firstName: 'Оля', paymentCard: 'https://www.tinkoff.ru/rm/abc' } })];
    render(<BudgetPage />);
    expect(screen.getByText(/«Перевести» откроет ваш банк/)).toBeInTheDocument();
    expect(screen.getByText(/нажмите «Отметить»/)).toBeInTheDocument();
  });

  it('заметка получателя подписана его именем', () => {
    h.state.debts = [tx({ id: 7, toUser: { id: 3, firstName: 'Оля', paymentDetails: 'Только наличными' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Оля:')).toBeInTheDocument();
    expect(screen.getByText('Только наличными')).toBeInTheDocument();
  });

  it('после напоминания видно, когда можно снова', () => {
    h.state.credits = [
      tx({
        id: 11,
        fromUser: { id: 3, firstName: 'Оля' },
        reminderCount: 1,
        lastReminderAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ];
    render(<BudgetPage />);
    expect(screen.getByText(/^снова (завтра )?в \d\d:\d\d$/)).toBeInTheDocument();
  });

  /* Только телефон — ведущей становится копирование номера: без этого в
     строке не было ни одной сплошной кнопки. */
  it('при одном телефоне ведёт копирование номера', () => {
    h.state.debts = [tx({ id: 7, toUser: { id: 3, firstName: 'Оля', paymentPhone: '+79990001122' } })];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /Скопировать СБП/ })).toHaveClass('btn--primary');
  });
});

/* После одной отметки срабатывали до пяти объявлений: итог, строка ожидания,
   тост… Итог секции теперь говорит одним голосом. */
describe('BudgetPage — одно объявление итога', () => {
  it('итог «Мои долги» — одна живая строка с обеими суммами', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: { id: 3, firstName: 'Оля' } }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: { id: 4, firstName: 'Ян' } }),
    ];
    render(<BudgetPage />);
    const section = screen.getByRole('region', { name: 'Мои долги' });
    const live = within(section).getAllByRole('status').filter((el) => el.textContent);
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveTextContent('К переводу 420 ₽, ждёт подтверждения 180 ₽');
  });
});

describe('BudgetPage — «Отметить все» в пути', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentPhone: '+79990001122' };

  /* Оптимистика уже перевела все долги в «ждёт», а запросы ещё идут по одному.
     Кнопка исчезала сразу — не было видно, что отметка ещё в пути. */
  it('пока запросы идут, кнопка на месте и занята, а отмена заблокирована', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, status: 'PAID', toUser: igor }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: igor }),
    ];
    Object.assign(h.state.markAllPaid, {
      isPending: true,
      variables: [
        { id: 7, label: 'a' },
        { id: 8, label: 'b' },
      ],
    });
    render(<BudgetPage />);
    const button = screen.getByRole('button', { name: /^Отметить все: Игорь/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    // строки — как до нажатия, но их отметки закрыты, пока пачка в пути
    expect(screen.getByRole('button', { name: /^Отметить оплату: Игорь, .*420 ₽/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Отменить отметку/ })).not.toBeInTheDocument();
  });
});

describe('BudgetPage — штамп сборщика в строке', () => {
  const original = HTMLElement.prototype.animate;
  afterEach(() => {
    HTMLElement.prototype.animate = original;
  });

  /* Запрос уходил через 320 мс после нажатия: «Закрыт» печатался раньше, чем
     сервер хоть что-то узнал. Теперь запрос сразу, а строка держится на месте,
     пока играет Штамп. */
  it('после ответа сервера строка остаётся на месте со штампом', () => {
    HTMLElement.prototype.animate = vi.fn(() => ({ onfinish: null }) as unknown as Animation);
    h.state.confirmPayment.mutate = vi.fn((_id: number, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    h.state.credits = [
      tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    const { rerender } = render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Подтвердить' }));
    expect(h.state.confirmPayment.mutate).toHaveBeenCalledWith(9, expect.any(Object));

    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', confirmedAt: new Date().toISOString(), fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    rerender(<BudgetPage />);
    const owed = screen.getByRole('region', { name: 'Вам должны' });
    expect(within(owed).getByText('Ян')).toBeInTheDocument();
    expect(within(owed).getByText('Закрыт')).toBeInTheDocument();
    expect(within(owed).queryByRole('button', { name: /^Подтвердить: Ян/ })).not.toBeInTheDocument();
  });
});

describe('BudgetPage — подтверждение правдиво', () => {
  /* Пока сервер не ответил, «Закрыт» не печатается и «Все рассчитались» не
     появляется: при отказе это было бы неправдой, которую сборщик уже увидел. */
  it('до ответа — ни «Закрыт», ни «Все рассчитались»; при отказе строка как была', () => {
    let fail: (() => void) | undefined;
    h.state.confirmPayment.mutate = vi.fn((_id: number, opts?: { onError?: () => void }) => {
      fail = opts?.onError;
    });
    h.state.credits = [tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Подтвердить' }));

    expect(screen.queryByText('Закрыт')).not.toBeInTheDocument();
    expect(screen.queryByText('Все рассчитались')).not.toBeInTheDocument();
    act(() => fail?.());
    expect(screen.getByRole('button', { name: /^Подтвердить: Ян/ })).toBeInTheDocument();
    expect(screen.queryByText('Закрыт')).not.toBeInTheDocument();
  });
});

describe('BudgetPage — раскладка во время «Отметить все»', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentCard: 'https://www.tinkoff.ru/rm/abc', paymentPhone: '+79990001122' };

  /* Оптимистика переводила долги в «ждёт», и карточка перестраивалась под
     пальцем: пропадали «Перевести» и номер, кнопка прыгала влево. */
  it('пока запросы идут, карточка выглядит как до нажатия', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, status: 'PAID', toUser: igor }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: igor }),
    ];
    Object.assign(h.state.markAllPaid, {
      isPending: true,
      variables: [
        { id: 7, label: 'a' },
        { id: 8, label: 'b' },
      ],
    });
    render(<BudgetPage />);
    const transfer = screen.getByRole('button', { name: /^Перевести 600 ₽: Игорь/ });
    const mark = screen.getByRole('button', { name: /^Отметить все: Игорь/ });
    expect(transfer.parentElement).toBe(mark.parentElement);
    expect(screen.getByRole('button', { name: /Скопировать СБП/ })).toBeInTheDocument();
  });

  it('отметка в строке — кнопка, а не ссылка как «Подробнее»', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: igor }),
      tx({ id: 8, amount: 180, toUser: igor }),
    ];
    render(<BudgetPage />);
    expect(screen.getByRole('button', { name: /^Отметить оплату: Игорь, 180 ₽/ })).toHaveClass('btn');
  });
});

describe('BudgetPage — фокус после действия', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentPhone: '+79990001122' };

  /* Кнопка исчезала вместе с фокусом, и клавиатура с диктором оказывались в
     начале страницы. Теперь фокус встаёт на карточку. */
  it('после «Отметить все» фокус — на карточке получателя', async () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: igor }),
      tx({ id: 8, amount: 180, toUser: igor }),
    ];
    h.state.markAllPaid.mutate = vi.fn((_items: unknown, opts?: { onSettled?: () => void }) => opts?.onSettled?.());
    render(<BudgetPage />);
    const button = screen.getByRole('button', { name: /^Отметить все: Игорь/ });
    button.focus();
    fireEvent.click(button);
    const card = screen.getByRole('listitem');
    await waitFor(() => expect(card).toHaveFocus());
  });
});

describe('BudgetPage — одиночная отметка в пути', () => {
  const olya = { id: 3, firstName: 'Оля', paymentPhone: '+79990001122' };

  /* Отметка оптимистична: строка сразу становилась «ждёт», кнопка исчезала, и
     фокус до ответа сервера лежал в начале страницы, а спиннера не было. */
  it('пока запрос идёт, кнопка на месте, занята и держит фокус', () => {
    h.state.debts = [tx({ id: 7, amount: 420, status: 'PAID', toUser: olya })];
    Object.assign(h.state.markPaid, { isPending: true, variables: 7 });
    render(<BudgetPage />);
    const button = screen.getByRole('button', { name: /^Отметить оплату: Оля, 420 ₽/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();
  });

  it('фокус встаёт на карточку сразу, без провала в начало страницы', () => {
    h.state.debts = [tx({ id: 7, amount: 420, toUser: olya })];
    h.state.markPaid.mutate = vi.fn((_id: number, opts?: { onSettled?: () => void }) => opts?.onSettled?.());
    render(<BudgetPage />);
    const button = screen.getByRole('button', { name: /^Отметить оплату: Оля/ });
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole('listitem')).toHaveFocus();
  });
});

/* После отказа отметки вела сплошная «Перевести» — звала заплатить второй раз,
   а какой долг не отмечен, знал только исчезающий тост. */
describe('BudgetPage — неудачная отметка', () => {
  const igor = { id: 3, firstName: 'Игорь', paymentCard: 'https://www.tinkoff.ru/rm/abc', paymentPhone: '+79990001122' };

  it('частичный отказ «Отметить все»: строка подписана, ведёт отметка', () => {
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
    expect(screen.getByText('Не отмечено — отметьте ещё раз')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Перевести/ })).toHaveClass('btn--outline');
  });

  it('отказ одиночной отметки: ведёт «Отметить», а не «Перевести»', () => {
    h.state.debts = [tx({ id: 7, amount: 420, toUser: igor })];
    h.state.markPaid.mutate = vi.fn((_id: number, opts?: { onError?: () => void }) => opts?.onError?.());
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Отметить оплату: Игорь/ }));
    expect(screen.getByRole('button', { name: /^Отметить оплату: Игорь/ })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: /^Перевести/ })).toHaveClass('btn--outline');
    expect(screen.getByText('Не отмечено — отметьте ещё раз')).toBeInTheDocument();
  });
});

describe('BudgetPage — мелочи', () => {
  it('только что отмеченный долг — «только что», а не «уже меньше минуты»', () => {
    h.state.debts = [
      tx({ id: 8, status: 'PAID', paidAt: new Date().toISOString(), toUser: { id: 3, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    expect(screen.getByText('только что')).toBeInTheDocument();
    expect(screen.queryByText(/меньше минуты/)).not.toBeInTheDocument();
  });

  /* Зелёной была вся строка «390 ₽ из 2 050 ₽» — и та часть, что ещё не пришла. */
  it('в «получено X из Y» денежный цвет только у полученного', () => {
    h.state.credits = [
      tx({ id: 9, status: 'CONFIRMED', amount: 390, fromUser: { id: 2, firstName: 'Ян' } }),
      tx({ id: 10, amount: 300, fromUser: { id: 4, firstName: 'Оля' } }),
    ];
    render(<BudgetPage />);
    const received = screen.getByText('390 ₽', { selector: 'span' });
    expect(received.closest('[role="status"]')).toHaveTextContent('390 ₽ из 690 ₽');
    expect(received.parentElement?.textContent).toBe('390 ₽ из 690 ₽');
  });
});
