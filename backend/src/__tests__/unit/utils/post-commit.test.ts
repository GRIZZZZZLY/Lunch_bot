/**
 * Действия после фиксации доменной операции.
 *
 * Свойство, которое здесь закреплено: сбой отправки в Telegram НЕ становится
 * ошибкой уже сохранённой операции, но и не пропадает бесследно — он попадает
 * в журнал с категорией, по которой видно, поможет ли повтор.
 *
 * Отдельно закреплена безопасность журнала: в сообщении сетевой ошибки может
 * лежать URL запроса к Telegram, а в нём — токен бота. Ни `message`, ни
 * `description`, ни стек в диагностику не попадают.
 */
import {
  classifyDeliveryError,
  runAfterCommit,
} from '../../../utils/post-commit';
import { logger } from '../../../utils/logger';
import { asServiceMock } from '../../helpers/mocks';

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const log = asServiceMock(logger);

/** Ошибка Telegram в том виде, в каком её отдаёт grammy. */
function telegramError(
  errorCode: number,
  extra: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error('Telegram API error'), {
    error_code: errorCode,
    description: 'Forbidden: bot was blocked by the user',
    ...extra,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('classifyDeliveryError', () => {
  it('403 — адресат заблокировал бота, повтор не поможет', () => {
    expect(classifyDeliveryError(telegramError(403))).toEqual({
      category: 'blocked_by_recipient',
      permanent: true,
      errorCode: 403,
    });
  });

  it('400 — постоянная ошибка запроса', () => {
    expect(classifyDeliveryError(telegramError(400))).toEqual({
      category: 'bad_request',
      permanent: true,
      errorCode: 400,
    });
  });

  it('429 — лимит, повтор поможет, retry_after сохраняется', () => {
    const error = telegramError(429, { parameters: { retry_after: 17 } });
    expect(classifyDeliveryError(error)).toEqual({
      category: 'rate_limited',
      permanent: false,
      errorCode: 429,
      retryAfterSeconds: 17,
    });
  });

  it('429 без retry_after остаётся временной ошибкой', () => {
    const failure = classifyDeliveryError(telegramError(429));
    expect(failure.category).toBe('rate_limited');
    expect(failure.permanent).toBe(false);
    expect(failure.retryAfterSeconds).toBeUndefined();
  });

  it('5xx — Telegram недоступен, повтор поможет', () => {
    expect(classifyDeliveryError(telegramError(502))).toEqual({
      category: 'telegram_unavailable',
      permanent: false,
      errorCode: 502,
    });
  });

  it('сетевая ошибка распознаётся по коду Node', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    expect(classifyDeliveryError(error)).toEqual({
      category: 'network',
      permanent: false,
      networkCode: 'ECONNREFUSED',
    });
  });

  it('неизвестная ошибка не объявляется постоянной', () => {
    expect(classifyDeliveryError(new Error('boom'))).toEqual({
      category: 'unknown',
      permanent: false,
    });
  });

  it('не падает на не-объектах', () => {
    expect(classifyDeliveryError(undefined).category).toBe('unknown');
    expect(classifyDeliveryError(null).category).toBe('unknown');
    expect(classifyDeliveryError('строка').category).toBe('unknown');
  });

  /* Главное свойство безопасности: диагностика собирается по белому списку
     полей, а не из текста ошибки. */
  it('в диагностику не попадают текст ошибки, description и стек', () => {
    const error = Object.assign(
      new Error('https://api.telegram.org/bot123456:SECRET-TOKEN/sendMessage'),
      { error_code: 400, description: 'Bad Request: chat not found' }
    );
    const failure = classifyDeliveryError(error);
    const serialized = JSON.stringify(failure);

    expect(serialized).not.toContain('SECRET-TOKEN');
    expect(serialized).not.toContain('api.telegram.org');
    expect(serialized).not.toContain('chat not found');
    expect(Object.keys(failure).sort()).toEqual([
      'category',
      'errorCode',
      'permanent',
    ]);
  });

  it('код сетевой ошибки не той формы отбрасывается', () => {
    const error = Object.assign(new Error('fail'), {
      code: 'https://api.telegram.org/bot123:TOKEN/sendMessage',
    });
    const failure = classifyDeliveryError(error);
    expect(failure.category).toBe('unknown');
    expect(failure.networkCode).toBeUndefined();
  });
});

describe('runAfterCommit', () => {
  it('успех возвращает true и ничего не пишет в журнал', async () => {
    const run = jest.fn().mockResolvedValue(undefined);

    await expect(runAfterCommit('test.action', { txId: 1 }, run)).resolves.toBe(
      true
    );
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('сбой возвращает false, а не бросает', async () => {
    const run = jest.fn().mockRejectedValue(telegramError(403));

    await expect(runAfterCommit('test.action', { txId: 7 }, run)).resolves.toBe(
      false
    );
  });

  it('постоянный отказ адресата — warn: человек заблокировал бота', async () => {
    await runAfterCommit('test.action', { txId: 7 }, () =>
      Promise.reject(telegramError(403))
    );

    expect(log.warn).toHaveBeenCalledWith(
      'Post-commit action failed: test.action',
      expect.objectContaining({
        txId: 7,
        category: 'blocked_by_recipient',
        permanent: true,
        errorCode: 403,
      })
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it('временный сбой — error: уведомление потеряно из-за инфраструктуры', async () => {
    await runAfterCommit('test.action', { pollId: 5 }, () =>
      Promise.reject(telegramError(503))
    );

    expect(log.error).toHaveBeenCalledWith(
      'Post-commit action failed: test.action',
      expect.objectContaining({
        pollId: 5,
        category: 'telegram_unavailable',
        permanent: false,
      })
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('в журнал не уходит текст ошибки с токеном бота', async () => {
    const leaky = Object.assign(
      new Error('request to https://api.telegram.org/bot42:LEAKED/sendMessage failed'),
      { code: 'ECONNRESET' }
    );

    await runAfterCommit('test.action', { txId: 3 }, () => Promise.reject(leaky));

    const logged = JSON.stringify(log.error.mock.calls);
    expect(logged).not.toContain('LEAKED');
    expect(logged).not.toContain('api.telegram.org');
    expect(logged).toContain('ECONNRESET');
  });
});
