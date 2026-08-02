/**
 * JWT — граница доверия Mini App: подпись, issuer, audience и тип токена.
 * Модуль читает JWT_SECRET и NODE_ENV на импорте и падает на слабом секрете,
 * поэтому каждый сценарий загружает его изолированно с нужным окружением.
 */
import jwt from 'jsonwebtoken';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const SECRET = 'j'.repeat(48);
const ISSUER = 'rocket-lunch-api';
const AUDIENCE = 'rocket-lunch-mini-app';

type JwtModule = typeof import('../../../services/jwt.service');

/**
 * isolateModules заводит собственный реестр модулей, поэтому сервис получает
 * СВОЙ экземпляр jsonwebtoken. Отдаём его наружу: без этого jest.spyOn на
 * импортированном сверху `jwt` не влиял бы на проверяемый код, и тесты путей
 * ошибок молча проходили бы, ничего не проверяя.
 */
function loadJwtWithLib(overrides: Record<string, string | undefined> = {}): {
  mod: JwtModule;
  jwtLib: typeof jwt;
} {
  const original = process.env;
  process.env = {
    ...original,
    NODE_ENV: 'test',
    JWT_SECRET: SECRET,
    ...overrides,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    }
  }

  let mod: JwtModule = null as unknown as JwtModule;
  let jwtLib: typeof jwt = jwt;
  try {
    jest.isolateModules(() => {
      mod = require('../../../services/jwt.service');
      jwtLib = require('jsonwebtoken');
    });
  } finally {
    process.env = original;
  }
  return { mod, jwtLib };
}

function loadJwt(overrides: Record<string, string | undefined> = {}): JwtModule {
  return loadJwtWithLib(overrides).mod;
}

describe('конфигурация модуля', () => {
  it('без JWT_SECRET модуль не загружается', () => {
    expect(() => loadJwt({ JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET is required/
    );
  });

  it('пробелы вместо секрета считаются отсутствием секрета', () => {
    expect(() => loadJwt({ JWT_SECRET: '    ' })).toThrow(
      /JWT_SECRET is required/
    );
  });

  it('в продакшене секрет короче 64 символов не принимается', () => {
    expect(() =>
      loadJwt({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(63) })
    ).toThrow(/must be >=64 characters in production/);
  });

  it('в продакшене секрет от 64 символов принимается', () => {
    expect(() =>
      loadJwt({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(64) })
    ).not.toThrow();
  });

  it('вне продакшена короткий секрет проходит с предупреждением', () => {
    const { logger } = require('../../../utils/logger');
    logger.warn.mockClear();

    expect(() => loadJwt({ JWT_SECRET: 'x'.repeat(20) })).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('JWT_SECRET is too short')
    );
  });
});

describe('генерация токенов', () => {
  const service = loadJwt();

  it('access-токен подписан HS256 и несёт корректные claims', () => {
    const token = service.generateAccessToken({ userId: 42 });
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as Record<string, unknown>;

    expect(decoded.userId).toBe(42);
    expect(decoded.type).toBe('access');
    expect(decoded.jti).toEqual(expect.any(String));
  });

  it('refresh-токен помечен своим типом и живёт дольше access', () => {
    const access = service.generateAccessToken({ userId: 7 });
    const refresh = service.generateRefreshToken({ userId: 7 });

    const accessExp = service.getTokenExpiration(access)!.getTime();
    const refreshExp = service.getTokenExpiration(refresh)!.getTime();

    expect(service.decodeToken(refresh)!.type).toBe('refresh');
    expect(refreshExp).toBeGreaterThan(accessExp);
  });

  it('пара токенов содержит оба вида', () => {
    const { accessToken, refreshToken } = service.generateTokenPair({
      userId: 11,
    });

    expect(service.isAccessToken(accessToken)).toBe(true);
    expect(service.isRefreshToken(accessToken)).toBe(false);
    expect(service.isRefreshToken(refreshToken)).toBe(true);
    expect(service.isAccessToken(refreshToken)).toBe(false);
  });

  it('ошибка подписи превращается в понятное исключение', () => {
    const { mod, jwtLib } = loadJwtWithLib();
    const signSpy = jest.spyOn(jwtLib, 'sign').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => mod.generateAccessToken({ userId: 1 })).toThrow(
      'Token generation failed'
    );
    expect(() => mod.generateRefreshToken({ userId: 1 })).toThrow(
      'Refresh token generation failed'
    );

    signSpy.mockRestore();
  });
});

describe('verifyToken', () => {
  const service = loadJwt();

  it('возвращает payload для валидного токена', () => {
    const token = service.generateAccessToken({ userId: 5 });
    expect(service.verifyToken(token)).toMatchObject({
      userId: 5,
      type: 'access',
    });
  });

  it('отклоняет токен, подписанный другим секретом', () => {
    const foreign = jwt.sign({ userId: 5, type: 'access' }, 'other-secret', {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(service.verifyToken(foreign)).toBeNull();
  });

  it('отклоняет истёкший токен', () => {
    const expired = jwt.sign({ userId: 5, type: 'access' }, SECRET, {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '-10s',
    });
    expect(service.verifyToken(expired)).toBeNull();
  });

  it('отклоняет чужой issuer и чужую audience', () => {
    const wrongIssuer = jwt.sign({ userId: 5, type: 'access' }, SECRET, {
      issuer: 'someone-else',
      audience: AUDIENCE,
    });
    const wrongAudience = jwt.sign({ userId: 5, type: 'access' }, SECRET, {
      issuer: ISSUER,
      audience: 'someone-else',
    });

    expect(service.verifyToken(wrongIssuer)).toBeNull();
    expect(service.verifyToken(wrongAudience)).toBeNull();
  });

  it.each([
    ['userId не целое', { userId: 1.5, type: 'access' }],
    ['userId ≤ 0', { userId: 0, type: 'access' }],
    ['неизвестный тип', { userId: 1, type: 'session' }],
  ])('отклоняет валидно подписанный токен, если %s', (_label, payload) => {
    const token = jwt.sign(payload, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(service.verifyToken(token)).toBeNull();
  });

  it('неожиданная ошибка проверки тоже даёт null, а не исключение', () => {
    const { mod, jwtLib } = loadJwtWithLib();
    const verifySpy = jest.spyOn(jwtLib, 'verify').mockImplementation(() => {
      throw new Error('unexpected');
    });

    expect(mod.verifyToken('whatever')).toBeNull();

    verifySpy.mockRestore();
  });
});

describe('чтение токена без проверки подписи', () => {
  const service = loadJwt();

  it('decodeToken читает payload подделанного токена', () => {
    const forged = jwt.sign({ userId: 99, type: 'access' }, 'not-our-secret');
    expect(service.decodeToken(forged)).toMatchObject({ userId: 99 });
  });

  it('decodeToken возвращает null на мусоре', () => {
    expect(service.decodeToken('не токен')).toBeNull();
  });

  it('isTokenExpiringSoon: true для токена на час, false для семидневного', () => {
    const access = service.generateAccessToken({ userId: 1 });
    const refresh = service.generateRefreshToken({ userId: 1 });

    expect(service.isTokenExpiringSoon(access)).toBe(true);
    expect(service.isTokenExpiringSoon(refresh)).toBe(false);
  });

  it('isTokenExpiringSoon: false, если срока в токене нет', () => {
    const noExp = jwt.sign({ userId: 1, type: 'access' }, SECRET);
    expect(service.isTokenExpiringSoon(noExp)).toBe(false);
    expect(service.isTokenExpiringSoon('мусор')).toBe(false);
  });

  it('getTokenExpiration возвращает null без срока', () => {
    const noExp = jwt.sign({ userId: 1, type: 'access' }, SECRET);
    expect(service.getTokenExpiration(noExp)).toBeNull();
    expect(service.getTokenExpiration('мусор')).toBeNull();
  });

  it('фасад JwtService выставляет тот же набор функций', () => {
    expect(Object.keys(service.JwtService).sort()).toEqual(
      [
        'decodeToken',
        'generateAccessToken',
        'generateRefreshToken',
        'generateTokenPair',
        'getTokenExpiration',
        'isAccessToken',
        'isRefreshToken',
        'isTokenExpiringSoon',
        'verifyToken',
      ].sort()
    );
  });
});
