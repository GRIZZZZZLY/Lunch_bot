/**
 * Фильтр персональных данных перед отправкой в Sentry/GlitchTip.
 *
 * Это единственная преграда между приложением и СТОРОННИМ сервисом. В отчёт об
 * ошибке попадает контекст запроса: тело, заголовки, окружение, пользователь —
 * то есть номера карт, телефоны, telegramId и токены. Если фильтр перестанет
 * фильтровать, приложение не изменит поведения ни на йоту: ошибки продолжат
 * уходить, отчёты приходить, тесты (кроме этих) — проходить. Узнать об утечке
 * можно будет только одним способом: открыть Sentry и увидеть там чужую карту.
 *
 * Поэтому проверяется не «вернулась строка [Filtered]», а ОТСУТСТВИЕ самих
 * значений в том, что уходит наружу: ищем номер карты, телефон и токен по всему
 * сериализованному событию.
 *
 * `beforeSend` не экспортируется — он передаётся внутрь Sentry.init, поэтому
 * тест забирает его из аргументов замоканного init и вызывает напрямую.
 */
import * as Sentry from '@sentry/node';
import {
  initSentry,
  captureException,
  captureMessage,
  setUserContext,
  clearUserContext,
} from '../../../config/sentry.config';
import { asMock } from '../../helpers/mocks';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: jest.fn(() => ({ name: 'ProfilingIntegration' })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

/** Значения, которых не должно быть в исходящем событии ни при каком раскладе. */
const CARD = '2200123456789012';
const PHONE = '+79990001122';
const TOKEN = '123456:AA-super-secret-bot-token';

type SentryEvent = Record<string, unknown>;
type BeforeSend = (event: SentryEvent) => SentryEvent | null;

/** Поднимает Sentry и отдаёт beforeSend, переданный в init. */
function loadBeforeSend(): BeforeSend {
  initSentry();
  const options = asMock(Sentry.init).mock.calls[0]?.[0] as
    | { beforeSend?: BeforeSend }
    | undefined;
  if (!options?.beforeSend) {
    throw new Error('Sentry.init был вызван без beforeSend');
  }
  return options.beforeSend;
}

function initOptions(): Record<string, unknown> {
  return asMock(Sentry.init).mock.calls[0][0] as Record<string, unknown>;
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  jest.clearAllMocks();
  envBackup = { ...process.env };

  process.env.ENABLE_SENTRY = 'true';
  process.env.SENTRY_DSN = 'https://key@sentry.example.com/1';
  process.env.NODE_ENV = 'production';
  delete process.env.GLITCHTIP_DSN;
  delete process.env.ENABLE_GLITCHTIP;
  delete process.env.SENTRY_RELEASE;
  delete process.env.GIT_COMMIT_SHA;
});

afterEach(() => {
  process.env = envBackup;
});

describe('фильтр: чувствительные значения не уходят наружу', () => {
  it('номер карты, телефон и токен вырезаются из тела запроса', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      request: {
        data: {
          paymentCard: CARD,
          paymentPhone: PHONE,
          amount: 250,
        },
      },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(CARD);
    expect(serialized).not.toContain(PHONE);
    // Полезный контекст остаётся — иначе отчёт бесполезен.
    expect(serialized).toContain('250');
  });

  it('вложенность обходится целиком, а не только верхний уровень', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      extra: {
        order: {
          participant: {
            user: { paymentCard: CARD, firstName: 'Иван' },
          },
        },
      },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(CARD);
    expect(serialized).not.toContain('Иван');
  });

  it('элементы массивов чистятся так же, как объекты', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      extra: {
        debtors: [
          { telegramId: '555', paymentPhone: PHONE },
          { telegramId: '666', paymentCard: CARD },
        ],
      },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(PHONE);
    expect(serialized).not.toContain(CARD);
    expect(serialized).not.toContain('555');
  });

  it.each([
    'authorization',
    'cookie',
    'set-cookie',
    'accessToken',
    'refresh_token',
    'clientSecret',
    'password',
    'initData',
    'initDataUnsafe',
    'telegramId',
    'chatId',
    'username',
    'firstName',
    'lastName',
    'photoUrl',
    'paymentCard',
    'paymentPhone',
    'paymentDetails',
    'payment',
    'phone',
    'cardNumber',
    'invoicePayload',
    'telegramChargeId',
  ])('поле %s не проходит наружу', field => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({ extra: { [field]: 'СЕКРЕТ-НАРУЖУ' } });

    expect(JSON.stringify(event)).not.toContain('СЕКРЕТ-НАРУЖУ');
  });

  it('регистр в имени поля не спасает от фильтра', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      extra: { PaymentCard: CARD, TELEGRAMID: '555', Authorization: TOKEN },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(CARD);
    expect(serialized).not.toContain('555');
    expect(serialized).not.toContain(TOKEN);
  });

  it('безобидные поля сохраняются — иначе отчёт нечитаем', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      extra: { pollId: 42, code: 'POLL_NOT_FOUND', durationMs: 15 },
    });

    expect((event as { extra: Record<string, unknown> }).extra).toEqual({
      pollId: 42,
      code: 'POLL_NOT_FOUND',
      durationMs: 15,
    });
  });

  it('слишком глубокая структура обрезается, а не роняет отправку', () => {
    const beforeSend = loadBeforeSend();
    // 12 уровней: глубже восьмого фильтр подставляет заглушку.
    let deep: Record<string, unknown> = { paymentCard: CARD };
    for (let i = 0; i < 12; i++) deep = { nested: deep };

    const event = beforeSend({ extra: deep });

    const serialized = JSON.stringify(event);
    expect(serialized).toContain('[Truncated]');
    expect(serialized).not.toContain(CARD);
  });

  it('null и примитивы проходят без изменений', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      extra: { nothing: null, count: 0, flag: false, text: 'ок' },
    });

    expect((event as { extra: Record<string, unknown> }).extra).toEqual({
      nothing: null,
      count: 0,
      flag: false,
      text: 'ок',
    });
  });
});

describe('фильтр: заголовки, адрес и окружение', () => {
  it.each([
    'authorization',
    'cookie',
    'set-cookie',
    'x-telegram-bot-token',
    'x-telegram-init-data',
    'x-telegram-bot-api-secret-token',
    'idempotency-key',
  ])('заголовок %s удаляется', header => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      request: { headers: { [header]: TOKEN, 'user-agent': 'TelegramBot' } },
    });

    const headers = (event as { request: { headers: Record<string, unknown> } })
      .request.headers;
    expect(headers).not.toHaveProperty(header);
    // Безобидные заголовки остаются.
    expect(headers['user-agent']).toBe('TelegramBot');
  });

  it('query-строка срезается: там ездят подписи и initData', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      request: { url: 'https://app.example.com/api/avatar/x?sig=abc&exp=123' },
    });

    expect((event as { request: { url: string } }).request.url).toBe(
      'https://app.example.com/api/avatar/x'
    );
  });

  it.each([
    'TELEGRAM_BOT_TOKEN',
    'BOT_TOKEN',
    'JWT_SECRET',
    'DATABASE_URL',
    'SENTRY_DSN',
    'GLITCHTIP_DSN',
    'REDIS_URL',
    'DB_PASSWORD',
  ])('переменная окружения %s удаляется', key => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      contexts: { runtime: { env: { [key]: TOKEN, NODE_ENV: 'production' } } },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).toContain('production');
  });

  it('событие без запроса и контекста не роняет фильтр', () => {
    const beforeSend = loadBeforeSend();

    expect(() => beforeSend({ message: 'boom' })).not.toThrow();
  });
});

describe('фильтр: пользователь', () => {
  it('от пользователя остаётся только id', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({
      user: {
        id: '7',
        username: 'ivan',
        email: 'ivan@example.com',
        ip_address: '10.0.0.5',
      },
    });

    expect((event as { user: unknown }).user).toEqual({ id: '7' });
  });

  it('пользователь без id убирается целиком', () => {
    const beforeSend = loadBeforeSend();

    const event = beforeSend({ user: { username: 'ivan' } });

    expect((event as { user: unknown }).user).toBeUndefined();
  });
});

describe('initSentry: включение', () => {
  it('по умолчанию выключен — ни одного вызова наружу', () => {
    delete process.env.ENABLE_SENTRY;

    initSentry();

    expect(asMock(Sentry.init)).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Error tracking (Sentry/GlitchTip) отключен'
    );
  });

  it('включённый без DSN не инициализируется', () => {
    delete process.env.SENTRY_DSN;

    initSentry();

    expect(asMock(Sentry.init)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('не установлен')
    );
  });

  it('GlitchTip включается своим флагом и своим DSN', () => {
    delete process.env.ENABLE_SENTRY;
    delete process.env.SENTRY_DSN;
    process.env.ENABLE_GLITCHTIP = 'true';
    process.env.GLITCHTIP_DSN = 'https://key@glitchtip.example.com/1';

    initSentry();

    expect(asMock(Sentry.init)).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('GlitchTip')
    );
  });

  it('в production частота выборки снижена — иначе трассы съедают квоту', () => {
    initSentry();

    expect(initOptions()).toMatchObject({
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      environment: 'production',
    });
  });

  it('вне production собирается всё', () => {
    process.env.NODE_ENV = 'development';

    initSentry();

    expect(initOptions()).toMatchObject({
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
    });
  });

  it('release берётся из SENTRY_RELEASE в первую очередь', () => {
    process.env.SENTRY_RELEASE = 'abc1234';
    process.env.GIT_COMMIT_SHA = 'def5678';

    initSentry();

    expect(initOptions().release).toBe('abc1234');
  });

  it('без SENTRY_RELEASE берётся SHA коммита', () => {
    process.env.GIT_COMMIT_SHA = 'def5678';

    initSentry();

    expect(initOptions().release).toBe('def5678');
  });

  it('шумные ошибки не отправляются вовсе', () => {
    initSentry();

    const patterns = (initOptions().ignoreErrors as RegExp[]).map(String);
    expect(patterns.join(' ')).toMatch(/ETIMEDOUT/);
    expect(patterns.join(' ')).toMatch(/ECONNRESET/);
  });
});

describe('ручная отправка', () => {
  it('исключение уходит только при включённом трекере, но логируется всегда', () => {
    delete process.env.ENABLE_SENTRY;

    captureException(new Error('boom'), { pollId: 5 });

    expect(asMock(Sentry.captureException)).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Exception captured:',
      expect.objectContaining({ error: 'boom' })
    );
  });

  it('при включённом трекере исключение уходит с контекстом', () => {
    captureException(new Error('boom'), { pollId: 5 });

    expect(asMock(Sentry.captureException)).toHaveBeenCalledWith(
      expect.any(Error),
      { extra: { pollId: 5 } }
    );
  });

  it('сообщение уходит с уровнем', () => {
    captureMessage('деньги разошлись', 'warning', { pollId: 5 });

    expect(asMock(Sentry.captureMessage)).toHaveBeenCalledWith(
      'деньги разошлись',
      { level: 'warning', extra: { pollId: 5 } }
    );
  });

  it('выключенный трекер сообщение не отправляет', () => {
    delete process.env.ENABLE_SENTRY;

    captureMessage('деньги разошлись');

    expect(asMock(Sentry.captureMessage)).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('деньги разошлись'),
      undefined
    );
  });

  it('в контекст пользователя уходит только id, без username', () => {
    setUserContext(7, 'ivan');

    expect(asMock(Sentry.setUser)).toHaveBeenCalledWith({ id: '7' });
  });

  it('контекст пользователя очищается', () => {
    clearUserContext();

    expect(asMock(Sentry.setUser)).toHaveBeenCalledWith(null);
  });

  it('выключенный трекер контекст не ставит', () => {
    delete process.env.ENABLE_SENTRY;

    setUserContext(7);
    clearUserContext();

    expect(asMock(Sentry.setUser)).not.toHaveBeenCalled();
  });
});
