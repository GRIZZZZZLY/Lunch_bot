/**
 * Проверка initData Telegram WebApp — единственное доказательство того, что
 * запрос действительно пришёл от конкретного человека из Telegram. Подделанная
 * подпись здесь означает вход под чужим аккаунтом, поэтому тесты написаны как
 * попытки обойти проверку: подменить user, подписать своим токеном, подсунуть
 * испорченный hash, переиграть перехваченный initData позже.
 *
 * Обход подписи в production и вход по настоящему initData проверяются через
 * API в integration/api/auth-surface.routes.test.ts.
 *
 * HMAC-функция в модуле приватная, поэтому подписанный initData собирается
 * здесь тем же алгоритмом, что и у Telegram.
 */
import crypto from 'crypto';
import { validateTelegramInitData, parseInitDataUnsafe } from '../../../utils/telegram-auth';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const BOT_TOKEN = '123456:AA-test-token';
const NOW_SECONDS = 1_800_000_000;
const USER = { id: 555, first_name: 'Иван', username: 'ivan' };

/** Собирает initData и подписывает его так же, как это делает Telegram. */
function signInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return new URLSearchParams({ ...fields, hash }).toString();
}

function validInitData(
  over: { authDate?: number; token?: string; extra?: Record<string, string> } = {}
): string {
  return signInitData(
    {
      user: JSON.stringify(USER),
      auth_date: String(over.authDate ?? NOW_SECONDS),
      ...(over.extra ?? {}),
    },
    over.token
  );
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(NOW_SECONDS * 1000));
  envBackup = { ...process.env };
  process.env.BOT_TOKEN = BOT_TOKEN;
  process.env.NODE_ENV = 'test';
  delete process.env.SKIP_TELEGRAM_VALIDATION;
  delete process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS;
});

afterEach(() => {
  jest.useRealTimers();
  process.env = envBackup;
});

describe('validateTelegramInitData: подпись', () => {
  /* Telegram добавляет поля (query_id, chat_type) — они входят в подпись, и
     ошибка в сборке строки проверки закрыла бы вход всем. */
  it('корректно подписанный initData с дополнительными полями даёт пользователя', () => {
    const user = validateTelegramInitData(
      validInitData({ extra: { query_id: 'AAF', chat_type: 'private' } })
    );

    expect(user).toMatchObject({ id: 555, first_name: 'Иван', username: 'ivan' });
  });

  it('подменённый user с прежней подписью отклоняется', () => {
    const tampered = validInitData().replace(
      encodeURIComponent('"id":555'),
      encodeURIComponent('"id":999')
    );

    expect(validateTelegramInitData(tampered)).toBeNull();
  });

  it('подпись чужим токеном отклоняется', () => {
    expect(validateTelegramInitData(validInitData({ token: '999:BB-attacker-token' }))).toBeNull();
  });

  it.each([
    ['отсутствует', undefined],
    ['короткий', 'abc123'],
    ['не hex', 'z'.repeat(64)],
    ['длиннее 64', 'a'.repeat(65)],
  ])('hash %s — отказ', (_name, hash) => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
      auth_date: String(NOW_SECONDS),
      ...(hash === undefined ? {} : { hash }),
    }).toString();

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('без BOT_TOKEN проверка невозможна и доступ закрыт', () => {
    delete process.env.BOT_TOKEN;

    expect(validateTelegramInitData(validInitData())).toBeNull();
  });
});

describe('validateTelegramInitData: срок жизни', () => {
  it.each<[string, number, boolean]>([
    ['перехваченный час назад — переиграть нельзя', -3600, false],
    ['небольшое расхождение часов клиента допускается', 20, true],
    ['31 с в будущем — отказ', 31, false],
    ['10 минут в будущем — отказ', 600, false],
  ])('%s', (_name, offsetSeconds, accepted) => {
    const user = validateTelegramInitData(validInitData({ authDate: NOW_SECONDS + offsetSeconds }));

    expect(user !== null).toBe(accepted);
  });

  it.each(['abc', '', '-1', '1e10'])('нечисловой auth_date %p отклоняется', authDate => {
    const initData = signInitData({ user: JSON.stringify(USER), auth_date: authDate });

    expect(validateTelegramInitData(initData)).toBeNull();
  });
});

/* Неподписанный разбор вызывается из входа и middleware в режиме обхода
   подписи. В production он обязан отказать, а не вернуть пользователя. */
it('parseInitDataUnsafe в production бросает, а не возвращает пользователя', () => {
  process.env.NODE_ENV = 'production';

  expect(() =>
    parseInitDataUnsafe(new URLSearchParams({ user: JSON.stringify(USER) }).toString())
  ).toThrow();
});
