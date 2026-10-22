/**
 * Валидация входящих данных. Это последняя линия перед сервисами: всё, что
 * проходит здесь, дальше считается корректным, поэтому проверяются именно
 * границы (0, пустая строка, отрицательное число, дробный id), а не «счастливый
 * путь».
 *
 * Отдельно закреплён обратно совместимый контракт создания блюда: старый клиент
 * присылает `groupId`, новый — `groupIds`, и middleware обязан привести первое
 * ко второму, иначе блюдо создаётся без группы и не видно никому.
 */
import { z } from 'zod';
import {
  validateMenuItemData,
  validatePollData,
  validateVoteData,
  validateWithSchema,
  sanitizeStrings,
} from '../../../api/middleware/validation';
import { mockRequest, mockResponse } from '../../helpers/http';
import type { MockRequest, MockResponse } from '../../helpers/http';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

interface ValidationBody {
  success: boolean;
  error: string;
  code: string;
  errors?: Array<{ field: string; message: string; code: string }>;
}

type Middleware = (
  req: MockRequest,
  res: MockResponse,
  next: jest.Mock
) => void;

function run(
  middleware: Middleware,
  req: MockRequest
): { res: MockResponse; next: jest.Mock; body: ValidationBody } {
  const res = mockResponse();
  const next = jest.fn();
  middleware(req, res, next);
  return { res, next, body: res.body as ValidationBody };
}

function fields(body: ValidationBody): string[] {
  return (body.errors ?? []).map(e => e.field);
}

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * Регрессия: создание блюда должно сохранять целевую группу после валидации.
 * Основной контракт — groupIds, старый одиночный groupId нормализуется в groupIds.
 * Сохранение группы, нормализация groupId, отказ без группы и запрет переноса
 * блюда через PUT проверены на настоящем API в integration/api/menu.routes.test.ts.
 */
describe('validateMenuItemData — groupId passthrough (multi-tenant)', () => {
  it('POST: невалидное имя → 400 VALIDATION_ERROR', () => {
    const req = mockRequest({
      method: 'POST',
      body: { name: '', groupId: 26 },
    });

    const { next, res, body } = run(validateMenuItemData, req);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('явный groupIds не перезаписывается одиночным groupId', () => {
    const req = mockRequest({
      method: 'POST',
      body: { name: 'Плов', groupId: 7, groupIds: [1, 2] },
    });

    run(validateMenuItemData, req);

    expect((req.body as { groupIds: number[] }).groupIds).toEqual([1, 2]);
  });

});

describe('validateMenuItemData — границы полей', () => {
  const valid = { name: 'Плов', price: 250, groupIds: [1] };

  it('имя длиннее 100 символов отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, name: 'я'.repeat(101) },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('name');
  });

  it('отрицательная цена отклоняется', () => {
    const req = mockRequest({ method: 'POST', body: { ...valid, price: -1 } });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('price');
  });

  it('нулевая цена допустима: блюдо может быть бесплатным', () => {
    const req = mockRequest({ method: 'POST', body: { ...valid, price: 0 } });

    const { next } = run(validateMenuItemData, req);

    expect(next).toHaveBeenCalled();
  });

  it('строка вместо цены отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, price: '250' },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('price');
  });

  it('не-URL в imageUrl отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, imageUrl: 'не ссылка' },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('imageUrl');
  });

  it('пустые строки в imageUrl и description допустимы — это «убрать значение»', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, imageUrl: '', description: '' },
    });

    const { next } = run(validateMenuItemData, req);

    expect(next).toHaveBeenCalled();
  });

  it('описание длиннее 500 символов отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, description: 'д'.repeat(501) },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('description');
  });

  it('дробный id группы отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, groupIds: [1.5] },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('groupIds.0');
  });

  it('нулевой id группы отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { ...valid, groupIds: [0] },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toContain('groupIds.0');
  });

  it('несколько ошибок возвращаются вместе', () => {
    const req = mockRequest({
      method: 'POST',
      body: { name: '', price: -5, groupIds: [1] },
    });

    const { body } = run(validateMenuItemData, req);

    expect(fields(body)).toEqual(expect.arrayContaining(['name', 'price']));
  });

  it('PATCH с пустым телом проходит', () => {
    const req = mockRequest({ method: 'PATCH', body: {} });

    const { next } = run(validateMenuItemData, req);

    expect(next).toHaveBeenCalled();
  });

  it('невалидное поле при обновлении всё равно отклоняется', () => {
    const req = mockRequest({ method: 'PUT', body: { price: -3 } });

    const { res } = run(validateMenuItemData, req);

    expect(res.statusCode).toBe(400);
  });

});

describe('validatePollData', () => {
  it('минимальное голосование проходит', () => {
    const req = mockRequest({ method: 'POST', body: { groupId: 1 } });

    const { next } = run(validatePollData, req);

    expect(next).toHaveBeenCalled();
  });

  it('голосование без группы отклоняется', () => {
    const req = mockRequest({ method: 'POST', body: {} });

    const { res, body } = run(validatePollData, req);

    expect(res.statusCode).toBe(400);
    expect(fields(body)).toContain('groupId');
  });

  it('отрицательный groupId отклоняется', () => {
    const req = mockRequest({ method: 'POST', body: { groupId: -1 } });

    const { body } = run(validatePollData, req);

    expect(fields(body)).toContain('groupId');
  });

  it('endTime не в ISO отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { groupId: 1, endTime: '31.12.2025' },
    });

    const { body } = run(validatePollData, req);

    expect(fields(body)).toContain('endTime');
  });

  it('корректный ISO endTime проходит', () => {
    const req = mockRequest({
      method: 'POST',
      body: { groupId: 1, endTime: '2026-01-01T12:00:00.000Z' },
    });

    const { next } = run(validatePollData, req);

    expect(next).toHaveBeenCalled();
  });

  it('заголовок длиннее 200 символов отклоняется', () => {
    const req = mockRequest({
      method: 'POST',
      body: { groupId: 1, title: 'т'.repeat(201) },
    });

    const { body } = run(validatePollData, req);

    expect(fields(body)).toContain('title');
  });

  it('лишние поля отбрасываются, а не пробрасываются в сервис', () => {
    const req = mockRequest({
      method: 'POST',
      body: { groupId: 1, isAdmin: true },
    });

    run(validatePollData, req);

    expect(req.body).not.toHaveProperty('isAdmin');
  });

});

describe('validateVoteData', () => {
  it('голос за существующее блюдо проходит', () => {
    const req = mockRequest({ method: 'POST', body: { menuItemId: 5 } });

    const { next } = run(validateVoteData, req);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ menuItemId: 5 });
  });

  it('голос без блюда отклоняется', () => {
    const req = mockRequest({ method: 'POST', body: {} });

    const { res, body } = run(validateVoteData, req);

    expect(res.statusCode).toBe(400);
    expect(fields(body)).toContain('menuItemId');
  });

  it('строковый id блюда отклоняется', () => {
    const req = mockRequest({ method: 'POST', body: { menuItemId: '5' } });

    const { res } = run(validateVoteData, req);

    expect(res.statusCode).toBe(400);
  });

});

describe('validateWithSchema', () => {
  const schema = z.object({ amount: z.number().positive() });

  it('подходящее тело проходит и заменяется разобранным', () => {
    const req = mockRequest({ body: { amount: 10, extra: 'x' } });

    const { next } = run(validateWithSchema(schema), req);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ amount: 10 });
  });

  it('несоответствие схеме отдаёт 400 со списком полей', () => {
    const req = mockRequest({ body: { amount: -1 } });

    const { res, body } = run(validateWithSchema(schema), req);

    expect(res.statusCode).toBe(400);
    expect(fields(body)).toEqual(['amount']);
  });

});

describe('sanitizeStrings', () => {
  it('обрезает пробелы в строках верхнего уровня', () => {
    const req = mockRequest({ body: { name: '  Плов  ' } });

    const { next } = run(sanitizeStrings, req);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Плов' });
  });

  it('обходит вложенные объекты и массивы', () => {
    const req = mockRequest({
      body: { item: { name: ' Плов ' }, tags: [' острое ', ' халяль '] },
    });

    run(sanitizeStrings, req);

    expect(req.body).toEqual({
      item: { name: 'Плов' },
      tags: ['острое', 'халяль'],
    });
  });

  it('числа, null и boolean остаются как есть', () => {
    const req = mockRequest({
      body: { price: 250, isActive: true, description: null },
    });

    run(sanitizeStrings, req);

    expect(req.body).toEqual({
      price: 250,
      isActive: true,
      description: null,
    });
  });

});
