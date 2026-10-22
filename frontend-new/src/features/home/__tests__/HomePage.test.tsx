import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => {
  /* isSuccess обязателен: барьер первого экрана спрашивает у запросов «ответ
     получен?» именно так, а не по наличию data. Мок без этого поля выглядит для
     страницы как вечно ждущий запрос, и она честно остаётся под скелетом. */
  const q = (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    ...extra,
  });
  const m = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    q,
    m,
    state: {
      deepLinkId: null as number | null,
      deepLinkPoll: null as unknown,
      deepLinkError: null as unknown,
      markLinkHandled: vi.fn(),
      /* Настоящий lib/launchLink: ссылка из адреса, отметка «обработана». */
      realLaunchLink: false,
      /* Настоящий запрос «последнего завершённого» поверх мока сервиса. */
      realLastCompleted: false,
      serverLastCompleted: null as unknown,
      /* Один незаехавший запрос: барьер первого экрана обязан держать весь
         экран, а не только ту секцию, которая ждёт. */
      runsPending: false,
      activePoll: null as unknown,
      activeError: null as unknown,
      debts: [] as unknown[],
      credits: [] as unknown[],
      runs: [] as unknown[],
      lastCompleted: null as unknown,
      lastResult: null as unknown,
      schedule: null as unknown,
      markPaid: { mutate: vi.fn(), isPending: false },
      groups: [] as unknown[],
      createPoll: m(),
      toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        clear: vi.fn(),
      },
    },
  };
});

/* Ссылка запуска читается из Telegram/URL; в тестах подменяем её целиком. */
vi.mock('@/lib/launchLink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/launchLink')>();
  return {
    getLaunchPollId: () => (h.state.realLaunchLink ? actual.getLaunchPollId() : h.state.deepLinkId),
    markLaunchLinkHandled: () => {
      h.state.markLinkHandled();
      if (h.state.realLaunchLink) actual.markLaunchLinkHandled();
    },
  };
});

vi.mock('@/services/polls.service', () => ({
  pollsService: { getLastCompleted: async () => ({ data: h.state.serverLastCompleted }) },
}));

vi.mock('@/hooks/usePolls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePolls')>();
  const fake = { useLastCompletedPoll: () => h.q(h.state.lastCompleted) };
  return {
  useActivePoll: () => h.q(h.state.activePoll, { error: h.state.activeError, isError: !!h.state.activeError }),
  usePollById: (id: number | null) =>
    h.q(id ? h.state.deepLinkPoll : null, {
      error: id ? h.state.deepLinkError : null,
      isError: !!(id && h.state.deepLinkError),
      isSuccess: !(id && h.state.deepLinkError),
    }),
  useMyVotes: () => h.q(null),
  useLastCompletedPoll: () => (h.state.realLastCompleted ? actual : fake).useLastCompletedPoll(),
  // Отключённый запрос (id === null) данных не отдаёт — как в react-query.
  usePollResults: (id: number | null) => h.q(id ? h.state.lastResult : null),
  useVote: h.m,
  useWithdrawVote: h.m,
  useCompletePoll: h.m,
  useCancelPoll: h.m,
  useCreatePoll: () => h.state.createPoll,
  };
});
vi.mock('@/hooks/useToast', () => ({ useToast: () => h.state.toast }));
/* Шторка создания в этих тестах не при чём — стаб дёргает onSubmit готовой
   формой, чтобы проверить обработчик, а не UI формы. */
vi.mock('@/components/admin/CreatePollSheet', () => ({
  CreatePollSheet: ({ open, onSubmit }: { open: boolean; onSubmit: (f: unknown) => void }) => (
    <button
      data-open={String(open)}
      onClick={() =>
        onSubmit({
          title: '',
          duration: '30m',
          recurring: false,
          recurringDays: [],
          recurringTime: '11:00',
          selectedItems: ['1', '2'],
          groupId: '1',
        })
      }
    >
      submit-poll-form
    </button>
  ),
}));
vi.mock('@/hooks/useRecurringPoll', () => ({
  useCreateRecurringPoll: h.m,
  useUpdateRecurringPoll: h.m,
  useDeleteRecurringPoll: h.m,
  useRecurringSchedule: () => h.q(h.state.schedule),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, firstName: 'Игорь', isAdmin: false }, isLoading: false }),
}));
vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => h.q(h.state.groups) }));
vi.mock('@/hooks/useMenu', () => ({ useMenuItems: () => h.q([]) }));
vi.mock('@/hooks/useBudget', () => ({
  useDebts: () => h.q(h.state.debts),
  useCredits: () => h.q(h.state.credits),
  useMarkPaid: () => h.state.markPaid,
}));
vi.mock('@/hooks/useSSE', () => ({ useSSE: () => undefined }));
vi.mock('@/hooks/useStoreRun', () => ({
  useActiveStoreRuns: () =>
    h.q(h.state.runs, h.state.runsPending ? { isSuccess: false, isLoading: true } : {}),
  useCreateStoreRun: h.m,
}));

import { HomePage } from '../HomePage';
import { useAppStore } from '@/store/useAppStore';

function renderHome(entry: string | { pathname: string; state: unknown } = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.state.deepLinkId = null;
  h.state.deepLinkPoll = null;
  h.state.deepLinkError = null;
  h.state.markLinkHandled = vi.fn();
  h.state.realLaunchLink = false;
  h.state.realLastCompleted = false;
  h.state.serverLastCompleted = null;
  useAppStore.setState({ currentGroupId: null, authStatus: 'idle' });
  h.state.runsPending = false;
  h.state.activePoll = null;
  h.state.activeError = null;
  h.state.debts = [];
  h.state.credits = [];
  h.state.runs = [];
  h.state.lastCompleted = null;
  h.state.lastResult = null;
  h.state.schedule = null;
  h.state.markPaid = { mutate: vi.fn(), isPending: false };
  h.state.groups = [];
  h.state.createPoll = h.m();
  h.state.toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
  };
  delete window.Telegram;
});

describe('HomePage — состояния', () => {
  it('сбой опроса не уносит с экрана деньги и закупки — их запросы живы', () => {
    h.state.activeError = { code: 'NETWORK_ERROR' };
    h.state.debts = [{ id: 7, amount: 260, status: 'PENDING' }];
    h.state.runs = [
      { id: 5, storeName: 'Пятёрочка у офиса', status: 'SHOPPING', items: [{}], initiator: { firstName: 'Игорь' } },
    ];
    renderHome();
    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByText('Расчёты')).toBeInTheDocument();
    expect(screen.getByText('Пятёрочка у офиса')).toBeInTheDocument();
  });

  it('блюда удалили из меню — талон объясняет пустоту вместо голой radiogroup', () => {
    h.state.activePoll = {
      id: 11,
      status: 'ACTIVE',
      duration: 30,
      createdAt: new Date().toISOString(),
      menuItems: [],
    };
    renderHome();
    expect(screen.getByText(/больше нет в меню/)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  /* «Отметить · 260 ₽» на главной отмечал долг одним касанием, а реквизитов
     на экране не было: человек отмечал, не переведя денег. Отметка живёт в
     «Расчётах», рядом с тем, куда переводить. */
  it('долг → строка «Расчёты» ведёт на экран расчётов, отметки на главной нет', async () => {
    h.state.debts = [{ id: 7, amount: 260, status: 'PENDING' }];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/budget" element={<p>budget-page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('button', { name: /Отметить/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Расчёты/ }));
    expect(screen.getByText('budget-page')).toBeInTheDocument();
  });
});

describe('HomePage — итог прошедшего голосования', () => {
  const result = { winnerId: 3, winnerName: 'Борщ', totalVotes: 4, responsible: { name: 'Игорь' } };

  it('победитель за текущие сутки показан', () => {
    h.state.lastCompleted = {
      id: 21,
      status: 'COMPLETED',
      duration: 30,
      createdAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      menuItems: [],
    };
    h.state.lastResult = result;
    renderHome();
    expect(screen.getByText('Победил: Борщ')).toBeInTheDocument();
  });

  it('опрос, начатый вчера и закрытый сегодня, показывается', () => {
    h.state.lastCompleted = {
      id: 23,
      status: 'COMPLETED',
      duration: 30,
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      menuItems: [],
    };
    h.state.lastResult = result;
    renderHome();
    expect(screen.getByText('Победил: Борщ')).toBeInTheDocument();
  });

  it('победитель прошлых суток не показывается', () => {
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    h.state.lastCompleted = {
      id: 20,
      status: 'COMPLETED',
      duration: 30,
      createdAt: yesterday,
      endedAt: yesterday,
      menuItems: [],
    };
    h.state.lastResult = result;
    renderHome();
    expect(screen.queryByText(/Победил:/)).not.toBeInTheDocument();
  });
});

describe('HomePage — ошибка создания опроса', () => {
  it('реджект API-объектом показывает причину, а не общий fallback', async () => {
    h.state.groups = [{ id: 1, title: 'Офис', isActive: true, role: 'ADMIN' }];
    h.state.createPoll = {
      mutate: vi.fn(),
      isPending: false,
      /* Перехватчик api.service реджектит именно голым объектом, не Error. */
      mutateAsync: vi
        .fn()
        .mockRejectedValue({ code: 'POLL_ALREADY_ACTIVE', error: 'Group already has an active poll', status: 400 }),
    };
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'submit-poll-form' }));
    expect(h.state.toast.error).toHaveBeenCalledWith('В этой группе уже идёт голосование.');
  });
});

describe('HomePage — расписание автоголосования', () => {
  const running = () => ({ id: 10, status: 'ACTIVE', duration: 30, createdAt: new Date().toISOString(), menuItems: [] });

  /* Одна таблица: положительная строка держит тот же поиск, что и
     отрицательные, — переименование подписи не пройдёт молча. */
  it.each([
    ['включено, опроса нет', true, null, true],
    ['выключено', false, null, false],
    ['включено, но идёт опрос', true, running, false],
  ] as const)('%s → подпись автозапуска видна: %s', (_, isEnabled, poll, visible) => {
    h.state.schedule = { isEnabled, daysOfWeek: [1, 2, 3, 4, 5], timeOfDay: '11:30' };
    h.state.activePoll = poll ? poll() : null;
    renderHome();
    expect(screen.queryByText(/Автозапуск/) !== null).toBe(visible);
  });
});

/**
 * Барьер первого экрана и приоритет deep link — два правила, которые задача 12
 * велит закрепить ДО извлечения хуков: барьер невидим в обычном тесте (он
 * проверяется отсутствием контента), а приоритет deep link — неочевидная
 * строка, которую легко потерять при переносе.
 */
describe('HomePage — барьер первого экрана', () => {
  /* Один незаехавший запрос держит ВЕСЬ экран: человек видит не запросы, а как
     экран собирается толчками, и частичная сборка — это и есть та жалоба, из-за
     которой барьер появился. */
  it('пока хотя бы один запрос не ответил, контента нет', () => {
    h.state.runsPending = true;
    h.state.debts = [{ id: 7, amount: 260, status: 'PENDING' }];

    renderHome();

    expect(screen.queryByText('Группы пока нет')).not.toBeInTheDocument();
    expect(screen.queryByText('Расчёты')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Отметить/ })).not.toBeInTheDocument();
  });

  it('когда все запросы ответили, экран открывается целиком', () => {
    h.state.debts = [{ id: 7, amount: 260, status: 'PENDING' }];

    renderHome();

    expect(screen.getByText('Группы пока нет')).toBeInTheDocument();
    expect(screen.getByText('Расчёты')).toBeInTheDocument();
  });

  /* Ошибка — это ответ. Экран, ждущий упавший запрос, не открылся бы никогда. */
  it('упавший запрос считается ответившим', () => {
    h.state.activeError = { code: 'NETWORK_ERROR' };

    renderHome();

    expect(screen.getByText('Не удалось загрузить')).toBeInTheDocument();
  });
});

describe('HomePage — приоритет deep link', () => {
  const activePoll = {
    id: 10,
    status: 'ACTIVE',
    duration: 30,
    createdAt: new Date().toISOString(),
    menuItems: [{ menuItemId: 1, menuItem: { id: 1, name: 'Плов' }, _count: { votes: 1 } }],
  };

  /* Правило `deepLinkPollId ? deepLinkPoll ?? null : fallbackActivePoll`:
     пришедший по ссылке опрос ВЫТЕСНЯЕТ активный, иначе человек, открывший
     ссылку на конкретное голосование, попадал бы в другое. */
  it('опрос из ссылки вытесняет активный', () => {
    h.state.activePoll = activePoll;
    h.state.deepLinkId = 77;
    h.state.deepLinkPoll = {
      ...activePoll,
      id: 77,
      menuItems: [{ menuItemId: 2, menuItem: { id: 2, name: 'Борщ' }, _count: { votes: 3 } }],
    };

    renderHome();

    expect(screen.getByRole('radio', { name: /Борщ/ })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Плов/ })).not.toBeInTheDocument();
  });

  /* `?? null`, а не `?? fallbackActivePoll`: ссылка на удалённый или чужой опрос
     не должна молча подменяться активным — иначе голос уйдёт не туда. */
  it('пустой ответ по ссылке не подменяется активным опросом', () => {
    h.state.activePoll = activePoll;
    h.state.deepLinkId = 77;
    h.state.deepLinkPoll = null;

    renderHome();

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText('Группы пока нет')).toBeInTheDocument();
  });

  it('без ссылки показывается активный опрос', () => {
    h.state.activePoll = activePoll;

    renderHome();

    expect(screen.getByRole('radio', { name: /Плов/ })).toBeInTheDocument();
  });
});

/**
 * Ссылка на конкретный опрос открывает его В КОНТЕКСТЕ ЕГО КОМАНДЫ и действует
 * один раз за запуск.
 */
describe('HomePage — ссылка на опрос', () => {
  const linkedPoll = {
    id: 77,
    groupId: '5',
    status: 'ACTIVE',
    duration: 30,
    createdAt: new Date().toISOString(),
    menuItems: [{ menuItemId: 2, menuItem: { id: 2, name: 'Борщ' }, _count: { votes: 3 } }],
  };

  beforeEach(() => {
    useAppStore.setState({ currentGroupId: '1' });
  });

  function renderWithResults() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/poll/:id/results" element={<p>results-page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('опрос чужой команды переключает текущую команду на неё', () => {
    h.state.deepLinkId = 77;
    h.state.deepLinkPoll = linkedPoll;

    renderHome();

    expect(useAppStore.getState().currentGroupId).toBe('5');
  });

  /* Раньше ошибка этого запроса терялась: экран показывал «Сегодня ещё не
     решали», как будто ссылки не было. Итоги умеют объяснить «нет доступа» и
     «не найден» — туда и уводим. */
  it('недоступный опрос уводит на итоги, где видна причина', () => {
    h.state.deepLinkId = 77;
    h.state.deepLinkError = { status: 403, code: 'FORBIDDEN' };

    renderWithResults();

    expect(screen.getByText('results-page')).toBeInTheDocument();
    expect(h.state.markLinkHandled).toHaveBeenCalled();
  });

  it('после ухода с главной ссылка больше не применяется', () => {
    h.state.realLaunchLink = true;
    h.state.deepLinkPoll = linkedPoll;
    window.history.replaceState(null, '', '/?pollId=77');
    try {
      const first = renderHome();
      expect(useAppStore.getState().currentGroupId).toBe('5');
      expect(screen.getByRole('radio', { name: /Борщ/ })).toBeInTheDocument();
      first.unmount();

      useAppStore.setState({ currentGroupId: '1' });
      renderHome();
      expect(useAppStore.getState().currentGroupId).toBe('1');
      expect(screen.queryByRole('radio', { name: /Борщ/ })).not.toBeInTheDocument();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});

/* Кнопка «Создать голосование» в чате группы открывает приложение сразу со
   шторкой создания (`useLaunchLinkRoute` кладёт действие в состояние
   навигации). */
describe('HomePage — действие из ссылки', () => {
  const createFromLink = { pathname: '/', state: { launchAction: 'createPoll' } };

  it('администратору открывает шторку создания', () => {
    h.state.groups = [{ id: 1, title: 'Офис', isActive: true, role: 'ADMIN' }];

    renderHome(createFromLink);

    expect(screen.getByRole('button', { name: 'submit-poll-form' })).toHaveAttribute(
      'data-open',
      'true',
    );
  });

  it('участнику объясняет, почему шторки нет', () => {
    h.state.groups = [{ id: 1, title: 'Офис', isActive: true, role: 'MEMBER' }];

    renderHome(createFromLink);

    expect(screen.getByRole('button', { name: 'submit-poll-form' })).toHaveAttribute(
      'data-open',
      'false',
    );
    expect(h.state.toast.error).toHaveBeenCalled();
  });
});

/* Опрос закончился, пока главная открыта: сам по последнему голосу, по
   таймеру или руками другого администратора. Мутации «завершить/отменить»
   перечитывают «последний завершённый» только у нажавшего — у остальных
   строка победителя показывала прошлый опрос («Победил: …, голосов не было»). */
describe('HomePage — опрос закончился на глазах', () => {
  it('строка победителя показывает только что закрытый опрос', async () => {
    useAppStore.setState({ authStatus: 'authenticated', currentGroupId: '1' });
    h.state.realLastCompleted = true;
    const poll = {
      id: 10,
      status: 'ACTIVE',
      duration: 30,
      createdAt: new Date().toISOString(),
      menuItems: [{ menuItemId: 1, menuItem: { id: 1, name: 'Плов' }, _count: { votes: 1 } }],
    };
    h.state.activePoll = poll;
    h.state.lastResult = { winnerId: 1, winnerName: 'Плов', totalVotes: 1 };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = () => (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const view = render(tree());
    expect(await screen.findByRole('radio', { name: /Плов/ })).toBeInTheDocument();
    expect(screen.queryByText(/Победил/)).not.toBeInTheDocument();

    // опрос закрыли где-то ещё: сервер уже знает новый итог, активного нет
    const now = new Date().toISOString();
    h.state.serverLastCompleted = { ...poll, status: 'COMPLETED', endedAt: now };
    h.state.activePoll = null;
    view.rerender(tree());

    expect(await screen.findByText(/Победил: Плов/)).toBeInTheDocument();
  });
});
