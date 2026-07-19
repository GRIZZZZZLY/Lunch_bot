import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineIndicator } from '../../src/components/common/OfflineIndicator';
import { PWAUpdatePrompt } from '../../src/components/common/PWAUpdatePrompt';
import { WelcomeModal } from '../../src/components/onboarding/WelcomeModal';

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  const createMotionComponent =
    (tag: string) =>
    ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: any) =>
      ReactModule.createElement(tag, props, children);

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      button: createMotionComponent('button'),
      div: createMotionComponent('div'),
      h2: createMotionComponent('h2'),
      p: createMotionComponent('p'),
    },
  };
});

describe('Mini App shell helpers', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows onboarding slides and closes from the welcome modal', () => {
    const onClose = vi.fn();

    render(<WelcomeModal isOpen onClose={onClose} />);

    expect(screen.getByText(/Добро пожаловать/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Далее/i }));
    expect(screen.getByText(/Навигация/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Пропустить/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an offline indicator when the browser goes offline', async () => {
    render(<OfflineIndicator />);

    expect(
      screen.queryByText(/Нет подключения к интернету/i)
    ).not.toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(
      await screen.findByText(/Нет подключения к интернету/i)
    ).toBeInTheDocument();
  });

  it('shows update prompt and calls service worker updater with reload', async () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);

    render(<PWAUpdatePrompt />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('swUpdateAvailable', {
          detail: { updateSW },
        })
      );
    });

    expect(
      await screen.findByText(/Доступно обновление/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Обновить сейчас/i }));

    await waitFor(() => {
      expect(updateSW).toHaveBeenCalledWith(true);
    });
  });
});
