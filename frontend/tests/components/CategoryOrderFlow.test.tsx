import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetWidgetWithCalculator } from '../../src/components/budget/BudgetWidgetWithCalculator';
import { CategoryOrderCalculator } from '../../src/components/budget/CategoryOrderCalculator';
import type { CategoryOrder } from '../../src/services/category-order.service';

const {
  addNotification,
  autoSave,
  finalizeCalculation,
  getParticipants,
  updateCosts,
  updateCostsAsync,
  volunteerForCategory,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  autoSave: vi.fn(),
  finalizeCalculation: vi.fn(),
  getParticipants: vi.fn(),
  updateCosts: vi.fn(),
  updateCostsAsync: vi.fn(),
  volunteerForCategory: vi.fn(),
}));

vi.mock('../../src/services/category-order.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/category-order.service')>();

  return {
    ...actual,
    categoryOrderService: {
      getParticipants,
      volunteerForCategory,
    },
  };
});

vi.mock('../../src/hooks/useOrderCalculation', () => ({
  useOrderCalculation: () => ({
    autoSave,
    finalizeCalculation,
    isFinalizing: false,
    isLoading: false,
    isUpdatingCosts: false,
    orderItems: [
      {
        id: 11,
        categoryOrderId: 3,
        userId: 5,
        itemName: 'Soup',
        price: 300,
        notes: null,
        enteredBy: 9,
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
      },
      {
        id: 12,
        categoryOrderId: 3,
        userId: 6,
        itemName: 'Salad',
        price: 250,
        notes: null,
        enteredBy: 9,
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
      },
    ],
    pendingSaves: new Set(),
    updateCosts,
    updateCostsAsync,
  }),
}));

vi.mock('../../src/hooks/usePolls', () => ({
  useActivePolls: () => ({
    data: [{ id: 7, status: 'COMPLETED' }],
    isLoading: false,
  }),
}));

vi.mock('../../src/hooks/useCategoryOrders', () => ({
  useCategoryOrder: () => ({
    data: null,
    isLoading: false,
  }),
  useCategoryOrders: () => ({
    data: [],
    isLoading: false,
  }),
  useParticipantCategoryOrders: () => ({
    data: [
      {
        id: 4,
        pollId: 7,
        category: 'Soup',
        responsibleUserId: null,
        selectionStatus: 'VOLUNTEER_OPEN',
        calculationStatus: 'PENDING',
        selectionMode: null,
        participantCount: 2,
        deliveryCost: null,
        serviceFee: null,
        tip: null,
        notes: null,
        totalItemsAmount: null,
        totalAdditionalCosts: null,
        totalAmount: null,
        createdAt: '2026-06-22T09:00:00.000Z',
        updatedAt: '2026-06-22T09:00:00.000Z',
        calculationStartedAt: null,
        calculationCompletedAt: null,
        poll: { id: 7, groupId: 2, status: 'COMPLETED' },
        responsibleUser: null,
        orderItems: [],
        _count: { orderItems: 0 },
      },
    ],
    isLoading: false,
  }),
  useUserCategoryOrder: () => ({
    data: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/hooks/useIsGroupAdmin', () => ({
  useIsGroupAdmin: () => false,
}));

vi.mock('../../src/hooks/useSSE', () => ({
  useSSE: () => undefined,
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (selector: (state: { addNotification: typeof addNotification }) => unknown) =>
    selector({ addNotification }),
}));

vi.mock('../../src/components/ui/glass-card', () => ({
  GlassCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const categoryOrder: CategoryOrder = {
  id: 3,
  pollId: 7,
  category: 'Soup',
  responsibleUserId: 9,
  selectionStatus: 'SELECTED_VOLUNTEER',
  calculationStatus: 'IN_PROGRESS',
  selectionMode: 'volunteer',
  participantCount: 2,
  deliveryCost: 0,
  serviceFee: 0,
  tip: 0,
  notes: null,
  totalItemsAmount: 550,
  totalAdditionalCosts: 0,
  totalAmount: 550,
  createdAt: '2026-06-22T09:00:00.000Z',
  updatedAt: '2026-06-22T09:00:00.000Z',
  calculationStartedAt: null,
  calculationCompletedAt: null,
  poll: { id: 7, groupId: 2, status: 'COMPLETED' },
  responsibleUser: null,
  orderItems: [],
  _count: { orderItems: 2 },
};

const pendingCategoryOrder: CategoryOrder = {
  ...categoryOrder,
  id: 4,
  responsibleUserId: null,
  selectionStatus: 'VOLUNTEER_OPEN',
  selectionMode: null,
  totalItemsAmount: null,
  totalAdditionalCosts: null,
  totalAmount: null,
  _count: { orderItems: 0 },
};

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

  Wrapper.displayName = 'CategoryOrderFlowWrapper';
  return Wrapper;
};

describe('category order Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getParticipants.mockResolvedValue({
      success: true,
      data: [
        { id: 5, firstName: 'Bob', lastName: null, username: null },
        { id: 6, firstName: 'Alice', lastName: null, username: null },
      ],
    });
    updateCostsAsync.mockResolvedValue({});
    volunteerForCategory.mockResolvedValue({
      success: true,
      data: { ...pendingCategoryOrder, responsibleUserId: 5 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('autosaves participant items and saves current costs before finalizing', async () => {
    render(<CategoryOrderCalculator categoryOrder={categoryOrder} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Позиция для Bob/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Позиция для Bob/i), {
      target: { value: 'Borscht' },
    });
    fireEvent.change(screen.getByLabelText(/Цена для Bob/i), {
      target: { value: '320' },
    });
    fireEvent.change(screen.getByLabelText(/Доставка/i), {
      target: { value: '90' },
    });

    await waitFor(() => {
      expect(autoSave).toHaveBeenCalledWith({
        userId: 5,
        itemName: 'Borscht',
        price: 320,
        notes: undefined,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /Отправить суммы/i }));

    await waitFor(() => {
      expect(updateCostsAsync).toHaveBeenCalledWith({
        deliveryCost: 90,
        serviceFee: 0,
        tip: 0,
      });
      expect(finalizeCalculation).toHaveBeenCalledTimes(1);
    });
  });

  it('lets a participant volunteer as category responsible from Mini App', async () => {
    render(<BudgetWidgetWithCalculator pollId={7} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Я оформлю/i }));

    await waitFor(() => {
      expect(volunteerForCategory).toHaveBeenCalledWith(4);
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });
});
