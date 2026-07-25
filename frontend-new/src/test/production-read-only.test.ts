import { describe, expect, it } from 'vitest';
import { isAllowedProductionApiRequest } from '../../tests/production/support/read-only';

describe('защита боевой проверки от записи', () => {
  it('разрешает чтение и необходимые запросы авторизации', () => {
    expect(isAllowedProductionApiRequest('GET', '/api/menu')).toBe(true);
    expect(isAllowedProductionApiRequest('HEAD', '/api/health')).toBe(true);
    expect(isAllowedProductionApiRequest('POST', '/api/auth/validate')).toBe(true);
    expect(isAllowedProductionApiRequest('POST', '/api/auth/refresh')).toBe(true);
    expect(isAllowedProductionApiRequest('POST', '/api/user/avatars/batch')).toBe(true);
  });

  it.each([
    ['POST', '/api/polls/create-from-webapp'],
    ['POST', '/api/budget/mark-paid'],
    ['PUT', '/api/menu/1'],
    ['PATCH', '/api/polls/1/complete'],
    ['DELETE', '/api/menu/1'],
  ])('блокирует %s %s', (method, pathname) => {
    expect(isAllowedProductionApiRequest(method, pathname)).toBe(false);
  });
});
