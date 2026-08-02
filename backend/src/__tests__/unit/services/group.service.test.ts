/**
 * Группа и её состав. Права доступа (assertMember/assertAdmin,
 * verifyTelegramMembership) закреплены в group-access.test.ts, сверка с
 * Telegram — в group-reconcile.service.test.ts; здесь остальное: сама группа,
 * состав, роли, настройки и статистика.
 *
 * Два правила, которые легко сломать незаметно:
 *  1. Повторное добавление активного участника НЕ меняет его роль. Иначе любая
 *     пересинхронизация состава понижала бы создателя группы до MEMBER.
 *  2. Список групп пользователя отфильтрован и по членству, и по самой группе:
 *     когда бота выгоняют, membership остаётся активным, и без второго условия
 *     мёртвая группа продолжала бы висеть в интерфейсе.
 */
import { Prisma } from '@prisma/client';
import { GroupService } from '../../../services/group.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../bot/bot-instance', () => ({
  getBotInstance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logger } = jest.requireMock('../../../utils/logger');

const api = {
  getChatMemberCount: jest.fn(),
  getChatMember: jest.fn(),
  getMe: jest.fn(),
};

const NOW = new Date('2026-08-03T12:00:00.000Z');

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  asMock(getBotInstance).mockReturnValue({ api });
  api.getChatMemberCount.mockResolvedValue(6);
  api.getMe.mockResolvedValue({ id: 42 });

  asMock(prismaMock.group.upsert).mockResolvedValue({ id: 100 });
  asMock(prismaMock.group.update).mockResolvedValue({ id: 100 });
  asMock(prismaMock.group.findUnique).mockResolvedValue({ id: 100 });
  asMock(prismaMock.group.findMany).mockResolvedValue([]);
  asMock(prismaMock.group.count).mockResolvedValue(0);
  asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);
  asMock(prismaMock.groupMember.findFirst).mockResolvedValue(null);
  asMock(prismaMock.groupMember.findMany).mockResolvedValue([]);
  asMock(prismaMock.groupMember.upsert).mockResolvedValue({ id: 1 });
  asMock(prismaMock.groupMember.update).mockResolvedValue({ id: 1 });
  asMock(prismaMock.groupMember.updateMany).mockResolvedValue({ count: 1 });
  asMock(prismaMock.poll.findFirst).mockResolvedValue(null);
  asMock(prismaMock.poll.findMany).mockResolvedValue([]);
  asMock(prismaMock.poll.count).mockResolvedValue(0);
  asMock(prismaMock.vote.count).mockResolvedValue(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('upsertGroup', () => {
  it('строковый telegramId переводится в BigInt: id чата не влезает в number', async () => {
    await GroupService.upsertGroup({
      telegramId: '-1001234567890',
      title: 'Обед',
      type: 'supergroup',
    });

    expect(asMock(prismaMock.group.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: BigInt('-1001234567890') },
      })
    );
  });

  it('повторное добавление бота реактивирует группу', async () => {
    await GroupService.upsertGroup({
      telegramId: '-1001',
      title: 'Обед',
      type: 'group',
    });

    const call = asMock(prismaMock.group.upsert).mock.calls[0][0] as {
      update: { isActive: boolean };
      create: { isActive: boolean };
    };
    expect(call.update.isActive).toBe(true);
    expect(call.create.isActive).toBe(true);
  });

  it('сбой БД превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.upsert).mockRejectedValue(new Error('db down'));

    await expect(
      GroupService.upsertGroup({ telegramId: '-1', title: 'x', type: 'group' })
    ).rejects.toThrow('Failed to create or update group');
    expect(logger.error).toHaveBeenCalledWith(
      'Error upserting group:',
      expect.any(Error)
    );
  });
});

describe('чтение группы', () => {
  it('поиск по telegramId переводит строку в BigInt', async () => {
    await GroupService.getGroupByTelegramId('-1001');

    expect(asMock(prismaMock.group.findUnique)).toHaveBeenCalledWith({
      where: { telegramId: BigInt('-1001') },
    });
  });

  it('незнакомая группа — null, а не ошибка', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue(null);

    await expect(GroupService.getGroupByTelegramId('-1')).resolves.toBeNull();
  });

  it('сбой поиска по telegramId превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.findUnique).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getGroupByTelegramId('-1')).rejects.toThrow(
      'Failed to get group'
    );
  });

  it('группа по id отдаётся вместе с активным голосованием', async () => {
    await GroupService.getGroupById(100);

    expect(asMock(prismaMock.group.findUnique)).toHaveBeenCalledWith({
      where: { id: 100 },
      include: { polls: { where: { status: 'ACTIVE' } } },
    });
  });

  it('сбой поиска по id превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.findUnique).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getGroupById(100)).rejects.toThrow(
      'Failed to get group'
    );
  });

  it('активное голосование берётся самое свежее', async () => {
    await GroupService.getActiveGroupPoll(100);

    expect(asMock(prismaMock.poll.findFirst)).toHaveBeenCalledWith({
      where: { groupId: 100, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('сбой поиска голосования превращается в понятную ошибку', async () => {
    asMock(prismaMock.poll.findFirst).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getActiveGroupPoll(100)).rejects.toThrow(
      'Failed to get active poll'
    );
  });
});

describe('updateGroup', () => {
  it('обновление проставляет время правки', async () => {
    await GroupService.updateGroup(100, { title: 'Новое имя' });

    expect(asMock(prismaMock.group.update)).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { title: 'Новое имя', updatedAt: NOW },
    });
  });

  it('отсутствующая группа даёт «не найдена», а не общий сбой', async () => {
    asMock(prismaMock.group.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('no row', {
        code: 'P2025',
        clientVersion: '5',
      })
    );

    await expect(GroupService.updateGroup(100, { title: 'x' })).rejects.toThrow(
      'Group not found'
    );
  });

  it('прочие ошибки Prisma превращаются в общий сбой', async () => {
    asMock(prismaMock.group.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '5',
      })
    );

    await expect(GroupService.updateGroup(100, { title: 'x' })).rejects.toThrow(
      'Failed to update group'
    );
  });
});

describe('addMemberToGroup', () => {
  it('новый участник создаётся с ролью MEMBER по умолчанию', async () => {
    await GroupService.addMemberToGroup(100, 5);

    expect(asMock(prismaMock.groupMember.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { groupId: 100, userId: 5, role: 'MEMBER', isActive: true },
      })
    );
  });

  it('активному участнику роль не переписывают', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'CREATOR',
      isActive: true,
    });

    const member = await GroupService.addMemberToGroup(100, 5, 'MEMBER');

    expect(asMock(prismaMock.groupMember.upsert)).not.toHaveBeenCalled();
    expect(member).toMatchObject({ role: 'CREATOR' });
  });

  it('вернувшийся участник реактивируется, а не дублируется', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'MEMBER',
      isActive: false,
    });

    await GroupService.addMemberToGroup(100, 5);

    expect(asMock(prismaMock.groupMember.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { isActive: true, leftAt: null, role: 'MEMBER' },
      })
    );
  });

  it('сбой БД превращается в понятную ошибку', async () => {
    asMock(prismaMock.groupMember.upsert).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.addMemberToGroup(100, 5)).rejects.toThrow(
      'Failed to add member to group'
    );
  });
});

describe('removeMemberFromGroup', () => {
  it('удаление мягкое: запись остаётся с отметкой времени выхода', async () => {
    await GroupService.removeMemberFromGroup(100, 5);

    expect(asMock(prismaMock.groupMember.updateMany)).toHaveBeenCalledWith({
      where: { groupId: 100, userId: 5, isActive: true },
      data: { isActive: false, leftAt: NOW },
    });
  });

  it('сбой БД превращается в понятную ошибку', async () => {
    asMock(prismaMock.groupMember.updateMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.removeMemberFromGroup(100, 5)).rejects.toThrow(
      'Failed to remove member from group'
    );
  });
});

describe('состав группы', () => {
  it('по умолчанию отдаются только активные участники', async () => {
    await GroupService.getGroupMembers(100);

    expect(asMock(prismaMock.groupMember.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId: 100, isActive: true },
        orderBy: { joinedAt: 'asc' },
      })
    );
  });

  it('вышедших можно запросить явно', async () => {
    await GroupService.getGroupMembers(100, false);

    expect(
      (
        asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where
    ).toEqual({ groupId: 100 });
  });

  it('в составе нет полей, которые не нужны интерфейсу', async () => {
    await GroupService.getGroupMembers(100);

    const call = asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
      include: { user: { select: Record<string, boolean> } };
    };
    expect(call.include.user.select).not.toHaveProperty('paymentCard');
    expect(call.include.user.select).not.toHaveProperty('paymentPhone');
  });

  it('сбой чтения состава превращается в понятную ошибку', async () => {
    asMock(prismaMock.groupMember.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.getGroupMembers(100)).rejects.toThrow(
      'Failed to get group members'
    );
  });

  it('getUsersByGroupId разворачивает членства в пользователей', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { id: 1, user: { id: 5, firstName: 'Иван' } },
      { id: 2, user: { id: 6, firstName: 'Пётр' } },
    ]);

    await expect(GroupService.getUsersByGroupId(100)).resolves.toEqual([
      { id: 5, firstName: 'Иван' },
      { id: 6, firstName: 'Пётр' },
    ]);
  });

  it('сбой чтения пользователей превращается в понятную ошибку', async () => {
    asMock(prismaMock.groupMember.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.getUsersByGroupId(100)).rejects.toThrow(
      'Failed to get users by group ID'
    );
  });
});

describe('группы пользователя', () => {
  it('мёртвая группа в списке не появляется, хотя членство активно', async () => {
    await GroupService.getGroupsForUser(5);

    expect(
      (
        asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where
    ).toEqual({ userId: 5, isActive: true, group: { isActive: true } });
  });

  it('историю членства можно запросить целиком', async () => {
    await GroupService.getGroupsForUser(5, false);

    expect(
      (
        asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
          where: Record<string, unknown>;
        }
      ).where
    ).toEqual({ userId: 5 });
  });

  it('сбой чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.groupMember.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.getGroupsForUser(5)).rejects.toThrow(
      'Failed to get user groups'
    );
  });
});

describe('проверки членства', () => {
  it('активное членство подтверждается', async () => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue({ id: 1 });

    await expect(GroupService.isUserGroupMember(5, 100)).resolves.toBe(true);
  });

  it('вышедший участник членом не считается', async () => {
    await GroupService.isUserGroupMember(5, 100);

    expect(asMock(prismaMock.groupMember.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5, groupId: 100, isActive: true },
      })
    );
  });

  it('сбой проверки закрывает доступ, а не открывает', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.isUserGroupMember(5, 100)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Error checking group membership:',
      expect.any(Error)
    );
  });

  it('админом считается только ADMIN или CREATOR', async () => {
    await GroupService.isUserGroupAdmin(5, 100);

    expect(asMock(prismaMock.groupMember.findFirst)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ['ADMIN', 'CREATOR'] },
        }),
      })
    );
  });

  it('сбой проверки прав закрывает доступ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.isUserGroupAdmin(5, 100)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Error checking group admin access:',
      expect.any(Error)
    );
  });

  it('isMemberOfGroup отвечает по активному членству', async () => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue({ id: 1 });

    await expect(GroupService.isMemberOfGroup(100, 5)).resolves.toBe(true);
  });

  it('isMemberOfGroup при сбое закрывает доступ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.isMemberOfGroup(100, 5)).resolves.toBe(false);
  });
});

describe('getUsersSharingActiveGroup', () => {
  it('себя человек видит всегда', async () => {
    const ids = await GroupService.getUsersSharingActiveGroup(5, [5]);

    expect(ids.has(5)).toBe(true);
  });

  it('пустой список не идёт в БД', async () => {
    const ids = await GroupService.getUsersSharingActiveGroup(5, []);

    expect(ids.size).toBe(0);
    expect(asMock(prismaMock.groupMember.findMany)).not.toHaveBeenCalled();
  });

  it('видны только те, с кем есть общая группа', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 6 },
    ]);

    const ids = await GroupService.getUsersSharingActiveGroup(5, [6, 7]);

    expect([...ids]).toEqual([6]);
  });

  it('дубликаты в запросе не размножают выборку', async () => {
    await GroupService.getUsersSharingActiveGroup(5, [6, 6, 6]);

    expect(
      (
        asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
          where: { userId: { in: number[] } };
        }
      ).where.userId.in
    ).toEqual([6]);
  });

  it('запрашивающий должен сам состоять в группе', async () => {
    await GroupService.getUsersSharingActiveGroup(5, [6]);

    const where = (
      asMock(prismaMock.groupMember.findMany).mock.calls[0][0] as {
        where: Record<string, unknown>;
      }
    ).where;
    expect(where).toMatchObject({
      isActive: true,
      group: { members: { some: { userId: 5, isActive: true } } },
    });
  });
});

describe('ensureMemberRole и setMemberRole', () => {
  it('роль повышается, когда запрошенная выше текущей', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'MEMBER',
      isActive: true,
    });

    await GroupService.ensureMemberRole(100, 5, 'ADMIN');

    expect(asMock(prismaMock.groupMember.update)).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { role: 'ADMIN' },
    });
  });

  it('роль никогда не понижается: пересинк не отнимает права создателя', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'CREATOR',
      isActive: true,
    });

    await GroupService.ensureMemberRole(100, 5, 'MEMBER');

    expect(asMock(prismaMock.groupMember.update)).not.toHaveBeenCalled();
  });

  it('равная роль повторной записи не вызывает', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'ADMIN',
      isActive: true,
    });

    await GroupService.ensureMemberRole(100, 5, 'ADMIN');

    expect(asMock(prismaMock.groupMember.update)).not.toHaveBeenCalled();
  });

  it('незнакомая роль трактуется как низшая', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      id: 1,
      role: 'OWNER',
      isActive: true,
    });

    await GroupService.ensureMemberRole(100, 5, 'ADMIN');

    expect(asMock(prismaMock.groupMember.update)).toHaveBeenCalled();
  });

  it('новому участнику роль ставится сразу при создании', async () => {
    asMock(prismaMock.groupMember.upsert).mockResolvedValue({
      id: 1,
      role: 'CREATOR',
    });

    await GroupService.ensureMemberRole(100, 5, 'CREATOR');

    expect(asMock(prismaMock.groupMember.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'CREATOR' }),
      })
    );
    expect(asMock(prismaMock.groupMember.update)).not.toHaveBeenCalled();
  });

  it('смена роли несуществующему участнику — ошибка', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(
      GroupService.setMemberRole(100, 5, 'ADMIN')
    ).rejects.toThrow('Group member not found');
  });

  it('сбой смены роли пробрасывается наружу', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({ id: 1 });
    asMock(prismaMock.groupMember.update).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.setMemberRole(100, 5, 'ADMIN')).rejects.toThrow(
      'db down'
    );
  });
});

describe('списки групп', () => {
  it('активные группы отдаются от новых к старым', async () => {
    await GroupService.getAllActiveGroups();

    expect(asMock(prismaMock.group.findMany)).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('сбой чтения активных групп превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.findMany).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getAllActiveGroups()).rejects.toThrow(
      'Failed to get all active groups'
    );
  });

  it('постраничный список отдаёт и срез, и общее число', async () => {
    asMock(prismaMock.group.findMany).mockResolvedValue([{ id: 100 }]);
    asMock(prismaMock.group.count).mockResolvedValue(7);

    await expect(GroupService.getAllGroups(2, 4)).resolves.toEqual({
      groups: [{ id: 100 }],
      total: 7,
    });
    expect(asMock(prismaMock.group.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 2, skip: 4 })
    );
  });

  it('по умолчанию отдаётся первая страница по 50', async () => {
    await GroupService.getAllGroups();

    expect(asMock(prismaMock.group.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 })
    );
  });

  it('сбой постраничного чтения превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.count).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getAllGroups()).rejects.toThrow(
      'Failed to get groups'
    );
  });
});

describe('getGroupStats', () => {
  it('среднее число голосов на голосование округляется', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    asMock(prismaMock.vote.count).mockResolvedValue(10);

    await expect(GroupService.getGroupStats(100)).resolves.toEqual({
      totalPolls: 3,
      activePolls: 1,
      totalVotes: 10,
      averageVotesPerPoll: 3,
    });
  });

  it('без голосований среднее — ноль, а не деление на ноль', async () => {
    asMock(prismaMock.poll.count).mockResolvedValue(0);
    asMock(prismaMock.vote.count).mockResolvedValue(0);

    expect((await GroupService.getGroupStats(100)).averageVotesPerPoll).toBe(0);
  });

  it('сбой подсчёта превращается в понятную ошибку', async () => {
    asMock(prismaMock.vote.count).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getGroupStats(100)).rejects.toThrow(
      'Failed to get group statistics'
    );
  });
});

describe('deactivateGroup', () => {
  it('группа не удаляется, а помечается неактивной', async () => {
    await GroupService.deactivateGroup(100);

    expect(asMock(prismaMock.group.update)).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { isActive: false, updatedAt: NOW },
    });
  });

  it('сбой деактивации превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.update).mockRejectedValue(new Error('db down'));

    await expect(GroupService.deactivateGroup(100)).rejects.toThrow(
      'Failed to deactivate group'
    );
  });
});

describe('getRealMemberCount', () => {
  it('сам бот из числа участников вычитается', async () => {
    api.getChatMemberCount.mockResolvedValue(6);

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBe(5);
  });

  it('bigint-идентификатор принимается наравне со строкой', async () => {
    await GroupService.getRealMemberCount(BigInt('-1001'));

    expect(api.getChatMemberCount).toHaveBeenCalledWith(-1001);
  });

  it('переданный бот используется вместо глобального', async () => {
    const custom = { api: { getChatMemberCount: jest.fn().mockResolvedValue(3) } };

    await expect(GroupService.getRealMemberCount('-1001', custom)).resolves.toBe(
      2
    );
    expect(api.getChatMemberCount).not.toHaveBeenCalled();
  });

  it('группа из одного бота даёт минимум 1, а не 0', async () => {
    api.getChatMemberCount.mockResolvedValue(1);

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBe(1);
  });

  it('без бота возвращается null, а не выдуманное число', async () => {
    asMock(getBotInstance).mockReturnValue(null);

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBeNull();
  });

  it('отказ доступа к чату отдаёт null с предупреждением', async () => {
    api.getChatMemberCount.mockRejectedValue({ error_code: 403 });

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Bot not in group')
    );
  });

  it('ошибка 400 тоже трактуется как отсутствие доступа', async () => {
    api.getChatMemberCount.mockRejectedValue({ error_code: 400 });

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('прочие сбои Telegram логируются как ошибка', async () => {
    api.getChatMemberCount.mockRejectedValue(new Error('network down'));

    await expect(GroupService.getRealMemberCount('-1001')).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting real member count:',
      expect.any(Error)
    );
  });
});

describe('getActiveParticipants', () => {
  function polls(voteSets: number[][]) {
    asMock(prismaMock.poll.findMany).mockResolvedValue(
      voteSets.map((userIds, index) => ({
        id: index + 1,
        votes: userIds.map(userId => ({ userId, user: { id: userId } })),
      }))
    );
  }

  it('считаются уникальные голосовавшие по нескольким голосованиям', async () => {
    polls([[1, 2], [2, 3]]);

    await expect(GroupService.getActiveParticipants(100)).resolves.toBe(3);
  });

  it('без истории возвращается 1, а не ноль', async () => {
    polls([]);

    await expect(GroupService.getActiveParticipants(100)).resolves.toBe(1);
  });

  it('голосования без голосов дают минимум 1', async () => {
    polls([[], []]);

    await expect(GroupService.getActiveParticipants(100)).resolves.toBe(1);
  });

  it('берутся только последние пять завершённых голосований', async () => {
    await GroupService.getActiveParticipants(100);

    expect(asMock(prismaMock.poll.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId: 100, status: { in: ['COMPLETED', 'CANCELLED'] } },
        take: 5,
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('сбой чтения не роняет вызывающего: возвращается 1', async () => {
    asMock(prismaMock.poll.findMany).mockRejectedValue(new Error('db down'));

    await expect(GroupService.getActiveParticipants(100)).resolves.toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting active participants:',
      expect.any(Error)
    );
  });
});

describe('настройки группы', () => {
  it('без сохранённых настроек действуют значения по умолчанию', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({ settings: null });

    await expect(GroupService.getGroupSettings(100)).resolves.toEqual({
      autoCompleteEnabled: true,
      notificationsEnabled: true,
      progressNotifications: false,
    });
  });

  it('несуществующая группа тоже отдаёт значения по умолчанию', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue(null);

    await expect(GroupService.getGroupSettings(100)).resolves.toMatchObject({
      autoCompleteEnabled: true,
    });
  });

  it('настройки, сохранённые строкой JSON, разбираются', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({
      settings: JSON.stringify({ autoCompleteEnabled: false }),
    });

    await expect(GroupService.getGroupSettings(100)).resolves.toEqual({
      autoCompleteEnabled: false,
    });
  });

  it('настройки, сохранённые объектом, отдаются как есть', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({
      settings: { notificationsEnabled: false },
    });

    await expect(GroupService.getGroupSettings(100)).resolves.toEqual({
      notificationsEnabled: false,
    });
  });

  it('битый JSON не роняет запрос: возвращаются значения по умолчанию', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({
      settings: '{not json',
    });

    await expect(GroupService.getGroupSettings(100)).resolves.toEqual({
      autoCompleteEnabled: true,
      notificationsEnabled: true,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting group settings:',
      expect.any(Error)
    );
  });

  it('обновление сохраняет прежние настройки, а не заменяет их целиком', async () => {
    asMock(prismaMock.group.findUnique).mockResolvedValue({
      settings: JSON.stringify({
        autoCompleteEnabled: false,
        notificationsEnabled: true,
      }),
    });

    await GroupService.updateGroupSettings(100, {
      progressNotifications: true,
    });

    const call = asMock(prismaMock.group.update).mock.calls[0][0] as {
      data: { settings: string };
    };
    expect(JSON.parse(call.data.settings)).toEqual({
      autoCompleteEnabled: false,
      notificationsEnabled: true,
      progressNotifications: true,
    });
  });

  it('сбой записи настроек превращается в понятную ошибку', async () => {
    asMock(prismaMock.group.update).mockRejectedValue(new Error('db down'));

    await expect(
      GroupService.updateGroupSettings(100, { notificationsEnabled: false })
    ).rejects.toThrow('Failed to update group settings');
  });
});
