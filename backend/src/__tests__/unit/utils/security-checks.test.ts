/**
 * Проверки безопасности при старте production-процесса. Пропущенная проверка
 * означает, что сервер поднимется с подписью initData выключенной или с
 * секретом JWT из примера — и любой сможет войти под чужим аккаунтом.
 */

import { runSecurityChecks } from '../../../utils/security-checks';

const SECURE = {
  NODE_ENV: 'production',
  SKIP_TELEGRAM_VALIDATION: 'false',
  JWT_SECRET: 'a'.repeat(64),
  ENCRYPTION_KEY: 'a'.repeat(64),
  BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  DATABASE_URL: 'postgresql://user:pass@localhost/db',
};

describe('runSecurityChecks в production', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each<[string, Record<string, string | undefined>]>([
    ['обход проверки подписи Telegram', { SKIP_TELEGRAM_VALIDATION: 'true' }],
    ['JWT_SECRET из примера', { JWT_SECRET: 'dev_jwt_secret_change_in_production' }],
    ['без ENCRYPTION_KEY', { ENCRYPTION_KEY: undefined }],
  ])('%s — старт отклоняется', (_name, override) => {
    process.env = { ...originalEnv, ...SECURE, ...override };
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) delete process.env[key];
    }

    expect(() => runSecurityChecks()).toThrow();
  });

  it('безопасная конфигурация проходит', () => {
    process.env = { ...originalEnv, ...SECURE };

    expect(() => runSecurityChecks()).not.toThrow();
  });
});
