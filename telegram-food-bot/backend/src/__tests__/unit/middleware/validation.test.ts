import { Request, Response } from 'express';
import { validateMenuItemData } from '../../../api/middleware/validation';

/**
 * Регрессия: multi-tenant create блюда падал с MISSING_GROUP_ID, потому что
 * createMenuItemSchema (z.object) срезал groupId из body при `req.body = result.data`.
 * Фронт на create шлёт groupId только в теле → контроллер видел undefined → 400.
 * Тест фиксирует, что groupId сохраняется в body после валидации.
 */
function makeRes(): Response {
  const r: any = { statusCode: 0, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r as Response;
}

describe('validateMenuItemData — groupId passthrough (multi-tenant)', () => {
  it('POST: сохраняет groupId из тела (не срезает)', () => {
    const req = { method: 'POST', body: { name: 'Пицца', price: 2123, isActive: true, groupId: 26 } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body as any).groupId).toBe(26);
    expect((req.body as any).name).toBe('Пицца');
  });

  it('POST без groupId: валидацию проходит (optional), groupId остаётся undefined', () => {
    const req = { method: 'POST', body: { name: 'Суп', isActive: true } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body as any).groupId).toBeUndefined();
  });

  it('PUT (update): сохраняет groupId из тела', () => {
    const req = { method: 'PUT', body: { name: 'Ролл', groupId: 26 } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body as any).groupId).toBe(26);
  });

  it('POST: невалидное имя → 400 VALIDATION_ERROR', () => {
    const req = { method: 'POST', body: { name: '', groupId: 26 } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).statusCode).toBe(400);
    expect((res as any).body.code).toBe('VALIDATION_ERROR');
  });
});
