import { Prisma } from '@prisma/client';

import {
  GroupStoreService,
  GroupStoreError,
} from '../../../services/group-store.service';

jest.mock('../../../database/client', () => ({
  prisma: {
    groupStore: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    storeRun: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../services/group.service', () => ({
  GroupService: { isUserGroupMember: jest.fn() },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { prisma } = require('../../../database/client');
const { GroupService } = require('../../../services/group.service');

/** Клиент транзакции с тем же набором методов, что использует сервис. */
function makeTx() {
  return {
    groupStore: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    storeRun: { updateMany: jest.fn() },
  };
}

const P2002 = new Prisma.PrismaClientKnownRequestError('unique', {
  code: 'P2002',
  clientVersion: 'test',
});

beforeEach(() => {
  jest.clearAllMocks();
  GroupService.isUserGroupMember.mockResolvedValue(true);
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
});

describe('GroupStoreService.listForGroup', () => {
  it('отдаёт только неархивированные магазины группы, свежие первыми', async () => {
    prisma.groupStore.findMany.mockResolvedValue([{ id: 1, name: 'Лента' }]);

    const result = await GroupStoreService.listForGroup(9, 7);

    expect(result).toEqual([{ id: 1, name: 'Лента' }]);
    expect(prisma.groupStore.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId: 9, archivedAt: null },
        orderBy: [{ lastUsedAt: 'desc' }],
      }),
    );
  });

  it('не пускает не-члена группы', async () => {
    GroupService.isUserGroupMember.mockResolvedValue(false);

    await expect(GroupStoreService.listForGroup(9, 7)).rejects.toMatchObject({
      name: 'GroupStoreError',
      code: 'FORBIDDEN',
    });
    expect(prisma.groupStore.findMany).not.toHaveBeenCalled();
  });
});

describe('GroupStoreService.resolveForRun', () => {
  it('по storeId берёт имя из справочника и отмечает использование', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Пятёрочка',
      archivedAt: null,
    });
    tx.groupStore.update.mockResolvedValue({ id: 5, name: 'Пятёрочка' });

    const store = await GroupStoreService.resolveForRun(tx, {
      groupId: 9,
      userId: 7,
      storeId: 5,
    });

    expect(store).toEqual({ id: 5, name: 'Пятёрочка' });
    expect(tx.groupStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ usageCount: { increment: 1 } }),
      }),
    );
    expect(tx.groupStore.create).not.toHaveBeenCalled();
  });

  it('отклоняет storeId из чужой группы', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 11,
      name: 'Чужой',
      archivedAt: null,
    });

    await expect(
      GroupStoreService.resolveForRun(tx, { groupId: 9, userId: 7, storeId: 5 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('отклоняет архивированный storeId', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Скрытый',
      archivedAt: new Date(),
    });

    await expect(
      GroupStoreService.resolveForRun(tx, { groupId: 9, userId: 7, storeId: 5 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('заводит запись, когда такого имени в группе ещё не было', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue(null);
    tx.groupStore.create.mockResolvedValue({ id: 12, name: 'Магнит' });

    const store = await GroupStoreService.resolveForRun(tx, {
      groupId: 9,
      userId: 7,
      storeName: '  Магнит ',
    });

    expect(store).toEqual({ id: 12, name: 'Магнит' });
    expect(tx.groupStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 9,
          createdById: 7,
          name: 'Магнит',
          normalizedName: 'магнит',
        }),
      }),
    );
  });

  it('узнаёт магазин при другом регистре и написании ё, написание не меняет', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Пятёрочка',
      archivedAt: null,
    });
    tx.groupStore.update.mockResolvedValue({ id: 5, name: 'Пятёрочка' });

    const store = await GroupStoreService.resolveForRun(tx, {
      groupId: 9,
      userId: 7,
      storeName: 'ПЯТЕРОЧКА',
    });

    expect(store).toEqual({ id: 5, name: 'Пятёрочка' });
    expect(tx.groupStore.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_normalizedName: { groupId: 9, normalizedName: 'пятерочка' } },
      }),
    );
    expect(tx.groupStore.update.mock.calls[0][0].data).not.toHaveProperty('name');
  });

  it('воскрешает скрытый магазин, если его имя ввели снова', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      archivedAt: new Date('2026-01-01'),
    });
    tx.groupStore.update.mockResolvedValue({ id: 5, name: 'Лента' });

    const store = await GroupStoreService.resolveForRun(tx, {
      groupId: 9,
      userId: 7,
      storeName: 'лента',
    });

    expect(store).toEqual({ id: 5, name: 'Лента' });
    expect(tx.groupStore.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ archivedAt: null }) }),
    );
  });

  it('после гонки на уникальном индексе берёт запись, созданную соперником', async () => {
    const tx = makeTx();
    tx.groupStore.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 77, groupId: 9, name: 'Магнит', archivedAt: null });
    tx.groupStore.create.mockRejectedValue(P2002);
    tx.groupStore.update.mockResolvedValue({ id: 77, name: 'Магнит' });

    const store = await GroupStoreService.resolveForRun(tx, {
      groupId: 9,
      userId: 7,
      storeName: 'Магнит',
    });

    expect(store).toEqual({ id: 77, name: 'Магнит' });
  });

  it('требует непустое имя, когда storeId не задан', async () => {
    const tx = makeTx();

    await expect(
      GroupStoreService.resolveForRun(tx, { groupId: 9, userId: 7, storeName: '   ' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('GroupStoreService.rename', () => {
  it('меняет имя и подтягивает только активные забеги', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Пятёрочка',
      normalizedName: 'пятерочка',
      archivedAt: null,
    });
    prisma.groupStore.findFirst.mockResolvedValue(null);
    prisma.groupStore.update.mockResolvedValue({ id: 5, name: 'Пятёрочка у офиса' });

    const store = await GroupStoreService.rename(5, 7, '  Пятёрочка у офиса ');

    expect(store).toEqual({ id: 5, name: 'Пятёрочка у офиса' });
    expect(prisma.groupStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { name: 'Пятёрочка у офиса', normalizedName: 'пятерочка у офиса' },
      }),
    );
    expect(prisma.storeRun.updateMany).toHaveBeenCalledWith({
      where: { storeId: 5, status: { in: ['COLLECTING', 'SHOPPING'] } },
      data: { storeName: 'Пятёрочка у офиса' },
    });
  });

  it('отказывает, если такое имя в группе уже занято', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      normalizedName: 'лента',
      archivedAt: null,
    });
    prisma.groupStore.findFirst.mockResolvedValue({ id: 6 });

    await expect(GroupStoreService.rename(5, 7, 'Магнит')).rejects.toMatchObject({
      code: 'STORE_EXISTS',
    });
    expect(prisma.groupStore.update).not.toHaveBeenCalled();
  });

  it('разрешает поправить написание того же имени', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'пятерочка',
      normalizedName: 'пятерочка',
      archivedAt: null,
    });
    prisma.groupStore.update.mockResolvedValue({ id: 5, name: 'Пятёрочка' });

    await expect(GroupStoreService.rename(5, 7, 'Пятёрочка')).resolves.toEqual({
      id: 5,
      name: 'Пятёрочка',
    });
    expect(prisma.groupStore.findFirst).not.toHaveBeenCalled();
  });

  it('не пускает не-члена группы', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      normalizedName: 'лента',
      archivedAt: null,
    });
    GroupService.isUserGroupMember.mockResolvedValue(false);

    await expect(GroupStoreService.rename(5, 7, 'Магнит')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('на несуществующем магазине отвечает NOT_FOUND', async () => {
    prisma.groupStore.findUnique.mockResolvedValue(null);

    await expect(GroupStoreService.rename(5, 7, 'Магнит')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('GroupStoreService.archive', () => {
  it('проставляет archivedAt и не трогает забеги', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      normalizedName: 'лента',
      archivedAt: null,
    });
    prisma.groupStore.update.mockResolvedValue({ id: 5 });

    await GroupStoreService.archive(5, 7);

    expect(prisma.groupStore.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: { archivedAt: expect.any(Date) },
      }),
    );
    expect(prisma.storeRun.updateMany).not.toHaveBeenCalled();
  });

  it('повторное скрытие не меняет момент архивации', async () => {
    const archivedAt = new Date('2026-01-01');
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      normalizedName: 'лента',
      archivedAt,
    });

    await GroupStoreService.archive(5, 7);

    expect(prisma.groupStore.update).not.toHaveBeenCalled();
  });

  it('не пускает не-члена группы', async () => {
    prisma.groupStore.findUnique.mockResolvedValue({
      id: 5,
      groupId: 9,
      name: 'Лента',
      normalizedName: 'лента',
      archivedAt: null,
    });
    GroupService.isUserGroupMember.mockResolvedValue(false);

    await expect(GroupStoreService.archive(5, 7)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.groupStore.update).not.toHaveBeenCalled();
  });
});

describe('GroupStoreError', () => {
  it('несёт код и имя, по которым контроллер выбирает статус', () => {
    const err = new GroupStoreError('STORE_EXISTS', 'занято');
    expect(err.name).toBe('GroupStoreError');
    expect(err.code).toBe('STORE_EXISTS');
    expect(err.message).toBe('занято');
  });
});
