import '@testing-library/jest-dom/vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from '../../src/components/layout/Layout';
import { useAppStore } from '../../src/store/useAppStore';

const { telegramState } = vi.hoisted(() => ({
  telegramState: {
    colorScheme: 'dark',
    isReady: true,
    themeParams: {
      bg_color: '#111111',
      button_color: '#333333',
      button_text_color: '#ffffff',
      hint_color: '#777777',
      link_color: '#2481cc',
      secondary_bg_color: '#222222',
      text_color: '#eeeeee',
    },
  },
}));

vi.mock('../../src/hooks/useTelegram', () => ({
  useTelegram: () => telegramState,
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    error: null,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../src/components/donation/DonationBar', () => ({
  DonationBar: () => null,
}));

vi.mock('framer-motion', async () => {
  const ReactModule = await import('react');

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    m: {
      div: ({ children, ...props }: any) =>
        ReactModule.createElement('div', props, children),
    },
  };
});

describe('Layout Telegram theme sync', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('applies Telegram theme to store and CSS without console noise', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(useAppStore.getState().theme).toBe('dark');
    });

    expect(document.documentElement).toHaveClass('dark');
    expect(
      document.documentElement.style.getPropertyValue('--tg-theme-bg-color')
    ).toBe('#111111');
    expect(logSpy).not.toHaveBeenCalled();
  });
});
