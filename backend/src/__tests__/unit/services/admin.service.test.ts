/**
 * Админ-сервис группы. Самое опасное здесь — очистка: удаление голосования
 * каскадом уносит его транзакции, то есть непогашенные долги. Поэтому
 * зафиксировано, что опросы с живыми деньгами (PENDING/PAID) пропускаются, а
 * число пропущенных возвращается наверх — молча удалить меньше, чем просили,
 * это то же вранье, что удалить лишнее.
 *
 * Второе: всё ограничено группой. Долг из чужой группы нельзя ни списать, ни
 * напомнить по нему.
 */
import { AdminService } from '../../../services/admin.service';
import { GroupService } from '../../../services/group.service';
import { getBotInstance } from '../../../bot/bot-instance';
import { prismaMock, resetPrismaMock } from '../../helpers/prisma-mock';
import { asMock, asServiceMock } from '../../helpers/mocks';

jest.mock('../../../database/client', () =>
  require('../../helpers/prisma-mock').databaseClientMock()
);

jest.mock('../../../services/group.service', () => ({
  GroupService: {
    setMemberRole: jest.fn(),
    addMemberToGroup: jest.fn(),
    removeMemberFromGroup: jest.fn(),
  },
}));

jest.mock('../../../bot/bot-instance', () => ({ getBotInstance: jest.fn() }));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const groupService = asServiceMock(GroupService);
const botInstance = asMock(getBotInstance);

const NOW = new Date('2026-08-03T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

let service: AdminService;
let sendMessage: jest.Mock;

beforeEach(() => {
  resetPrismaMock();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);

  sendMessage = jest.fn().mockResolvedValue(undefined);
  botInstance.mockReturnValue({ api: { sendMessage } });

  service = new AdminService();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getAllUsers', () => {
  it('сводит членство и активность по группе', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      {
        userId: 1,
        role: 'ADMIN',
        isActive: true,
        participatesInPolls: true,
        user: { id: 1 },
      },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        id: 1,
        telegramId: BigInt(555),
        username: 'igor',
        firstName: 'Игорь',
        lastName: null,
        createdAt: NOW,
        updatedAt: NOW,
        _count: { votes: 4, debts: 2, credits: 1 },
        votes: [{ createdAt: NOW }],
        debts: [{ amount: 100 }, { amount: 50 }],
        credits: [{ amount: 20 }],
      },
    ] as never);

    const users = await service.getAllUsers(100);

    expect(users[0]).toMatchObject({
      id: 1,
      isAdmin: true,
      isActive: true,
      totalVotes: 4,
      totalDebts: 2,
      totalCredits: 1,
      pendingDebts: 150,
      lastActivity: NOW,
    });
  });

  it('роль CREATOR тоже считается админской', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 1, role: 'CREATOR', isActive: true, participatesInPolls: true },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        id: 1,
        _count: { votes: 0, debts: 0, credits: 0 },
        votes: [],
        debts: [],
        credits: [],
      },
    ] as never);

    const users = await service.getAllUsers(100);

    expect(users[0].isAdmin).toBe(true);
  });

  it('без членства в группе список пуст и в user-таблицу не ходим', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([] as never);

    await expect(service.getAllUsers(100)).resolves.toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('участник без голосов не получает даты активности', async () => {
    asMock(prismaMock.groupMember.findMany).mockResolvedValue([
      { userId: 1, role: 'MEMBER', isActive: false, participatesInPolls: false },
    ] as never);
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        id: 1,
        _count: { votes: 0, debts: 0, credits: 0 },
        votes: [],
        debts: [],
        credits: [],
      },
    ] as never);

    const users = await service.getAllUsers(100);

    expect(users[0]).toMatchObject({
      isAdmin: false,
      isActive: false,
      participatesInPolls: false,
      lastActivity: null,
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.groupMember.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getAllUsers(100)).rejects.toThrow('db down');
  });
});

describe('getUserStats', () => {
  beforeEach(() => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue({
      id: 1,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      firstName: 'Игорь',
      lastName: 'П',
      _count: { votes: 5, debts: 3, credits: 2, createdPolls: 1 },
      debts: [
        { amount: 100, status: 'PENDING' },
        { amount: 50, status: 'PAID' },
        { amount: 30, status: 'CONFIRMED' },
      ],
      credits: [
        { amount: 20, status: 'PENDING' },
        { amount: 10, status: 'PAID' },
      ],
    } as never);
  });

  it('разделяет суммы по статусам', async () => {
    const stats = await service.getUserStats(1, 100);

    expect(stats).toEqual({
      userId: 1,
      userName: 'Игорь П',
      totalVotes: 5,
      totalDebts: 3,
      totalCredits: 2,
      createdPolls: 1,
      pendingDebts: 100,
      paidDebts: 50,
      pendingCredits: 20,
      paidCredits: 10,
    });
  });

  it('пользователя нет в группе — отказ', async () => {
    asMock(prismaMock.groupMember.findFirst).mockResolvedValue(null);

    await expect(service.getUserStats(1, 100)).rejects.toThrow(
      'User not found in group'
    );
  });

  it('пользователя нет вовсе — отказ', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.getUserStats(1, 100)).rejects.toThrow('User not found');
  });

  it('без фамилии имя не обрастает пробелом', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      firstName: 'Игорь',
      lastName: null,
      _count: { votes: 0, debts: 0, credits: 0, createdPolls: 0 },
      debts: [],
      credits: [],
    } as never);

    const stats = await service.getUserStats(1, 100);

    expect(stats.userName).toBe('Игорь');
  });
});

describe('права участника', () => {
  beforeEach(() => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      userId: 1,
      groupId: 100,
      role: 'MEMBER',
      isActive: true,
    });
    groupService.setMemberRole.mockResolvedValue({ role: 'ADMIN' });
  });

  it('назначение админом меняет роль', async () => {
    await service.toggleAdmin(1, true, 100);

    expect(groupService.setMemberRole).toHaveBeenCalledWith(100, 1, 'ADMIN');
  });

  it('снятие прав возвращает роль участника', async () => {
    await service.toggleAdmin(1, false, 100);

    expect(groupService.setMemberRole).toHaveBeenCalledWith(100, 1, 'MEMBER');
  });

  it('у создателя группы права снять нельзя', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue({
      userId: 1,
      role: 'CREATOR',
    });

    const result = await service.toggleAdmin(1, false, 100);

    expect(groupService.setMemberRole).not.toHaveBeenCalled();
    expect(result).toMatchObject({ role: 'CREATOR' });
  });

  it('нет такого участника — отказ', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(service.toggleAdmin(1, true, 100)).rejects.toThrow(
      'Group member not found'
    );
  });

  it('активация возвращает участника в группу с его ролью', async () => {
    await service.toggleActive(1, true, 100);

    expect(groupService.addMemberToGroup).toHaveBeenCalledWith(100, 1, 'MEMBER');
  });

  it('блокировка убирает участника из группы', async () => {
    const result = await service.toggleActive(1, false, 100);

    expect(groupService.removeMemberFromGroup).toHaveBeenCalledWith(100, 1);
    expect(result).toMatchObject({ isActive: false });
  });

  it('блокировка неизвестного участника — отказ', async () => {
    asMock(prismaMock.groupMember.findUnique).mockResolvedValue(null);

    await expect(service.toggleActive(1, false, 100)).rejects.toThrow(
      'Group member not found'
    );
  });

  it('участие в голосованиях переключается флагом', async () => {
    asMock(prismaMock.groupMember.update).mockResolvedValue({
      userId: 1,
      groupId: 100,
      participatesInPolls: false,
    });

    const result = await service.toggleParticipatesInPolls(1, false, 100);

    expect(prismaMock.groupMember.update).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 100, userId: 1 } },
      data: { participatesInPolls: false },
      select: { userId: true, groupId: true, participatesInPolls: true },
    });
    expect(result).toMatchObject({ participatesInPolls: false });
  });

  it('ошибка переключения участия выбрасывается наружу', async () => {
    asMock(prismaMock.groupMember.update).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      service.toggleParticipatesInPolls(1, false, 100)
    ).rejects.toThrow('db down');
  });
});

describe('участники голосования', () => {
  it('отмечает, кто уже проголосовал', async () => {
    asMock(prismaMock.pollParticipant.findMany).mockResolvedValue([
      { userId: 1, status: 'EXPECTED', reason: null, user: { id: 1 } },
      { userId: 2, status: 'EXCLUDED', reason: 'в отпуске', user: { id: 2 } },
    ] as never);
    asMock(prismaMock.vote.findMany).mockResolvedValue([
      { userId: 1 },
    ] as never);

    const participants = await service.getPollParticipants(5);

    expect(participants).toEqual([
      { userId: 1, status: 'EXPECTED', reason: null, hasVoted: true, user: { id: 1 } },
      {
        userId: 2,
        status: 'EXCLUDED',
        reason: 'в отпуске',
        hasVoted: false,
        user: { id: 2 },
      },
    ]);
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.pollParticipant.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getPollParticipants(5)).rejects.toThrow('db down');
  });

  it('статус участника создаётся, если записи ещё нет', async () => {
    asMock(prismaMock.pollParticipant.upsert).mockResolvedValue({
      status: 'EXCLUDED',
    });

    await service.setPollParticipantStatus(5, 2, 'EXCLUDED', 'в отпуске');

    expect(prismaMock.pollParticipant.upsert).toHaveBeenCalledWith({
      where: { pollId_userId: { pollId: 5, userId: 2 } },
      update: { status: 'EXCLUDED', reason: 'в отпуске' },
      create: { pollId: 5, userId: 2, status: 'EXCLUDED', reason: 'в отпуске' },
    });
  });

  it('без причины поле обнуляется', async () => {
    asMock(prismaMock.pollParticipant.upsert).mockResolvedValue({});

    await service.setPollParticipantStatus(5, 2, 'EXPECTED');

    expect(prismaMock.pollParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: 'EXPECTED', reason: null } })
    );
  });

  it('ошибка записи выбрасывается наружу', async () => {
    asMock(prismaMock.pollParticipant.upsert).mockRejectedValue(
      new Error('db down')
    );

    await expect(
      service.setPollParticipantStatus(5, 2, 'EXPECTED')
    ).rejects.toThrow('db down');
  });
});

describe('должники', () => {
  const debtor = {
    id: 1,
    telegramId: BigInt(555),
    firstName: 'Игорь',
    lastName: null,
    debts: [
      {
        id: 10,
        amount: 100,
        createdAt: new Date(NOW.getTime() - 3 * DAY),
        pollId: 5,
        toUser: { id: 2, firstName: 'Аня' },
      },
      {
        id: 11,
        amount: 50,
        createdAt: NOW,
        pollId: 5,
        toUser: { id: 2, firstName: 'Аня' },
      },
    ],
  };

  it('список должников считает сумму и самый старый долг', async () => {
    asMock(prismaMock.user.findMany).mockResolvedValue([debtor] as never);

    const debtors = await service.getAllDebtors(100);

    expect(debtors[0]).toMatchObject({
      userId: 1,
      userName: 'Игорь',
      totalDebt: 150,
      debtCount: 2,
      oldestDebt: new Date(NOW.getTime() - 3 * DAY),
    });
  });

  it('ошибка базы выбрасывается наружу', async () => {
    asMock(prismaMock.user.findMany).mockRejectedValue(new Error('db down'));

    await expect(service.getAllDebtors(100)).rejects.toThrow('db down');
  });

  it('статистика долгов считает средний долг на человека', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([
      { amount: 100, createdAt: new Date(NOW.getTime() - 10 * DAY), fromUserId: 1 },
      { amount: 50, createdAt: NOW, fromUserId: 1 },
      { amount: 30, createdAt: NOW, fromUserId: 2 },
    ] as never);

    const stats = await service.getDebtStats(100);

    expect(stats).toEqual({
      totalDebtors: 2,
      totalDebtAmount: 180,
      avgDebtPerUser: 90,
      oldestDebtAge: 10,
    });
  });

  it('без долгов статистика нулевая, без деления на ноль', async () => {
    asMock(prismaMock.transaction.findMany).mockResolvedValue([] as never);

    await expect(service.getDebtStats(100)).resolves.toEqual({
      totalDebtors: 0,
      totalDebtAmount: 0,
      avgDebtPerUser: 0,
      oldestDebtAge: 0,
    });
  });

  it('ошибка статистики выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.findMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.getDebtStats(100)).rejects.toThrow('db down');
  });
});

describe('forgiveDebt', () => {
  beforeEach(() => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      poll: { groupId: 100 },
    } as never);
    asMock(prismaMock.transaction.update).mockResolvedValue({
      id: 10,
      status: 'FORGIVEN',
    });
  });

  it('списывает долг и помечает время', async () => {
    await service.forgiveDebt(10, 9, 100);

    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: 'FORGIVEN', paidAt: NOW, confirmedAt: NOW },
    });
  });

  it('долг из чужой группы списать нельзя', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      poll: { groupId: 999 },
    } as never);

    await expect(service.forgiveDebt(10, 9, 100)).rejects.toThrow(
      'Debt not found in group'
    );
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('долга нет — отказ', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    await expect(service.forgiveDebt(10, 9, 100)).rejects.toThrow(
      'Debt not found in group'
    );
  });
});

describe('напоминания должникам', () => {
  const debtor = {
    id: 1,
    telegramId: BigInt(555),
    firstName: 'Игорь',
    lastName: null,
    debts: [
      {
        id: 10,
        amount: 100,
        createdAt: new Date(NOW.getTime() - 3 * DAY),
        pollId: 5,
        toUser: { id: 2, firstName: 'Аня' },
      },
    ],
  };

  beforeEach(() => {
    asMock(prismaMock.user.findMany).mockResolvedValue([debtor] as never);
    asMock(prismaMock.transaction.updateMany).mockResolvedValue({
      count: 1,
    });
  });

  it('рассылает всем должникам группы и считает отправленные', async () => {
    const result = await service.remindAllDebtors(100);

    expect(result).toEqual({ sent: 1, total: 1 });
    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe(555);
    expect(message).toContain('Привет, Игорь!');
    expect(message).toContain('100.00₽');
    expect(message).toContain('→ Аня');
  });

  it('счётчик напоминаний растёт только у своей группы', async () => {
    await service.remindAllDebtors(100);

    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { fromUserId: 1, status: 'PENDING', poll: { groupId: 100 } },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('недоставленное сообщение не увеличивает счётчик', async () => {
    sendMessage.mockRejectedValue(new Error('bot blocked'));

    const result = await service.remindAllDebtors(100);

    expect(result).toEqual({ sent: 0, total: 1 });
    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('без поднятого бота рассылка невозможна', async () => {
    botInstance.mockReturnValue(null);

    await expect(service.remindAllDebtors(100)).rejects.toThrow(
      'Bot instance not available'
    );
  });

  it.each([
    [0, 'сегодня'],
    [1, 'вчера'],
    [3, '3 дней назад'],
    [10, '1 недель назад'],
    [60, '2 месяцев назад'],
  ])('возраст долга %i дней описывается как «%s»', async (days, expected) => {
    asMock(prismaMock.user.findMany).mockResolvedValue([
      {
        ...debtor,
        debts: [
          { ...debtor.debts[0], createdAt: new Date(NOW.getTime() - days * DAY) },
        ],
      },
    ] as never);

    await service.remindAllDebtors(100);

    expect(sendMessage.mock.calls[0][1]).toContain(expected);
  });

  it('точечное напоминание уходит должнику', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      amount: 250,
      createdAt: new Date(NOW.getTime() - 2 * DAY),
      fromUser: { telegramId: BigInt(555) },
      toUser: { firstName: 'Аня', lastName: 'П' },
      menuItem: { name: 'Плов' },
      poll: { groupId: 100 },
    } as never);
    asMock(prismaMock.transaction.update).mockResolvedValue({ id: 10 });

    await service.remindDebtor(10, 100);

    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe(555);
    expect(message).toContain('250.00₽');
    expect(message).toContain('Аня П');
    expect(message).toContain('За: Плов');
    expect(message).toContain('2 дня назад');
    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { reminderCount: { increment: 1 }, lastReminderAt: NOW },
    });
  });

  it('долг без блюда (магазинный) тоже напоминается', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      amount: 100,
      createdAt: NOW,
      fromUser: { telegramId: BigInt(555) },
      toUser: { firstName: 'Аня', lastName: null },
      menuItem: null,
      poll: { groupId: 100 },
    } as never);
    asMock(prismaMock.transaction.update).mockResolvedValue({ id: 10 });

    await service.remindDebtor(10, 100);

    expect(sendMessage.mock.calls[0][1]).not.toContain('За:');
  });

  it.each([
    [1, 'день'],
    [2, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [21, 'день'],
  ])('склонение дней: %i → «%s»', async (days, word) => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      amount: 100,
      createdAt: new Date(NOW.getTime() - days * DAY),
      fromUser: { telegramId: BigInt(555) },
      toUser: { firstName: 'Аня', lastName: null },
      menuItem: null,
      poll: { groupId: 100 },
    } as never);
    asMock(prismaMock.transaction.update).mockResolvedValue({ id: 10 });

    await service.remindDebtor(10, 100);

    expect(sendMessage.mock.calls[0][1]).toContain(`${days} ${word} назад`);
  });

  it('долг чужой группы напомнить нельзя', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 10,
      poll: { groupId: 999 },
      fromUser: { telegramId: BigInt(555) },
      toUser: { firstName: 'Аня' },
    } as never);

    await expect(service.remindDebtor(10, 100)).rejects.toThrow(
      'Debt not found'
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('точечное напоминание без бота невозможно', async () => {
    botInstance.mockReturnValue(null);

    await expect(service.remindDebtor(10, 100)).rejects.toThrow(
      'Bot instance not available'
    );
  });
});

describe('очистка старых данных', () => {
  beforeEach(() => {
    asMock(prismaMock.poll.findMany).mockResolvedValue([] as never);
    asMock(prismaMock.poll.deleteMany).mockResolvedValue({ count: 4 });
    asMock(prismaMock.transaction.deleteMany).mockResolvedValue({
      count: 7,
    });
    asMock(prismaMock.poll.count).mockResolvedValue(0);
    asMock(prismaMock.transaction.count).mockResolvedValue(0);
  });

  it('удаляет только завершённые голосования старше срока', async () => {
    await service.cleanupOldPolls(30, 100);

    expect(prismaMock.poll.deleteMany).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        groupId: 100,
        endedAt: { lt: new Date('2026-07-04T12:00:00.000Z') },
      },
    });
  });

  it('голосования с непогашенными долгами пропускаются и считаются', async () => {
    asMock(prismaMock.poll.findMany).mockResolvedValue([
      { id: 7 },
      { id: 8 },
    ] as never);
    asMock(prismaMock.poll.deleteMany).mockResolvedValue({ count: 2 });

    const result = await service.cleanupOldPolls(30, 100);

    expect(prismaMock.poll.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { notIn: [7, 8] } }),
    });
    expect(result).toEqual({
      deleted: 2,
      skipped: 2,
      skippedReason: 'unsettled_debts',
    });
  });

  it('живыми считаются долги вне CONFIRMED и FORGIVEN', async () => {
    await service.cleanupOldPolls(30, 100);

    expect(prismaMock.poll.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        transactions: {
          some: { status: { notIn: ['CONFIRMED', 'FORGIVEN'] } },
        },
      }),
      select: { id: true },
    });
  });

  it('без пропущенных причина не указывается', async () => {
    const result = await service.cleanupOldPolls(30, 100);

    expect(result).toEqual({ deleted: 4, skipped: 0, skippedReason: undefined });
  });

  it('ошибка очистки голосований выбрасывается наружу', async () => {
    asMock(prismaMock.poll.deleteMany).mockRejectedValue(new Error('db down'));

    await expect(service.cleanupOldPolls(30, 100)).rejects.toThrow('db down');
  });

  it('транзакции удаляются только закрытые', async () => {
    const result = await service.cleanupOldTransactions(90, 100);

    expect(prismaMock.transaction.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['CONFIRMED', 'FORGIVEN'] },
        paidAt: { lt: new Date('2026-05-05T12:00:00.000Z') },
        poll: { groupId: 100 },
      },
    });
    expect(result).toEqual({ deleted: 7 });
  });

  it('ошибка очистки транзакций выбрасывается наружу', async () => {
    asMock(prismaMock.transaction.deleteMany).mockRejectedValue(
      new Error('db down')
    );

    await expect(service.cleanupOldTransactions(90, 100)).rejects.toThrow(
      'db down'
    );
  });

  it('предпросмотр голосований считает удаляемые и заблокированные', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);

    await expect(service.previewPollCleanup(45, 100)).resolves.toEqual({
      deletable: 7,
      blockedByDebt: 3,
    });
  });

  it('предпросмотр транзакций считает только закрытые', async () => {
    asMock(prismaMock.transaction.count).mockResolvedValue(5);

    await expect(service.previewTransactionCleanup(45, 100)).resolves.toEqual({
      deletable: 5,
      blockedByDebt: 0,
    });
  });

  it('статистика очистки отдаёт срезы 30/60/90', async () => {
    asMock(prismaMock.poll.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    asMock(prismaMock.transaction.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);

    await expect(service.getCleanupStats(100)).resolves.toEqual({
      oldPolls: { count30Days: 1, count60Days: 2, count90Days: 3 },
      oldTransactions: { count30Days: 4, count60Days: 5, count90Days: 6 },
    });
  });

  it('ошибка статистики очистки выбрасывается наружу', async () => {
    asMock(prismaMock.poll.count).mockRejectedValue(new Error('db down'));

    await expect(service.getCleanupStats(100)).rejects.toThrow('db down');
  });
});
