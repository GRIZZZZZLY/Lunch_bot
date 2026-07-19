import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DonationModal } from '../../src/components/donation/DonationModal';
import { FeedbackModal } from '../../src/components/modals/FeedbackModal';
import { ProfilePage } from '../../src/pages/ProfilePage';

const {
  addNotification,
  createStarsInvoice,
  feedbackSend,
  getPaymentInfo,
  isGroupAdminState,
  openInvoice,
  showAlert,
  updatePaymentInfo,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  createStarsInvoice: vi.fn(),
  feedbackSend: vi.fn(),
  getPaymentInfo: vi.fn(),
  isGroupAdminState: { value: false },
  openInvoice: vi.fn(),
  showAlert: vi.fn(),
  updatePaymentInfo: vi.fn(),
}));

vi.mock('../../src/services/user.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/user.service')>();
  const service = actual.userService;

  return {
    ...actual,
    userService: {
      formatCardNumber: service.formatCardNumber.bind(service),
      formatPhone: service.formatPhone.bind(service),
      getPaymentInfo,
      maskCardNumber: service.maskCardNumber.bind(service),
      updatePaymentInfo,
      validateCardNumber: service.validateCardNumber.bind(service),
      validatePhone: service.validatePhone.bind(service),
    },
  };
});

vi.mock('../../src/services/feedback.service', () => ({
  feedbackService: {
    send: feedbackSend,
  },
}));

vi.mock('../../src/services/donation.service', () => ({
  donationService: {
    createStarsInvoice,
  },
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    refresh: vi.fn(),
    user: {
      id: 5,
      firstName: 'Igor',
      lastName: 'Rocket',
      username: 'igor',
      telegramId: '5',
      isAdmin: false,
      isActive: true,
      createdAt: '2026-06-26T09:00:00.000Z',
    },
  }),
}));

vi.mock('../../src/hooks/useIsGroupAdmin', () => ({
  useIsGroupAdmin: () => isGroupAdminState.value,
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => ({
    backButton: {
      hide: vi.fn(),
      onClick: vi.fn(),
      show: vi.fn(),
    },
    colorScheme: 'light',
    mainButton: {
      hide: vi.fn(),
      onClick: vi.fn(),
      setText: vi.fn(),
      show: vi.fn(),
    },
    showAlert,
    webApp: {
      openInvoice,
    },
  }),
}));

vi.mock('../../src/hooks/useHaptic', () => ({
  useHaptic: () => ({
    error: vi.fn(),
    light: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    showOnboarding: vi.fn(),
  }),
}));

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: (
    selector: (state: {
      addNotification: typeof addNotification;
      theme: 'light';
    }) => unknown
  ) =>
    selector({
      addNotification,
      theme: 'light',
    }),
}));

vi.mock('../../src/services/insights.service', () => ({
  getQuickStats: () => ({
    topDish: 'Soup',
    totalVotes: 3,
    uniqueDishes: 2,
  }),
}));

vi.mock('../../src/components/common/UserAvatar', () => ({
  UserAvatar: () => <div data-testid="user-avatar" />,
}));

vi.mock('../../src/components/donation/DonationButton', () => ({
  DonationButton: () => <div data-testid="donation-button" />,
}));

vi.mock('react-confetti', () => ({
  default: () => null,
}));

vi.mock('../../src/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const renderProfile = () =>
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

describe('profile Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGroupAdminState.value = false;
    getPaymentInfo.mockResolvedValue({
      success: true,
      data: {
        paymentCard: '',
        paymentPhone: '',
        paymentDetails: '',
      },
    });
    updatePaymentInfo.mockResolvedValue({
      success: true,
      data: {
        paymentCard: '1234 5678 1234 5678',
        paymentPhone: '',
        paymentDetails: '',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exposes payment fields by accessible labels', async () => {
    renderProfile();

    expect(await screen.findByLabelText(/Номер карты/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Номер телефона/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Дополнительная информация/i)).toBeInTheDocument();
  });

  it('shows Telegram profile data, quick stats, and regular profile links', async () => {
    renderProfile();

    expect(await screen.findByText('Igor Rocket')).toBeInTheDocument();
    expect(screen.getByText('@igor')).toBeInTheDocument();
    expect(screen.getByText('опросов')).toBeInTheDocument();
    expect(screen.getByText('блюд')).toBeInTheDocument();
    expect(screen.getByText('любимое')).toBeInTheDocument();
    expect(screen.getByText('История голосований')).toBeInTheDocument();
    expect(screen.getByText('Мои предложения')).toBeInTheDocument();
  });

  it('shows admin entry points for a group admin', async () => {
    isGroupAdminState.value = true;

    renderProfile();

    expect(await screen.findByText('Панель администратора')).toBeInTheDocument();
    expect(screen.getByText('Предложка')).toBeInTheDocument();
  });

  it('saves valid payment edits immediately when the user leaves a field', async () => {
    renderProfile();

    const cardInput = await screen.findByPlaceholderText('1234 5678 9012 3456');

    fireEvent.change(cardInput, {
      target: { value: '1234567812345678' },
    });
    fireEvent.blur(cardInput);

    await waitFor(() =>
      expect(updatePaymentInfo).toHaveBeenCalledWith({
        paymentCard: '1234 5678 1234 5678',
        paymentPhone: '',
        paymentDetails: '',
      })
    );
  });

  it('keeps invalid payment edits marked as unsaved and does not send them', async () => {
    vi.useFakeTimers();
    renderProfile();

    const cardInput = await screen.findByPlaceholderText('1234 5678 9012 3456');

    fireEvent.change(cardInput, {
      target: { value: '123' },
    });

    expect(screen.getByText(/Несохран/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(updatePaymentInfo).not.toHaveBeenCalled();
    expect(screen.getByText(/Несохран/i)).toBeInTheDocument();
  });
});

describe('feedback Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedbackSend.mockResolvedValue({
      success: true,
      data: { id: 10, createdAt: '2026-06-26T09:00:00.000Z' },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sends feedback without writing the message metadata to console', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onClose = vi.fn();

    render(<FeedbackModal isOpen onClose={onClose} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Нужна помощь' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Отправить/i }));

    await waitFor(() =>
      expect(feedbackSend).toHaveBeenCalledWith({
        message: 'Нужна помощь',
        userId: 5,
        username: 'igor',
        firstName: 'Igor',
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('donation Mini App flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStarsInvoice.mockResolvedValue({
      success: true,
      data: {
        amountStars: 1,
        donationId: 'donation-1',
        invoiceUrl: 'https://t.me/invoice/test',
      },
    });
    openInvoice.mockImplementation((_url: string, callback: (status: string) => void) => {
      callback('paid');
    });
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('selects Telegram Stars by keyboard-accessible button and opens the invoice', async () => {
    render(<DonationModal isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Закрыть/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Telegram Stars/i }));
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/i }));

    await waitFor(() => expect(createStarsInvoice).toHaveBeenCalledWith(1));
    expect(openInvoice).toHaveBeenCalledWith(
      'https://t.me/invoice/test',
      expect.any(Function)
    );
    expect(await screen.findByText(/Спасибо/i)).toBeInTheDocument();
  });
});
