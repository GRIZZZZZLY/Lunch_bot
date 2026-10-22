import { describe, expect, it } from 'vitest';
import { resolveAuthView } from '../AuthGate';

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
