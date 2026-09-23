import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import type { LaunchLink } from '@/lib/launchLink';
import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({
  link: null as LaunchLink | null,
  mark: vi.fn(),
  groups: [] as unknown[],
  groupsLoaded: true,
  toast: { error: vi.fn() },
}));

vi.mock('@/lib/launchLink', () => ({
  getLaunchLink: () => h.link,
  markLaunchLinkHandled: () => h.mark(),
}));
vi.mock('@/hooks/useUser', () => ({
  useMyGroups: () => ({ data: h.groups, isSuccess: h.groupsLoaded }),
}));
vi.mock('@/hooks/useToast', () => ({ useToast: () => h.toast }));

import { useLaunchLinkRoute } from '../useLaunchLinkRoute';

function Probe() {
  useLaunchLinkRoute();
  return null;
}

function Where() {
  const location = useLocation();
  const action = (location.state as { launchAction?: string } | null)?.launchAction ?? '';
  return <p>{`${location.pathname}|${action}`}</p>;
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Probe />
      <Where />
    </MemoryRouter>,
  );
}

const office = { id: 5, title: 'Офис', telegramId: '-1005', type: 'group', isActive: true, role: 'MEMBER' };

beforeEach(() => {
  h.link = null;
  h.mark = vi.fn();
  h.groups = [office];
  h.groupsLoaded = true;
  h.toast = { error: vi.fn() };
  useAppStore.setState({ currentGroupId: '1' });
});

describe('useLaunchLinkRoute', () => {
  it('ссылка на закупку открывает закупку', () => {
    h.link = { kind: 'storeRun', id: 8 };
    renderApp();
    expect(screen.getByText('/store-run/8|')).toBeInTheDocument();
    expect(h.mark).toHaveBeenCalled();
  });

  it('ссылка на меню группы делает её текущей и открывает меню', () => {
    h.link = { kind: 'group', chatId: '-1005', action: 'menu' };
    renderApp();
    expect(screen.getByText('/menu|')).toBeInTheDocument();
    expect(useAppStore.getState().currentGroupId).toBe('5');
  });

  it('«Добавить блюдо» открывает меню с формой', () => {
    h.link = { kind: 'group', chatId: '-1005', action: 'addDish' };
    renderApp();
    expect(screen.getByText('/menu|addDish')).toBeInTheDocument();
  });

  it('«Создать голосование» открывает главную со шторкой', () => {
    h.link = { kind: 'group', chatId: '-1005', action: 'createPoll' };
    renderApp();
    expect(screen.getByText('/|createPoll')).toBeInTheDocument();
    expect(useAppStore.getState().currentGroupId).toBe('5');
  });

  /* Подставлять чужую команду наугад нельзя: человек увидел бы меню не той
     группы и принял бы его за нужное. */
  it('незнакомая группа не подменяется текущей, человеку сказано почему', () => {
    h.link = { kind: 'group', chatId: '-999', action: 'menu' };
    renderApp();
    expect(screen.getByText('/|')).toBeInTheDocument();
    expect(useAppStore.getState().currentGroupId).toBe('1');
    expect(h.toast.error).toHaveBeenCalled();
    expect(h.mark).toHaveBeenCalled();
  });

  it('ссылку на опрос оставляет главной', () => {
    h.link = { kind: 'poll', id: 34 };
    renderApp();
    expect(screen.getByText('/|')).toBeInTheDocument();
    expect(h.mark).not.toHaveBeenCalled();
  });

  it('ждёт список групп, прежде чем разбирать ссылку на группу', () => {
    h.link = { kind: 'group', chatId: '-1005', action: 'menu' };
    h.groupsLoaded = false;
    renderApp();
    expect(screen.getByText('/|')).toBeInTheDocument();
    expect(h.mark).not.toHaveBeenCalled();
    expect(h.toast.error).not.toHaveBeenCalled();
  });
});
