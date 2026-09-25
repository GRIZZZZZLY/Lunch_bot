import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  for (const m of [h.state.markPaid, h.state.cancelMark, h.state.confirmPayment, h.state.sendReminder, h.state.remindAll, h.state.undoConfirmation]) {
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
    expect(h.state.markPaid.mutate).toHaveBeenCalledWith(7);
  });

  it('PAID → «Отменить отметку» зовёт cancelMark(id), статус «Ждёт»', () => {
    h.state.debts = [tx({ id: 7, status: 'PAID', toUser: { id: 3, firstName: 'Оля' } })];
    render(<BudgetPage />);
    expect(screen.getByText('Ждёт')).toBeInTheDocument();
    // статус говорит только чип — текстового дубля в строке быть не должно
    expect(screen.queryByText(/^уже /)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Отменить отметку: Оля/ }));
    expect(h.state.cancelMark.mutate).toHaveBeenCalledWith(7);
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
    expect(cancel).toBeDisabled();
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
    expect(h.state.confirmPayment.mutate).toHaveBeenCalledWith(9);
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
    expect(screen.queryByText(/Переведите деньги сами/)).not.toBeInTheDocument();
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
