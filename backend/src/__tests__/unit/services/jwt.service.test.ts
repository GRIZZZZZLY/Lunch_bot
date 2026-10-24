/**
 * JWT — граница доверия Mini App. Тип токена, срок, подмена userId и
 * деактивированный пользователь проверяются на настоящем API в
 * integration/api/auth-surface.routes.test.ts. Здесь — то, что через API не
 * видно: требования к секрету, claims и issuer/audience.
 *
 * Модуль читает JWT_SECRET и NODE_ENV на импорте, поэтому каждый сценарий
 * загружает его изолированно с нужным окружением.
 */
import jwt from 'jsonwebtoken';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const SECRET = 'j'.repeat(48);
const ISSUER = 'rocket-lunch-api';
const AUDIENCE = 'rocket-lunch-mini-app';

type JwtModule = typeof import('../../../services/jwt.service');

function loadJwt(overrides: Record<string, string | undefined> = {}): JwtModule {
  const original = process.env;
  process.env = { ...original, NODE_ENV: 'test', JWT_SECRET: SECRET, ...overrides };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }

  let mod: JwtModule = null as unknown as JwtModule;
  try {
    jest.isolateModules(() => {
      mod = require('../../../services/jwt.service');
    });
  } finally {
    process.env = original;
  }
  return mod;
}

describe('секрет', () => {
  it.each<[string, Record<string, string | undefined>, RegExp]>([
    ['без JWT_SECRET модуль не загружается', { JWT_SECRET: undefined }, /JWT_SECRET is required/],
    [
      'в продакшене секрет короче 64 символов не принимается',
      { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(63) },
      /must be >=64 characters in production/,
    ],
  ])('%s', (_name, env, message) => {
    expect(() => loadJwt(env)).toThrow(message);
  });
});

describe('токены', () => {
  const service = loadJwt();

  it('access-токен подписан HS256 и несёт userId и тип', () => {
    const decoded = jwt.verify(service.generateAccessToken({ userId: 42 }), SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as Record<string, unknown>;

    expect(decoded).toMatchObject({ userId: 42, type: 'access' });
  });

  it('токен с чужим issuer или чужой audience отклоняется', () => {
    const sign = (issuer: string, audience: string) =>
      jwt.sign({ userId: 5, type: 'access' }, SECRET, { issuer, audience });

    expect(service.verifyToken(sign(ISSUER, AUDIENCE))).toMatchObject({ userId: 5 });
    expect(service.verifyToken(sign('someone-else', AUDIENCE))).toBeNull();
    expect(service.verifyToken(sign(ISSUER, 'someone-else'))).toBeNull();
  });
});
