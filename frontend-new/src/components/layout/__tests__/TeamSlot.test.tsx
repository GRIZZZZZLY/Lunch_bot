import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ActivityByTeam } from '@/lib/teamActivity';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  groups: [] as unknown[],
  activity: null as ActivityByTeam | null,
}));

vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => ({ data: h.groups }) }));
vi.mock('@/hooks/useTeamActivity', () => ({ useTeamActivity: () => h.activity }));

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
  return render(
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
    </MemoryRouter>,
  );
}

const endsAt = new Date(Date.now() + 10 * 60_000).toISOString();

beforeEach(() => {
  h.groups = [group(10, 'Офис')];
  h.activity = { '10': { pollEndsAt: endsAt } };
  useAppStore.setState({ currentGroupId: '10' });
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

describe('TeamSlot — две команды', () => {
  beforeEach(() => {
    h.groups = [group(10, 'Офис'), group(20, 'Розница')];
  });

  it('на Главной голосование текущей команды точкой не считается', () => {
    renderAt('/');
    const trigger = screen.getByRole('button', { name: 'Команда: Офис. Сменить' });
    expect(trigger).not.toHaveAccessibleDescription();
  });

  it('на Главной точка говорит о других командах', () => {
    h.activity = { '20': { pollEndsAt: endsAt } };
    renderAt('/');
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toHaveAccessibleDescription(
      'Что-то идёт в командах: 1',
    );
  });

  it('вне Главной точка считает и текущую', () => {
    h.activity = { '10': { pollEndsAt: endsAt }, '20': { run: { id: 602, status: 'SHOPPING' } } };
    renderAt('/menu');
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toHaveAccessibleDescription(
      'Что-то идёт в командах: 2',
    );
  });
});
