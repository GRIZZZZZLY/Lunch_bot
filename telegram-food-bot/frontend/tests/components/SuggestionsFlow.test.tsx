import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MySuggestionsPage } from '../../src/pages/MySuggestionsPage';
import { SuggestionsPanel } from '../../src/components/menu/SuggestionsPanel';

const {
  approveSuggestion,
  deleteSuggestion,
  navigate,
  rejectSuggestion,
  useSuggestionsMock,
} = vi.hoisted(() => ({
  approveSuggestion: vi.fn(),
  deleteSuggestion: vi.fn(),
  navigate: vi.fn(),
  rejectSuggestion: vi.fn(),
  useSuggestionsMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const createMotionComponent = (tag: string) =>
    ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      layout: _layout,
      ...props
    }: any) => ReactModule.createElement(tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      div: createMotionComponent('div'),
    },
  };
});

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    colorScheme: 'light',
    hapticFeedback: {
      impactOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
  }),
}));

vi.mock('../../src/hooks/useSuggestions', () => ({
  useApproveSuggestion: () => ({
    mutate: approveSuggestion,
    isPending: false,
  }),
  useDeleteSuggestion: () => ({
    mutate: deleteSuggestion,
    isPending: false,
  }),
  useRejectSuggestion: () => ({
    mutate: rejectSuggestion,
    isPending: false,
  }),
  useSuggestionStats: () => ({
    data: {
      total: 3,
      pending: 1,
      approved: 1,
      rejected: 1,
      approvalRate: 33,
    },
    isLoading: false,
  }),
  useSuggestions: useSuggestionsMock,
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
          confirm action
        </button>
      </div>
    ) : null,
}));

const suggestions = [
  {
    id: 1,
    name: 'Soup',
    description: 'Hot',
    price: 250,
    status: 'PENDING',
    suggestedBy: 5,
    groupId: 2,
    createdAt: '2026-06-22T09:00:00.000Z',
    updatedAt: '2026-06-22T09:00:00.000Z',
    suggester: { id: 5, firstName: 'Alice' },
  },
  {
    id: 2,
    name: 'Salad',
    description: 'Green',
    price: 180,
    status: 'APPROVED',
    suggestedBy: 5,
    groupId: 2,
    createdAt: '2026-06-22T09:00:00.000Z',
    updatedAt: '2026-06-22T09:00:00.000Z',
    reviewer: { id: 7, firstName: 'Admin' },
    reviewedAt: '2026-06-22T10:00:00.000Z',
  },
  {
    id: 3,
    name: 'Cake',
    description: 'Sweet',
    price: 300,
    status: 'REJECTED',
    suggestedBy: 5,
    groupId: 2,
    createdAt: '2026-06-22T09:00:00.000Z',
    updatedAt: '2026-06-22T09:00:00.000Z',
    rejectionReason: 'Too sweet',
    reviewer: { id: 7, firstName: 'Admin' },
    reviewedAt: '2026-06-22T10:00:00.000Z',
  },
];

describe('suggestions Mini App screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('prompt', vi.fn(() => 'No fit'));
    useSuggestionsMock.mockImplementation((params?: { status?: string }) => ({
      data: params?.status
        ? suggestions.filter(item => item.status === params.status)
        : suggestions,
      isLoading: false,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows user suggestions, searches by name and opens creation through the menu page', () => {
    render(<MySuggestionsPage />);

    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'sou' },
    });

    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.queryByText('Salad')).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(navigate).toHaveBeenCalledWith('/menu');
  });

  it('changes the user suggestion status filter', () => {
    render(<MySuggestionsPage />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[4]);

    expect(useSuggestionsMock).toHaveBeenLastCalledWith({ status: 'APPROVED' });
    expect(screen.getByText('Salad')).toBeInTheDocument();
    expect(screen.queryByText('Soup')).not.toBeInTheDocument();
  });

  it('lets an admin approve a pending suggestion', async () => {
    render(<SuggestionsPanel selectedTab='PENDING' />);

    expect(screen.getByText('Soup')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Одобрить/i }));

    await waitFor(() => {
      expect(approveSuggestion).toHaveBeenCalledWith(1);
    });
  });

  it('lets an admin delete a rejected suggestion after confirmation', async () => {
    render(<SuggestionsPanel selectedTab='REJECTED' />);

    expect(screen.getByText('Cake')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Удалить/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(deleteSuggestion).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'confirm action' }));

    await waitFor(() => {
      expect(deleteSuggestion).toHaveBeenCalledWith(3);
    });
  });
});
