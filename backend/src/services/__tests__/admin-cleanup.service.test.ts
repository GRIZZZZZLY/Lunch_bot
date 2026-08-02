/* Очистка данных — единственное место в продукте, где админ одним тапом
   удаляет чужие записи навсегда. Здесь закреплено, что деньги она не трогает. */
import { AdminService } from '../admin.service';
import { prisma } from '../../database/client';

jest.mock('../../database/client', () => ({
  prisma: {
    poll: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../bot/bot-instance', () => ({ getBotInstance: () => null }));

const service = new AdminService();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AdminService.cleanupOldPolls', () => {
  /* Регрессия. Transaction.poll объявлен onDelete: Cascade, а здесь стоял
     голый deleteMany по опросам: админ чистил «старые голосования», и вместе
     с ними бесследно исчезали НЕПОГАШЕННЫЕ долги за те обеды. Диалог про
     деньги не говорил ни слова. */
  it('не удаляет опросы, за которыми висят непогашенные долги', async () => {
    (prisma.poll.findMany as jest.Mock).mockResolvedValue([{ id: 7 }, { id: 9 }]);
    (prisma.poll.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

    const res = await service.cleanupOldPolls(30, 1);

    // ищем именно живые деньги: закрыт долг только в CONFIRMED и FORGIVEN
    expect(prisma.poll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          transactions: { some: { status: { notIn: ['CONFIRMED', 'FORGIVEN'] } } },
        }),
      }),
    );
    // и исключаем найденное из удаления
    expect(prisma.poll.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { notIn: [7, 9] } }),
    });
    expect(res).toEqual({ deleted: 3, skipped: 2, skippedReason: 'unsettled_debts' });
  });

  it('без непогашенных долгов удаляет всё подходящее и ничего не пропускает', async () => {
    (prisma.poll.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.poll.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

    const res = await service.cleanupOldPolls(30, 1);

    // без исключений where остаётся простым — лишнего условия не добавляем
    const call = (prisma.poll.deleteMany as jest.Mock).mock.calls[0][0];
    expect(call.where.id).toBeUndefined();
    expect(res).toEqual({ deleted: 5, skipped: 0, skippedReason: undefined });
  });
});

describe('AdminService.cleanupOldTransactions', () => {
  /* Регрессия. Удалялись PAID и FORGIVEN. Но PAID — это «должник отметил
     оплату, сборщик ещё не подтвердил», то есть живые деньги: запись
     исчезала, и спорить об оплате становилось не о чем. CONFIRMED при этом
     не удалялись никогда, то есть чистка не делала и того, ради чего есть. */
  it('удаляет только закрытые долги, не трогая неподтверждённые', async () => {
    (prisma.transaction.deleteMany as jest.Mock).mockResolvedValue({ count: 4 });

    await service.cleanupOldTransactions(90, 1);

    expect(prisma.transaction.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['CONFIRMED', 'FORGIVEN'] } }),
      }),
    );
  });
});

describe('AdminService.previewPollCleanup', () => {
  /* Поле срока принимает любое число, а статистика отдаёт только 30/60/90:
     админ подтверждал необратимое удаление за 45 дней вслепую. */
  it('считает, сколько уйдёт и сколько удержат долги', async () => {
    (prisma.poll.count as jest.Mock)
      .mockResolvedValueOnce(10) // всего подходящих
      .mockResolvedValueOnce(3); // из них с живыми деньгами

    await expect(service.previewPollCleanup(45, 1)).resolves.toEqual({
      deletable: 7,
      blockedByDebt: 3,
    });
  });
});
