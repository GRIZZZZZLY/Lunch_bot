import crypto from 'crypto';
import {
  generateTestInitData,
  validateTelegramInitData,
} from '../../utils/telegram-auth';

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const BOT_TOKEN = '123456:test_bot_token';

function signInitData(
  authDate: number,
  user: Record<string, unknown>
): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify(user),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('Telegram initData security', () => {
  beforeEach(() => {
    process.env.BOT_TOKEN = BOT_TOKEN;
    process.env.NODE_ENV = 'test';
    process.env.SKIP_TELEGRAM_VALIDATION = 'false';
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = '300';
  });

  it('accepts a recent, correctly signed payload', () => {
    const initData = generateTestInitData(42, 'Ирина', 'irina');

    expect(validateTelegramInitData(initData)).toMatchObject({
      id: 42,
      first_name: 'Ирина',
      username: 'irina',
    });
  });

  it('rejects a modified payload', () => {
    const initData = generateTestInitData(42, 'Ирина').replace(
      '%D0%98%D1%80%D0%B8%D0%BD%D0%B0',
      '%D0%9E%D0%BB%D1%8C%D0%B3%D0%B0'
    );

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('rejects an expired but correctly signed payload', () => {
    const initData = signInitData(
      Math.floor(Date.now() / 1000) - 301,
      { id: 42, first_name: 'Ирина' }
    );

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('rejects a payload too far in the future', () => {
    const initData = signInitData(
      Math.floor(Date.now() / 1000) + 31,
      { id: 42, first_name: 'Ирина' }
    );

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('never permits skip-validation in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';

    expect(
      validateTelegramInitData(
        new URLSearchParams({
          user: JSON.stringify({ id: 42, first_name: 'Ирина' }),
        }).toString()
      )
    ).toBeNull();
  });
});
