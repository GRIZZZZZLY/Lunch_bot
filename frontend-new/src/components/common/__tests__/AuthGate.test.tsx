import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthGate, resolveAuthView } from '../AuthGate';
import { useAppStore } from '@/store/useAppStore';

describe('resolveAuthView', () => {
  it('вне Telegram в production — экран «откройте в Telegram»', () => {
    expect(resolveAuthView({ status: 'idle', hasWebApp: false, isProd: true })).toBe(
      'outside-telegram',
    );
    expect(resolveAuthView({ status: 'error', hasWebApp: false, isProd: true })).toBe(
      'outside-telegram',
    );
  });

  it('вне Telegram в dev действует обычный флоу (стаб initData)', () => {
    expect(resolveAuthView({ status: 'authenticated', hasWebApp: false, isProd: false })).toBe(
      'app',
    );
    expect(resolveAuthView({ status: 'error', hasWebApp: false, isProd: false })).toBe('error');
  });

  it('статусы маппятся на экраны', () => {
    expect(resolveAuthView({ status: 'idle', hasWebApp: true, isProd: true })).toBe('loading');
    expect(resolveAuthView({ status: 'authenticating', hasWebApp: true, isProd: true })).toBe(
      'loading',
    );
    expect(resolveAuthView({ status: 'authenticated', hasWebApp: true, isProd: true })).toBe('app');
    expect(resolveAuthView({ status: 'error', hasWebApp: true, isProd: true })).toBe('error');
  });
});

describe('AuthGate', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: null,
      authStatus: 'idle',
      authError: null,
      currentGroupId: null,
    });
  });

  it('до авторизации показывает загрузку, а не приложение', () => {
    render(
      <AuthGate hasWebApp isProd={false}>
        <div>приложение</div>
      </AuthGate>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('приложение')).not.toBeInTheDocument();
  });

  it('после успешной авторизации рендерит детей', () => {
    useAppStore.setState({ authStatus: 'authenticated' });
    render(
      <AuthGate hasWebApp isProd={false}>
        <div>приложение</div>
      </AuthGate>,
    );
    expect(screen.getByText('приложение')).toBeInTheDocument();
  });

  it('ошибка авторизации — сообщение и рабочая кнопка «Повторить»', async () => {
    useAppStore.setState({ authStatus: 'error', authError: 'Сессия истекла' });
    const onRetry = vi.fn();
    render(
      <AuthGate hasWebApp isProd={false} onRetry={onRetry}>
        <div>приложение</div>
      </AuthGate>,
    );

    expect(screen.getByText('Не удалось войти')).toBeInTheDocument();
    expect(screen.getByText('Сессия истекла')).toBeInTheDocument();
    expect(screen.queryByText('приложение')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('вне Telegram в production — экран без кнопки повтора', () => {
    useAppStore.setState({ authStatus: 'error', authError: 'x' });
    render(
      <AuthGate hasWebApp={false} isProd>
        <div>приложение</div>
      </AuthGate>,
    );
    expect(screen.getByText('Откройте в Telegram')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
