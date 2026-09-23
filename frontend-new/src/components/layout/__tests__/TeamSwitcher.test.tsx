import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    render(<TeamSwitcher />);
    expect(screen.getByRole('button', { name: 'Команда: Офис. Сменить' })).toBeInTheDocument();
  });

  it('меняет команду из списка своих активных групп', async () => {
    h.groups = [...h.groups, group(30, 'Архив', false)];
    render(<TeamSwitcher />);

    await userEvent.click(screen.getByRole('button', { name: 'Команда: Офис. Сменить' }));
    const options = screen.getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual(['Офис', 'Розница']);
    expect(screen.getByRole('radio', { name: 'Офис' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: 'Розница' }));

    expect(useAppStore.getState().currentGroupId).toBe('20');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Команда: Розница. Сменить' })).toBeInTheDocument();
  });

  /* С одной командой выбирать не из чего, а в шапке и так мало места. */
  it('с одной командой не показывается', () => {
    h.groups = [group(10, 'Офис'), group(30, 'Архив', false)];
    const { container } = render(<TeamSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
