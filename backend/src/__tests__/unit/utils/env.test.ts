/**
 * Валидация окружения на старте. Схема — единственное место, где описано,
 * какая конфигурация вообще имеет право поднять процесс, поэтому проверяем не
 * только «валидное проходит», но и каждое правило superRefine: в продакшене
 * именно они отделяют рабочий сервер от тихо небезопасного.
 */

const VALID_BASE = {
  BOT_TOKEN: '123456789:AA-bb_CC11dd22ee33ff44gg55hh66ii7',
  JWT_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

const PROD_BASE = {
  ...VALID_BASE,
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(64),
  ENCRYPTION_KEY: 'a'.repeat(64),
  REDIS_ENABLED: 'true',
  CORS_ORIGIN: 'https://app.example.com',
  WEBAPP_URL: 'https://app.example.com',
};

type EnvModule = typeof import('../../../utils/env');

/**
 * Каждый вызов — свежий модуль: `validateEnv()` кеширует результат в замыкании
 * модуля, и без isolateModules второй тест читал бы конфигурацию первого.
 *
 * Окружение обязано быть подставлено на момент ВЫЗОВА, а не импорта:
 * validateEnv() читает process.env лениво. Поэтому подмена живёт до конца
 * колбэка, а не до конца загрузки модуля.
 */
function withEnv<T>(
  overrides: Record<string, string | undefined>,
  callback: (mod: EnvModule) => T
): T {
  const original = process.env;
  process.env = { ...original, ...overrides };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    }
  }

  try {
    let mod: EnvModule = null as unknown as EnvModule;
    jest.isolateModules(() => {
      mod = require('../../../utils/env');
    });
    return callback(mod);
  } finally {
    process.env = original;
  }
}

/**
 * Полностью чистое окружение: без этого значения из .env и из jest-setup текут
 * в негативные кейсы и тест проверяет не то, что написано в его названии.
 */
function bare(
  overrides: Record<string, string | undefined>
): Record<string, string | undefined> {
  const cleared: Record<string, string | undefined> = {};
  for (const key of [
    'NODE_ENV',
    'PROCESS_ROLE',
    'BOT_TOKEN',
    'BOT_MODE',
    'BOT_WEBHOOK_URL',
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
    'TELEGRAM_BOT_USERNAME',
    'POLLING_TIMEOUT',
    'API_PORT',
    'API_BODY_LIMIT',
    'API_REQUEST_TIMEOUT_MS',
    'API_HEADERS_TIMEOUT_MS',
    'API_KEEP_ALIVE_TIMEOUT_MS',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'DATABASE_URL',
    'CORS_ORIGIN',
    'WEBAPP_URL',
    'TRUST_PROXY',
    'REDIS_ENABLED',
    'REDIS_URL',
    'ENABLE_HELMET',
    'ENABLE_RATE_LIMIT',
    'ENABLE_OPERATIONS_API',
    'OPERATIONS_API_SECRET',
    'SKIP_TELEGRAM_VALIDATION',
    'SENTRY_DSN',
    'GLITCHTIP_DSN',
    'HTTPS_PROXY',
    'SOCKS_PROXY',
  ]) {
    cleared[key] = undefined;
  }
  return { ...cleared, ...overrides };
}

/** Ожидаем, что конфигурация не проходит валидацию. */
function expectRejected(
  overrides: Record<string, string | undefined>,
  message: RegExp = /Invalid environment configuration/
): void {
  withEnv(bare(overrides), mod => {
    expect(() => mod.validateEnv()).toThrow(message);
  });
}

describe('validateEnv', () => {
  it('принимает минимально достаточную конфигурацию и подставляет значения по умолчанию', () => {
    withEnv(bare(VALID_BASE), ({ validateEnv }) => {
      const env = validateEnv();

      expect(env.NODE_ENV).toBe('development');
      expect(env.PROCESS_ROLE).toBe('full');
      expect(env.BOT_MODE).toBe('polling');
      expect(env.API_PORT).toBe(3001);
      expect(env.API_BODY_LIMIT).toBe('256kb');
      expect(env.ENABLE_HELMET).toBe(true);
      expect(env.ENABLE_RATE_LIMIT).toBe(true);
      expect(env.ENABLE_OPERATIONS_API).toBe(false);
      expect(env.REDIS_ENABLED).toBe(false);
      expect(env.SKIP_TELEGRAM_VALIDATION).toBe(false);
      expect(env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS).toBe(300);
      expect(env.TRUST_PROXY).toBe('1');
    });
  });

  it('кеширует результат: повторный вызов возвращает тот же объект', () => {
    withEnv(bare(VALID_BASE), ({ validateEnv }) => {
      expect(validateEnv()).toBe(validateEnv());
    });
  });

  it('пустая строка трактуется как отсутствующее значение, а не как невалидный URL', () => {
    withEnv(
      bare({ ...VALID_BASE, WEBAPP_URL: '   ', SENTRY_DSN: '' }),
      ({ validateEnv }) => {
        const env = validateEnv();
        expect(env.WEBAPP_URL).toBeUndefined();
        expect(env.SENTRY_DSN).toBeUndefined();
      }
    );
  });

  it('приводит числовые переменные из строк', () => {
    withEnv(
      bare({ ...VALID_BASE, API_PORT: '8080', POLLING_TIMEOUT: '15' }),
      ({ validateEnv }) => {
        const env = validateEnv();
        expect(env.API_PORT).toBe(8080);
        expect(env.POLLING_TIMEOUT).toBe(15);
      }
    );
  });

  it.each([
    ['BOT_TOKEN без двоеточия', { BOT_TOKEN: 'not-a-token' }],
    ['отсутствующий BOT_TOKEN', { BOT_TOKEN: undefined }],
    ['короткий JWT_SECRET', { JWT_SECRET: 'short' }],
    ['отсутствующий JWT_SECRET', { JWT_SECRET: undefined }],
    ['слишком короткий DATABASE_URL', { DATABASE_URL: 'x' }],
    ['ENCRYPTION_KEY не hex-64', { ENCRYPTION_KEY: 'zz' }],
    ['API_PORT вне диапазона', { API_PORT: '70000' }],
    ['неизвестный BOT_MODE', { BOT_MODE: 'carrier-pigeon' }],
    ['неизвестный API_BODY_LIMIT', { API_BODY_LIMIT: '4mb' }],
    ['неизвестный NODE_ENV', { NODE_ENV: 'staging' }],
    ['TRUST_PROXY вне допустимых значений', { TRUST_PROXY: '42' }],
  ])('отклоняет %s', (_label, override) => {
    expectRejected({ ...VALID_BASE, ...override });
  });

  it('в webhook-режиме требует URL, секрет и роль full', () => {
    expectRejected(
      { ...VALID_BASE, BOT_MODE: 'webhook', PROCESS_ROLE: 'api' },
      /3 issue\(s\)/
    );
  });

  it('в webhook-режиме проходит с полным набором параметров', () => {
    withEnv(
      bare({
        ...VALID_BASE,
        BOT_MODE: 'webhook',
        BOT_WEBHOOK_URL: 'https://bot.example.com/hook',
        TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40),
      }),
      ({ validateEnv }) => {
        expect(validateEnv().BOT_MODE).toBe('webhook');
      }
    );
  });

  it('ENABLE_OPERATIONS_API без секрета не проходит', () => {
    expectRejected(
      { ...VALID_BASE, ENABLE_OPERATIONS_API: 'true' },
      /1 issue\(s\)/
    );
  });

  it('ENABLE_OPERATIONS_API с секретом ≥32 символов проходит', () => {
    withEnv(
      bare({
        ...VALID_BASE,
        ENABLE_OPERATIONS_API: 'true',
        OPERATIONS_API_SECRET: 's'.repeat(32),
      }),
      ({ validateEnv }) => {
        expect(validateEnv().ENABLE_OPERATIONS_API).toBe(true);
      }
    );
  });

  it('короткий OPERATIONS_API_SECRET не проходит', () => {
    expectRejected({
      ...VALID_BASE,
      ENABLE_OPERATIONS_API: 'true',
      OPERATIONS_API_SECRET: 'short',
    });
  });

  it('headers-timeout обязан превышать keep-alive-timeout', () => {
    expectRejected(
      {
        ...VALID_BASE,
        API_HEADERS_TIMEOUT_MS: '6000',
        API_KEEP_ALIVE_TIMEOUT_MS: '6000',
      },
      /1 issue\(s\)/
    );
  });

  it('продакшен принимает полную безопасную конфигурацию', () => {
    withEnv(bare(PROD_BASE), ({ validateEnv }) => {
      const env = validateEnv();
      expect(env.NODE_ENV).toBe('production');
      expect(env.REDIS_ENABLED).toBe(true);
      expect(env.ENCRYPTION_KEY).toBe('a'.repeat(64));
    });
  });

  it('продакшен принимает несколько HTTPS-источников в CORS_ORIGIN', () => {
    withEnv(
      bare({
        ...PROD_BASE,
        CORS_ORIGIN: 'https://a.example.com, https://b.example.com',
      }),
      ({ validateEnv }) => {
        expect(validateEnv().CORS_ORIGIN).toContain('https://b.example.com');
      }
    );
  });

  it.each([
    ['SKIP_TELEGRAM_VALIDATION=true', { SKIP_TELEGRAM_VALIDATION: 'true' }],
    ['REDIS_ENABLED=false', { REDIS_ENABLED: 'false' }],
    ['ENABLE_HELMET=false', { ENABLE_HELMET: 'false' }],
    ['ENABLE_RATE_LIMIT=false', { ENABLE_RATE_LIMIT: 'false' }],
    ['CORS_ORIGIN=*', { CORS_ORIGIN: '*' }],
    ['CORS_ORIGIN по http', { CORS_ORIGIN: 'http://app.example.com' }],
    ['пустой CORS_ORIGIN', { CORS_ORIGIN: undefined }],
    ['WEBAPP_URL по http', { WEBAPP_URL: 'http://app.example.com' }],
    ['отсутствующий WEBAPP_URL', { WEBAPP_URL: undefined }],
    ['JWT_SECRET короче 64 символов', { JWT_SECRET: 'x'.repeat(40) }],
    ['без ENCRYPTION_KEY', { ENCRYPTION_KEY: undefined }],
  ])('продакшен отклоняет %s', (_label, override) => {
    expectRejected({ ...PROD_BASE, ...override });
  });

  it('продакшен требует HTTPS для BOT_WEBHOOK_URL', () => {
    expectRejected({
      ...PROD_BASE,
      BOT_MODE: 'webhook',
      BOT_WEBHOOK_URL: 'http://bot.example.com/hook',
      TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(40),
    });
  });
});

describe('getEnv', () => {
  it('падает, если validateEnv ещё не вызывали', () => {
    withEnv(bare(VALID_BASE), ({ getEnv }) => {
      expect(() => getEnv()).toThrow(/called before validateEnv/);
    });
  });

  it('после валидации отдаёт тот же объект', () => {
    withEnv(bare(VALID_BASE), ({ validateEnv, getEnv }) => {
      const validated = validateEnv();
      expect(getEnv()).toBe(validated);
    });
  });
});

/**
 * Одно решение про самый опасный флаг проекта.
 *
 * `SKIP_TELEGRAM_VALIDATION=true` отключает проверку подписи Telegram, то есть
 * позволяет выдать себя за любого пользователя. Правило «в production нельзя»
 * было реализовано пять раз независимо (задача 16), и расхождение между копиями
 * — это ровно та ошибка, которую здесь нечем поймать глазами.
 *
 * Решение читает `process.env` НА МОМЕНТ ВЫЗОВА, а не валидированный конфиг:
 * `validateEnv()` вызывается только в `index.ts`, а тесты, скрипты и сиды
 * выставляют флаг сами и через валидацию не проходят. Решение, которое меняет
 * форму в зависимости от того, поднимался ли процесс через `index.ts`, было бы
 * опаснее дублирования.
 */
describe('telegramValidationSkip', () => {
  it('без флага проверка подписи работает', () => {
    withEnv(bare(VALID_BASE), ({ telegramValidationSkip }) => {
      expect(telegramValidationSkip()).toBe('off');
    });
  });

  it('явный false — тоже off', () => {
    withEnv(
      bare({ ...VALID_BASE, SKIP_TELEGRAM_VALIDATION: 'false' }),
      ({ telegramValidationSkip }) => {
        expect(telegramValidationSkip()).toBe('off');
      }
    );
  });

  it('в разработке флаг разрешает пропуск', () => {
    withEnv(
      bare({ ...VALID_BASE, SKIP_TELEGRAM_VALIDATION: 'true' }),
      ({ telegramValidationSkip }) => {
        expect(telegramValidationSkip()).toBe('allowed');
      }
    );
  });

  /* Тесты и e2e-сиды включают флаг сами и работают под NODE_ENV=test —
     запрет обязан касаться production, а не любого не-development. */
  it('в тестовом окружении флаг разрешён', () => {
    withEnv(
      bare({ ...VALID_BASE, NODE_ENV: 'test', SKIP_TELEGRAM_VALIDATION: 'true' }),
      ({ telegramValidationSkip }) => {
        expect(telegramValidationSkip()).toBe('allowed');
      }
    );
  });

  it('в production флаг заблокирован', () => {
    withEnv(
      bare({ ...PROD_BASE, SKIP_TELEGRAM_VALIDATION: 'true' }),
      ({ telegramValidationSkip }) => {
        expect(telegramValidationSkip()).toBe('blocked');
      }
    );
  });

  /* Гейт в `validateEnv()` валит старт в production — но решение не имеет права
     полагаться на то, что его кто-то вызвал: в процессе без `index.ts` (скрипт,
     тестовый харнесс, отдельный воркер) валидации не было вовсе. */
  it('в production блокирует и без вызова validateEnv', () => {
    withEnv(
      bare({ ...PROD_BASE, SKIP_TELEGRAM_VALIDATION: 'true' }),
      ({ telegramValidationSkip, getEnv }) => {
        expect(() => getEnv()).toThrow(/called before validateEnv/);
        expect(telegramValidationSkip()).toBe('blocked');
      }
    );
  });

  it.each(['TRUE', 'True', '1', 'yes', ''])(
    'значение %p не включает пропуск',
    value => {
      withEnv(
        bare({ ...VALID_BASE, SKIP_TELEGRAM_VALIDATION: value }),
        ({ telegramValidationSkip }) => {
          expect(telegramValidationSkip()).toBe('off');
        }
      );
    }
  );

  /* Значение читается на каждый вызов: наборы тестов переключают флаг в
     `beforeEach`, и закешированное решение сделало бы половину из них
     бессмысленными. */
  it('решение перечитывается на каждый вызов', () => {
    withEnv(bare(VALID_BASE), ({ telegramValidationSkip }) => {
      expect(telegramValidationSkip()).toBe('off');

      process.env.SKIP_TELEGRAM_VALIDATION = 'true';
      expect(telegramValidationSkip()).toBe('allowed');

      process.env.NODE_ENV = 'production';
      expect(telegramValidationSkip()).toBe('blocked');
    });
  });
});
