import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuPage } from '../../src/pages/MenuPage';

const {
  createItem,
  deleteItem,
  getAllItems,
  isGroupAdminValue,
  setCurrentGroupId,
  toggleItemStatus,
  updateItem,
} = vi.hoisted(() => ({
  createItem: vi.fn(),
  deleteItem: vi.fn(),
  getAllItems: vi.fn(),
  isGroupAdminValue: { current: false },
  setCurrentGroupId: vi.fn(),
  toggleItemStatus: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const createMotionComponent = (tag: string) =>
    ({
      children,
      variants: _variants,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: any) => ReactModule.createElement(tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      button: createMotionComponent('button'),
      div: createMotionComponent('div'),
    },
  };
});

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 5, firstName: 'Alice' },
  }),
}));

vi.mock('../../src/hooks/useIsGroupAdmin', () => ({
  useIsGroupAdmin: () => isGroupAdminValue.current,
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    colorScheme: 'light',
    mainButton: { hide: vi.fn() },
    backButton: { hide: vi.fn() },
  }),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      addNotification: vi.fn(),
      theme: 'light',
      setCurrentGroupId,
    }),
}));

vi.mock('../../src/hooks/useCurrentGroup', () => ({
  useCurrentGroup: () => ({
    currentGroupId: 2,
    currentGroup: { id: 2, title: 'Team Menu' },
    groups: [
      {
        id: 2,
        title: 'Team Menu',
        role: isGroupAdminValue.current ? 'ADMIN' : 'MEMBER',
      },
    ],
  }),
}));

vi.mock('../../src/hooks/useSuggestions', () => ({
  usePendingCount: () => ({ data: 0 }),
}));

vi.mock('../../src/services/menu.service', () => ({
  menuService: {
    createItem,
    deleteItem,
    getAllItems,
    toggleItemStatus,
    updateItem,
  },
}));

vi.mock('../../src/components/menu/MenuList', () => ({
  MenuList: ({
    items,
    onDelete,
    onEdit,
    onToggleStatus,
    showActions,
  }: {
    items: Array<{ id: number; name: string; price?: number }>;
    onDelete?: (id: number) => void;
    onEdit?: (item: { id: number; name: string; price?: number }) => void;
    onToggleStatus?: (id: number) => void;
    showActions?: boolean;
  }) => (
    <div>
      {items.map(item => (
        <article key={item.name}>
          <h2>{item.name}</h2>
          <p>{item.price}</p>
          {showActions && (
            <>
              <button onClick={() => onEdit?.(item)} type='button'>
                edit {item.name}
              </button>
              <button onClick={() => onDelete?.(item.id)} type='button'>
                delete {item.name}
              </button>
              <button onClick={() => onToggleStatus?.(item.id)} type='button'>
                toggle {item.name}
              </button>
            </>
          )}
        </article>
      ))}
    </div>
  ),
}));

vi.mock('../../src/components/menu/VirtualMenuList', () => ({
  VirtualMenuList: ({ items }: { items: Array<{ name: string }> }) => (
    <div>{items.map(item => <span key={item.name}>{item.name}</span>)}</div>
  ),
}));

vi.mock('../../src/components/common/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
}));

vi.mock('../../src/components/menu/MenuForm', () => ({
  MenuForm: ({
    item,
    onSubmit,
  }: {
    item?: { id: number; name: string; groupId: number; isActive: boolean } | null;
    onSubmit: (data: any) => Promise<void>;
  }) => (
    <form>
      <div data-testid='menu-form-mode'>{item ? `editing ${item.name}` : 'creating'}</div>
      <button
        onClick={() =>
          onSubmit({
            name: item ? `${item.name} updated` : 'New dish',
            description: 'Updated description',
            price: 350,
            imageUrl: '',
            isActive: true,
            groupIds: item ? [item.groupId] : [2],
          })
        }
        type='button'
      >
        submit menu form
      </button>
    </form>
  ),
}));

vi.mock('../../src/components/menu/SuggestDishForm', () => ({
  SuggestDishForm: () => null,
}));

vi.mock('../../src/components/modals', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    title,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
  }) =>
    isOpen ? (
      <div role='dialog'>
        <p>{title}</p>
        <button onClick={onConfirm} type='button'>
          confirm delete
        </button>
      </div>
    ) : null,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'MenuPageTestWrapper';
  return Wrapper;
};

describe('MenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGroupAdminValue.current = false;
    getAllItems.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          groupId: 2,
          name: 'Borscht',
          description: 'Soup',
          price: 320,
          isActive: true,
          createdAt: '2026-06-22T09:00:00.000Z',
          updatedAt: '2026-06-22T09:00:00.000Z',
        },
        {
          id: 2,
          groupId: 2,
          name: 'Cutlet',
          description: 'Main',
          price: 410,
          isActive: false,
          createdAt: '2026-06-22T09:00:00.000Z',
          updatedAt: '2026-06-22T09:00:00.000Z',
        },
      ],
    });
    createItem.mockResolvedValue({ success: true, data: [] });
    deleteItem.mockResolvedValue({ success: true });
    toggleItemStatus.mockResolvedValue({
      success: true,
      data: {
        id: 2,
        groupId: 2,
        name: 'Cutlet',
        description: 'Main',
        price: 410,
        isActive: true,
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
      },
    });
    updateItem.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        groupId: 2,
        name: 'Borscht updated',
        description: 'Updated description',
        price: 350,
        isActive: true,
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and shows menu items for the current group', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(getAllItems).toHaveBeenCalledWith(2);
    });

    expect(await screen.findByText('Borscht')).toBeInTheDocument();
    expect(screen.getByText('Cutlet')).toBeInTheDocument();
    expect(screen.getByText('Team Menu')).toBeInTheDocument();
  });

  it('filters loaded menu items by the search text', async () => {
    render(<MenuPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Borscht')).toBeInTheDocument();
    expect(screen.getByText('Cutlet')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Поиск блюд/i), {
      target: { value: 'bor' },
    });

    expect(screen.getByText('Borscht')).toBeInTheDocument();
    expect(screen.queryByText('Cutlet')).not.toBeInTheDocument();
    expect(getAllItems).toHaveBeenCalledTimes(1);
  });

  it('lets a group admin edit a menu item from the menu page', async () => {
    isGroupAdminValue.current = true;

    render(<MenuPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Borscht')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'edit Borscht' }));

    expect(screen.getByTestId('menu-form-mode')).toHaveTextContent('editing Borscht');

    fireEvent.click(screen.getByRole('button', { name: 'submit menu form' }));

    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith(
        1,
        {
          name: 'Borscht updated',
          description: 'Updated description',
          price: 350,
          imageUrl: '',
          isActive: true,
          groupIds: [2],
        },
        2
      );
    });
  });

  it('asks for confirmation before deleting a menu item', async () => {
    isGroupAdminValue.current = true;

    render(<MenuPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Borscht')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'delete Borscht' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(deleteItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'confirm delete' }));

    await waitFor(() => {
      expect(deleteItem).toHaveBeenCalledWith(1, 2);
    });
  });

  it('lets a group admin toggle a menu item status', async () => {
    isGroupAdminValue.current = true;

    render(<MenuPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Cutlet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'toggle Cutlet' }));

    await waitFor(() => {
      expect(toggleItemStatus).toHaveBeenCalledWith(2, 2);
    });
  });
});
