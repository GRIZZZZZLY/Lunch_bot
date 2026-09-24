import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useAppStore } from '@/store/useAppStore';

const h = vi.hoisted(() => ({ groups: [] as unknown[] }));

vi.mock('@/hooks/useUser', () => ({ useMyGroups: () => ({ data: h.groups }) }));

import { TeamSwitcher } from '../TeamSwitcher';

const group = (id: number, title: string, isActive = true) => ({
  id,
  title,
  telegramId: String(-id),
  type: 'group',
  isActive,
  role: 'MEMBER',
});

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderSwitcher(props: Parameters<typeof TeamSwitcher>[0] = { activity: null, busyCount: 0 }) {
  return render(
    <MemoryRouter initialEntries={['/stats']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <TeamSwitcher {...props} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.groups = [group(10, 'Офис'), group(20, 'Розница')];
  useAppStore.setState({ currentGroupId: '10' });
});

/**
 * Текущая команда видна на командных экранах и меняется в одно касание.
 * Раньше сменить её можно было только из меню, а главная, статистика и
 * профиль молча показывали выбранную там команду.
 */
describe('TeamSwitcher', () => {
  it('показывает текущую команду', () => {
    renderSwitcher();
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toBeInTheDocument();
  });

  it('меняет команду из списка своих активных групп и открывает Главную', async () => {
    h.groups = [...h.groups, group(30, 'Архив', false)];
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Команда: Офис. Сменить' }));
    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['Офис', 'Розница']);
    expect(screen.getByRole('radio', { name: 'Офис' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: 'Розница' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/);

    expect(useAppStore.getState().currentGroupId).toBe('20');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Команда: Розница. Сменить' })).toBeInTheDocument();
  });

  it('в шторке у каждой команды строка статуса', async () => {
    renderSwitcher({ activity: { '20': { run: { id: 602, status: 'SHOPPING' } } }, busyCount: 1 });
    await userEvent.click(screen.getByRole('button', { name: 'Команда: Офис. Сменить' }));

    expect(screen.getByRole('dialog', { name: 'Команды' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Розница' })).toHaveAccessibleDescription('Закупка · в магазине');
    expect(screen.getByRole('radio', { name: 'Офис' })).toHaveAccessibleDescription('Тихо');
  });

  /* С одной командой выбирать не из чего, а в шапке и так мало места. */
  it('с одной командой не показывается', () => {
    h.groups = [group(10, 'Офис'), group(30, 'Архив', false)];
    renderSwitcher();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
