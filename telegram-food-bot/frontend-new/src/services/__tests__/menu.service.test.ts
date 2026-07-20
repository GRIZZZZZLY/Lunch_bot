import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, get, put } = vi.hoisted(() => ({
  post: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  get: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  put: vi.fn(() => Promise.resolve({ success: true, data: {} })),
}));

vi.mock('../api.service', () => ({ apiService: { post, get, put, delete: vi.fn(), patch: vi.fn() } }));

import { menuService } from '../menu.service';

beforeEach(() => {
  post.mockClear();
  get.mockClear();
  put.mockClear();
});

describe('menuService.create — groupIds в теле (не query)', () => {
  it('шлёт groupIds:[number] в теле, без params', () => {
    menuService.create({ name: 'Плов', price: 300 }, '10');
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0] as unknown as [string, Record<string, unknown>, unknown];
    expect(url).toBe('/menu');
    expect(body).toMatchObject({ name: 'Плов', price: 300, groupIds: [10] });
    // groupId НЕ должен уезжать в query — иначе тело без groupIds → 400
    expect(config).toBeUndefined();
  });

  it('без groupId → groupIds undefined', () => {
    menuService.create({ name: 'Плов', price: 300 });
    const body = (post.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body).toMatchObject({ groupIds: undefined });
  });
});

describe('menuService.getAll — groupId остаётся в query', () => {
  it('передаёт params.groupId', () => {
    menuService.getAll('10');
    expect(get).toHaveBeenCalledWith('/menu', { params: { groupId: '10' } });
  });
});
