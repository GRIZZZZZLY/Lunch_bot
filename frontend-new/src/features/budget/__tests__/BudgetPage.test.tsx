import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  /* Скопированный номер — тоже начало перевода: дальше человек уходит в банк. */
  it.each([
    ['ссылка СБП', withLink, /^Перевести 420 ₽/],
    ['только телефон', () => tx({ id: 7, toUser: { id: 3, firstName: 'Оля', paymentPhone: '+79990001122' } }), /Скопировать СБП/],
  ])('%s: после начала перевода строка спрашивает «Перевели?»', (_, debt, start) => {
    h.state.debts = [debt()];
    render(<BudgetPage />);
    expect(screen.queryByText(/Перевели\?/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: start }));

    expect(screen.getByText(/Перевели\?/)).toBeInTheDocument();
  });
});

/* Колонка одинаковых сплошных «Напомнить» прятала «Подтвердить» — единственное
   действие, где нужно решение сборщика. Напоминание — контурная кнопка: явно
   активная, но не сплошная. */
describe('BudgetPage — напоминания', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Напомнить всем/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Напомнить всем' }));
    expect(h.state.remindAll.mutate).toHaveBeenCalledWith([9, 10]);
  });
});

/* Блок «куда переводить» раньше просто пропадал: должник видел долг и не
   понимал, куда платить, а получатель — почему ему не платят. */
describe('BudgetPage — нет реквизитов', () => {
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
});

describe('BudgetPage — сборщик', () => {
  it('отмена диалога не подтверждает оплату', () => {
    h.state.credits = [tx({ id: 9, status: 'PAID', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Подтвердить: Ян/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Отмена' }));
    expect(h.state.confirmPayment.mutate).not.toHaveBeenCalled();
  });

  it('один должник — массовой кнопки нет', () => {
    h.state.credits = [tx({ id: 9, status: 'PENDING', fromUser: { id: 2, firstName: 'Ян' } })];
    render(<BudgetPage />);
    expect(screen.queryByRole('button', { name: /Напомнить всем/ })).not.toBeInTheDocument();
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
    const sent = h.state.markAllPaid.mutate.mock.calls[0][0] as { id: number }[];
    expect(sent.map((x) => x.id)).toEqual([7, 8, 9]);
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
  });
});

/* После одной отметки срабатывали до пяти объявлений: итог, строка ожидания,
   тост… Итог секции теперь говорит одним голосом. */
describe('BudgetPage — одно объявление итога', () => {
  /* Суммы не складываются: отмеченное (180) уже не «к переводу». */
  it('итог «Мои долги» — одна живая строка с обеими суммами', () => {
    h.state.debts = [
      tx({ id: 7, amount: 420, toUser: { id: 3, firstName: 'Оля' } }),
      tx({ id: 8, amount: 180, status: 'PAID', toUser: { id: 4, firstName: 'Ян' } }),
    ];
    render(<BudgetPage />);
    const section = screen.getByRole('region', { name: 'Мои долги' });
    const live = within(section).getAllByRole('status').filter((el) => el.textContent);
    expect(live).toHaveLength(1);
    expect(live[0].textContent).toMatch(/420.*180/);
    expect(live[0].textContent).not.toMatch(/600/);
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

  it('отказ одиночной отметки виден у строки, и отметить можно снова', () => {
    h.state.debts = [tx({ id: 7, amount: 420, toUser: igor })];
    h.state.markPaid.mutate = vi.fn((_id: number, opts?: { onError?: () => void }) => opts?.onError?.());
    render(<BudgetPage />);
    expect(screen.queryByText(/Не отмечено/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Отметить оплату: Игорь/ }));
    expect(screen.getByText(/Не отмечено/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Отметить оплату: Игорь/ })).toBeEnabled();
  });
});
