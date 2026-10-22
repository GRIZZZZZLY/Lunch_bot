import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ActivityByTeam } from '@/lib/teamActivity';
import { pollsService } from '@/services/polls.service';
import { storeRunService } from '@/services/store-run.service';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  groups: [] as unknown[],
  activity: null as ActivityByTeam | null,
  /* Настоящий useTeamActivity: видно, уходят ли запросы статусов в сеть. */
  realActivity: false,
}));

vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => ({ data: h.groups }) }));
vi.mock('@/hooks/useTeamActivity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTeamActivity')>();
  const fake = { useTeamActivity: () => h.activity };
  return {
    useTeamActivity: (enabled: boolean) => (h.realActivity ? actual : fake).useTeamActivity(enabled),
  };
});

import { TeamSlot } from '../TeamSlot';

const group = (id: number, title: string) => ({
  id,
  title,
  telegramId: String(-id),
  type: 'group',
  isActive: true,
  role: 'MEMBER',
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <TeamSlot />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const endsAt = new Date(Date.now() + 10 * 60_000).toISOString();

beforeEach(() => {
  h.groups = [group(10, 'Офис')];
  h.activity = { '10': { pollEndsAt: endsAt } };
  h.realActivity = false;
  useAppStore.setState({ currentGroupId: '10' });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState({ authStatus: 'idle' });
});

describe('TeamSlot — одна команда', () => {
  it('на Главной плашки нет', () => {
    renderAt('/');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('вне Главной голосование ведёт на Главную', async () => {
    renderAt('/menu');
    await userEvent.click(screen.getByRole('button', { name: /^Голосуем · / }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);
  });

  it('вне Главной закупка ведёт на экран закупки', async () => {
    h.activity = { '10': { run: { id: 601, status: 'COLLECTING' } } };
    renderAt('/stats');
    await userEvent.click(screen.getByRole('button', { name: 'Закупка · сбор' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/store-run/601');
  });

  it('статусы не пришли — плашки нет', () => {
    h.activity = null;
    renderAt('/profile');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('TeamSlot — запросы статусов', () => {
  /* Без команд спрашивать не о ком: запросы раз в 30 секунд вернули бы пустоту. */
  it.each([
    ['без команд — не запрашиваются', [], false],
    ['одна команда вне Главной — запрашиваются', [group(10, 'Офис')], true],
  ])('%s', async (_, groups, asked) => {
    h.groups = groups;
    h.realActivity = true;
    useAppStore.setState({ authStatus: 'authenticated' });
    const polls = vi.spyOn(pollsService, 'getActiveAllTeams').mockResolvedValue({ data: [] } as never);
    const runs = vi.spyOn(storeRunService, 'getActiveAllTeams').mockResolvedValue({ data: [] } as never);

    renderAt('/menu');
    await act(async () => {});

    expect(polls.mock.calls.length > 0).toBe(asked);
    expect(runs.mock.calls.length > 0).toBe(asked);
  });
});

describe('TeamSlot — две команды', () => {
  beforeEach(() => {
    h.groups = [group(10, 'Офис'), group(20, 'Розница')];
  });

  it('на Главной голосование текущей команды точкой не считается', () => {
    renderAt('/');
    const trigger = screen.getByRole('button', { name: 'Команда: Офис. Сменить' });
    expect(trigger).not.toHaveAccessibleDescription();
  });

  it('вне Главной точка считает и текущую', () => {
    h.activity = { '10': { pollEndsAt: endsAt }, '20': { run: { id: 602, status: 'SHOPPING' } } };
    renderAt('/menu');
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toHaveAccessibleDescription(
      'Что-то идёт в командах: 2',
    );
  });
});
