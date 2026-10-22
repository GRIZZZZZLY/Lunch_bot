import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '../apiError';

const FALLBACK = 'Не удалось создать закупку';
const CYRILLIC = /[А-Яа-яЁё]/;

describe('apiErrorMessage', () => {
  /* Тексты словаря не сверяются: проверяется, что код распознан (причина
     своя, а не запасная), понятна по-русски и английский текст сервера не
     просочился. */
  it.each([
    'ACTIVE_RUN_EXISTS',
    'POLL_ALREADY_ACTIVE',
    'NOT_ENOUGH_ITEMS',
    'GROUP_NOT_FOUND',
    'INVALID_DURATION',
    'BOT_NOT_AVAILABLE',
    // Из класса AuthorizationError через error-handler — не литерал, легко потерять.
    'AUTHORIZATION_ERROR',
    'INVALID_QUERY',
    // Лимитер без серверного текста всё равно объясняется словарём.
    'POLL_CREATION_LIMIT',
  ])('код %s получает свою причину, а не запасной текст', code => {
    const message = apiErrorMessage({ code, error: 'Something failed' }, FALLBACK);

    expect(message).not.toBe(FALLBACK);
    expect(message).toMatch(CYRILLIC);
    expect(message).not.toContain('Something');
  });

  it('не показывает английский текст с сервера', () => {
    const message = apiErrorMessage({ error: 'Group already has an active poll' }, FALLBACK);
    expect(message).toBe(FALLBACK);
  });

  it('русское сообщение сервера отдаёт как есть', () => {
    expect(
      apiErrorMessage({ code: 'UNKNOWN_CODE', message: 'Заголовок Idempotency-Key обязателен.' }, FALLBACK),
    ).toBe('Заголовок Idempotency-Key обязателен.');
  });

  it.each([403, 429])('статус %s без кода объясняется, а не запасным текстом', status => {
    const message = apiErrorMessage({ status }, FALLBACK);

    expect(message).not.toBe(FALLBACK);
    expect(message).toMatch(CYRILLIC);
  });

  it('голый axios-error разбирается так же, как тело ответа', () => {
    const message = apiErrorMessage({ response: { data: { code: 'FORBIDDEN' } } }, FALLBACK);

    expect(message).not.toBe(FALLBACK);
    expect(message).toBe(apiErrorMessage({ code: 'FORBIDDEN' }, FALLBACK));
  });

  it('Error отдаёт своё сообщение, мусор — запасной текст', () => {
    expect(apiErrorMessage(new Error('boom'), FALLBACK)).toBe('boom');
    expect(apiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage('строка', FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage({ status: 418 }, FALLBACK)).toBe(FALLBACK);
  });
});

/**
 * Записи, добавленные при заведении словаря кодов (задача 03). Проверяется не
 * каждая из 93 — только те, где легко ошибиться: приоритет серверного текста и
 * коды, приходящие не литералом, а через классы ошибок бэкенда.
 */
describe('словарь кодов после задачи 03', () => {
  const FALLBACK = 'Не удалось';

  /* Ограничители частоты присылают в message конкретное время ожидания.
     Словарная фраза «подождите немного» его бы скрыла, поэтому для этих
     кодов серверный текст имеет приоритет. */
  it.each([
    'AUTH_RATE_LIMIT',
    'POLL_CREATION_LIMIT',
    'REMINDER_RATE_LIMIT',
    'RATE_LIMIT_EXCEEDED',
  ])('%s: серверный текст со временем ожидания важнее словарного', code => {
    expect(
      apiErrorMessage(
        { code, message: 'Достигнут лимит. Подождите час.' },
        FALLBACK
      )
    ).toBe('Достигнут лимит. Подождите час.');
  });

  /* Приходит из union-типа StoreRunError, а не литералом — однажды остался без
     текста именно потому, что его не нашли поиском. */
  it('INVALID_INPUT из StoreRunError имеет текст', () => {
    expect(apiErrorMessage({ code: 'INVALID_INPUT' }, FALLBACK)).not.toBe(
      FALLBACK
    );
  });

  it('неизвестный код по-прежнему отдаёт запасной текст', () => {
    expect(apiErrorMessage({ code: 'НЕ_СУЩЕСТВУЕТ' }, FALLBACK)).toBe(FALLBACK);
  });
});
