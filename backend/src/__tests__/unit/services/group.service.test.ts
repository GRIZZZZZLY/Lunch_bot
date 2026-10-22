/**
 * Группа и её состав. Права доступа (assertMember/assertAdmin,
 * verifyTelegramMembership) закреплены в group-access.test.ts, сверка с
 * Telegram — в group-reconcile.service.test.ts, жизненный цикл членства и
 * ролей из событий бота — в интеграционных тестах бота. Здесь остальное:
 * отказы при сбоях, подсчёт участников через Telegram, разбор настроек.
 *
 * Правило, которое легко сломать незаметно: список групп пользователя
 * отфильтрован и по членству, и по самой группе. Когда бота выгоняют,
 * membership остаётся активным, и без второго условия мёртвая группа
 * продолжала бы висеть в интерфейсе.
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

const api = {
  getChatMemberCount: jest.fn(),
  getChatMember: jest.fn(),
  getMe: jest.fn(),
};

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();

  asMock(getBotInstance).mockReturnValue({ api });
  api.getChatMemberCount.mockResolvedValue(6);
  api.getMe.mockResolvedValue({ id: 42 });

  asMock(prismaMock.group.update).mockResolvedValue({ id: 100 });
  asMock(prismaMock.group.findUnique).mockResolvedValue({ id: 100 });
  asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);
  asMock(prismaMock.groupMember.findFirst).mockResolvedValue(null);
  asMock(prismaMock.groupMember.findMany).mockResolvedValue([]);
  asMock(prismaMock.groupMember.update).mockResolvedValue({ id: 1 });
});

describe('updateGroup', () => {
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
});

describe('проверки членства', () => {
  it('сбой проверки закрывает доступ, а не открывает', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.isUserGroupMember(5, 100)).resolves.toBe(false);
  });

  it('сбой проверки прав закрывает доступ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockRejectedValue(
      new Error('db down')
    );

    await expect(GroupService.isUserGroupAdmin(5, 100)).resolves.toBe(false);
  });
});

describe('getUsersSharingActiveGroup', () => {
  it('себя человек видит всегда', async () => {
    const ids = await GroupService.getUsersSharingActiveGroup(5, [5]);

    expect(ids.has(5)).toBe(true);
  });
});

describe('ensureMemberRole и setMemberRole', () => {
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

  it('смена роли несуществующему участнику — ошибка', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(
      GroupService.setMemberRole(100, 5, 'ADMIN')
    ).rejects.toThrow('Group member not found');
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

  it.each([403, 400])(
    'отказ Telegram %i — нет доступа к чату, null',
    async errorCode => {
      api.getChatMemberCount.mockRejectedValue({ error_code: errorCode });

      await expect(GroupService.getRealMemberCount('-1001')).resolves.toBeNull();
    }
  );
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
});
