import { Request, Response } from 'express';
import { validateMenuItemData } from '../../../api/middleware/validation';

/**
 * Регрессия: создание блюда должно сохранять целевую группу после валидации.
 * Основной контракт — groupIds, старый одиночный groupId нормализуется в groupIds.
 */
function makeRes(): Response {
  const r: any = { statusCode: 0, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r as Response;
}

describe('validateMenuItemData — groupId passthrough (multi-tenant)', () => {
  it('POST: сохраняет groupIds из тела', () => {
    const req = { method: 'POST', body: { name: 'Пицца', price: 2123, isActive: true, groupIds: [26] } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body).groupIds).toEqual([26]);
    expect((req.body).name).toBe('Пицца');
  });

  it('POST: старый groupId нормализуется в groupIds', () => {
    const req = { method: 'POST', body: { name: 'Пицца', price: 2123, isActive: true, groupId: 26 } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body).groupId).toBe(26);
    expect((req.body).groupIds).toEqual([26]);
    expect((req.body).name).toBe('Пицца');
  });

  it('POST без groupIds/groupId: возвращает 400 VALIDATION_ERROR', () => {
    const req = { method: 'POST', body: { name: 'Суп', isActive: true } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).statusCode).toBe(400);
    expect((res as any).body.code).toBe('VALIDATION_ERROR');
  });

  it('PUT (update): срезает groupId из тела — блюдо нельзя перенести в другую группу (F2)', () => {
    const req = { method: 'PUT', body: { name: 'Ролл', groupId: 26 } } as Request;
    const res = makeRes();
    const next = jest.fn();

    validateMenuItemData(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req.body).name).toBe('Ролл');
    // groupId запрещён на обновлении — схема его отбрасывает.
    expect((req.body).groupId).toBeUndefined();
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
