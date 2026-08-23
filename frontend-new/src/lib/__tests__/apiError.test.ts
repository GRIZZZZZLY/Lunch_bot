import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from '../apiError';

const FALLBACK = 'Не удалось создать закупку';

describe('apiErrorMessage', () => {
  it('переводит код бэкенда в понятную причину', () => {
    expect(apiErrorMessage({ code: 'ACTIVE_RUN_EXISTS', error: 'You already have an active store run' }, FALLBACK)).toBe(
      'У вас уже есть активная закупка.',
    );
    expect(apiErrorMessage({ code: 'POLL_ALREADY_ACTIVE' }, 'Не удалось создать опрос')).toBe(
      'В этой группе уже идёт голосование.',
    );
  });

  it('знает коды создания опроса из webapp', () => {
    const fallback = 'Не удалось создать опрос';
    expect(apiErrorMessage({ code: 'NOT_ENOUGH_ITEMS' }, fallback)).toBe(
      'Для голосования нужно минимум два активных блюда в меню.',
    );
    expect(apiErrorMessage({ code: 'GROUP_NOT_FOUND' }, fallback)).toBe(
      'Группа не найдена — проверьте, что бот ещё в чате.',
    );
    expect(apiErrorMessage({ code: 'INVALID_DURATION' }, fallback)).toBe(
      'Недопустимая длительность голосования.',
    );
    expect(apiErrorMessage({ code: 'BOT_NOT_AVAILABLE' }, fallback)).toBe(
      'Бот сейчас недоступен. Попробуйте через минуту.',
    );
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

  it('падает на статус, когда кода нет', () => {
    expect(apiErrorMessage({ status: 403 }, FALLBACK)).toBe('Недостаточно прав для этого действия.');
    expect(apiErrorMessage({ status: 429 }, FALLBACK)).toBe('Слишком много запросов. Подождите немного.');
  });

  it('разбирает голый axios-error', () => {
    expect(apiErrorMessage({ response: { data: { code: 'FORBIDDEN' } } }, FALLBACK)).toBe(
      'Недостаточно прав для этого действия.',
    );
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

  it('без серверного текста лимитер всё равно объясняется словарём', () => {
    expect(apiErrorMessage({ code: 'POLL_CREATION_LIMIT' }, FALLBACK)).toContain(
      'голосован'
    );
  });

  /* Приходит из union-типа StoreRunError, а не литералом — однажды остался без
     текста именно потому, что его не нашли поиском. */
  it('INVALID_INPUT из StoreRunError имеет текст', () => {
    expect(apiErrorMessage({ code: 'INVALID_INPUT' }, FALLBACK)).not.toBe(
      FALLBACK
    );
  });

  /* Приходит из класса AuthorizationError через error-handler — тоже не литерал. */
  it('AUTHORIZATION_ERROR из cors имеет текст', () => {
    expect(apiErrorMessage({ code: 'AUTHORIZATION_ERROR' }, FALLBACK)).toBe(
      'Недостаточно прав для этого действия.'
    );
  });

  it('поиск от двух символов объясняется по делу, а не «ошибка приложения»', () => {
    expect(apiErrorMessage({ code: 'INVALID_QUERY' }, FALLBACK)).toContain(
      '2 символа'
    );
  });

  it('неизвестный код по-прежнему отдаёт запасной текст', () => {
    expect(apiErrorMessage({ code: 'НЕ_СУЩЕСТВУЕТ' }, FALLBACK)).toBe(FALLBACK);
  });
});
