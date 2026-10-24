/**
 * Фильтр персональных данных перед отправкой в Sentry/GlitchTip.
 *
 * Это единственная преграда между приложением и СТОРОННИМ сервисом. В отчёт об
 * ошибке попадает контекст запроса: тело, заголовки, адрес, окружение,
 * пользователь — то есть номера карт, телефоны, telegramId и токены. Если
 * фильтр перестанет фильтровать, приложение не изменит поведения ни на йоту:
 * узнать об утечке можно будет только в Sentry.
 *
 * Поэтому проверяется ОТСУТСТВИЕ самих значений во всём сериализованном
 * событии. `beforeSend` не экспортируется — тест забирает его из аргументов
 * замоканного Sentry.init.
 */
import * as Sentry from '@sentry/node';
import { initSentry } from '../../../config/sentry.config';

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

const CARD = '2200123456789012';
const PHONE = '+79990001122';
const TOKEN = '123456:AA-super-secret-bot-token';
const INIT_DATA = 'query_id=AAF&user=%7B%22id%22%3A555%7D&hash=abc';

type SentryEvent = Record<string, unknown>;
type BeforeSend = (event: SentryEvent) => SentryEvent | null;

it('карта, телефон, токены, initData и имена не уходят наружу ни из одной части события', () => {
  const envBackup = { ...process.env };
  process.env.ENABLE_SENTRY = 'true';
  process.env.SENTRY_DSN = 'https://key@sentry.example.com/1';
  process.env.NODE_ENV = 'production';
  try {
    initSentry();
  } finally {
    process.env = envBackup;
  }
  const beforeSend = (jest.mocked(Sentry.init).mock.calls[0]?.[0] as unknown as { beforeSend: BeforeSend })
    .beforeSend;

  const event = beforeSend({
    request: {
      url: `https://app.example.com/api/avatar/x?sig=${TOKEN}`,
      headers: { authorization: `Bearer ${TOKEN}`, 'x-telegram-init-data': INIT_DATA, 'user-agent': 'TelegramBot' },
      data: { paymentCard: CARD, paymentPhone: PHONE, amount: 250 },
    },
    extra: {
      order: { participant: { user: { PaymentCard: CARD, firstName: 'Иван' } } },
      debtors: [{ telegramId: '555777', phone: PHONE }],
      initData: INIT_DATA,
    },
    contexts: { runtime: { env: { BOT_TOKEN: TOKEN, NODE_ENV: 'production' } } },
    user: { id: '7', username: 'ivan_secret', email: 'ivan@example.com' },
  });

  const serialized = JSON.stringify(event);
  for (const secret of [CARD, PHONE, TOKEN, INIT_DATA, 'Иван', '555777', 'ivan_secret', 'ivan@example.com']) {
    expect(serialized).not.toContain(secret);
  }
  // Полезный контекст остаётся — иначе отчёт бесполезен.
  expect(serialized).toContain('250');
  expect(serialized).toContain('TelegramBot');
});
