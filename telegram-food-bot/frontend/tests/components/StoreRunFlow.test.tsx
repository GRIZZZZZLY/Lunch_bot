import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveStoreRunsSection } from '../../src/components/store-run/ActiveStoreRunsSection';
import { CreateStoreRunSheet } from '../../src/components/store-run/CreateStoreRunSheet';
import { InitiatorView } from '../../src/components/store-run/InitiatorView';
import { ParticipantView } from '../../src/components/store-run/ParticipantView';

const {
  addItems,
  cancelRun,
  createRun,
  deleteItem,
  navigate,
  setItemPrice,
  settleRun,
  startShopping,
} = vi.hoisted(() => ({
  addItems: vi.fn(),
  cancelRun: vi.fn(),
  createRun: vi.fn(),
  deleteItem: vi.fn(),
  navigate: vi.fn(),
  setItemPrice: vi.fn(),
  settleRun: vi.fn(),
  startShopping: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const createMotionComponent = (tag: string) =>
    ({
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: any) => ReactModule.createElement(tag, props, children);

  return {
    m: {
      button: createMotionComponent('button'),
      div: createMotionComponent('div'),
    },
  };
});

vi.mock('../../src/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    hapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
  }),
}));

vi.mock('../../src/hooks/useCountdownTimer', () => ({
  useCountdownTimer: () => ({
    formattedTime: '09:00',
    isExpired: false,
  }),
}));

vi.mock('../../src/hooks/queries/useUserQueries', () => ({
  useUserGroups: () => ({
    data: [{ id: 2, title: 'Team', isActive: true }],
  }),
}));

vi.mock('../../src/hooks/queries/useStoreRunQueries', () => ({
  useActiveStoreRuns: () => ({
    data: [
      {
        id: 7,
        groupId: 2,
        initiatorId: 4,
        storeName: 'Market',
        status: 'COLLECTING',
        collectUntil: '2026-06-22T10:00:00.000Z',
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
        initiator: { id: 4, firstName: 'Alice' },
        items: [{ id: 11, name: 'Milk', quantity: 1 }],
      },
    ],
    isLoading: false,
  }),
  useAddStoreItems: () => ({
    mutateAsync: addItems,
    isPending: false,
  }),
  useCancelStoreRun: () => ({
    mutateAsync: cancelRun,
    isPending: false,
  }),
  useCreateStoreRun: () => ({
    mutateAsync: createRun,
    isPending: false,
  }),
  useDeleteStoreItem: () => ({
    mutateAsync: deleteItem,
  }),
  useSetItemPrice: () => ({
    mutateAsync: setItemPrice,
    isPending: false,
  }),
  useSettleStoreRun: () => ({
    mutateAsync: settleRun,
    isPending: false,
  }),
  useStartShopping: () => ({
    mutateAsync: startShopping,
    isPending: false,
  }),
}));

const baseRun = {
  id: 7,
  groupId: 2,
  initiatorId: 4,
  storeName: 'Market',
  status: 'COLLECTING',
  collectUntil: '2026-06-22T10:00:00.000Z',
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:00:00.000Z',
  initiator: { id: 4, firstName: 'Alice' },
  items: [
    {
      id: 11,
      storeRunId: 7,
      userId: 5,
      name: 'Milk',
      quantity: 1,
      notes: 'Low fat',
      price: null,
      status: 'REQUESTED',
      createdAt: '2026-06-22T09:00:00.000Z',
      updatedAt: '2026-06-22T09:00:00.000Z',
      user: { id: 5, firstName: 'Bob' },
    },
  ],
} as any;

describe('store run Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addItems.mockResolvedValue({ success: true, data: [] });
    createRun.mockResolvedValue({ success: true, data: { id: 9 } });
    cancelRun.mockResolvedValue({ success: true, data: { ...baseRun, status: 'CANCELLED' } });
    deleteItem.mockResolvedValue({ success: true });
    setItemPrice.mockResolvedValue({ success: true, data: {} });
    settleRun.mockResolvedValue({ success: true, data: { ...baseRun, status: 'SETTLED' } });
    startShopping.mockResolvedValue({ success: true, data: { ...baseRun, status: 'SHOPPING' } });
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows active store runs and opens a selected run', () => {
    render(<ActiveStoreRunsSection groupId={2} currentUserId={5} />);

    expect(screen.getByText(/Market/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Market/).closest('button')!);

    expect(navigate).toHaveBeenCalledWith('/store-run/7');
  });

  it('creates a store run for the selected group and opens it', async () => {
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();

    render(
      <CreateStoreRunSheet
        open
        onOpenChange={onOpenChange}
        groupId={2}
        onCreated={onCreated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Поехали/i }));

    await waitFor(() => {
      expect(createRun).toHaveBeenCalledWith({
        groupId: 2,
        storeName: expect.any(String),
        collectMinutes: 10,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onCreated).toHaveBeenCalledWith(9);
    });
  });

  it('lets a participant add and delete own items while collecting', async () => {
    render(<ParticipantView run={baseRun} currentUserId={5} />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Bread' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'Sliced' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Добавить/i }));

    await waitFor(() => {
      expect(addItems).toHaveBeenCalledWith([
        { name: 'Bread', quantity: 1, notes: 'Sliced' },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: /Удалить/i }));

    expect(deleteItem).toHaveBeenCalledWith(11);
  });

  it('lets the initiator start shopping', async () => {
    render(<InitiatorView run={baseRun} />);

    fireEvent.click(screen.getByRole('button', { name: /Я в магазине/i }));

    await waitFor(() => {
      expect(startShopping).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the initiator cancel a collecting run', async () => {
    const onRunDone = vi.fn();

    render(<InitiatorView run={{ ...baseRun, items: [] }} onRunDone={onRunDone} />);

    fireEvent.click(screen.getByRole('button', { name: /Отменить/i }));

    await waitFor(() => {
      expect(cancelRun).toHaveBeenCalledTimes(1);
      expect(onRunDone).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the initiator settle a shopping run with bought items', async () => {
    const onRunDone = vi.fn();
    const shoppingRun = {
      ...baseRun,
      status: 'SHOPPING',
      items: [{ ...baseRun.items[0], status: 'BOUGHT', price: 120 }],
    };

    render(<InitiatorView run={shoppingRun} onRunDone={onRunDone} />);

    fireEvent.click(screen.getByRole('button', { name: /Завершить/i }));

    await waitFor(() => {
      expect(settleRun).toHaveBeenCalledTimes(1);
      expect(onRunDone).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the initiator mark an item as bought or not found during shopping', async () => {
    const shoppingRun = { ...baseRun, status: 'SHOPPING' };

    render(<InitiatorView run={shoppingRun} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByTitle(/Куплено/i));

    await waitFor(() => {
      expect(setItemPrice).toHaveBeenCalledWith({
        itemId: 11,
        payload: { price: 120, status: 'BOUGHT' },
      });
    });

    fireEvent.click(screen.getByTitle(/Не нашёл/i));

    await waitFor(() => {
      expect(setItemPrice).toHaveBeenCalledWith({
        itemId: 11,
        payload: { price: null, status: 'NOT_FOUND' },
      });
    });
  });
});
