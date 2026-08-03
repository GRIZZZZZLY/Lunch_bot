/**
 * Проверка initData Telegram WebApp — единственное доказательство того, что
 * запрос действительно пришёл от конкретного человека из Telegram. Подделанная
 * подпись здесь означает вход под чужим аккаунтом, поэтому тесты написаны как
 * попытки обойти проверку:
 *
 *  - подменить поле user, оставив подпись;
 *  - переиграть перехваченный initData позже (проверка auth_date);
 *  - подписать своим токеном;
 *  - подсунуть hash не той длины или не hex;
 *  - включить обход проверки в production (SKIP_TELEGRAM_VALIDATION).
 *
 * Сравнение хэшей — timingSafeEqual, и это не декоративная деталь: посимвольное
 * сравнение утекает информацию о правильном префиксе.
 *
 * HMAC-функция в модуле приватная, поэтому подписанный initData собирается
 * здесь тем же алгоритмом, что и у Telegram.
 */
import crypto from 'crypto';
import {
  validateTelegramInitData,
  extractUserFromInitData,
  generateTestInitData,
  parseInitDataUnsafe,
} from '../../../utils/telegram-auth';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

const BOT_TOKEN = '123456:AA-test-token';
const NOW_SECONDS = 1_800_000_000;
const USER = {
  id: 555,
  first_name: 'Иван',
  last_name: 'Петров',
  username: 'ivan',
  language_code: 'ru',
};

/** Собирает initData и подписывает его так же, как это делает Telegram. */
function signInitData(
  fields: Record<string, string>,
  token = BOT_TOKEN
): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return new URLSearchParams({ ...fields, hash }).toString();
}

function validInitData(
  over: {
    user?: Record<string, unknown>;
    authDate?: number;
    token?: string;
    extra?: Record<string, string>;
  } = {}
): string {
  return signInitData(
    {
      user: JSON.stringify(over.user ?? USER),
      auth_date: String(over.authDate ?? NOW_SECONDS),
      ...(over.extra ?? {}),
    },
    over.token
  );
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
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
  it('корректно подписанный initData даёт пользователя', () => {
    const user = validateTelegramInitData(validInitData());

    expect(user).toEqual({
      id: 555,
      first_name: 'Иван',
      last_name: 'Петров',
      username: 'ivan',
      language_code: 'ru',
      photo_url: undefined,
      is_premium: undefined,
      allows_write_to_pm: undefined,
    });
  });

  it('подменённый user с прежней подписью отклоняется', () => {
    const initData = validInitData();
    const tampered = initData.replace(
      encodeURIComponent('"id":555'),
      encodeURIComponent('"id":999')
    );

    expect(validateTelegramInitData(tampered)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('Telegram initData HMAC mismatch');
  });

  it('подпись чужим токеном отклоняется', () => {
    const initData = validInitData({ token: '999:BB-attacker-token' });

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('initData без hash отклоняется', () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
      auth_date: String(NOW_SECONDS),
    }).toString();

    expect(validateTelegramInitData(initData)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'InitData is missing the hash field'
    );
  });

  it.each([
    ['короткий', 'abc123'],
    ['не hex', 'z'.repeat(64)],
    ['длиннее 64', 'a'.repeat(65)],
  ])('hash %s отклоняется', (_name, hash) => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
      auth_date: String(NOW_SECONDS),
      hash,
    }).toString();

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('дополнительные поля Telegram участвуют в подписи', () => {
    const initData = validInitData({
      extra: { query_id: 'AAF', chat_type: 'private' },
    });

    expect(validateTelegramInitData(initData)).not.toBeNull();
  });

  it('без BOT_TOKEN проверка невозможна и доступ закрыт', () => {
    delete process.env.BOT_TOKEN;

    expect(validateTelegramInitData(validInitData())).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'BOT_TOKEN not found in environment variables'
    );
  });

  it('пустая строка отклоняется', () => {
    expect(validateTelegramInitData('')).toBeNull();
  });
});

describe('validateTelegramInitData: срок жизни', () => {
  it('свежий initData принимается', () => {
    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS - 60 }))
    ).not.toBeNull();
  });

  it('перехваченный час назад initData переиграть нельзя', () => {
    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS - 3600 }))
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Telegram initData timestamp is outside the allowed window'
    );
  });

  it('граница окна в 5 минут ещё принимается', () => {
    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS - 300 }))
    ).not.toBeNull();
  });

  it('небольшое расхождение часов клиента допускается', () => {
    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS + 20 }))
    ).not.toBeNull();
  });

  it('время далеко в будущем отклоняется', () => {
    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS + 600 }))
    ).toBeNull();
  });

  it('окно настраивается переменной окружения', () => {
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = '3600';

    expect(
      validateTelegramInitData(validInitData({ authDate: NOW_SECONDS - 3000 }))
    ).not.toBeNull();
  });

  it.each(['10', '99999999', 'abc', '-60', '5.5'])(
    'недопустимое значение окна %p откатывается к 5 минутам',
    raw => {
      process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = raw;

      expect(
        validateTelegramInitData(validInitData({ authDate: NOW_SECONDS - 600 }))
      ).toBeNull();
    }
  );

  it('initData без auth_date отклоняется', () => {
    const initData = signInitData({ user: JSON.stringify(USER) });

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it.each(['abc', '', '-1', '1e10'])(
    'нечисловой auth_date %p отклоняется',
    authDate => {
      const initData = signInitData({
        user: JSON.stringify(USER),
        auth_date: authDate,
      });

      expect(validateTelegramInitData(initData)).toBeNull();
    }
  );
});

describe('validateTelegramInitData: разбор пользователя', () => {
  function parsed(user: Record<string, unknown>) {
    return validateTelegramInitData(validInitData({ user }));
  }

  it('минимальный пользователь — только id и имя', () => {
    expect(parsed({ id: 1, first_name: 'Аня' })).toMatchObject({
      id: 1,
      first_name: 'Аня',
    });
  });

  it('пробелы вокруг имени срезаются', () => {
    expect(parsed({ id: 1, first_name: '  Аня  ' })?.first_name).toBe('Аня');
  });

  it.each([
    ['нулевой id', { id: 0, first_name: 'Аня' }],
    ['отрицательный id', { id: -5, first_name: 'Аня' }],
    ['дробный id', { id: 1.5, first_name: 'Аня' }],
    ['id строкой', { id: '1', first_name: 'Аня' }],
    ['без имени', { id: 1 }],
    ['пустое имя', { id: 1, first_name: '   ' }],
    ['имя не строка', { id: 1, first_name: 123 }],
  ])('%s отклоняется', (_name, user) => {
    expect(parsed(user)).toBeNull();
  });

  it('слишком длинное имя отклоняется', () => {
    expect(parsed({ id: 1, first_name: 'я'.repeat(129) })).toBeNull();
  });

  it('слишком длинный username отклоняется целиком, а не срезается', () => {
    expect(parsed({ id: 1, first_name: 'Аня', username: 'u'.repeat(65) })).toBeNull();
  });

  it('слишком длинный photo_url отклоняется', () => {
    expect(
      parsed({ id: 1, first_name: 'Аня', photo_url: `http://x/${'a'.repeat(2048)}` })
    ).toBeNull();
  });

  it('нестроковое необязательное поле отклоняется', () => {
    expect(parsed({ id: 1, first_name: 'Аня', username: 42 })).toBeNull();
  });

  it('нелогический is_premium отклоняется', () => {
    expect(parsed({ id: 1, first_name: 'Аня', is_premium: 'yes' })).toBeNull();
  });

  it('null в необязательных полях допустим', () => {
    expect(
      parsed({ id: 1, first_name: 'Аня', last_name: null, is_premium: null })
    ).toMatchObject({ id: 1, last_name: undefined, is_premium: undefined });
  });

  it('логические флаги сохраняются', () => {
    expect(
      parsed({
        id: 1,
        first_name: 'Аня',
        is_premium: true,
        allows_write_to_pm: false,
      })
    ).toMatchObject({ is_premium: true, allows_write_to_pm: false });
  });

  it('битый JSON в user отклоняется', () => {
    const initData = signInitData({
      user: '{not json',
      auth_date: String(NOW_SECONDS),
    });

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('user длиннее 4096 символов отклоняется', () => {
    const initData = validInitData({
      user: { id: 1, first_name: 'Аня', language_code: 'x'.repeat(4096) },
    });

    expect(validateTelegramInitData(initData)).toBeNull();
  });

  it('подписанный initData без поля user даёт null, а не ошибку', () => {
    const initData = signInitData({ auth_date: String(NOW_SECONDS) });

    expect(validateTelegramInitData(initData)).toBeNull();
  });
});

describe('обход проверки (SKIP_TELEGRAM_VALIDATION)', () => {
  beforeEach(() => {
    process.env.SKIP_TELEGRAM_VALIDATION = 'true';
    process.env.NODE_ENV = 'development';
  });

  it('в development неподписанный initData принимается', () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
    }).toString();

    expect(validateTelegramInitData(initData)).toMatchObject({ id: 555 });
    expect(logger.warn).toHaveBeenCalledWith(
      'SKIP_TELEGRAM_VALIDATION enabled in development'
    );
  });

  it('в production обход запрещён — вход закрыт', () => {
    process.env.NODE_ENV = 'production';
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
    }).toString();

    expect(validateTelegramInitData(initData)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'SKIP_TELEGRAM_VALIDATION is forbidden in production'
    );
  });

  it('без поля user в режиме обхода возвращается null', () => {
    expect(validateTelegramInitData('auth_date=1')).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'No user field in initData (skip mode)'
    );
  });

  it('битый user в режиме обхода не роняет запрос', () => {
    const initData = new URLSearchParams({ user: '{not json' }).toString();

    expect(validateTelegramInitData(initData)).toBeNull();
  });
});

describe('extractUserFromInitData', () => {
  it('пользователь извлекается без проверки подписи', () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
    }).toString();

    expect(extractUserFromInitData(initData)).toMatchObject({ id: 555 });
  });

  it('без поля user — null', () => {
    expect(extractUserFromInitData('auth_date=1')).toBeNull();
  });

  it('битый JSON — null, а не исключение', () => {
    const initData = new URLSearchParams({ user: '{not json' }).toString();

    expect(extractUserFromInitData(initData)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Error extracting user from initData:',
      expect.any(Error)
    );
  });
});

describe('generateTestInitData', () => {
  it('созданный initData проходит настоящую проверку', () => {
    const initData = generateTestInitData(555, 'Иван', 'ivan');

    expect(validateTelegramInitData(initData)).toMatchObject({
      id: 555,
      first_name: 'Иван',
      username: 'ivan',
    });
  });

  it('в production генератор недоступен', () => {
    process.env.NODE_ENV = 'production';

    expect(() => generateTestInitData(1, 'Иван')).toThrow(
      'generateTestInitData should not be used in production'
    );
  });

  it('без BOT_TOKEN используется тестовый токен', () => {
    delete process.env.BOT_TOKEN;

    expect(generateTestInitData(1, 'Иван')).toContain('hash=');
  });
});

describe('parseInitDataUnsafe', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('в development пользователь разбирается без подписи', () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(USER),
    }).toString();

    expect(parseInitDataUnsafe(initData)).toMatchObject({ id: 555 });
  });

  it('в production запрещён: бросает, а не возвращает пользователя', () => {
    process.env.NODE_ENV = 'production';

    expect(() => parseInitDataUnsafe('user=%7B%7D')).toThrow(
      'parseInitDataUnsafe should not be used in production'
    );
    expect(logger.error).toHaveBeenCalledWith(
      '🚨 parseInitDataUnsafe is not allowed in production'
    );
  });

  it.each(['', '   ', 'mock_jwt_token_12345678'])(
    'заглушка %p даёт null',
    initData => {
      expect(parseInitDataUnsafe(initData)).toBeNull();
    }
  );

  it('без поля user — null', () => {
    expect(parseInitDataUnsafe('auth_date=1')).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('No user data in initData');
  });

  it('битый JSON — null, а не исключение', () => {
    const initData = new URLSearchParams({ user: '{not json' }).toString();

    expect(parseInitDataUnsafe(initData)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Error parsing initData in unsafe mode',
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('невалидный пользователь отклоняется и здесь', () => {
    const initData = new URLSearchParams({
      user: JSON.stringify({ id: 0, first_name: 'Аня' }),
    }).toString();

    expect(parseInitDataUnsafe(initData)).toBeNull();
  });
});
