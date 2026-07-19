import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuForm } from '../../src/components/menu/MenuForm';

const { showAlert, impact } = vi.hoisted(() => ({
  showAlert: vi.fn(),
  impact: vi.fn(),
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      div: ({
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        ...props
      }: any) => ReactModule.createElement('div', props, children),
    },
  };
});

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    showAlert,
  }),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impact,
  }),
}));

describe('MenuForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits a new menu item with selected group ids', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <MenuForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        adminGroups={[
          { id: 1, title: 'First group' },
          { id: 2, title: 'Second group' },
        ]}
        defaultGroupId={1}
      />
    );

    fireEvent.change(screen.getByLabelText(/Название блюда/i), {
      target: { value: 'Borscht' },
    });
    fireEvent.change(screen.getByLabelText(/Описание/i), {
      target: { value: 'Soup' },
    });
    fireEvent.change(screen.getByLabelText(/Цена/i), {
      target: { value: '320' },
    });

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);

    fireEvent.click(screen.getByRole('button', { name: /Добавить/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Borscht',
      description: 'Soup',
      price: 320,
      imageUrl: '',
      isActive: true,
      groupIds: [1, 2],
    });
  });
});
