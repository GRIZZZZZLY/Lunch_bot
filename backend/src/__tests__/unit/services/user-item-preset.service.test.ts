import {
  UserItemPresetService,
  UserItemPresetError,
} from '../../../services/user-item-preset.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    userItemPreset: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    storeItem: { findMany: jest.fn() },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { prisma } = require('../../../database/client');
const { logger } = require('../../../utils/logger');

function preset(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 7,
    name: 'Молоко',
    normalizedName: 'молоко',
    quantity: 1,
    notes: null,
    pinned: false,
    usageCount: 1,
    lastUsedAt: new Date('2026-09-01'),
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.userItemPreset.findMany.mockResolvedValue([]);
  prisma.storeItem.findMany.mockResolvedValue([]);
  prisma.userItemPreset.deleteMany.mockResolvedValue({ count: 0 });
});

describe('UserItemPresetService.listForUser', () => {
  /** Историю по магазину и по группе сервис берёт двумя отдельными запросами. */
  function historyByScope(byStore: string[], byGroup: string[]) {
    prisma.storeItem.findMany.mockImplementation(
      async (args: { where: { storeRun?: { storeId?: number; groupId?: number } } }) =>
        args.where.storeRun?.storeId != null
          ? byStore.map(name => ({ name }))
          : byGroup.map(name => ({ name })),
    );
  }

  it('без области отдаёт закреплённые первыми, дальше по свежести', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      preset({ id: 1, name: 'Хлеб', lastUsedAt: new Date('2026-09-02') }),
      preset({ id: 2, name: 'Молоко', lastUsedAt: new Date('2026-09-01') }),
    ]);

    const result = await UserItemPresetService.listForUser(7, {});

    expect(result.map(p => p.id)).toEqual([1, 2]);
    expect(prisma.storeItem.findMany).not.toHaveBeenCalled();
  });

  it('поднимает товары, которые пользователь брал в этом магазине', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      preset({ id: 1, name: 'Хлеб', normalizedName: 'хлеб' }),
      preset({ id: 2, name: 'Молоко', normalizedName: 'молоко' }),
    ]);
    historyByScope(['МОЛОКО'], []);

    const result = await UserItemPresetService.listForUser(7, { storeId: 5 });

    expect(result.map(p => p.id)).toEqual([2, 1]);
    expect(prisma.storeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7, storeRun: { storeId: 5 } } }),
    );
  });

  it('товар из этой группы идёт ниже товара из этого магазина, но выше прочих', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      preset({ id: 1, name: 'Прочее', normalizedName: 'прочее' }),
      preset({ id: 2, name: 'Группа', normalizedName: 'группа' }),
      preset({ id: 3, name: 'Магазин', normalizedName: 'магазин' }),
    ]);
    historyByScope(['Магазин'], ['Магазин', 'Группа']);

    const result = await UserItemPresetService.listForUser(7, { storeId: 5, groupId: 9 });

    expect(result.map(p => p.id)).toEqual([3, 2, 1]);
    expect(prisma.storeItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7, storeRun: { groupId: 9 } } }),
    );
  });

  it('без магазина ранжирует по одной только группе', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      preset({ id: 1, name: 'Прочее', normalizedName: 'прочее' }),
      preset({ id: 2, name: 'Группа', normalizedName: 'группа' }),
    ]);
    historyByScope([], ['Группа']);

    const result = await UserItemPresetService.listForUser(7, { groupId: 9 });

    expect(result.map(p => p.id)).toEqual([2, 1]);
    expect(prisma.storeItem.findMany).toHaveBeenCalledTimes(1);
  });

  it('закреплённое держится выше товара из этого магазина', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([
      preset({ id: 1, name: 'Хлеб', normalizedName: 'хлеб', pinned: true }),
      preset({ id: 2, name: 'Молоко', normalizedName: 'молоко' }),
    ]);
    historyByScope(['Молоко'], []);

    const result = await UserItemPresetService.listForUser(7, { storeId: 5 });

    expect(result.map(p => p.id)).toEqual([1, 2]);
  });

  it('сбой подсчёта истории не роняет список', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([preset({ id: 1 })]);
    prisma.storeItem.findMany.mockRejectedValue(new Error('db down'));

    await expect(
      UserItemPresetService.listForUser(7, { storeId: 5, groupId: 9 }),
    ).resolves.toHaveLength(1);
  });

  /* Регрессия: отсечка в 50 стояла ДО ранжирования, и закреплённый или взятый
     в этом магазине товар, не попавший в полсотни самых свежих, не всплывал
     наверх — он не попадал в выборку вовсе. */
  it('берёт закреплённые и подходящие по истории отдельным запросом, помимо свежих', async () => {
    prisma.userItemPreset.findMany
      // Первый вызов — гарантированные: закреплённые и знакомые по истории.
      .mockResolvedValueOnce([
        preset({ id: 90, name: 'Старое закреплённое', pinned: true, lastUsedAt: new Date('2020-01-01') }),
        preset({ id: 91, name: 'Молоко', normalizedName: 'молоко', lastUsedAt: new Date('2020-01-02') }),
      ])
      /* Второй — свежие. Своё normalizedName обязательно: фабрика по умолчанию
         подставляет «молоко», и запись молча попала бы в ярус магазина. */
      .mockResolvedValueOnce([
        preset({
          id: 1,
          name: 'Новое',
          normalizedName: 'новое',
          lastUsedAt: new Date('2026-09-02'),
        }),
      ]);
    historyByScope(['Молоко'], []);

    const result = await UserItemPresetService.listForUser(7, { storeId: 5 });

    expect(result.map(p => p.id)).toEqual([90, 91, 1]);
    expect(prisma.userItemPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 7,
          OR: [{ pinned: true }, { normalizedName: { in: ['молоко'] } }],
        },
      }),
    );
  });

  it('запись, попавшая в обе выборки, не дублируется', async () => {
    const shared = preset({ id: 5, name: 'Молоко', normalizedName: 'молоко', pinned: true });
    prisma.userItemPreset.findMany
      .mockResolvedValueOnce([shared])
      .mockResolvedValueOnce([shared, preset({ id: 6, name: 'Хлеб' })]);
    historyByScope(['Молоко'], []);

    const result = await UserItemPresetService.listForUser(7, { storeId: 5 });

    expect(result.map(p => p.id)).toEqual([5, 6]);
  });

  it('без истории и без закреплённых лишнего запроса не делает', async () => {
    prisma.userItemPreset.findMany.mockResolvedValue([preset({ id: 1 })]);
    historyByScope([], []);

    await UserItemPresetService.listForUser(7, { storeId: 5 });

    /* Гарантированная выборка нужна и при пустой истории: закреплённые
       обязаны попасть в список в любом случае. */
    expect(prisma.userItemPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7, OR: [{ pinned: true }] } }),
    );
  });
});

describe('UserItemPresetService.recordUsage', () => {
  it('заводит или обновляет пресет по нормализованному имени', async () => {
    prisma.userItemPreset.upsert.mockResolvedValue(preset());

    await UserItemPresetService.recordUsage(7, {
      name: '  Молоко ',
      quantity: 2,
      notes: 'нежирное',
    });

    const args = prisma.userItemPreset.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_normalizedName: { userId: 7, normalizedName: 'молоко' },
    });
    expect(args.create).toMatchObject({
      userId: 7,
      name: 'Молоко',
      normalizedName: 'молоко',
      quantity: 2,
      notes: 'нежирное',
    });
    expect(args.update).toMatchObject({
      name: 'Молоко',
      quantity: 2,
      notes: 'нежирное',
      usageCount: { increment: 1 },
    });
  });

  it('пустое имя не создаёт запись', async () => {
    await UserItemPresetService.recordUsage(7, { name: '   ' });
    expect(prisma.userItemPreset.upsert).not.toHaveBeenCalled();
  });

  it('вытесняет самые холодные незакреплённые сверх лимита', async () => {
    prisma.userItemPreset.upsert.mockResolvedValue(preset());
    prisma.userItemPreset.findMany.mockResolvedValue([{ id: 41 }, { id: 42 }]);

    await UserItemPresetService.recordUsage(7, { name: 'Молоко' });

    expect(prisma.userItemPreset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, pinned: false },
        orderBy: { lastUsedAt: 'desc' },
        skip: 50,
      }),
    );
    expect(prisma.userItemPreset.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [41, 42] } },
    });
  });

  it('закреплённые не вытесняются', async () => {
    prisma.userItemPreset.upsert.mockResolvedValue(preset());
    prisma.userItemPreset.findMany.mockResolvedValue([]);

    await UserItemPresetService.recordUsage(7, { name: 'Молоко' });

    expect(prisma.userItemPreset.deleteMany).not.toHaveBeenCalled();
  });

  it('сбой записи не выходит наружу и попадает в лог', async () => {
    prisma.userItemPreset.upsert.mockRejectedValue(new Error('db down'));

    await expect(
      UserItemPresetService.recordUsage(7, { name: 'Молоко' }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('UserItemPresetService.update', () => {
  it('закрепляет свой пресет', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset());
    prisma.userItemPreset.update.mockResolvedValue(preset({ pinned: true }));

    const result = await UserItemPresetService.update(1, 7, { pinned: true });

    expect(result.pinned).toBe(true);
    expect(prisma.userItemPreset.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { pinned: true },
    });
  });

  it('переименование пересчитывает ключ дедупликации', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset());
    prisma.userItemPreset.update.mockResolvedValue(preset({ name: 'Кефир' }));

    await UserItemPresetService.update(1, 7, { name: ' Кефир ' });

    expect(prisma.userItemPreset.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Кефир', normalizedName: 'кефир' },
    });
  });

  it('чужой пресет не отдаётся', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset({ userId: 99 }));

    await expect(
      UserItemPresetService.update(1, 7, { pinned: true }),
    ).rejects.toMatchObject({ name: 'UserItemPresetError', code: 'NOT_FOUND' });
    expect(prisma.userItemPreset.update).not.toHaveBeenCalled();
  });

  it('отклоняет количество вне 1..99', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset());

    await expect(
      UserItemPresetService.update(1, 7, { quantity: 0 }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('отклоняет пустое имя', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset());

    await expect(
      UserItemPresetService.update(1, 7, { name: '  ' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('UserItemPresetService.remove', () => {
  it('удаляет свой пресет насовсем', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset());
    prisma.userItemPreset.delete.mockResolvedValue(preset());

    await UserItemPresetService.remove(1, 7);

    expect(prisma.userItemPreset.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('чужой пресет не удаляется', async () => {
    prisma.userItemPreset.findUnique.mockResolvedValue(preset({ userId: 99 }));

    await expect(UserItemPresetService.remove(1, 7)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(prisma.userItemPreset.delete).not.toHaveBeenCalled();
  });
});

describe('UserItemPresetError', () => {
  it('несёт код для выбора статуса', () => {
    const err = new UserItemPresetError('NOT_FOUND', 'нет');
    expect(err.name).toBe('UserItemPresetError');
    expect(err.code).toBe('NOT_FOUND');
  });
});
